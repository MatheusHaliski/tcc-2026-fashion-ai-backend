package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.SafeImage;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.PhysicalStoreOrder;
import br.com.fashionai.domain.model.store.PhysicalStoreReturnCase;
import br.com.fashionai.domain.model.store.PhysicalStoreReturnEvent;
import br.com.fashionai.domain.model.store.PhysicalStoreReturnEvidence;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.PhysicalStoreListingRepository;
import br.com.fashionai.domain.repository.PhysicalStoreOrderRepository;
import br.com.fashionai.domain.repository.PhysicalStoreVariantRepository;
import br.com.fashionai.domain.repository.store.PhysicalStoreReturnCaseRepository;
import br.com.fashionai.domain.repository.store.PhysicalStoreReturnEventRepository;
import br.com.fashionai.domain.repository.store.PhysicalStoreReturnEvidenceRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * RF-PESQ-02 — troca/devolução rastreável. Estados: REQUESTED → APPROVED|REJECTED|CANCELLED; APPROVED → IN_TRANSIT →
 * RECEIVED → INSPECTED → REFUNDED|EXCHANGED|CLOSED. O estorno é lançado uma única vez, depois da inspeção, com chave de
 * idempotência própria; a peça devolvida só volta ao estoque vendável quando a inspeção decide repor.
 */
@Service
@Transactional
public class PhysicalStoreReturnService {
    static final Set<String> OPEN = Set.of("REQUESTED", "APPROVED", "IN_TRANSIT", "RECEIVED", "INSPECTED");
    public record Request(String kind, String reasonCode, String reasonNotes, UUID exchangeVariantId, boolean fitFeedbackConsent) { }
    public record Decision(long expectedVersion, boolean approve, String notes) { }
    public record Shipment(long expectedVersion, String trackingCode) { }
    public record Inspection(long expectedVersion, String outcome, String divergenceReason, boolean restock, boolean settle, String notes) { }

    private final PhysicalStoreReturnCaseRepository cases;
    private final PhysicalStoreReturnEventRepository events;
    private final PhysicalStoreReturnEvidenceRepository evidence;
    private final PhysicalStoreOrderRepository orders;
    private final PhysicalStoreReturnSettlement settlement;
    private final PhysicalStoreReturnAccess access;
    private final Guard guard;
    private final ApplicationEventPublisher publisher;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public PhysicalStoreReturnService(PhysicalStoreReturnCaseRepository cases, PhysicalStoreReturnEventRepository events,
                                      PhysicalStoreReturnEvidenceRepository evidence, PhysicalStoreOrderRepository orders,
                                      PhysicalStoreListingRepository listings, PhysicalStoreVariantRepository variants,
                                      FaiPointsLedgerEntryRepository ledger, Guard guard, ApplicationEventPublisher publisher) {
        this(cases, events, evidence, orders, listings, variants, ledger, guard, publisher, Clock.systemUTC());
    }

