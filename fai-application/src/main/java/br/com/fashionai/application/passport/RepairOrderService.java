package br.com.fashionai.application.passport;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.SafeImage;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.passport.GarmentPassport;
import br.com.fashionai.domain.model.passport.PassportEvent;
import br.com.fashionai.domain.model.passport.PassportRepairOrder;
import br.com.fashionai.domain.model.passport.PassportRepairOrderEvent;
import br.com.fashionai.domain.model.passport.PassportRepairReceipt;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.passport.GarmentPassportRepository;
import br.com.fashionai.domain.repository.passport.PassportEventRepository;
import br.com.fashionai.domain.repository.passport.PassportRepairOrderEventRepository;
import br.com.fashionai.domain.repository.passport.PassportRepairOrderRepository;
import br.com.fashionai.domain.repository.passport.PassportRepairReceiptRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import static br.com.fashionai.application.passport.RepairOrderViews.*;

/**
 * RF-PESQ-05 — ordem de reparo com evidência emitida pela oficina. SOLICITADA → ORÇADA → AUTORIZADA → EM_SERVIÇO →
 * ENTREGUE/CANCELADA; só o dono autoriza o orçamento; a declaração do prestador é atestação de serviço, não
 * certificação de autenticidade; correções preservam o histórico; revogação impede nova consulta do prestador.
 */
@Service
@Transactional
public class RepairOrderService {
    private static final Set<String> SCOPES = Set.of("PRIVATE", "HISTORY_ONLY");
    private final PassportRepairOrderRepository orders;
    private final PassportRepairOrderEventRepository events;
    private final PassportRepairReceiptRepository receipts;
    private final GarmentPassportRepository passports;
    private final PassportEventRepository passportEvents;
    private final UserRepository users;
    private final Guard guard;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public RepairOrderService(PassportRepairOrderRepository orders, PassportRepairOrderEventRepository events, PassportRepairReceiptRepository receipts,
                              GarmentPassportRepository passports, PassportEventRepository passportEvents, UserRepository users, Guard guard) {
        this(orders, events, receipts, passports, passportEvents, users, guard, Clock.systemUTC());
    }

    RepairOrderService(PassportRepairOrderRepository orders, PassportRepairOrderEventRepository events, PassportRepairReceiptRepository receipts,
                       GarmentPassportRepository passports, PassportEventRepository passportEvents, UserRepository users, Guard guard, Clock clock) {
        this.orders = orders; this.events = events; this.receipts = receipts; this.passports = passports;
        this.passportEvents = passportEvents; this.users = users; this.guard = guard; this.clock = clock;
    }

    public Map<String, Object> request(CurrentUser user, UUID passportId, RequestCmd cmd) {
        GarmentPassport p = ownPassport(user, passportId);
        String key = key(cmd == null ? null : cmd.commandKey());
        var prior = orders.findByPassportIdAndOwnerIdAndCommandKey(passportId, user.id(), key);
        if (prior.isPresent()) return view(user, prior.get());
        String username = cmd.providerUsername() == null ? "" : cmd.providerUsername().replaceFirst("^@", "").trim();
        User provider = users.findByUsernameIgnoreCase(username).orElseThrow(() -> ApiException.notFound("Prestador"));
        if (provider.getStatus() != AccountStatus.ACTIVE || provider.getId().equals(user.id()) || guard.blocked(user.id(), provider.getId())) {
            throw ApiException.badRequest("REPAIR_PROVIDER_UNAVAILABLE", "Escolha outra conta ativa como prestador.");
        }
        PassportRepairOrder o = new PassportRepairOrder();
        o.setPassportId(p.getId()); o.setOwnerId(user.id()); o.setProviderId(provider.getId()); o.setStatus("REQUESTED");
        o.setRequestNotes(text(cmd.notes(), 2000)); o.setCommandKey(key);
        orders.saveAndFlush(o); log(o, user, "OWNER", null, "REQUESTED", o.getRequestNotes(), null);
        return view(user, o);
    }

