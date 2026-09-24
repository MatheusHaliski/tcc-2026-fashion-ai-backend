package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.CouponRight;
import br.com.fashionai.domain.model.FlairCombination;
import br.com.fashionai.domain.model.FlairRedemption;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.PromotionRedemption;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import br.com.fashionai.domain.model.enums.RedemptionStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.CouponRightRepository;
import br.com.fashionai.domain.repository.FlairCombinationRepository;
import br.com.fashionai.domain.repository.FlairRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Card Trello RF38 — Cupons Fashion AI. Une numa só carteira os cupons que qualquer funcionalidade concede:
 * <ul>
 *   <li><b>SELO</b> — política de promoção dos selos (RF25): o look ganhou o selo da marca/celebridade;</li>
 *   <li><b>FLAIR</b> — combinação FLAIR completada (deck, coleção ou duelo patrocinado).</li>
 * </ul>
 * Fluxo: a loja cadastra o selo/jogo FLAIR → o usuário conquista o direito usando o app → é notificado ("Parabéns!
 * Deseja resgatar o CUPOM?") → se sim, o cupom da marca é emitido e aparece em "Meus cupons resgatados"; o clique abre
 * a loja terceira, fora do app. Do lado da marca/celebridade, a aba "Meus cupons promocionais" mostra os cupons
 * emitidos, os direitos pendentes e "Todas as promoções" (ativas, inativas e criar promoção).
 */
@Service
public class CouponService {
    public static final String SELO = "SELO";
    public static final String FLAIR = "FLAIR";
    static final String PENDENTE = "PENDENTE";
    static final String RESGATADO = "RESGATADO";
    static final String DISPENSADO = "DISPENSADO";
    private static final Logger log = LoggerFactory.getLogger(CouponService.class);

    private final CouponRightRepository rights;
    private final PromotionRepository promotions;
    private final PromotionRedemptionRepository promotionRedemptions;
    private final FlairCombinationRepository combinations;
    private final FlairRedemptionRepository flairRedemptions;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final UserRepository users;
    private final SealService seals;
    private final FlairService flair;
    private final NotificationService notifications;
    private final Guard guard;

    public CouponService(CouponRightRepository rights, PromotionRepository promotions, PromotionRedemptionRepository promotionRedemptions,
                         FlairCombinationRepository combinations, FlairRedemptionRepository flairRedemptions, BrandProfileRepository brands,
                         CelebrityProfileRepository celebrities, UserRepository users, SealService seals, FlairService flair,
                         NotificationService notifications, Guard guard) {
        this.rights = rights;
        this.promotions = promotions;
        this.promotionRedemptions = promotionRedemptions;
        this.combinations = combinations;
        this.flairRedemptions = flairRedemptions;
        this.brands = brands;
        this.celebrities = celebrities;
        this.users = users;
        this.seals = seals;
        this.flair = flair;
        this.notifications = notifications;
        this.guard = guard;
    }

    // ================================================================== conquista do direito + notificação

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onCheck(DomainEvents.CouponRightsCheck ev) {
        safeScan(ev.userId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onScheme(DomainEvents.SchemeSaved ev) {
        safeScan(ev.userId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onPiece(DomainEvents.PieceCreated ev) {
        safeScan(ev.userId());
    }

    private void safeScan(UUID userId) {
        try {
            scan(userId);
        } catch (RuntimeException e) {
            // a conquista nunca derruba a ação que a disparou; o próximo acesso a "Meus cupons" reavalia
            log.warn("Reavaliação de cupons falhou para {}: {}", userId, e.getMessage());
        }
    }

    /** Cria um direito PENDENTE (e a notificação) para cada promoção/combinação que o usuário acabou de conquistar. */
    @Transactional
    public int scan(UUID userId) {
        User u = users.findById(userId).orElse(null);
        if (u == null) {
            return 0;
        }
        int created = 0;
        for (Promotion p : seals.eligiblePromotions(userId)) {
            if (p.getOwnerUserId().equals(userId)) {
                continue;
            }
            created += grant(u, SELO, p.getId(), p.getOwnerUserId(), p.getTitle(), discountText(p.getDiscountPercent(), null, null), null) ? 1 : 0;
        }
        CurrentUser cu = CurrentUser.of(u, "system", "coupon-scan");
        for (Map<String, Object> c : flair.combinationsFor(cu)) {
            if (!Boolean.TRUE.equals(c.get("complete")) || c.get("redemption") != null || !Boolean.TRUE.equals(c.get("available"))) {
                continue;
            }
            UUID id = (UUID) c.get("id");
            FlairCombination comb = combinations.findById(id).orElse(null);
            if (comb == null || comb.getBrand().getId().equals(userId)) {
                continue;
            }
            Object best = c.get("bestDeck");
            UUID scheme = best instanceof Map<?, ?> m && m.get("schemeId") != null ? UUID.fromString(String.valueOf(m.get("schemeId"))) : null;
            created += grant(u, FLAIR, id, comb.getBrand().getId(), comb.getCouponTitle(),
                    discountText(comb.getDiscountPercent(), comb.getDiscountAmount(), comb.getMinPurchase()), scheme) ? 1 : 0;
        }
        return created;
    }

    private boolean grant(User u, String source, UUID sourceId, UUID ownerId, String title, String detail, UUID schemeId) {
        if (rights.findByUserIdAndSourceTypeAndSourceId(u.getId(), source, sourceId).isPresent()) {
            return false;
        }
        User owner = users.findById(ownerId).orElse(null);
        if (owner == null) {
            return false;
        }
        CouponRight r = new CouponRight();
        r.setUser(u);
        r.setOwner(owner);
        r.setSourceType(source);
        r.setSourceId(sourceId);
        r.setTitle(title.length() > 160 ? title.substring(0, 160) : title);
        r.setDetail(detail);
        r.setStatus(PENDENTE);
        r.setSchemeId(schemeId);
        rights.save(r);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("rightId", r.getId().toString());
        payload.put("href", "/coupons?right=" + r.getId());
        payload.put("actions", List.of("RESGATAR", "AGORA_NAO"));
        notifications.notify(u.getId(), ownerId, NotificationType.COUPON_AVAILABLE, "COUPON_RIGHT", r.getId(),
                "Parabéns! Você conquistou um cupom 🎟️",
                "Deseja resgatar o CUPOM \"" + r.getTitle() + "\" de " + ownerName(owner) + "? "
                        + (SELO.equals(source) ? "Seu look ganhou o selo que libera esta promoção." : "Seu deck completou o jogo FLAIR da loja."),
                payload);
        return true;
    }

    // ================================================================== usuário: pendentes, resgate e carteira

    @Transactional
    public Map<String, Object> mine(CurrentUser user) {
        scan(user.id());
        // quem já trocou direto no FLAIR (ou já resgatou a promoção pelo perfil) não fica com o aviso pendente
        for (CouponRight r : rights.findByUserIdAndStatusOrderByCreatedAtDesc(user.id(), PENDENTE)) {
            boolean done = FLAIR.equals(r.getSourceType())
                    ? flairRedemptions.findByCombinationIdAndUserId(r.getSourceId(), user.id()).isPresent()
                    : promotions.findById(r.getSourceId()).map(p -> promotionRedemptions.countByPromotionIdAndUserId(p.getId(), user.id()) >= p.getPerUserLimit()).orElse(true);
            if (done) {
                r.setStatus(RESGATADO);
                r.setDecidedAt(Instant.now());
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pending", rights.findByUserIdAndStatusOrderByCreatedAtDesc(user.id(), PENDENTE).stream().map(this::rightView).toList());
        out.put("coupons", wallet(user.id()));
        out.put("note", "Cupons Fashion AI: use o código na loja da marca ou celebridade, fora do app.");
        return out;
    }

    @Transactional
    public Map<String, Object> redeem(CurrentUser user, UUID rightId) {
        CouponRight r = ownRight(user, rightId);
        if (!PENDENTE.equals(r.getStatus())) {
            throw ApiException.conflict("DIREITO_DECIDIDO", "Este cupom já foi " + (RESGATADO.equals(r.getStatus()) ? "resgatado." : "dispensado."));
        }
        Map<String, Object> issued = SELO.equals(r.getSourceType()) ? seals.redeem(user, r.getSourceId())
                : flair.redeem(user, r.getSourceId(), r.getSchemeId());
        r.setCouponRef(UUID.fromString(String.valueOf(issued.get("id"))));
        r.setStatus(RESGATADO);
        r.setDecidedAt(Instant.now());
        return couponBy(r.getSourceType(), r.getCouponRef());
    }

    @Transactional
    public Map<String, Object> dismiss(CurrentUser user, UUID rightId) {
        CouponRight r = ownRight(user, rightId);
        if (PENDENTE.equals(r.getStatus())) {
            r.setStatus(DISPENSADO);
            r.setDecidedAt(Instant.now());
        }
        return rightView(r);
    }

    private CouponRight ownRight(CurrentUser user, UUID id) {
        CouponRight r = rights.findById(id).orElseThrow(() -> ApiException.notFound("Cupom"));
        guard.requireOwner(user, r.getUser().getId(), "coupon-right:" + id);
        return r;
    }

    List<Map<String, Object>> wallet(UUID userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        promotionRedemptions.findByUserIdOrderByRedeemedAtDesc(userId).forEach(x -> out.add(couponView(x)));
        flairRedemptions.findByUserIdOrderByCreatedAtDesc(userId).forEach(x -> out.add(couponView(x)));
        out.sort(Comparator.comparing((Map<String, Object> m) -> String.valueOf(m.get("issuedAt"))).reversed());
        return out;
    }

    private Map<String, Object> couponBy(String source, UUID id) {
        return SELO.equals(source) ? couponView(promotionRedemptions.findById(id).orElseThrow())
                : couponView(flairRedemptions.findById(id).orElseThrow());
    }

    // ================================================================== marca/celebridade: "Meus cupons promocionais"

    private User issuer(CurrentUser user) {
        User u = users.findById(user.id()).orElseThrow();
        if (u.getProfileType() != ProfileType.MARCA && u.getProfileType() != ProfileType.CELEBRIDADE) {
            throw guard.deny(user, "coupons:admin", "A aba Meus cupons promocionais é de perfis de marca ou celebridade.");
        }
        return u;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> admin(CurrentUser user) {
        User me = issuer(user);
        List<Map<String, Object>> issued = new ArrayList<>();
        promotionRedemptions.findByIssuerUserIdOrPartnerBrandUserIdOrderByRedeemedAtDesc(me.getId(), me.getId()).forEach(x -> issued.add(withHolder(couponView(x), x.getUser())));
        flairRedemptions.findByCombinationBrandIdOrderByCreatedAtDesc(me.getId()).forEach(x -> issued.add(withHolder(couponView(x), x.getUser())));
        issued.sort(Comparator.comparing((Map<String, Object> m) -> String.valueOf(m.get("issuedAt"))).reversed());

        List<Map<String, Object>> all = new ArrayList<>();
        Instant now = Instant.now();
        for (Promotion p : promotions.findByOwnerUserIdOrderByCreatedAtDesc(me.getId())) {
            Map<String, Object> v = new LinkedHashMap<>();
            String reason = SealService.unavailable(p, now);
            v.put("source", SELO);
            v.put("id", p.getId());
            v.put("title", p.getTitle());
            v.put("kind", p.getType());
            v.put("detail", p.getDescription());
            v.put("discount", discountText(p.getDiscountPercent(), null, null));
            v.put("seal", p.getSeal() == null ? null : Map.of("id", p.getSeal().getId(), "name", p.getSeal().getName()));
            v.put("active", reason == null);
            v.put("status", reason == null ? "ATIVA" : p.getStatus() == PromotionStatus.AVAILABLE ? "FORA_DO_PERIODO" : p.getStatus().name());
            v.put("reason", reason);
            v.put("redeemed", p.getRedeemedCount());
            v.put("quota", p.getTotalQuota());
            v.put("pendingRights", rights.countBySourceTypeAndSourceIdAndStatus(SELO, p.getId(), PENDENTE));
            v.put("startsAt", p.getStartsAt());
            v.put("endsAt", p.getExpiresAt());
            v.put("storeUrl", p.getStoreUrl());
            all.add(v);
        }
        for (FlairCombination c : combinations.findByBrandIdOrderByCreatedAtDesc(me.getId())) {
            Map<String, Object> v = new LinkedHashMap<>();
            boolean active = flair.available(c);
            v.put("source", FLAIR);
            v.put("id", c.getId());
            v.put("title", c.getCouponTitle());
            v.put("kind", c.getGameType());
            v.put("detail", c.getName() + (c.getDescription() == null ? "" : " — " + c.getDescription()));
            v.put("discount", discountText(c.getDiscountPercent(), c.getDiscountAmount(), c.getMinPurchase()));
            v.put("seal", null);
            v.put("active", active);
            v.put("status", active ? "ATIVA" : c.isActive() ? "FORA_DO_PERIODO" : "DESATIVADA");
            v.put("reason", active ? null : c.isActive() ? "Fora do período ou sem estoque." : "Desativada pela loja.");
            v.put("redeemed", c.getRedeemed());
            v.put("quota", c.getStock());
            v.put("pendingRights", rights.countBySourceTypeAndSourceIdAndStatus(FLAIR, c.getId(), PENDENTE));
            v.put("startsAt", c.getStartsAt());
            v.put("endsAt", c.getEndsAt());
            v.put("storeUrl", c.getStoreUrl());
            all.add(v);
        }
        long used = issued.stream().filter(m -> "USADO".equals(m.get("status"))).count();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("owner", ownerView(me));
        out.put("stats", Map.of("issued", issued.size(), "used", used, "pendingRights", rights.countByOwnerIdAndStatus(me.getId(), PENDENTE),
                "active", all.stream().filter(m -> Boolean.TRUE.equals(m.get("active"))).count(),
                "useRate", issued.isEmpty() ? 0 : Math.round(used * 1000.0 / issued.size()) / 10.0));
        out.put("coupons", issued);
        out.put("promotions", all);
        out.put("sources", List.of(Map.of("id", SELO, "label", "Política de promoção de selo (RF25)"), Map.of("id", FLAIR, "label", "Jogo FLAIR (combinação da loja)")));
        return out;
    }

    /** No caixa (ou no e-commerce): confere o código de qualquer cupom Fashion AI da marca e marca como usado. */
    @Transactional
    public Map<String, Object> validate(CurrentUser user, String rawCode) {
        User me = issuer(user);
        String code = rawCode == null ? "" : rawCode.trim().toUpperCase(Locale.ROOT);
        if (code.startsWith("FLR-")) {
            flair.validateCode(user, code);
            return couponView(flairRedemptions.findByCode(code).orElseThrow());
        }
        PromotionRedemption r = promotionRedemptions.findByCode(code).orElseThrow(() -> ApiException.notFound("Cupom"));
        if (!me.getId().equals(r.getIssuerUserId()) && !me.getId().equals(r.getPartnerBrandUserId())) {
            throw ApiException.notFound("Cupom");
        }
        if (r.getStatus() == RedemptionStatus.USED) {
            throw ApiException.conflict("CUPOM_USADO", "Cupom já usado.");
        }
        if (r.getExpiresAt() != null && r.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.conflict("CUPOM_EXPIRADO", "Cupom expirado.");
        }
        r.setStatus(RedemptionStatus.USED);
        return withHolder(couponView(r), r.getUser());
    }

    // ================================================================== visões

    private Map<String, Object> rightView(CouponRight r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("source", r.getSourceType());
        m.put("title", r.getTitle());
        m.put("detail", r.getDetail());
        m.put("status", r.getStatus());
        m.put("createdAt", r.getCreatedAt());
        m.put("owner", ownerView(r.getOwner()));
        m.put("question", "Parabéns! Deseja resgatar o CUPOM \"" + r.getTitle() + "\" de " + ownerName(r.getOwner()) + "?");
        return m;
    }

    private Map<String, Object> couponView(PromotionRedemption r) {
        Promotion p = r.getPromotion();
        User owner = users.findById(r.getIssuerUserId()).orElseThrow();
        String partnerStore = r.getPartnerBrandUserId() == null ? null
                : brands.findByOwnerId(r.getPartnerBrandUserId()).map(BrandProfile::getStoreUrl).orElse(null);
        String status = r.getStatus() == RedemptionStatus.USED ? "USADO"
                : r.getExpiresAt() != null && r.getExpiresAt().isBefore(Instant.now()) ? "EXPIRADO" : "EMITIDO";
        return coupon(r.getId(), SELO, r.getCode(), p.getTitle(), p.getDescription(), p.getDiscountPercent(), null, null, status,
                r.getExpiresAt(), r.getRedeemedAt(), owner, firstNonNull(p.getStoreUrl(), partnerStore, storeOf(owner)), null,
                p.getSeal() == null ? null : "Selo " + p.getSeal().getName());
    }

    private Map<String, Object> couponView(FlairRedemption r) {
        FlairCombination c = r.getCombination();
        String status = "USADO".equals(r.getStatus()) ? "USADO" : r.getExpiresAt().isBefore(Instant.now()) ? "EXPIRADO" : "EMITIDO";
        return coupon(r.getId(), FLAIR, r.getCode(), c.getCouponTitle(), c.getName(), c.getDiscountPercent(), c.getDiscountAmount(),
                c.getMinPurchase(), status, r.getExpiresAt(), r.getCreatedAt(), c.getBrand(), firstNonNull(c.getStoreUrl(), storeOf(c.getBrand())),
                c.getAccentColor(), "Jogo FLAIR" + (r.getScheme() == null ? "" : " · deck " + r.getScheme().getTitle()));
    }

    private Map<String, Object> coupon(UUID id, String source, String code, String title, String subtitle, Integer pct, BigDecimal amount,
                                       BigDecimal minPurchase, String status, Instant expiresAt, Instant issuedAt, User owner, String storeUrl,
                                       String accent, String origin) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("source", source);
        m.put("origin", origin);
        m.put("code", code);
        m.put("title", title);
        m.put("subtitle", subtitle);
        m.put("discountPercent", pct);
        m.put("discountAmount", amount);
        m.put("minPurchase", minPurchase);
        m.put("discount", discountText(pct, amount, minPurchase));
        m.put("status", status);
        m.put("expiresAt", expiresAt);
        m.put("issuedAt", issuedAt);
        m.put("owner", ownerView(owner));
        m.put("storeUrl", storeUrl);
        m.put("accentColor", accent != null ? accent : owner.getProfileType() == ProfileType.CELEBRIDADE ? "#7B4FD6" : "#1F2A44");
        return m;
    }

    private Map<String, Object> withHolder(Map<String, Object> coupon, User holder) {
        coupon.put("holder", Views.user(holder));
        return coupon;
    }

    Map<String, Object> ownerView(User owner) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("user", Views.user(owner));
        m.put("name", ownerName(owner));
        m.put("kind", owner.getProfileType());
        if (owner.getProfileType() == ProfileType.CELEBRIDADE) {
            CelebrityProfile c = celebrities.findByOwnerId(owner.getId()).orElse(null);
            m.put("logoUrl", c == null ? owner.getAvatarUrl() : firstNonNull(c.getAvatarUrl(), owner.getAvatarUrl()));
            m.put("slug", c == null ? null : c.getSlug());
        } else {
            BrandProfile b = brands.findByOwnerId(owner.getId()).orElse(null);
            m.put("logoUrl", b == null ? owner.getAvatarUrl() : firstNonNull(b.getLogoUrl(), owner.getAvatarUrl()));
            m.put("slug", b == null ? null : b.getSlug());
        }
        m.put("storeUrl", storeOf(owner));
        return m;
    }

    String ownerName(User owner) {
        if (owner.getProfileType() == ProfileType.CELEBRIDADE) {
            return celebrities.findByOwnerId(owner.getId()).map(CelebrityProfile::getStageName).orElse(owner.getDisplayName());
        }
        return brands.findByOwnerId(owner.getId()).map(BrandProfile::getBrandName).orElse(owner.getDisplayName());
    }

    /** Loja terceira da marca (site cadastrado) ou, para celebridade, o primeiro link do perfil. */
    String storeOf(User owner) {
        String store = brands.findByOwnerId(owner.getId()).map(BrandProfile::getStoreUrl).orElse(null);
        if (store != null && !store.isBlank()) {
            return store;
        }
        return Json.list(owner.getLinksJson()).stream().map(l -> l.get("url")).filter(Objects::nonNull).map(String::valueOf)
                .filter(u -> u.startsWith("http")).findFirst().orElse(null);
    }

    static String discountText(Integer pct, BigDecimal amount, BigDecimal minPurchase) {
        String off = pct != null ? pct + "% off" : amount != null ? "R$ " + amount.setScale(0, java.math.RoundingMode.HALF_UP) + " off" : "Benefício exclusivo";
        return off + (minPurchase == null ? "" : " · compra mínima R$ " + minPurchase.setScale(0, java.math.RoundingMode.HALF_UP));
    }

    @SafeVarargs
    private static <T> T firstNonNull(T... xs) {
        for (T x : xs) {
            if (x != null && !(x instanceof String s && s.isBlank())) {
                return x;
            }
        }
        return null;
    }
}
