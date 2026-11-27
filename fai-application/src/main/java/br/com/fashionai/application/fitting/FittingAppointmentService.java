package br.com.fashionai.application.fitting;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.PhysicalStoreListing;
import br.com.fashionai.domain.model.PhysicalStoreVariant;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.fitting.FittingAppointment;
import br.com.fashionai.domain.model.fitting.FittingAppointmentItem;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.PhysicalStoreListingRepository;
import br.com.fashionai.domain.repository.PhysicalStoreVariantRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.fitting.FittingAppointmentItemRepository;
import br.com.fashionai.domain.repository.fitting.FittingAppointmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import static br.com.fashionai.application.fitting.FittingAppointmentViews.*;

/**
 * RF-PESQ-07 — prova física agendada. Lista por SKU/tamanho; a reserva só existe quando a loja tem a variante com
 * estoque (senão fica como solicitação pendente, nunca "reserva confirmada"); a confirmação depende do aceite da loja;
 * expiração, cancelamento e conclusão liberam as reservas uma única vez; a loja só vê produto e tamanho.
 */
@Service
@Transactional
public class FittingAppointmentService {
    private static final Set<String> RESULTS = Set.of("FIT", "NO_FIT", "NOT_TRIED");
    private final FittingAppointmentRepository appointments;
    private final FittingAppointmentItemRepository items;
    private final PhysicalStoreListingRepository listings;
    private final PhysicalStoreVariantRepository variants;
    private final CatalogProductRepository products;
    private final UserRepository users;
    private final Guard guard;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public FittingAppointmentService(FittingAppointmentRepository appointments, FittingAppointmentItemRepository items, PhysicalStoreListingRepository listings,
                                     PhysicalStoreVariantRepository variants, CatalogProductRepository products, UserRepository users, Guard guard) {
        this(appointments, items, listings, variants, products, users, guard, Clock.systemUTC());
    }

    FittingAppointmentService(FittingAppointmentRepository appointments, FittingAppointmentItemRepository items, PhysicalStoreListingRepository listings,
                              PhysicalStoreVariantRepository variants, CatalogProductRepository products, UserRepository users, Guard guard, Clock clock) {
        this.appointments = appointments; this.items = items; this.listings = listings; this.variants = variants; this.products = products;
        this.users = users; this.guard = guard; this.clock = clock;
    }

    public Map<String, Object> request(CurrentUser user, RequestCmd cmd) {
        guard.requireCanCreate(user);
        if (cmd == null || cmd.requestId() == null || !cmd.requestId().matches("[a-zA-Z0-9_-]{8,80}")) throw ApiException.badRequest("IDEMPOTENCY_KEY_REQUIRED", "Envie uma chave de pedido válida.");
        var prior = appointments.findByUserIdAndRequestId(user.id(), cmd.requestId());
        if (prior.isPresent()) return view(user, prior.get());
        Instant now = clock.instant();
        if (cmd.requestedSlot() == null || !cmd.requestedSlot().isAfter(now) || cmd.requestedSlot().isAfter(now.plus(Duration.ofDays(60)))
                || cmd.items() == null || cmd.items().isEmpty() || cmd.items().size() > 12) {
            throw ApiException.badRequest("FITTING_INVALID", "Informe um horário futuro (até 60 dias) e de 1 a 12 peças.");
        }
        String username = cmd.sellerUsername() == null ? "" : cmd.sellerUsername().replaceFirst("^@", "").trim();
        User seller = users.findByUsernameIgnoreCase(username).filter(FittingAppointmentService::storeActive).orElseThrow(() -> ApiException.notFound("Loja"));
        if (seller.getId().equals(user.id()) || guard.blocked(user.id(), seller.getId())) throw ApiException.badRequest("FITTING_SELLER", "Escolha outra loja.");
        FittingAppointment a = new FittingAppointment();
        a.setUserId(user.id()); a.setSellerId(seller.getId()); a.setStatus("REQUESTED"); a.setRequestedSlot(cmd.requestedSlot());
        a.setExpiresAt(cmd.requestedSlot().isBefore(now.plus(Duration.ofHours(48))) ? cmd.requestedSlot() : now.plus(Duration.ofHours(48)));
        a.setNotes(cmd.notes() == null || cmd.notes().isBlank() ? null : InputSanitizer.clean(cmd.notes(), 1000)); a.setRequestId(cmd.requestId());
        appointments.saveAndFlush(a);
        for (ItemCmd item : cmd.items()) {
            if (item == null || item.productId() == null || item.sizeLabel() == null || item.sizeLabel().isBlank()) throw ApiException.badRequest("FITTING_INVALID", "Cada peça precisa de produto e tamanho.");
            products.findById(item.productId()).orElseThrow(() -> ApiException.notFound("Produto"));
            FittingAppointmentItem row = new FittingAppointmentItem();
            row.setAppointmentId(a.getId()); row.setCatalogProductId(item.productId()); row.setSizeLabel(InputSanitizer.clean(item.sizeLabel(), 40));
            reserve(seller.getId(), item, row);
            items.save(row);
        }
        return view(user, a);
    }

