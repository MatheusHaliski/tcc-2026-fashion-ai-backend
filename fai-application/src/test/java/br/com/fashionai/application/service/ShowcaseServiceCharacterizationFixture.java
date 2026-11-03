package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeGrouping;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountOrigin;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.model.enums.GroupingType;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.Model3dStatus;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.Mockito.mock;

/**
 * Mundo fixo do {@link ShowcaseServiceCharacterizationTest}: ids {@code UUID(0x5C3, n)}; perfis pessoais de vários países
 * (conta de teste, fora da Passarela, suspensa), uma celebridade com eras/turnê/fase, uma marca com coleções, peças em
 * todos os estados do RF16, Look do Dia de hoje (com e sem materialização), Hype v2 público e pessoal e guarda/dono
 * simulados como no serviço real (dono ou 403/404).
 */
final class ShowcaseServiceCharacterizationFixture {
    static final String PREFIX = "00000000-0000-05c3";
    static final Instant T0 = Instant.parse("2025-03-01T10:00:00Z");

    final Instant base = Instant.now();
    final LocalDate today = LocalDate.now(FaiPointsService.ZONE);
    final SchemeRepository schemes = mock(SchemeRepository.class);
    final SchemeItemRepository schemeItems = mock(SchemeItemRepository.class);
    final WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
    final SchemeGroupingRepository groupings = mock(SchemeGroupingRepository.class);
    final DailyLookRepository dailyLooks = mock(DailyLookRepository.class);
    final DailyLookService dailyLookService = mock(DailyLookService.class);
    final UserPreferencesRepository preferences = mock(UserPreferencesRepository.class);
    final CelebrityProfileRepository celebrities = mock(CelebrityProfileRepository.class);
    final SchemeService schemeService = mock(SchemeService.class);
    final InstitutionalService institutional = mock(InstitutionalService.class);
    final Model3dService model3d = mock(Model3dService.class);
    final Guard guard = mock(Guard.class);
    final Avatar3dService avatars3d = mock(Avatar3dService.class);
    final UserRepository users = mock(UserRepository.class);
    final MediaService media = mock(MediaService.class);
    final FollowRepository follows = mock(FollowRepository.class);
    final HypeScoreCurrentRepository hype = mock(HypeScoreCurrentRepository.class);

    final List<User> people = new ArrayList<>();
    final List<Scheme> looks = new ArrayList<>();
    final List<WardrobeItem> items = new ArrayList<>();
    final List<SchemeGrouping> groups = new ArrayList<>();
    final List<DailyLook> daily = new ArrayList<>();
    final List<HypeScoreCurrent> rows = new ArrayList<>();
    final Map<UUID, List<SchemeItem>> itemsByScheme = new HashMap<>();
    final List<String> stored = new ArrayList<>();
    final User me;
    final User ana;
    final User rui;
    final User celeb;
    final User quiet;
    final User marca;
    final ShowcaseService service;

    static UUID id(int n) {
        return new UUID(0x5C3, n);
    }

    static CurrentUser as(User u) {
        return new CurrentUser(u.getId(), u.getUsername(), "USER", u.getProfileType(), true, AccountStatus.ACTIVE, "127.0.0.1", "jupiter");
    }

    private User user(String username, ProfileType type, String country, MannequinSex sex) {
        User u = new User();
        u.assignId(id(people.size() + 1));
        u.setUsername(username);
        u.setDisplayName("Nome " + username);
        u.setStatus(AccountStatus.ACTIVE);
        u.setProfileType(type);
        u.setProfileVisibility(Visibility.PUBLIC);
        u.setCountry(country);
        u.setSex(sex);
        u.setAvatarUrl("/avatars/" + username + ".jpg");
        people.add(u);
        return u;
    }

