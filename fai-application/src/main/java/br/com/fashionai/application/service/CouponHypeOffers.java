package br.com.fashionai.application.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.fashionai.application.aura.AuraUnlockProvider;
import br.com.fashionai.application.aura.AuraUnlocks;
import br.com.fashionai.application.aura.AuraUnlocks.Family;
import br.com.fashionai.application.aura.AuraUnlocks.Item;
import br.com.fashionai.application.aura.AuraUnlocks.Kind;
import br.com.fashionai.application.aura.AuraUnlocks.State;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.seal.PromotionRules;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FlairCombination;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.repository.FlairCombinationRepository;
import br.com.fashionai.domain.repository.PromotionRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRepository;
import br.com.fashionai.domain.repository.SealBondRepository;

/**
 * Circuito Aura (fase 1) — as ofertas de cupom com Hype mínimo vistas de dois lugares: no card ("O que este card
 * destrava": os cupons que a faixa dele libera ou vai liberar) e na carteira (o cupom que a pessoa só não resgata
 * porque o card ainda não chegou à faixa — "travado"). Só leitura: não emite cupom, não cria direito e não toca no Hype.
 */
@Service
public class CouponHypeOffers implements AuraUnlockProvider {
    static final String WALLET_HREF = "/coupons";
    static final String FLAIR_HREF = "/flair/lojas";
    /** Jogos FLAIR listados no card: o painel aponta os mais recentes, não o catálogo inteiro. */
    static final int MAX_FLAIR = 4;

    private final PromotionRepository promotions;
    private final PromotionRedemptionRepository redemptions;
    private final SealBondRepository bonds;
    private final FlairCombinationRepository combinations;
    private final FlairService flair;
    private final CouponService coupons;
    private final CouponHypeGate gate;

    public CouponHypeOffers(PromotionRepository promotions, PromotionRedemptionRepository redemptions, SealBondRepository bonds,
                            FlairCombinationRepository combinations, FlairService flair, CouponService coupons,
                            ObjectProvider<HypeQueryService> hype) {
        this.promotions = promotions;
        this.redemptions = redemptions;
        this.bonds = bonds;
        this.combinations = combinations;
        this.flair = flair;
        this.coupons = coupons;
        this.gate = CouponHypeGate.of(hype::getIfAvailable);
    }

    // ================================================================== no card

    @Override
    @Transactional(readOnly = true)
    public List<Item> items(CurrentUser viewer, HypeEntityType type, UUID id, State state) {
        List<Item> out = new ArrayList<>();
        Instant now = Instant.now();
        List<SealBond> cardBonds = (type == HypeEntityType.PIECE ? bonds.findByPieceId(id) : bonds.findBySchemeId(id)).stream()
                .filter(b -> b.getStatus() == SealBondStatus.APPROVED).toList();
        Set<UUID> issuers = new LinkedHashSet<>();
        cardBonds.forEach(b -> issuers.add(b.getTargetOwner().getId()));
        for (UUID issuer : issuers) {
            List<SealBond> issuerBonds = cardBonds.stream().filter(b -> b.getTargetOwner().getId().equals(issuer)).toList();
            for (Promotion p : promotions.findByOwnerUserIdAndStatusOrderByCreatedAtDesc(issuer, PromotionStatus.AVAILABLE)) {
                HypeLevel min = CouponHypeRules.parse(p.getMinHypeLevel());
                if (min != null && PromotionRules.unavailable(p, now) == null && PromotionRules.eligibleBond(p, issuerBonds, now) != null) {
                    String issuerName = coupons.ownerName(issuerBonds.get(0).getTargetOwner());
                    out.add(AuraUnlocks.byLevel(Kind.COUPON, Family.HYPE, p.getTitle(), Msg.t("aura.unlocks.cupom_selo", issuerName), WALLET_HREF, min, state));
                }
            }
        }
        if (type == HypeEntityType.PIECE) {
            combinations.findByActiveTrueOrderByCreatedAtDesc().stream()
                    .filter(c -> CouponHypeRules.parse(c.getMinHypeLevel()) != null && flair.available(c)).limit(MAX_FLAIR)
                    .forEach(c -> out.add(flairItem(c, state)));
        }
        return out;
    }

    private Item flairItem(FlairCombination c, State state) {
        String detail = Msg.t("aura.unlocks.cupom_flair", coupons.ownerName(c.getBrand()), c.getName());
        return AuraUnlocks.byLevel(Kind.COUPON, Family.HYPE, c.getCouponTitle(), detail, FLAIR_HREF, CouponHypeRules.parse(c.getMinHypeLevel()), state);
    }

