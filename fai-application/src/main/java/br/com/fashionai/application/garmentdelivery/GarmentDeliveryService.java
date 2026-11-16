package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.atelierproject.AtelierAccountDataCleanup;
import br.com.fashionai.application.atelierproject.AtelierProjectService;
import br.com.fashionai.application.atelierproject.AtelierProjectViews.Specification;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.fit.SizeOptionsService;
import br.com.fashionai.application.garmentdelivery.GarmentCompositionRules.BomMaterial;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.*;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.atelierproject.DesignProject;
import br.com.fashionai.domain.model.atelierproject.DesignProjectMember;
import br.com.fashionai.domain.model.atelierproject.DesignRevision;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrder;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrderEvent;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.atelierproject.DesignProjectMemberRepository;
import br.com.fashionai.domain.repository.atelierproject.DesignRevisionRepository;
import br.com.fashionai.domain.repository.garmentdelivery.GarmentOrderEventRepository;
import br.com.fashionai.domain.repository.garmentdelivery.GarmentOrderRepository;
import br.com.fashionai.domain.repository.sourcing.AtelierBomItemRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * FashionAI Garment Delivery (docs/garment-delivery/GARMENT_DELIVERY.md): encomenda de uma revisão do Atelier à Fábrica
 * FashionAI, que é fictícia. Só participantes do projeto cotam e encomendam; só a dona vê e age na encomenda (outra
 * pessoa recebe 404). Simulação: sem pagamento, sem endereço além do CEP, nenhuma peça física.
 */
@Service
@Transactional
public class GarmentDeliveryService {
    private final AtelierProjectService projects;
    private final DesignRevisionRepository revisions;
    private final DesignProjectMemberRepository members;
    private final AtelierBomItemRepository bom;
    private final GarmentOrderRepository orders;
    private final GarmentOrderEventRepository events;
    private final UserRepository users;
    private final Guard guard;
    private final GarmentOrderProgress progress;
    private final GarmentOrderReceipt receipt;
    private final GarmentQuoter quoter;
    private final Clock clock;

    @Autowired
    public GarmentDeliveryService(AtelierProjectService projects, DesignRevisionRepository revisions, DesignProjectMemberRepository members,
                                  AtelierBomItemRepository bom, GarmentOrderRepository orders, GarmentOrderEventRepository events,
                                  UserRepository users, Guard guard, GarmentOrderProgress progress, GarmentOrderReceipt receipt,
                                  SizeOptionsService sizes, AssetCatalogService assets) {
        this(projects, revisions, members, bom, orders, events, users, guard, progress, receipt, new GarmentQuoter(sizes, assets), Clock.systemUTC());
    }

