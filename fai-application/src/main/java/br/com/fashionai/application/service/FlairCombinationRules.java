package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.FlairCombination;
import br.com.fashionai.domain.model.FlairRedemption;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.FlairMatchEntryRepository;
import br.com.fashionai.domain.repository.FlairRedemptionRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import static br.com.fashionai.application.service.FlairService.today;

/**
 * Combinações das lojas no {@link FlairService}: quando a loja e a combinação estão disponíveis, o checklist dos
 * requisitos contra um deck (ou o guarda-roupa, no tipo COLECAO) e as visões da combinação e do cupom.
 */
final class FlairCombinationRules {
    private final BrandProfileRepository brands;
    private final FlairMatchEntryRepository entries;
    private final FlairRedemptionRepository redemptions;

    FlairCombinationRules(BrandProfileRepository brands, FlairMatchEntryRepository entries, FlairRedemptionRepository redemptions) {
        this.brands = brands;
        this.entries = entries;
        this.redemptions = redemptions;
    }

    static final Map<String, String> CATEGORY_LABELS = Map.of("upper_piece", Msg.k("flair.parte_de_cima"), "lower_piece", Msg.k("flair.parte_de_baixo"),
            "shoes_piece", Msg.k("flair.calcado"), "accessory_piece", Msg.k("flair.acessorio"), "full_body_piece", Msg.k("flair.peca_inteira"));

    /** Loja apta a oferecer cupom: perfil de marca/celebridade aprovado e conta ativa (pendente, suspensa ou excluída não). */
    static boolean sellerActive(User owner) {
        return owner != null && owner.getStatus() == AccountStatus.ACTIVE
                && (owner.getProfileType() == ProfileType.MARCA || owner.getProfileType() == ProfileType.CELEBRIDADE);
    }

    boolean available(FlairCombination c) {
        Instant now = Instant.now();
        return c.isActive() && sellerActive(c.getBrand()) && (c.getStartsAt() == null || !now.isBefore(c.getStartsAt())) && (c.getEndsAt() == null || now.isBefore(c.getEndsAt()))
                && (c.getStock() == null || c.getRedeemed() < c.getStock());
    }

    String brandNameOf(User owner) {
        return brands.findByOwnerId(owner.getId()).map(BrandProfile::getBrandName).orElse(owner.getDisplayName());
    }

    private boolean isBrandCard(Card c, User owner, String brandName) {
        return owner.getId().toString().equals(c.brandOwner()) || c.brandName() != null && c.brandName().equalsIgnoreCase(brandName);
    }

