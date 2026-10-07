package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.SearchIndexPort;
import br.com.fashionai.application.ports.TimelineProjectionPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.Share;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.ShareChannel;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.ShareRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF53 · Lote 1 (P1-01, P1-02, P2-01) — feed, busca vazia e filtro "Em alta" no HypeScore v2: só o Hype público ordena
 * e filtra, sem Hype público o look fica neutro (nunca 0), o v1 não entra mais, GET lê o estado numa consulta por página.
 */
class SearchHypeV2Test {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private SchemeRepository schemes;
    private WardrobeItemRepository pieces;
    private HypeScoreCurrentRepository hype;
    private SchemeService schemeService;
    private ShareRepository shares;
    private Guard guard;
    private SearchService search;
    private final Instant published = Instant.now().minusSeconds(3600);

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        schemes = mock(SchemeRepository.class);
        pieces = mock(WardrobeItemRepository.class);
        hype = mock(HypeScoreCurrentRepository.class);
        schemeService = mock(SchemeService.class);
        when(schemeService.canView(any(), any())).thenReturn(true);
        when(schemeService.view(any(), any(), any())).thenAnswer(a -> {
            Views.SchemeView v = mock(Views.SchemeView.class);
            when(v.id()).thenReturn(((Scheme) a.getArgument(1)).getId());
            return v;
        });
        shares = mock(ShareRepository.class);
        guard = mock(Guard.class);
        when(guard.canView(any(), any(), any())).thenReturn(true);
        search = new SearchService(schemes, mock(SchemeItemRepository.class), pieces, mock(UserRepository.class), mock(BrandProfileRepository.class),
                mock(CelebrityProfileRepository.class), mock(FollowRepository.class), shares, mock(SealBondRepository.class),
                mock(StyleDnaRepository.class), (ObjectProvider<SearchIndexPort>) mock(ObjectProvider.class), (ObjectProvider<TimelineProjectionPort>) mock(ObjectProvider.class),
                schemeService, mock(ChallengeService.class), guard, mock(BrandRepository.class), hype, config);
    }

    private static User owner() {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setStatus(AccountStatus.ACTIVE);
        u.setProfileVisibility(Visibility.PUBLIC);
        u.setProfileType(ProfileType.PESSOAL);
        u.setUsername("ana");
        return u;
    }

    private Scheme look(String title) {
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        s.setUser(owner());
        s.setTitle(title);
        s.setStyle("casual");
        s.setOccasion("work");
        s.setVisibility(Visibility.PUBLIC);
        s.setStatus(SchemeStatus.PUBLISHED);
        s.setPublishedAt(published);
        s.markCreatedAt(published);
        return s;
    }

    private static WardrobeItem piece() {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(owner());
        w.setVisibility(Visibility.PUBLIC);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.markCreatedAt(Instant.now());
        return w;
    }

    static HypeScoreCurrent row(HypeEntityType type, UUID id, double score, boolean eligible) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(type);
        c.setEntityId(id);
        c.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setLevel(HypeScoreConfig.defaults().level(score));
        c.setPublicEligible(eligible);
        c.setCalculatedAt(Instant.now());
        return c;
    }

    private void hypeOf(HypeScoreCurrent... rows) {
        when(hype.findByEntityTypeAndEntityIdInAndAlgorithmVersion(any(), anyCollection(), eq(HypeScoreConfig.DEFAULT_VERSION))).thenAnswer(a -> {
            Collection<UUID> ids = a.getArgument(1);
            return List.of(rows).stream().filter(r -> r.getEntityType() == a.getArgument(0) && ids.contains(r.getEntityId())).toList();
        });
    }

    private List<UUID> viewedInOrder(int calls) {
        ArgumentCaptor<Scheme> seen = ArgumentCaptor.forClass(Scheme.class);
        verify(schemeService, times(calls)).view(any(), seen.capture(), any());
        return seen.getAllValues().stream().map(Scheme::getId).toList();
    }

    @Test
    void relevanceUsesThePublicV2ScoreAndNeverTheV1Column() {
        Scheme a = look("a");
        Scheme b = look("b");
        // o v1 (100 × nulo) não muda nada: o que entra é o Hype público passado
        assertThat(SearchService.relevance(a, List.of(), Set.of(), 80.0)).isEqualTo(SearchService.relevance(b, List.of(), Set.of(), 80.0));
        // sem Hype público = neutro (0,5), igual a um score 50 — nunca 0
        assertThat(SearchService.relevance(a, List.of(), Set.of(), null)).isEqualTo(SearchService.relevance(a, List.of(), Set.of(), 50.0));
        assertThat(SearchService.relevance(a, List.of(), Set.of(), null)).isGreaterThan(SearchService.relevance(a, List.of(), Set.of(), 0.0));
    }

    @Test
    void feedOrdersByPublicHypeAndKeepsLooksWithoutPublicHypeNeutral() {
        Scheme hot = look("hot");
        Scheme privateHype = look("private");   // v1 alto e Hype v2 só pessoal: não pode subir
        Scheme fresh = look("fresh");                              // sem cálculo: neutro, não último
        Scheme low = look("low");
        when(schemes.findPublicFeed(any())).thenReturn(new ArrayList<>(List.of(low, fresh, privateHype, hot)));
        hypeOf(row(HypeEntityType.SCHEME, hot.getId(), 90, true), row(HypeEntityType.SCHEME, privateHype.getId(), 99, false),
                row(HypeEntityType.SCHEME, low.getId(), 10, true));

        Map<String, Object> out = search.communityFeed(null, null, 10, new SearchService.Filters(null, null, null, null, null));

        List<UUID> order = viewedInOrder(4);
        assertThat(order.get(0)).isEqualTo(hot.getId());
        assertThat(order.get(3)).isEqualTo(low.getId());
        assertThat(order.subList(1, 3)).containsExactlyInAnyOrder(fresh.getId(), privateHype.getId());
        // uma consulta de Hype por página (antes do sort), nunca uma por look
        verify(hype, times(1)).findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.SCHEME), anyCollection(), eq(HypeScoreConfig.DEFAULT_VERSION));
        assertThat(out.get("items")).asList().hasSize(4);
    }

    @Test
    void hotFilterKeepsOnlyPublicHypeFromTheBandUpWithTheDisplayedRounding() {
        Scheme hot = look("hot");
        Scheme borderline = look("59.6");   // aparece como 60 = Em alta
        Scheme below = look("59.4");
        Scheme privateHype = look("private");
        Scheme none = look("none");
        when(schemes.findPublicFeed(any())).thenReturn(new ArrayList<>(List.of(hot, borderline, below, privateHype, none)));
        hypeOf(row(HypeEntityType.SCHEME, hot.getId(), 82, true), row(HypeEntityType.SCHEME, borderline.getId(), 59.6, true),
                row(HypeEntityType.SCHEME, below.getId(), 59.4, true), row(HypeEntityType.SCHEME, privateHype.getId(), 95, false));

        Map<String, Object> out = search.communityFeed(null, null, 10, new SearchService.Filters(null, null, null, null, null, "hot"));

        assertThat(viewedInOrder(2)).containsExactlyInAnyOrder(hot.getId(), borderline.getId());
        assertThat(out.get("chips")).asList().contains(Map.of("key", "hypeLevel", "value", "HOT"));
    }

    @Test
    void publicPiecesAndSearchFilterByLevelToo() {
        WardrobeItem viral = piece();
        WardrobeItem nicheOnly = piece();
        WardrobeItem privateHype = piece();
        when(pieces.findAllPublic(any())).thenReturn(List.of(viral, nicheOnly, privateHype));
        hypeOf(row(HypeEntityType.PIECE, viral.getId(), 93, true), row(HypeEntityType.PIECE, nicheOnly.getId(), 30, true),
                row(HypeEntityType.PIECE, privateHype.getId(), 96, false));

        Map<String, Object> out = search.publicPieces(null, new SearchService.Filters(null, null, null, null, null, "TRENDING"), null, 24);
        assertThat(out.get("items")).asList().extracting("id").containsExactly(viral.getId());

        Map<String, Object> found = search.search(null, "", "PECAS", new SearchService.Filters(null, null, null, null, null, "NICHE"), 30, null);
        assertThat(found.get("results")).asList().extracting("id").containsExactlyInAnyOrder(viral.getId(), nicheOnly.getId());
    }

    @Test
    void unknownLevelIsABadRequestAndNoLevelMeansNoFilter() {
        assertThatThrownBy(() -> search.communityFeed(null, null, 10, new SearchService.Filters(null, null, null, null, null, "MUITO_ESTILOSO")))
                .isInstanceOf(ApiException.class);
        assertThat(SearchService.parseLevel(" ")).isNull();
        assertThat(SearchService.parseLevel("viral")).isEqualTo(HypeLevel.VIRAL);
        assertThat(SearchService.levelMinimum(config, HypeLevel.HOT)).isEqualTo(60);
        assertThat(SearchService.meetsLevel(null, null, config)).isTrue();
        assertThat(SearchService.meetsLevel(null, HypeLevel.LOW_SIGNAL, config)).isFalse();   // sem Hype público nunca passa
    }

    @Test
    void emptySearchShowsTheV2PublicTrendingNotTheV1Column() {
        Scheme v1Star = look("v1");
        Scheme first = look("first");
        Scheme second = look("second");
        when(schemes.searchPublic(any(), any())).thenReturn(List.of());
        when(hype.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.SCHEME, HypeScoreConfig.DEFAULT_VERSION, HypeStatus.AVAILABLE))
                .thenReturn(List.of(row(HypeEntityType.SCHEME, second.getId(), 61, true), row(HypeEntityType.SCHEME, first.getId(), 88, true)));
        when(schemes.findByIdIn(anyCollection())).thenReturn(List.of(second, first, v1Star));

        Map<String, Object> out = search.search(null, "qwxz", "LOOKS", null, 30, null);

        @SuppressWarnings("unchecked")
        List<Views.SchemeView> trending = (List<Views.SchemeView>) ((Map<String, Object>) out.get("empty")).get("trending");
        assertThat(trending).extracting(Views.SchemeView::id).containsExactly(first.getId(), second.getId());
        verify(schemes, never()).findPublicFeed(any());   // a lista antiga (v1) não é mais lida
    }

    @Test
    void emptySearchWithoutPublicHypeShowsNoTrendingSection() {
        when(schemes.searchPublic(any(), any())).thenReturn(List.of());
        Map<String, Object> out = search.search(null, "qwxz", "LOOKS", null, 30, null);
        @SuppressWarnings("unchecked")
        List<?> trending = (List<?>) ((Map<String, Object>) out.get("empty")).get("trending");
        assertThat(trending).isEmpty();
    }

    @Test
    void summaryHidesPersonalHypeFromThirdPartiesAndNeverTurnsMissingIntoZero() {
        HypeScoreCurrent personal = row(HypeEntityType.SCHEME, UUID.randomUUID(), 77, false);
        assertThat(SearchService.hypeSummary(personal, false, config)).containsEntry("status", "NOT_CALCULATED").doesNotContainKey("score");
        assertThat(SearchService.hypeSummary(personal, true, config)).containsEntry("status", "AVAILABLE").containsEntry("score", 77.0)
                .containsEntry("level", "TRENDING");
        HypeScoreCurrent insufficient = row(HypeEntityType.SCHEME, UUID.randomUUID(), 0, true);
        insufficient.setStatus(HypeStatus.INSUFFICIENT_DATA);
        insufficient.setScore(null);
        assertThat(SearchService.hypeSummary(insufficient, false, config)).containsEntry("status", "INSUFFICIENT_DATA").containsEntry("score", null);
        assertThat(SearchService.hypeSummary(null, false, config)).containsEntry("status", "NOT_CALCULATED");
    }

    private static Share share(User by, TargetType type, UUID target, String caption, Instant at) {
        Share sh = new Share();
        sh.assignId(UUID.randomUUID());
        sh.setUser(by);
        sh.setTargetType(type);
        sh.setTargetId(target);
        sh.setChannel(ShareChannel.FEED);
        sh.setCaption(caption);
        sh.markCreatedAt(at);
        return sh;
    }

    @Test
    @SuppressWarnings("unchecked")
    void feedShowsWhatWasSharedToTheFeedLooksAndPiecesOncePerContent() {
        Scheme shared = look("compartilhado");
        Scheme plain = look("publicado");
        WardrobeItem tee = piece();
        WardrobeItem secret = piece();
        secret.setVisibility(Visibility.PRIVATE);           // quem vê não abre: o post não entra
        when(guard.canView(any(), eq(secret.getUser().getId()), eq(Visibility.PRIVATE))).thenReturn(false);
        when(schemes.findPublicFeed(any())).thenReturn(new ArrayList<>(List.of(shared, plain)));
        when(pieces.findById(tee.getId())).thenReturn(Optional.of(tee));
        when(pieces.findById(secret.getId())).thenReturn(Optional.of(secret));
        User bia = owner();
        Instant now = Instant.now();
        when(shares.findByChannelOrderByCreatedAtDesc(eq(ShareChannel.FEED), any())).thenReturn(List.of(
                share(bia, TargetType.PIECE, secret.getId(), null, now.minusSeconds(10)),
                share(bia, TargetType.PIECE, tee.getId(), "Peça do dia", now.minusSeconds(30)),
                share(bia, TargetType.SCHEME, shared.getId(), "Olha esse look", now.minusSeconds(60))));

        Map<String, Object> out = search.communityFeed(null, null, 10, new SearchService.Filters(null, null, null, null, null));

        List<Map<String, Object>> entries = (List<Map<String, Object>>) out.get("entries");
        // o compartilhamento é um post novo (sobe pela hora do post); o look compartilhado aparece uma vez só
        assertThat(entries).extracting(e -> e.get("id")).containsExactly(tee.getId(), shared.getId(), plain.getId());
        // o post do FashionAI é o próprio card: quem compartilhou, sem descrição
        assertThat(entries.get(0)).containsEntry("kind", "PIECE").containsKey("sharedBy").doesNotContainKey("caption");
        assertThat(((Views.PieceView) entries.get(0).get("piece")).id()).isEqualTo(tee.getId());
        assertThat(entries.get(1)).containsEntry("kind", "SCHEME").containsKey("sharedBy").doesNotContainKey("caption");
        assertThat(entries.get(2)).doesNotContainKey("sharedBy");
        // "items" continua só com looks (a busca usa), e cada look é montado uma vez
        assertThat(out.get("items")).asList().hasSize(2);
        verify(schemeService, times(2)).view(any(), any(), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void followingTabShowsMyOwnSharesAndSharedPieces() {
        User me = owner();
        WardrobeItem tee = piece();
        tee.setUser(me);
        when(pieces.findById(tee.getId())).thenReturn(Optional.of(tee));
        when(schemes.findPublicFeed(any())).thenReturn(new ArrayList<>());
        when(shares.findFeedShares(eq(List.of(me.getId())), eq(ShareChannel.FEED), any()))
                .thenReturn(List.of(share(me, TargetType.PIECE, tee.getId(), "Minha peça", Instant.now())));

        Map<String, Object> out = search.runway(CurrentUser.of(me, "127.0.0.1", "JUnit"), null, 12);

        List<Map<String, Object>> items = (List<Map<String, Object>>) out.get("items");
        assertThat(items).hasSize(1);
        assertThat(items.get(0)).containsEntry("reason", "COMPARTILHADO").containsKey("by").doesNotContainKey("caption");
        assertThat(((Views.PieceView) items.get(0).get("piece")).id()).isEqualTo(tee.getId());
    }
}