    /** CA3 — reserva só com variante ativa e estoque; sem oferta é NO_INTEGRATION; sem estoque é UNAVAILABLE. */
    private void reserve(UUID sellerId, ItemCmd item, FittingAppointmentItem row) {
        List<PhysicalStoreListing> offers = listings.findActiveBySellerAndProduct(sellerId, item.productId());
        if (offers.isEmpty()) { row.setState("NO_INTEGRATION"); return; }
        PhysicalStoreVariant match = null;
        for (PhysicalStoreListing offer : offers) {
            for (PhysicalStoreVariant v : variants.findByListingIdOrderByVariantKeyAsc(offer.getId())) {
                boolean sameSize = v.getSizeLabel().equalsIgnoreCase(row.getSizeLabel());
                boolean sameVariant = item.variantId() == null || item.variantId().equals(v.getId()) || item.variantId().equals(v.getCatalogVariantId());
                if (v.isActive() && sameSize && sameVariant) { match = v; break; }
            }
            if (match != null) break;
        }
        if (match == null) { row.setState("NO_INTEGRATION"); return; }
        PhysicalStoreVariant locked = variants.lockById(match.getId()).orElseThrow();
        if (locked.available() < 1) { row.setState("UNAVAILABLE"); row.setStoreVariantId(locked.getId()); return; }
        locked.setReservedQuantity(locked.getReservedQuantity() + 1); variants.save(locked);
        row.setStoreVariantId(locked.getId()); row.setState("RESERVED");
    }

    /** CA1 — confirmação depende do aceite real da loja e informa o horário confirmado. */
    public Map<String, Object> confirm(CurrentUser user, UUID id, ConfirmCmd cmd) {
        FittingAppointment a = seller(user, id); version(a, cmd.expectedVersion());
        if (!"REQUESTED".equals(a.getStatus()) || !a.getExpiresAt().isAfter(clock.instant())) throw invalid();
        if (cmd.confirmedSlot() == null || !cmd.confirmedSlot().isAfter(clock.instant())) throw ApiException.badRequest("FITTING_INVALID", "Informe o horário confirmado.");
        a.setStatus("CONFIRMED"); a.setConfirmedSlot(cmd.confirmedSlot()); a.setExpiresAt(cmd.confirmedSlot().plus(Duration.ofHours(2)));
        return view(user, appointments.saveAndFlush(a));
    }

    public Map<String, Object> decline(CurrentUser user, UUID id, VersionCmd cmd) {
        FittingAppointment a = seller(user, id); version(a, cmd.expectedVersion());
        if (!Set.of("REQUESTED", "CONFIRMED").contains(a.getStatus())) throw invalid();
        a.setStatus("DECLINED"); release(a);
        return view(user, appointments.saveAndFlush(a));
    }

    /** CA2 — cancelar libera as reservas sem duplicar; repetir devolve o mesmo estado. */
    public Map<String, Object> cancel(CurrentUser user, UUID id, VersionCmd cmd) {
        FittingAppointment a = owner(user, id);
        if ("CANCELLED".equals(a.getStatus())) return view(user, a);
        version(a, cmd.expectedVersion());
        if (!Set.of("REQUESTED", "CONFIRMED").contains(a.getStatus())) throw invalid();
        a.setStatus("CANCELLED"); release(a);
        return view(user, appointments.saveAndFlush(a));
    }