    public Map<String, Object> quote(CurrentUser user, UUID orderId, QuoteCmd cmd) {
        PassportRepairOrder o = provider(user, orderId); version(o, cmd.expectedVersion());
        if (cmd.diagnosis() == null || cmd.diagnosis().isBlank() || cmd.amount() == null || cmd.amount().signum() < 0 || cmd.currency() == null
                || !cmd.currency().matches("[A-Z]{3}") || cmd.validUntil() == null || !cmd.validUntil().isAfter(LocalDate.now(clock))) {
            throw ApiException.badRequest("REPAIR_QUOTE_INVALID", "Informe diagnóstico, valor, moeda e validade futura.");
        }
        o.setDiagnosis(text(cmd.diagnosis(), 2000)); o.setQuoteAmount(cmd.amount()); o.setQuoteCurrency(cmd.currency()); o.setQuoteValidUntil(cmd.validUntil());
        transition(o, user, "PROVIDER", Set.of("REQUESTED", "QUOTED"), "QUOTED", o.getDiagnosis());
        return view(user, o);
    }

    /** CA1 — o orçamento só pode ser aceito pelo proprietário do passaporte. */
    public Map<String, Object> authorize(CurrentUser user, UUID orderId, VersionCmd cmd) {
        PassportRepairOrder o = owner(user, orderId); version(o, cmd.expectedVersion());
        if (o.getQuoteValidUntil() != null && o.getQuoteValidUntil().isBefore(LocalDate.now(clock))) throw ApiException.conflict("REPAIR_QUOTE_EXPIRED", "O orçamento venceu; peça um novo.");
        o.setAuthorizedAt(clock.instant()); o.setAuthorizedBy(user.id());
        transition(o, user, "OWNER", Set.of("QUOTED"), "AUTHORIZED", null);
        return view(user, o);
    }

    public Map<String, Object> start(CurrentUser user, UUID orderId, VersionCmd cmd) {
        PassportRepairOrder o = provider(user, orderId); version(o, cmd.expectedVersion());
        transition(o, user, "PROVIDER", Set.of("AUTHORIZED"), "IN_SERVICE", null);
        return view(user, o);
    }

    /** CA2/CA4 — comprovante com prestador, data, serviço e escopo; vira evento REPAIR declarado pelo prestador. */
    public Map<String, Object> deliver(CurrentUser user, UUID orderId, DeliverCmd cmd) {
        PassportRepairOrder o = provider(user, orderId); version(o, cmd.expectedVersion());
        if (cmd.serviceSummary() == null || cmd.serviceSummary().isBlank() || cmd.providerStatement() == null || cmd.providerStatement().isBlank()
                || cmd.shareScope() == null || !SCOPES.contains(cmd.shareScope())) {
            throw ApiException.badRequest("REPAIR_DELIVERY_INVALID", "Informe o serviço realizado, a declaração do prestador e o escopo de compartilhamento.");
        }
        o.setServiceSummary(text(cmd.serviceSummary(), 2000)); o.setProviderStatement(text(cmd.providerStatement(), 2000)); o.setShareScope(cmd.shareScope()); o.setDeliveredAt(clock.instant());
        transition(o, user, "PROVIDER", Set.of("IN_SERVICE"), "DELIVERED", o.getServiceSummary());
        if (o.getPassportEventId() == null) {
            PassportEvent e = new PassportEvent();
            e.setPassportId(o.getPassportId()); e.setAuthorId(o.getOwnerId()); e.setKind("REPAIR"); e.setOccurredOn(LocalDate.now(clock));
            Map<String, Object> notes = new LinkedHashMap<>();
            notes.put("repairOrderId", o.getId()); notes.put("service", o.getServiceSummary()); notes.put("attestation", "PROVIDER_DECLARED"); notes.put("shareScope", o.getShareScope());
            e.setNotes(Json.write(notes)); e.setCommandKey("repair_" + o.getId());
            passportEvents.saveAndFlush(e); o.setPassportEventId(e.getId()); orders.save(o);
        }
        return view(user, o);
    }

