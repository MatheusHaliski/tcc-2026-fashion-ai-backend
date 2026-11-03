package br.com.fashionai.application.hype;

import br.com.fashionai.domain.model.HypeMilestone;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.HypeScoreSnapshotRepository;
import br.com.fashionai.domain.repository.HypeSignalDailyRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    /** RF53 · P1-10: marcos de Hype (subida de faixa / emergente) saem como evento depois de gravar o estado. */
    private final ApplicationEventPublisher events;

    /** Entradas das peças e dos looks (montagem a partir do agregado) e a gravação do resultado. */
    private final HypePieceEntries pieceInputs;
    private final HypeSchemeEntries schemeInputs;
    private final HypeSnapshotWriter writer;
    public HypeSnapshotService(HypeScoreConfig config, WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                               HypeSignalDailyRepository signals, HypeScoreCurrentRepository current, HypeScoreSnapshotRepository snapshots,
                               HypeCache cache, ApplicationEventPublisher events) {
        this.config = config;
        this.calculator = new HypeCalculator(config);
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.signals = signals;
        this.current = current;
        this.snapshots = snapshots;
        this.cache = cache;
        this.events = events;
        this.pieceInputs = new HypePieceEntries(config);
        this.schemeInputs = new HypeSchemeEntries(config);
        this.writer = new HypeSnapshotWriter(config, calculator, current, snapshots, events, byType);
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

    /** Sinais reais de cada entidade por tipo: ver {@link HypeSignalHistory#signalCounts}. */
    static Map<UUID, Map<String, Map<String, Object>>> signalCounts(List<br.com.fashionai.domain.model.HypeSignalDaily> rows, LocalDate today, int windowDays) {
        return HypeSignalHistory.signalCounts(rows, today, windowDays);
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
        Map<UUID, Lifetime> pieceLifetime = lifetime(signals.totalsBefore(HypeEntityType.PIECE, since), config);
        Map<UUID, Lifetime> schemeLifetime = lifetime(signals.totalsBefore(HypeEntityType.SCHEME, since), config);

        List<Entry> pieceEntries = pieceEntries(allPieces, pieceSeries, pieceLifetime, now);
        Map<UUID, Entry> pieceById = pieceEntries.stream().collect(Collectors.toMap(Entry::id, Function.identity()));
        List<Entry> schemeEntries = schemeEntries(allSchemes, itemsBy, schemeSeries, schemeLifetime, pieceById, now);

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

    /**
     * Histórico anterior ao horizonte, vindo do agregado de sinais (já filtrado pela {@link HypeIntegrityPolicy}). Nunca os
     * contadores brutos da entidade (likesCount, viewCount…), que contam auto-interação, repetição e visitante.
     *
     * @param interactions interações com o peso da integridade × o peso do tipo de sinal — a mesma unidade da atividade
     *                     diária, para um evento não mudar de valor só por ter saído do horizonte
     * @param events       interações aceitas (contagem bruta) — entram em "dados insuficientes" como os eventos do horizonte
     * @param views        visualizações aceitas (contagem)
     */
    record Lifetime(double interactions, double events, double views) {
        static final Lifetime NONE = new Lifetime(0, 0, 0);
    }
    static Map<UUID, Lifetime> lifetime(List<HypeSignalDailyRepository.SignalTotal> totals, HypeScoreConfig config) {
        return HypeSignalHistory.lifetime(totals, config);
    }

    // ================================================================== peças e looks (regras em HypePieceEntries / HypeSchemeEntries)
    static boolean publicPiece(WardrobeItem w) {
        return HypePieceEntries.publicPiece(w);
    }

    static String cohortKey(WardrobeItem w) {
        return HypePieceEntries.cohortKey(w);
    }

    static boolean limitedEdition(String tags) {
        return HypePieceEntries.limitedEdition(tags);
    }

    List<Entry> pieceEntries(List<WardrobeItem> all, Map<UUID, HypeSignalSeries> series, Map<UUID, Lifetime> lifetimes, Instant now) {
        return pieceInputs.pieceEntries(all, series, lifetimes, now);
    }

    static List<String> attributeKeys(WardrobeItem p) {
        return HypePieceEntries.attributeKeys(p);
    }

    static Double surprise(Collection<String> keys, Map<String, Integer> freq, int population) {
        return HypePieceEntries.surprise(keys, freq, population);
    }

    static boolean publicScheme(Scheme s) {
        return HypeSchemeEntries.publicScheme(s);
    }

    List<Entry> schemeEntries(List<Scheme> all, Map<UUID, List<SchemeItem>> itemsBy, Map<UUID, HypeSignalSeries> series, Map<UUID, Lifetime> lifetimes,
                              Map<UUID, Entry> pieceById, Instant now) {
        return schemeInputs.schemeEntries(all, itemsBy, series, lifetimes, pieceById, now);
    }

    // ================================================================== persistência (HypeSnapshotWriter)
    int persist(HypeEntityType type, List<Entry> entries, LocalDate today, Instant now) {
        return writer.persist(type, entries, today, now);
    }

    /** RF53 · P1-10 — marcos de Hype entre o estado anterior e o novo: ver {@link HypeSnapshotWriter#milestones}. */
    static List<HypeMilestone.Kind> milestones(boolean hadPrevious, HypeLevel levelBefore, HypeMomentum momentumBefore,
                                               HypeLevel levelAfter, HypeMomentum momentumAfter) {
        return HypeSnapshotWriter.milestones(hadPrevious, levelBefore, momentumBefore, levelAfter, momentumAfter);
    }

    static int ageDays(Instant created, Instant now) {
        return created == null ? 0 : (int) Math.max(0, ChronoUnit.DAYS.between(created, now));
    }

    static String trim(String csv) {
        return csv == null ? null : csv.length() > 255 ? csv.substring(0, 255) : csv;
    }
}
