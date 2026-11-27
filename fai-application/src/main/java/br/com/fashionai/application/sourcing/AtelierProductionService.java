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
import br.com.fashionai.domain.model.sourcing.AtelierProductionRequest;
import br.com.fashionai.domain.model.sourcing.AtelierSampleDeviation;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.atelierproject.DesignProjectRepository;
import br.com.fashionai.domain.repository.atelierproject.DesignReviewRepository;
import br.com.fashionai.domain.repository.atelierproject.DesignRevisionRepository;
import br.com.fashionai.domain.repository.sourcing.AtelierBomItemRepository;
import br.com.fashionai.domain.repository.sourcing.AtelierProductionRequestRepository;
import br.com.fashionai.domain.repository.sourcing.AtelierSampleDeviationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import static br.com.fashionai.application.sourcing.AtelierProductionViews.*;

/**
 * RF-PESQ-06 — aprovação de amostra e lote. O pedido referencia uma revisão imutável e congela BOM e tolerâncias;
 * desvios podem ser aceitos com justificativa ou devolvidos; a aprovação é explícita, feita pela autoria do projeto,
 * e deixa de valer quando a revisão vigente muda. Voto social não autoriza produção nem cobrança.
 */
@Service
@Transactional
public class AtelierProductionService {
    private final AtelierProjectService projects;
    private final DesignProjectRepository projectRows;
    private final AtelierProductionRequestRepository requests;
    private final AtelierSampleDeviationRepository deviations;
    private final AtelierBomItemRepository bom;
    private final DesignRevisionRepository revisions;
    private final DesignReviewRepository reviews;
    private final UserRepository users;
    private final Guard guard;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public AtelierProductionService(AtelierProjectService projects, DesignProjectRepository projectRows, AtelierProductionRequestRepository requests,
                                    AtelierSampleDeviationRepository deviations, AtelierBomItemRepository bom, DesignRevisionRepository revisions,
                                    DesignReviewRepository reviews, UserRepository users, Guard guard) {
        this(projects, projectRows, requests, deviations, bom, revisions, reviews, users, guard, Clock.systemUTC());
    }

    AtelierProductionService(AtelierProjectService projects, DesignProjectRepository projectRows, AtelierProductionRequestRepository requests,
                             AtelierSampleDeviationRepository deviations, AtelierBomItemRepository bom, DesignRevisionRepository revisions,
                             DesignReviewRepository reviews, UserRepository users, Guard guard, Clock clock) {
        this.projects = projects; this.projectRows = projectRows; this.requests = requests; this.deviations = deviations; this.bom = bom;
        this.revisions = revisions; this.reviews = reviews; this.users = users; this.guard = guard; this.clock = clock;
    }

    /** CA1 — o pedido aponta para a revisão imutável; BOM e tolerâncias são congeladas aqui. */
    public Map<String, Object> request(CurrentUser user, UUID projectId, RequestCmd cmd) {
        DesignProject p = projects.manage3dGuests(user, projectId);
        if (cmd == null || cmd.requestId() == null || cmd.requestId().isBlank()) throw ApiException.badRequest("PRODUCTION_INVALID", "Informe a chave do pedido.");
        var prior = requests.findByProjectIdAndRequestedByAndRequestId(projectId, user.id(), cmd.requestId());
        if (prior.isPresent()) return view(user, p, prior.get());
        DesignRevision r = revisions.findById(cmd.revisionId() == null ? UUID.randomUUID() : cmd.revisionId()).filter(x -> x.getProjectId().equals(projectId))
                .orElseThrow(() -> ApiException.notFound("Revisão"));
        boolean released = reviews.findByProjectIdAndRevisionIdOrderByCreatedAtDesc(projectId, r.getId()).stream().anyMatch(d -> d.getDecision() == DesignReview.Decision.APPROVE_SHOWCASE);
        if (!released) throw ApiException.conflict("REVISION_NOT_RELEASED", "A ficha técnica precisa de revisão aprovada antes da amostra.");
        if (cmd.tolerances() == null || cmd.tolerances().isEmpty()) throw ApiException.badRequest("PRODUCTION_INVALID", "Informe as tolerâncias por ponto de medida.");
        String username = cmd.producerUsername() == null ? "" : cmd.producerUsername().replaceFirst("^@", "").trim();
        User producer = users.findByUsernameIgnoreCase(username).orElseThrow(() -> ApiException.notFound("Produtor"));
        if (producer.getStatus() != AccountStatus.ACTIVE || producer.getId().equals(user.id()) || guard.blocked(user.id(), producer.getId())) {
            throw ApiException.badRequest("PRODUCER_UNAVAILABLE", "Escolha outra conta ativa como produtor.");
        }
        Map<String, String> tolerances = new LinkedHashMap<>();
        cmd.tolerances().forEach((k, v) -> tolerances.put(InputSanitizer.clean(k, 80), InputSanitizer.clean(v == null ? "" : v, 120)));
        AtelierProductionRequest req = new AtelierProductionRequest();
        req.setProjectId(projectId); req.setRevisionId(r.getId()); req.setRequestedBy(user.id()); req.setProducerId(producer.getId()); req.setQuoteId(cmd.quoteId());
        req.setBomSnapshotJson(Json.write(bom.findByRevisionIdAndRemovedAtIsNullOrderByCreatedAtAsc(r.getId()).stream().map(AtelierSourcingViews::bomItem).toList()));
        req.setTolerancesJson(Json.write(tolerances)); req.setStatus("SAMPLE_REQUESTED"); req.setRequestId(cmd.requestId());
        return view(user, p, requests.saveAndFlush(req));
    }

