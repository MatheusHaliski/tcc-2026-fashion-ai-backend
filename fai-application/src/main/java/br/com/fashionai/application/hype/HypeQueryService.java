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
    static final int FORGOTTEN_DAYS = 60;

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
        if (type == HypeEntityType.PIECE) {
            WardrobeItem w = pieces.findById(id).filter(x -> canView(viewer, x)).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            item = profileOf(w);
        } else {
            Scheme s = schemes.findById(id).filter(x -> canView(viewer, x)).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
            item = profileOf(s, schemeItems.findBySchemeIdOrderBySortOrder(id));
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