    /** Requisitos da combinação contra um deck (ou contra o guarda-roupa, no tipo COLECAO). */
    List<Map<String, Object>> check(FlairCombination c, Deck deck, List<Card> wardrobe, CurrentUser user) {
        List<Card> cs = "COLECAO".equals(c.getGameType()) ? wardrobe : deck == null ? List.of() : deck.cards();
        String bn = brandNameOf(c.getBrand());
        List<Map<String, Object>> out = new ArrayList<>();
        for (String cat : Json.strings(c.getRequiredCategoriesJson())) {
            out.add(req("CATEGORY", cat, "Categoria: " + CATEGORY_LABELS.getOrDefault(cat, cat), cs.stream().anyMatch(x -> cat.equals(x.category()))));
        }
        for (String st : Json.strings(c.getRequiredStylesJson())) {
            out.add(req("STYLE", st, "Estilo: " + st, cs.stream().anyMatch(x -> x.styles().contains(st))));
        }
        for (String oc : Json.strings(c.getRequiredOccasionsJson())) {
            out.add(req("OCCASION", oc, Msg.t("flair.ocasiao", oc), cs.stream().anyMatch(x -> x.occasions().contains(oc))));
        }
        if (c.getMinBrandPieces() > 0) {
            long n = cs.stream().filter(x -> isBrandCard(x, c.getBrand(), bn)).count();
            out.add(req("BRAND", String.valueOf(n), Msg.t("flair.peca_s", (c.getMinBrandPieces()), bn, n), n >= c.getMinBrandPieces()));
        }
        if (c.getMinDeckPower() > 0 && !"COLECAO".equals(c.getGameType())) {
            int p = deck == null ? 0 : deck.power();
            out.add(req("POWER", String.valueOf(p), Msg.t("flair.poder_do_deck", c.getMinDeckPower(), p), p >= c.getMinDeckPower()));
        }
        if (c.getMinRarity() != null) {
            int need = FlairEngine.RARITIES.indexOf(c.getMinRarity());
            out.add(req("RARITY", c.getMinRarity(), Msg.t("flair.uma_carta_ou_melhor", c.getMinRarity()), cs.stream().anyMatch(x -> FlairEngine.RARITIES.indexOf(x.rarity()) >= need)));
        }
        if ("DUELO_PATROCINADO".equals(c.getGameType()) && user != null) {
            Instant since = today().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).atStartOfDay(FaiPointsService.ZONE).toInstant();
            long wins = entries.findByUserIdAndCreatedAtAfter(user.id(), since).stream()
                    .filter(e -> Objects.equals(e.getSide(), e.getMatch().getWinnerSide()) && FlairModesService.COMPETITIVE.contains(e.getMatch().getMode()))
                    .filter(e -> Json.strings(e.getBrandPiecesJson()).contains(bn.toLowerCase(Locale.ROOT))).count();
            out.add(req("WINS", String.valueOf(wins), Msg.t("flair.vitoria_s_nesta_semana_com", (c.getMinWins()), bn, wins), wins >= c.getMinWins()));
        }
        return out;
    }

    private static Map<String, Object> req(String kind, String value, String label, boolean ok) {
        return Map.of("kind", kind, "value", value, "label", label, "ok", ok);
    }

    Map<String, Object> combinationView(FlairCombination c, CurrentUser viewer, Deck deck) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("brand", Views.user(c.getBrand()));
        m.put("brandName", brandNameOf(c.getBrand()));
        m.put("brandSlug", brands.findByOwnerId(c.getBrand().getId()).map(BrandProfile::getSlug).orElse(null));
        m.put("name", c.getName());
        m.put("description", c.getDescription());
        m.put("gameType", c.getGameType());
        m.put("requiredCategories", Json.strings(c.getRequiredCategoriesJson()));
        m.put("requiredStyles", Json.strings(c.getRequiredStylesJson()));
        m.put("requiredOccasions", Json.strings(c.getRequiredOccasionsJson()));
        m.put("minBrandPieces", c.getMinBrandPieces());
        m.put("minDeckPower", c.getMinDeckPower());
        m.put("minRarity", c.getMinRarity());
        m.put("minWins", c.getMinWins());
        m.put("coupon", Map.of("title", c.getCouponTitle(), "discountPercent", c.getDiscountPercent() == null ? "" : c.getDiscountPercent(),
                "discountAmount", c.getDiscountAmount() == null ? "" : c.getDiscountAmount(), "minPurchase", c.getMinPurchase() == null ? "" : c.getMinPurchase(), "validDays", c.getValidDays()));
        m.put("stock", c.getStock());
        m.put("redeemed", c.getRedeemed());
        m.put("active", c.isActive());
        m.put("available", available(c));
        m.put("startsAt", c.getStartsAt());
        m.put("endsAt", c.getEndsAt());
        m.put("accentColor", c.getAccentColor() == null ? "#2D55C9" : c.getAccentColor());
        m.put("storeUrl", c.getStoreUrl());
        if (viewer != null) {
            m.put("redemption", redemptions.findByCombinationIdAndUserId(c.getId(), viewer.id()).map(this::redemptionView).orElse(null));
        }
        return m;
    }

    Map<String, Object> redemptionView(FlairRedemption r) {
        FlairCombination c = r.getCombination();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("code", r.getCode());
        m.put("status", r.getStatus().equals("EMITIDO") && r.getExpiresAt().isBefore(Instant.now()) ? "EXPIRADO" : r.getStatus());
        m.put("expiresAt", r.getExpiresAt());
        m.put("usedAt", r.getUsedAt());
        m.put("createdAt", r.getCreatedAt());
        m.put("deck", r.getScheme() == null ? null : r.getScheme().getTitle());
        m.put("deckPower", r.getDeckPower());
        m.put("user", Views.user(r.getUser()));
        m.put("combination", Map.of("id", c.getId(), "name", c.getName(), "brandName", brandNameOf(c.getBrand()), "coupon", c.getCouponTitle(),
                "discountPercent", c.getDiscountPercent() == null ? "" : c.getDiscountPercent(), "discountAmount", c.getDiscountAmount() == null ? "" : c.getDiscountAmount(),
                "minPurchase", c.getMinPurchase() == null ? "" : c.getMinPurchase(), "accentColor", c.getAccentColor() == null ? "#2D55C9" : c.getAccentColor()));
        return m;
    }

}
