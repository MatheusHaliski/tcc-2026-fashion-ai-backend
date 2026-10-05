package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeCalculator.Baseline;
import br.com.fashionai.application.hype.HypeResult.HypeReason;
import br.com.fashionai.application.hype.HypeScoreConfig.Dimension;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.HypeScoreSnapshot;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.HypeScoreSnapshotRepository;
import br.com.fashionai.domain.repository.HypeSignalDailyRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * HypeScore v2 — job de snapshots periódicos. Lê o agregado diário de sinais, monta as entradas de cada peça e look,
 * calcula com {@link HypeCalculator} e grava (1) o estado atual em {@code hype_scores} e (2) um ponto por dia em
 * {@code hype_score_snapshots}, ambos com {@code algorithm_version}. O GET nunca recalcula: lê o que este job gravou.
 *
 * <p>Privacidade: só peças/looks públicos, aprovados e de contas fora do modo de teste formam a régua (percentis) e ficam
 * {@code publicEligible} (ranking, tendência pública, estatística global). Itens privados recebem um Hype pessoal, visível
 * só para o dono, calculado contra a régua pública.</p>
 */
@Service
public class HypeSnapshotService {
    private static final Logger log = LoggerFactory.getLogger(HypeSnapshotService.class);

    private final HypeScoreConfig config;
    private final HypeCalculator calculator;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final HypeSignalDailyRepository signals;
    private final HypeScoreCurrentRepository current;
    private final HypeScoreSnapshotRepository snapshots;
    private final HypeCache cache;

    public HypeSnapshotService(HypeScoreConfig config, WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                               HypeSignalDailyRepository signals, HypeScoreCurrentRepository current, HypeScoreSnapshotRepository snapshots,
                               HypeCache cache) {
        this.config = config;
        this.calculator = new HypeCalculator(config);
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.signals = signals;
        this.current = current;
        this.snapshots = snapshots;
        this.cache = cache;
    }

    /** Entrada de uma entidade + metadados que vão para o read model (recortes do ranking, dono, elegibilidade). */
    record Entry(UUID id, UUID ownerId, HypeInputs inputs, boolean publicEligible, String category, String styles, String occasions,
                 String country, String region, String categories, String subcategories) {
        /** Forma curta (sem recortes regionais e de subcategoria). */
        Entry(UUID id, UUID ownerId, HypeInputs inputs, boolean publicEligible, String category, String styles, String occasions) {
            this(id, ownerId, inputs, publicEligible, category, styles, occasions, null, null, null, null);
        }
    }

    /** País (ISO-2, maiúsculo) e região do mundo do dono — a mesma tabela WorldRegions do Painel global. */
    static String[] place(br.com.fashionai.domain.model.User u) {
        String country = u == null || u.getCountry() == null || u.getCountry().isBlank() ? null : u.getCountry().trim().toUpperCase(Locale.ROOT);
        return new String[]{country, country == null ? null : br.com.fashionai.application.taxonomy.WorldRegions.of(country)};
    }

    static String csvOf(java.util.stream.Stream<String> values, int max) {
        String joined = values.filter(v -> v != null && !v.isBlank()).distinct().sorted().collect(Collectors.joining(","));
        if (joined.isEmpty()) {
            return null;
        }
        if (joined.length() <= max) {
            return joined;
        }
        int cut = joined.lastIndexOf(',', max);   // corta numa vírgula: nunca deixa um valor pela metade
        return cut > 0 ? joined.substring(0, cut) : null;
    }

    /** Contagens por tipo de sinal da execução corrente (preenchido no início do recálculo, lido no persist). */
    private final Map<HypeEntityType, Map<UUID, Map<String, Map<String, Object>>>> byType = new java.util.EnumMap<>(HypeEntityType.class);

