package br.com.fashionai.application.service;

import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.InventoryScoreSnapshot;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.RankingOptIn;
import br.com.fashionai.domain.model.RankingPosition;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeAvailabilityChange;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;
import br.com.fashionai.domain.repository.InventoryScoreSnapshotRepository;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.RankingOptInRepository;
import br.com.fashionai.domain.repository.RankingPositionRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeAvailabilityChangeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * RF34 — FAI Inventory Score (02-inventory-score-calculo.md): rubrica absoluta 0–1000 de 7 dimensões (0–100),
 * princípio anti-quantidade (só razões/médias/entropias; volume entra apenas no fator k que satura em 20 peças),
 * antifraude (§5), snapshots diários/mensais (§7), rankings por percentil com opt-in (§6, RNF6), Seus Destaques,
 * evolução mensal, recordes (DET-G05), Álbum de Combinações (DET-G01) e Retrospectiva (DET-K01).
 */
@Service
public class InventoryScoreService {
    public static final int WINDOW_DAYS = 90;
    public static final int MIN_PIECES = 10;
    public static final int SATURATION = 20;
    public static final int MIN_EXPOSURE_DAYS = 7;
    public static final int REVIEW_DAYS = 30;
    public static final int CITY_K_ANONYMITY = 50;
    static final Duration CACHE_TTL = Duration.ofHours(1);
    static final Map<String, Double> WEIGHTS = new LinkedHashMap<>();
    static final Map<String, String> NAMES = new LinkedHashMap<>();
    /** Grupos de ocasião de referência da cobertura (§3.2). */
    static final Map<String, List<String>> OCCASION_GROUPS = new LinkedHashMap<>();
    static final Set<String> COMBO_CATEGORIES = Set.of("upper_piece", "lower_piece", "shoes_piece", "full_body_piece");

    public record Band(int min, int max, String label) {
    }

    public static final List<Band> BANDS = List.of(new Band(0, 299, Msg.k("inventoryScore.em_montagem")), new Band(300, 499, "Organizado"),
            new Band(500, 649, Msg.k("inventoryScore.versatil")), new Band(650, 799, Msg.k("inventoryScore.bem_curado")), new Band(800, 899, Msg.k("inventoryScore.closet_inteligente")),
            new Band(900, 959, Msg.k("common.signature_closet")), new Band(960, 1000, Msg.k("inventoryScore.maison_closet")));

    static {
        WEIGHTS.put("C", 0.20);
        WEIGHTS.put("U", 0.20);
        WEIGHTS.put("V", 0.15);
        WEIGHTS.put("R", 0.13);
        WEIGHTS.put("D", 0.12);
        WEIGHTS.put("O", 0.10);
        WEIGHTS.put("I", 0.10);
        NAMES.put("C", Msg.k("common.catalogacao"));
        NAMES.put("U", Msg.k("common.utilizacao"));
        NAMES.put("V", "Versatilidade");
        NAMES.put("R", "Descoberta");
        NAMES.put("D", "Diversidade");
        NAMES.put("O", Msg.k("common.organizacao"));
        NAMES.put("I", "Identidade");
        OCCASION_GROUPS.put("faculdade/trabalho", List.of("university", "school", "work", "business"));
        OCCASION_GROUPS.put("casual", List.of("casual", "home", "travel", "outdoor", "vacation"));
        OCCASION_GROUPS.put("social", List.of("social", "formal", "wedding", "ceremony", "date"));
        OCCASION_GROUPS.put("esporte", List.of("sport", "gym"));
        OCCASION_GROUPS.put("festa", List.of("party", "night_out", "festival"));
    }

    public static String band(int score) {
        return BANDS.stream().filter(b -> score >= b.min() && score <= b.max()).map(Band::label).findFirst().orElse(Msg.t("inventoryScore.em_montagem"));
    }

    public record Dimension(String code, String name, Integer value, double weight, String rule, List<Map<String, Object>> pullingDown) {
    }

    public record Result(UUID userId, boolean eligible, int pieces, double k, Integer score, String band, Map<String, Integer> dims,
                         Map<String, Object> metrics, List<Dimension> dimensions, Instant computedAt) {
    }

    private record Cached(Result result, Instant at) {
    }

    private final Map<UUID, Cached> cache = new ConcurrentHashMap<>();

    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final PieceUsageDiaryEntryRepository diary;
    private final WardrobeAvailabilityChangeRepository availability;
    private final StyleDnaRepository dnas;
    private final InventoryScoreSnapshotRepository snapshots;
    private final RankingOptInRepository optIns;
    private final RankingPositionRepository positions;
    private final ChallengeTemplateRepository templates;
    private final UserRepository users;
    private final RoomService room;
    private final AchievementService achievements;
    private final SideEffectRunner sideEffects;

    public InventoryScoreService(WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                                 PieceUsageDiaryEntryRepository diary, WardrobeAvailabilityChangeRepository availability,
                                 StyleDnaRepository dnas, InventoryScoreSnapshotRepository snapshots, RankingOptInRepository optIns,
                                 RankingPositionRepository positions, ChallengeTemplateRepository templates, UserRepository users,
                                 RoomService room, AchievementService achievements, SideEffectRunner sideEffects) {
        this.sideEffects = sideEffects;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.diary = diary;
        this.availability = availability;
        this.dnas = dnas;
        this.snapshots = snapshots;
        this.optIns = optIns;
        this.positions = positions;
        this.templates = templates;
        this.users = users;
        this.room = room;
        this.achievements = achievements;
    }

    // ================================================================== completude (§3.1) — também usada pelo RF4/RF35
    public static int completeness(WardrobeItem w) {
        Map<String, Double> detected = detectedConfidence(w);
        Map<String, Object> det = detected(w);
        int total = 0;
        total += field("category", w.getCategory() != null, 15, det, detected, w.getCategory());
        total += field("color", w.getColor() != null, 15, det, detected, w.getColor());
        total += !Json.csv(w.getOccasionTags()).isEmpty() ? 15 : 0;
        total += !Json.csv(w.getStyleTags()).isEmpty() ? 15 : 0;
        total += w.getImageUrl() != null && !w.isDefaultImage() && w.getModerationStatus() == ModerationStatus.APPROVED ? 15 : 0;
        total += field("material", w.getMaterial() != null, 10, det, detected, w.getMaterial());
        total += field("brand", (w.getBrand() != null || (w.getBrandName() != null && !w.getBrandName().isBlank())), 10, det, detected,
                w.getBrand() != null ? w.getBrand().getName() : w.getBrandName());
        total += w.getModel3dUrl() != null ? 5 : 0;
        return total;
    }

    /** Antifraude §5 — campo divergente da detecção da IA (RF4) com confiança alta conta 50%. */
    private static int field(String name, boolean filled, int weight, Map<String, Object> det, Map<String, Double> conf, String value) {
        if (!filled) {
            return 0;
        }
        Object detectedValue = det.get(name);
        Double c = conf.get(name);
        if (detectedValue != null && c != null && c >= 0.85 && value != null
                && !String.valueOf(detectedValue).equalsIgnoreCase(value)) {
            return weight / 2;
        }
        return weight;
    }

    static Map<String, Object> detected(WardrobeItem w) {
        Object d = Json.map(w.getFlatLayMetadataJson()).get("detected");
        return d instanceof Map<?, ?> m ? m.entrySet().stream().filter(e -> e.getValue() != null)
                .collect(Collectors.toMap(e -> String.valueOf(e.getKey()), Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new)) : Map.of();
    }

    static Map<String, Double> detectedConfidence(WardrobeItem w) {
        Object c = detected(w).get("confidence");
        Map<String, Double> out = new HashMap<>();
        if (c instanceof Map<?, ?> m) {
            m.forEach((k, v) -> {
                if (v instanceof Number n) {
                    out.put(String.valueOf(k), n.doubleValue());
                }
            });
        }
        return out;
    }

    /** Peça pronta para o catálogo (RF35 §5.2, "passa no catalog_readiness_score"): dados essenciais + imagem própria. */
    public static boolean catalogReady(WardrobeItem w) {
        return completeness(w) >= 60 && w.getImageUrl() != null && !w.isDefaultImage();
    }

    // ================================================================== cálculo (§3–§4)
    private static boolean alive(WardrobeItem w) {
        return w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED;
    }

    private static boolean available(WardrobeItem w) {
        return w.isDisponivel() && w.getAvailabilityStatus() == AvailabilityStatus.AVAILABLE;
    }

    static double entropy(Collection<String> values, int m) {
        if (values.isEmpty() || m <= 1) {
            return 0;
        }
        Map<String, Long> counts = values.stream().collect(Collectors.groupingBy(v -> v, Collectors.counting()));
        double n = values.size();
        double h = 0;
        for (long c : counts.values()) {
            double f = c / n;
            h -= f * Math.log(f);
        }
        return Math.max(0, Math.min(1, h / Math.log(m)));
    }

    static Set<String> occ(WardrobeItem w) {
        return new HashSet<>(Json.csv(w.getOccasionTags()));
    }

