package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.HypeGroup;
import br.com.fashionai.domain.model.HypeScoreMetric;
import br.com.fashionai.domain.model.MetricSnapshot;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeScoreBand;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.HypeGroupRepository;
import br.com.fashionai.domain.repository.HypeScoreMetricRepository;
import br.com.fashionai.domain.repository.MetricSnapshotRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

/**
 * RF6 — Hype Score (RF6_HYPE_SCORE_CALCULO.md): E_raw = L + 3C + 5S + 8R normalizado por percentil na janela de
 * calibração (90 dias), T_norm por fração de uso global recente (30 dias) dos atributos, Hype = 0,65E + 0,35T,
 * 7 faixas, selos Trendsetter/Style Match, Top X% semanal pela fatia superior inclusiva (§4.1), Δ contra o Look do Dia
 * anterior e sugestão da IA. Generalizado para peças (Explorador Global) e para HypeGroups (hypeScoreGlobal).
 */
@Service
public class HypeScoreService {
    public static final int CALIBRATION_DAYS = 90;
    public static final int TREND_DAYS = 30;
    public static final int WEEKLY_DAYS = 7;
    public static final double ALPHA = 0.65;
    public static final double BETA = 0.35;
    static final String KIND_SCHEME = "HYPE_CAL_SCHEME";
    static final String KIND_PIECE = "HYPE_CAL_PIECE";
    static final String KIND_WEEK = "HYPE_WEEK_SCHEME";
    static final Map<String, Double> TREND_WEIGHTS = Map.of("style", 1.5, "brand", 1.0, "color", 1.0, "occasion", 1.0, "category", 0.5);

    public record Band(int min, int max, HypeScoreBand code, String label) {
    }

    public static final List<Band> BANDS = List.of(new Band(0, 14, HypeScoreBand.DESPRETENSIOSO, "Despretensioso"),
            new Band(15, 29, HypeScoreBand.EM_CONSTRUCAO, Msg.k("hypeScore.em_construcao")), new Band(30, 49, HypeScoreBand.NOTADO, "Notado"),
            new Band(50, 69, HypeScoreBand.COM_ESTILO, Msg.k("hypeScore.com_estilo")), new Band(70, 84, HypeScoreBand.MUITO_ESTILOSO, Msg.k("hypeScore.muito_estiloso")),
            new Band(85, 95, HypeScoreBand.ARRASANDO_NO_LOOK, Msg.k("hypeScore.arrasando_no_look")), new Band(96, 100, HypeScoreBand.ICONE_DE_ESTILO, Msg.k("hypeScore.icone_de_estilo")));

    public static Band band(double hype) {
        int h = (int) Math.round(hype);
        return BANDS.stream().filter(b -> h >= b.min() && h <= b.max()).findFirst().orElse(BANDS.get(0));
    }

    /** Régua de percentil calibrada (§2.2/§3.3): listas ordenadas + frações u(a, v). */
    record Calibration(List<Double> eRaw, List<Double> trendRaw, Map<String, List<Double>> metrics, Map<String, Map<String, Double>> usage,
                       int activeUsers, int n, Instant computedAt) {
        static Calibration empty() {
            return new Calibration(List.of(), List.of(), Map.of(), Map.of(), 1, 0, Instant.EPOCH);
        }
    }

    record Weekly(List<Double> hype, int n, Instant computedAt) {
    }

    public record Score(double eRaw, double eNorm, double trendRaw, double tNorm, double hype, Band band, boolean trendsetter, boolean styleMatch,
                        Map<String, Object> breakdown, Double weeklyTopPercent, long likes, long comments, long shares, long remixes) {
    }

    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final DailyLookRepository dailyLooks;
    private final HypeScoreMetricRepository metrics;
    private final HypeGroupRepository groups;
    private final MetricSnapshotRepository snapshots;
    private final AiEngine ai;
    private final AtomicReference<Calibration> schemeCal = new AtomicReference<>();
    private final AtomicReference<Calibration> pieceCal = new AtomicReference<>();
    private final AtomicReference<Weekly> weekly = new AtomicReference<>();

