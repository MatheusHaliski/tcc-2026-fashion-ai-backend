package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.hype.HypeQueryService.GLOBE_MIN_ITEMS;
import static br.com.fashionai.application.hype.HypeRankFilters.blank;
import static br.com.fashionai.application.hype.HypeRankFilters.categoriesOf;
import static br.com.fashionai.application.hype.HypeRankFilters.norm;

/** HypeScore v2 — globo do Painel global com camadas de Hype: filtros, destaque visível para quem vê e mini cards. */
final class HypeGlobe {
    private final HypeReadCore core;
    private final HypeGlobeAggregate aggregate;

    HypeGlobe(HypeReadCore core, HypeGlobeAggregate aggregate) {
        this.core = core;
        this.aggregate = aggregate;
    }

    /*
     * RF53 × RF26 — o globo do Painel global com camadas de Hype: um agregado por país (o país do dono gravado em
     * hype_scores.country, V39) da população pública elegível com score, no recorte de tipo, janela, categoria,
     * subcategoria e nível mínimo. Item sem país entra só no "mundo". A métrica da janela é a do ranking (1 = trend,
     * 7 = score, 30 = média do mês) para escolher o item de destaque; o Hype médio e o máximo usam o score atual (1 e 7)
     * ou a média do mês (30). Os agregados não dependem de quem vê (bloqueio não se aplica a contagens) e vão para o
     * HypeCache; o destaque ("top") respeita a visibilidade de quem vê: se o primeiro não for visível, vale o próximo.
     */