    /**
     * Sinais reais de cada entidade por tipo (curtidas, salvos, usos…): eventos na janela atual, na anterior e no
     * horizonte inteiro. É o que a análise completa mostra ao lado das dimensões — números de verdade, não só o score.
     */
    static Map<UUID, Map<String, Map<String, Object>>> signalCounts(List<br.com.fashionai.domain.model.HypeSignalDaily> rows, LocalDate today, int windowDays) {
        Map<UUID, Map<String, Map<String, Object>>> out = new HashMap<>();
        for (br.com.fashionai.domain.model.HypeSignalDaily row : rows) {
            long age = ChronoUnit.DAYS.between(row.getSignalDate(), today);
            Map<String, Object> c = out.computeIfAbsent(row.getEntityId(), k -> new java.util.TreeMap<>())
                    .computeIfAbsent(row.getSignalType().name(), k -> new LinkedHashMap<>(Map.of("current", 0L, "previous", 0L, "total", 0L)));
            long n = row.getEventCount();
            c.put("total", (Long) c.get("total") + n);
            if (age >= 0 && age < windowDays) {
                c.put("current", (Long) c.get("current") + n);
            } else if (age >= windowDays && age < 2L * windowDays) {
                c.put("previous", (Long) c.get("previous") + n);
            }
        }
        return out;
    }

    @Transactional
    @Scheduled(cron = "${fashionai.hype.cron:0 20 */6 * * *}", zone = "America/Sao_Paulo")
    public synchronized Map<String, Object> recalculate() {
        Instant now = Instant.now();
        LocalDate today = LocalDate.now(HypeSignalRecorder.ZONE);
        LocalDate since = today.minusDays(config.horizonDays() - 1L);
        List<WardrobeItem> allPieces = pieces.findAll().stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
        List<Scheme> allSchemes = schemes.findAll().stream().filter(s -> s.getStatus() != SchemeStatus.ARCHIVED).toList();
        Map<UUID, List<SchemeItem>> itemsBy = allSchemes.isEmpty() ? Map.of()
                : schemeItems.findBySchemeIdIn(allSchemes.stream().map(Scheme::getId).toList()).stream()
                .collect(Collectors.groupingBy(si -> si.getScheme().getId()));
        List<br.com.fashionai.domain.model.HypeSignalDaily> pieceRows = signals.findByEntityTypeAndSignalDateGreaterThanEqual(HypeEntityType.PIECE, since);
        List<br.com.fashionai.domain.model.HypeSignalDaily> schemeRows = signals.findByEntityTypeAndSignalDateGreaterThanEqual(HypeEntityType.SCHEME, since);
        Map<UUID, HypeSignalSeries> pieceSeries = HypeSignalSeries.build(pieceRows, today, config);
        Map<UUID, HypeSignalSeries> schemeSeries = HypeSignalSeries.build(schemeRows, today, config);
        byType.put(HypeEntityType.PIECE, signalCounts(pieceRows, today, config.windowDays()));
        byType.put(HypeEntityType.SCHEME, signalCounts(schemeRows, today, config.windowDays()));

        List<Entry> pieceEntries = pieceEntries(allPieces, pieceSeries, now);
        Map<UUID, Entry> pieceById = pieceEntries.stream().collect(Collectors.toMap(Entry::id, Function.identity()));
        List<Entry> schemeEntries = schemeEntries(allSchemes, itemsBy, schemeSeries, pieceById, now);

        int pieceCount = persist(HypeEntityType.PIECE, pieceEntries, today, now);
        int schemeCount = persist(HypeEntityType.SCHEME, schemeEntries, today, now);
        cache.bump();
        log.info("HypeScore {}: {} peças e {} looks recalculados", config.algorithmVersion(), pieceCount, schemeCount);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("algorithmVersion", config.algorithmVersion());
        out.put("pieces", pieceCount);
        out.put("schemes", schemeCount);
        out.put("publicPieces", pieceEntries.stream().filter(Entry::publicEligible).count());
        out.put("publicSchemes", schemeEntries.stream().filter(Entry::publicEligible).count());
        out.put("calculatedAt", now.toString());
        return out;
    }

