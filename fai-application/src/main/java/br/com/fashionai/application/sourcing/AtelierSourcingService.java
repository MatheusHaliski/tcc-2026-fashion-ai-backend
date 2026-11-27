package br.com.fashionai.application.sourcing;

import br.com.fashionai.application.atelierproject.AtelierProjectService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.atelierproject.DesignProject;
import br.com.fashionai.domain.model.atelierproject.DesignReview;
import br.com.fashionai.domain.model.atelierproject.DesignRevision;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.sourcing.AtelierBomItem;
import br.com.fashionai.domain.model.sourcing.AtelierQuote;
import br.com.fashionai.domain.model.sourcing.AtelierQuoteRequest;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.atelierproject.DesignReviewRepository;
import br.com.fashionai.domain.repository.atelierproject.DesignRevisionRepository;
import br.com.fashionai.domain.repository.sourcing.AtelierBomItemRepository;
import br.com.fashionai.domain.repository.sourcing.AtelierQuoteRepository;
import br.com.fashionai.domain.repository.sourcing.AtelierQuoteRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import static br.com.fashionai.application.sourcing.AtelierSourcingViews.*;

/**
 * RF-PESQ-04 — BOM e cotação vinculadas a uma revisão imutável do Atelier. O fornecedor só enxerga o que o pedido de
 * cotação concede (revisão + BOM + quantidades); revisão nova deixa a cotação "desatualizada"; o aceite registra autor
 * e versão. Pré-venda, pagamento e promessa de entrega ficam fora: {@code commitment = NONE}.
 */
@Service
@Transactional
public class AtelierSourcingService {
    private static final Set<String> KINDS = Set.of("MATERIAL", "TRIM", "LABOR", "PACKAGING");
    private final AtelierProjectService projects;
    private final AtelierBomItemRepository bom;
    private final AtelierQuoteRequestRepository requests;
    private final AtelierQuoteRepository quotes;
    private final DesignRevisionRepository revisions;
    private final DesignReviewRepository reviews;
    private final UserRepository users;
    private final Guard guard;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public AtelierSourcingService(AtelierProjectService projects, AtelierBomItemRepository bom, AtelierQuoteRequestRepository requests,
                                  AtelierQuoteRepository quotes, DesignRevisionRepository revisions, DesignReviewRepository reviews,
                                  UserRepository users, Guard guard) {
        this(projects, bom, requests, quotes, revisions, reviews, users, guard, Clock.systemUTC());
    }

