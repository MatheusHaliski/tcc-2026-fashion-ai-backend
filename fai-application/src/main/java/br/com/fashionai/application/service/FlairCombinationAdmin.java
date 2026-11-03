package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.FlairService.CombinationForm;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.FlairCombination;
import br.com.fashionai.domain.model.FlairRedemption;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.FlairCombinationRepository;
import br.com.fashionai.domain.repository.FlairRedemptionRepository;
import br.com.fashionai.domain.repository.UserRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Lado da loja nas combinações do {@link FlairService}: cadastrar, editar e excluir combinações (só marca/celebridade
 * aprovada e dona da combinação), a aba do perfil da loja e a conferência do cupom no caixa.
 */
final class FlairCombinationAdmin {
    private final Guard guard;
    private final UserRepository users;
    private final FlairCombinationRepository combinations;
    private final FlairRedemptionRepository redemptions;
    private final InstitutionalService institutional;
    private final FlairCombinationRules rules;

    FlairCombinationAdmin(Guard guard, UserRepository users, FlairCombinationRepository combinations,
                          FlairRedemptionRepository redemptions, InstitutionalService institutional, FlairCombinationRules rules) {
        this.guard = guard;
        this.users = users;
        this.combinations = combinations;
        this.redemptions = redemptions;
        this.institutional = institutional;
        this.rules = rules;
    }

    static final Set<String> GAME_TYPES = Set.of("COMBINACAO", "COLECAO", "DUELO_PATROCINADO");

    /** Loja das combinações: marca/celebridade validada pela administração e com conta ativa (igual aos selos). */
    private User brandOwner(CurrentUser user) {
        guard.requireApprovedInstitutional(user, "flair:combinations", Msg.t("flair.so_perfis_de_marca_ou"));
        return users.findById(user.id()).orElseThrow();
    }

