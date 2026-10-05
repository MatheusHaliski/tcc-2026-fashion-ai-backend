package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeGrouping;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.model.enums.GroupingType;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeGroupingRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF53 · Lote 1 (P1-03, P1-05, P2-07) — Passarela 3D, Eras/Coleções e My Stage no HypeScore v2: Top 100 pelo Hype
 * público (sem Hype = por último), "Em alta" = crescimento e não curtidas, Hype pessoal escondido de terceiros, curtidas
 * fora da pontuação de Hype e o v1 ignorado.
 */
class ShowcaseHypeV2Test {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private SchemeRepository schemes;
    private SchemeGroupingRepository groupings;
    private DailyLookRepository dailyLooks;
    private InstitutionalService institutional;
    private HypeScoreCurrentRepository hype;
    private ShowcaseService showcase;
    private final List<HypeScoreCurrent> rows = new ArrayList<>();

    @BeforeEach
    void setUp() {
        schemes = mock(SchemeRepository.class);
        groupings = mock(SchemeGroupingRepository.class);
        dailyLooks = mock(DailyLookRepository.class);
        institutional = mock(InstitutionalService.class);
        hype = mock(HypeScoreCurrentRepository.class);
        SchemeService schemeService = mock(SchemeService.class);
        when(schemeService.canView(any(), any())).thenReturn(true);
        Guard guard = mock(Guard.class);
        when(guard.canView(any(), any(), any())).thenReturn(true);
        when(hype.findByEntityTypeAndEntityIdInAndAlgorithmVersion(any(), anyCollection(), eq("HYPE_V2"))).thenAnswer(a -> {
            Collection<UUID> ids = a.getArgument(1);
            return rows.stream().filter(r -> r.getEntityType() == a.getArgument(0) && ids.contains(r.getEntityId())).toList();
        });
        showcase = new ShowcaseService(mock(FollowRepository.class), mock(UserRepository.class), mock(MediaService.class), schemes,
                mock(SchemeItemRepository.class), mock(WardrobeItemRepository.class), groupings, dailyLooks, mock(DailyLookService.class),
                mock(UserPreferencesRepository.class), mock(CelebrityProfileRepository.class), schemeService, institutional, mock(Model3dService.class),
                guard, mock(Avatar3dService.class), hype, config);
    }