    static boolean shareOccasion(WardrobeItem a, WardrobeItem b, WardrobeItem c) {
        Set<String> s = occ(a);
        s.retainAll(occ(b));
        if (c != null) {
            s.retainAll(occ(c));
        }
        return !s.isEmpty();
    }

    static Set<String> shared(WardrobeItem a, WardrobeItem b, WardrobeItem c) {
        Set<String> s = occ(a);
        s.retainAll(occ(b));
        if (c != null) {
            s.retainAll(occ(c));
        }
        return s;
    }

    /** Combinações válidas (§3.4) sobre A: (upper+lower+shoes) ou (dress+shoes) com ≥ 1 ocasião em comum. */
    record Combos(Map<UUID, Integer> perPiece, long total, Map<String, Boolean> coverage, List<List<UUID>> sample, boolean enumerated) {
    }

    static Combos combos(List<WardrobeItem> a, int sampleLimit, Set<String> discoveredKeys) {
        List<WardrobeItem> uppers = a.stream().filter(w -> "upper_piece".equals(w.getCategory())).toList();
        List<WardrobeItem> lowers = a.stream().filter(w -> "lower_piece".equals(w.getCategory())).toList();
        List<WardrobeItem> shoes = a.stream().filter(w -> "shoes_piece".equals(w.getCategory())).toList();
        List<WardrobeItem> dresses = a.stream().filter(w -> "full_body_piece".equals(w.getCategory())).toList();
        Map<UUID, Integer> per = new HashMap<>();
        a.forEach(w -> per.put(w.getId(), 0));
        Map<String, Boolean> coverage = new LinkedHashMap<>();
        OCCASION_GROUPS.keySet().forEach(g -> coverage.put(g, false));
        long total = 0;
        List<List<UUID>> sample = new ArrayList<>();
        long work = (long) uppers.size() * lowers.size() * shoes.size() + (long) dresses.size() * shoes.size();
        boolean enumerate = work <= 400_000;
        if (enumerate) {
            for (WardrobeItem u : uppers) {
                for (WardrobeItem l : lowers) {
                    if (!shareOccasion(u, l, null)) {
                        continue;
                    }
                    for (WardrobeItem s : shoes) {
                        Set<String> sh = shared(u, l, s);
                        if (sh.isEmpty()) {
                            continue;
                        }
                        total++;
                        per.merge(u.getId(), 1, Integer::sum);
                        per.merge(l.getId(), 1, Integer::sum);
                        per.merge(s.getId(), 1, Integer::sum);
                        markCoverage(coverage, sh);
                        if (sample.size() < sampleLimit && discoveredKeys != null
                                && !discoveredKeys.contains(SchemeService.combinationKey(List.of(u.getId(), l.getId(), s.getId())))) {
                            sample.add(List.of(u.getId(), l.getId(), s.getId()));
                        }
                    }
                }
            }
            for (WardrobeItem d : dresses) {
                for (WardrobeItem s : shoes) {
                    Set<String> sh = shared(d, s, null);
                    if (sh.isEmpty()) {
                        continue;
                    }
                    total++;
                    per.merge(d.getId(), 1, Integer::sum);
                    per.merge(s.getId(), 1, Integer::sum);
                    markCoverage(coverage, sh);
                    if (sample.size() < sampleLimit && discoveredKeys != null
                            && !discoveredKeys.contains(SchemeService.combinationKey(List.of(d.getId(), s.getId())))) {
                        sample.add(List.of(d.getId(), s.getId()));
                    }
                }
            }
        } else {
            // §7 — contagem por grupos de ocasião (limite inferior por peça: maior grupo em que ela participa)
            for (String o : Taxonomy.OCCASIONS) {
                List<WardrobeItem> uo = uppers.stream().filter(w -> occ(w).contains(o)).toList();
                List<WardrobeItem> lo = lowers.stream().filter(w -> occ(w).contains(o)).toList();
                List<WardrobeItem> so = shoes.stream().filter(w -> occ(w).contains(o)).toList();
                List<WardrobeItem> dO = dresses.stream().filter(w -> occ(w).contains(o)).toList();
                long t = (long) uo.size() * lo.size() * so.size() + (long) dO.size() * so.size();
                if (t > 0) {
                    markCoverage(coverage, Set.of(o));
                }
                total = Math.max(total, t);
                for (WardrobeItem u : uo) {
                    per.merge(u.getId(), lo.size() * so.size(), Math::max);
                }
                for (WardrobeItem l : lo) {
                    per.merge(l.getId(), uo.size() * so.size(), Math::max);
                }
                for (WardrobeItem s : so) {
                    per.merge(s.getId(), uo.size() * lo.size() + dO.size(), Math::max);
                }
                for (WardrobeItem d : dO) {
                    per.merge(d.getId(), so.size(), Math::max);
                }
            }
        }
        return new Combos(per, total, coverage, sample, enumerate);
    }

    private static void markCoverage(Map<String, Boolean> coverage, Set<String> sharedOccasions) {
        OCCASION_GROUPS.forEach((g, codes) -> {
            if (!coverage.get(g) && codes.stream().anyMatch(sharedOccasions::contains)) {
                coverage.put(g, true);
            }
        });
    }

    /** Uso por peça e dia (diário), respeitando o antifraude: esquema com ≥ 2 peças que sobreviveu 24 h. */
    Map<UUID, TreeSet<LocalDate>> usageDays(UUID userId, LocalDate since, Map<UUID, Scheme> schemeById) {
        Map<UUID, TreeSet<LocalDate>> out = new HashMap<>();
        Instant survival = Instant.now().minus(24, ChronoUnit.HOURS);
        for (PieceUsageDiaryEntry e : diary.findByUserIdAndUsedOnAfter(userId, since)) {
            if ("SCHEME".equals(e.getSource()) || "DAILY_LOOK".equals(e.getSource())) {
                Scheme s = e.getSchemeId() == null ? null : schemeById.get(e.getSchemeId());
                if (s == null || s.getCreatedAt() == null || s.getCreatedAt().isAfter(survival)) {
                    continue;
                }
            }
            out.computeIfAbsent(e.getWardrobeItemId(), k -> new TreeSet<>()).add(e.getUsedOn());
        }
        return out;
    }

    /** Dias de exposição (disponível) na janela, a partir do histórico de transições (§3.3). */
    Map<UUID, Long> exposureDays(UUID userId, List<WardrobeItem> all, LocalDate since, LocalDate today) {
        Map<UUID, List<WardrobeAvailabilityChange>> byPiece = availability.findByUserIdOrderByChangedAtAsc(userId).stream()
                .collect(Collectors.groupingBy(WardrobeAvailabilityChange::getWardrobeItemId));
        Map<UUID, Long> out = new HashMap<>();
        Instant start = since.atStartOfDay(FaiPointsService.ZONE).toInstant();
        Instant end = today.plusDays(1).atStartOfDay(FaiPointsService.ZONE).toInstant();
        for (WardrobeItem w : all) {
            List<WardrobeAvailabilityChange> log = byPiece.getOrDefault(w.getId(), List.of());
            Instant cursor = w.getCreatedAt() == null ? start : w.getCreatedAt();
            boolean avail = log.isEmpty() ? available(w) : true; // sem log: estado atual desde o cadastro; com log: começa disponível no cadastro
            long seconds = 0;
            for (WardrobeAvailabilityChange c : log) {
                Instant at = c.getChangedAt();
                if (avail) {
                    seconds += overlap(cursor, at, start, end);
                }
                avail = c.isAvailable();
                cursor = at;
            }
            if (avail) {
                seconds += overlap(cursor, end, start, end);
            }
            out.put(w.getId(), seconds / 86_400);
        }
        return out;
    }

    private static long overlap(Instant a, Instant b, Instant start, Instant end) {
        Instant s = a.isAfter(start) ? a : start;
        Instant e = b.isBefore(end) ? b : end;
        return e.isAfter(s) ? Duration.between(s, e).getSeconds() : 0;
    }

    static double cosine(Map<String, Double> a, Map<String, Double> b) {
        double dot = 0, na = 0, nb = 0;
        for (Map.Entry<String, Double> e : a.entrySet()) {
            dot += e.getValue() * b.getOrDefault(e.getKey(), 0.0);
            na += e.getValue() * e.getValue();
        }
        for (double v : b.values()) {
            nb += v * v;
        }
        return na == 0 || nb == 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
    }

    public static String family(String color) {
        if (color == null) {
            return null;
        }
        String f = Taxonomy.COLOR_FAMILY.get(color);
        if (f != null) {
            return f;
        }
        if (color.startsWith("#")) {
            try {
                return Taxonomy.COLOR_FAMILY.get(ColorMath.nearestTaxonomyColor(ColorMath.parseHex(color)));
            } catch (RuntimeException ex) {
                return null;
            }
        }
        return null;
    }

    /** Mesma conta em transação própria: para quem usa o score como dado opcional e trata a falha (ex.: Copilot). */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public Result computeIsolated(UUID userId, boolean useCache) {
        return compute(userId, useCache);
    }

    @Transactional
    public Result compute(UUID userId, boolean useCache) {
        Cached c = cache.get(userId);
        if (useCache && c != null && c.at().plus(CACHE_TTL).isAfter(Instant.now())) {
            return c.result();
        }
        Result r = computeNow(userId);
        cache.put(userId, new Cached(r, Instant.now()));
        return r;
    }

