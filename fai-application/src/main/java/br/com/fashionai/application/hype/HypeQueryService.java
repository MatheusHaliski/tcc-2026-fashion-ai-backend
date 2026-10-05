package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.HypeScoreSnapshot;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.HypeScoreSnapshotRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;

/**
 * HypeScore v2 — leitura. Nada aqui recalcula: lê o estado gravado pelo {@link HypeSnapshotService} (e o cache por
 * geração). Toda leitura respeita a visibilidade de quem pede; ranking e tendência públicos usam só entidades
 * {@code publicEligible}. A compatibilidade com o DNA de estilo vem SEMPRE num campo separado do Hype.
 */
@Service
public class HypeQueryService {
    public static final int MAX_BATCH = 100;
    /** Peça esquecida: a régua única do app (RoomService.FORGOTTEN_DAYS, também usada pelo Copilot e pelo Meu Quarto). */
    static final int FORGOTTEN_DAYS = br.com.fashionai.application.service.RoomService.FORGOTTEN_DAYS;

    private final HypeScoreConfig config;
    private final HypeScoreCurrentRepository current;
    private final HypeScoreSnapshotRepository snapshots;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final StyleDnaRepository dnas;
    private final Guard guard;
    private final WardrobeService wardrobe;
    private final SchemeService schemeService;
    private final HypeCache cache;

    public HypeQueryService(HypeScoreConfig config, HypeScoreCurrentRepository current, HypeScoreSnapshotRepository snapshots,
                            WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems, StyleDnaRepository dnas,
                            Guard guard, WardrobeService wardrobe, SchemeService schemeService, HypeCache cache) {
        this.config = config;
        this.current = current;
        this.snapshots = snapshots;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dnas = dnas;
        this.guard = guard;
        this.wardrobe = wardrobe;
        this.schemeService = schemeService;
        this.cache = cache;
    }

    // ================================================================== visibilidade
    boolean canView(CurrentUser viewer, WardrobeItem w) {
        boolean owner = viewer != null && viewer.id().equals(w.getUser().getId());
        if (owner) {
            return true;
        }
        return w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED && w.getModerationStatus() == ModerationStatus.APPROVED
                && guard.canView(viewer, w.getUser().getId(), WardrobeService.effectiveVisibility(w));
    }

    boolean canView(CurrentUser viewer, Scheme s) {
        return schemeService.canView(viewer, s);
    }

    /** Ids visíveis para quem pede (os demais somem da resposta, como se não existissem). */
    Set<UUID> visible(CurrentUser viewer, HypeEntityType type, Collection<UUID> ids) {
        if (type == HypeEntityType.PIECE) {
            return pieces.findByIdIn(ids).stream().filter(w -> canView(viewer, w)).map(WardrobeItem::getId).collect(Collectors.toSet());
        }
        return schemes.findByIdIn(ids).stream().filter(s -> canView(viewer, s)).map(Scheme::getId).collect(Collectors.toSet());
    }