    private static User user(ProfileType type) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername("u" + u.getId().toString().substring(0, 6));
        u.setStatus(AccountStatus.ACTIVE);
        u.setProfileType(type);
        u.setProfileVisibility(Visibility.PUBLIC);
        return u;
    }

    private static Scheme look(User owner, String title, long likes, BigDecimal v1, Instant created) {
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        s.setUser(owner);
        s.setTitle(title);
        s.setStyle("casual");
        s.setOccasion("work");
        s.setVisibility(Visibility.PUBLIC);
        s.setStatus(SchemeStatus.PUBLISHED);
        s.setLikeCount(likes);
        s.setSaveCount(likes);
        s.setHypeScore(v1);
        s.markCreatedAt(created);
        return s;
    }

    private HypeScoreCurrent score(Scheme s, double score, boolean eligible) {
        HypeScoreCurrent c = SearchHypeV2Test.row(HypeEntityType.SCHEME, s.getId(), score, eligible);
        c.setOwnerId(s.getUser().getId());
        rows.add(c);
        return c;
    }

    private static DailyLook daily(Scheme s, Instant at) {
        DailyLook dl = new DailyLook(s.getUser(), s, LocalDate.now(FaiPointsService.ZONE), DailyLookSource.MANUAL);
        dl.markCreatedAt(at);
        return dl;
    }

    private static ShowcaseService.RunwayEntry entry(Scheme s, Instant at) {
        return new ShowcaseService.RunwayEntry(daily(s, at), null, "OUTRAS", java.util.Set.of(), java.util.Set.of(), java.util.Set.of(), null);
    }

    // ------------------------------------------------------------------ Passarela 3D (P1-03)

    @Test
    void top100UsesThePublicV2ScoreAndSendsLooksWithoutPublicHypeToTheEnd() {
        User a = user(ProfileType.PESSOAL);
        Instant t = Instant.now();
        Scheme v1Star = look(a, "v1", 999, BigDecimal.valueOf(100), t);     // v1 e curtidas altos, sem Hype v2
        Scheme personal = look(a, "personal", 0, null, t);                 // Hype só pessoal (privado/seguidores)
        Scheme best = look(a, "best", 0, null, t.minusSeconds(60));
        Scheme mid = look(a, "mid", 0, null, t.minusSeconds(60));
        score(personal, 99, false);
        score(best, 88, true);
        score(mid, 41, true);
        Map<UUID, HypeScoreCurrent> map = showcase.hypeOf(HypeEntityType.SCHEME, List.of(v1Star.getId(), personal.getId(), best.getId(), mid.getId()));
        List<ShowcaseService.RunwayEntry> list = new ArrayList<>(List.of(entry(v1Star, t), entry(personal, t), entry(mid, t), entry(best, t)));
        list.sort(ShowcaseService.runwayOrder("TOP100_GLOBAL", e -> map.get(e.dl().getScheme().getId())));
        assertThat(list).extracting(e -> e.dl().getScheme().getTitle()).startsWith("best", "mid").containsOnly("best", "mid", "v1", "personal");
    }

    @Test
    void emAltaIsGrowthNotLikes() {
        User a = user(ProfileType.PESSOAL);
        Instant t = Instant.now();
        Scheme popular = look(a, "popular", 5_000, BigDecimal.valueOf(99), t);    // muito curtido, sem crescimento
        Scheme rising = look(a, "rising", 3, null, t);
        Scheme growing = look(a, "growing", 1, null, t);
        HypeScoreCurrent p = score(popular, 95, true);
        p.setDimensions(dims(30));
        p.setMomentum(HypeMomentum.COOLING);
        HypeScoreCurrent r = score(rising, 50, true);
        r.setDimensions(dims(72));
        r.setMomentum(HypeMomentum.EMERGING);
        HypeScoreCurrent g = score(growing, 45, true);
        g.setDimensions(dims(80));
        g.setMomentum(HypeMomentum.STABLE);
        Map<UUID, HypeScoreCurrent> map = showcase.hypeOf(HypeEntityType.SCHEME, rows.stream().map(HypeScoreCurrent::getEntityId).toList());
        List<ShowcaseService.RunwayEntry> list = new ArrayList<>(List.of(entry(popular, t), entry(growing, t), entry(rising, t)));
        list.sort(ShowcaseService.runwayOrder("EM_ALTA", e -> map.get(e.dl().getScheme().getId())));
        assertThat(list).extracting(e -> e.dl().getScheme().getTitle()).containsExactly("rising", "growing", "popular");
    }

    private static HypeDimensions dims(double trend) {
        HypeDimensions d = new HypeDimensions();
        d.setTrend(BigDecimal.valueOf(trend));
        return d;
    }

    @Test
    @SuppressWarnings("unchecked")
    void runwayRowsCarryTheV2SummaryHidingPersonalHypeFromOthersInOneQuery() {
        User a = user(ProfileType.PESSOAL);
        User b = user(ProfileType.PESSOAL);
        Instant t = Instant.now();
        Scheme pub = look(a, "pub", 1, BigDecimal.valueOf(10), t);
        Scheme followers = look(b, "followers", 1, BigDecimal.valueOf(90), t);
        score(pub, 77, true);
        score(followers, 93, false);
        when(dailyLooks.findByLookDate(any())).thenReturn(List.of(daily(followers, t), daily(pub, t)));

        Map<String, Object> visitor = showcase.runway(null, ShowcaseService.RunwayFilter.of(12));
        List<Map<String, Object>> table = (List<Map<String, Object>>) visitor.get("table");
        assertThat(table).extracting(m -> m.get("title")).containsExactly("pub", "followers");
        assertThat((Map<String, Object>) table.get(0).get("hype")).containsEntry("status", "AVAILABLE").containsEntry("score", 77.0).containsEntry("level", "TRENDING");
        assertThat((Map<String, Object>) table.get(1).get("hype")).containsEntry("status", "NOT_CALCULATED").doesNotContainKey("score");
        assertThat(table.get(1)).containsKey("likes");   // popularidade continua, à parte
        Map<String, Object> look = (Map<String, Object>) ((List<Map<String, Object>>) visitor.get("looks")).get(1).get("look");
        assertThat((Map<String, Object>) look.get("hype")).containsEntry("status", "NOT_CALCULATED");
        verify(hype, times(1)).findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.SCHEME), anyCollection(), eq("HYPE_V2"));

        // o dono vê o próprio Hype pessoal, mas a posição continua a do ranking público (último)
        CurrentUser me = new CurrentUser(b.getId(), b.getUsername(), "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        Map<String, Object> own = showcase.runway(me, ShowcaseService.RunwayFilter.of(12));
        List<Map<String, Object>> ownTable = (List<Map<String, Object>>) own.get("table");
        assertThat(ownTable.get(1)).containsEntry("title", "followers").containsEntry("you", true);
        assertThat((Map<String, Object>) ownTable.get(1).get("hype")).containsEntry("score", 93.0);
    }

    // ------------------------------------------------------------------ Eras e Coleções (P1-05, P2-07)

    @Test
    void groupingSortHypeUsesV2WithMissingLastAndGrowthUsesTheWeeklyDelta() {
        User celeb = user(ProfileType.CELEBRIDADE);
        Instant t = Instant.now();
        Scheme a = look(celeb, "a", 0, BigDecimal.valueOf(100), t);
        Scheme b = look(celeb, "b", 0, null, t.minusSeconds(10));
        Scheme c = look(celeb, "c", 0, null, t.minusSeconds(20));
        Scheme d = look(celeb, "d", 0, null, t.minusSeconds(30));
        HypeScoreCurrent hb = score(b, 70, true);
        hb.setDeltaPoints(BigDecimal.valueOf(-4));
        HypeScoreCurrent hc = score(c, 52, true);
        hc.setDeltaPoints(BigDecimal.valueOf(12));
        score(d, 97, false);   // Hype pessoal: para quem visita, não ordena
        Map<UUID, HypeScoreCurrent> map = showcase.hypeOf(HypeEntityType.SCHEME, List.of(a.getId(), b.getId(), c.getId(), d.getId()));

        List<Scheme> byHype = new ArrayList<>(List.of(a, d, c, b));
        byHype.sort(ShowcaseService.order("HYPE", s -> map.get(s.getId()), false, Scheme::getLikeCount, Scheme::getCreatedAt));
        assertThat(byHype).extracting(Scheme::getTitle).containsExactly("b", "c", "a", "d");

        List<Scheme> ownView = new ArrayList<>(List.of(a, d, c, b));
        ownView.sort(ShowcaseService.order("HYPE", s -> map.get(s.getId()), true, Scheme::getLikeCount, Scheme::getCreatedAt));
        assertThat(ownView).extracting(Scheme::getTitle).startsWith("d", "b", "c");   // o dono ordena pelo pessoal

        List<Scheme> byGrowth = new ArrayList<>(List.of(a, b, c, d));
        byGrowth.sort(ShowcaseService.order("GROWTH", s -> map.get(s.getId()), false, Scheme::getLikeCount, Scheme::getCreatedAt));
        assertThat(byGrowth).extracting(Scheme::getTitle).containsExactly("c", "b", "a", "d");
        assertThat(ShowcaseService.SHOWCASE_SORTS).contains("HYPE", "GROWTH");
    }

    @Test
    @SuppressWarnings("unchecked")
    void insightsShowV2HypeApartFromThePopularityScore() {
        User celeb = user(ProfileType.CELEBRIDADE);
        when(institutional.institutionalUser("diva")).thenReturn(celeb);
        SchemeGrouping loved = era(celeb, "Amada", 1);
        SchemeGrouping hyped = era(celeb, "Em alta", 2);
        when(groupings.findByOwnerIdOrderByCreatedAtDesc(celeb.getId())).thenReturn(List.of(loved, hyped));
        Instant t = Instant.now();
        Scheme l1 = look(celeb, "l1", 900, BigDecimal.valueOf(100), t);
        l1.setGroupingId(loved.getId());
        Scheme h1 = look(celeb, "h1", 1, null, t);
        h1.setGroupingId(hyped.getId());
        Scheme h2 = look(celeb, "h2", 1, null, t);
        h2.setGroupingId(hyped.getId());
        Scheme hidden = look(celeb, "hidden", 0, null, t);
        hidden.setGroupingId(loved.getId());
        score(l1, 20, true);
        score(h1, 80, true);
        score(h2, 60, true);
        score(hidden, 99, false);   // Hype pessoal (look privado): fora do agregado de quem visita
        when(schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(eq(celeb.getId()), any())).thenReturn(List.of(l1, h1, h2, hidden));

        Map<String, Object> out = showcase.insights(null, "diva", ShowcaseService.Kind.ERAS);
        List<Map<String, Object>> ranking = (List<Map<String, Object>>) out.get("ranking");
        // a pontuação é popularidade (curtidas + itens): a era mais curtida lidera mesmo com Hype menor
        assertThat(ranking.get(0)).containsEntry("label", "Amada");
        Map<String, Object> lovedHype = (Map<String, Object>) ranking.get(0).get("hype");
        assertThat(lovedHype).containsEntry("top", 20.0).containsEntry("avg", 20.0).containsEntry("items", 1).containsEntry("level", "NICHE");
        Map<String, Object> hypedHype = (Map<String, Object>) ranking.get(1).get("hype");
        assertThat(hypedHype).containsEntry("top", 80.0).containsEntry("avg", 70.0).containsEntry("level", "HOT").containsEntry("items", 2);
        assertThat(out).containsEntry("mostHype", "Em alta").containsEntry("mostLiked", "Amada");
        assertThat((Map<String, Object>) ranking.get(1).get("topScheme")).containsEntry("title", "h1");
        assertThat(String.valueOf(out.get("method"))).contains("popularidade");
    }

    @Test
    void groupHypeWithoutAnyPublicScoreIsEmptyNeverZero() {
        HypeScoreCurrent privateOnly = SearchHypeV2Test.row(HypeEntityType.PIECE, UUID.randomUUID(), 90, false);
        HypeScoreCurrent insufficient = SearchHypeV2Test.row(HypeEntityType.PIECE, UUID.randomUUID(), 0, true);
        insufficient.setStatus(HypeStatus.INSUFFICIENT_DATA);
        insufficient.setScore(null);
        java.util.ArrayList<HypeScoreCurrent> list = new java.util.ArrayList<>(java.util.Arrays.asList(privateOnly, insufficient, null));
        Map<String, Object> h = ShowcaseService.groupHype(list, false, config);
        assertThat(h).containsEntry("top", null).containsEntry("avg", null).containsEntry("level", null).containsEntry("items", 0);
    }

    @Test
    @SuppressWarnings("unchecked")
    void myStageWearsTheLookWithTheHighestPublicV2Hype() {
        User celeb = user(ProfileType.CELEBRIDADE);
        when(institutional.institutionalUser("diva")).thenReturn(celeb);
        when(groupings.findByOwnerIdOrderByCreatedAtDesc(celeb.getId())).thenReturn(List.of());
        Instant t = Instant.now();
        Scheme recentV1 = look(celeb, "recente v1", 0, BigDecimal.valueOf(100), t);
        Scheme privateHype = look(celeb, "pessoal", 0, null, t.minusSeconds(5));
        Scheme top = look(celeb, "topo v2", 0, null, t.minusSeconds(10));
        score(privateHype, 99, false);
        score(top, 74, true);
        when(schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(eq(celeb.getId()), any())).thenReturn(List.of(recentV1, privateHype, top));

        Map<String, Object> out = showcase.stage(null, "diva", null);
        assertThat((Map<String, Object>) out.get("look")).containsEntry("title", "topo v2");
        assertThat((List<Map<String, Object>>) out.get("looks")).extracting(m -> m.get("title")).containsExactly("topo v2", "recente v1", "pessoal");
    }

    private static SchemeGrouping era(User owner, String label, int order) {
        SchemeGrouping g = new SchemeGrouping();
        g.assignId(UUID.randomUUID());
        g.setOwner(owner);
        g.setType(GroupingType.ERA);
        g.setLabel(label);
        g.setSortOrder(order);
        return g;
    }
}
