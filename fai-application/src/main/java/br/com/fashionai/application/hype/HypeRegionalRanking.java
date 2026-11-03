package br.com.fashionai.application.hype;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;

import static br.com.fashionai.application.hype.HypeQueryService.RANKING_MAX_SIZE;
import static br.com.fashionai.application.hype.HypeRankFilters.hasCategory;
import static br.com.fashionai.application.hype.HypeRankFilters.hasSubcategory;
import static br.com.fashionai.application.hype.HypeRankFilters.inCountry;
import static br.com.fashionai.application.hype.HypeRankFilters.inRegion;
import static br.com.fashionai.application.hype.HypeRankFilters.norm;
import static br.com.fashionai.application.hype.HypeRankFilters.regionOf;
import static br.com.fashionai.application.hype.HypeRankFilters.round1;
import static br.com.fashionai.application.hype.HypeRankFilters.trendOf;
import static br.com.fashionai.application.hype.HypeRankFilters.upper;

/** HypeScore v2 — ranking por região (Explorador → Ranking de HypeScore): ids ordenados do recorte e a página de quem vê. */
final class HypeRegionalRanking {
    private final HypeReadCore core;

    HypeRegionalRanking(HypeReadCore core) {
        this.core = core;
    }

    /*
     * Ranking de HypeScore com recortes: TIPO (peça/look) e JANELA mudam o contexto; região do mundo, país, categoria e
     * subcategoria são filtros. A peça entra pela própria categoria/subcategoria; o look entra pelas das peças que o
     * compõem ("um look que tem calçado"). Só a população pública elegível com score disponível — item privado nunca
     * entra. A métrica de cada janela é a mesma do rank() (1 = trend, 7 = score, 30 = média dos snapshots do mês), com
     * desempate estável pelo id. As posições são fatos públicos: quem vê não muda a numeração — item bloqueado (ou que
     * deixou de ser visível) só some da página. Quem não informou o país fica em "Outras regiões" (WorldRegions.of(null)).
     */

    Map<String, Object> ranking(CurrentUser viewer, HypeEntityType type, int window, String region, String country, String category,
                                       String subcategory, int page, int size) {
        int win = window <= 1 ? 1 : window >= 30 ? 30 : 7;
        int sz = Math.max(1, Math.min(RANKING_MAX_SIZE, size <= 0 ? 24 : size));
        int pg = Math.max(0, page);
        String r = upper(region);
        String co = upper(country);
        String cat = norm(category);
        String sub = norm(subcategory);
        String key = "ranking:" + type + ":" + win + ":" + r + ":" + co + ":" + cat + ":" + sub;
        Map<String, Object> ranked = core.cache.get(key, () -> rankRegional(type, win, r, co, cat, sub));
        List<String> ids = ranked.get("ids") instanceof List<?> li ? li.stream().map(String::valueOf).toList() : List.of();
        List<?> values = ranked.get("values") instanceof List<?> lv ? lv : List.of();
        int total = ids.size();
        int from = (int) Math.min((long) pg * sz, total);
        int to = Math.min(from + sz, total);
        List<UUID> pageIds = ids.subList(from, to).stream().map(UUID::fromString).toList();
        Map<UUID, HypeScoreCurrent> rows = core.currentOf(type, pageIds);
        Map<UUID, Object> views = new HashMap<>();
        Map<UUID, List<Map<String, Object>>> lookPieces = new HashMap<>();
        if (type == HypeEntityType.PIECE) {
            views.putAll(core.views(viewer, type, pageIds));
        } else if (!pageIds.isEmpty()) {
            List<Scheme> list = core.schemes.findByIdIn(pageIds).stream().filter(s -> core.canView(viewer, s)).toList();
            Map<UUID, List<SchemeItem>> itemsBy = list.isEmpty() ? Map.of() : core.schemeItems.findBySchemeIdIn(list.stream().map(Scheme::getId).toList()).stream()
                    .sorted(Comparator.comparingInt(SchemeItem::getSortOrder)).collect(Collectors.groupingBy(si -> si.getScheme().getId()));
            for (Scheme s : list) {
                List<SchemeItem> items = itemsBy.getOrDefault(s.getId(), List.of());
                views.put(s.getId(), core.schemeService.view(viewer, s, items));
                lookPieces.put(s.getId(), core.lookPieces(viewer, items));   // o Hype do look pelas peças dentro dele
            }
        }
        Instant now = Instant.now();
        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 0; i < pageIds.size(); i++) {
            UUID id = pageIds.get(i);
            HypeScoreCurrent c = rows.get(id);
            Object view = views.get(id);
            if (c == null || !c.isPublicEligible() || c.getStatus() != HypeStatus.AVAILABLE || view == null) {
                continue;   // deixou de ser público depois do cálculo, bloqueio entre as contas ou sem permissão de ver
            }
            String reg = regionOf(c);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("rank", from + i + 1);
            m.put("id", id.toString());
            Object v = from + i < values.size() ? values.get(from + i) : null;
            m.put("value", v instanceof Number n ? round1(n.doubleValue()) : null);
            m.put("hype", core.summary(c, now));
            m.put("region", reg);
            m.put("regionLabel", br.com.fashionai.application.taxonomy.WorldRegions.label(reg));
            m.put("country", c.getCountry());
            if (type == HypeEntityType.PIECE) {
                m.put("piece", view);
            } else {
                m.put("scheme", view);
                m.put("pieces", lookPieces.getOrDefault(id, List.of()));
            }
            items.add(m);
        }
        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("region", r.isEmpty() ? null : r);
        filters.put("country", co.isEmpty() ? null : co);
        filters.put("category", cat.isEmpty() ? null : cat);
        filters.put("subcategory", sub.isEmpty() ? null : sub);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type.name());
        out.put("window", win);
        out.put("algorithmVersion", core.config.algorithmVersion());
        out.put("total", total);
        out.put("page", pg);
        out.put("size", sz);
        out.put("hasMore", to < total);
        out.put("filters", filters);
        out.put("items", items);
        return out;
    }

    /** Ids ordenados do recorte (vai para o HypeCache; o que é de quem vê é aplicado depois, na página). */
    Map<String, Object> rankRegional(HypeEntityType type, int win, String region, String country, String category, String subcategory) {
        List<HypeScoreCurrent> pool = core.publicPool(type).stream()
                .filter(c -> inRegion(c, region) && inCountry(c, country) && hasCategory(c, category) && hasSubcategory(c, subcategory)).toList();
        Map<UUID, Double> avg = win == 30 ? core.monthAverage(type, pool.stream().map(HypeScoreCurrent::getEntityId).collect(Collectors.toSet())) : Map.of();
        ToDoubleFunction<HypeScoreCurrent> metric = win == 1 ? c -> trendOf(c) * 1000 + c.getScore().doubleValue()
                : win == 30 ? c -> avg.getOrDefault(c.getEntityId(), c.getScore().doubleValue()) : c -> c.getScore().doubleValue();
        ToDoubleFunction<HypeScoreCurrent> shown = win == 1 ? HypeRankFilters::trendOf : metric;   // o número exibido: trend, score ou média do mês
        List<HypeScoreCurrent> sorted = pool.stream().sorted(Comparator.comparingDouble(metric).reversed()
                .thenComparing(c -> c.getEntityId().toString())).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ids", sorted.stream().map(c -> c.getEntityId().toString()).toList());
        out.put("values", sorted.stream().map(c -> round1(shown.applyAsDouble(c))).toList());
        return out;
    }
}