    Result computeNow(UUID userId) {
        LocalDate today = LocalDate.now(FaiPointsService.ZONE);
        LocalDate since = today.minusDays(WINDOW_DAYS);
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(InventoryScoreService::alive).toList();
        List<WardrobeItem> a = all.stream().filter(InventoryScoreService::available).toList();
        int n = all.size();
        Map<UUID, WardrobeItem> byId = all.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        List<Scheme> allSchemes = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(userId, SchemeStatus.ARCHIVED);
        Map<UUID, Scheme> schemeById = allSchemes.stream().collect(Collectors.toMap(Scheme::getId, s -> s));
        Map<UUID, List<UUID>> schemePieces = new HashMap<>();
        if (!allSchemes.isEmpty()) {
            for (SchemeItem si : schemeItems.findBySchemeIdIn(allSchemes.stream().map(Scheme::getId).toList())) {
                schemePieces.computeIfAbsent(si.getScheme().getId(), k -> new ArrayList<>()).add(si.getWardrobeItem().getId());
            }
        }
        Instant survival = Instant.now().minus(24, ChronoUnit.HOURS);
        Instant sinceInstant = since.atStartOfDay(FaiPointsService.ZONE).toInstant();
        // looks da janela (§3.4/§3.6): esquemas criados/editados na janela que sobreviveram 24 h, com ≥ 2 peças, + Looks do Dia da janela
        List<List<UUID>> windowLooks = new ArrayList<>();
        Set<String> usedKeys = new HashSet<>();
        for (Scheme s : allSchemes) {
            List<UUID> ids = schemePieces.getOrDefault(s.getId(), List.of());
            if (ids.size() < 2 || s.getCreatedAt() == null || s.getCreatedAt().isAfter(survival)) {
                continue;
            }
            boolean inWindow = s.getCreatedAt().isAfter(sinceInstant) || (s.getUpdatedAt() != null && s.getUpdatedAt().isAfter(sinceInstant));
            if (inWindow) {
                windowLooks.add(ids);
            }
        }
        List<PieceUsageDiaryEntry> windowDiary = diary.findByUserIdAndUsedOnAfter(userId, since);
        Set<String> dailySeen = new HashSet<>();
        for (PieceUsageDiaryEntry e : windowDiary) {
            if ("DAILY_LOOK".equals(e.getSource()) && e.getSchemeId() != null && dailySeen.add(e.getSchemeId() + ":" + e.getUsedOn())) {
                List<UUID> ids = schemePieces.getOrDefault(e.getSchemeId(), List.of());
                if (ids.size() >= 2) {
                    windowLooks.add(ids);
                }
            }
        }
        Map<UUID, TreeSet<LocalDate>> usage = usageDays(userId, since, schemeById);
        Map<UUID, TreeSet<LocalDate>> usageAll = usageDays(userId, LocalDate.of(2000, 1, 1), schemeById);

        Map<String, Integer> dims = new LinkedHashMap<>();
        Map<String, Object> metrics = new LinkedHashMap<>();
        List<Dimension> explain = new ArrayList<>();

        // ---- C
        Map<UUID, Integer> compl = new HashMap<>();
        all.forEach(w -> compl.put(w.getId(), completeness(w)));
        int cVal = n == 0 ? 0 : (int) Math.round(compl.values().stream().mapToInt(Integer::intValue).average().orElse(0));
        dims.put("C", cVal);
        explain.add(new Dimension("C", NAMES.get("C"), cVal, WEIGHTS.get("C"), Msg.t("inventoryScore.media_da_completude_das_pecas", cVal),
                all.stream().sorted(Comparator.comparingInt(w -> compl.get(w.getId()))).limit(5)
                        .map(w -> Map.<String, Object>of("pieceId", w.getId(), "name", String.valueOf(w.getName()), "value", compl.get(w.getId()) + "%",
                                "hint", missingFields(w))).toList()));

        // ---- D
        double hCat = entropy(a.stream().map(WardrobeItem::getCategory).filter(Objects::nonNull).toList(), Taxonomy.SUBCATEGORIES.size());
        Set<String> familyValues = new HashSet<>(Taxonomy.COLOR_FAMILY.values());
        double hCol = entropy(a.stream().map(w -> family(w.getColor())).filter(Objects::nonNull).toList(), familyValues.size());
        double hSty = entropy(a.stream().flatMap(w -> Json.csv(w.getStyleTags()).stream()).toList(), Taxonomy.STYLES.size());
        Set<String> discoveredKeys = allSchemes.stream().map(s -> comboKeyOf(schemePieces.getOrDefault(s.getId(), List.of()), byId))
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Combos combos = combos(a, 12, discoveredKeys);
        double cob = combos.coverage().values().stream().mapToDouble(b -> b ? 1 : 0).sum() / OCCASION_GROUPS.size();
        int dVal = (int) Math.round(100 * (0.25 * hCat + 0.25 * hCol + 0.25 * hSty + 0.25 * cob));
        dims.put("D", dVal);
        String weakestAttr = hCat <= hCol && hCat <= hSty ? "categorias" : hCol <= hSty ? Msg.t("inventoryScore.familias_de_cor") : "estilos";
        List<String> uncovered = combos.coverage().entrySet().stream().filter(e -> !e.getValue()).map(Map.Entry::getKey).toList();
        explain.add(new Dimension("D", NAMES.get("D"), dVal, WEIGHTS.get("D"), Msg.t("inventoryScore.variedade_util_das_pecas_disponiveis", pct(hCat), pct(hCol), pct(hSty), pct(cob)), List.of(Map.of("name", Msg.t("inventoryScore.atributo_menos_variado"), "value", weakestAttr, "hint", Msg.t("inventoryScore.cadastre_estilos_cores_diferentes")),
                Map.of("name", Msg.t("inventoryScore.ocasioes_sem_combinacao_completa"), "value", uncovered.isEmpty() ? "nenhuma" : String.join(", ", uncovered),
                        "hint", Msg.t("inventoryScore.falta_peca_superior_inferior_ou")))));

        // ---- U (população de exposição)
        Map<UUID, Long> exposure = exposureDays(userId, all, since, today);
        List<WardrobeItem> exposed = all.stream().filter(w -> exposure.getOrDefault(w.getId(), 0L) >= MIN_EXPOSURE_DAYS).toList();
        long usedInWindow = exposed.stream().filter(w -> usage.containsKey(w.getId())).count();
        int uVal = exposed.isEmpty() ? 0 : (int) Math.round(100.0 * usedInWindow / exposed.size());
        dims.put("U", uVal);
        List<WardrobeItem> forgottenNow = all.stream().filter(w -> available(w))
                .filter(w -> RoomService.forgotten(w, lastUse(w, usageAll), today)).toList();
        explain.add(new Dimension("U", NAMES.get("U"), uVal, WEIGHTS.get("U"), Msg.t("inventoryScore.de_pecas_expostas_disponiveis_por", (usedInWindow), exposed.size(), uVal),
                forgottenNow.stream().sorted(Comparator.comparing(w -> Optional.ofNullable(lastUse(w, usageAll)).orElse(LocalDate.MIN)))
                        .limit(5).map(w -> Map.<String, Object>of("pieceId", w.getId(), "name", String.valueOf(w.getName()),
                                "value", Msg.t("inventoryScore.dias_sem_uso", (daysSince(w, usageAll, today))), "hint", Msg.t("inventoryScore.leve_ao_espelho_ou_a"))).toList()));

        // ---- V
        List<WardrobeItem> comboEligible = a.stream().filter(w -> COMBO_CATEGORIES.contains(w.getCategory())).toList();
        long connected = comboEligible.stream().filter(w -> combos.perPiece().getOrDefault(w.getId(), 0) >= 3).count();
        double conect = comboEligible.isEmpty() ? 0 : (double) connected / comboEligible.size();
        Map<UUID, Long> appearances = windowLooks.stream().flatMap(List::stream).collect(Collectors.groupingBy(id -> id, Collectors.counting()));
        long totalApp = appearances.values().stream().mapToLong(Long::longValue).sum();
        long top3 = appearances.values().stream().sorted(Comparator.reverseOrder()).limit(3).mapToLong(Long::longValue).sum();
        double conc = totalApp == 0 ? 1 : (double) top3 / totalApp; // sem looks: (1 − Conc) = 0
        int vVal = (int) Math.round(100 * (0.6 * conect + 0.4 * (1 - conc)));
        dims.put("V", vVal);
        explain.add(new Dimension("V", NAMES.get("V"), vVal, WEIGHTS.get("V"), Msg.t("inventoryScore.das_pecas_superiores_inferiores_calcados", (pct(conect)), (totalApp == 0 ? Msg.t("inventoryScore.sem_looks_na_janela_o") :
                Msg.t("inventoryScore.das_aparicoes_nos_looks_dos", (pct(conc))))),
                comboEligible.stream().sorted(Comparator.comparingInt(w -> combos.perPiece().getOrDefault(w.getId(), 0))).limit(5)
                        .map(w -> Map.<String, Object>of("pieceId", w.getId(), "name", String.valueOf(w.getName()),
                                "value", Msg.t("inventoryScore.combinacoes", (combos.perPiece().getOrDefault(w.getId(), 0))), "hint", occ(w).isEmpty()
                                        ? Msg.t("inventoryScore.sem_ocasiao_cadastrada_nao_forma") : Msg.t("inventoryScore.precisa_de_pecas_com_ocasiao"))).toList()));

        // ---- O
        RoomLayout layout = room.layout(userId);
        Map<String, String> labels = room.labels(layout);
        Map<String, String> labelSources = room.labelSources(layout);
        Map<UUID, RoomService.Location> where = room.locateAll(userId);
        long coherent = 0, located = 0;
        Set<String> occupiedDrawers = new HashSet<>();
        List<Map<String, Object>> incoherent = new ArrayList<>();
        for (WardrobeItem w : all) {
            RoomService.Location loc = where.get(w.getId());
            if (loc == null) {
                continue;
            }
            located++;
            if (loc.address().zone().equals("drawer")) {
                occupiedDrawers.add(String.valueOf(loc.address().index()));
            }
            if (RoomService.coherent(w, loc.address(), labels)) {
                coherent++;
            } else if (incoherent.size() < 5) {
                incoherent.add(Map.of("pieceId", w.getId(), "name", String.valueOf(w.getName()), "value", loc.label(), "hint", Msg.t("inventoryScore.mova_para_a_posicao_do")));
            }
        }
        double coer = located == 0 ? 1 : (double) coherent / located;
        long labeled = occupiedDrawers.stream().filter(d -> labels.containsKey(d) && !"DEFAULT".equals(labelSources.getOrDefault(d, "DEFAULT"))).count();
        double rot = occupiedDrawers.isEmpty() ? 1 : (double) labeled / occupiedDrawers.size();
        List<WardrobeItem> unavailable = all.stream().filter(w -> !available(w)).toList();
        Instant reviewCut = Instant.now().minus(REVIEW_DAYS, ChronoUnit.DAYS);
        long stale = unavailable.stream().filter(w -> w.getUpdatedAt() != null && w.getUpdatedAt().isBefore(reviewCut)).count();
        double rev = unavailable.isEmpty() ? 1 : 1 - (double) stale / unavailable.size();
        int oVal = (int) Math.round(100 * (0.5 * coer + 0.3 * rot + 0.2 * rev));
        dims.put("O", oVal);
        List<Map<String, Object>> oDown = new ArrayList<>(incoherent);
        if (rot < 1) {
            oDown.add(Map.of("name", Msg.t("inventoryScore.gavetas_sem_rotulo"), "value", (occupiedDrawers.size() - labeled) + " de " + occupiedDrawers.size(),
                    "hint", Msg.t("inventoryScore.renomeie_no_modo_organizar_ou")));
        }
        if (stale > 0) {
            oDown.add(Map.of("name", Msg.t("inventoryScore.cesto_esquecido"), "value", Msg.t("inventoryScore.peca_s_indisponivel_is_ha", (stale)), "hint", Msg.t("inventoryScore.revise_o_cesto")));
        }
        explain.add(new Dimension("O", NAMES.get("O"), oVal, WEIGHTS.get("O"), Msg.t("inventoryScore.das_pecas_estao_numa_posicao", (pct(coer)), pct(rot), pct(rev)), oDown));

        // ---- R
        Set<UUID> f = new HashSet<>();
        Set<UUID> rescued = new HashSet<>();
        Map<UUID, Long> rescueGap = new HashMap<>();
        for (WardrobeItem w : all) {
            TreeSet<LocalDate> uses = usageAll.getOrDefault(w.getId(), new TreeSet<>());
            LocalDate created = w.getCreatedAt() == null ? today : LocalDate.ofInstant(w.getCreatedAt(), FaiPointsService.ZONE);
            LocalDate prev = created;
            boolean forgottenAtStart = false;
            LocalDate lastBeforeStart = uses.floor(since);
            LocalDate refStart = lastBeforeStart != null ? lastBeforeStart : created.isBefore(since) ? created : null;
            if (refStart != null && ChronoUnit.DAYS.between(refStart, since) >= RoomService.FORGOTTEN_DAYS) {
                forgottenAtStart = true;
                f.add(w.getId());
            }
            for (LocalDate u : uses) {
                long gap = ChronoUnit.DAYS.between(prev, u);
                if (gap >= RoomService.FORGOTTEN_DAYS && !u.isBefore(since)) {
                    // ficou esquecida (no início ou durante a janela) e voltou a um look
                    f.add(w.getId());
                    rescued.add(w.getId());
                    rescueGap.merge(w.getId(), gap, Math::max);
                }
                prev = u;
            }
            if (!forgottenAtStart && ChronoUnit.DAYS.between(prev, today) >= RoomService.FORGOTTEN_DAYS && prev.plusDays(RoomService.FORGOTTEN_DAYS).isAfter(since)) {
                f.add(w.getId()); // ficou esquecida durante a janela e ainda não voltou
            }
        }
        double resg = f.isEmpty() ? 1 : (double) rescued.size() / f.size();
        // Inéd: fração dos looks da janela com ao menos um par nunca combinado antes
        List<Scheme> chrono = allSchemes.stream().filter(s -> s.getCreatedAt() != null).sorted(Comparator.comparing(Scheme::getCreatedAt)).toList();
        Set<String> seenPairs = new HashSet<>();
        int novel = 0, windowSchemes = 0;
        for (Scheme s : chrono) {
            List<UUID> ids = schemePieces.getOrDefault(s.getId(), List.of());
            boolean inWindow = ids.size() >= 2 && s.getCreatedAt().isAfter(sinceInstant) && !s.getCreatedAt().isAfter(survival);
            boolean introduced = false;
            for (int i = 0; i < ids.size(); i++) {
                for (int j = i + 1; j < ids.size(); j++) {
                    if (seenPairs.add(pairKey(ids.get(i), ids.get(j)))) {
                        introduced = true;
                    }
                }
            }
            if (inWindow) {
                windowSchemes++;
                if (introduced) {
                    novel++;
                }
            }
        }
        double ined = windowSchemes == 0 ? 0 : (double) novel / windowSchemes;
        int rVal = (int) Math.round(100 * (0.5 * resg + 0.5 * ined));
        dims.put("R", rVal);
        explain.add(new Dimension("R", NAMES.get("R"), rVal, WEIGHTS.get("R"), (f.isEmpty() ? Msg.t("inventoryScore.nenhuma_peca_esquecida_nos_ultimos")
                : Msg.t("inventoryScore.de_pecas_esquecidas_voltaram_a", (rescued.size()), f.size(), pct(resg))) + "; "
                + (windowSchemes == 0 ? Msg.t("inventoryScore.sem_looks_novos_na_janela") : Msg.t("inventoryScore.de_looks_da_janela_trouxeram", (novel), windowSchemes)) + ".",
                f.stream().filter(id -> !rescued.contains(id)).map(byId::get).filter(Objects::nonNull).limit(5)
                        .map(w -> Map.<String, Object>of("pieceId", w.getId(), "name", String.valueOf(w.getName()), "value", Msg.t("inventoryScore.esquecida_ainda_sem_resgate"),
                                "hint", Msg.t("inventoryScore.monte_um_look_com_ela"))).toList()));

        // ---- I (Camada 1 do DNA — nunca a Identidade de Vida, RNF6)
        Optional<StyleDna> dna = dnas.findByUserId(userId);
        Integer iVal = null;
        List<Map<String, Object>> iDown = new ArrayList<>();
        if (dna.isPresent() && dna.get().getSynthesizedAt() != null) {
            Map<String, Double> invColors = distribution(a.stream().map(w -> family(w.getColor())).filter(Objects::nonNull).toList());
            Map<String, Double> dnaColors = distribution(Json.csv(dna.get().getColorPalette()).stream().map(InventoryScoreService::family).filter(Objects::nonNull).toList());
            Map<String, Double> invStyles = distribution(a.stream().flatMap(w -> Json.csv(w.getStyleTags()).stream()).toList());
            Map<String, Double> dnaStyles = distribution(Json.csv(dna.get().getStyleKeywords()).stream().map(s -> s.toLowerCase().trim()).toList());
            double cc = cosine(invColors, dnaColors);
            double cs = cosine(invStyles, dnaStyles);
            iVal = (int) Math.round(100 * (0.5 * cc + 0.5 * cs));
            dims.put("I", iVal);
            a.stream().filter(w -> family(w.getColor()) != null && !dnaColors.containsKey(family(w.getColor()))).limit(3)
                    .forEach(w -> iDown.add(Map.of("pieceId", w.getId(), "name", String.valueOf(w.getName()), "value", Msg.t("inventoryScore.cor_fora_da_paleta_do"), "hint", Msg.t("inventoryScore.informativo_nao_e_defeito"))));
            explain.add(new Dimension("I", NAMES.get("I"), iVal, WEIGHTS.get("I"), Msg.t("inventoryScore.correspondencia_entre_o_inventario", pct(cc), pct(cs)), iDown));
        } else {
            explain.add(new Dimension("I", NAMES.get("I"), null, WEIGHTS.get("I"), Msg.t("inventoryScore.sem_dna_de_estilo_gerado"), List.of()));
        }

        // ---- score
        double sumW = 0, sum = 0;
        for (Map.Entry<String, Integer> e : dims.entrySet()) {
            double w = WEIGHTS.get(e.getKey());
            sumW += w;
            sum += w * e.getValue();
        }
        double k = Math.min(1.0, (double) n / SATURATION);
        int score = sumW == 0 ? 0 : (int) Math.round(10 * sum / sumW * k);
        boolean eligible = n >= MIN_PIECES;

        metrics.put("pieces", n);
        metrics.put("available", a.size());
        metrics.put("forgotten", forgottenNow.size());
        metrics.put("rescued", rescued.size());
        metrics.put("rescueOpportunities", f.size());
        metrics.put("uniqueLooks", allSchemes.stream().map(s -> SchemeService.combinationKey(schemePieces.getOrDefault(s.getId(), List.of())))
                .filter(kk -> !kk.isEmpty()).distinct().count());
        metrics.put("windowLooks", windowLooks.size());
        metrics.put("validCombos", combos.total());
        metrics.put("discoveredCombos", discoveredKeys.size());
        metrics.put("exposed", exposed.size());
        metrics.put("usedInWindow", usedInWindow);
        metrics.put("k", k);
        metrics.put("combosEnumerated", combos.enumerated());
        metrics.put("styleCount", allSchemes.stream().flatMap(s -> Json.csv(s.getStyle()).stream()).distinct().count());
        metrics.put("topUsed", appearances.entrySet().stream().sorted(Map.Entry.<UUID, Long>comparingByValue().reversed()).limit(10)
                .map(e -> e.getKey().toString()).toList());
        metrics.put("rescuedIds", rescued.stream().map(UUID::toString).toList());
        metrics.put("rescueGaps", rescueGap.entrySet().stream().collect(Collectors.toMap(e -> e.getKey().toString(), Map.Entry::getValue)));
        metrics.put("perPieceCombos", combos.perPiece().entrySet().stream().collect(Collectors.toMap(e -> e.getKey().toString(), Map.Entry::getValue)));
        metrics.put("undiscoveredSample", combos.sample().stream().map(l -> l.stream().map(UUID::toString).toList()).toList());
        metrics.put("usageCount", usage.entrySet().stream().collect(Collectors.toMap(e -> e.getKey().toString(), e -> e.getValue().size())));
        Result result = new Result(userId, eligible, n, k, eligible ? score : null, eligible ? band(score) : null, dims, metrics, explain, Instant.now());
        // snapshot do dia e do mês em transação própria: o quarto pede /api/me/room e /api/me/room/list ao mesmo tempo,
        // os dois calculam o score e a segunda gravação batia na chave única (uq_inv_snap), marcando a transação de
        // leitura como rollback-only — a tela recebia 500. Agora a corrida só perde o snapshot repetido.
        sideEffects.run("snapshot do Inventory Score", () -> snapshot(result, today));
        if (eligible) {   // mesma corrida na conquista (user_achievements tem chave única): também isolada
            sideEffects.run("conquistas do Inventory Score", () -> checkAchievements(result, all, usageAll));
        }
        return result;
    }