    public Map<String, Object> receiveSample(CurrentUser user, UUID id, VersionCmd cmd) {
        AtelierProductionRequest r = party(user, id, true); version(r, cmd);
        transition(r, Set.of("SAMPLE_REQUESTED", "RETURNED"), "SAMPLE_RECEIVED");
        return view(user, project(r), r);
    }

    public Map<String, Object> recordDeviation(CurrentUser user, UUID id, DeviationCmd cmd) {
        AtelierProductionRequest r = party(user, id, true);
        if (!Set.of("SAMPLE_RECEIVED", "DEVIATIONS_RECORDED").contains(r.getStatus())) throw invalid();
        if (cmd == null || blank(cmd.measurementPoint()) || blank(cmd.expected()) || blank(cmd.measured())) throw ApiException.badRequest("DEVIATION_INVALID", "Informe ponto, valor esperado e medido.");
        AtelierSampleDeviation d = new AtelierSampleDeviation();
        d.setProductionRequestId(id); d.setMeasurementPoint(InputSanitizer.clean(cmd.measurementPoint(), 80)); d.setExpected(InputSanitizer.clean(cmd.expected(), 120));
        d.setMeasured(InputSanitizer.clean(cmd.measured(), 120)); d.setRecordedBy(user.id()); d.setDecision("PENDING");
        deviations.saveAndFlush(d);
        transition(r, Set.of("SAMPLE_RECEIVED", "DEVIATIONS_RECORDED"), "DEVIATIONS_RECORDED");
        return view(user, project(r), r);
    }

    /** CA3 — aceitar exige justificativa; devolver reabre a amostra. Só a autoria decide. */
    public Map<String, Object> decideDeviation(CurrentUser user, UUID id, UUID deviationId, DecisionCmd cmd) {
        AtelierProductionRequest r = owner(user, id);
        AtelierSampleDeviation d = deviations.findById(deviationId).filter(x -> x.getProductionRequestId().equals(id)).orElseThrow(() -> ApiException.notFound("Desvio"));
        if (!"PENDING".equals(d.getDecision())) throw invalid();
        if (cmd == null || (cmd.accept() && blank(cmd.justification()))) throw ApiException.badRequest("DEVIATION_JUSTIFICATION", "Aceitar um desvio exige justificativa.");
        d.setDecision(cmd.accept() ? "ACCEPTED" : "RETURNED"); d.setJustification(cmd.justification() == null ? null : InputSanitizer.clean(cmd.justification(), 1000));
        d.setDecidedBy(user.id()); d.setDecidedAt(clock.instant()); deviations.saveAndFlush(d);
        if (!cmd.accept()) transition(r, Set.of("DEVIATIONS_RECORDED", "SAMPLE_RECEIVED"), "RETURNED");
        return view(user, project(r), r);
    }