    // ================================================================== peças
    static boolean publicPiece(WardrobeItem w) {
        return w.getVisibility() == Visibility.PUBLIC && w.getUser().getProfileVisibility() != Visibility.PRIVATE
                && w.getModerationStatus() == ModerationStatus.APPROVED && !w.getUser().isTestAccount();
    }

    /** "Modelo" da peça para raridade e tendência das semelhantes: produto do catálogo ou categoria + subcategoria + marca. */
    static String cohortKey(WardrobeItem w) {
        if (w.getCatalogProductId() != null) {
            return "cat:" + w.getCatalogProductId();
        }
        return "k:" + w.getCategory() + "|" + w.getSubcategory() + "|" + (w.getBrandName() == null ? "" : w.getBrandName().trim().toLowerCase(Locale.ROOT));
    }

    static boolean limitedEdition(String tags) {
        if (tags == null) {
            return false;
        }
        String t = tags.toLowerCase(Locale.ROOT);
        return t.contains("limitad") || t.contains("limited") || t.contains("exclusiv");
    }

    List<Entry> pieceEntries(List<WardrobeItem> all, Map<UUID, HypeSignalSeries> series, Instant now) {
        int w = config.windowDays();
        // presença do modelo entre os donos (agregado não identificável)
        Map<String, Set<UUID>> owners = new HashMap<>();
        Set<UUID> allOwners = new HashSet<>();
        Map<String, double[]> cohortWindows = new HashMap<>();
        for (WardrobeItem p : all) {
            owners.computeIfAbsent(cohortKey(p), k -> new HashSet<>()).add(p.getUser().getId());
            allOwners.add(p.getUser().getId());
            HypeSignalSeries s = series.get(p.getId());
            if (s != null && publicPiece(p)) {   // tendência das semelhantes só com dados públicos
                double[] acc = cohortWindows.computeIfAbsent(cohortKey(p), k -> new double[2]);
                acc[0] += s.activityBetween(0, w);
                acc[1] += s.activityBetween(w, 2 * w);
            }
        }
        Map<String, Integer> freq = new HashMap<>();
        all.forEach(p -> attributeKeys(p).forEach(k -> freq.merge(k, 1, Integer::sum)));
        List<Entry> out = new ArrayList<>();
        for (WardrobeItem p : all) {
            HypeSignalSeries s = series.getOrDefault(p.getId(), HypeSignalSeries.empty(config.horizonDays()));
            boolean pub = publicPiece(p);
            String key = cohortKey(p);
            double presence = (double) owners.get(key).size() / Math.max(1, allOwners.size());
            double[] cw = cohortWindows.getOrDefault(key, new double[2]).clone();
            if (pub) {   // as semelhantes são as OUTRAS peças do modelo
                cw[0] -= s.activityBetween(0, w);
                cw[1] -= s.activityBetween(w, 2 * w);
            }
            Double cohortGrowth = cw[0] + cw[1] >= 3 ? ((cw[0] + config.growthSmoothing()) / (cw[1] + config.growthSmoothing()) - 1) * 100 : null;
            double lifetime = p.getLikesCount() + p.getCommentCount() + p.getSharesCount() + p.getRemixesCount();
            HypeInputs in = new HypeInputs(HypeEntityType.PIECE, s.activity(), s.interactions(), s.views(), s.windows(), lifetime, p.getViewCount(),
                    s.totalEvents(), ageDays(p.getCreatedAt(), now), presence, cohortGrowth, surprise(attributeKeys(p), freq, all.size()), null,
                    limitedEdition(p.getTags()));
            String[] place = place(p.getUser());
            out.add(new Entry(p.getId(), p.getUser().getId(), in, pub, p.getCategory(), trim(p.getStyleTags()), trim(p.getOccasionTags()),
                    place[0], place[1], p.getCategory(), p.getSubcategory()));
        }
        return out;
    }

