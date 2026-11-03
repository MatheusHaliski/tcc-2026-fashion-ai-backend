package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeQueryService.RankGroup;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.hype.HypeQueryService.GROUP_TOP_ITEMS;
import static br.com.fashionai.application.hype.HypeQueryService.MIN_GROUP_ITEMS;
import static br.com.fashionai.application.hype.HypeQueryService.brandKey;
import static br.com.fashionai.application.hype.HypeRankFilters.blank;
import static br.com.fashionai.application.hype.HypeRankFilters.norm;
import static br.com.fashionai.application.hype.HypeRankFilters.round1;
import static br.com.fashionai.application.hype.HypeRankFilters.trendOf;

/** HypeScore v2 — ranking agregado do "Em alta": marcas (peças) e pessoas criadoras (peças + looks), com perfil oficial e opt-out. */
final class HypeGroupRanking {
    private final HypeReadCore core;

    HypeGroupRanking(HypeReadCore core) {
        this.core = core;
    }

    /** Ids de quem saiu de "Criadores em alta" (uma consulta por montagem da tabela, que vai para o cache por geração). */
    Set<UUID> creatorOptOuts() {
        if (core.preferences == null) {
            return Set.of();
        }
        List<UUID> ids = core.preferences.findHypeCreatorOptOutUserIds();
        return ids == null || ids.isEmpty() ? Set.of() : new HashSet<>(ids);
    }