    /** CA2/CA4 — aprovação explícita da autoria, só para a revisão vigente, sem desvios pendentes; votos não contam. */
    public Map<String, Object> approve(CurrentUser user, UUID id, VersionCmd cmd) {
        AtelierProductionRequest r = owner(user, id); version(r, cmd);
        DesignProject p = project(r);
        if (!r.getRevisionId().equals(p.getLatestRevisionId())) throw ApiException.conflict("PRODUCTION_REVISION_CHANGED", "A ficha técnica mudou; a amostra precisa de nova aprovação sobre a revisão vigente.");
        if (deviations.findByProductionRequestIdOrderByCreatedAtAsc(id).stream().anyMatch(d -> "PENDING".equals(d.getDecision()))) throw ApiException.conflict("PRODUCTION_PENDING_DEVIATIONS", "Decida todos os desvios antes de aprovar.");
        transition(r, Set.of("SAMPLE_RECEIVED", "DEVIATIONS_RECORDED"), "APPROVED");
        r.setApprovedBy(user.id()); r.setApprovedAt(clock.instant()); r.setApprovedProjectVersion(p.getVersion()); requests.saveAndFlush(r);
        return view(user, p, r);
    }

    public Map<String, Object> cancel(CurrentUser user, UUID id, VersionCmd cmd) {
        AtelierProductionRequest r = owner(user, id); version(r, cmd);
        transition(r, Set.of("SAMPLE_REQUESTED", "SAMPLE_RECEIVED", "DEVIATIONS_RECORDED", "RETURNED"), "CANCELLED");
        return view(user, project(r), r);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(CurrentUser user, UUID projectId) {
        DesignProject p = projects.access3d(user, projectId, false);
        return requests.findByProjectIdOrderByCreatedAtDesc(projectId).stream().map(r -> view(user, p, r)).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> producerInbox(CurrentUser user) {
        guard.requireCanCreate(user);
        return requests.findByProducerIdOrderByCreatedAtDesc(user.id()).stream().map(r -> {
            Map<String, Object> view = new LinkedHashMap<>(view(user, project(r), r));
            revisions.findById(r.getRevisionId()).ifPresent(rev -> { view.put("projectTitle", rev.getTitle()); view.put("specification", Json.map(rev.getSpecificationJson())); });
            return view;
        }).toList();
    }

    private Map<String, Object> view(CurrentUser user, DesignProject p, AtelierProductionRequest r) {
        int number = revisions.findById(r.getRevisionId()).map(DesignRevision::getNumber).orElse(0);
        String role = r.getProducerId().equals(user.id()) ? "PRODUCER" : p.getOwnerId().equals(user.id()) ? "OWNER" : "MEMBER";
        @SuppressWarnings("unchecked") Map<String, String> tolerances = (Map<String, String>) (Map<?, ?>) Json.map(r.getTolerancesJson());
        return AtelierProductionViews.request(r, number, r.getRevisionId().equals(p.getLatestRevisionId()), users.findById(r.getProducerId()).map(User::getUsername).orElse(null), role,
                Json.list(r.getBomSnapshotJson()), tolerances, deviations.findByProductionRequestIdOrderByCreatedAtAsc(r.getId()));
    }

    private DesignProject project(AtelierProductionRequest r) {
        return projectRows.findById(r.getProjectId()).orElseThrow(() -> ApiException.notFound("Projeto"));
    }

    private AtelierProductionRequest owner(CurrentUser user, UUID id) {
        AtelierProductionRequest r = requests.lockById(id).orElseThrow(() -> ApiException.notFound("Pedido de amostra"));
        projects.manage3dGuests(user, r.getProjectId());
        return r;
    }

    private AtelierProductionRequest party(CurrentUser user, UUID id, boolean lock) {
        guard.requireCanCreate(user);
        AtelierProductionRequest r = (lock ? requests.lockById(id) : requests.findById(id)).orElseThrow(() -> ApiException.notFound("Pedido de amostra"));
        if (r.getProducerId().equals(user.id())) return r;
        projects.manage3dGuests(user, r.getProjectId());
        return r;
    }

    private void transition(AtelierProductionRequest r, Set<String> from, String to) {
        if (!from.contains(r.getStatus())) throw invalid();
        r.setStatus(to); requests.saveAndFlush(r);
    }

    private static void version(AtelierProductionRequest r, VersionCmd cmd) {
        if (cmd == null || r.getVersion() != cmd.expectedVersion()) throw ApiException.conflict("PRODUCTION_VERSION_CONFLICT", "O pedido mudou. Atualize a página.");
    }

    private static ApiException invalid() {
        return ApiException.conflict("PRODUCTION_TRANSITION", "Esta ação não vale para o estado atual do pedido.");
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