    WardrobeItem piece(User owner, String name, String category, String color, String sex, Model3dStatus status) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(id(200 + items.size() + 1));
        w.setUser(owner);
        w.setName(name);
        w.setCategory(category);
        w.setSubcategory(category + "_sub");
        w.setColor(color);
        w.setSex(sex);
        w.setImageUrl("/pieces/" + name + ".png");
        w.setStudioImageUrl(items.size() % 2 == 0 ? "/studio/" + name + ".jpg" : null);
        w.setModel3dStatus(status);
        w.setModel3dUrl(status == null ? null : "/glb/" + name + ".glb");
        w.setOccasionTags("casual,work");
        w.setStyleTags(items.size() % 2 == 0 ? "street" : "classic");
        w.setVisibility(Visibility.PUBLIC);
        w.setBrandName("Marca " + name);
        w.setTags("tag-" + name);
        w.setLikesCount(items.size() * 3L % 7);
        w.markCreatedAt(base.minusSeconds(3600L * (items.size() + 1)));
        items.add(w);
        return w;
    }

    Scheme look(User owner, String title, double hours, WardrobeItem... parts) {
        Scheme s = new Scheme();
        s.assignId(id(100 + looks.size() + 1));
        s.setUser(owner);
        s.setTitle(title);
        s.setStyle(looks.size() % 2 == 0 ? "street,casual" : "classic");
        s.setOccasion("party");
        s.setTags("tag-" + title);
        s.setVisibility(Visibility.PUBLIC);
        s.setStatus(SchemeStatus.PUBLISHED);
        s.setLikeCount(looks.size() * 5L % 11);
        s.setCommentCount(looks.size() % 3);
        s.setShareCount(looks.size() % 4);
        s.setCoverImageUrl(looks.size() % 3 == 0 ? null : "/covers/" + title + ".jpg");
        s.markCreatedAt(base.minusSeconds((long) (hours * 3600)));
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

    SchemeGrouping grouping(User owner, GroupingType type, String label, Integer from, Integer to, int sort) {
        SchemeGrouping g = new SchemeGrouping();
        g.assignId(id(300 + groups.size() + 1));
        g.setOwner(owner);
        g.setType(type);
        g.setLabel(label);
        g.setDescription("Sobre " + label);
        g.setPeriodFrom(from);
        g.setPeriodTo(to);
        g.setSortOrder(sort);
        g.setEditorialJson(groups.size() % 2 == 0 ? "{\"quote\":\"" + label + "\"}" : null);
        g.setAccentColor(groups.size() % 2 == 0 ? null : "#AA3300");
        g.markCreatedAt(base.minusSeconds(60L * groups.size()));
        groups.add(g);
        return g;
    }

    private DailyLook today(Scheme s, double hours, DailyLookSource source) {
        DailyLook dl = new DailyLook(s.getUser(), s, today, source);
        dl.assignId(id(400 + daily.size() + 1));
        dl.markCreatedAt(base.minusSeconds((long) (hours * 3600)));
        daily.add(dl);
        return dl;
    }

    private HypeScoreCurrent score(HypeEntityType type, UUID target, double score, boolean eligible, Double trend, Double delta, HypeMomentum m) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(type);
        c.setEntityId(target);
        c.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setLevel(HypeScoreConfig.defaults().level(score));
        c.setPublicEligible(eligible);
        c.setMomentum(m);
        c.setDeltaPoints(delta == null ? null : BigDecimal.valueOf(delta));
        HypeDimensions d = new HypeDimensions();
        d.setTrend(trend == null ? null : BigDecimal.valueOf(trend));
        c.setDimensions(d);
        c.setCalculatedAt(T0);
        rows.add(c);
        return c;
    }

    ShowcaseServiceCharacterizationFixture() {
        me = user("eu", ProfileType.PESSOAL, "br", null);
        ana = user("ana", ProfileType.PESSOAL, "BR", MannequinSex.FEMININO);
        rui = user("rui", ProfileType.PESSOAL, "PT", MannequinSex.MASCULINO);
        User bia = user("e2e_bia", ProfileType.PESSOAL, "BR", null);
        bia.setAccountOrigin(AccountOrigin.TEST_SEED);
        User duda = user("duda", ProfileType.PESSOAL, "BR", null);
        duda.setRunwayOptOut(true);
        User edu = user("edu", ProfileType.PESSOAL, "BR", null);
        edu.setStatus(AccountStatus.SUSPENDED);
        User zeca = user("zeca", ProfileType.PESSOAL, "JP", MannequinSex.MASCULINO);
        celeb = user("estrela", ProfileType.CELEBRIDADE, "US", MannequinSex.FEMININO);
        quiet = user("quieta", ProfileType.CELEBRIDADE, null, null);
        marca = user("marcax", ProfileType.MARCA, "US", null);

        WardrobeItem p1 = piece(me, "camisa", "upper_piece", "blue", "MASCULINO", null);
        WardrobeItem p2 = piece(me, "calca", "lower_piece", "black", "MASCULINO", Model3dStatus.COMPLETED);
        WardrobeItem p3 = piece(me, "tenis", "footwear", "white", "FEMININO", Model3dStatus.QUEUED);
        WardrobeItem p4 = piece(me, "bone", "accessory", "red", null, null);
        p4.setDefaultImage(true);
        WardrobeItem p5 = piece(ana, "lenco", "accessory", "pink", "FEMININO", null);
        WardrobeItem p6 = piece(me, "jaqueta", "upper_piece", "green", "MASCULINO", Model3dStatus.FAILED);
        WardrobeItem p7 = piece(ana, "vestido", "full_body_piece", "red", "FEMININO", Model3dStatus.COMPLETED);
        WardrobeItem p8 = piece(rui, "blazer", "upper_piece", "navy", "MASCULINO", Model3dStatus.PROCESSING);
        piece(me, "secreta", "upper_piece", "blue", null, null).setVisibility(Visibility.PRIVATE);

        SchemeGrouping era1 = grouping(celeb, GroupingType.ERA, "Era pop", 2010, 2014, 0);
        SchemeGrouping tour = grouping(celeb, GroupingType.TOUR, "Turne", 2016, null, 1);
        SchemeGrouping phase = grouping(celeb, GroupingType.PHASE, "Fase", null, null, 1);
        grouping(celeb, GroupingType.COLLECTION, "Colecao da estrela", 2020, null, 0);
        SchemeGrouping col1 = grouping(marca, GroupingType.COLLECTION, "Inverno 26", 2026, null, 0);
        SchemeGrouping col2 = grouping(marca, GroupingType.COLLECTION, "Verao", 2025, 2025, 0);
        tour.setCoverUrl("/covers/turne.jpg");
        phase.setEditorialJson("{\"x\":1}");

        WardrobeItem c1 = piece(celeb, "luva", "accessory", "black", "FEMININO", null);
        c1.setGroupingId(era1.getId());
        WardrobeItem c2 = piece(celeb, "bota", "footwear", "black", "FEMININO", null);
        c2.setGroupingId(tour.getId());
        WardrobeItem c3 = piece(celeb, "velha", "upper_piece", "white", null, null);
        c3.setGroupingId(era1.getId());
        c3.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        WardrobeItem m1 = piece(marca, "casaco", "upper_piece", "camel", null, Model3dStatus.COMPLETED);
        m1.setGroupingId(col1.getId());

        Scheme s1 = look(me, "Look trabalho", 1, p1, p2, p3, p4, p5, p6);
        Scheme s2 = look(me, "Arquivado", 2, p1);
        s2.setStatus(SchemeStatus.ARCHIVED);
        Scheme s3 = look(ana, "Festa ana", 3, p7);
        Scheme s4 = look(rui, "Lisboa", 4, p8);
        Scheme s5 = look(bia, "Teste", 5);
        Scheme s6 = look(duda, "Fora", 6);
        Scheme s7 = look(edu, "Suspenso", 7);
        Scheme s8 = look(zeca, "Toquio", 8, p1);
        Scheme s9 = look(marca, "Vitrine", 9, m1);
        Scheme e1 = look(celeb, "Show 2011", 10, c1);
        Scheme e2 = look(celeb, "Clipe 2012", 11);
        Scheme e3 = look(celeb, "Turne 2016", 12, c2);
        Scheme e4 = look(celeb, "Sem era", 13);
        Scheme e5 = look(celeb, "Rascunho", 14);
        Scheme e6 = look(celeb, "Privado", 15);
        Scheme k1 = look(marca, "Casaco look", 16, m1);
        Scheme k2 = look(marca, "Praia", 17);
        Scheme a2 = look(ana, "Arquivada ana", 18);
        a2.setStatus(SchemeStatus.ARCHIVED);
        e1.setGroupingId(era1.getId());
        e2.setGroupingId(era1.getId());
        e3.setGroupingId(tour.getId());
        e5.setGroupingId(era1.getId());
        e5.setStatus(SchemeStatus.DRAFT);
        e6.setGroupingId(era1.getId());
        e6.setVisibility(Visibility.PRIVATE);
        k1.setGroupingId(col1.getId());
        k2.setGroupingId(col2.getId());
        s3.setMannequinImageUrl("/m/s3.jpg");

        DailyLook dMe = today(s1, 1, DailyLookSource.MANUAL);
        DailyLook dAna = today(s3, 2, DailyLookSource.COPILOT);
        dAna.setMaterializedFrom(dMe);
        today(s4, 3, DailyLookSource.MANUAL);
        today(s5, 4, DailyLookSource.MANUAL);
        today(s6, 5, DailyLookSource.MANUAL);
        today(s7, 6, DailyLookSource.MANUAL);
        today(s8, 7, DailyLookSource.SMART_MIRROR);
        today(s9, 8, DailyLookSource.MANUAL);
        today(a2, 9, DailyLookSource.MANUAL);
        today(e6, 10, DailyLookSource.MANUAL);
        today(e2, 1, DailyLookSource.MANUAL);

        score(HypeEntityType.SCHEME, s1.getId(), 70, true, 55.0, 2.0, null);
        score(HypeEntityType.SCHEME, s3.getId(), 85, true, 60.0, 9.5, HypeMomentum.RISING);
        score(HypeEntityType.SCHEME, s4.getId(), 85, true, 80.0, -1.0, null);
        score(HypeEntityType.SCHEME, s8.getId(), 95, false, 99.0, 30.0, HypeMomentum.RISING);
        score(HypeEntityType.SCHEME, s9.getId(), 40, true, 20.0, 1.0, HypeMomentum.EMERGING);
        score(HypeEntityType.SCHEME, e1.getId(), 50, true, 40.0, 4.0, null);
        score(HypeEntityType.SCHEME, e2.getId(), 80, true, 70.0, 1.0, null);
        score(HypeEntityType.SCHEME, e3.getId(), 90, false, 90.0, 12.0, null);
        score(HypeEntityType.SCHEME, e4.getId(), 64, true, null, null, null);
        score(HypeEntityType.SCHEME, k1.getId(), 60, true, 30.0, 3.0, null);
        score(HypeEntityType.PIECE, c1.getId(), 70, true, 50.0, 5.0, null);
        score(HypeEntityType.PIECE, c2.getId(), 66, false, 50.0, 8.0, null);
        score(HypeEntityType.PIECE, m1.getId(), 30, true, 10.0, -2.0, null);

        ShowcaseServiceCharacterizationStubs.apply(this);
        service = new ShowcaseService(follows, users, media, schemes, schemeItems, pieces, groupings, dailyLooks, dailyLookService, preferences,
                celebrities, schemeService, institutional, model3d, guard, avatars3d, hype, HypeScoreConfig.defaults());
    }
}
