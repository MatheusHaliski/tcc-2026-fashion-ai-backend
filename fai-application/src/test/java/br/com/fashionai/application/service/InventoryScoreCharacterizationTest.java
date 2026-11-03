package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.InventoryScoreSnapshot;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.RankingPosition;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.InventoryScoreSnapshotRepository;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.RankingPositionRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Supplier;

import static org.mockito.Mockito.mockingDetails;

/**
 * Caracterização do {@link InventoryScoreService} com o cenário fixo de {@link InventoryScoreScenario}: o retrato das
 * saídas públicas e package-private — nota com as 7 dimensões e métricas, cache e invalidação, explicação, dicas, aba
 * Destaques (cards, evolução, recordes, desafios), álbum, opt-in, rankings (job e leitura), snapshots gravados,
 * conquistas concedidas e as funções puras de apoio — tem de continuar idêntico ao gravado em
 * {@code inventory/inventory-score-portrait.txt}; a Retrospectiva usa datas absolutas em
 * {@code inventory/inventory-retrospective-portrait.txt}.
 */
class InventoryScoreCharacterizationTest {
    private final Kit kit = new Kit();

    private static Object attempt(Supplier<Object> call) {
        try {
            return call.get();
        } catch (ApiException e) {
            return "erro " + e.status() + " " + e.code() + ": " + e.getMessage();
        }
    }

    @Test
    void retratoDoInventoryScoreComCenarioFixo() throws Exception {
        InventoryScoreScenario sc = new InventoryScoreScenario(kit).build();
        InventoryScoreService score = kit.build(InventoryScoreService.class);
        InventoryScorePortrait p = new InventoryScorePortrait(true);
        CurrentUser ana = Kit.as(sc.ana);
        UUID me = sc.ana.getId();

        InventoryScoreService.Result r = score.compute(me, true);
        p.add("compute", r);
        p.add("cache mesma instância", score.compute(me, true) == r);
        p.add("cache ignorado", score.compute(me, false) == r);
        InventoryScoreService.Result cached = score.compute(me, true);
        score.invalidate(new DomainEvents.RoomOrganized(me));
        p.add("invalidado RoomOrganized", score.compute(me, true) != cached);
        p.add("isolado", score.computeIsolated(me, true).score());
        p.add("computeNow igual", score.computeNow(me).dims());
        for (String code : List.of("C", "D", "U", "V", "O", "R", "I", "u", "X")) {
            p.add("explain " + code, attempt(() -> score.explain(ana, code)));
        }
        p.add("improvementHints", score.improvementHints(me));
        p.add("highlightsTab", score.highlightsTab(ana));
        p.add("highlights", score.highlights(me, r));
        p.add("evolution", score.evolution(me, r));
        p.add("records", score.records(me, r));
        p.add("monthDelta", score.monthDelta(me, r));
        p.add("suggestedChallenges", score.suggestedChallenges(r));
        p.add("album", score.album(ana));
        p.add("highlightsTab caio", score.highlightsTab(Kit.as(sc.caio)));
        p.add("album caio", score.album(Kit.as(sc.caio)));
        p.add("compute caio", score.compute(sc.caio.getId(), false));
        p.add("compute bia", score.compute(sc.bia.getId(), false).dims());

        Map<UUID, Scheme> byId = new LinkedHashMap<>();
        sc.looks.stream().filter(s -> s.getStatus() != SchemeStatus.ARCHIVED).forEach(s -> byId.put(s.getId(), s));
        p.add("usageDays janela", score.usageDays(me, sc.today.minusDays(90), byId));
        p.add("usageDays tudo", score.usageDays(me, LocalDate.of(2000, 1, 1), byId));
        p.add("exposureDays", score.exposureDays(me, sc.pieces, sc.today.minusDays(90), sc.today));

        p.add("rankings sem opt-in", score.rankings(ana));
        p.add("optIn ana", score.optIn(ana, true, true, "  São <b>Paulo</b>  "));
        p.add("optIn bia", score.optIn(Kit.as(sc.bia), true, false, "Rio"));
        p.add("optIn caio", score.optIn(Kit.as(sc.caio), true, true, null));
        p.add("dailySnapshots", score.dailySnapshots());
        p.add("recomputeRankings", score.recomputeRankings());
        p.add("posições", positions());
        p.add("rankings ana", score.rankings(ana));
        p.add("optIn bia sai", score.optIn(Kit.as(sc.bia), false, true, "Rio"));
        p.add("posições após saída", positions());
        p.add("rankings bia", score.rankings(Kit.as(sc.bia)));
        p.add("snapshots", snapshots());
        p.add("conquistas", grants());
        p.add("describe", score.describe());
        for (DomainEvents.RoomOrganized ev : List.of(new DomainEvents.RoomOrganized(me))) {
            score.invalidate(ev);
        }
        Object before = score.compute(me, true);
        score.invalidate(new DomainEvents.AvailabilityChanged(me, sc.pieces.get(0).getId(), true));
        p.add("invalidado AvailabilityChanged", score.compute(me, true) != before);
        statics(p, sc);
        p.verify("/inventory/inventory-score-portrait.txt");
    }

