package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.PromotionRedemption;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import br.com.fashionai.domain.model.enums.RedemptionStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.repository.PromotionRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * RF20.CA11 / RF21.CA21 / RF38 / regra 7 — o que quem tem selo vê: "Meus Selos", promoções elegíveis e do perfil,
 * views de promoção e resgate e as métricas do emissor. Colaborador do {@link SealService} (R80).
 */
final class SealPromotionReads {
    private final PromotionRepository promotions;
    private final PromotionRedemptionRepository redemptions;
    private final SealBondRepository bonds;
    private final UserRepository users;
    private final SealIssuers issuers;
    private final SealHypeAverages averages;
    private final SealViews views;

    SealPromotionReads(PromotionRepository promotions, PromotionRedemptionRepository redemptions, SealBondRepository bonds, UserRepository users, SealIssuers issuers, SealHypeAverages averages, SealViews views) {
        this.promotions = promotions;
        this.redemptions = redemptions;
        this.bonds = bonds;
        this.users = users;
        this.issuers = issuers;
        this.averages = averages;
        this.views = views;
    }

    Map<String, Object> mySeals(CurrentUser user) {
        Map<String, List<Map<String, Object>>> groups = new LinkedHashMap<>();
        groups.put("ativos", new ArrayList<>());
        groups.put("pendentes", new ArrayList<>());
        groups.put("recusados", new ArrayList<>());
        groups.put("sugeridos", new ArrayList<>());
        groups.put("inativos", new ArrayList<>());
        Instant now = Instant.now();
        List<SealBond> mine = bonds.findByRequestedByIdOrderByCreatedAtDesc(user.id());
        Map<UUID, Map<String, Object>> sealHype = averages.sealHype(mine.stream().map(SealBond::getSeal).filter(Objects::nonNull).toList());
        for (SealBond b : mine) {
            Map<String, Object> v = views.bondView(b);
            if (b.getSeal() != null && v.get("seal") instanceof Map<?, ?> sv) {
                SealViews.castMap(sv).put("hype", sealHype.getOrDefault(b.getSeal().getId(), SealHypeAverages.emptySealHype()));   // RF53 — Hype do selo
            }
            v.put("scheme", views.schemeSummary(b.getScheme()));
            switch (b.getStatus()) {
                case APPROVED -> {
                    if (b.getExpiresAt() != null && b.getExpiresAt().isBefore(now)) {
                        v.put("state", "EXPIRADO");
                        groups.get("inativos").add(v);
                    } else {
                        v.put("promotions", promotionsFor(user, b));
                        groups.get("ativos").add(v);
                    }
                }
                case PENDING_REVIEW, ACCEPTED, EDITED -> groups.get("pendentes").add(v);
                case REFUSED -> groups.get("recusados").add(v);
                case SUGGESTED -> groups.get("sugeridos").add(v);
                default -> groups.get("inativos").add(v);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>(groups);
        out.put("redemptions", redemptions.findByUserIdOrderByRedeemedAtDesc(user.id()).stream().map(this::redemptionView).toList());
        return out;
    }

    /** Card RF38 — promoções que o usuário pode resgatar agora (selo válido, período, estoque e limite por pessoa). */
    List<Promotion> eligiblePromotions(UUID userId) {
        Instant now = Instant.now();
        List<SealBond> mine = bonds.findByRequestedByIdAndStatusOrderByCreatedAtDesc(userId, SealBondStatus.APPROVED);
        Set<UUID> owners = new java.util.LinkedHashSet<>();
        mine.forEach(b -> owners.add(b.getTargetOwner().getId()));
        List<Promotion> out = new ArrayList<>();
        for (UUID owner : owners) {
            if (!users.findById(owner).map(FlairService::sellerActive).orElse(false)) {
                continue;                                  // emissor pendente, suspenso ou excluído não emite cupom
            }
            List<SealBond> ownerBonds = mine.stream().filter(b -> b.getTargetOwner().getId().equals(owner)).toList();
            for (Promotion p : promotions.findByOwnerUserIdAndStatusOrderByCreatedAtDesc(owner, PromotionStatus.AVAILABLE)) {
                if (unavailable(p, now) == null && eligibleBond(p, ownerBonds) != null
                        && redemptions.countByPromotionIdAndUserId(p.getId(), userId) < p.getPerUserLimit()) {
                    out.add(p);
                }
            }
        }
        return out;
    }

    /** Promoções do perfil, filtradas pelos selos do solicitante (CA11/CA21). */
    List<Map<String, Object>> promotionsOf(CurrentUser viewer, UUID ownerId) {
        if ((viewer == null || !viewer.id().equals(ownerId)) && !users.findById(ownerId).map(FlairService::sellerActive).orElse(false)) {
            return List.of();                              // emissor pendente/suspenso: nada na vitrine
        }
        List<SealBond> myBonds = viewer == null ? List.of() : bonds.findByRequestedByIdAndStatusOrderByCreatedAtDesc(viewer.id(),
                SealBondStatus.APPROVED).stream().filter(b -> b.getTargetOwner().getId().equals(ownerId)).toList();
        boolean owner = viewer != null && viewer.id().equals(ownerId);
        return promotions.findByOwnerUserIdOrderByCreatedAtDesc(ownerId).stream()
                .filter(p -> owner || p.getStatus() == PromotionStatus.AVAILABLE)
                .map(p -> promotionView(p, eligibleBond(p, myBonds))).toList();
    }

    private List<Map<String, Object>> promotionsFor(CurrentUser user, SealBond b) {
        return promotions.findByOwnerUserIdOrderByCreatedAtDesc(b.getTargetOwner().getId()).stream()
                .filter(p -> p.getStatus() == PromotionStatus.AVAILABLE)
                .map(p -> promotionView(p, eligibleBond(p, List.of(b)))).toList();
    }

    SealBond eligibleBond(Promotion p, List<SealBond> candidates) {
        return PromotionRules.eligibleBond(p, candidates, Instant.now());
    }

    Map<String, Object> promotionView(Promotion p, SealBond eligible) {
        Map<String, Object> m = new LinkedHashMap<>();
        Instant now = Instant.now();
        m.put("id", p.getId());
        m.put("ownerUserId", p.getOwnerUserId());
        m.put("type", p.getType());
        m.put("title", p.getTitle());
        m.put("description", p.getDescription());
        m.put("rules", p.getRules());
        m.put("discountPercent", p.getDiscountPercent());
        m.put("sealId", p.getSeal() == null ? null : p.getSeal().getId());
        m.put("requiredSealKind", p.getRequiredSealKind());
        m.put("startsAt", p.getStartsAt());
        m.put("expiresAt", p.getExpiresAt());
        m.put("totalQuota", p.getTotalQuota());
        m.put("remaining", p.getTotalQuota() == null ? null : Math.max(0, p.getTotalQuota() - p.getRedeemedCount()));
        m.put("perUserLimit", p.getPerUserLimit());
        m.put("partnerBrandUserId", p.getPartnerBrandUserId());
        m.put("status", p.getStatus());
        m.put("storeUrl", p.getStoreUrl());
        m.put("eligible", eligible != null && unavailable(p, now) == null);
        m.put("unavailableReason", eligible == null ? Msg.t("seal.e_preciso_ter_um_selo") : unavailable(p, now));
        m.put("eligibleBondId", eligible == null ? null : eligible.getId());
        return m;
    }

    static String unavailable(Promotion p, Instant now) {
        return PromotionRules.unavailable(p, now);
    }

    Map<String, Object> redemptionView(PromotionRedemption r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("code", r.getCode());
        m.put("promotionId", r.getPromotion().getId());
        m.put("promotionTitle", r.getPromotion().getTitle());
        m.put("issuerUserId", r.getIssuerUserId());
        m.put("partnerBrandUserId", r.getPartnerBrandUserId());
        m.put("status", r.getExpiresAt() != null && r.getExpiresAt().isBefore(Instant.now()) ? RedemptionStatus.EXPIRED : r.getStatus());
        m.put("redeemedAt", r.getRedeemedAt());
        m.put("expiresAt", r.getExpiresAt());
        return m;
    }

    /** Regra 7 — métricas por perfil emissor. */
    Map<String, Object> issuerMetrics(CurrentUser user) {
        issuers.requireIssuer(user);
        long suggested = bonds.countByTargetOwnerId(user.id());
        long approved = bonds.countByTargetOwnerIdAndStatus(user.id(), SealBondStatus.APPROVED);
        long pending = bonds.countByTargetOwnerIdAndStatus(user.id(), SealBondStatus.PENDING_REVIEW);
        long refused = bonds.countByTargetOwnerIdAndStatus(user.id(), SealBondStatus.REFUSED);
        long redeemed = redemptions.countByIssuerUserId(user.id()) + redemptions.countByPartnerBrandUserId(user.id());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("suggested", suggested);
        m.put("accepted", suggested - refused);
        m.put("approved", approved);
        m.put("pendingReview", pending);
        m.put("activeSeals", approved);
        m.put("redemptions", redeemed);
        m.put("conversionSealToRedemption", approved == 0 ? 0 : Math.round(redeemed * 1000.0 / approved) / 10.0);
        m.put("hype", averages.bondedHype(user.id()));   // RF53 · P2-09 (aditivo): Hype v2 dos looks vinculados, só públicos
        return m;
    }
}