    static List<String> attributeKeys(WardrobeItem p) {
        List<String> keys = new ArrayList<>();
        if (p.getCategory() != null && p.getColor() != null) {
            keys.add("cc:" + p.getCategory() + "|" + p.getColor());
        }
        if (p.getCategory() != null && p.getMaterial() != null) {
            keys.add("cm:" + p.getCategory() + "|" + p.getMaterial());
        }
        Json.csv(p.getStyleTags()).forEach(st -> keys.add("st:" + p.getCategory() + "|" + st));
        return keys;
    }

    /** Autoinformação média (bits) dos atributos: combinação comum ≈ 0, combinação rara = muitos bits. */
    static Double surprise(Collection<String> keys, Map<String, Integer> freq, int population) {
        if (keys.isEmpty() || population <= 0) {
            return null;
        }
        return keys.stream().mapToDouble(k -> -Math.log((double) Math.max(1, freq.getOrDefault(k, 1)) / population) / Math.log(2)).average().orElse(0);
    }

    // ================================================================== looks
    static boolean publicScheme(Scheme s) {
        return s.getVisibility() == Visibility.PUBLIC && s.getStatus() == SchemeStatus.PUBLISHED
                && s.getUser().getProfileVisibility() != Visibility.PRIVATE && !s.getUser().isTestAccount();
    }

    List<Entry> schemeEntries(List<Scheme> all, Map<UUID, List<SchemeItem>> itemsBy, Map<UUID, HypeSignalSeries> series, Map<UUID, Entry> pieceById, Instant now) {
        // influência: remixes diretos + looks derivados dos remixes (segunda geração)
        Map<UUID, List<UUID>> children = new HashMap<>();
        all.forEach(s -> {
            if (s.getOriginalScheme() != null) {
                children.computeIfAbsent(s.getOriginalScheme().getId(), k -> new ArrayList<>()).add(s.getId());
            }
        });
        Map<String, Integer> freq = new HashMap<>();
        Map<UUID, List<String>> keysBy = new HashMap<>();
        for (Scheme s : all) {
            List<String> keys = lookKeys(s, itemsBy.getOrDefault(s.getId(), List.of()));
            keysBy.put(s.getId(), keys);
            new HashSet<>(keys).forEach(k -> freq.merge(k, 1, Integer::sum));
        }
        List<Entry> out = new ArrayList<>();
        for (Scheme s : all) {
            HypeSignalSeries ss = series.getOrDefault(s.getId(), HypeSignalSeries.empty(config.horizonDays()));
            List<SchemeItem> items = itemsBy.getOrDefault(s.getId(), List.of());
            // raridade do look = exclusividade média das peças (presença dos modelos), nunca "poucas interações"
            List<Double> presences = items.stream().map(si -> pieceById.get(si.getWardrobeItem().getId())).filter(e -> e != null && e.inputs().cohortPresence() != null)
                    .map(e -> e.inputs().cohortPresence()).toList();
            Double presence = presences.isEmpty() ? null : presences.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            boolean limited = items.stream().anyMatch(si -> limitedEdition(si.getWardrobeItem().getTags()));
            long direct = s.getRemixCount();
            long second = children.getOrDefault(s.getId(), List.of()).stream().mapToLong(c -> children.getOrDefault(c, List.of()).size()).sum();
            double influence = direct + 0.5 * second;
            double lifetime = s.getLikeCount() + s.getCommentCount() + s.getShareCount() + s.getSaveCount() + s.getRemixCount();
            HypeInputs in = new HypeInputs(HypeEntityType.SCHEME, ss.activity(), ss.interactions(), ss.views(), ss.windows(), lifetime, s.getViewCount(),
                    ss.totalEvents(), ageDays(s.getPublishedAt() != null ? s.getPublishedAt() : s.getCreatedAt(), now), presence, null,
                    surprise(keysBy.get(s.getId()), freq, all.size()), influence, limited);
            String[] place = place(s.getUser());
            // o look entra nos recortes de categoria/subcategoria das peças que o compõem
            out.add(new Entry(s.getId(), s.getUser().getId(), in, publicScheme(s), null, trim(s.getStyle()), trim(s.getOccasion()), place[0], place[1],
                    csvOf(items.stream().map(si -> si.getWardrobeItem().getCategory()), 255),
                    csvOf(items.stream().map(si -> si.getWardrobeItem().getSubcategory()), 1000)));
        }
        return out;
    }