    AtelierSourcingService(AtelierProjectService projects, AtelierBomItemRepository bom, AtelierQuoteRequestRepository requests,
                           AtelierQuoteRepository quotes, DesignRevisionRepository revisions, DesignReviewRepository reviews,
                           UserRepository users, Guard guard, Clock clock) {
        this.projects = projects; this.bom = bom; this.requests = requests; this.quotes = quotes; this.revisions = revisions;
        this.reviews = reviews; this.users = users; this.guard = guard; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> bom(CurrentUser user, UUID projectId, UUID revisionId) {
        readable(user, projectId, revisionId);
        return bom.findByRevisionIdAndRemovedAtIsNullOrderByCreatedAtAsc(revisionId).stream().map(AtelierSourcingViews::bomItem).toList();
    }

    public Map<String, Object> addBomItem(CurrentUser user, UUID projectId, BomItemCmd cmd) {
        DesignProject p = projects.access3d(user, projectId, true);
        if (cmd == null || cmd.requestId() == null || cmd.requestId().isBlank()) throw ApiException.badRequest("BOM_INVALID", "Informe a chave do pedido.");
        var prior = bom.findByProjectIdAndAuthorIdAndRequestId(projectId, user.id(), cmd.requestId());
        if (prior.isPresent()) return bomItem(prior.get());
        DesignRevision r = revision(p, cmd.revisionId());
        if (cmd.kind() == null || !KINDS.contains(cmd.kind()) || cmd.name() == null || cmd.name().isBlank() || cmd.unit() == null || cmd.unit().isBlank()
                || cmd.quantity() == null || cmd.quantity().signum() <= 0 || cmd.quantity().compareTo(new BigDecimal("100000")) > 0) {
            throw ApiException.badRequest("BOM_INVALID", "Informe tipo, nome, unidade e consumo por peça (maior que zero).");
        }
        AtelierBomItem item = new AtelierBomItem();
        item.setProjectId(projectId); item.setRevisionId(r.getId()); item.setAuthorId(user.id()); item.setKind(cmd.kind());
        item.setName(InputSanitizer.clean(cmd.name(), 160)); item.setUnit(InputSanitizer.clean(cmd.unit(), 20)); item.setQuantity(cmd.quantity());
        item.setNotes(cmd.notes() == null || cmd.notes().isBlank() ? null : InputSanitizer.clean(cmd.notes(), 1000)); item.setRequestId(cmd.requestId());
        return bomItem(bom.saveAndFlush(item));
    }

    public void removeBomItem(CurrentUser user, UUID projectId, UUID itemId) {
        projects.access3d(user, projectId, true);
        AtelierBomItem item = bom.findById(itemId).filter(b -> b.getProjectId().equals(projectId)).orElseThrow(() -> ApiException.notFound("Item"));
        if (item.getRemovedAt() == null) { item.setRemovedAt(clock.instant()); bom.save(item); }
    }

    /** Gatilho: revisão técnica liberada (decisão de exposição aprovada). Voto/interesse nunca basta. */
    public Map<String, Object> requestQuote(CurrentUser user, UUID projectId, QuoteRequestCmd cmd) {
        DesignProject p = projects.manage3dGuests(user, projectId);
        if (cmd == null || cmd.requestId() == null || cmd.requestId().isBlank()) throw ApiException.badRequest("QUOTE_INVALID", "Informe a chave do pedido.");
        var prior = requests.findByProjectIdAndRequestedByAndRequestId(projectId, user.id(), cmd.requestId());
        if (prior.isPresent()) return requestView(user, p, prior.get());
        DesignRevision r = revision(p, cmd.revisionId());
        boolean released = reviews.findByProjectIdAndRevisionIdOrderByCreatedAtDesc(projectId, r.getId()).stream()
                .anyMatch(d -> d.getDecision() == DesignReview.Decision.APPROVE_SHOWCASE);
        if (!released) throw ApiException.conflict("REVISION_NOT_RELEASED", "A revisão precisa de uma revisão técnica aprovada antes da cotação.");
        if (cmd.currency() == null || !cmd.currency().matches("[A-Z]{3}") || cmd.sizes() == null || cmd.sizes().isEmpty()
                || cmd.sizes().values().stream().anyMatch(q -> q == null || q < 1 || q > 1_000_000)) {
            throw ApiException.badRequest("QUOTE_INVALID", "Informe moeda ISO e quantidades por tamanho (maiores que zero).");
        }
        String username = cmd.supplierUsername() == null ? "" : cmd.supplierUsername().replaceFirst("^@", "").trim();
        User supplier = users.findByUsernameIgnoreCase(username).orElseThrow(() -> ApiException.notFound("Fornecedor"));
        if (supplier.getStatus() != AccountStatus.ACTIVE || supplier.getId().equals(user.id()) || guard.blocked(user.id(), supplier.getId())) {
            throw ApiException.badRequest("SUPPLIER_UNAVAILABLE", "Escolha outra conta ativa para a cotação.");
        }
        AtelierQuoteRequest q = new AtelierQuoteRequest();
        q.setProjectId(projectId); q.setRevisionId(r.getId()); q.setRequestedBy(user.id()); q.setSupplierId(supplier.getId());
        q.setCurrency(cmd.currency()); q.setSizesJson(Json.write(new LinkedHashMap<>(cmd.sizes()))); q.setStatus("OPEN"); q.setRequestId(cmd.requestId());
        q.setNotes(cmd.notes() == null || cmd.notes().isBlank() ? null : InputSanitizer.clean(cmd.notes(), 2000));
        return requestView(user, p, requests.saveAndFlush(q));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> requests(CurrentUser user, UUID projectId) {
        DesignProject p = projects.access3d(user, projectId, false);
        return requests.findByProjectIdOrderByCreatedAtDesc(projectId).stream().map(r -> requestView(user, p, r)).toList();
    }

    /** CA2 — o fornecedor vê só os pedidos endereçados a ele, com a revisão e a BOM concedidas. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> supplierInbox(CurrentUser user) {
        guard.requireCanCreate(user);
        return requests.findBySupplierIdOrderByCreatedAtDesc(user.id()).stream().map(r -> {
            Map<String, Object> view = new LinkedHashMap<>(requestView(user, null, r));
            DesignRevision rev = revisions.findById(r.getRevisionId()).orElse(null);
            view.put("projectTitle", rev == null ? null : rev.getTitle());
            view.put("specification", rev == null ? null : Json.map(rev.getSpecificationJson()));
            view.put("bom", bom.findByRevisionIdAndRemovedAtIsNullOrderByCreatedAtAsc(r.getRevisionId()).stream().map(AtelierSourcingViews::bomItem).toList());
            return view;
        }).toList();
    }

    public Map<String, Object> submitQuote(CurrentUser user, UUID requestId, QuoteCmd cmd) {
        guard.requireCanCreate(user);
        AtelierQuoteRequest r = requests.lockById(requestId).orElseThrow(() -> ApiException.notFound("Pedido de cotação"));
        if (!r.getSupplierId().equals(user.id())) throw ApiException.forbidden("Somente o fornecedor convidado cota este pedido.");
        if (cmd == null || cmd.commandKey() == null || !cmd.commandKey().matches("[a-zA-Z0-9_-]{8,80}")) throw ApiException.badRequest("IDEMPOTENCY_KEY_REQUIRED", "Envie uma chave de idempotência válida.");
        var prior = quotes.findByQuoteRequestIdAndSupplierIdAndCommandKey(requestId, user.id(), cmd.commandKey());
        if (prior.isPresent()) return quote(prior.get(), true, LocalDate.now(clock));
        if (!Set.of("OPEN", "QUOTED").contains(r.getStatus())) throw ApiException.conflict("QUOTE_CLOSED", "Este pedido de cotação já foi encerrado.");
        if (cmd.unitPrice() == null || cmd.unitPrice().signum() < 0 || cmd.sampleCost() == null || cmd.sampleCost().signum() < 0 || cmd.leadTimeDays() == null
                || cmd.leadTimeDays() < 1 || cmd.leadTimeDays() > 730 || cmd.validUntil() == null || !cmd.validUntil().isAfter(LocalDate.now(clock))
                || cmd.currency() == null || !cmd.currency().equals(r.getCurrency())) {
            throw ApiException.badRequest("QUOTE_INVALID", "Informe preço, custo de amostra, prazo, validade futura e a moeda pedida.");
        }
        AtelierQuote q = new AtelierQuote();
        q.setQuoteRequestId(requestId); q.setSupplierId(user.id()); q.setUnitPrice(cmd.unitPrice()); q.setSampleCost(cmd.sampleCost()); q.setCurrency(cmd.currency());
        q.setLeadTimeDays(cmd.leadTimeDays()); q.setValidUntil(cmd.validUntil()); q.setStatus("SUBMITTED"); q.setCommandKey(cmd.commandKey());
        q.setNotes(cmd.notes() == null || cmd.notes().isBlank() ? null : InputSanitizer.clean(cmd.notes(), 2000));
        quotes.saveAndFlush(q); r.setStatus("QUOTED"); requests.saveAndFlush(r);
        return quote(q, true, LocalDate.now(clock));
    }

    /** CA3 — aceite só da revisão vigente e dentro da validade; grava autor e versão do projeto. */
    public Map<String, Object> acceptQuote(CurrentUser user, UUID projectId, UUID quoteId, AcceptCmd cmd) {
        DesignProject p = projects.manage3dGuests(user, projectId);
        AtelierQuote q = quotes.findById(quoteId).orElseThrow(() -> ApiException.notFound("Cotação"));
        AtelierQuoteRequest r = requests.lockById(q.getQuoteRequestId()).filter(x -> x.getProjectId().equals(projectId)).orElseThrow(() -> ApiException.notFound("Pedido de cotação"));
        if ("ACCEPTED".equals(q.getStatus())) return quote(q, true, LocalDate.now(clock));
        if (cmd == null || q.getVersion() != cmd.expectedVersion()) throw ApiException.conflict("QUOTE_VERSION_CONFLICT", "A cotação mudou. Atualize a página.");
        if (!r.getRevisionId().equals(p.getLatestRevisionId())) throw ApiException.conflict("QUOTE_OUTDATED", "A revisão mudou desde a cotação. Peça uma nova cotação.");
        if (q.getValidUntil().isBefore(LocalDate.now(clock))) throw ApiException.conflict("QUOTE_EXPIRED", "A validade da cotação terminou.");
        for (AtelierQuote other : quotes.findByQuoteRequestIdOrderByCreatedAtDesc(r.getId())) {
            if (!other.getId().equals(q.getId()) && "SUBMITTED".equals(other.getStatus())) { other.setStatus("REJECTED"); quotes.save(other); }
        }
        q.setStatus("ACCEPTED"); q.setAcceptedBy(user.id()); q.setAcceptedAt(Instant.now(clock)); q.setAcceptedRevisionId(r.getRevisionId()); q.setAcceptedProjectVersion(p.getVersion());
        quotes.saveAndFlush(q); r.setStatus("ACCEPTED"); requests.saveAndFlush(r);
        return quote(q, true, LocalDate.now(clock));
    }

    private Map<String, Object> requestView(CurrentUser user, DesignProject p, AtelierQuoteRequest r) {
        DesignProject project = p != null ? p : null;
        boolean outdated = project != null && !r.getRevisionId().equals(project.getLatestRevisionId());
        boolean showPrice = r.getSupplierId().equals(user.id()) || (project != null && (project.getOwnerId().equals(user.id()) || user.admin()));
        @SuppressWarnings("unchecked") Map<String, Integer> sizes = (Map<String, Integer>) (Map<?, ?>) Json.map(r.getSizesJson());
        int number = revisions.findById(r.getRevisionId()).map(DesignRevision::getNumber).orElse(0);
        String supplier = users.findById(r.getSupplierId()).map(User::getUsername).orElse(null);
        List<Map<String, Object>> rows = quotes.findByQuoteRequestIdOrderByCreatedAtDesc(r.getId()).stream().map(q -> quote(q, showPrice, LocalDate.now(clock))).toList();
        return request(r, sizes, outdated, number, supplier, rows);
    }

    private DesignRevision revision(DesignProject p, UUID revisionId) {
        if (revisionId == null) throw ApiException.badRequest("REVISION_REQUIRED", "Escolha a revisão.");
        return revisions.findById(revisionId).filter(r -> r.getProjectId().equals(p.getId())).orElseThrow(() -> ApiException.notFound("Revisão"));
    }

    private void readable(CurrentUser user, UUID projectId, UUID revisionId) {
        guard.requireCanCreate(user);
        boolean supplier = requests.findBySupplierIdAndProjectId(user.id(), projectId).stream().anyMatch(r -> r.getRevisionId().equals(revisionId));
        if (!supplier) projects.access3d(user, projectId, false);
    }
}