    private static String pairKey(UUID a, UUID b) {
        return a.compareTo(b) < 0 ? a + "|" + b : b + "|" + a;
    }

    /** Chave da combinação (upper+lower+shoes ou dress+shoes) formada pelas peças de um esquema — DET-G01. */
    static String comboKeyOf(List<UUID> ids, Map<UUID, WardrobeItem> byId) {
        UUID upper = null, lower = null, shoes = null, dress = null;
        for (UUID id : ids) {
            WardrobeItem w = byId.get(id);
            if (w == null) {
                continue;
            }
            switch (String.valueOf(w.getCategory())) {
                case "upper_piece" -> upper = upper == null ? id : upper;
                case "lower_piece" -> lower = lower == null ? id : lower;
                case "shoes_piece" -> shoes = shoes == null ? id : shoes;
                case "full_body_piece" -> dress = dress == null ? id : dress;
                default -> {
                }
            }
        }
        if (shoes == null) {
            return null;
        }
        if (dress != null) {
            return SchemeService.combinationKey(List.of(dress, shoes));
        }
        return upper != null && lower != null ? SchemeService.combinationKey(List.of(upper, lower, shoes)) : null;
    }

    static Map<String, Double> distribution(List<String> values) {
        Map<String, Double> out = new HashMap<>();
        if (values.isEmpty()) {
            return out;
        }
        values.forEach(v -> out.merge(v, 1.0 / values.size(), Double::sum));
        return out;
    }