    private void statics(InventoryScorePortrait p, InventoryScoreScenario sc) {
        Map<UUID, WardrobeItem> byId = new LinkedHashMap<>();
        sc.pieces.forEach(w -> byId.put(w.getId(), w));
        for (WardrobeItem w : sc.pieces) {
            p.add("peça " + w.getName(), List.of(InventoryScoreService.completeness(w), InventoryScoreService.catalogReady(w),
                    InventoryScoreService.missingFields(w), String.valueOf(InventoryScoreService.family(w.getColor())),
                    InventoryScoreService.detected(w), InventoryScoreService.detectedConfidence(w)));
        }
        Map<UUID, TreeSet<LocalDate>> usage = new LinkedHashMap<>();
        usage.put(sc.pieces.get(0).getId(), new TreeSet<>(List.of(sc.today.minusDays(9), sc.today.minusDays(70))));
        usage.put(sc.pieces.get(5).getId(), new TreeSet<>(List.of(sc.today.minusDays(80))));
        for (int n : new int[]{0, 5, 7}) {
            WardrobeItem w = sc.pieces.get(n);
            p.add("lastUse/daysSince " + n, java.util.Arrays.asList(InventoryScoreService.lastUse(w, usage),
                    InventoryScoreService.daysSince(w, usage, sc.today)));
        }
        for (int[] look : InventoryScoreScenario.LOOKS) {
            List<UUID> ids = java.util.Arrays.stream(look).mapToObj(i -> sc.pieces.get(i).getId()).toList();
            p.add("comboKeyOf " + java.util.Arrays.toString(look), String.valueOf(InventoryScoreService.comboKeyOf(ids, byId)));
        }
        p.add("combos", InventoryScoreService.combos(sc.pieces.subList(0, 12), 5, Set.of()));
        p.add("entropy", List.of(InventoryScoreService.entropy(List.of("a", "a", "b", "c"), 3), InventoryScoreService.entropy(List.of("a"), 1),
                InventoryScoreService.entropy(List.of("a", "b"), 8), InventoryScoreService.entropy(List.of(), 3)));
        p.add("cosine", List.of(InventoryScoreService.cosine(Map.of("a", 1.0, "b", 2.0), Map.of("a", 2.0, "c", 1.0)),
                InventoryScoreService.cosine(Map.of(), Map.of("a", 1.0))));
        p.add("distribution", InventoryScoreService.distribution(List.of("x", "y", "x", "z")));
        p.add("pct", List.of(InventoryScoreService.pct(0.456), InventoryScoreService.pct(1), InventoryScoreService.pct(0.005)));
        List<String> bands = new ArrayList<>();
        for (int s : new int[]{-5, 0, 299, 300, 499, 500, 649, 650, 799, 800, 899, 900, 959, 960, 1000, 1001}) {
            bands.add(s + "=" + InventoryScoreService.band(s));
        }
        p.add("band", bands);
        p.add("BANDS", InventoryScoreService.BANDS);
        p.add("family", List.of(String.valueOf(InventoryScoreService.family("#ff0000")), String.valueOf(InventoryScoreService.family("#zz")),
                String.valueOf(InventoryScoreService.family("?")), String.valueOf(InventoryScoreService.family(null))));
    }