    // ================================================================== na carteira

    /** Cupons que a pessoa tem tudo para resgatar, menos a faixa de Hype do card. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> locked(CurrentUser user) {
        List<Map<String, Object>> out = new ArrayList<>();
        Instant now = Instant.now();
        List<SealBond> mine = bonds.findByRequestedByIdAndStatusOrderByCreatedAtDesc(user.id(), SealBondStatus.APPROVED);
        Set<UUID> issuers = new LinkedHashSet<>();
        mine.forEach(b -> issuers.add(b.getTargetOwner().getId()));
        for (UUID issuer : issuers) {
            List<SealBond> issuerBonds = mine.stream().filter(b -> b.getTargetOwner().getId().equals(issuer)).toList();
            if (!FlairService.sellerActive(issuerBonds.get(0).getTargetOwner())) {
                continue;
            }
            for (Promotion p : promotions.findByOwnerUserIdAndStatusOrderByCreatedAtDesc(issuer, PromotionStatus.AVAILABLE)) {
                SealBond bond = PromotionRules.eligibleBond(p, issuerBonds, now);
                if (p.getMinHypeLevel() == null || bond == null || PromotionRules.unavailable(p, now) != null
                        || redemptions.countByPromotionIdAndUserId(p.getId(), user.id()) >= p.getPerUserLimit()) {
                    continue;
                }
                HypeLevel best = bestOf(p, issuerBonds, now);
                if (!CouponHypeRules.meets(p.getMinHypeLevel(), best)) {
                    out.add(lockedView(CouponService.SELO, p.getId(), p.getTitle(), coupons.ownerName(bond.getTargetOwner()), p.getMinHypeLevel(), best));
                }
            }
        }
        for (Map<String, Object> c : flair.combinationsFor(user)) {
            Map<String, Object> hype = onlyHypeMissing(c);
            if (hype != null) {
                Object title = c.get("coupon") instanceof Map<?, ?> coupon ? coupon.get("title") : c.get("name");
                out.add(lockedView(CouponService.FLAIR, (UUID) c.get("id"), String.valueOf(title), String.valueOf(c.get("brandName")),
                        String.valueOf(hype.get("required")), CouponHypeRules.parse(String.valueOf(hype.get("value")))));
            }
        }
        return out;
    }

    /** Corpo de GET /api/me/coupons/hype-locked: {@code {items: [...]}}. */
    @Transactional(readOnly = true)
    public Map<String, Object> lockedView(CurrentUser user) {
        return Map.of("items", locked(user));
    }

    /** A melhor faixa que conta entre os cards com selo elegível para a promoção. */
    private HypeLevel bestOf(Promotion p, List<SealBond> issuerBonds, Instant now) {
        HypeLevel best = null;
        for (SealBond b : issuerBonds) {
            HypeLevel level = PromotionRules.eligibleBond(p, List.of(b), now) == null ? null : gate.ofBond(b);
            if (level != null && (best == null || level.ordinal() > best.ordinal())) {
                best = level;
            }
        }
        return best;
    }

    /** O requisito de Hype da combinação quando ele é o único que falta (disponível, sem cupom emitido); senão nulo. */
    @SuppressWarnings("unchecked")
    static Map<String, Object> onlyHypeMissing(Map<String, Object> combination) {
        if (!Boolean.TRUE.equals(combination.get("available")) || combination.get("redemption") != null
                || !(combination.get("checks") instanceof List<?> checks)) {
            return null;
        }
        Map<String, Object> hype = null;
        for (Map<String, Object> check : (List<Map<String, Object>>) checks) {
            boolean ok = Boolean.TRUE.equals(check.get("ok"));
            if ("HYPE".equals(check.get("kind"))) {
                hype = ok ? null : check;
            } else if (!ok) {
                return null;
            }
        }
        return hype;
    }

    private static Map<String, Object> lockedView(String source, UUID id, String title, String ownerName, String minimum, HypeLevel current) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("source", source);
        m.put("id", id);
        m.put("title", title);
        m.put("ownerName", ownerName);
        m.put("minHypeLevel", minimum);
        m.put("hypeCurrentLevel", current == null ? null : current.name());
        m.put("reason", CouponHypeRules.lockedText(CouponHypeRules.parse(minimum), current));
        return m;
    }
}