    PhysicalStoreReturnService(PhysicalStoreReturnCaseRepository cases, PhysicalStoreReturnEventRepository events,
                               PhysicalStoreReturnEvidenceRepository evidence, PhysicalStoreOrderRepository orders,
                               PhysicalStoreListingRepository listings, PhysicalStoreVariantRepository variants,
                               FaiPointsLedgerEntryRepository ledger, Guard guard, ApplicationEventPublisher publisher, Clock clock) {
        this.cases = cases; this.events = events; this.evidence = evidence; this.orders = orders;
        this.settlement = new PhysicalStoreReturnSettlement(orders, listings, variants, ledger);
        this.access = new PhysicalStoreReturnAccess(cases, orders, guard);
        this.guard = guard; this.publisher = publisher; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> eligibility(CurrentUser user, UUID orderId) {
        PhysicalStoreOrder order = access.ownOrder(user, orderId);
        return PhysicalStoreReturnViews.eligibilityView(PhysicalStoreReturnPolicy.of(order).evaluate(order, hasOpenCase(orderId), clock.instant()));
    }

    public Map<String, Object> open(CurrentUser user, UUID orderId, Request request, String commandKey) {
        guard.requireCanCreate(user);
        String key = PhysicalStoreReturnAccess.key(commandKey);
        var prior = cases.findByOrderIdAndBuyerIdAndCommandKey(orderId, user.id(), key);
        if (prior.isPresent()) return view(user, prior.get());
        PhysicalStoreOrder order = access.ownOrder(user, orderId);
        if (request == null || request.kind() == null || !Set.of("RETURN", "EXCHANGE").contains(request.kind())
                || request.reasonCode() == null || !PhysicalStoreReturnPolicy.REASONS.contains(request.reasonCode())) {
            throw ApiException.badRequest("MOTIVO_INVALIDO", Msg.t("storeReturn.motivo_invalido"));
        }
        PhysicalStoreReturnPolicy policy = PhysicalStoreReturnPolicy.of(order);
        var eligibility = policy.evaluate(order, hasOpenCase(orderId), clock.instant());
        if (!eligibility.eligible()) {
            throw ApiException.conflict("DEVOLUCAO_INELEGIVEL", Msg.t(switch (eligibility.reason()) {
                case "CASE_ALREADY_OPEN" -> "storeReturn.caso_aberto";
                case "WINDOW_EXPIRED" -> "storeReturn.prazo_expirado";
                default -> "storeReturn.pedido_nao_entregue";
            }));
        }
        PhysicalStoreReturnCase c = new PhysicalStoreReturnCase();
        c.setOrderId(orderId); c.setBuyerId(user.id()); c.setSellerId(order.getListing().getSellerUserId());
        c.setKind(request.kind()); c.setReasonCode(request.reasonCode()); c.setReasonNotes(PhysicalStoreReturnAccess.text(request.reasonNotes(), 2000));
        c.setVariantId(order.getVariantId()); c.setStatus("REQUESTED"); c.setPolicyVersion(policy.version()); c.setWindowDays(policy.windowDays());
        c.setDeadlineAt(eligibility.deadlineAt()); c.setFitFeedbackConsent(request.fitFeedbackConsent()); c.setCommandKey(key);
        if ("EXCHANGE".equals(request.kind())) c.setExchangeVariantId(settlement.exchangeVariant(order.getListing(), request.exchangeVariantId()).getId());
        cases.saveAndFlush(c);
        log(c, user, null, "REQUESTED", c.getReasonCode());
        if (request.fitFeedbackConsent() && request.reasonCode().startsWith("FIT_")) {
            // CA5 — só com consentimento explícito; o módulo de demanda ainda confere a finalidade antes de agregar.
            publisher.publishEvent(new PhysicalStoreReturnEvents.FitFeedbackRecorded(c.getSellerId(), order.getListing().getProduct().getId(),
                    order.getVariantId(), order.getVariantSize(), request.reasonCode(), user.id()));
        }
        return view(user, c);
    }

    public Map<String, Object> cancel(CurrentUser user, UUID caseId, long expectedVersion) {
        PhysicalStoreReturnCase c = access.buyerOwned(user, caseId); PhysicalStoreReturnAccess.version(c, expectedVersion);
        transition(c, user, Set.of("REQUESTED", "APPROVED"), "CANCELLED", null);
        return view(user, c);
    }

    public Map<String, Object> decide(CurrentUser user, UUID caseId, Decision decision) {
        PhysicalStoreReturnCase c = access.locked(caseId); access.operator(user, c); PhysicalStoreReturnAccess.version(c, decision.expectedVersion());
        transition(c, user, Set.of("REQUESTED"), decision.approve() ? "APPROVED" : "REJECTED", PhysicalStoreReturnAccess.text(decision.notes(), 2000));
        return view(user, c);
    }

    public Map<String, Object> ship(CurrentUser user, UUID caseId, Shipment shipment) {
        PhysicalStoreReturnCase c = access.buyerOwned(user, caseId); PhysicalStoreReturnAccess.version(c, shipment.expectedVersion());
        transition(c, user, Set.of("APPROVED"), "IN_TRANSIT", PhysicalStoreReturnAccess.text(shipment.trackingCode(), 120));
        return view(user, c);
    }

    public Map<String, Object> receive(CurrentUser user, UUID caseId, long expectedVersion) {
        PhysicalStoreReturnCase c = access.locked(caseId); access.operator(user, c); PhysicalStoreReturnAccess.version(c, expectedVersion);
        transition(c, user, Set.of("APPROVED", "IN_TRANSIT"), "RECEIVED", null);
        return view(user, c);
    }

    /** Inspeção: registra condição e divergência; só então estorna ou troca, uma única vez, e repõe se decidido. */
    public Map<String, Object> inspect(CurrentUser user, UUID caseId, Inspection inspection) {
        PhysicalStoreReturnCase c = access.locked(caseId); access.operator(user, c); PhysicalStoreReturnAccess.version(c, inspection.expectedVersion());
        if (inspection.outcome() == null || !Set.of("AS_DECLARED", "DIVERGENT").contains(inspection.outcome())) throw PhysicalStoreReturnAccess.invalid();
        String divergence = PhysicalStoreReturnAccess.text(inspection.divergenceReason(), 1000);
        if ("DIVERGENT".equals(inspection.outcome()) && divergence == null) throw ApiException.badRequest("DIVERGENCIA_SEM_MOTIVO", Msg.t("storeReturn.divergencia_motivo"));
        transition(c, user, Set.of("RECEIVED"), "INSPECTED", PhysicalStoreReturnAccess.text(inspection.notes(), 2000));
        c.setInspectionOutcome(inspection.outcome()); c.setDivergenceReason(divergence);
        PhysicalStoreOrder order = orders.findById(c.getOrderId()).orElseThrow(() -> ApiException.notFound("Order"));
        if (inspection.restock()) settlement.restock(order, c);
        boolean settle = "AS_DECLARED".equals(inspection.outcome()) || inspection.settle();
        if (!settle) { close(c, user, "CLOSED"); return view(user, c); }
        if ("RETURN".equals(c.getKind())) { settlement.refund(c, order); close(c, user, "REFUNDED"); }
        else { settlement.exchange(c, order); close(c, user, "EXCHANGED"); }
        return view(user, c);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> mine(CurrentUser user) {
        guard.requireCanCreate(user);
        return cases.findByBuyerIdOrderByCreatedAtDesc(user.id()).stream().map(c -> view(user, c)).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> inbox(CurrentUser user) {
        guard.requireCanCreate(user);
        List<PhysicalStoreReturnCase> rows = user.admin() ? cases.findAllByOrderByCreatedAtDesc() : cases.findBySellerIdOrderByCreatedAtDesc(user.id());
        return rows.stream().map(c -> view(user, c)).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(CurrentUser user, UUID caseId) {
        PhysicalStoreReturnCase c = cases.findById(caseId).orElseThrow(() -> ApiException.notFound(Msg.t("storeReturn.caso")));
        access.party(user, c); return view(user, c);
    }

    public Map<String, Object> uploadEvidence(CurrentUser user, UUID caseId, byte[] bytes, String commandKey) {
        PhysicalStoreReturnCase c = access.locked(caseId); access.party(user, c); String key = PhysicalStoreReturnAccess.key(commandKey);
        var prior = evidence.findByCaseIdAndUploaderIdAndCommandKey(caseId, user.id(), key);
        if (prior.isPresent()) return PhysicalStoreReturnViews.evidenceView(prior.get());
        if (!OPEN.contains(c.getStatus())) throw PhysicalStoreReturnAccess.invalid();
        String encoded = Base64.getEncoder().encodeToString(SafeImage.png(bytes, "RETURN"));
        PhysicalStoreReturnEvidence e = new PhysicalStoreReturnEvidence();
        e.setCaseId(caseId); e.setUploaderId(user.id()); e.setContentBase64(encoded); e.setContentHash(PhysicalStoreReturnAccess.hash(encoded)); e.setCommandKey(key);
        return PhysicalStoreReturnViews.evidenceView(evidence.saveAndFlush(e));
    }

    /** CA2 — comprovante só para as partes do caso e a equipe autorizada; nunca por URL pública. */
    @Transactional(readOnly = true)
    public byte[] downloadEvidence(CurrentUser user, UUID evidenceId) {
        PhysicalStoreReturnEvidence e = evidence.findById(evidenceId).orElseThrow(() -> ApiException.notFound(Msg.t("storeReturn.comprovante")));
        access.party(user, cases.findById(e.getCaseId()).orElseThrow(() -> ApiException.notFound(Msg.t("storeReturn.caso"))));
        if (e.getDeletedAt() != null || e.getContentBase64() == null) throw ApiException.notFound(Msg.t("storeReturn.comprovante"));
        return Base64.getDecoder().decode(e.getContentBase64());
    }

    private void transition(PhysicalStoreReturnCase c, CurrentUser user, Set<String> from, String to, String notes) {
        if (!from.contains(c.getStatus())) throw PhysicalStoreReturnAccess.invalid();
        String previous = c.getStatus(); c.setStatus(to);
        if (!OPEN.contains(to)) c.setClosedAt(clock.instant());
        cases.saveAndFlush(c); log(c, user, previous, to, notes);
    }

    private void close(PhysicalStoreReturnCase c, CurrentUser user, String status) {
        transition(c, user, Set.of("INSPECTED"), status, null);
    }

    private void log(PhysicalStoreReturnCase c, CurrentUser user, String from, String to, String notes) {
        PhysicalStoreReturnEvent e = new PhysicalStoreReturnEvent();
        e.setCaseId(c.getId()); e.setActorId(user.id()); e.setFromStatus(from); e.setToStatus(to); e.setNotes(notes);
        events.save(e);
    }

    private Map<String, Object> view(CurrentUser user, PhysicalStoreReturnCase c) {
        return PhysicalStoreReturnViews.caseView(c, events.findByCaseIdOrderByCreatedAtAsc(c.getId()), evidence.findByCaseIdOrderByCreatedAtAsc(c.getId()),
                PhysicalStoreReturnAccess.role(user, c));
    }

    private boolean hasOpenCase(UUID orderId) {
        return !cases.findByOrderIdAndStatusNotIn(orderId, Set.of("REJECTED", "CANCELLED", "REFUNDED", "EXCHANGED", "CLOSED")).isEmpty();
    }

}