    public Map<String, Object> saveCombination(CurrentUser user, UUID id, CombinationForm f) {
        User brand = brandOwner(user);
        FlairCombination c = id == null ? new FlairCombination() : combinations.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("flair.combinacao")));
        if (id != null && !c.getBrand().getId().equals(brand.getId())) {
            throw guard.deny(user, "flair:combination:" + id, Msg.t("flair.combinacao_de_outra_loja"));
        }
        c.setBrand(brand);
        c.setName(InputSanitizer.required("name", InputSanitizer.moderated("name", f.name(), 120), 3, 120));
        c.setDescription(f.description() == null ? null : InputSanitizer.clean(f.description(), 600));
        String type = f.gameType() == null ? "COMBINACAO" : f.gameType().toUpperCase(Locale.ROOT);
        if (!GAME_TYPES.contains(type)) {
            throw ApiException.badRequest("TIPO_INVALIDO", "Tipos: " + GAME_TYPES);
        }
        c.setGameType(type);
        c.setRequiredCategoriesJson(Json.write(clean(f.requiredCategories(), Taxonomy.SUBCATEGORIES.keySet())));
        c.setRequiredStylesJson(Json.write(clean(f.requiredStyles(), null)));
        c.setRequiredOccasionsJson(Json.write(clean(f.requiredOccasions(), null)));
        c.setMinBrandPieces(clamp(f.minBrandPieces(), 0, 10));
        c.setMinDeckPower(clamp(f.minDeckPower(), 0, 1000));
        c.setMinRarity(f.minRarity() == null || f.minRarity().isBlank() ? null : FlairEngine.RARITIES.contains(f.minRarity().toUpperCase(Locale.ROOT)) ? f.minRarity().toUpperCase(Locale.ROOT) : null);
        c.setMinWins("DUELO_PATROCINADO".equals(type) ? Math.max(1, clamp(f.minWins(), 1, 20)) : 0);
        if (Json.strings(c.getRequiredCategoriesJson()).isEmpty() && Json.strings(c.getRequiredStylesJson()).isEmpty()
                && Json.strings(c.getRequiredOccasionsJson()).isEmpty() && c.getMinBrandPieces() == 0 && c.getMinDeckPower() == 0
                && c.getMinRarity() == null && !"DUELO_PATROCINADO".equals(type)) {
            throw ApiException.badRequest("SEM_REQUISITOS", Msg.t("flair.defina_ao_menos_um_requisito"));
        }
        c.setCouponTitle(InputSanitizer.required("couponTitle", InputSanitizer.moderated("couponTitle", f.couponTitle(), 120), 3, 120));
        if (f.discountPercent() == null && f.discountAmount() == null) {
            throw ApiException.badRequest("DESCONTO_OBRIGATORIO", Msg.t("flair.informe_o_desconto_em_ou"));
        }
        c.setDiscountPercent(f.discountPercent() == null ? null : clamp(f.discountPercent(), 1, 90));
        c.setDiscountAmount(f.discountAmount());
        c.setMinPurchase(f.minPurchase());
        c.setValidDays(clamp(f.validDays() == null ? 30 : f.validDays(), 7, 120));
        c.setStock(f.stock() == null ? null : Math.max(1, f.stock()));
        c.setActive(f.active() == null || f.active());
        c.setStartsAt(f.startsAt());
        c.setEndsAt(f.endsAt());
        c.setAccentColor(f.accentColor() != null && f.accentColor().matches("#[0-9A-Fa-f]{6}") ? f.accentColor().toUpperCase(Locale.ROOT) : null);
        c.setStoreUrl(SealService.storeUrl(f.storeUrl()));
        combinations.save(c);
        return rules.combinationView(c, null, null);
    }

    public void deleteCombination(CurrentUser user, UUID id) {
        User brand = brandOwner(user);
        FlairCombination c = combinations.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("flair.combinacao")));
        if (!c.getBrand().getId().equals(brand.getId())) {
            throw guard.deny(user, "flair:combination:" + id, Msg.t("flair.combinacao_de_outra_loja"));
        }
        if (c.getRedeemed() > 0) {
            c.setActive(false);                       // com cupons emitidos, só desativa (os cupons continuam válidos)
        } else {
            combinations.delete(c);
        }
    }

    private static List<String> clean(List<String> v, Set<String> allowed) {
        return v == null ? List.of() : v.stream().filter(x -> x != null && !x.isBlank()).map(x -> x.trim().toLowerCase(Locale.ROOT))
                .filter(x -> allowed == null || allowed.contains(x)).distinct().limit(6).toList();
    }

    private static int clamp(Integer v, int min, int max) {
        return v == null ? min : Math.max(min, Math.min(max, v));
    }

    /** Aba "Minhas combinações FLAIR" (dono) / "Combinações FLAIR" (visitante) do perfil da loja. */
    public Map<String, Object> brandTab(CurrentUser viewer, String slug) {
        User owner = institutional.institutionalUser(slug);
        boolean admin = viewer != null && viewer.id().equals(owner.getId());
        List<FlairCombination> cs = combinations.findByBrandIdOrderByCreatedAtDesc(owner.getId());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("admin", admin);
        out.put("brandName", rules.brandNameOf(owner));
        out.put("participating", owner.getProfileType() == ProfileType.MARCA || owner.getProfileType() == ProfileType.CELEBRIDADE);
        out.put("combinations", cs.stream().filter(c -> admin || rules.available(c)).map(c -> rules.combinationView(c, viewer, null)).toList());
        if (admin) {
            List<FlairRedemption> rs = redemptions.findByCombinationBrandIdOrderByCreatedAtDesc(owner.getId());
            out.put("redemptions", rs.stream().limit(100).map(rules::redemptionView).toList());
            out.put("stats", Map.of("issued", rs.size(), "used", rs.stream().filter(r -> "USADO".equals(r.getStatus())).count()));
            out.put("gameTypes", List.of(Map.of("id", "COMBINACAO", "label", Msg.t("flair.combinacao_um_deck")), Map.of("id", "COLECAO", "label", Msg.t("flair.colecao_guarda_roupa_inteiro")),
                    Map.of("id", "DUELO_PATROCINADO", "label", Msg.t("flair.duelo_patrocinado_vitorias_com_peca"))));
        }
        return out;
    }

    /** No caixa: a loja confere o código e marca o cupom como usado. */
    public Map<String, Object> validateCode(CurrentUser user, String code) {
        User brand = brandOwner(user);
        FlairRedemption r = redemptions.findByCode(code == null ? "" : code.trim().toUpperCase(Locale.ROOT)).orElseThrow(() -> ApiException.notFound("Cupom"));
        if (!r.getCombination().getBrand().getId().equals(brand.getId())) {
            throw ApiException.notFound("Cupom");
        }
        if ("USADO".equals(r.getStatus())) {
            throw ApiException.conflict("CUPOM_USADO", Msg.t("flair.cupom_ja_usado_em", r.getUsedAt()));
        }
        if (r.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.conflict("CUPOM_EXPIRADO", Msg.t("common.cupom_expirado"));
        }
        r.setStatus("USADO");
        r.setUsedAt(Instant.now());
        return rules.redemptionView(r);
    }
}