    static String pct(double v) {
        return Math.round(v * 100) + "%";
    }

    static LocalDate lastUse(WardrobeItem w, Map<UUID, TreeSet<LocalDate>> usage) {
        TreeSet<LocalDate> u = usage.get(w.getId());
        LocalDate d = u == null || u.isEmpty() ? null : u.last();
        LocalDate worn = w.getLastWornDate();
        if (d == null) {
            return worn;
        }
        return worn == null || d.isAfter(worn) ? d : worn;
    }

    static long daysSince(WardrobeItem w, Map<UUID, TreeSet<LocalDate>> usage, LocalDate today) {
        LocalDate last = lastUse(w, usage);
        LocalDate ref = last != null ? last : w.getCreatedAt() == null ? today : LocalDate.ofInstant(w.getCreatedAt(), FaiPointsService.ZONE);
        return ChronoUnit.DAYS.between(ref, today);
    }

    static String missingFields(WardrobeItem w) {
        List<String> m = new ArrayList<>();
        if (w.getColor() == null) {
            m.add("cor");
        }
        if (Json.csv(w.getOccasionTags()).isEmpty()) {
            m.add(Msg.t("inventoryScore.ocasioes"));
        }
        if (Json.csv(w.getStyleTags()).isEmpty()) {
            m.add("estilos");
        }
        if (w.getImageUrl() == null || w.isDefaultImage()) {
            m.add(Msg.t("inventoryScore.foto_propria"));
        }
        if (w.getMaterial() == null) {
            m.add("material");
        }
        if (w.getBrand() == null && (w.getBrandName() == null || w.getBrandName().isBlank())) {
            m.add("marca");
        }
        return m.isEmpty() ? "completa" : "falta " + String.join(", ", m);
    }

    // ================================================================== snapshots (§7) e conquistas (§4.3)
    void snapshot(Result r, LocalDate today) {
        for (String type : List.of("DAY", "MONTH")) {
            LocalDate key = type.equals("DAY") ? today : today.withDayOfMonth(1);
            InventoryScoreSnapshot s = snapshots.findByUserIdAndPeriodTypeAndPeriodDate(r.userId(), type, key).orElseGet(InventoryScoreSnapshot::new);
            s.setUserId(r.userId());
            s.setPeriodType(type);
            s.setPeriodDate(key);
            s.setScore(r.score());
            s.setEligible(r.eligible());
            s.setDimensionsJson(Json.write(r.dims()));
            Map<String, Object> m = new LinkedHashMap<>();
            for (String k : List.of("pieces", "forgotten", "rescued", "uniqueLooks", "windowLooks", "validCombos", "discoveredCombos", "styleCount")) {
                m.put(k, r.metrics().get(k));
            }
            s.setMetricsJson(Json.write(m));
            s.setComputedAt(Instant.now());
            snapshots.save(s);
        }
    }

    void checkAchievements(Result r, List<WardrobeItem> all, Map<UUID, TreeSet<LocalDate>> usageAll) {
        UUID u = r.userId();
        if (r.dims().getOrDefault("C", 0) >= 95) {
            achievements.grant(u, "CURADOR");
        }
        if (r.score() != null && r.score() >= 900) {
            achievements.grant(u, "SIGNATURE_CLOSET");
        }
        long rescuedLifetime = all.stream().filter(w -> {
            TreeSet<LocalDate> uses = usageAll.getOrDefault(w.getId(), new TreeSet<>());
            LocalDate prev = w.getCreatedAt() == null ? LocalDate.now(FaiPointsService.ZONE) : LocalDate.ofInstant(w.getCreatedAt(), FaiPointsService.ZONE);
            for (LocalDate d : uses) {
                if (ChronoUnit.DAYS.between(prev, d) >= RoomService.FORGOTTEN_DAYS) {
                    return true;
                }
                prev = d;
            }
            return false;
        }).count();
        if (rescuedLifetime >= 10) {
            achievements.grant(u, "SEGUNDA_CHANCE");
        }
        if (((Number) r.metrics().getOrDefault("styleCount", 0)).longValue() >= 10) {
            achievements.grant(u, "CAMALEAO");
        }
        if (((Number) r.metrics().getOrDefault("uniqueLooks", 0)).longValue() >= 50) {
            achievements.grant(u, "STYLIST");
        }
        @SuppressWarnings("unchecked") List<String> topUsed = (List<String>) r.metrics().getOrDefault("topUsed", List.of());
        @SuppressWarnings("unchecked") List<String> rescued = (List<String>) r.metrics().getOrDefault("rescuedIds", List.of());
        if (topUsed.stream().anyMatch(rescued::contains)) {
            achievements.grant(u, "HIDDEN_GEM");
        }
    }

