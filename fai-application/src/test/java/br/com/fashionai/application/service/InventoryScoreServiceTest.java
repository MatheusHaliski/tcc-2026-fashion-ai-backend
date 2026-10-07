package br.com.fashionai.application.service;

import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.InventoryScoreSnapshot;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.RankingPosition;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeAvailabilityChange;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.StyleArchetype;
import br.com.fashionai.domain.repository.InventoryScoreSnapshotRepository;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.RankingPositionRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeAvailabilityChangeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * FAI Inventory Score (RF34): nota de 0 a 1000 do uso real do guarda-roupa — catalogação, diversidade, utilização,
 * versatilidade, organização, descoberta e identidade — a partir do diário de uso, dos looks que sobreviveram 24 h e do
 * histórico de disponibilidade; com destaques, evolução, álbum de combinações, retrospectiva e rankings com opt-in.
 */
class InventoryScoreServiceTest {
    private Kit kit;
    private World world;
    private InventoryScoreService score;
    private CurrentUser ana;
    private final LocalDate today = LocalDate.now(FaiPointsService.ZONE);

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        score = kit.build(InventoryScoreService.class);
        ana = Kit.as(world.me);
        use(world.me);
    }

    /** Diário de uso: cada peça usada em alguns dias da janela, uma delas há muito tempo (esquecida). */
    private void use(User u) {
        List<WardrobeItem> mine = world.piecesOf(u);
        List<Scheme> looks = world.looksOf(u);
        for (int i = 0; i < mine.size(); i++) {
            WardrobeItem w = mine.get(i);
            w.setPrice(new BigDecimal("80.00"));
            w.setWearCount(i + 1);
            w.setPieceOrigin(i % 3 == 0 ? "GARIMPADA" : "COMPRADA");
            w.setSizeLabel("M");
            for (int d = 0; d < 1 + i % 4; d++) {
                PieceUsageDiaryEntry e = new PieceUsageDiaryEntry();
                e.setWardrobeItemId(w.getId());
                e.setUserId(u.getId());
                e.setUsedOn(today.minusDays(3 + d * 9 + i));
                e.setSource(d % 2 == 0 ? "MANUAL" : "SCHEME");
                e.setSchemeId(looks.get(i % looks.size()).getId());
                e.setNote(i == 2 ? "resgate da gaveta" : null);
                kit.dep(PieceUsageDiaryEntryRepository.class).save(e);
            }
        }
        mine.get(mine.size() - 1).markCreatedAt(Instant.now().minusSeconds(150L * 86_400));
        WardrobeAvailabilityChange c = new WardrobeAvailabilityChange();
        c.setWardrobeItemId(mine.get(0).getId());
        c.setUserId(u.getId());
        c.setAvailable(false);
        c.setChangedAt(Instant.now().minusSeconds(20L * 86_400));
        kit.dep(WardrobeAvailabilityChangeRepository.class).save(c);
        WardrobeAvailabilityChange back = new WardrobeAvailabilityChange();
        back.setWardrobeItemId(mine.get(0).getId());
        back.setUserId(u.getId());
        back.setAvailable(true);
        back.setChangedAt(Instant.now().minusSeconds(10L * 86_400));
        kit.dep(WardrobeAvailabilityChangeRepository.class).save(back);
    }

    @Test
    void notaComSeteDimensoesEFaixa() {
        InventoryScoreService.Result r = score.compute(world.me.getId(), false);
        assertThat(r.eligible()).isTrue();
        assertThat(r.score()).isBetween(0, 1000);
        assertThat(r.band()).isEqualTo(InventoryScoreService.band(r.score()));
        assertThat(r.dims()).containsKeys("C", "D", "U", "V", "O", "R");   // Identidade só com o DNA de estilo
        assertThat(score.compute(world.me.getId(), true)).isSameAs(score.compute(world.me.getId(), true));   // cache
        for (String code : List.of("C", "D", "U", "V", "O", "R", "I")) {
            assertThat(score.explain(ana, code).code()).isEqualTo(code);
        }
        assertThat(score.improvementHints(world.me.getId())).isNotEmpty();
    }

    @Test
    void comPoucasPecasMostraProgressoSemNotaParcial() {
        User nova = kit.dep(UserRepository.class).save(Kit.user("nova"));
        kit.dep(br.com.fashionai.domain.repository.WardrobeItemRepository.class).save(Kit.piece(nova, "única", "upper_piece", "t_shirt", "white"));
        Map<String, Object> tab = score.highlightsTab(Kit.as(nova));
        assertThat(tab.get("eligible")).isEqualTo(false);
        assertThat(map(tab.get("progress"))).containsEntry("missing", InventoryScoreService.MIN_PIECES - 1);
    }

    @Test
    void abaDeDestaquesComEvolucaoRecordesEDesafiosSugeridos() {
        InventoryScoreSnapshot prev = new InventoryScoreSnapshot();
        prev.setUserId(world.me.getId());
        prev.setPeriodType("MONTH");
        prev.setPeriodDate(today.withDayOfMonth(1).minusMonths(1));
        prev.setScore(100);
        prev.setEligible(true);
        kit.dep(InventoryScoreSnapshotRepository.class).save(prev);
        Map<String, Object> tab = score.highlightsTab(ana);
        assertThat(tab).containsKeys("score", "band", "dimensions", "highlights", "evolution", "records", "suggestedChallenges", "delta");
        assertThat(tab.get("delta")).isNotNull();
    }

    @Test
    void albumDeCombinacoesERetrospectivaDoAno() {
        Map<String, Object> album = score.album(ana);
        assertThat(album).containsKeys("total", "discovered", "percent", "undiscovered", "message");
        Map<String, Object> retro = score.retrospective(ana, today.getYear());
        assertThat((List<?>) retro.get("cards")).isNotEmpty();
        assertThat(String.valueOf(retro.get("cards"))).contains("most_used", "cost_per_use");
        assertThat((List<?>) score.retrospective(ana, 1999).get("cards")).isNotEmpty();
    }

    @Test
    void rankingsSoParaQuemParticipaEComKAnonimatoNaCidade() {
        Map<String, Object> off = score.rankings(ana);
        assertThat(off.get("optedIn")).isEqualTo(false);
        for (User u : List.of(world.me, world.rival, world.friend)) {
            if (u != world.me) {
                use(u);
            }
            StyleDna dna = new StyleDna();
            dna.setUser(u);
            dna.setArchetype(StyleArchetype.values()[u.getUsername().length() % StyleArchetype.values().length]);
            kit.dep(StyleDnaRepository.class).save(dna);
            score.optIn(Kit.as(u), true, true, "São Paulo");
            InventoryScoreSnapshot old = new InventoryScoreSnapshot();
            old.setUserId(u.getId());
            old.setPeriodType("DAY");
            old.setPeriodDate(today.minusDays(40));
            old.setScore(50);
            old.setEligible(true);
            kit.dep(InventoryScoreSnapshotRepository.class).save(old);
        }
        assertThat(score.dailySnapshots()).isEqualTo(3);
        int written = score.recomputeRankings();
        assertThat(written).isGreaterThan(0);
        List<RankingPosition> positions = MemoryRepository.rows(kit.dep(RankingPositionRepository.class));
        assertThat(positions).noneMatch(p -> p.getSegment().startsWith("CIDADE:"));   // menos de 50 pessoas na cidade
        Map<String, Object> on = score.rankings(ana);
        assertThat(on.get("optedIn")).isEqualTo(true);
        assertThat(score.optIn(ana, false, false, null)).containsEntry("optedIn", false);
        assertThat(score.describe()).containsKeys("weights", "bands", "kAnonymity");
    }

    @Test
    void eventosInvalidamONotaGuardada() {
        InventoryScoreService.Result first = score.compute(world.me.getId(), true);
        UUID me = world.me.getId();
        UUID piece = world.piecesOf(world.me).get(0).getId();
        score.invalidate(new DomainEvents.PieceCreated(me, piece, true));
        assertThat(score.compute(me, true)).isNotSameAs(first);
        score.invalidate(new DomainEvents.SchemeSaved(me, UUID.randomUUID(), List.of(), "CRIAR_LOOK", true));
        score.invalidate(new DomainEvents.DailyLookRegistered(me, UUID.randomUUID(), today, "MANUAL", List.of()));
        score.invalidate(new DomainEvents.PieceDeleted(me, piece));
        score.invalidate(new DomainEvents.RoomOrganized(me));
        score.invalidate(new DomainEvents.PieceUpdated(me, piece, 90));
        score.invalidate(new DomainEvents.AvailabilityChanged(me, piece, false));
    }

    @Test
    void funcoesDeApoioDaNota() {
        WardrobeItem w = world.piece(world.me, "t_shirt");
        assertThat(InventoryScoreService.completeness(w)).isBetween(0, 100);
        assertThat(InventoryScoreService.catalogReady(w)).isIn(true, false);
        assertThat(InventoryScoreService.missingFields(w)).isNotNull();
        assertThat(InventoryScoreService.entropy(List.of("a", "a", "b", "c"), 3)).isBetween(0.0, 1.0);
        assertThat(InventoryScoreService.entropy(List.of(), 3)).isEqualTo(0.0);
        assertThat(InventoryScoreService.cosine(Map.of("a", 1.0, "b", 0.0), Map.of("a", 1.0))).isEqualTo(1.0);
        assertThat(InventoryScoreService.cosine(Map.of(), Map.of("a", 1.0))).isEqualTo(0.0);
        for (String c : List.of("black", "white", "red", "navy", "light_blue", "olive", "brown", "beige", "pink", "purple", "yellow", "orange", "gray", "#ff0000", "?")) {
            InventoryScoreService.family(c);
        }
        assertThat(InventoryScoreService.family(null)).isNull();
        assertThat(InventoryScoreService.pct(0.456)).contains("46");
        assertThat(InventoryScoreService.distribution(List.of("a", "b", "a"))).containsEntry("a", 2 / 3.0);
        for (int s : new int[]{0, 350, 550, 750, 900, 1000}) {
            assertThat(InventoryScoreService.band(s)).isNotBlank();
        }
    }
}
