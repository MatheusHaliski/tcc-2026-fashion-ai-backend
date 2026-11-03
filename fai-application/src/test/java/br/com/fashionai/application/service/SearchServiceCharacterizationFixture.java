package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.SearchIndexPort;
import br.com.fashionai.application.ports.TimelineProjectionPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.Share;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountOrigin;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.BrandSource;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.ShareChannel;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.PublicPersonHeader;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.ShareRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.projection.SpelAwareProxyProjectionFactory;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Mundo fixo do {@link SearchServiceCharacterizationTest}: ids {@code UUID(0x5EA, n)}, instantes relativos a
 * {@link #base} (horas inteiras para a recência não oscilar), Hype v2 gravado com {@code calculatedAt} de 2025, bloqueios,
 * conta de teste, conta suspensa, compartilhamentos no feed, vínculos de marca e índice/timeline ligáveis.
 */
final class SearchServiceCharacterizationFixture {
    static final String PREFIX = "00000000-0000-05ea";
    static final Instant T0 = Instant.parse("2025-03-01T10:00:00Z");

    final Instant base = Instant.now();
    final SchemeRepository schemes = mock(SchemeRepository.class);
    final SchemeItemRepository schemeItems = mock(SchemeItemRepository.class);
    final WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final BrandProfileRepository brands = mock(BrandProfileRepository.class);
    final CelebrityProfileRepository celebrities = mock(CelebrityProfileRepository.class);
    final FollowRepository follows = mock(FollowRepository.class);
    final ShareRepository shares = mock(ShareRepository.class);
    final SealBondRepository bonds = mock(SealBondRepository.class);
    final StyleDnaRepository dnas = mock(StyleDnaRepository.class);
    final SchemeService schemeService = mock(SchemeService.class);
    final ChallengeService challenges = mock(ChallengeService.class);
    final Guard guard = mock(Guard.class);
    final BrandRepository catalog = mock(BrandRepository.class);
    final HypeScoreCurrentRepository hype = mock(HypeScoreCurrentRepository.class);
    final SearchIndexPort index = mock(SearchIndexPort.class);
    final TimelineProjectionPort timeline = mock(TimelineProjectionPort.class);
    SearchIndexPort indexAvailable;
    TimelineProjectionPort timelineAvailable;

    final List<Scheme> looks = new ArrayList<>();
    final List<WardrobeItem> items = new ArrayList<>();
    final List<Share> shareRows = new ArrayList<>();
    final List<HypeScoreCurrent> rows = new ArrayList<>();
    final Map<UUID, List<SchemeItem>> itemsByScheme = new java.util.HashMap<>();
    final User me;
    final User ana;
    final User bia;
    final User caio;
    final User duda;
    final User marca;
    final User edu;
    final SearchService service;
    private int seq;

    static UUID id(int n) {
        return new UUID(0x5EA, n);
    }

    Instant hoursAgo(double h) {
        return base.minusSeconds((long) (h * 3600));
    }

    static CurrentUser as(User u) {
        return new CurrentUser(u.getId(), u.getUsername(), "USER", u.getProfileType(), true, AccountStatus.ACTIVE, "127.0.0.1", "jupiter");
    }

    private User user(String username, ProfileType type) {
        User u = new User();
        u.assignId(id(++seq));
        u.setUsername(username);
        u.setDisplayName("Nome " + username);
        u.setStatus(AccountStatus.ACTIVE);
        u.setProfileType(type);
        u.setProfileVisibility(Visibility.PUBLIC);
        u.setCountry("BR");
        return u;
    }

    private Scheme look(User owner, String title, String style, String occasion, double hours, WardrobeItem... parts) {
        Scheme s = new Scheme();
        s.assignId(id(100 + looks.size() + 1));
        s.setUser(owner);
        s.setTitle(title);
        s.setStyle(style);
        s.setOccasion(occasion);
        s.setVisibility(Visibility.PUBLIC);
        s.setStatus(SchemeStatus.PUBLISHED);
        s.setPublishedAt(hoursAgo(hours));
        s.markCreatedAt(hoursAgo(hours + 1));
        List<SchemeItem> list = new ArrayList<>();
        for (WardrobeItem w : parts) {
            SchemeItem si = new SchemeItem();
            si.setScheme(s);
            si.setWardrobeItem(w);
            list.add(si);
        }
        itemsByScheme.put(s.getId(), list);
        looks.add(s);
        return s;
    }

    private WardrobeItem piece(User owner, String name, String brand, String color, String category, String styles, double hours) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(id(200 + items.size() + 1));
        w.setUser(owner);
        w.setName(name);
        w.setBrandName(brand);
        w.setColor(color);
        w.setCategory(category);
        w.setStyleTags(styles);
        w.setOccasionTags("work");
        w.setVisibility(Visibility.PUBLIC);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.markCreatedAt(hoursAgo(hours));
        items.add(w);
        return w;
    }

    private Share share(User by, TargetType type, UUID target, double hours) {
        Share sh = new Share();
        sh.assignId(id(300 + shareRows.size() + 1));
        sh.setUser(by);
        sh.setTargetType(type);
        sh.setTargetId(target);
        sh.setChannel(ShareChannel.FEED);
        sh.markCreatedAt(hoursAgo(hours));
        shareRows.add(sh);
        return sh;
    }

    private HypeScoreCurrent score(HypeEntityType type, UUID target, double score, boolean eligible) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(type);
        c.setEntityId(target);
        c.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setLevel(HypeScoreConfig.defaults().level(score));
        c.setPublicEligible(eligible);
        c.setCalculatedAt(T0);
        rows.add(c);
        return c;
    }

    static Views.SchemeView view(Scheme s) {
        return new Views.SchemeView(s.getId(), null, s.getTitle(), null, null, null, br.com.fashionai.application.common.Json.csv(s.getStyle()),
                br.com.fashionai.application.common.Json.csv(s.getOccasion()), null, null, null, null, null, false, false, null, null, null, null,
                null, null, List.of(), null, List.of(), List.of(), null, null, null, null, null, false, null, null, null, null, null, null, null,
                null, null);
    }

    @SuppressWarnings("unchecked")
    SearchServiceCharacterizationFixture() {
        me = user("eu", ProfileType.PESSOAL);
        ana = user("ana", ProfileType.PESSOAL);
        bia = user("e2e_bia", ProfileType.PESSOAL);
        bia.setAccountOrigin(AccountOrigin.TEST_SEED);
        caio = user("caio", ProfileType.PESSOAL);
        duda = user("duda", ProfileType.PESSOAL);
        duda.setStatus(AccountStatus.SUSPENDED);
        marca = user("marca", ProfileType.MARCA);
        edu = user("edu", ProfileType.PESSOAL);

        WardrobeItem p1 = piece(ana, "Camisa azul", "Nike", "blue", "upper_piece", "casual", 1);
        WardrobeItem p2 = piece(ana, "Vestido", "Zara", "black", "full_body_piece", "party", 2);
        WardrobeItem p3 = piece(me, "Calca", "Levis", "black", "lower_piece", "casual", 3);
        piece(bia, "Teste", "Nike", "blue", "upper_piece", "casual", 4);
        piece(caio, "Bloqueada", "Nike", "blue", "upper_piece", "casual", 5);
        piece(ana, "Privada", "Nike", "blue", "upper_piece", "casual", 6).setVisibility(Visibility.PRIVATE);
        piece(ana, "Em moderacao", "Nike", "blue", "upper_piece", "casual", 7).setModerationStatus(ModerationStatus.PENDING);
        WardrobeItem p8 = piece(ana, "Jaqueta Nike", "nike", "green", "upper_piece", "street", 8);
        WardrobeItem p9 = piece(duda, "Suspensa", "Nike", "blue", "upper_piece", "casual", 9);

        Scheme s1 = look(ana, "Casual azul", "casual", "work", 2, p1);
        Scheme s2 = look(ana, "Festa", "party", "party", 5, p2);
        look(bia, "Teste", "casual", "work", 1);
        Scheme s4 = look(caio, "Bloqueado", "casual", "work", 3);
        look(duda, "Suspenso", "casual", "work", 4, p9);
        Scheme s6 = look(me, "Meu look", "casual,party", "work", 6, p1, p3);
        look(ana, "Rascunho", "casual", "work", 7).setStatus(SchemeStatus.DRAFT);
        look(ana, "Seguidores", "casual", "work", 8).setVisibility(Visibility.FOLLOWERS);
        Scheme s9 = look(ana, "Inverno", "casual", "winter", 30);
        Scheme s10 = look(edu, "Do edu", "casual", "work", 9);
        Scheme s11 = look(marca, "Colecao marca", "street", "party", 10, p8);

        score(HypeEntityType.SCHEME, s1.getId(), 80, true);
        score(HypeEntityType.SCHEME, s2.getId(), 40, true);
        score(HypeEntityType.SCHEME, s6.getId(), 90, false);
        HypeScoreCurrent rising = score(HypeEntityType.SCHEME, s9.getId(), 65, true);
        rising.setMomentum(HypeMomentum.RISING);
        rising.setDeltaPoints(BigDecimal.valueOf(7.25));
        rising.setDeltaPercent(BigDecimal.valueOf(12.04));
        rising.setDirection("UP");
        score(HypeEntityType.SCHEME, s11.getId(), 70, true);
        score(HypeEntityType.SCHEME, s4.getId(), 99, true);
        score(HypeEntityType.PIECE, p1.getId(), 75, true);
        score(HypeEntityType.PIECE, p8.getId(), 30, true);
        score(HypeEntityType.PIECE, p2.getId(), 62, false);

        share(me, TargetType.PIECE, p1.getId(), 0.5);
        share(ana, TargetType.SCHEME, s2.getId(), 1);
        share(caio, TargetType.SCHEME, s1.getId(), 0.2);
        share(ana, TargetType.SCHEME, s9.getId(), 20);
        share(ana, TargetType.PIECE, p8.getId(), 3);
        share(marca, TargetType.SCHEME, id(999), 4);
        share(me, TargetType.SCHEME, s1.getId(), 0.1);
        share(ana, TargetType.SCHEME, s1.getId(), 40);

        when(schemeService.canView(any(), any())).thenAnswer(a -> {
            CurrentUser v = a.getArgument(0);
            Scheme s = a.getArgument(1);
            return s.getVisibility() == Visibility.PUBLIC || v != null && v.id().equals(s.getUser().getId());
        });
        when(schemeService.view(any(), any(), any())).thenAnswer(a -> view(a.getArgument(1)));
        when(guard.canView(any(), any(), any())).thenAnswer(a -> a.getArgument(2) == Visibility.PUBLIC);
        when(schemeItems.findBySchemeIdOrderBySortOrder(any())).thenAnswer(a -> itemsByScheme.getOrDefault(a.<UUID>getArgument(0), List.of()));
        when(schemes.findPublicFeed(any())).thenAnswer(a -> looks.stream().sorted((x, y) -> y.getPublishedAt().compareTo(x.getPublishedAt())).toList());
        when(schemes.findAllPublic(any())).thenAnswer(a -> List.copyOf(looks));
        when(schemes.searchPublic(anyString(), any())).thenAnswer(a -> looks.stream()
                .filter(s -> s.getTitle().toLowerCase().contains(a.<String>getArgument(0).toLowerCase())).toList());
        when(schemes.findById(any())).thenAnswer(a -> looks.stream().filter(s -> s.getId().equals(a.getArgument(0))).findFirst());
        when(schemes.findByIdIn(anyCollection())).thenAnswer(a -> {
            Collection<UUID> ids = a.getArgument(0);
            return looks.stream().filter(s -> ids.contains(s.getId())).toList();
        });
        when(schemes.findFeedForFollowing(anyCollection(), any())).thenAnswer(a -> {
            Collection<UUID> ids = a.getArgument(0);
            return looks.stream().filter(s -> ids.contains(s.getUser().getId()) && s.getVisibility() != Visibility.PRIVATE).toList();
        });
        when(schemes.countByUserIdsAndStatusNot(anyCollection(), any())).thenReturn(List.<Object[]>of(new Object[]{ana.getId(), 6L}));
        when(pieces.findAllPublic(any())).thenAnswer(a -> List.copyOf(items));
        when(pieces.searchPublic(anyString(), any())).thenAnswer(a -> items.stream()
                .filter(w -> (w.getName() + " " + w.getBrandName()).toLowerCase().contains(a.<String>getArgument(0).toLowerCase())).toList());
        when(pieces.findById(any())).thenAnswer(a -> items.stream().filter(w -> w.getId().equals(a.getArgument(0))).findFirst());
        when(pieces.findByIdIn(anyCollection())).thenAnswer(a -> {
            Collection<UUID> ids = a.getArgument(0);
            return items.stream().filter(w -> ids.contains(w.getId())).toList();
        });
        when(pieces.countPublicByBrandName(anyString())).thenAnswer(a -> (long) a.<String>getArgument(0).length());
        when(pieces.countByUserIdsAndAvailabilityStatusNot(anyCollection(), any())).thenReturn(List.<Object[]>of(new Object[]{me.getId(), 3L}));
        when(shares.findByChannelOrderByCreatedAtDesc(eq(ShareChannel.FEED), any())).thenAnswer(a -> shareRows.stream()
                .sorted((x, y) -> y.getCreatedAt().compareTo(x.getCreatedAt())).toList());
        when(shares.findFeedShares(anyCollection(), eq(ShareChannel.FEED), any())).thenAnswer(a -> {
            Collection<UUID> ids = a.getArgument(0);
            return shareRows.stream().filter(sh -> ids.contains(sh.getUser().getId())).sorted((x, y) -> y.getCreatedAt().compareTo(x.getCreatedAt())).toList();
        });
        when(follows.findByFollowingIdAndStatus(eq(me.getId()), eq(FollowStatus.BLOQUEADO))).thenReturn(List.of(new Follow(caio, me, FollowStatus.BLOQUEADO)));
        when(follows.findByFollowerIdAndStatus(eq(me.getId()), eq(FollowStatus.BLOQUEADO))).thenReturn(List.of(new Follow(me, edu, FollowStatus.BLOQUEADO)));
        when(follows.findByFollowerIdAndStatus(eq(me.getId()), eq(FollowStatus.ACEITO)))
                .thenReturn(List.of(new Follow(me, ana, FollowStatus.ACEITO), new Follow(me, marca, FollowStatus.ACEITO)));
        when(follows.countFollowersByIds(anyCollection(), eq(FollowStatus.ACEITO))).thenReturn(List.<Object[]>of(new Object[]{ana.getId(), 12L}));
        when(follows.countFollowingByIds(anyCollection(), eq(FollowStatus.ACEITO))).thenReturn(List.of());
        when(follows.findByFollowerIdAndFollowingIdIn(eq(me.getId()), anyCollection())).thenReturn(List.of(new Follow(me, ana, FollowStatus.ACEITO)));
        when(users.findById(any())).thenAnswer(a -> List.of(me, ana, bia, caio, duda, marca, edu).stream()
                .filter(u -> u.getId().equals(a.getArgument(0))).findFirst());
        SpelAwareProxyProjectionFactory projections = new SpelAwareProxyProjectionFactory();
        when(users.searchPersonalProfiles(anyString(), org.mockito.ArgumentMatchers.anyBoolean(), anyCollection(), any())).thenAnswer(a ->
                List.of(ana, me, edu).stream().filter(u -> u.getUsername().contains(a.<String>getArgument(0)))
                        .map(u -> projections.createProjection(PublicPersonHeader.class, u)).toList());
        SealBond bonded = new SealBond();
        bonded.setScheme(s11);
        bonded.markCreatedAt(hoursAgo(0.3));
        SealBond blockedBond = new SealBond();
        blockedBond.setScheme(s10);
        blockedBond.markCreatedAt(hoursAgo(0.4));
        when(bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(eq(marca.getId()), eq(SealBondStatus.APPROVED)))
                .thenReturn(List.of(bonded, new SealBond(), blockedBond));
        StyleDna dna = new StyleDna(me);
        dna.setStyleKeywords("party,street");
        when(dnas.findByUserId(eq(me.getId()))).thenReturn(Optional.of(dna));
        when(challenges.voteFeed(any())).thenReturn(List.of(Map.of("battle", "b1")));
        BrandProfile nike = new BrandProfile();
        nike.assignId(id(401));
        nike.setOwner(marca);
        nike.setBrandName("Nike");
        nike.setSlug("nike");
        nike.setLogoUrl("/nike.png");
        BrandProfile other = new BrandProfile();
        other.assignId(id(402));
        other.setOwner(edu);
        other.setBrandName("Casualidade");
        other.setSlug("casualidade");
        when(brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)).thenReturn(List.of(nike, other));
        when(catalog.findAllByOrderByName()).thenReturn(List.of(new Brand("Hering", "hering", BrandSource.SEEDED),
                new Brand("NIKE", "nike-cat", BrandSource.SEEDED), new Brand("Nikelandia", "nikelandia", BrandSource.SEEDED),
                new Brand("Zara", "zara", BrandSource.SEEDED)));
        CelebrityProfile star = new CelebrityProfile();
        star.setOwner(ana);
        star.setStageName("Ana Estrela");
        star.setSlug("ana-estrela");
        CelebrityProfile other2 = new CelebrityProfile();
        other2.setOwner(edu);
        other2.setStageName("Edu Famoso");
        other2.setSlug("edu");
        other2.setAvatarUrl("/edu.png");
        when(celebrities.findByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)).thenReturn(List.of(star, other2));
        when(hype.findByEntityTypeAndEntityIdInAndAlgorithmVersion(any(), anyCollection(), eq(HypeScoreConfig.DEFAULT_VERSION))).thenAnswer(a -> {
            Collection<UUID> ids = a.getArgument(1);
            return rows.stream().filter(r -> r.getEntityType() == a.getArgument(0) && ids.contains(r.getEntityId())).toList();
        });
        when(hype.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(any(), eq(HypeScoreConfig.DEFAULT_VERSION), eq(HypeStatus.AVAILABLE)))
                .thenAnswer(a -> rows.stream().filter(r -> r.getEntityType() == a.getArgument(0) && r.isPublicEligible()).toList());
        when(index.enabled()).thenReturn(true);
        when(index.search(anyString(), anyString(), any(), org.mockito.ArgumentMatchers.anyInt()))
                .thenAnswer(a -> "schemes".equals(a.getArgument(0)) ? List.of(s2.getId(), s1.getId()) : List.of(p8.getId(), p1.getId()));
        when(timeline.enabled()).thenReturn(true);
        when(timeline.readTimeline(any(), org.mockito.ArgumentMatchers.anyInt())).thenReturn(List.of(s2.getId(), s4.getId()));
        ObjectProvider<SearchIndexPort> indexProvider = mock(ObjectProvider.class);
        when(indexProvider.getIfAvailable()).thenAnswer(a -> indexAvailable);
        ObjectProvider<TimelineProjectionPort> timelineProvider = mock(ObjectProvider.class);
        when(timelineProvider.getIfAvailable()).thenAnswer(a -> timelineAvailable);
        service = new SearchService(schemes, schemeItems, pieces, users, brands, celebrities, follows, shares, bonds, dnas, indexProvider,
                timelineProvider, schemeService, challenges, guard, catalog, hype, HypeScoreConfig.defaults());
    }

    /** Rótulo estável de um instante do mundo: minutos antes de {@link #base}. */
    String label(Instant t) {
        return "-" + Duration.between(t, base).toMinutes() + "min";
    }
}