    /** Combinações do look: pares de peças (categoria+cor) e estilo×ocasião — "combinações incomuns" viram originalidade. */
    static List<String> lookKeys(Scheme s, List<SchemeItem> items) {
        List<String> parts = items.stream().map(si -> si.getWardrobeItem().getCategory() + ":" + si.getWardrobeItem().getColor()).sorted().toList();
        List<String> keys = new ArrayList<>();
        for (int i = 0; i < parts.size(); i++) {
            for (int j = i + 1; j < parts.size(); j++) {
                keys.add("pair:" + parts.get(i) + "+" + parts.get(j));
            }
        }
        for (String st : Json.csv(s.getStyle())) {
            for (String oc : Json.csv(s.getOccasion())) {
                keys.add("so:" + st + "|" + oc);
            }
        }
        return keys;
    }

    // ================================================================== persistência
    int persist(HypeEntityType type, List<Entry> entries, LocalDate today, Instant now) {
        String version = config.algorithmVersion();
        Baseline base = calculator.baseline(entries.stream().filter(Entry::publicEligible).map(Entry::inputs).toList());
        Map<UUID, HypeScoreCurrent> existing = current.findByEntityTypeAndAlgorithmVersion(type, version).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a));
        Map<UUID, HypeScoreSnapshot> todays = snapshots.findByEntityTypeAndAlgorithmVersionAndSnapshotDateBetween(type, version, today, today).stream()
                .collect(Collectors.toMap(HypeScoreSnapshot::getEntityId, Function.identity(), (a, b) -> a));
        Map<UUID, Double> deltaBase = deltaBase(type, version, today);
        Instant windowStart = now.minus(config.horizonDays(), ChronoUnit.DAYS);
        List<HypeScoreCurrent> toSave = new ArrayList<>();
        List<HypeScoreSnapshot> toSnap = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        for (Entry e : entries) {
            HypeResult r = calculator.compute(e.inputs(), base);
            seen.add(e.id());
            HypeScoreCurrent c = existing.getOrDefault(e.id(), new HypeScoreCurrent());
            c.setEntityType(type);
            c.setEntityId(e.id());
            c.setOwnerId(e.ownerId());
            c.setAlgorithmVersion(version);
            c.setStatus(r.status());
            c.setScore(dec(r.score()));
            c.setLevel(r.level());
            c.setDimensions(dimensions(r.dimensions()));
            Double baseScore = deltaBase.get(e.id());
            if (r.score() != null && baseScore != null) {
                c.setDeltaPoints(dec(r.score() - baseScore));
                c.setDeltaPercent(baseScore > 0 ? dec((r.score() - baseScore) / baseScore * 100) : null);
                c.setDirection(calculator.direction(r.score(), baseScore));
            } else {
                c.setDeltaPoints(null);
                c.setDeltaPercent(null);
                c.setDirection(null);
            }
            c.setMomentum(r.momentum());
            c.setPublicEligible(e.publicEligible());
            c.setCategory(e.category());
            c.setStyles(e.styles());
            c.setOccasions(e.occasions());
            c.setCountry(e.country());
            c.setRegion(e.region());
            c.setCategories(e.categories());
            c.setSubcategories(e.subcategories());
            Map<String, Object> sig = new LinkedHashMap<>(r.signals());
            sig.put("ageDays", e.inputs().ageDays());
            // contagem real por tipo de sinal (janela atual × anterior × horizonte): o que a análise completa lista
            sig.put("byType", byType.getOrDefault(type, Map.of()).getOrDefault(e.id(), Map.of()));
            c.setSignalsJson(Json.write(sig));
            c.setReasonsJson(Json.write(r.reasons().stream().map(HypeSnapshotService::reason).toList()));
            c.setWindowStart(windowStart);
            c.setWindowEnd(now);
            c.setCalculatedAt(now);
            toSave.add(c);

            HypeScoreSnapshot s = todays.getOrDefault(e.id(), new HypeScoreSnapshot());
            s.setEntityType(type);
            s.setEntityId(e.id());
            s.setAlgorithmVersion(version);
            s.setSnapshotDate(today);
            s.setStatus(r.status());
            s.setScore(dec(r.score()));
            s.setLevel(r.level());
            s.setDimensions(dimensions(r.dimensions()));
            s.setPublicEligible(e.publicEligible());
            s.setWindowStart(windowStart);
            s.setWindowEnd(now);
            s.setCalculatedAt(now);
            toSnap.add(s);
        }
        current.saveAll(toSave);
        snapshots.saveAll(toSnap);
        // entidade arquivada/excluída sai do estado atual (e, portanto, de qualquer ranking); o histórico fica
        List<HypeScoreCurrent> gone = existing.values().stream().filter(c -> !seen.contains(c.getEntityId())).toList();
        current.deleteAll(gone);
        return toSave.size();
    }

    /** Score de referência para o delta: o snapshot mais recente com data ≤ hoje − janela (até 3 dias antes disso). */
    Map<UUID, Double> deltaBase(HypeEntityType type, String version, LocalDate today) {
        LocalDate target = today.minusDays(config.deltaWindowDays());
        Map<UUID, HypeScoreSnapshot> best = new HashMap<>();
        for (HypeScoreSnapshot s : snapshots.findByEntityTypeAndAlgorithmVersionAndSnapshotDateBetween(type, version, target.minusDays(3), target)) {
            if (s.getScore() == null) {
                continue;
            }
            best.merge(s.getEntityId(), s, (a, b) -> a.getSnapshotDate().isAfter(b.getSnapshotDate()) ? a : b);
        }
        Map<UUID, Double> out = new HashMap<>();
        best.forEach((id, s) -> out.put(id, s.getScore().doubleValue()));
        return out;
    }

    static Map<String, Object> reason(HypeReason r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", r.code());
        m.put("tone", r.tone());
        if (r.dimension() != null) {
            m.put("dimension", r.dimension());
        }
        if (r.value() != null) {
            m.put("value", r.value());
        }
        return m;
    }

    static HypeDimensions dimensions(Map<Dimension, Double> d) {
        HypeDimensions out = new HypeDimensions();
        out.setPopularity(dec(d.get(Dimension.POPULARITY)));
        out.setEngagement(dec(d.get(Dimension.ENGAGEMENT)));
        out.setTrend(dec(d.get(Dimension.TREND)));
        out.setTrendVelocity(dec(d.get(Dimension.TREND_VELOCITY)));
        out.setNovelty(dec(d.get(Dimension.NOVELTY)));
        out.setLongevity(dec(d.get(Dimension.LONGEVITY)));
        out.setRarity(dec(d.get(Dimension.RARITY)));
        out.setOriginality(dec(d.get(Dimension.ORIGINALITY)));
        out.setInfluence(dec(d.get(Dimension.INFLUENCE)));
        return out;
    }

    static BigDecimal dec(Double v) {
        return v == null ? null : BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }

    static int ageDays(Instant created, Instant now) {
        return created == null ? 0 : (int) Math.max(0, ChronoUnit.DAYS.between(created, now));
    }

    private static String trim(String csv) {
        return csv == null ? null : csv.length() > 255 ? csv.substring(0, 255) : csv;
    }
}
