package br.com.fashionai.application.service;

import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.RankingOptIn;
import br.com.fashionai.domain.model.WardrobeItem;
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

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static br.com.fashionai.application.service.InventoryScoreRubric.WEIGHTS;

/**
 * RF34 — FAI Inventory Score (02-inventory-score-calculo.md): rubrica absoluta 0–1000 de 7 dimensões (0–100),
 * princípio anti-quantidade (só razões/médias/entropias; volume entra apenas no fator k que satura em 20 peças),
 * antifraude (§5), snapshots diários/mensais (§7), rankings por percentil com opt-in (§6, RNF6), Seus Destaques,
 * evolução mensal, recordes (DET-G05), Álbum de Combinações (DET-G01) e Retrospectiva (DET-K01).
 *
 * <p>Fachada sobre colaboradores por caso de uso ({@link InventoryScoreContext}): o serviço guarda a rubrica, o cache da
 * nota, as transações, os ouvintes de eventos e os jobs; o cálculo, as dimensões e as telas ficam nos colaboradores.
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

    public record Band(int min, int max, String label) {
    }

    public static final List<Band> BANDS = List.of(new Band(0, 299, Msg.k("inventoryScore.em_montagem")), new Band(300, 499, "Organizado"),
            new Band(500, 649, Msg.k("inventoryScore.versatil")), new Band(650, 799, Msg.k("inventoryScore.bem_curado")), new Band(800, 899, Msg.k("inventoryScore.closet_inteligente")),
            new Band(900, 959, Msg.k("common.signature_closet")), new Band(960, 1000, Msg.k("inventoryScore.maison_closet")));

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

    final InventoryScoreContext ctx;

    public InventoryScoreService(WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                                 PieceUsageDiaryEntryRepository diary, WardrobeAvailabilityChangeRepository availability,
                                 StyleDnaRepository dnas, InventoryScoreSnapshotRepository snapshots, RankingOptInRepository optIns,
                                 RankingPositionRepository positions, ChallengeTemplateRepository templates, UserRepository users,
                                 RoomService room, AchievementService achievements, SideEffectRunner sideEffects) {
        this.ctx = new InventoryScoreContext(pieces, schemes, schemeItems, diary, availability, dnas, snapshots, optIns, positions,
                templates, users, room, achievements, sideEffects);
    }

    // ================================================================== regras puras (portas mantidas para RF4/RF35 e o Copilot)
    public static int completeness(WardrobeItem w) {
        return InventoryCompleteness.completeness(w);
    }

    /** Peça pronta para o catálogo (RF35 §5.2, "passa no catalog_readiness_score"): dados essenciais + imagem própria. */
    public static boolean catalogReady(WardrobeItem w) {
        return InventoryCompleteness.catalogReady(w);
    }

    static String missingFields(WardrobeItem w) {
        return InventoryCompleteness.missingFields(w);
    }

    static double entropy(Collection<String> values, int m) {
        return InventoryScoreRules.entropy(values, m);
    }

    /** Combinações válidas (§3.4/§7) — regra pura em {@link InventoryComboCounter}; porta mantida para o Copilot. */
    static InventoryComboCounter.Combos combos(List<WardrobeItem> a, int sampleLimit, Set<String> discoveredKeys) {
        return InventoryComboCounter.count(a, sampleLimit, discoveredKeys);
    }

    static double cosine(Map<String, Double> a, Map<String, Double> b) {
        return InventoryScoreRules.cosine(a, b);
    }

    public static String family(String color) {
        return InventoryScoreRules.family(color);
    }

    static Map<String, Double> distribution(List<String> values) {
        return InventoryScoreRules.distribution(values);
    }

    static String pct(double v) {
        return InventoryScoreRules.pct(v);
    }

    // ================================================================== cálculo (§3–§4) com cache
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
        Result r = ctx.calculator.computeNow(userId);
        cache.put(userId, new Cached(r, Instant.now()));
        return r;
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

    // ================================================================== aba Destaques (RF34 §4.1), explicação e dicas
    @Transactional
    public Map<String, Object> highlightsTab(CurrentUser user) {
        return ctx.tab.highlightsTab(user, compute(user.id(), true));
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
        return ctx.tab.improvementHints(compute(userId, true));
    }

    // ================================================================== Álbum de Combinações (DET-G01) e Retrospectiva (DET-K01)
    @Transactional
    public Map<String, Object> album(CurrentUser user) {
        return ctx.album.album(compute(user.id(), true));
    }

    @Transactional
    public Map<String, Object> retrospective(CurrentUser user, int year) {
        return ctx.retrospective.retrospective(user, year);
    }

    // ================================================================== rankings (§6, RF34.CA08/CA09)
    @Transactional
    public Map<String, Object> optIn(CurrentUser user, boolean optedIn, boolean shareCity, String city) {
        return ctx.rankings.optIn(user, optedIn, shareCity, city);
    }

    @Transactional
    public Map<String, Object> rankings(CurrentUser user) {
        return ctx.rankings.rankings(user, compute(user.id(), true));
    }

    /** Job (§7) — materializa as posições por segmento entre participantes com opt-in. */
    @Scheduled(cron = "0 15 */4 * * *", zone = "America/Sao_Paulo")
    @Transactional
    public int recomputeRankings() {
        return ctx.rankings.recomputeRankings();
    }

    /** Snapshot diário de todos os usuários elegíveis (§7) — roda de madrugada. */
    @Scheduled(cron = "0 30 3 * * *", zone = "America/Sao_Paulo")
    @Transactional
    public int dailySnapshots() {
        int count = 0;
        for (RankingOptIn p : ctx.optIns.findByOptedInTrue()) {
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