    public HypeScoreService(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces,
                            DailyLookRepository dailyLooks, HypeScoreMetricRepository metrics, HypeGroupRepository groups,
                            MetricSnapshotRepository snapshots, AiEngine ai) {
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.dailyLooks = dailyLooks;
        this.metrics = metrics;
        this.groups = groups;
        this.snapshots = snapshots;
        this.ai = ai;
    }

    // ================================================================== contadores brutos (§2.1)
    record Raw(long likes, long comments, long shares, long remixes) {
        double eRaw() {
            return likes + 3.0 * comments + 5.0 * shares + 8.0 * remixes;
        }
    }

    Raw raw(Scheme s, List<SchemeItem> items) {
        long l = s.getLikeCount(), c = s.getCommentCount(), sh = s.getShareCount(), r = s.getRemixCount();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            l += w.getLikesCount();
            c += w.getCommentCount();
            sh += w.getSharesCount();
            r += w.getRemixesCount();
        }
        return new Raw(l, c, sh, r);
    }

    static Raw raw(WardrobeItem w) {
        return new Raw(w.getLikesCount(), w.getCommentCount(), w.getSharesCount(), w.getRemixesCount());
    }

    /** Atributos (a, v) que o esquema usa (§3.1). */
    static Map<String, Set<String>> attributes(Scheme s, List<SchemeItem> items) {
        Map<String, Set<String>> m = new LinkedHashMap<>();
        m.put("style", new HashSet<>(Json.csv(s.getStyle())));
        m.put("occasion", new HashSet<>(Json.csv(s.getOccasion())));
        Set<String> brands = new HashSet<>(), colors = new HashSet<>(), cats = new HashSet<>();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            if (w.getBrandName() != null && !w.getBrandName().isBlank()) {
                brands.add(w.getBrandName().toLowerCase());
            }
            if (w.getColor() != null) {
                colors.add(w.getColor());
            }
            if (w.getCategory() != null) {
                cats.add(w.getCategory());
            }
        }
        m.put("brand", brands);
        m.put("color", colors);
        m.put("category", cats);
        return m;
    }

    static Map<String, Set<String>> attributes(WardrobeItem w) {
        Map<String, Set<String>> m = new LinkedHashMap<>();
        m.put("style", new HashSet<>(Json.csv(w.getStyleTags())));
        m.put("occasion", new HashSet<>(Json.csv(w.getOccasionTags())));
        m.put("brand", w.getBrandName() == null || w.getBrandName().isBlank() ? Set.of() : Set.of(w.getBrandName().toLowerCase()));
        m.put("color", w.getColor() == null ? Set.of() : Set.of(w.getColor()));
        m.put("category", w.getCategory() == null ? Set.of() : Set.of(w.getCategory()));
        return m;
    }

    static double trendRaw(Map<String, Set<String>> attrs, Map<String, Map<String, Double>> usage) {
        double num = 0, den = 0;
        for (Map.Entry<String, Set<String>> e : attrs.entrySet()) {
            double w = TREND_WEIGHTS.getOrDefault(e.getKey(), 1.0);
            Map<String, Double> u = usage.getOrDefault(e.getKey(), Map.of());
            for (String v : e.getValue()) {
                num += w * u.getOrDefault(v, 0.0);
                den += w;
            }
        }
        return den == 0 ? 0 : num / den;
    }

    /** Percentil ascendente (§2.2): 100 × posição (nº de valores ≤ x, 1-indexada) / N. */
    static double percentile(List<Double> sorted, double value) {
        if (sorted.isEmpty()) {
            return value > 0 ? 50 : 0;
        }
        int pos = 0;
        for (double v : sorted) {
            if (v <= value) {
                pos++;
            } else {
                break;
            }
        }
        return 100.0 * Math.max(1, pos) / sorted.size();
    }

    // ================================================================== calibração (§7)
    @Transactional
    @Scheduled(cron = "0 5 */4 * * *", zone = "America/Sao_Paulo")
    public Map<String, Object> recalibrate() {
        Instant now = Instant.now();
        Instant calSince = now.minus(CALIBRATION_DAYS, ChronoUnit.DAYS);
        Instant trendSince = now.minus(TREND_DAYS, ChronoUnit.DAYS);
        List<Scheme> publicSchemes = schemes.findAllPublic(Pageable.unpaged()).stream().filter(s -> s.getStatus() == SchemeStatus.PUBLISHED).toList();
        Map<UUID, List<SchemeItem>> itemsBy = publicSchemes.isEmpty() ? Map.of() : schemeItems.findBySchemeIdIn(publicSchemes.stream().map(Scheme::getId).toList())
                .stream().collect(Collectors.groupingBy(si -> si.getScheme().getId()));
        List<WardrobeItem> publicPieces = pieces.findAllPublic(Pageable.unpaged());
        // usuários ativos e uso recente por atributo (janela de 30 dias sobre o item)
        Set<UUID> activeUsers = new HashSet<>();
        Map<String, Map<String, Set<UUID>>> usersBy = new HashMap<>();
        for (Scheme s : publicSchemes) {
            Instant touched = latest(s.getUpdatedAt(), s.getPublishedAt());
            if (touched != null && touched.isAfter(calSince)) {
                activeUsers.add(s.getUser().getId());
            }
            if (touched != null && touched.isAfter(trendSince)) {
                attributes(s, itemsBy.getOrDefault(s.getId(), List.of())).forEach((a, vs) -> vs.forEach(v ->
                        usersBy.computeIfAbsent(a, k -> new HashMap<>()).computeIfAbsent(v, k -> new HashSet<>()).add(s.getUser().getId())));
            }
        }
        for (WardrobeItem w : publicPieces) {
            if (w.getUpdatedAt() != null && w.getUpdatedAt().isAfter(calSince)) {
                activeUsers.add(w.getUser().getId());
            }
            if (w.getUpdatedAt() != null && w.getUpdatedAt().isAfter(trendSince)) {
                attributes(w).forEach((a, vs) -> vs.forEach(v ->
                        usersBy.computeIfAbsent(a, k -> new HashMap<>()).computeIfAbsent(v, k -> new HashSet<>()).add(w.getUser().getId())));
            }
        }
        for (DailyLook dl : dailyLooks.findByLookDate(LocalDate.now(FaiPointsService.ZONE))) {
            activeUsers.add(dl.getUser().getId());
        }
        int active = Math.max(1, activeUsers.size());
        Map<String, Map<String, Double>> usage = new HashMap<>();
        usersBy.forEach((a, m) -> m.forEach((v, users) -> usage.computeIfAbsent(a, k -> new HashMap<>()).put(v, (double) users.size() / active)));

        // população de referência: públicos com ≥ 1 interação nos últimos 90 dias
        List<Scheme> reference = publicSchemes.stream().filter(s -> {
            Raw r = raw(s, itemsBy.getOrDefault(s.getId(), List.of()));
            Instant touched = latest(s.getUpdatedAt(), s.getPublishedAt());
            return r.eRaw() > 0 && touched != null && touched.isAfter(calSince);
        }).toList();
        Calibration sc = build(reference.stream().map(s -> raw(s, itemsBy.getOrDefault(s.getId(), List.of()))).toList(),
                reference.stream().map(s -> trendRaw(attributes(s, itemsBy.getOrDefault(s.getId(), List.of())), usage)).toList(), usage, active, now);
        List<WardrobeItem> refPieces = publicPieces.stream().filter(w -> raw(w).eRaw() > 0 && w.getUpdatedAt() != null && w.getUpdatedAt().isAfter(calSince)).toList();
        Calibration pc = build(refPieces.stream().map(HypeScoreService::raw).toList(),
                refPieces.stream().map(w -> trendRaw(attributes(w), usage)).toList(), usage, active, now);
        schemeCal.set(sc);
        pieceCal.set(pc);
        persist(KIND_SCHEME, sc, calSince, now);
        persist(KIND_PIECE, pc, calSince, now);

        // pontuação materializada em todos os públicos + população semanal (§4.1)
        Instant weekSince = now.minus(WEEKLY_DAYS, ChronoUnit.DAYS);
        List<Double> weekHype = new ArrayList<>();
        Map<UUID, Double> hypeBy = new HashMap<>();
        for (Scheme s : publicSchemes) {
            List<SchemeItem> items = itemsBy.getOrDefault(s.getId(), List.of());
            Score sc1 = score(raw(s, items), trendRaw(attributes(s, items), usage), sc, null);
            hypeBy.put(s.getId(), sc1.hype());
            s.setHypeScore(dec(sc1.hype()));
            Instant touched = latest(s.getUpdatedAt(), s.getPublishedAt());
            if (touched != null && touched.isAfter(weekSince)) {
                weekHype.add(sc1.hype());
            }
        }
        Collections.sort(weekHype);
        Weekly wk = new Weekly(weekHype, weekHype.size(), now);
        weekly.set(wk);
        MetricSnapshot ws = new MetricSnapshot();
        ws.setId(UUID.randomUUID());
        ws.setKind(KIND_WEEK);
        ws.setPeriodStart(weekSince);
        ws.setPeriodEnd(now);
        ws.setValuesJson(Json.write(Map.of("hype", weekHype, "n", weekHype.size())));
        ws.setCreatedAt(now);
        snapshots.save(ws);
        for (WardrobeItem w : publicPieces) {
            Score s1 = score(raw(w), trendRaw(attributes(w), usage), pc, null);
            w.setHypeScore(dec(s1.hype()));
        }
        int groupsCount = regroup(publicSchemes, itemsBy, hypeBy, publicPieces);
        return Map.of("referenceSchemes", reference.size(), "referencePieces", refPieces.size(), "activeUsers", active, "weeklyPopulation", weekHype.size(),
                "hypeGroups", groupsCount, "computedAt", now);
    }

    private static Instant latest(Instant a, Instant b) {
        if (a == null) {
            return b;
        }
        return b == null || a.isAfter(b) ? a : b;
    }

    private Calibration build(List<Raw> raws, List<Double> trends, Map<String, Map<String, Double>> usage, int active, Instant now) {
        List<Double> e = raws.stream().map(Raw::eRaw).sorted().toList();
        Map<String, List<Double>> metricLists = new LinkedHashMap<>();
        metricLists.put("L", raws.stream().map(r -> (double) r.likes()).sorted().toList());
        metricLists.put("C", raws.stream().map(r -> (double) r.comments()).sorted().toList());
        metricLists.put("S", raws.stream().map(r -> (double) r.shares()).sorted().toList());
        metricLists.put("R", raws.stream().map(r -> (double) r.remixes()).sorted().toList());
        return new Calibration(e, trends.stream().sorted().toList(), metricLists, usage, active, e.size(), now);
    }

    private void persist(String kind, Calibration c, Instant from, Instant to) {
        MetricSnapshot s = new MetricSnapshot();
        s.setId(UUID.randomUUID());
        s.setKind(kind);
        s.setPeriodStart(from);
        s.setPeriodEnd(to);
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("eRaw", c.eRaw());
        v.put("trendRaw", c.trendRaw());
        v.put("metrics", c.metrics());
        v.put("usage", c.usage());
        v.put("activeUsers", c.activeUsers());
        v.put("n", c.n());
        s.setValuesJson(Json.write(v));
        s.setCreatedAt(to);
        snapshots.save(s);
    }

    @SuppressWarnings("unchecked")
    Calibration load(String kind) {
        List<MetricSnapshot> list = snapshots.findTop30ByKindOrderByPeriodEndDesc(kind);
        if (list.isEmpty()) {
            return null;
        }
        Map<String, Object> v = Json.map(list.get(0).getValuesJson());
        Map<String, List<Double>> metricLists = new LinkedHashMap<>();
        if (v.get("metrics") instanceof Map<?, ?> mm) {
            mm.forEach((k, val) -> metricLists.put(String.valueOf(k), doubles(val)));
        }
        Map<String, Map<String, Double>> usage = new HashMap<>();
        if (v.get("usage") instanceof Map<?, ?> um) {
            um.forEach((a, m) -> {
                Map<String, Double> inner = new HashMap<>();
                if (m instanceof Map<?, ?> im) {
                    im.forEach((val, f) -> inner.put(String.valueOf(val), f instanceof Number n ? n.doubleValue() : 0.0));
                }
                usage.put(String.valueOf(a), inner);
            });
        }
        return new Calibration(doubles(v.get("eRaw")), doubles(v.get("trendRaw")), metricLists, usage,
                v.get("activeUsers") instanceof Number n ? n.intValue() : 1, v.get("n") instanceof Number n ? n.intValue() : 0, list.get(0).getPeriodEnd());
    }

    static List<Double> doubles(Object o) {
        if (!(o instanceof List<?> l)) {
            return List.of();
        }
        return l.stream().filter(x -> x instanceof Number).map(x -> ((Number) x).doubleValue()).toList();
    }

    Calibration calibration(HypeEntityType type) {
        AtomicReference<Calibration> ref = type == HypeEntityType.PIECE ? pieceCal : schemeCal;
        Calibration c = ref.get();
        if (c == null) {
            c = load(type == HypeEntityType.PIECE ? KIND_PIECE : KIND_SCHEME);
            if (c == null) {
                try {
                    recalibrate();
                } catch (RuntimeException ex) {
                    return Calibration.empty();
                }
                c = ref.get();
            }
            if (c == null) {
                c = Calibration.empty();
            }
            ref.set(c);
        }
        return c;
    }

    Weekly weekly() {
        Weekly w = weekly.get();
        if (w == null) {
            List<MetricSnapshot> list = snapshots.findTop30ByKindOrderByPeriodEndDesc(KIND_WEEK);
            w = list.isEmpty() ? new Weekly(List.of(), 0, Instant.EPOCH) : new Weekly(doubles(Json.map(list.get(0).getValuesJson()).get("hype")),
                    doubles(Json.map(list.get(0).getValuesJson()).get("hype")).size(), list.get(0).getPeriodEnd());
            weekly.set(w);
        }
        return w;
    }

    static BigDecimal dec(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }

    // ================================================================== score on-demand (§4)
    Score score(Raw raw, double trendRaw, Calibration cal, Weekly wk) {
        double eNorm = percentile(cal.eRaw(), raw.eRaw());
        if (raw.eRaw() == 0) {
            eNorm = 0;
        }
        double tNorm = percentile(cal.trendRaw(), trendRaw);
        double hype = ALPHA * eNorm + BETA * tNorm;
        Map<String, Object> breakdown = new LinkedHashMap<>();
        breakdown.put("L", Map.of("value", raw.likes(), "percentile", Math.round(percentile(cal.metrics().getOrDefault("L", List.of()), raw.likes())), "weight", 1));
        breakdown.put("C", Map.of("value", raw.comments(), "percentile", Math.round(percentile(cal.metrics().getOrDefault("C", List.of()), raw.comments())), "weight", 3));
        breakdown.put("S", Map.of("value", raw.shares(), "percentile", Math.round(percentile(cal.metrics().getOrDefault("S", List.of()), raw.shares())), "weight", 5));
        breakdown.put("R", Map.of("value", raw.remixes(), "percentile", Math.round(percentile(cal.metrics().getOrDefault("R", List.of()), raw.remixes())), "weight", 8));
        Double top = null;
        if (wk != null && wk.n() > 0) {
            int pos = 0;
            for (double v : wk.hype()) {
                if (v <= hype) {
                    pos++;
                } else {
                    break;
                }
            }
            pos = Math.max(1, pos);
            top = 100.0 * (wk.n() - pos + 1) / wk.n();
        }
        return new Score(raw.eRaw(), eNorm, trendRaw, tNorm, hype, band(hype), eNorm >= 70 && tNorm <= 30, tNorm >= 70, breakdown, top,
                raw.likes(), raw.comments(), raw.shares(), raw.remixes());
    }

    @Transactional(readOnly = true)
    public Score scoreScheme(Scheme s) {
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(s.getId());
        Calibration cal = calibration(HypeEntityType.SCHEME);
        return score(raw(s, items), trendRaw(attributes(s, items), cal.usage()), cal, weekly());
    }

    @Transactional(readOnly = true)
    public Score scorePiece(WardrobeItem w) {
        Calibration cal = calibration(HypeEntityType.PIECE);
        return score(raw(w), trendRaw(attributes(w), cal.usage()), cal, null);
    }

    /** Painel do Look do Dia (§6): todos os indicadores derivam do mesmo cálculo; a versão de painel é só apresentação. */
    @Transactional
    public Map<String, Object> panel(DailyLook dl, boolean withAi) {
        Scheme s = dl.getScheme();
        Score sc = scoreScheme(s);
        Optional<DailyLook> previous = dailyLooks.findFirstByUserIdAndLookDateBeforeOrderByLookDateDesc(dl.getUser().getId(), dl.getLookDate());
        Double delta = previous.map(p -> metrics.findByDailyLookId(p.getId()).map(m -> m.getHypeScore() == null ? null : sc.hype() - m.getHypeScore().doubleValue())
                .orElseGet(() -> sc.hype() - scoreScheme(p.getScheme()).hype())).orElse(null);
        String tip = LocalAdvisors.styleTip(sc.likes(), sc.comments(), sc.shares(), sc.remixes(), sc.eNorm(), sc.tNorm());
        AiOutcome<String> outcome = null;
        if (withAi) {
            String localTip = tip;
            outcome = ai.text(new AiEngine.TextCall<>(dl.getUser().getId(), AiCapability.STYLE_ADVISOR,
                    "Você é o Style Advisor do Fashion AI. Dê UMA dica acionável (até 2 frases, em " + Msg.languageName() + ") para o usuário subir o Hype Score do look, "
                            + "citando a métrica mais fraca. Nunca cite marcas reais que não estejam no look. Responda só o texto.",
                    Msg.t("hypeScore.look_estilos_ocasioes_breakdown", s.getTitle(), Json.csv(s.getStyle()), Json.csv(s.getOccasion()), Json.write(sc.breakdown()), Math.round(sc.eNorm()), Math.round(sc.tNorm())),
                    List.of(), 200, List.of(Msg.t("hypeScore.contadores_sociais_do_look"), Msg.t("hypeScore.percentis_de_calibracao")),
                    text -> text == null || text.isBlank() ? null : InputSanitizer.clean(text, 300), () -> localTip, null));
            if (outcome.value() != null) {
                tip = outcome.value();
            }
        }
        HypeScoreMetric m = metrics.findByDailyLookId(dl.getId()).orElseGet(HypeScoreMetric::new);
        m.setDailyLook(dl);
        m.setScheme(s);
        m.setUser(dl.getUser());
        m.setScoreDate(LocalDate.now(FaiPointsService.ZONE));
        m.setLikesCount(sc.likes());
        m.setCommentsCount(sc.comments());
        m.setSharesCount(sc.shares());
        m.setRemixesCount(sc.remixes());
        m.setEngagementRaw(dec(sc.eRaw()));
        m.setEngagementNorm(dec(sc.eNorm()));
        m.setTrendRaw(dec(sc.trendRaw()));
        m.setTrendNorm(dec(sc.tNorm()));
        m.setHypeScore(dec(sc.hype()));
        m.setGlobalHypeScore(s.getHypeScoreGlobal() == null ? dec(sc.hype()) : s.getHypeScoreGlobal());
        m.setWeeklyTopPercent(sc.weeklyTopPercent() == null ? null : dec(sc.weeklyTopPercent()));
        m.setBand(sc.band().code());
        m.setTrendsetterSeal(sc.trendsetter());
        m.setStyleMatchSeal(sc.styleMatch());
        m.setAiSuggestion(tip);
        m.setBreakdownJson(Json.write(sc.breakdown()));
        m.setCalibrationWindowDays(CALIBRATION_DAYS);
        m.setTrendWindowDays(TREND_DAYS);
        m.setWeeklyWindowDays(WEEKLY_DAYS);
        metrics.save(m);
        s.setHypeScore(dec(sc.hype()));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("hypeScore", Math.round(sc.hype() * 10) / 10.0);
        out.put("band", Map.of("code", sc.band().code().name(), "label", sc.band().label(), "min", sc.band().min(), "max", sc.band().max()));
        out.put("bands", BANDS.stream().map(b -> Map.of("code", b.code().name(), "label", b.label(), "min", b.min(), "max", b.max())).toList());
        out.put("engagement", Map.of("raw", sc.eRaw(), "norm", Math.round(sc.eNorm())));
        out.put("trend", Map.of("raw", Math.round(sc.trendRaw() * 1000) / 1000.0, "norm", Math.round(sc.tNorm())));
        out.put("totalLikes", sc.likes());
        out.put("breakdown", sc.breakdown());
        List<String> seals = new ArrayList<>();
        if (sc.trendsetter()) {
            seals.add("TRENDSETTER");
        }
        if (sc.styleMatch()) {
            seals.add("STYLE_MATCH");
        }
        out.put("seals", seals);
        out.put("weeklyTopPercent", sc.weeklyTopPercent() == null ? null : Math.round(sc.weeklyTopPercent() * 10) / 10.0);
        out.put("weeklyRankingText", sc.weeklyTopPercent() == null ? Msg.t("hypeScore.sem_populacao_semanal_ainda") : Msg.t("hypeScore.top_dos_looks_desta_semana", Math.round(sc.weeklyTopPercent())));
        out.put("delta", delta == null ? null : Math.round(delta * 10) / 10.0);
        out.put("deltaArrow", delta == null ? "=" : delta > 0.05 ? "↑" : delta < -0.05 ? "↓" : "=");
        out.put("previousDailyLook", previous.map(p -> Map.of("date", p.getLookDate(), "schemeId", p.getScheme().getId())).orElse(null));
        out.put("aiSuggestion", tip);
        out.put("aiExplanation", outcome == null ? null : outcome.explanation());
        out.put("globalHypeScore", s.getHypeScoreGlobal());
        out.put("hypeGroupId", s.getHypeGroupId());
        out.put("formula", Msg.t("hypeScore.hype_0_65_e_norm"));
        out.put("calibratedAt", calibration(HypeEntityType.SCHEME).computedAt());
        return out;
    }

    // ================================================================== HypeGroups (hypeScoreGlobal)
    int regroup(List<Scheme> publicSchemes, Map<UUID, List<SchemeItem>> itemsBy, Map<UUID, Double> hypeBy, List<WardrobeItem> publicPieces) {
        groups.findByEntityType(HypeEntityType.SCHEME).forEach(groups::delete);
        groups.findByEntityType(HypeEntityType.PIECE).forEach(groups::delete);
        int count = 0;
        List<UUID> ids = publicSchemes.stream().map(Scheme::getId).toList();
        List<Similarity.Signature> sigs = publicSchemes.stream().map(s -> Similarity.of(s, itemsBy.getOrDefault(s.getId(), List.of()))).toList();
        Map<UUID, Scheme> byId = publicSchemes.stream().collect(Collectors.toMap(Scheme::getId, s -> s));
        for (List<Integer> cluster : cluster(sigs)) {
            List<UUID> members = cluster.stream().map(ids::get).toList();
            double avg = members.stream().mapToDouble(id -> hypeBy.getOrDefault(id, 0.0)).average().orElse(0);
            HypeGroup g = new HypeGroup();
            g.setEntityType(HypeEntityType.SCHEME);
            Similarity.Signature sig = sigs.get(cluster.get(0));
            g.setSignatureStyle(String.join(",", sig.styles()));
            g.setSignatureOccasion(String.join(",", sig.occasions()));
            g.setSignatureBrandsJson(Json.write(sig.brands()));
            g.setSignatureColorsJson(Json.write(sig.colors()));
            g.setSignaturePieceTypesJson(Json.write(sig.types()));
            g.setMemberIdsJson(Json.write(members.stream().map(UUID::toString).toList()));
            g.setMemberCount(members.size());
            g.setHypeScoreGlobal(dec(avg));
            g.setComputedAt(Instant.now());
            groups.save(g);
            for (UUID id : members) {
                Scheme s = byId.get(id);
                s.setHypeGroupId(g.getId());
                s.setHypeScoreGlobal(dec(avg));
            }
            count++;
        }
        for (Scheme s : publicSchemes) {
            if (s.getHypeGroupId() == null || !groupExists(s.getHypeGroupId())) {
                s.setHypeGroupId(null);
                s.setHypeScoreGlobal(s.getHypeScore());
            }
        }
        List<Similarity.Signature> psigs = publicPieces.stream().map(Similarity::of).toList();
        Map<UUID, WardrobeItem> pById = publicPieces.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        List<UUID> pids = publicPieces.stream().map(WardrobeItem::getId).toList();
        Set<UUID> grouped = new HashSet<>();
        for (List<Integer> cluster : cluster(psigs)) {
            List<UUID> members = cluster.stream().map(pids::get).toList();
            double avg = members.stream().mapToDouble(id -> pById.get(id).getHypeScore() == null ? 0 : pById.get(id).getHypeScore().doubleValue()).average().orElse(0);
            HypeGroup g = new HypeGroup();
            g.setEntityType(HypeEntityType.PIECE);
            Similarity.Signature sig = psigs.get(cluster.get(0));
            g.setSignatureStyle(String.join(",", sig.styles()));
            g.setSignatureOccasion(String.join(",", sig.occasions()));
            g.setSignatureBrandsJson(Json.write(sig.brands()));
            g.setSignatureColorsJson(Json.write(sig.colors()));
            g.setSignaturePieceTypesJson(Json.write(sig.types()));
            g.setMemberIdsJson(Json.write(members.stream().map(UUID::toString).toList()));
            g.setMemberCount(members.size());
            g.setHypeScoreGlobal(dec(avg));
            g.setComputedAt(Instant.now());
            groups.save(g);
            for (UUID id : members) {
                pById.get(id).setHypeGroupId(g.getId());
                pById.get(id).setHypeScoreGlobal(dec(avg));
                grouped.add(id);
            }
            count++;
        }
        for (WardrobeItem w : publicPieces) {
            if (!grouped.contains(w.getId())) {
                w.setHypeGroupId(null);
                w.setHypeScoreGlobal(w.getHypeScore());
            }
        }
        return count;
    }

    private boolean groupExists(UUID id) {
        return groups.findById(id).isPresent();
    }

    /** Agrupamento guloso: similaridade ponderada ≥ 0,70 com o representante; grupos com ≥ 3 membros. */
    static List<List<Integer>> cluster(List<Similarity.Signature> sigs) {
        List<List<Integer>> out = new ArrayList<>();
        boolean[] used = new boolean[sigs.size()];
        for (int i = 0; i < sigs.size(); i++) {
            if (used[i]) {
                continue;
            }
            List<Integer> members = new ArrayList<>(List.of(i));
            for (int j = i + 1; j < sigs.size(); j++) {
                if (!used[j] && Similarity.weighted(sigs.get(i), sigs.get(j)) >= Similarity.GROUP_THRESHOLD) {
                    members.add(j);
                }
            }
            if (members.size() >= 3) {
                members.forEach(k -> used[k] = true);
                out.add(members);
            }
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> hypeGroups(HypeEntityType type) {
        return groups.findByEntityType(type).stream().map(g -> Map.<String, Object>of("id", g.getId(), "style", String.valueOf(g.getSignatureStyle()),
                "occasion", String.valueOf(g.getSignatureOccasion()), "members", g.getMemberCount(), "hypeScoreGlobal", g.getHypeScoreGlobal(),
                "computedAt", g.getComputedAt())).toList();
    }

    public Map<String, Object> describe() {
        Calibration c = calibration(HypeEntityType.SCHEME);
        return Map.of("alpha", ALPHA, "beta", BETA, "calibrationDays", CALIBRATION_DAYS, "trendDays", TREND_DAYS, "weeklyDays", WEEKLY_DAYS,
                "referenceSchemes", c.n(), "activeUsers", c.activeUsers(), "calibratedAt", c.computedAt(), "weeklyPopulation", weekly().n());
    }
}