    public Map<String, Object> cancel(CurrentUser user, UUID orderId, VersionCmd cmd, String reason) {
        PassportRepairOrder o = party(user, orderId); version(o, cmd.expectedVersion());
        String role = o.getOwnerId().equals(user.id()) ? "OWNER" : "PROVIDER";
        Set<String> from = "OWNER".equals(role) ? Set.of("REQUESTED", "QUOTED", "AUTHORIZED") : Set.of("REQUESTED", "QUOTED");
        transition(o, user, role, from, "CANCELLED", text(reason, 2000));
        return view(user, o);
    }

    /** CA3 — a correção cria um evento novo apontando para o anterior; nada é apagado. */
    public Map<String, Object> correct(CurrentUser user, UUID orderId, CorrectionCmd cmd) {
        PassportRepairOrder o = party(user, orderId);
        if (cmd == null || cmd.correctsEventId() == null || cmd.notes() == null || cmd.notes().isBlank()) throw ApiException.badRequest("REPAIR_CORRECTION_INVALID", "Escolha o evento a corrigir e descreva a correção.");
        PassportRepairOrderEvent target = events.findById(cmd.correctsEventId()).filter(e -> e.getOrderId().equals(orderId)).orElseThrow(() -> ApiException.notFound("Evento"));
        if (!target.getActorId().equals(user.id())) throw ApiException.forbidden("Só quem registrou o evento pode corrigi-lo.");
        log(o, user, o.getOwnerId().equals(user.id()) ? "OWNER" : "PROVIDER", o.getStatus(), o.getStatus(), text(cmd.notes(), 2000), target.getId());
        return view(user, o);
    }