    // ================================================================== leitura em lote (cards)
    @Transactional(readOnly = true)
    public Map<String, Object> summaries(CurrentUser viewer, HypeEntityType type, List<UUID> ids) {
        List<UUID> wanted = ids == null ? List.of() : ids.stream().filter(Objects::nonNull).distinct().limit(MAX_BATCH).toList();
        Map<String, Object> items = new LinkedHashMap<>();
        if (!wanted.isEmpty()) {
            Set<UUID> ok = visible(viewer, type, wanted);
            Map<UUID, HypeScoreCurrent> rows = current.findByEntityTypeAndEntityIdInAndAlgorithmVersion(type, ok, config.algorithmVersion()).stream()
                    .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a));
            Instant now = Instant.now();
            for (UUID id : wanted) {
                if (ok.contains(id)) {
                    items.put(id.toString(), summary(rows.get(id), now));
                }
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type.name());
        out.put("algorithmVersion", config.algorithmVersion());
        out.put("deltaWindowDays", config.deltaWindowDays());
        out.put("items", items);
        return out;
    }

    /** Resumo do card (frente: score + seta; verso: dimensões). Sem linha = NOT_CALCULATED; linha antiga = stale. */
    Map<String, Object> summary(HypeScoreCurrent c, Instant now) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (c == null) {
            m.put("status", "NOT_CALCULATED");
            return m;
        }
        m.put("status", c.getStatus().name());
        m.put("stale", c.getCalculatedAt().isBefore(now.minus(config.staleAfterHours(), ChronoUnit.HOURS)));
        m.put("score", num(c.getScore()));
        m.put("level", c.getLevel() == null ? null : c.getLevel().name());
        m.put("direction", c.getDirection());
        m.put("deltaPoints", num(c.getDeltaPoints()));
        m.put("deltaPercent", num(c.getDeltaPercent()));
        m.put("momentum", c.getMomentum() == null ? null : c.getMomentum().name());
        m.put("dimensions", dimensions(c.getDimensions()));
        m.put("calculatedAt", c.getCalculatedAt().toString());
        m.put("algorithmVersion", c.getAlgorithmVersion());
        return m;
    }

    static Map<String, Object> dimensions(HypeDimensions d) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (d == null) {
            return m;
        }
        put(m, "POPULARITY", d.getPopularity());
        put(m, "ENGAGEMENT", d.getEngagement());
        put(m, "TREND", d.getTrend());
        put(m, "TREND_VELOCITY", d.getTrendVelocity());
        put(m, "ORIGINALITY", d.getOriginality());
        put(m, "RARITY", d.getRarity());
        put(m, "LONGEVITY", d.getLongevity());
        put(m, "NOVELTY", d.getNovelty());
        put(m, "INFLUENCE", d.getInfluence());
        return m;
    }

    private static void put(Map<String, Object> m, String k, BigDecimal v) {
        if (v != null) {
            m.put(k, num(v));
        }
    }

    static Double num(BigDecimal v) {
        return v == null ? null : Math.round(v.doubleValue() * 10) / 10.0;
    }

    // ================================================================== detalhe (análise completa)
    @Transactional(readOnly = true)
    public Map<String, Object> detail(CurrentUser viewer, HypeEntityType type, UUID id) {
        StyleCompatibility.Profile item;
        List<SchemeItem> lookItems = List.of();
        long inLooks = 0;
        if (type == HypeEntityType.PIECE) {
            WardrobeItem w = pieces.findById(id).filter(x -> canView(viewer, x)).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            item = profileOf(w);
            inLooks = schemeItems.countByWardrobeItemId(id);
        } else {
            Scheme s = schemes.findById(id).filter(x -> canView(viewer, x)).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
            lookItems = schemeItems.findBySchemeIdOrderBySortOrder(id);
            item = profileOf(s, lookItems);
        }
        Optional<HypeScoreCurrent> row = current.findByEntityTypeAndEntityIdAndAlgorithmVersion(type, id, config.algorithmVersion());
        Map<String, Object> out = new LinkedHashMap<>(summary(row.orElse(null), Instant.now()));
        out.put("entityType", type.name());
        out.put("entityId", id.toString());
        out.put("reasons", row.map(r -> Json.list(r.getReasonsJson())).orElse(List.of()));
        out.put("signals", row.map(r -> Json.map(r.getSignalsJson())).orElse(Map.of()));
        out.put("publicEligible", row.map(HypeScoreCurrent::isPublicEligible).orElse(false));
        out.put("weights", config.describe().get("weights") instanceof Map<?, ?> w ? w.get(type.name()) : null);
        // compatibilidade PESSOAL — separada do Hype (nunca entra no score)
        out.put("compatibility", viewer == null ? null : dnas.findByUserId(viewer.id()).map(d -> StyleCompatibility.score(profileOf(d), item)).orElse(null));
        if (type == HypeEntityType.PIECE) {
            out.put("inLooks", inLooks);   // em quantos looks a peça aparece (sinal de uso "peça em look")
        } else {
            out.put("pieces", lookPieces(viewer, lookItems));   // o Hype do look ao lado do Hype de cada peça dele
        }
        return out;
    }

    /** Peças de um look com o Hype de cada uma (só as que quem vê pode ver), na ordem do look. */
    List<Map<String, Object>> lookPieces(CurrentUser viewer, List<SchemeItem> items) {
        if (items.isEmpty()) {
            return List.of();
        }
        List<WardrobeItem> visible = items.stream().map(SchemeItem::getWardrobeItem).filter(Objects::nonNull).filter(w -> canView(viewer, w)).toList();
        Map<UUID, HypeScoreCurrent> hype = currentOf(HypeEntityType.PIECE, visible.stream().map(WardrobeItem::getId).toList());
        Instant now = Instant.now();
        List<Map<String, Object>> out = new ArrayList<>();
        for (WardrobeItem w : visible) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", w.getId().toString());
            m.put("name", w.getName());
            m.put("category", w.getCategory());
            m.put("subcategory", w.getSubcategory());
            m.put("imageUrl", w.getStudioImageUrl() != null ? Views.studioThumb(w.getStudioImageUrl()) : w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl());
            m.put("hype", summary(hype.get(w.getId()), now));
            out.add(m);
        }
        return out;
    }

    public static StyleCompatibility.Profile profileOf(StyleDna d) {
        return StyleCompatibility.profile(Json.csv(d.getStyleKeywords()), Json.csv(d.getColorPalette()), Json.csv(d.getOccasionKeywords()));
    }

    public static StyleCompatibility.Profile profileOf(WardrobeItem w) {
        return StyleCompatibility.profile(Json.csv(w.getStyleTags()), colorsOf(w), Json.csv(w.getOccasionTags()));
    }

    public static StyleCompatibility.Profile profileOf(Scheme s, List<SchemeItem> items) {
        Set<String> styles = new LinkedHashSet<>(Json.csv(s.getStyle()));
        Set<String> colors = new LinkedHashSet<>();
        items.forEach(si -> {
            styles.addAll(Json.csv(si.getWardrobeItem().getStyleTags()));
            colors.addAll(colorsOf(si.getWardrobeItem()));
        });
        return StyleCompatibility.profile(styles, colors, Json.csv(s.getOccasion()));
    }

    public static List<String> colorsOf(WardrobeItem w) {
        List<String> out = new ArrayList<>();
        if (w.getColor() != null) {
            out.add(w.getColor());
            String family = Taxonomy.COLOR_FAMILY.get(w.getColor());
            if (family != null) {
                out.add(family);
            }
        }
        return out;
    }

    // ================================================================== histórico
    @Transactional(readOnly = true)
    public Map<String, Object> history(CurrentUser viewer, HypeEntityType type, UUID id, int days) {
        boolean ok = type == HypeEntityType.PIECE ? pieces.findById(id).filter(w -> canView(viewer, w)).isPresent()
                : schemes.findById(id).filter(s -> canView(viewer, s)).isPresent();
        if (!ok) {
            throw ApiException.notFound(type == HypeEntityType.PIECE ? Msg.t("common.peca") : Msg.t("entity.esquema"));
        }
        int span = Math.max(7, Math.min(config.historyMaxDays(), days));
        LocalDate since = LocalDate.now(HypeSignalRecorder.ZONE).minusDays(span - 1L);
        List<Map<String, Object>> points = snapshots.findByEntityTypeAndEntityIdAndAlgorithmVersionAndSnapshotDateGreaterThanEqualOrderBySnapshotDateAsc(
                type, id, config.algorithmVersion(), since).stream().map(HypeQueryService::point).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("entityType", type.name());
        out.put("entityId", id.toString());
        out.put("algorithmVersion", config.algorithmVersion());
        out.put("days", span);
        out.put("points", points);
        return out;
    }

    static Map<String, Object> point(HypeScoreSnapshot s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("date", s.getSnapshotDate().toString());
        m.put("status", s.getStatus().name());
        m.put("score", num(s.getScore()));
        m.put("level", s.getLevel() == null ? null : s.getLevel().name());
        m.put("dimensions", dimensions(s.getDimensions()));
        return m;
    }

    // ================================================================== ranking (Descobrir → Em alta)
    /**
     * Ranking com recortes obrigatórios: janela (1 = hoje, pelo trend; 7 = HypeScore atual; 30 = média dos snapshots do
     * mês), tipo, categoria, estilo e ocasião. Só entra o que é público e tem score disponível.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> trending(CurrentUser viewer, HypeEntityType type, int window, String category, String style, String occasion, int limit) {
        int win = window <= 1 ? 1 : window >= 30 ? 30 : 7;
        int lim = Math.max(1, Math.min(50, limit <= 0 ? 24 : limit));
        String key = "trending:" + type + ":" + win + ":" + norm(category) + ":" + norm(style) + ":" + norm(occasion) + ":" + lim;
        Map<String, Object> ranked = cache.get(key, () -> rank(type, win, category, style, occasion, lim));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) ranked.getOrDefault("items", List.of());
        List<UUID> ids = rows.stream().map(r -> UUID.fromString(String.valueOf(r.get("id")))).toList();
        Map<UUID, Object> views = views(viewer, type, ids);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Object view = views.get(UUID.fromString(String.valueOf(r.get("id"))));
            if (view == null) {
                continue;   // bloqueio entre as contas ou mudou de visibilidade depois do cálculo
            }
            Map<String, Object> m = new LinkedHashMap<>(r);
            m.put(type == HypeEntityType.PIECE ? "piece" : "scheme", view);
            items.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type.name());
        out.put("window", win);
        out.put("algorithmVersion", config.algorithmVersion());
        out.put("items", items);
        return out;
    }

    Map<String, Object> rank(HypeEntityType type, int win, String category, String style, String occasion, int lim) {
        List<HypeScoreCurrent> pool = current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(type, config.algorithmVersion(), HypeStatus.AVAILABLE)
                .stream().filter(c -> blank(category) || category.equalsIgnoreCase(c.getCategory()))
                .filter(c -> blank(style) || Json.csv(c.getStyles()).contains(style))
                .filter(c -> blank(occasion) || Json.csv(c.getOccasions()).contains(occasion)).toList();
        ToDoubleFunction<HypeScoreCurrent> metric;
        if (win == 1) {
            metric = c -> (c.getDimensions().getTrend() == null ? 0 : c.getDimensions().getTrend().doubleValue()) * 1000 + c.getScore().doubleValue();
        } else if (win == 30) {
            Map<UUID, Double> avg = monthAverage(type, pool.stream().map(HypeScoreCurrent::getEntityId).collect(Collectors.toSet()));
            metric = c -> avg.getOrDefault(c.getEntityId(), c.getScore().doubleValue());
        } else {
            metric = c -> c.getScore().doubleValue();
        }
        List<HypeScoreCurrent> top = pool.stream().sorted(Comparator.comparingDouble(metric).reversed()).limit(lim).toList();
        Instant now = Instant.now();
        List<Map<String, Object>> items = new ArrayList<>();
        int rank = 1;
        for (HypeScoreCurrent c : top) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("rank", rank++);
            m.put("id", c.getEntityId().toString());
            m.put("hype", summary(c, now));
            items.add(m);
        }
        return Map.of("items", items);
    }

    // ================================================================== ranking agregado: marcas e criadores em alta
    /** Recortes agregados do "Em alta": a unidade é a marca (peças) ou a pessoa criadora (peças + looks). */
    public enum RankGroup {
        BRAND, CREATOR;

        public static RankGroup parse(String raw) {
            String t = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
            return switch (t) {
                case "BRAND", "BRANDS", "MARCA", "MARCAS" -> BRAND;
                case "CREATOR", "CREATORS", "CRIADOR", "CRIADORES", "USER", "USERS" -> CREATOR;
                default -> null;
            };
        }
    }

    /** Itens públicos mínimos para uma marca/pessoa entrar no ranking (um item viral sozinho não representa o grupo). */
    static final int MIN_GROUP_ITEMS = 3;
    /** O valor do grupo é a média dos seus N itens mais relevantes (constância, não um pico isolado). */
    static final int GROUP_TOP_ITEMS = 5;

    public Map<String, Object> trendingGroups(CurrentUser viewer, RankGroup group, int window, String category, String style, String occasion, int limit) {
        int win = window <= 1 ? 1 : window >= 30 ? 30 : 7;
        int lim = Math.max(1, Math.min(50, limit <= 0 ? 24 : limit));
        String key = "trending-groups:" + group + ":" + win + ":" + norm(category) + ":" + norm(style) + ":" + norm(occasion) + ":" + lim;
        Map<String, Object> ranked = cache.get(key, () -> rankGroups(group, win, category, style, occasion, lim));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) ranked.getOrDefault("items", List.of());
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            // criador bloqueado (em qualquer direção) some do ranking de quem vê; a posição dos demais não muda
            if (group == RankGroup.CREATOR && r.get("ownerId") != null
                    && !guard.canView(viewer, UUID.fromString(String.valueOf(r.get("ownerId"))), br.com.fashionai.domain.model.enums.Visibility.PUBLIC)) {
                continue;
            }
            items.add(r);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", group.name());
        out.put("window", win);
        out.put("algorithmVersion", config.algorithmVersion());
        out.put("minItems", MIN_GROUP_ITEMS);
        out.put("items", items);
        return out;
    }

    Map<String, Object> rankGroups(RankGroup group, int win, String category, String style, String occasion, int lim) {
        List<HypeEntityType> types = group == RankGroup.BRAND ? List.of(HypeEntityType.PIECE) : List.of(HypeEntityType.PIECE, HypeEntityType.SCHEME);
        record Scored(HypeEntityType type, HypeScoreCurrent c, double value) {
        }
        List<Scored> scored = new ArrayList<>();
        for (HypeEntityType type : types) {
            List<HypeScoreCurrent> pool = current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(type, config.algorithmVersion(), HypeStatus.AVAILABLE)
                    .stream().filter(c -> blank(category) || category.equalsIgnoreCase(c.getCategory()))
                    .filter(c -> blank(style) || Json.csv(c.getStyles()).contains(style))
                    .filter(c -> blank(occasion) || Json.csv(c.getOccasions()).contains(occasion)).toList();
            Map<UUID, Double> avg = win == 30 ? monthAverage(type, pool.stream().map(HypeScoreCurrent::getEntityId).collect(Collectors.toSet())) : Map.of();
            for (HypeScoreCurrent c : pool) {
                double v = win == 1 ? (c.getDimensions().getTrend() == null ? 0 : c.getDimensions().getTrend().doubleValue())
                        : win == 30 ? avg.getOrDefault(c.getEntityId(), c.getScore().doubleValue()) : c.getScore().doubleValue();
                scored.add(new Scored(type, c, v));
            }
        }
        Map<UUID, WardrobeItem> pieceById = scored.stream().anyMatch(x -> x.type() == HypeEntityType.PIECE)
                ? pieces.findByIdIn(scored.stream().filter(x -> x.type() == HypeEntityType.PIECE).map(x -> x.c().getEntityId()).toList()).stream()
                .collect(Collectors.toMap(WardrobeItem::getId, Function.identity(), (a, b) -> a)) : Map.of();
        Map<UUID, Scheme> schemeById = scored.stream().anyMatch(x -> x.type() == HypeEntityType.SCHEME)
                ? schemes.findByIdIn(scored.stream().filter(x -> x.type() == HypeEntityType.SCHEME).map(x -> x.c().getEntityId()).toList()).stream()
                .collect(Collectors.toMap(Scheme::getId, Function.identity(), (a, b) -> a)) : Map.of();

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
                key = name.trim().toLowerCase(Locale.ROOT);
                Map<String, Object> m = meta.computeIfAbsent(key, k -> new LinkedHashMap<>());
                m.putIfAbsent("name", name.trim());
                if (m.get("logoUrl") == null && Views.brandLogo(w) != null) {
                    m.put("logoUrl", Views.brandLogo(w));
                }
            } else {
                br.com.fashionai.domain.model.User owner = x.type() == HypeEntityType.PIECE
                        ? Optional.ofNullable(pieceById.get(x.c().getEntityId())).map(WardrobeItem::getUser).orElse(null)
                        : Optional.ofNullable(schemeById.get(x.c().getEntityId())).map(Scheme::getUser).orElse(null);
                if (owner == null) {
                    continue;
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
        List<Map<String, Object>> rows = new ArrayList<>();
        byKey.forEach((key, list) -> {
            if (list.size() < MIN_GROUP_ITEMS) {
                return;
            }
            List<Scored> top = list.stream().sorted(Comparator.comparingDouble(Scored::value).reversed()).limit(GROUP_TOP_ITEMS).toList();
            Map<String, Object> m = new LinkedHashMap<>(meta.get(key));
            m.put("key", key);
            m.put("value", round1(top.stream().mapToDouble(Scored::value).average().orElse(0)));
            m.put("items", list.size());
            m.put("pieces", list.stream().filter(x -> x.type() == HypeEntityType.PIECE).count());
            m.put("looks", list.stream().filter(x -> x.type() == HypeEntityType.SCHEME).count());
            Scored best = top.get(0);
            m.put("top", Map.of("type", best.type().name(), "id", best.c().getEntityId().toString(), "hype", summary(best.c(), now)));
            rows.add(m);
        });
        rows.sort(Comparator.comparingDouble((Map<String, Object> m) -> ((Number) m.get("value")).doubleValue()).reversed()
                .thenComparing(m -> String.valueOf(m.get("key"))));
        List<Map<String, Object>> items = new ArrayList<>();
        int rank = 1;
        for (Map<String, Object> m : rows.subList(0, Math.min(lim, rows.size()))) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("rank", rank++);
            r.putAll(m);
            items.add(r);
        }
        return Map.of("items", items);
    }

    Map<UUID, Double> monthAverage(HypeEntityType type, Set<UUID> ids) {
        LocalDate today = LocalDate.now(HypeSignalRecorder.ZONE);
        Map<UUID, double[]> acc = new HashMap<>();
        for (HypeScoreSnapshot s : snapshots.findByEntityTypeAndAlgorithmVersionAndSnapshotDateBetween(type, config.algorithmVersion(), today.minusDays(29), today)) {
            if (s.getScore() != null && ids.contains(s.getEntityId())) {
                double[] a = acc.computeIfAbsent(s.getEntityId(), k -> new double[2]);
                a[0] += s.getScore().doubleValue();
                a[1]++;
            }
        }
        Map<UUID, Double> out = new HashMap<>();
        acc.forEach((id, a) -> out.put(id, a[0] / a[1]));
        return out;
    }

    /** Views completas (com o estado de quem vê) só das entidades visíveis. */
    Map<UUID, Object> views(CurrentUser viewer, HypeEntityType type, List<UUID> ids) {
        Map<UUID, Object> out = new HashMap<>();
        if (ids.isEmpty()) {
            return out;
        }
        if (type == HypeEntityType.PIECE) {
            pieces.findByIdIn(ids).stream().filter(w -> canView(viewer, w)).forEach(w -> out.put(w.getId(), Views.piece(w, wardrobe.viewerState(viewer, w), null)));
        } else {
            List<Scheme> list = schemes.findByIdIn(ids).stream().filter(s -> canView(viewer, s)).toList();
            Map<UUID, List<SchemeItem>> items = list.isEmpty() ? Map.of() : schemeItems.findBySchemeIdIn(list.stream().map(Scheme::getId).toList()).stream()
                    .sorted(Comparator.comparingInt(SchemeItem::getSortOrder)).collect(Collectors.groupingBy(si -> si.getScheme().getId()));
            list.forEach(s -> out.put(s.getId(), schemeService.view(viewer, s, items.getOrDefault(s.getId(), List.of()))));
        }
        return out;
    }

    // ================================================================== painel pessoal (Perfil → Insights, Histórico → Hype)
    record Owned(List<WardrobeItem> pieces, List<Scheme> schemes, Map<UUID, HypeScoreCurrent> pieceHype, Map<UUID, HypeScoreCurrent> schemeHype) {
    }

    Owned owned(UUID userId) {
        List<WardrobeItem> ps = pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
        List<Scheme> ss = schemes.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(s -> s.getStatus() != br.com.fashionai.domain.model.enums.SchemeStatus.ARCHIVED).toList();
        Map<UUID, HypeScoreCurrent> ph = current.findByOwnerIdAndEntityTypeAndAlgorithmVersion(userId, HypeEntityType.PIECE, config.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a));
        Map<UUID, HypeScoreCurrent> sh = current.findByOwnerIdAndEntityTypeAndAlgorithmVersion(userId, HypeEntityType.SCHEME, config.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a));
        return new Owned(ps, ss, ph, sh);
    }

    /** Dias sem uso: último uso registrado (ou o cadastro, se nunca foi usada). */
    public static long idleDays(WardrobeItem w, LocalDate today) {
        LocalDate ref = w.getLastWornDate() != null ? w.getLastWornDate()
                : w.getCreatedAt() == null ? today : w.getCreatedAt().atZone(HypeSignalRecorder.ZONE).toLocalDate();
        return Math.max(0, ChronoUnit.DAYS.between(ref, today));
    }

    /**
     * Dashboard do guarda-roupa: Hype médio (e a variação), peça em destaque, maior crescimento, clássica, rara, esquecida,
     * look com maior Hype e look mais remixado. Nunca compara com outras pessoas.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> wardrobe(CurrentUser user) {
        Owned o = owned(user.id());
        LocalDate today = LocalDate.now(HypeSignalRecorder.ZONE);
        Instant now = Instant.now();
        Map<UUID, WardrobeItem> pById = o.pieces().stream().collect(Collectors.toMap(WardrobeItem::getId, Function.identity()));
        Map<UUID, Scheme> sById = o.schemes().stream().collect(Collectors.toMap(Scheme::getId, Function.identity()));
        List<HypeScoreCurrent> pAvail = o.pieceHype().values().stream().filter(c -> c.getStatus() == HypeStatus.AVAILABLE && pById.containsKey(c.getEntityId())).toList();
        List<HypeScoreCurrent> sAvail = o.schemeHype().values().stream().filter(c -> c.getStatus() == HypeStatus.AVAILABLE && sById.containsKey(c.getEntityId())).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("algorithmVersion", config.algorithmVersion());
        out.put("deltaWindowDays", config.deltaWindowDays());
        out.put("pieces", o.pieces().size());
        out.put("piecesWithHype", pAvail.size());
        out.put("looks", o.schemes().size());
        out.put("averageHype", pAvail.isEmpty() ? null : round1(pAvail.stream().mapToDouble(c -> c.getScore().doubleValue()).average().orElse(0)));
        List<HypeScoreCurrent> withDelta = pAvail.stream().filter(c -> c.getDeltaPoints() != null).toList();
        out.put("averageDeltaPoints", withDelta.isEmpty() ? null : round1(withDelta.stream().mapToDouble(c -> c.getDeltaPoints().doubleValue()).average().orElse(0)));
        out.put("calculatedAt", pAvail.stream().map(HypeScoreCurrent::getCalculatedAt).max(Comparator.naturalOrder()).map(Instant::toString).orElse(null));

        Map<String, Object> highlights = new LinkedHashMap<>();
        pAvail.stream().max(Comparator.comparing(HypeScoreCurrent::getScore))
                .ifPresent(c -> highlights.put("topPiece", pieceCard(user, pById.get(c.getEntityId()), c, now, "score", num(c.getScore()))));
        pAvail.stream().filter(c -> c.getDeltaPoints() != null && c.getDeltaPoints().signum() > 0).max(Comparator.comparing(HypeScoreCurrent::getDeltaPoints))
                .or(() -> pAvail.stream().filter(c -> c.getDimensions().getTrend() != null && c.getDimensions().getTrend().doubleValue() >= 60)
                        .max(Comparator.comparing(c -> c.getDimensions().getTrend())))
                .ifPresent(c -> highlights.put("biggestGrowth", pieceCard(user, pById.get(c.getEntityId()), c, now, "deltaPoints", num(c.getDeltaPoints()))));
        pAvail.stream().filter(c -> c.getMomentum() == HypeMomentum.CLASSIC || (c.getDimensions().getLongevity() != null && c.getDimensions().getLongevity().doubleValue() >= 60))
                .max(Comparator.comparing(c -> c.getDimensions().getLongevity() == null ? BigDecimal.ZERO : c.getDimensions().getLongevity()))
                .ifPresent(c -> highlights.put("classic", pieceCard(user, pById.get(c.getEntityId()), c, now, "longevity", num(c.getDimensions().getLongevity()))));
        o.pieceHype().values().stream().filter(c -> pById.containsKey(c.getEntityId()) && c.getDimensions().getRarity() != null && c.getDimensions().getRarity().doubleValue() >= 50)
                .max(Comparator.comparing(c -> c.getDimensions().getRarity()))
                .ifPresent(c -> highlights.put("rare", pieceCard(user, pById.get(c.getEntityId()), c, now, "rarity", num(c.getDimensions().getRarity()))));
        o.pieces().stream().filter(w -> w.isDisponivel() && idleDays(w, today) >= FORGOTTEN_DAYS).max(Comparator.comparingLong(w -> idleDays(w, today)))
                .ifPresent(w -> highlights.put("forgotten", pieceCard(user, w, o.pieceHype().get(w.getId()), now, "idleDays", (double) idleDays(w, today))));
        sAvail.stream().max(Comparator.comparing(HypeScoreCurrent::getScore))
                .ifPresent(c -> highlights.put("topLook", lookCard(user, sById.get(c.getEntityId()), c, now, "score", num(c.getScore()))));
        o.schemes().stream().filter(s -> s.getRemixCount() > 0).max(Comparator.comparingLong(Scheme::getRemixCount))
                .ifPresent(s -> highlights.put("mostRemixed", lookCard(user, s, o.schemeHype().get(s.getId()), now, "remixes", (double) s.getRemixCount())));
        out.put("highlights", highlights);
        out.put("rediscoveries", rediscoveries(user, o, today, now, 3));
        return out;
    }

    /**
     * Redescoberta: peça parada há {@value #FORGOTTEN_DAYS}+ dias cujas semelhantes cresceram (ou cujo trend voltou a
     * subir). Conecta Hype à reutilização do guarda-roupa: "127 dias sem uso, mas peças semelhantes cresceram 31%".
     */
    List<Map<String, Object>> rediscoveries(CurrentUser user, Owned o, LocalDate today, Instant now, int limit) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (WardrobeItem w : o.pieces()) {
            long idle = idleDays(w, today);
            HypeScoreCurrent c = o.pieceHype().get(w.getId());
            if (!w.isDisponivel() || idle < FORGOTTEN_DAYS || c == null) {
                continue;
            }
            Map<String, Object> sig = Json.map(c.getSignalsJson());
            Double similar = sig != null && sig.get("similarGrowthPercent") instanceof Number n ? n.doubleValue() : null;
            double trend = c.getDimensions().getTrend() == null ? 0 : c.getDimensions().getTrend().doubleValue();
            if ((similar != null && similar >= 15) || trend >= 60) {
                Map<String, Object> m = pieceCard(user, w, c, now, "idleDays", (double) idle);
                m.put("idleDays", idle);
                m.put("similarGrowthPercent", similar == null ? null : Math.round(similar));
                m.put("trend", Math.round(trend));
                out.add(m);
            }
        }
        out.sort(Comparator.comparing((Map<String, Object> m) -> -(m.get("similarGrowthPercent") instanceof Number n ? n.doubleValue() : 0)));
        return out.size() > limit ? out.subList(0, limit) : out;
    }

    /** Histórico → Hype: evolução do Hype médio, quem subiu, quem caiu, novas tendências, redescobertas e looks emergentes. */
    @Transactional(readOnly = true)
    public Map<String, Object> movers(CurrentUser user, int days) {
        Owned o = owned(user.id());
        LocalDate today = LocalDate.now(HypeSignalRecorder.ZONE);
        Instant now = Instant.now();
        int span = Math.max(14, Math.min(config.historyMaxDays(), days));
        Map<UUID, WardrobeItem> pById = o.pieces().stream().collect(Collectors.toMap(WardrobeItem::getId, Function.identity()));
        Map<UUID, Scheme> sById = o.schemes().stream().collect(Collectors.toMap(Scheme::getId, Function.identity()));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("algorithmVersion", config.algorithmVersion());
        out.put("deltaWindowDays", config.deltaWindowDays());
        out.put("days", span);
        out.put("series", Map.of("pieces", averageSeries(HypeEntityType.PIECE, pById.keySet(), today.minusDays(span - 1L)),
                "looks", averageSeries(HypeEntityType.SCHEME, sById.keySet(), today.minusDays(span - 1L))));

        List<Map<String, Object>> moved = new ArrayList<>();
        o.pieceHype().values().stream().filter(c -> isMoving(c) && pById.containsKey(c.getEntityId()))
                .forEach(c -> moved.add(pieceCard(user, pById.get(c.getEntityId()), c, now, "deltaPoints", num(c.getDeltaPoints()))));
        o.schemeHype().values().stream().filter(c -> isMoving(c) && sById.containsKey(c.getEntityId()))
                .forEach(c -> moved.add(lookCard(user, sById.get(c.getEntityId()), c, now, "deltaPoints", num(c.getDeltaPoints()))));
        out.put("risers", moved.stream().filter(m -> value(m) > 0).sorted(Comparator.comparingDouble(m -> -value(m))).limit(5).toList());
        out.put("fallers", moved.stream().filter(m -> value(m) < 0).sorted(Comparator.comparingDouble(HypeQueryService::value)).limit(5).toList());
        out.put("rediscoveries", rediscoveries(user, o, today, now, 6));
        out.put("emergingLooks", o.schemeHype().values().stream().filter(c -> sById.containsKey(c.getEntityId())
                        && (c.getMomentum() == HypeMomentum.EMERGING || c.getMomentum() == HypeMomentum.RISING))
                .sorted(Comparator.comparing((HypeScoreCurrent c) -> c.getDimensions().getTrend() == null ? BigDecimal.ZERO : c.getDimensions().getTrend()).reversed())
                .limit(4).map(c -> lookCard(user, sById.get(c.getEntityId()), c, now, "trend", num(c.getDimensions().getTrend()))).toList());
        // novas tendências: o que emerge na rede (só público), por categoria — contexto, não recomendação
        out.put("newTrends", current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE, config.algorithmVersion(), HypeStatus.AVAILABLE)
                .stream().filter(c -> c.getMomentum() == HypeMomentum.EMERGING && c.getCategory() != null)
                .collect(Collectors.groupingBy(HypeScoreCurrent::getCategory, TreeMap::new, Collectors.counting()))
                .entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(6)
                .map(e -> Map.<String, Object>of("category", e.getKey(), "emerging", e.getValue())).toList());
        return out;
    }

    /** Subiu/caiu = direção calculada (fora da faixa "estável"), não o sinal do delta: −1,9 pts é estável, não queda. */
    static boolean isMoving(HypeScoreCurrent c) {
        return c.getDeltaPoints() != null && ("UP".equals(c.getDirection()) || "DOWN".equals(c.getDirection()));
    }

    static double value(Map<String, Object> m) {
        return m.get("value") instanceof Number n ? n.doubleValue() : 0;
    }

    List<Map<String, Object>> averageSeries(HypeEntityType type, Set<UUID> ids, LocalDate since) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<LocalDate, double[]> acc = new TreeMap<>();
        for (HypeScoreSnapshot s : snapshots.findByEntityTypeAndEntityIdInAndAlgorithmVersionAndSnapshotDateGreaterThanEqual(type, ids, config.algorithmVersion(), since)) {
            if (s.getScore() != null) {
                double[] a = acc.computeIfAbsent(s.getSnapshotDate(), k -> new double[2]);
                a[0] += s.getScore().doubleValue();
                a[1]++;
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        acc.forEach((d, a) -> out.add(Map.of("date", d.toString(), "average", round1(a[0] / a[1]), "n", (int) a[1])));
        return out;
    }

    Map<String, Object> pieceCard(CurrentUser viewer, WardrobeItem w, HypeScoreCurrent c, Instant now, String metric, Double value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", HypeEntityType.PIECE.name());
        m.put("id", w.getId().toString());
        m.put("metric", metric);
        m.put("value", value);
        m.put("hype", summary(c, now));
        m.put("piece", Views.piece(w, wardrobe.viewerState(viewer, w), null));
        return m;
    }

    Map<String, Object> lookCard(CurrentUser viewer, Scheme s, HypeScoreCurrent c, Instant now, String metric, Double value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", HypeEntityType.SCHEME.name());
        m.put("id", s.getId().toString());
        m.put("metric", metric);
        m.put("value", value);
        m.put("hype", summary(c, now));
        m.put("scheme", schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId())));
        return m;
    }

    // ================================================================== ranking por região (Explorador → Ranking de HypeScore)
    /*
     * Ranking de HypeScore com recortes: TIPO (peça/look) e JANELA mudam o contexto; região do mundo, país, categoria e
     * subcategoria são filtros. A peça entra pela própria categoria/subcategoria; o look entra pelas das peças que o
     * compõem ("um look que tem calçado"). Só a população pública elegível com score disponível — item privado nunca
     * entra. A métrica de cada janela é a mesma do rank() (1 = trend, 7 = score, 30 = média dos snapshots do mês), com
     * desempate estável pelo id. As posições são fatos públicos: quem vê não muda a numeração — item bloqueado (ou que
     * deixou de ser visível) só some da página. Quem não informou o país fica em "Outras regiões" (WorldRegions.of(null)).
     */
    public static final int RANKING_MAX_SIZE = 48;
    static final String NO_REGION = "OUTRAS";
    /** Janela das posições do item (análise completa): o HypeScore atual. */
    static final int POSITIONS_WINDOW = 7;

    @Transactional(readOnly = true)
    public Map<String, Object> ranking(CurrentUser viewer, HypeEntityType type, int window, String region, String country, String category,
                                       String subcategory, int page, int size) {
        int win = window <= 1 ? 1 : window >= 30 ? 30 : 7;
        int sz = Math.max(1, Math.min(RANKING_MAX_SIZE, size <= 0 ? 24 : size));
        int pg = Math.max(0, page);
        String r = upper(region);
        String co = upper(country);
        String cat = norm(category);
        String sub = norm(subcategory);
        String key = "ranking:" + type + ":" + win + ":" + r + ":" + co + ":" + cat + ":" + sub;
        Map<String, Object> ranked = cache.get(key, () -> rankRegional(type, win, r, co, cat, sub));
        List<String> ids = ranked.get("ids") instanceof List<?> li ? li.stream().map(String::valueOf).toList() : List.of();
        List<?> values = ranked.get("values") instanceof List<?> lv ? lv : List.of();
        int total = ids.size();
        int from = (int) Math.min((long) pg * sz, total);
        int to = Math.min(from + sz, total);
        List<UUID> pageIds = ids.subList(from, to).stream().map(UUID::fromString).toList();
        Map<UUID, HypeScoreCurrent> rows = currentOf(type, pageIds);
        Map<UUID, Object> views = new HashMap<>();
        Map<UUID, List<Map<String, Object>>> lookPieces = new HashMap<>();
        if (type == HypeEntityType.PIECE) {
            views.putAll(views(viewer, type, pageIds));
        } else if (!pageIds.isEmpty()) {
            List<Scheme> list = schemes.findByIdIn(pageIds).stream().filter(s -> canView(viewer, s)).toList();
            Map<UUID, List<SchemeItem>> itemsBy = list.isEmpty() ? Map.of() : schemeItems.findBySchemeIdIn(list.stream().map(Scheme::getId).toList()).stream()
                    .sorted(Comparator.comparingInt(SchemeItem::getSortOrder)).collect(Collectors.groupingBy(si -> si.getScheme().getId()));
            for (Scheme s : list) {
                List<SchemeItem> items = itemsBy.getOrDefault(s.getId(), List.of());
                views.put(s.getId(), schemeService.view(viewer, s, items));
                lookPieces.put(s.getId(), lookPieces(viewer, items));   // o Hype do look pelas peças dentro dele
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
            m.put("hype", summary(c, now));
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
        out.put("algorithmVersion", config.algorithmVersion());
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
        List<HypeScoreCurrent> pool = publicPool(type).stream()
                .filter(c -> inRegion(c, region) && inCountry(c, country) && hasCategory(c, category) && hasSubcategory(c, subcategory)).toList();
        Map<UUID, Double> avg = win == 30 ? monthAverage(type, pool.stream().map(HypeScoreCurrent::getEntityId).collect(Collectors.toSet())) : Map.of();
        ToDoubleFunction<HypeScoreCurrent> metric = win == 1 ? c -> trendOf(c) * 1000 + c.getScore().doubleValue()
                : win == 30 ? c -> avg.getOrDefault(c.getEntityId(), c.getScore().doubleValue()) : c -> c.getScore().doubleValue();
        ToDoubleFunction<HypeScoreCurrent> shown = win == 1 ? HypeQueryService::trendOf : metric;   // o número exibido: trend, score ou média do mês
        List<HypeScoreCurrent> sorted = pool.stream().sorted(Comparator.comparingDouble(metric).reversed()
                .thenComparing(c -> c.getEntityId().toString())).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ids", sorted.stream().map(c -> c.getEntityId().toString()).toList());
        out.put("values", sorted.stream().map(c -> round1(shown.applyAsDouble(c))).toList());
        return out;
    }

    /** Contagens dos filtros e a comparação "Hype por região" (média do Hype de cada região no tipo/categoria atuais). */
    @Transactional(readOnly = true)
    public Map<String, Object> rankingFacets(HypeEntityType type, int window, String region, String category) {
        int win = window <= 1 ? 1 : window >= 30 ? 30 : 7;
        String r = upper(region);
        String cat = norm(category);
        return cache.get("ranking-facets:" + type + ":" + win + ":" + r + ":" + cat, () -> facets(type, win, r, cat));
    }

    Map<String, Object> facets(HypeEntityType type, int win, String region, String category) {
        List<HypeScoreCurrent> pool = publicPool(type);
        Map<UUID, Double> month = win == 30 ? monthAverage(type, pool.stream().map(HypeScoreCurrent::getEntityId).collect(Collectors.toSet())) : Map.of();
        // "Hype" da região: o HypeScore atual (1 e 7 dias) ou a média do mês (30 dias) — o trend do "Hoje" ordena, mas não é Hype
        ToDoubleFunction<HypeScoreCurrent> hype = c -> month.getOrDefault(c.getEntityId(), c.getScore().doubleValue());
        List<HypeScoreCurrent> byCategory = pool.stream().filter(c -> hasCategory(c, category)).toList();
        List<HypeScoreCurrent> scoped = byCategory.stream().filter(c -> inRegion(c, region)).toList();

        List<Map<String, Object>> regions = new ArrayList<>();
        for (String code : br.com.fashionai.application.taxonomy.WorldRegions.codes()) {
            List<HypeScoreCurrent> in = byCategory.stream().filter(c -> code.equals(regionOf(c))).toList();
            if (!in.isEmpty()) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("key", code);
                m.put("label", br.com.fashionai.application.taxonomy.WorldRegions.label(code));
                m.put("count", in.size());
                m.put("avgHype", round1(in.stream().mapToDouble(hype).average().orElse(0)));
                regions.add(m);
            }
        }
        Map<String, Object> world = new LinkedHashMap<>();
        world.put("count", byCategory.size());
        world.put("avgHype", byCategory.isEmpty() ? null : round1(byCategory.stream().mapToDouble(hype).average().orElse(0)));

        Map<String, Long> countryCount = scoped.stream().filter(c -> !blank(c.getCountry()))
                .collect(Collectors.groupingBy(c -> c.getCountry().trim().toUpperCase(Locale.ROOT), TreeMap::new, Collectors.counting()));
        List<Map<String, Object>> countries = countryCount.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .map(e -> Map.<String, Object>of("key", e.getKey(), "count", e.getValue())).toList();

        Map<String, Long> categoryCount = new TreeMap<>(Comparator.comparingInt(HypeQueryService::categoryOrder).thenComparing(Comparator.naturalOrder()));
        pool.stream().filter(c -> inRegion(c, region))
                .forEach(c -> categoriesOf(c).stream().map(x -> x.toLowerCase(Locale.ROOT)).distinct().forEach(x -> categoryCount.merge(x, 1L, Long::sum)));
        List<Map<String, Object>> categories = categoryCount.entrySet().stream()
                .map(e -> Map.<String, Object>of("key", e.getKey(), "count", e.getValue())).toList();

        Map<String, Long> subCount = new TreeMap<>();
        Map<String, String> subCategory = new HashMap<>();
        for (HypeScoreCurrent c : scoped) {
            for (String s : subcategoriesOf(c).stream().map(x -> x.toLowerCase(Locale.ROOT)).distinct().toList()) {
                // peça: a própria categoria; look: a categoria da subcategoria na taxonomia (o look mistura várias)
                String owner = type == HypeEntityType.PIECE && c.getCategory() != null ? c.getCategory().toLowerCase(Locale.ROOT) : Taxonomy.categoryOf(s);
                if (!category.isEmpty() && !category.equalsIgnoreCase(owner)) {
                    continue;
                }
                subCount.merge(s, 1L, Long::sum);
                subCategory.putIfAbsent(s, owner);
            }
        }
        List<Map<String, Object>> subcategories = subCount.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("key", e.getKey());
                    m.put("category", subCategory.get(e.getKey()));
                    m.put("count", e.getValue());
                    return m;
                }).toList();

        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("region", region.isEmpty() ? null : region);
        filters.put("category", category.isEmpty() ? null : category);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type.name());
        out.put("window", win);
        out.put("algorithmVersion", config.algorithmVersion());
        out.put("filters", filters);
        out.put("total", scoped.size());
        out.put("world", world);
        out.put("regions", regions);
        out.put("countries", countries);
        out.put("categories", categories);
        out.put("subcategories", subcategories);
        return out;
    }

    /**
     * Posições do item no ranking público (janela de 7 dias = HypeScore atual): no mundo, na categoria e na subcategoria
     * (peças) e na região e no país (peças e looks). Item fora da população pública (privado, não aprovado, sem dados)
     * não tem posição: {@code eligible = false} — o dono continua vendo o próprio Hype na análise. Visibilidade = detalhe (404).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> positions(CurrentUser viewer, HypeEntityType type, UUID id) {
        boolean ok = type == HypeEntityType.PIECE ? pieces.findById(id).filter(w -> canView(viewer, w)).isPresent()
                : schemes.findById(id).filter(s -> canView(viewer, s)).isPresent();
        if (!ok) {
            throw ApiException.notFound(type == HypeEntityType.PIECE ? Msg.t("common.peca") : Msg.t("entity.esquema"));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("eligible", false);
        out.put("window", POSITIONS_WINDOW);
        out.put("positions", List.of());
        Optional<HypeScoreCurrent> row = current.findByEntityTypeAndEntityIdAndAlgorithmVersion(type, id, config.algorithmVersion());
        if (row.isEmpty() || !row.get().isPublicEligible() || row.get().getStatus() != HypeStatus.AVAILABLE || row.get().getScore() == null) {
            return out;
        }
        HypeScoreCurrent me = row.get();
        List<HypeScoreCurrent> pool = publicPool(type);
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

    /** População do ranking público: só elegível e com score (privacidade e "sem dados" ficam de fora). */
    List<HypeScoreCurrent> publicPool(HypeEntityType type) {
        return current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(type, config.algorithmVersion(), HypeStatus.AVAILABLE)
                .stream().filter(c -> c.isPublicEligible() && c.getScore() != null).toList();
    }

    static String regionOf(HypeScoreCurrent c) {
        return blank(c.getRegion()) ? NO_REGION : c.getRegion().trim().toUpperCase(Locale.ROOT);
    }

    /** Peça: a própria categoria; look: as das peças dele (linhas anteriores à V39 só têm a coluna {@code category}). */
    static List<String> categoriesOf(HypeScoreCurrent c) {
        List<String> list = Json.csv(c.getCategories());
        return list.isEmpty() && !blank(c.getCategory()) ? List.of(c.getCategory()) : list;
    }

    static List<String> subcategoriesOf(HypeScoreCurrent c) {
        return Json.csv(c.getSubcategories());
    }

    static boolean inRegion(HypeScoreCurrent c, String region) {
        return blank(region) || region.equalsIgnoreCase(regionOf(c));
    }

    static boolean inCountry(HypeScoreCurrent c, String country) {
        return blank(country) || (c.getCountry() != null && country.equalsIgnoreCase(c.getCountry().trim()));
    }

    static boolean hasCategory(HypeScoreCurrent c, String category) {
        return blank(category) || categoriesOf(c).stream().anyMatch(category::equalsIgnoreCase);
    }

    static boolean hasSubcategory(HypeScoreCurrent c, String subcategory) {
        return blank(subcategory) || subcategoriesOf(c).stream().anyMatch(subcategory::equalsIgnoreCase);
    }

    static double trendOf(HypeScoreCurrent c) {
        return c.getDimensions() == null || c.getDimensions().getTrend() == null ? 0 : c.getDimensions().getTrend().doubleValue();
    }

    /** Ordem das categorias da taxonomia (parte de cima, de baixo, calçados, acessórios, peça inteira); fora dela, no fim. */
    static int categoryOrder(String category) {
        int i = new ArrayList<>(Taxonomy.SUBCATEGORIES.keySet()).indexOf(category);
        return i < 0 ? Integer.MAX_VALUE : i;
    }

    /** Rótulo adiado (resolvido no idioma de quem lê) de um código da taxonomia; sem rótulo, o próprio código. */
    static String taxonomyLabel(String code) {
        return Msg.has("taxonomy." + code) ? Msg.k("taxonomy." + code) : code;
    }

    private static String upper(String s) {
        return blank(s) ? "" : s.trim().toUpperCase(Locale.ROOT);
    }

    // ================================================================== uso por outros serviços
    /** Estado atual de várias entidades do dono (ordenações do guarda-roupa, Copilot). */
    @Transactional(readOnly = true)
    public Map<UUID, HypeScoreCurrent> currentOf(HypeEntityType type, Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return Map.of();
        }
        return current.findByEntityTypeAndEntityIdInAndAlgorithmVersion(type, new HashSet<>(ids), config.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a));
    }

    public HypeScoreConfig config() {
        return config;
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String norm(String s) {
        return blank(s) ? "" : s.trim().toLowerCase(Locale.ROOT);
    }
}