    Map<String, Object> globe(CurrentUser viewer, HypeEntityType type, int window, String category, String subcategory, String minLevel) {
        int win = window <= 1 ? 1 : window >= 30 ? 30 : 7;
        String cat = norm(category);
        String sub = norm(subcategory);
        br.com.fashionai.domain.model.enums.HypeLevel min = globeLevel(minLevel);
        String key = "globe:" + type + ":" + win + ":" + cat + ":" + sub + ":" + (min == null ? "" : min.name());
        Map<String, Object> agg = core.cache.get(key, () -> aggregate.globeAggregate(type, win, cat, sub, min));
        List<Map<String, Object>> rows = agg.get("countries") instanceof List<?> l ? l.stream().filter(Map.class::isInstance)
                .map(x -> {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> m = (Map<String, Object>) x;
                    return m;
                }).toList() : List.of();
        // candidatos de todos os países numa leitura só; o estado fresco confirma que ainda são públicos
        List<UUID> candidates = rows.stream().flatMap(r -> globeCandidates(r).stream()).distinct().toList();
        Map<UUID, HypeScoreCurrent> fresh = core.currentOf(type, candidates);
        Map<UUID, Map<String, Object>> cards = globeCards(viewer, type, candidates);
        Instant now = Instant.now();
        List<Map<String, Object>> countries = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = new LinkedHashMap<>(r);
            m.remove("candidates");
            Map<String, Object> top = null;
            for (UUID id : globeCandidates(r)) {
                HypeScoreCurrent c = fresh.get(id);
                Map<String, Object> card = cards.get(id);
                if (c == null || !c.isPublicEligible() || c.getStatus() != HypeStatus.AVAILABLE || card == null) {
                    continue;   // deixou de ser público depois do cálculo, bloqueio entre as contas ou sem permissão de ver
                }
                top = new LinkedHashMap<>(card);
                if (top.get("category") == null) {
                    top.put("category", categoriesOf(c).stream().findFirst().orElse(null));   // look: a primeira categoria das peças
                }
                top.put("hype", core.summary(c, now));
                break;
            }
            m.put("top", top);
            // "sufficient" fica por último, como no contrato (o globo desenha apagado e sem card abaixo do mínimo)
            Object sufficient = m.remove("sufficient");
            m.put("sufficient", sufficient);
            countries.add(m);
        }
        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("category", cat.isEmpty() ? null : cat);
        filters.put("subcategory", sub.isEmpty() ? null : sub);
        filters.put("minLevel", min == null ? null : min.name());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type.name());
        out.put("window", win);
        out.put("algorithmVersion", core.config.algorithmVersion());
        out.put("filters", filters);
        out.put("minItems", GLOBE_MIN_ITEMS);
        out.put("world", agg.get("world"));
        out.put("countries", countries);
        out.put("regions", agg.getOrDefault("regions", List.of()));
        return out;
    }

    /** Nível mínimo do filtro: vazio = qualquer um; valor fora da escala = 400 (como o tipo inválido). */
    static br.com.fashionai.domain.model.enums.HypeLevel globeLevel(String raw) {
        if (blank(raw)) {
            return null;
        }
        try {
            return br.com.fashionai.domain.model.enums.HypeLevel.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("NIVEL_INVALIDO", "minLevel: " + java.util.Arrays.stream(br.com.fashionai.domain.model.enums.HypeLevel.values())
                    .map(Enum::name).collect(Collectors.joining(" | ")));
        }
    }

    static List<UUID> globeCandidates(Map<String, Object> row) {
        return row.get("candidates") instanceof List<?> l ? l.stream().map(String::valueOf).map(UUID::fromString).toList() : List.of();
    }

    /** Mini card do destaque (nome, imagem, categoria e @dono) só dos itens que quem vê pode ver. */
    Map<UUID, Map<String, Object>> globeCards(CurrentUser viewer, HypeEntityType type, List<UUID> ids) {
        Map<UUID, Map<String, Object>> out = new HashMap<>();
        if (ids.isEmpty()) {
            return out;
        }
        if (type == HypeEntityType.PIECE) {
            for (WardrobeItem w : core.pieces.findByIdIn(ids)) {
                if (core.canView(viewer, w)) {
                    out.put(w.getId(), globeCard(w.getId(), type, w.getName(),
                            w.getStudioImageUrl() != null ? Views.studioThumb(w.getStudioImageUrl()) : w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl(),
                            w.getCategory(), w.getUser()));
                }
            }
            return out;
        }
        List<Scheme> list = core.schemes.findByIdIn(ids).stream().filter(s -> core.canView(viewer, s)).toList();
        // look sem capa: a imagem da primeira peça visível dele
        List<UUID> bare = list.stream().filter(s -> blank(s.getCoverImageUrl()) && blank(s.getMannequinImageUrl())).map(Scheme::getId).toList();
        Map<UUID, String> firstPiece = new HashMap<>();
        if (!bare.isEmpty()) {
            core.schemeItems.findBySchemeIdIn(bare).stream().sorted(Comparator.comparingInt(SchemeItem::getSortOrder))
                    .filter(si -> si.getWardrobeItem() != null && core.canView(viewer, si.getWardrobeItem()))
                    .forEach(si -> {
                        WardrobeItem w = si.getWardrobeItem();
                        String img = w.getStudioImageUrl() != null ? Views.studioThumb(w.getStudioImageUrl()) : w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl();
                        if (img != null) {
                            firstPiece.putIfAbsent(si.getScheme().getId(), img);
                        }
                    });
        }
        for (Scheme s : list) {
            String img = !blank(s.getCoverImageUrl()) ? s.getCoverImageUrl() : !blank(s.getMannequinImageUrl()) ? s.getMannequinImageUrl() : firstPiece.get(s.getId());
            out.put(s.getId(), globeCard(s.getId(), type, s.getTitle(), img, null, s.getUser()));
        }
        return out;
    }

    static Map<String, Object> globeCard(UUID id, HypeEntityType type, String name, String imageUrl, String category, br.com.fashionai.domain.model.User owner) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id.toString());
        m.put("type", type.name());
        m.put("name", name);
        m.put("imageUrl", imageUrl);
        m.put("category", category);
        Map<String, Object> o = new LinkedHashMap<>();
        o.put("username", owner == null ? null : owner.getUsername());
        m.put("owner", o);
        return m;
    }
}
