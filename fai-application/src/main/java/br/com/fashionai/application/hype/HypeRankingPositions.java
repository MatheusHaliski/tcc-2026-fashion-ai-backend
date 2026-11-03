package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static br.com.fashionai.application.hype.HypeQueryService.POSITIONS_WINDOW;
import static br.com.fashionai.application.hype.HypeRankFilters.blank;
import static br.com.fashionai.application.hype.HypeRankFilters.categoriesOf;
import static br.com.fashionai.application.hype.HypeRankFilters.hasCategory;
import static br.com.fashionai.application.hype.HypeRankFilters.hasSubcategory;
import static br.com.fashionai.application.hype.HypeRankFilters.inCountry;
import static br.com.fashionai.application.hype.HypeRankFilters.regionOf;
import static br.com.fashionai.application.hype.HypeRankFilters.subcategoriesOf;
import static br.com.fashionai.application.hype.HypeRankFilters.taxonomyLabel;

/** HypeScore v2 — posições do item no ranking público (mundo, categoria, subcategoria, região e país). */
final class HypeRankingPositions {
    private final HypeReadCore core;

    HypeRankingPositions(HypeReadCore core) {
        this.core = core;
    }

    /**
     * Posições do item no ranking público (janela de 7 dias = HypeScore atual): no mundo, na categoria e na subcategoria
     * (peças) e na região e no país (peças e looks). Item fora da população pública (privado, não aprovado, sem dados)
     * não tem posição: {@code eligible = false} — o dono continua vendo o próprio Hype na análise. Visibilidade = detalhe (404).
     */
    Map<String, Object> positions(CurrentUser viewer, HypeEntityType type, UUID id) {
        boolean ok = type == HypeEntityType.PIECE ? core.pieces.findById(id).filter(w -> core.canView(viewer, w)).isPresent()
                : core.schemes.findById(id).filter(s -> core.canView(viewer, s)).isPresent();
        if (!ok) {
            throw ApiException.notFound(type == HypeEntityType.PIECE ? Msg.t("common.peca") : Msg.t("entity.esquema"));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("eligible", false);
        out.put("window", POSITIONS_WINDOW);
        out.put("positions", List.of());
        Optional<HypeScoreCurrent> row = core.current.findByEntityTypeAndEntityIdAndAlgorithmVersion(type, id, core.config.algorithmVersion());
        if (row.isEmpty() || !row.get().isPublicEligible() || row.get().getStatus() != HypeStatus.AVAILABLE || row.get().getScore() == null) {
            return out;
        }
        HypeScoreCurrent me = row.get();
        List<HypeScoreCurrent> pool = core.publicPool(type);
        List<Map<String, Object>> positions = new ArrayList<>();
        positions.add(position(pool, me, "GLOBAL", null, Msg.k("worldRegions.mundo"), c -> true));
        if (type == HypeEntityType.PIECE) {
            String cat = categoriesOf(me).stream().findFirst().orElse(null);
            if (!blank(cat)) {
                positions.add(position(pool, me, "CATEGORY", cat, taxonomyLabel(cat), c -> hasCategory(c, cat)));
            }
            String sub = subcategoriesOf(me).stream().findFirst().orElse(null);
            if (!blank(sub)) {
                positions.add(position(pool, me, "SUBCATEGORY", sub, taxonomyLabel(sub), c -> hasSubcategory(c, sub)));
            }
        }
        String reg = regionOf(me);
        positions.add(position(pool, me, "REGION", reg, br.com.fashionai.application.taxonomy.WorldRegions.label(reg), c -> reg.equals(regionOf(c))));
        if (!blank(me.getCountry())) {
            String co = me.getCountry().trim().toUpperCase(Locale.ROOT);
            String name = Locale.of("", co).getDisplayCountry(Msg.locale());
            positions.add(position(pool, me, "COUNTRY", co, blank(name) ? co : name, c -> inCountry(c, co)));
        }
        out.put("eligible", true);
        out.put("positions", positions);
        return out;
    }

    /** Posição no recorte: 1 + quantos do recorte vêm antes (score maior; empate pelo id, como na lista do ranking). */
    static Map<String, Object> position(List<HypeScoreCurrent> pool, HypeScoreCurrent me, String scope, String key, String label,
                                        java.util.function.Predicate<HypeScoreCurrent> inScope) {
        Comparator<HypeScoreCurrent> order = Comparator.comparingDouble((HypeScoreCurrent c) -> c.getScore().doubleValue()).reversed()
                .thenComparing(c -> c.getEntityId().toString());
        List<HypeScoreCurrent> others = pool.stream().filter(c -> !c.getEntityId().equals(me.getEntityId()) && c.getScore() != null && inScope.test(c)).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("scope", scope);
        m.put("key", key);
        m.put("label", label);
        m.put("rank", 1 + others.stream().filter(c -> order.compare(c, me) < 0).count());
        m.put("total", others.size() + 1);
        return m;
    }
}