    GarmentDeliveryService(AtelierProjectService projects, DesignRevisionRepository revisions, DesignProjectMemberRepository members,
                           AtelierBomItemRepository bom, GarmentOrderRepository orders, GarmentOrderEventRepository events,
                           UserRepository users, Guard guard, GarmentOrderProgress progress, GarmentOrderReceipt receipt,
                           GarmentQuoter quoter, Clock clock) {
        this.projects = projects;
        this.revisions = revisions;
        this.members = members;
        this.bom = bom;
        this.orders = orders;
        this.events = events;
        this.users = users;
        this.guard = guard;
        this.progress = progress;
        this.receipt = receipt;
        this.quoter = quoter;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Quote quote(CurrentUser user, UUID projectId, UUID revisionId, String size, String cep, String speed) {
        return quoter.quote(source(user, projectId, revisionId), size, cep, null, speed, clock.instant()).quote();
    }

    public OrderDetail create(CurrentUser user, UUID projectId, UUID revisionId, CreateCmd cmd) {
        guard.requireCanCreate(user);
        if (cmd == null || cmd.requestId() == null || !cmd.requestId().matches("[A-Za-z0-9_-]{8,80}")) {
            throw ApiException.badRequest("GARMENT_ORDER_KEY_REQUIRED", Msg.t("garmentDelivery.erro.chave_invalida"));
        }
        if (!cmd.acceptSimulation()) {
            throw ApiException.badRequest("GARMENT_ORDER_SIMULATION_REQUIRED", Msg.t("garmentDelivery.erro.simulacao"));
        }
        GarmentQuoter.Source source = source(user, projectId, revisionId);
        String digits = CepRegions.digits(cmd.cep());
        String digest = FactoryIdentifiers.digest(String.join("|", revisionId.toString(), String.valueOf(cmd.size()), String.valueOf(digits),
                String.valueOf(GarmentQuoter.label(cmd.deliveryLabel())), GarmentQuoter.speed(cmd.speed())));
        var prior = orders.findByOwnerIdAndRequestId(user.id(), cmd.requestId());
        if (prior.isPresent()) {
            if (!prior.get().getRequestDigest().equals(digest)) {
                throw ApiException.conflict("GARMENT_ORDER_KEY_REUSED", Msg.t("garmentDelivery.erro.chave_reutilizada"));
            }
            return detail(prior.get());
        }
        Instant now = clock.instant();
        GarmentQuoter.Result result = quoter.quote(source, cmd.size(), cmd.cep(), cmd.deliveryLabel(), cmd.speed(), now);
        Quote quote = result.quote();
        if (!quote.eligible()) {
            throw new ApiException(409, "GARMENT_ORDER_INCOMPLETE_TECH_PACK", Msg.t("garmentDelivery.erro.ficha_incompleta"),
                    Map.of("missingFields", quote.missingFields()));
        }
        if (quote.delivery() == null) {
            throw ApiException.badRequest("GARMENT_ORDER_CEP_REQUIRED", Msg.t("garmentDelivery.erro.cep_obrigatorio"));
        }
        return detail(place(user, source, quote, result.frozen(), digits, cmd, digest, now));
    }

    @Transactional(readOnly = true)
    public List<OrderSummary> list(CurrentUser user) {
        authenticated(user);
        Instant now = clock.instant();
        return orders.findTop50ByOwnerIdOrderByPlacedAtDesc(user.id()).stream().map(o -> GarmentOrderViews.summary(o, now)).toList();
    }

    public OrderDetail detail(CurrentUser user, UUID id) {
        authenticated(user);
        return detail(owned(user, id));
    }

    /** Só antes do corte; repetir o cancelamento devolve a encomenda já cancelada. */
    public OrderDetail cancel(CurrentUser user, UUID id, VersionCmd cmd) {
        guard.requireCanCreate(user);
        GarmentOrder order = owned(user, id);
        if (order.getCancelledAt() != null) {
            return detail(order);
        }
        version(order, cmd);
        Instant now = clock.instant();
        progress.materialize(order, now);
        if (order.getReceivedAt() != null || !FactoryPlanRules.CANCELLABLE.contains(FactoryPlanRules.stageAt(GarmentOrderViews.plan(order), now))) {
            throw ApiException.conflict("GARMENT_ORDER_NOT_CANCELLABLE", Msg.t("garmentDelivery.erro.nao_cancelavel"));
        }
        order.setCancelledAt(now);
        order.setStatus(FactoryPlanRules.CANCELLED);
        orders.saveAndFlush(order);
        events.save(new GarmentOrderEvent(order.getId(), FactoryPlanRules.CANCELLED, now));
        return detail(order);
    }

    /** Só depois da entrega; cria a peça e o passaporte uma única vez (repetir devolve a mesma peça). */
    public OrderDetail receive(CurrentUser user, UUID id, VersionCmd cmd) {
        guard.requireCanCreate(user);
        GarmentOrder order = owned(user, id);
        if (order.getReceivedAt() != null) {
            return detail(order);
        }
        version(order, cmd);
        if (order.getCancelledAt() != null) {
            throw ApiException.conflict("GARMENT_ORDER_CANCELLED", Msg.t("garmentDelivery.erro.cancelada"));
        }
        Instant now = clock.instant();
        List<GarmentOrderEvent> stages = progress.materialize(order, now);
        if (!"DELIVERED".equals(FactoryPlanRules.stageAt(GarmentOrderViews.plan(order), now))) {
            throw ApiException.conflict("GARMENT_ORDER_NOT_DELIVERED", Msg.t("garmentDelivery.erro.nao_entregue"));
        }
        UUID pieceId = receipt.receive(order, GarmentOrderViews.frozen(order), stages, now);
        order.setReceivedAt(now);
        order.setPieceId(pieceId);
        order.setStatus(FactoryPlanRules.RECEIVED);
        orders.saveAndFlush(order);
        events.save(new GarmentOrderEvent(order.getId(), FactoryPlanRules.RECEIVED, now));
        return detail(order);
    }

    private GarmentOrder place(CurrentUser user, GarmentQuoter.Source source, Quote quote, Frozen frozen, String digits, CreateCmd cmd,
                               String digest, Instant now) {
        String serial = FactoryIdentifiers.serial(now);
        for (int attempt = 0; attempt < 5 && orders.existsBySerialNumber(serial); attempt++) {
            serial = FactoryIdentifiers.serial(now);
        }
        GarmentOrder order = new GarmentOrder();
        order.setOwnerId(user.id());
        order.setProjectId(source.projectId());
        order.setRevisionId(source.revisionId());
        order.setRevisionNumber(source.revisionNumber());
        order.setProjectTitle(source.title());
        order.setSpecDigest(quote.specDigest());
        order.setSpecSnapshotJson(source.specJson());
        List<Designer> credits = frozen.designers().stream().map(d -> new Designer(d.userId(), null, d.role())).toList();
        order.setQuoteJson(Json.write(new Frozen(frozen.garment(), frozen.composition(), frozen.care(),
                GarmentSizeRules.checked(frozen.measurements(), serial), frozen.sizes(), frozen.price(), frozen.delivery(), credits)));
        order.setPlanJson(Json.write(new GarmentOrderViews.Plan(quote.plan())));
        order.setSizeLabel(quote.sizes().selected());
        order.setSpeed(quote.speed());
        order.setCepPrefix(CepRegions.prefix(digits));
        order.setRegion(quote.delivery().region());
        order.setDeliveryLabel(quote.delivery().label());
        order.setPriceTotal(quote.price().total());
        order.setSerialNumber(serial);
        order.setLotCode(FactoryIdentifiers.lot(now, quote.garment().line()));
        order.setTrackingCode(FactoryIdentifiers.tracking(serial));
        order.setStatus("PLACED");
        order.setPlacedAt(now);
        order.setRequestId(cmd.requestId());
        order.setRequestDigest(digest);
        orders.saveAndFlush(order);
        events.save(new GarmentOrderEvent(order.getId(), "PLACED", now));
        return order;
    }

    private OrderDetail detail(GarmentOrder order) {
        Instant now = clock.instant();
        List<GarmentOrderEvent> rows = progress.materialize(order, now);
        List<Designer> designers = GarmentOrderViews.named(GarmentOrderViews.frozen(order).designers(), this::username);
        return GarmentOrderViews.detail(order, rows, designers, now);
    }

    /** Participante do projeto (mesma regra do editor 3D do Atelier) e revisão do próprio projeto. */
    private GarmentQuoter.Source source(CurrentUser user, UUID projectId, UUID revisionId) {
        DesignProject project = projects.access3d(user, projectId, false);
        DesignRevision revision = revisions.findById(revisionId).filter(r -> r.getProjectId().equals(projectId))
                .orElseThrow(() -> ApiException.notFound(Msg.t("garmentDelivery.revisao")));
        Specification spec = Json.read(revision.getSpecificationJson(), Specification.class);
        if (spec == null) {
            throw new IllegalStateException("Ficha da revisão ilegível: " + revisionId);
        }
        List<BomMaterial> materials = bom.findByRevisionIdAndRemovedAtIsNullOrderByCreatedAtAsc(revisionId).stream()
                .filter(item -> "MATERIAL".equals(item.getKind())).map(item -> new BomMaterial(item.getName(), item.getQuantity())).toList();
        return new GarmentQuoter.Source(projectId, revisionId, revision.getNumber(), revision.getTitle(), revision.getSpecificationJson(),
                spec, materials, GarmentOrderViews.named(designers(project, revision), this::username));
    }

    private List<Designer> designers(DesignProject project, DesignRevision revision) {
        List<Designer> out = new ArrayList<>();
        out.add(new Designer(project.getOwnerId(), null, "OWNER"));
        for (DesignProjectMember m : members.findByProjectIdOrderByCreatedAtAsc(project.getId())) {
            if (m.getStatus() == DesignProjectMember.Status.ACCEPTED && m.getRole() == DesignProjectMember.Role.EDITOR) {
                out.add(new Designer(m.getUserId(), null, "EDITOR"));
            }
        }
        UUID author = revision.getAuthorId();
        if (!AtelierAccountDataCleanup.ANONYMOUS_AUTHOR.equals(author) && out.stream().noneMatch(d -> d.userId().equals(author))) {
            out.add(new Designer(author, null, "REVISION_AUTHOR"));
        }
        return out;
    }

    private String username(UUID id) {
        return users.findById(id).filter(u -> u.getStatus() != AccountStatus.DELETED).map(User::getUsername)
                .orElse(Msg.t("account.conta_excluida"));
    }

    private GarmentOrder owned(CurrentUser user, UUID id) {
        return orders.lockById(id).filter(o -> o.getOwnerId().equals(user.id()))
                .orElseThrow(() -> ApiException.notFound(Msg.t("garmentDelivery.encomenda")));
    }

    private static void version(GarmentOrder order, VersionCmd cmd) {
        if (cmd == null || order.getVersion() != cmd.expectedVersion()) {
            throw ApiException.conflict("GARMENT_ORDER_VERSION_CONFLICT", Msg.t("garmentDelivery.erro.versao"));
        }
    }

    private static void authenticated(CurrentUser user) {
        if (user == null) {
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
        if (user.status() == AccountStatus.DELETED) {
            throw ApiException.notFound(Msg.t("garmentDelivery.encomenda"));
        }
    }
}