    private List<Object> positions() {
        List<RankingPosition> rows = new ArrayList<>(MemoryRepository.rows(kit.dep(RankingPositionRepository.class)));
        rows.sort(Comparator.comparing(RankingPosition::getSegment).thenComparing(RankingPosition::getPosition));
        return rows.stream().map(x -> (Object) List.of(x.getSegment(), x.getUserId(), x.getPosition(), x.getTotal(), x.getTopPercent(),
                x.getValue())).toList();
    }

    private List<Object> snapshots() {
        List<InventoryScoreSnapshot> rows = new ArrayList<>(MemoryRepository.rows(kit.dep(InventoryScoreSnapshotRepository.class)));
        rows.sort(Comparator.comparing(InventoryScoreSnapshot::getUserId).thenComparing(InventoryScoreSnapshot::getPeriodType)
                .thenComparing(InventoryScoreSnapshot::getPeriodDate));
        LocalDate month = LocalDate.now(FaiPointsService.ZONE).withDayOfMonth(1);
        return rows.stream().map(s -> (Object) List.of(s.getUserId(), s.getPeriodType(), s.getPeriodType().equals("MONTH")
                ? "mês " + java.time.temporal.ChronoUnit.MONTHS.between(month, s.getPeriodDate()) : s.getPeriodDate(), String.valueOf(s.getScore()),
                s.isEligible(), String.valueOf(s.getDimensionsJson()), String.valueOf(s.getMetricsJson()))).toList();
    }

    private List<Object> grants() {
        return mockingDetails(kit.dep(AchievementService.class)).getInvocations().stream()
                .filter(i -> i.getMethod().getName().equals("grant"))
                .map(i -> (Object) List.of(i.getArguments())).toList();
    }

    @Test
    void retratoDaRetrospectivaComDatasFixas() throws Exception {
        InventoryScoreScenario sc = new InventoryScoreScenario(kit);
        sc.ana = sc.user("ana", 1, "BR");
        Instant base = Instant.parse("2024-02-10T12:00:00Z");
        for (int n = 0; n < 10; n++) {
            WardrobeItem w = sc.piece(sc.ana, n, InventoryScoreScenario.WARDROBE[n]);
            w.markCreatedAt(base.minusSeconds(86_400L * 30 * n));
            sc.pieces.add(w);
        }
        int[][] uses = {{0, 1}, {0, 2}, {0, 3}, {1, 3}, {2, 40}, {3, 200}, {4, 330}, {9, 400}, {7, 380}};
        for (int[] u : uses) {
            PieceUsageDiaryEntry e = new PieceUsageDiaryEntry();
            e.setUserId(sc.ana.getId());
            e.setWardrobeItemId(sc.pieces.get(u[0]).getId());
            e.setUsedOn(LocalDate.of(2024, 1, 1).plusDays(u[1]));
            e.setSource("MANUAL");
            e.setNote(u[0] == 3 || u[0] == 2 ? "resgate " + u[0] : null);
            kit.dep(PieceUsageDiaryEntryRepository.class).save(e);
        }
        sc.look(sc.ana, 0, 0, SchemeStatus.PUBLISHED, List.of()).markCreatedAt(Instant.parse("2024-05-01T10:00:00Z"));
        Scheme s1 = sc.look(sc.ana, 1, 0, SchemeStatus.PUBLISHED, List.of());
        s1.markCreatedAt(Instant.parse("2023-12-31T23:00:00Z"));
        sc.look(sc.ana, 2, 0, SchemeStatus.PUBLISHED, List.of()).markCreatedAt(Instant.parse("2025-01-01T03:30:00Z"));
        InventoryScoreService score = kit.build(InventoryScoreService.class);
        InventoryScorePortrait p = new InventoryScorePortrait(false);
        User ana = sc.ana;
        for (int year : new int[]{2023, 2024, 2025}) {
            p.add("retrospective " + year, score.retrospective(Kit.as(ana), year));
        }
        p.verify("/inventory/inventory-retrospective-portrait.txt");
    }
}