    /** CA4 — concilia o resultado da prova e libera a reserva; nada é publicado socialmente. */
    public Map<String, Object> complete(CurrentUser user, UUID id, CompleteCmd cmd) {
        FittingAppointment a = owner(user, id);
        if ("COMPLETED".equals(a.getStatus())) return view(user, a);
        version(a, cmd.expectedVersion());
        if (!"CONFIRMED".equals(a.getStatus())) throw invalid();
        Map<UUID, String> results = new HashMap<>();
        for (ResultCmd r : cmd.results() == null ? List.<ResultCmd>of() : cmd.results()) {
            if (r.itemId() == null || r.result() == null || !RESULTS.contains(r.result().toUpperCase(Locale.ROOT))) throw ApiException.badRequest("FITTING_RESULT", "Resultado inválido.");
            results.put(r.itemId(), r.result().toUpperCase(Locale.ROOT));
        }
        for (FittingAppointmentItem item : items.findByAppointmentIdOrderByCreatedAtAsc(id)) { item.setResult(results.getOrDefault(item.getId(), "NOT_TRIED")); items.save(item); }
        a.setStatus("COMPLETED"); release(a);
        return view(user, appointments.saveAndFlush(a));
    }

    /** Expiração idempotente: a liberação acontece uma vez, por job ou por leitura tardia. */
    @org.springframework.scheduling.annotation.Scheduled(fixedDelayString = "PT15M")
    public void expire() {
        for (FittingAppointment a : appointments.findByStatusAndExpiresAtBefore("REQUESTED", clock.instant())) {
            appointments.lockById(a.getId()).ifPresent(locked -> {
                if (!"REQUESTED".equals(locked.getStatus())) return;
                locked.setStatus("EXPIRED"); release(locked); appointments.saveAndFlush(locked);
            });
        }
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> mine(CurrentUser user) {
        guard.requireCanCreate(user);
        return appointments.findByUserIdOrderByRequestedSlotDesc(user.id()).stream().map(a -> view(user, a)).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> storeInbox(CurrentUser user) {
        guard.requireApprovedInstitutional(user, "fitting-appointments", "Only approved stores receive fitting requests.");
        return appointments.findBySellerIdOrderByRequestedSlotDesc(user.id()).stream().map(a -> view(user, a)).toList();
    }

    private void release(FittingAppointment a) {
        if (a.isReleased()) return;
        for (FittingAppointmentItem item : items.findByAppointmentIdOrderByCreatedAtAsc(a.getId())) {
            if (!"RESERVED".equals(item.getState()) || item.getStoreVariantId() == null) continue;
            variants.lockById(item.getStoreVariantId()).ifPresent(v -> { v.setReservedQuantity(Math.max(0, v.getReservedQuantity() - 1)); variants.save(v); });
            item.setState("RELEASED"); items.save(item);
        }
        a.setReleased(true);
    }

    private Map<String, Object> view(CurrentUser user, FittingAppointment a) {
        List<FittingAppointmentItem> rows = items.findByAppointmentIdOrderByCreatedAtAsc(a.getId());
        Map<UUID, String> names = new HashMap<>();
        rows.forEach(i -> names.computeIfAbsent(i.getCatalogProductId(), id -> products.findById(id).map(CatalogProduct::getProductName).orElse(null)));
        String role = a.getUserId().equals(user.id()) ? "CUSTOMER" : "STORE";
        return appointment(a, users.findById(a.getSellerId()).map(User::getUsername).orElse(null), role, rows, names, clock.instant());
    }

    private FittingAppointment owner(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        FittingAppointment a = appointments.lockById(id).orElseThrow(() -> ApiException.notFound("Agendamento"));
        if (!a.getUserId().equals(user.id())) throw ApiException.forbidden("Agendamento de outra pessoa.");
        return a;
    }

    private FittingAppointment seller(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        FittingAppointment a = appointments.lockById(id).orElseThrow(() -> ApiException.notFound("Agendamento"));
        if (!a.getSellerId().equals(user.id())) throw ApiException.forbidden("Somente a loja escolhida responde a este agendamento.");
        return a;
    }

    /** Loja = perfil institucional (marca/celebridade) ativo; o mesmo critério da loja física. */
    static boolean storeActive(User owner) {
        return owner != null && owner.getStatus() == AccountStatus.ACTIVE
                && (owner.getProfileType() == ProfileType.MARCA || owner.getProfileType() == ProfileType.CELEBRIDADE);
    }

    private static void version(FittingAppointment a, long expected) {
        if (a.getVersion() != expected) throw ApiException.conflict("FITTING_VERSION_CONFLICT", "O agendamento mudou. Atualize a página.");
    }

    private static ApiException invalid() {
        return ApiException.conflict("FITTING_TRANSITION", "Esta ação não vale para o estado atual do agendamento.");
    }
}