    @EventListener
    public void invalidate(DomainEvents.SchemeSaved ev) {
        cache.remove(ev.userId());
    }

    @EventListener
    public void invalidate(DomainEvents.DailyLookRegistered ev) {
        cache.remove(ev.userId());
    }

    @EventListener
    public void invalidate(DomainEvents.PieceCreated ev) {
        cache.remove(ev.userId());
    }

    @EventListener
    public void invalidate(DomainEvents.PieceUpdated ev) {
        cache.remove(ev.userId());
    }

    @EventListener
    public void invalidate(DomainEvents.PieceDeleted ev) {
        cache.remove(ev.userId());
    }

    @EventListener
    public void invalidate(DomainEvents.RoomOrganized ev) {
        cache.remove(ev.userId());
    }

    @EventListener
    public void invalidate(DomainEvents.AvailabilityChanged ev) {
        cache.remove(ev.userId());
    }

    // ================================================================== aba Destaques (RF34 §4.1)
    @Transactional
    public Map<String, Object> highlightsTab(CurrentUser user) {
        Result r = compute(user.id(), true);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("eligible", r.eligible());
        out.put("pieces", r.pieces());
        if (!r.eligible()) {
            // RF34.CA02 — progresso no padrão do RF13.CA02, sem nota parcial
            out.put("progress", Map.of("missing", MIN_PIECES - r.pieces(), "target", MIN_PIECES,
                    "message", Msg.t("inventoryScore.faltam_pecas_para_o_seu", (MIN_PIECES - r.pieces())),
                    "steps", List.of(Map.of("label", Msg.t("inventoryScore.conta_criada"), "done", true), Map.of("label", Msg.t("inventoryScore.primeira_peca_cadastrada"), "done", r.pieces() > 0),
                            Map.of("label", Msg.t("inventoryScore.n10_pecas_no_acervo"), "done", false))));
            out.put("manifesto", Msg.t("inventoryScore.vista_o_que_voce_tem"));
            return out;
        }
        out.put("score", r.score());
        out.put("band", r.band());
        out.put("bands", BANDS);
        out.put("k", r.k());
        out.put("kNote", r.k() < 1 ? Msg.t("inventoryScore.sua_nota_cresce_ate_20", Math.round(r.k() * 100)) : null);
        out.put("dimensions", r.dimensions());
        out.put("dims", r.dims());
        out.put("delta", monthDelta(user.id(), r));
        out.put("highlights", highlights(user.id(), r));
        out.put("evolution", evolution(user.id(), r));
        out.put("records", records(user.id(), r));
        out.put("achievements", achievements.list(user));
        out.put("suggestedChallenges", suggestedChallenges(r));
        out.put("rankingsOptIn", optIns.findById(user.id()).map(RankingOptIn::isOptedIn).orElse(false));
        out.put("computedAt", r.computedAt());
        out.put("manifesto", Msg.t("inventoryScore.vista_o_que_voce_tem"));
        return out;
    }

    Integer monthDelta(UUID userId, Result r) {
        LocalDate prevMonth = LocalDate.now(FaiPointsService.ZONE).withDayOfMonth(1).minusMonths(1);
        return snapshots.findByUserIdAndPeriodTypeAndPeriodDate(userId, "MONTH", prevMonth).map(InventoryScoreSnapshot::getScore)
                .filter(Objects::nonNull).map(s -> r.score() == null ? null : r.score() - s).orElse(null);
    }

    /** RF34.CA06 — até 6 cards gerados dos dados reais, cada um com ação para ver a peça ou abrir no quarto. */
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> highlights(UUID userId, Result r) {
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(InventoryScoreService::alive).toList();
        Map<UUID, WardrobeItem> byId = all.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        List<Map<String, Object>> cards = new ArrayList<>();
        Map<String, Object> perCombos = (Map<String, Object>) r.metrics().getOrDefault("perPieceCombos", Map.of());
        perCombos.entrySet().stream().max(Comparator.comparingInt(e -> ((Number) e.getValue()).intValue()))
                .filter(e -> ((Number) e.getValue()).intValue() > 0).map(e -> byId.get(UUID.fromString(e.getKey()))).filter(Objects::nonNull)
                .ifPresent(w -> cards.add(card("🏆", Msg.t("inventoryScore.peca_mais_versatil"), w, Msg.t("inventoryScore.combinacoes", (perCombos.get(w.getId().toString()))))));
        Map<String, Object> usageCount = (Map<String, Object>) r.metrics().getOrDefault("usageCount", Map.of());
        usageCount.entrySet().stream().max(Comparator.comparingInt(e -> ((Number) e.getValue()).intValue()))
                .map(e -> byId.get(UUID.fromString(e.getKey()))).filter(Objects::nonNull)
                .ifPresent(w -> cards.add(card("❤️", Msg.t("inventoryScore.mais_usada"), w, Msg.t("inventoryScore.em_90_dias", (usageCount.get(w.getId().toString()))))));
        dnas.findByUserId(userId).map(StyleDna::getIconPieceName).filter(Objects::nonNull)
                .flatMap(name -> all.stream().filter(w -> name.equalsIgnoreCase(w.getName())).findFirst())
                .ifPresent(w -> cards.add(card("💎", Msg.t("inventoryScore.peca_icone"), w, Msg.t("inventoryScore.eleita_pelo_seu_dna_de"))));
        Map<String, Object> gaps = (Map<String, Object>) r.metrics().getOrDefault("rescueGaps", Map.of());
        gaps.entrySet().stream().max(Comparator.comparingLong(e -> ((Number) e.getValue()).longValue()))
                .map(e -> byId.get(UUID.fromString(e.getKey()))).filter(Objects::nonNull)
                .ifPresent(w -> cards.add(card("🔄", Msg.t("inventoryScore.melhor_retorno"), w, Msg.t("inventoryScore.dias_parada_look_s", (gaps.get(w.getId().toString())), usageCount.getOrDefault(w.getId().toString(), 1)))));
        List<WardrobeItem> a = all.stream().filter(InventoryScoreService::available).toList();
        Map<String, Long> fam = a.stream().map(w -> family(w.getColor())).filter(Objects::nonNull).collect(Collectors.groupingBy(f -> f, Collectors.counting()));
        fam.entrySet().stream().max(Map.Entry.comparingByValue()).ifPresent(e -> cards.add(Map.of("emoji", "🎨", "title", Msg.t("inventoryScore.cor_assinatura"),
                "value", e.getKey() + " (" + Math.round(100.0 * e.getValue() / a.size()) + "%)", "actions", List.of(Map.of("label", Msg.t("inventoryScore.ver_pecas"), "filter", "color:" + e.getKey())))));
        Map<String, Long> cat = a.stream().map(WardrobeItem::getSubcategory).filter(Objects::nonNull).collect(Collectors.groupingBy(c -> c, Collectors.counting()));
        cat.entrySet().stream().max(Map.Entry.comparingByValue()).ifPresent(e -> cards.add(Map.of("emoji", "👕", "title", Msg.t("inventoryScore.categoria_dominante"),
                "value", e.getKey() + " (" + e.getValue() + ")", "actions", List.of(Map.of("label", Msg.t("inventoryScore.ver_pecas"), "filter", "subcategory:" + e.getKey())))));
        return cards.stream().limit(6).toList();
    }

    private static Map<String, Object> card(String emoji, String title, WardrobeItem w, String value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("emoji", emoji);
        m.put("title", title);
        m.put("pieceId", w.getId());
        m.put("name", w.getName());
        m.put("imageUrl", w.getImageUrl());
        m.put("value", value);
        m.put("actions", List.of(Map.of("label", Msg.t("inventoryScore.ver_peca"), "href", "/pieces/" + w.getId()),
                Map.of("label", Msg.t("inventoryScore.mostrar_no_quarto"), "action", "showInRoom", "pieceId", w.getId().toString())));
        return m;
    }

    /** RF34.CA07 — evolução: snapshot atual × mês anterior (score, reutilizadas, looks únicos, esquecidas, versatilidade). */
    Map<String, Object> evolution(UUID userId, Result r) {
        LocalDate prevMonth = LocalDate.now(FaiPointsService.ZONE).withDayOfMonth(1).minusMonths(1);
        Optional<InventoryScoreSnapshot> prev = snapshots.findByUserIdAndPeriodTypeAndPeriodDate(userId, "MONTH", prevMonth);
        Map<String, Object> now = new LinkedHashMap<>();
        now.put("score", r.score());
        now.put("rescued", r.metrics().get("rescued"));
        now.put("uniqueLooks", r.metrics().get("uniqueLooks"));
        now.put("forgotten", r.metrics().get("forgotten"));
        now.put("versatility", r.dims().get("V"));
        Map<String, Object> before = new LinkedHashMap<>();
        prev.ifPresent(s -> {
            Map<String, Object> m = Json.map(s.getMetricsJson());
            Map<String, Object> d = Json.map(s.getDimensionsJson());
            before.put("score", s.getScore());
            before.put("rescued", m.get("rescued"));
            before.put("uniqueLooks", m.get("uniqueLooks"));
            before.put("forgotten", m.get("forgotten"));
            before.put("versatility", d.get("V"));
        });
        List<Map<String, Object>> history = snapshots.findTop60ByUserIdAndPeriodTypeOrderByPeriodDateDesc(userId, "DAY").stream()
                .map(s -> Map.<String, Object>of("date", s.getPeriodDate(), "score", s.getScore() == null ? 0 : s.getScore())).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("title", Msg.t("inventoryScore.seu_guarda_roupa_evoluiu_este"));
        out.put("now", now);
        out.put("previousMonth", before.isEmpty() ? null : before);
        out.put("history", history);
        return out;
    }