    /** CA3 — revogação: o prestador deixa de consultar a ordem e os recibos. */
    public Map<String, Object> revokeAccess(CurrentUser user, UUID orderId) {
        PassportRepairOrder o = owner(user, orderId);
        if (o.getAccessRevokedAt() == null) { o.setAccessRevokedAt(clock.instant()); orders.saveAndFlush(o); log(o, user, "OWNER", o.getStatus(), o.getStatus(), "ACCESS_REVOKED", null); }
        return view(user, o);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> forPassport(CurrentUser user, UUID passportId) {
        ownPassport(user, passportId);
        return orders.findByPassportIdOrderByCreatedAtDesc(passportId).stream().map(o -> view(user, o)).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> providerInbox(CurrentUser user) {
        guard.requireCanCreate(user);
        return orders.findByProviderIdOrderByCreatedAtDesc(user.id()).stream().filter(o -> o.getAccessRevokedAt() == null).map(o -> view(user, o)).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(CurrentUser user, UUID orderId) {
        return view(user, party(user, orderId));
    }

    public Map<String, Object> uploadReceipt(CurrentUser user, UUID orderId, byte[] bytes, String commandKey) {
        PassportRepairOrder o = provider(user, orderId); String key = key(commandKey);
        var prior = receipts.findByOrderIdAndProviderIdAndCommandKey(orderId, user.id(), key);
        if (prior.isPresent()) return receipt(prior.get());
        String encoded = Base64.getEncoder().encodeToString(SafeImage.png(bytes, "REPAIR"));
        PassportRepairReceipt r = new PassportRepairReceipt();
        r.setOrderId(o.getId()); r.setProviderId(user.id()); r.setContentBase64(encoded); r.setContentHash(GarmentPassportService.hash(encoded)); r.setCommandKey(key);
        return receipt(receipts.saveAndFlush(r));
    }

    @Transactional(readOnly = true)
    public byte[] downloadReceipt(CurrentUser user, UUID receiptId) {
        PassportRepairReceipt r = receipts.findById(receiptId).orElseThrow(() -> ApiException.notFound("Recibo"));
        party(user, r.getOrderId());
        if (r.getDeletedAt() != null || r.getContentBase64() == null) throw ApiException.notFound("Recibo");
        return Base64.getDecoder().decode(r.getContentBase64());
    }

    private void transition(PassportRepairOrder o, CurrentUser user, String role, Set<String> from, String to, String notes) {
        if (!from.contains(o.getStatus())) throw ApiException.conflict("REPAIR_TRANSITION", "Esta ação não vale para o estado atual da ordem.");
        String previous = o.getStatus(); o.setStatus(to); orders.saveAndFlush(o); log(o, user, role, previous, to, notes, null);
    }

    private void log(PassportRepairOrder o, CurrentUser user, String role, String from, String to, String notes, UUID corrects) {
        PassportRepairOrderEvent e = new PassportRepairOrderEvent();
        e.setOrderId(o.getId()); e.setActorId(user.id()); e.setActorRole(role); e.setFromStatus(from); e.setToStatus(to); e.setNotes(notes); e.setCorrectsEventId(corrects);
        events.save(e);
    }

    private Map<String, Object> view(CurrentUser user, PassportRepairOrder o) {
        String role = o.getOwnerId().equals(user.id()) ? "OWNER" : "PROVIDER";
        return order(o, role, users.findById(o.getProviderId()).map(User::getUsername).orElse(null),
                events.findByOrderIdOrderByCreatedAtAsc(o.getId()), receipts.findByOrderIdOrderByCreatedAtAsc(o.getId()));
    }

    private GarmentPassport ownPassport(CurrentUser user, UUID passportId) {
        guard.requireCanCreate(user);
        GarmentPassport p = passports.findById(passportId).orElseThrow(() -> ApiException.notFound("Passaporte"));
        if (!p.getOwnerId().equals(user.id())) throw ApiException.forbidden("Somente o proprietário atual pode abrir ordens de reparo.");
        return p;
    }

    private PassportRepairOrder owner(CurrentUser user, UUID orderId) {
        guard.requireCanCreate(user);
        PassportRepairOrder o = orders.lockById(orderId).orElseThrow(() -> ApiException.notFound("Ordem de reparo"));
        if (!o.getOwnerId().equals(user.id())) throw ApiException.forbidden("Somente o proprietário pode fazer isto.");
        return o;
    }

    private PassportRepairOrder provider(CurrentUser user, UUID orderId) {
        guard.requireCanCreate(user);
        PassportRepairOrder o = orders.lockById(orderId).orElseThrow(() -> ApiException.notFound("Ordem de reparo"));
        if (!o.getProviderId().equals(user.id()) || o.getAccessRevokedAt() != null) throw ApiException.forbidden("Somente o prestador com acesso ativo pode fazer isto.");
        return o;
    }

    private PassportRepairOrder party(CurrentUser user, UUID orderId) {
        guard.requireCanCreate(user);
        PassportRepairOrder o = orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Ordem de reparo"));
        boolean provider = o.getProviderId().equals(user.id()) && o.getAccessRevokedAt() == null;
        if (!o.getOwnerId().equals(user.id()) && !provider) throw ApiException.forbidden("Ordem de reparo de outra pessoa.");
        return o;
    }

    private static void version(PassportRepairOrder o, long expected) {
        if (o.getVersion() != expected) throw ApiException.conflict("REPAIR_VERSION_CONFLICT", "A ordem mudou. Atualize a página.");
    }

    private static String key(String key) {
        if (key == null || !key.matches("[a-zA-Z0-9_-]{8,80}")) throw ApiException.badRequest("IDEMPOTENCY_KEY_REQUIRED", "Envie uma chave de idempotência válida.");
        return key;
    }

    private static String text(String value, int max) {
        return value == null || value.isBlank() ? null : InputSanitizer.clean(value, max);
    }
}