    Map<String, Object> trendingGroups(CurrentUser viewer, RankGroup group, int window, String category, String style, String occasion, int limit) {
        int win = window <= 1 ? 1 : window >= 30 ? 30 : 7;
        int lim = Math.max(1, Math.min(50, limit <= 0 ? 24 : limit));
        String key = "trending-groups:" + group + ":" + win + ":" + norm(category) + ":" + norm(style) + ":" + norm(occasion) + ":" + lim;
        Map<String, Object> ranked = core.cache.get(key, () -> rankGroups(group, win, category, style, occasion, lim));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) ranked.getOrDefault("items", List.of());
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            // criador bloqueado (em qualquer direção) some do ranking de quem vê; a posição dos demais não muda
            if (group == RankGroup.CREATOR && r.get("ownerId") != null
                    && !core.guard.canView(viewer, UUID.fromString(String.valueOf(r.get("ownerId"))), br.com.fashionai.domain.model.enums.Visibility.PUBLIC)) {
                continue;
            }
            items.add(r);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", group.name());
        out.put("window", win);
        out.put("algorithmVersion", core.config.algorithmVersion());
        out.put("minItems", MIN_GROUP_ITEMS);
        // P3-01: o número do grupo é o trend médio na janela "hoje" (crescimento, sem faixa) e o Hype médio nas demais (com faixa)
        out.put("metric", win == 1 ? "TREND" : "HYPE");
        out.put("items", items);
        return out;
    }

    Map<String, Object> rankGroups(RankGroup group, int win, String category, String style, String occasion, int lim) {
        List<Map<String, Object>> ranked = groupRows(group, win, category, style, occasion).stream()
                .filter(m -> Boolean.TRUE.equals(m.get("sufficient"))).toList();
        List<Map<String, Object>> items = new ArrayList<>();
        int rank = 1;
        for (Map<String, Object> m : ranked.subList(0, Math.min(lim, ranked.size()))) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("rank", rank++);
            r.putAll(m);
            items.add(r);
        }
        return Map.of("items", items);
    }

    /**
     * Todos os grupos (marca ou pessoa) com pelo menos um item público elegível no recorte: primeiro os suficientes
     * (≥ {@value HypeQueryService#MIN_GROUP_ITEMS} itens), do maior valor para o menor (empate pela chave), depois os insuficientes — esses
     * sem valor nem faixa ("sem dados" nunca vira 0). A faixa ({@code level}) só existe quando o valor é Hype (janelas 7 e
     * 30); na janela 1 o valor é o trend médio (crescimento), que não tem faixa. A marca com perfil oficial aprovado leva
     * o {@code slug} (link para /brands/{slug}).
     * <p>
     * P3-12: a pessoa que optou por não aparecer em "Criadores em alta" fica fora do agregado de criador — some do ranking
     * (os demais sobem) e, no lote de chips, a chave dela volta sem dados. As peças e looks dela continuam com o próprio
     * Hype (o filtro é só aqui, no agrupamento por pessoa; marcas não mudam).
     */
    List<Map<String, Object>> groupRows(RankGroup group, int win, String category, String style, String occasion) {
        List<HypeEntityType> types = group == RankGroup.BRAND ? List.of(HypeEntityType.PIECE) : List.of(HypeEntityType.PIECE, HypeEntityType.SCHEME);
        record Scored(HypeEntityType type, HypeScoreCurrent c, double value) {
        }
        List<Scored> scored = new ArrayList<>();
        for (HypeEntityType type : types) {
            List<HypeScoreCurrent> pool = core.current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(type, core.config.algorithmVersion(), HypeStatus.AVAILABLE)
                    .stream().filter(c -> c.isPublicEligible() && c.getScore() != null)
                    .filter(c -> blank(category) || category.equalsIgnoreCase(c.getCategory()))
                    .filter(c -> blank(style) || Json.csv(c.getStyles()).contains(style))
                    .filter(c -> blank(occasion) || Json.csv(c.getOccasions()).contains(occasion)).toList();
            Map<UUID, Double> avg = win == 30 ? core.monthAverage(type, pool.stream().map(HypeScoreCurrent::getEntityId).collect(Collectors.toSet())) : Map.of();
            for (HypeScoreCurrent c : pool) {
                double v = win == 1 ? trendOf(c)
                        : win == 30 ? avg.getOrDefault(c.getEntityId(), c.getScore().doubleValue()) : c.getScore().doubleValue();
                scored.add(new Scored(type, c, v));
            }
        }
        Map<UUID, WardrobeItem> pieceById = scored.stream().anyMatch(x -> x.type() == HypeEntityType.PIECE)
                ? core.pieces.findByIdIn(scored.stream().filter(x -> x.type() == HypeEntityType.PIECE).map(x -> x.c().getEntityId()).toList()).stream()
                .collect(Collectors.toMap(WardrobeItem::getId, Function.identity(), (a, b) -> a)) : Map.of();
        Map<UUID, Scheme> schemeById = scored.stream().anyMatch(x -> x.type() == HypeEntityType.SCHEME)
                ? core.schemes.findByIdIn(scored.stream().filter(x -> x.type() == HypeEntityType.SCHEME).map(x -> x.c().getEntityId()).toList()).stream()
                .collect(Collectors.toMap(Scheme::getId, Function.identity(), (a, b) -> a)) : Map.of();
        Map<String, String> slugs = group == RankGroup.BRAND ? officialBrandSlugs() : Map.of();
        Set<UUID> optedOut = group == RankGroup.CREATOR ? creatorOptOuts() : Set.of();

        Map<String, List<Scored>> byKey = new LinkedHashMap<>();
        Map<String, Map<String, Object>> meta = new HashMap<>();
        for (Scored x : scored) {
            String key;
            if (group == RankGroup.BRAND) {
                WardrobeItem w = pieceById.get(x.c().getEntityId());
                String name = w == null ? null : (w.getBrand() != null ? w.getBrand().getName() : w.getBrandName());
                if (blank(name)) {
                    continue;   // peça sem marca não representa marca nenhuma
                }
                key = brandKey(name);
                Map<String, Object> m = meta.computeIfAbsent(key, k -> new LinkedHashMap<>());
                m.putIfAbsent("name", name.trim());
                if (m.get("logoUrl") == null && Views.brandLogo(w) != null) {
                    m.put("logoUrl", Views.brandLogo(w));
                }
                if (slugs.containsKey(key)) {
                    m.putIfAbsent("slug", slugs.get(key));
                }
            } else {
                br.com.fashionai.domain.model.User owner = x.type() == HypeEntityType.PIECE
                        ? Optional.ofNullable(pieceById.get(x.c().getEntityId())).map(WardrobeItem::getUser).orElse(null)
                        : Optional.ofNullable(schemeById.get(x.c().getEntityId())).map(Scheme::getUser).orElse(null);
                if (owner == null || optedOut.contains(owner.getId())) {
                    continue;   // P3-12: quem saiu de "Criadores em alta" não forma agregado (o item segue com o próprio Hype)
                }
                key = owner.getId().toString();
                if (!meta.containsKey(key)) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("ownerId", key);
                    m.put("user", Views.user(owner));
                    meta.put(key, m);
                }
            }
            byKey.computeIfAbsent(key, k -> new ArrayList<>()).add(x);
        }
        Instant now = Instant.now();
        List<Map<String, Object>> ranked = new ArrayList<>();
        List<Map<String, Object>> thin = new ArrayList<>();
        byKey.forEach((key, list) -> {
            boolean sufficient = list.size() >= MIN_GROUP_ITEMS;
            Map<String, Object> m = new LinkedHashMap<>(meta.get(key));
            m.put("key", key);
            if (sufficient) {
                List<Scored> top = list.stream().sorted(Comparator.comparingDouble(Scored::value).reversed()).limit(GROUP_TOP_ITEMS).toList();
                double value = round1(top.stream().mapToDouble(Scored::value).average().orElse(0));
                m.put("value", value);
                m.put("level", win == 1 ? null : core.config.level(value).name());
                Scored best = top.get(0);
                m.put("top", Map.of("type", best.type().name(), "id", best.c().getEntityId().toString(), "hype", core.summary(best.c(), now)));
            } else {
                m.put("value", null);   // um ou dois itens não representam o grupo: sem valor e sem faixa, nunca 0
                m.put("level", null);
            }
            m.put("items", list.size());
            m.put("pieces", list.stream().filter(x -> x.type() == HypeEntityType.PIECE).count());
            m.put("looks", list.stream().filter(x -> x.type() == HypeEntityType.SCHEME).count());
            m.put("sufficient", sufficient);
            (sufficient ? ranked : thin).add(m);
        });
        ranked.sort(Comparator.comparingDouble((Map<String, Object> m) -> ((Number) m.get("value")).doubleValue()).reversed()
                .thenComparing(m -> String.valueOf(m.get("key"))));
        thin.sort(Comparator.comparing(m -> String.valueOf(m.get("key"))));
        List<Map<String, Object>> out = new ArrayList<>(ranked);
        out.addAll(thin);
        return out;
    }

    /** Nome normalizado → slug dos perfis oficiais de marca aprovados (uma consulta; vazio sem o repositório). */
    Map<String, String> officialBrandSlugs() {
        if (core.brandProfiles == null) {
            return Map.of();
        }
        Map<String, String> out = new HashMap<>();
        for (br.com.fashionai.domain.model.BrandProfile b : core.brandProfiles.findByApprovalStatus(ApprovalStatus.APROVADO)) {
            if (!blank(b.getBrandName()) && !blank(b.getSlug())) {
                out.putIfAbsent(brandKey(b.getBrandName()), b.getSlug());
            }
        }
        return out;
    }
}