    /** DET-G05 — recordes pessoais, nunca comparados com outros usuários. */
    Map<String, Object> records(UUID userId, Result r) {
        List<PieceUsageDiaryEntry> entries = diary.findByUserIdAndUsedOnAfter(userId, LocalDate.of(2000, 1, 1));
        Map<LocalDate, String> dailyKeys = new HashMap<>();
        Map<LocalDate, List<UUID>> dailyPieces = new HashMap<>();
        for (PieceUsageDiaryEntry e : entries) {
            if ("DAILY_LOOK".equals(e.getSource())) {
                dailyPieces.computeIfAbsent(e.getUsedOn(), k -> new ArrayList<>()).add(e.getWardrobeItemId());
            }
        }
        dailyPieces.forEach((d, ids) -> dailyKeys.put(d, SchemeService.combinationKey(ids)));
        // sequência sem repetir, com Cabide de Reserva (DET-G06): 1 dia perdido por semana não quebra
        int best = 0, streak = 0, reserveUsedWeek = -1;
        Set<String> inStreak = new HashSet<>();
        LocalDate d = dailyKeys.keySet().stream().min(Comparator.naturalOrder()).orElse(null);
        LocalDate today = LocalDate.now(FaiPointsService.ZONE);
        while (d != null && !d.isAfter(today)) {
            String k = dailyKeys.get(d);
            int week = d.getDayOfYear() / 7 + d.getYear() * 60;
            if (k != null && inStreak.add(k)) {
                streak++;
            } else if (k == null && reserveUsedWeek != week) {
                reserveUsedWeek = week; // cabide de reserva protege o dia
            } else {
                best = Math.max(best, streak);
                streak = 0;
                inStreak.clear();
                if (k != null) {
                    inStreak.add(k);
                    streak = 1;
                }
            }
            d = d.plusDays(1);
        }
        best = Math.max(best, streak);
        Map<LocalDate, Integer> rescuedPerWeek = new HashMap<>();
        entries.stream().filter(e -> e.getNote() != null && e.getNote().startsWith("resgate"))
                .forEach(e -> rescuedPerWeek.merge(e.getUsedOn().with(java.time.DayOfWeek.MONDAY), 1, Integer::sum));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("noRepeatStreak", best);
        out.put("currentStreak", streak);
        out.put("rescuedInAWeek", rescuedPerWeek.values().stream().max(Integer::compare).orElse(0));
        out.put("uniqueLooks", r.metrics().get("uniqueLooks"));
        out.put("note", Msg.t("inventoryScore.recordes_so_seus_nunca_comparados"));
        return out;
    }

    /** RF36.CA15 / RF34 — até 2 desafios para a dimensão mais fraca (< 70). */
    List<Map<String, Object>> suggestedChallenges(Result r) {
        Optional<Map.Entry<String, Integer>> weakest = r.dims().entrySet().stream().min(Map.Entry.comparingByValue());
        if (weakest.isEmpty() || weakest.get().getValue() >= 70) {
            return List.of();
        }
        String dim = weakest.get().getKey();
        return templates.findByActiveTrueOrderByName().stream().filter(t -> Json.strings(t.getScoreDimensionsJson()).contains(dim)).limit(2)
                .map(t -> Map.<String, Object>of("code", t.getCode(), "name", t.getName(), "rule", t.getRuleText(), "dimension", dim,
                        "reason", Msg.t("inventoryScore.que_tal_o", (NAMES.get(dim)), weakest.get().getValue(), t.getName()))).toList();
    }

    /** RF34.CA05 — regra em linguagem simples e itens que mais puxam a dimensão para baixo. */
    @Transactional
    public Dimension explain(CurrentUser user, String code) {
        Result r = compute(user.id(), true);
        return r.dimensions().stream().filter(d -> d.code().equalsIgnoreCase(code)).findFirst()
                .orElseThrow(() -> ApiException.notFound(Msg.t("inventoryScore.dimensao")));
    }

    /** RF10.CA13 — as 2 dimensões mais fracas com números e ações diretas (consumido pelo Copilot). */
    @Transactional
    public Map<String, Object> improvementHints(UUID userId) {
        Result r = compute(userId, true);
        List<Dimension> weakest = r.dimensions().stream().filter(d -> d.value() != null).sorted(Comparator.comparingInt(Dimension::value)).limit(2).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("score", r.score());
        out.put("eligible", r.eligible());
        out.put("weakest", weakest);
        out.put("actions", List.of(Map.of("label", Msg.t("inventoryScore.ver_pecas_esquecidas"), "filter", "state:forgotten"),
                Map.of("label", Msg.t("common.criar_look_com_elas"), "action", "compose_forgotten"), Map.of("label", Msg.t("inventoryScore.abrir_meu_quarto"), "href", "/room")));
        out.put("suggestedChallenges", suggestedChallenges(r));
        return out;
    }

    // ================================================================== Álbum de Combinações (DET-G01)
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> album(CurrentUser user) {
        Result r = compute(user.id(), true);
        long total = ((Number) r.metrics().getOrDefault("validCombos", 0)).longValue();
        long discovered = ((Number) r.metrics().getOrDefault("discoveredCombos", 0)).longValue();
        List<List<String>> sample = (List<List<String>>) r.metrics().getOrDefault("undiscoveredSample", List.of());
        Set<UUID> ids = sample.stream().flatMap(List::stream).map(UUID::fromString).collect(Collectors.toSet());
        Map<UUID, WardrobeItem> byId = ids.isEmpty() ? Map.of() : pieces.findByIdIn(ids).stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        List<Map<String, Object>> silhouettes = sample.stream().map(combo -> Map.<String, Object>of("pieceIds", combo,
                "pieces", combo.stream().map(id -> byId.get(UUID.fromString(id))).filter(Objects::nonNull)
                        .map(w -> Map.of("id", w.getId(), "name", String.valueOf(w.getName()), "category", String.valueOf(w.getCategory()))).toList(),
                "action", "montar_no_espelho")).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total);
        out.put("discovered", Math.min(discovered, total));
        out.put("percent", total == 0 ? 0 : Math.round(100.0 * Math.min(discovered, total) / total));
        out.put("message", total == 0 ? Msg.t("inventoryScore.cadastre_ocasioes_nas_pecas_para")
                : Msg.t("inventoryScore.voce_descobriu_das_combinacoes_possiveis", Math.round(100.0 * Math.min(discovered, total) / total)));
        out.put("undiscovered", silhouettes);
        out.put("enumerated", r.metrics().get("combosEnumerated"));
        return out;
    }

    // ================================================================== Retrospectiva (DET-K01)
    @Transactional
    public Map<String, Object> retrospective(CurrentUser user, int year) {
        List<PieceUsageDiaryEntry> entries = diary.findByUserIdAndUsedOnAfter(user.id(), LocalDate.of(year, 1, 1).minusDays(1)).stream()
                .filter(e -> e.getUsedOn().getYear() == year).toList();
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(user.id());
        Map<UUID, WardrobeItem> byId = all.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        Map<UUID, Long> uses = entries.stream().collect(Collectors.groupingBy(PieceUsageDiaryEntry::getWardrobeItemId, Collectors.counting()));
        List<Map<String, Object>> cards = new ArrayList<>();
        uses.entrySet().stream().max(Map.Entry.comparingByValue()).map(e -> byId.get(e.getKey())).filter(Objects::nonNull)
                .ifPresent(w -> cards.add(Map.of("type", "most_used", "title", Msg.t("inventoryScore.peca_mais_usada_do_ano"), "name", String.valueOf(w.getName()),
                        "value", uses.get(w.getId()) + " usos", "imageUrl", String.valueOf(w.getImageUrl()))));
        entries.stream().filter(e -> e.getNote() != null && e.getNote().startsWith("resgate")).map(e -> byId.get(e.getWardrobeItemId())).filter(Objects::nonNull)
                .findFirst().ifPresent(w -> cards.add(Map.of("type", "rescued", "title", Msg.t("inventoryScore.peca_resgatada_do_ano"), "name", String.valueOf(w.getName()),
                        "imageUrl", String.valueOf(w.getImageUrl()))));
        Map<String, Long> fam = entries.stream().map(e -> byId.get(e.getWardrobeItemId())).filter(Objects::nonNull).map(w -> family(w.getColor()))
                .filter(Objects::nonNull).collect(Collectors.groupingBy(f -> f, Collectors.counting()));
        fam.entrySet().stream().max(Map.Entry.comparingByValue()).ifPresent(e -> cards.add(Map.of("type", "color", "title", Msg.t("inventoryScore.sua_cor_do_ano"), "value", e.getKey())));
        long uniqueLooks = schemes.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(s -> s.getCreatedAt() != null && LocalDate.ofInstant(s.getCreatedAt(), FaiPointsService.ZONE).getYear() == year).count();
        cards.add(Map.of("type", "looks", "title", Msg.t("inventoryScore.looks_unicos_criados"), "value", uniqueLooks));
        cards.add(Map.of("type", "uses", "title", Msg.t("inventoryScore.usos_registrados"), "value", entries.size()));
        List<BigDecimal> cpu = all.stream().filter(w -> w.getPrice() != null && w.getWearCount() > 0)
                .map(w -> w.getPrice().divide(BigDecimal.valueOf(w.getWearCount()), 2, RoundingMode.HALF_UP)).toList();
        if (!cpu.isEmpty()) {
            BigDecimal avg = cpu.stream().reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(cpu.size()), 2, RoundingMode.HALF_UP);
            cards.add(Map.of("type", "cost_per_use", "title", Msg.t("inventoryScore.custo_medio_por_uso"), "value", avg, "privateOnly", true,
                    "note", Msg.t("inventoryScore.so_para_voce_nunca_no")));
        }
        cards.add(Map.of("type", "manifesto", "title", Msg.t("inventoryScore.vista_o_que_voce_tem_2"), "value", year));
        return Map.of("year", year, "format", "9:16", "cards", cards.stream().limit(8).toList());
    }

    // ================================================================== rankings (§6, RF34.CA08/CA09)
    @Transactional
    public Map<String, Object> optIn(CurrentUser user, boolean optedIn, boolean shareCity, String city) {
        RankingOptIn o = optIns.findById(user.id()).orElseGet(RankingOptIn::new);
        o.setUserId(user.id());
        o.setOptedIn(optedIn);
        o.setShareCity(optedIn && shareCity);
        o.setCity(optedIn && shareCity ? InputSanitizer.clean(city == null ? "" : city, 80) : null);
        o.setUpdatedAt(Instant.now());
        optIns.save(o);
        if (!optedIn) {
            positions.findByUserId(user.id()).forEach(positions::delete);
        }
        return Map.of("optedIn", o.isOptedIn(), "shareCity", o.isShareCity(), "city", String.valueOf(o.getCity()),
                "note", Msg.t("inventoryScore.sem_opt_in_voce_ve"));
    }

    @Transactional
    public Map<String, Object> rankings(CurrentUser user) {
        Result r = compute(user.id(), true);
        Optional<RankingOptIn> o = optIns.findById(user.id()).filter(RankingOptIn::isOptedIn);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("score", r.score());
        out.put("optedIn", o.isPresent());
        if (o.isEmpty()) {
            out.put("message", Msg.t("inventoryScore.participe_dos_rankings_para_ver"));
            out.put("available", List.of("GLOBAL", "PAIS", "CIDADE", "FAIXA", "ESTILO", "SUSTENTAVEL", "VERSATEIS", "RISING"));
            return out;
        }
        List<Map<String, Object>> rows = positions.findByUserId(user.id()).stream().sorted(Comparator.comparing(RankingPosition::getSegment))
                .map(p -> Map.<String, Object>of("segment", p.getSegment(), "position", p.getPosition(), "total", p.getTotal(),
                        "topPercent", p.getTopPercent(), "value", p.getValue(), "computedAt", p.getComputedAt(),
                        "top", positions.findTop20BySegmentOrderByPositionDesc(p.getSegment()).stream()
                                .sorted(Comparator.comparingInt(RankingPosition::getPosition).reversed())
                                .limit(5).map(t -> Map.of("position", t.getPosition(), "value", t.getValue(),
                                        "user", users.findById(t.getUserId()).map(User::getUsername).orElse("—"))).toList())).toList();
        out.put("positions", rows);
        out.put("note", Msg.t("inventoryScore.colecionadores_mede_completude_de"));
        return out;
    }

    /** Job (§7) — materializa as posições por segmento entre participantes com opt-in. */
    @Scheduled(cron = "0 15 */4 * * *", zone = "America/Sao_Paulo")
    @Transactional
    public int recomputeRankings() {
        List<RankingOptIn> participants = optIns.findByOptedInTrue();
        record Row(UUID userId, int score, Map<String, Object> dims, String country, String city, String band, String archetype, Integer rising) {
        }
        List<Row> rows = new ArrayList<>();
        LocalDate thirtyAgo = LocalDate.now(FaiPointsService.ZONE).minusDays(30);
        for (RankingOptIn p : participants) {
            List<InventoryScoreSnapshot> latest = snapshots.findTop60ByUserIdAndPeriodTypeOrderByPeriodDateDesc(p.getUserId(), "DAY");
            if (latest.isEmpty() || !latest.get(0).isEligible() || latest.get(0).getScore() == null) {
                continue;
            }
            InventoryScoreSnapshot s = latest.get(0);
            User u = users.findById(p.getUserId()).orElse(null);
            if (u == null) {
                continue;
            }
            Integer rising = latest.stream().filter(x -> !x.getPeriodDate().isAfter(thirtyAgo) && x.getScore() != null).findFirst()
                    .map(x -> s.getScore() - x.getScore()).orElse(null);
            String archetype = dnas.findByUserId(p.getUserId()).map(d -> d.getArchetype().name()).orElse(null);
            rows.add(new Row(p.getUserId(), s.getScore(), Json.map(s.getDimensionsJson()), u.getCountry(), p.isShareCity() ? p.getCity() : null,
                    band(s.getScore()), archetype, rising));
        }
        Map<String, Map<UUID, Double>> segments = new LinkedHashMap<>();
        for (Row row : rows) {
            put(segments, "GLOBAL", row.userId(), row.score());
            if (row.country() != null) {
                put(segments, "PAIS:" + row.country(), row.userId(), row.score());
            }
            if (row.city() != null) {
                put(segments, "CIDADE:" + row.city(), row.userId(), row.score());
            }
            put(segments, "FAIXA:" + row.band(), row.userId(), row.score());
            if (row.archetype() != null) {
                put(segments, "ESTILO:" + row.archetype(), row.userId(), row.score());
            }
            double uVal = num(row.dims().get("U")), rVal = num(row.dims().get("R")), vVal = num(row.dims().get("V"));
            put(segments, "SUSTENTAVEL", row.userId(), 0.5 * uVal + 0.5 * rVal);
            put(segments, "VERSATEIS", row.userId(), vVal);
            if (row.rising() != null) {
                put(segments, "RISING", row.userId(), row.rising());
            }
        }
        int written = 0;
        for (Map.Entry<String, Map<UUID, Double>> seg : segments.entrySet()) {
            if (seg.getKey().startsWith("CIDADE:") && seg.getValue().size() < CITY_K_ANONYMITY) {
                positions.deleteBySegment(seg.getKey());
                continue; // RF34.CA09 — k-anonimato
            }
            positions.deleteBySegment(seg.getKey());
            List<Map.Entry<UUID, Double>> ordered = seg.getValue().entrySet().stream().sorted(Map.Entry.comparingByValue()).toList();
            int total = ordered.size();
            for (int i = 0; i < total; i++) {
                int position = i + 1; // crescente, 1-indexada (§6)
                RankingPosition p = new RankingPosition();
                p.setSegment(seg.getKey());
                p.setUserId(ordered.get(i).getKey());
                p.setPosition(position);
                p.setTotal(total);
                p.setTopPercent(BigDecimal.valueOf(100.0 * (total - position + 1) / total).setScale(2, RoundingMode.HALF_UP));
                p.setValue(BigDecimal.valueOf(ordered.get(i).getValue()).setScale(2, RoundingMode.HALF_UP));
                p.setComputedAt(Instant.now());
                positions.save(p);
                written++;
            }
        }
        return written;
    }

    private static void put(Map<String, Map<UUID, Double>> segments, String key, UUID user, double value) {
        segments.computeIfAbsent(key, k -> new HashMap<>()).put(user, value);
    }

    private static double num(Object o) {
        return o instanceof Number n ? n.doubleValue() : 0;
    }

    /** Snapshot diário de todos os usuários elegíveis (§7) — roda de madrugada. */
    @Scheduled(cron = "0 30 3 * * *", zone = "America/Sao_Paulo")
    @Transactional
    public int dailySnapshots() {
        int count = 0;
        for (RankingOptIn p : optIns.findByOptedInTrue()) {
            compute(p.getUserId(), false);
            count++;
        }
        return count;
    }

    /** Job de ranking também recalcula quem já tem snapshot recente; exposto para o admin (RF25). */
    public Map<String, Object> describe() {
        return Map.of("weights", WEIGHTS, "bands", BANDS, "window", WINDOW_DAYS, "minPieces", MIN_PIECES, "saturation", SATURATION,
                "cacheTtlMinutes", CACHE_TTL.toMinutes(), "kAnonymity", CITY_K_ANONYMITY);
    }
}
