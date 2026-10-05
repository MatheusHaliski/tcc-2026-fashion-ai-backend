package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.AcervoGroup;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.SavedItem;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.AcervoGroupRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Lookbook › Publicações (RF53): só o que o perfil mostra ao mundo, em ordem cronológica. Lote 4 (HypeScore v2): Looks e
 * Salvos ordenam pelo Hype com privacidade (dono = Hype pessoal; terceiros = só público elegível; sem Hype por último,
 * nunca 0) e os agrupamentos sugeridos são por similaridade, com o Hype médio v2 à parte.
 */
@SuppressWarnings("unchecked")
class LookbookPublicationsTest {
    private final User owner = new User();
    private final SchemeRepository schemes = mock(SchemeRepository.class);
    private final WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
    private final Guard guard = mock(Guard.class);
    private final LookbookService lookbook = new LookbookService(schemes, null, pieces, null, null, null, null, null, null, null, null, null, null, guard, null);

    LookbookPublicationsTest() {
        owner.assignId(UUID.randomUUID());
        owner.setProfileVisibility(Visibility.PUBLIC);
    }

    Scheme look(SchemeStatus status, Visibility v, Instant publishedAt) {
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        s.setUser(owner);
        s.setStatus(status);
        s.setVisibility(v);
        s.setPublishedAt(publishedAt);
        return s;
    }

    WardrobeItem piece(Visibility v, ModerationStatus m) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(owner);
        w.setVisibility(v);
        w.setModerationStatus(m);
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        return w;
    }

    @Test
    void onlyPublishedLooksAndVisiblePiecesInChronologicalOrder() {
        Instant t0 = Instant.parse("2026-09-01T10:00:00Z");
        Scheme published = look(SchemeStatus.PUBLISHED, Visibility.PUBLIC, t0.plusSeconds(3600));
        Scheme draft = look(SchemeStatus.DRAFT, Visibility.PUBLIC, null);
        Scheme privateLook = look(SchemeStatus.PUBLISHED, Visibility.PRIVATE, t0);
        WardrobeItem visible = piece(Visibility.PUBLIC, ModerationStatus.APPROVED);
        visible.markCreatedAt(t0.plusSeconds(7200));
        WardrobeItem hidden = piece(Visibility.PRIVATE, ModerationStatus.APPROVED);
        hidden.markCreatedAt(t0);
        WardrobeItem inReview = piece(Visibility.PUBLIC, ModerationStatus.PENDING);
        inReview.markCreatedAt(t0);
        when(schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(owner.getId(), SchemeStatus.ARCHIVED)).thenReturn(List.of(draft, published, privateLook));
        when(pieces.findByUserIdOrderByCreatedAtDesc(owner.getId())).thenReturn(List.of(visible, hidden, inReview));
        when(guard.canView(any(), eq(owner.getId()), eq(Visibility.PUBLIC))).thenReturn(true);

        List<Object[]> rows = lookbook.publicationRows(null, owner);
        assertThat(rows).extracting(r -> r[1]).containsExactly(visible, published);
    }

    // ================================================================== HypeScore v2 (Lote 4)
    private final HypeScoreCurrentRepository hypeRepo = mock(HypeScoreCurrentRepository.class);
    private final List<HypeScoreCurrent> hypeRows = new ArrayList<>();

    {
        when(hypeRepo.findByEntityTypeAndEntityIdInAndAlgorithmVersion(any(), anyCollection(), anyString())).thenAnswer(inv -> {
            Collection<UUID> ids = inv.getArgument(1);
            HypeEntityType type = inv.getArgument(0);
            return hypeRows.stream().filter(c -> c.getEntityType() == type && ids.contains(c.getEntityId())).toList();
        });
    }

    HypeScoreCurrent hype(HypeEntityType type, UUID id, UUID ownerId, Double score, boolean publicEligible, Double delta) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(type);
        c.setEntityId(id);
        c.setOwnerId(ownerId);
        c.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        c.setStatus(score == null ? HypeStatus.INSUFFICIENT_DATA : HypeStatus.AVAILABLE);
        c.setScore(score == null ? null : BigDecimal.valueOf(score));
        c.setLevel(score == null ? null : HypeScoreConfig.defaults().level(score));
        c.setPublicEligible(publicEligible);
        c.setDeltaPoints(delta == null ? null : BigDecimal.valueOf(delta));
        c.setDimensions(new HypeDimensions());
        c.setCalculatedAt(Instant.now());
        hypeRows.add(c);
        return c;
    }

    static CurrentUser session(User u) {
        return new CurrentUser(u.getId(), u.getUsername(), "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    }

    static SchemeService viewsById() {
        SchemeService schemeService = mock(SchemeService.class);
        when(schemeService.canView(any(), any())).thenReturn(true);
        when(schemeService.view(any(), any(), any())).thenAnswer(inv -> {
            Scheme s = inv.getArgument(1);
            Views.SchemeView v = mock(Views.SchemeView.class);
            when(v.id()).thenReturn(s.getId());
            return v;
        });
        return schemeService;
    }

    static List<UUID> idsOf(Views.Page<Map<String, Object>> page) {
        return page.items().stream().map(m -> ((Views.SchemeView) m.get("scheme")).id()).toList();
    }

    @Test
    void savedLooksSortByHypeUsesPersonalHypeForOwnLooksAndOnlyPublicHypeForOthers() {
        User bia = new User();
        bia.assignId(UUID.randomUUID());
        bia.setUsername("bia");
        bia.setProfileType(ProfileType.PESSOAL);
        owner.setUsername("ana");
        Instant t0 = Instant.parse("2026-09-01T10:00:00Z");
        Scheme ownPrivate = look(SchemeStatus.PUBLISHED, Visibility.PRIVATE, null);   // Hype pessoal 50 (só o dono vê)
        ownPrivate.markCreatedAt(t0.plusSeconds(10));
        Scheme ownNoHype = look(SchemeStatus.DRAFT, Visibility.PRIVATE, null);       // sem linha: sem Hype
        ownNoHype.markCreatedAt(t0.plusSeconds(20));
        Scheme biaFollowers = look(SchemeStatus.PUBLISHED, Visibility.FOLLOWERS, null);  // 95, mas não elegível ao público
        biaFollowers.setUser(bia);
        Scheme biaPublic = look(SchemeStatus.PUBLISHED, Visibility.PUBLIC, null);         // 80 público
        biaPublic.setUser(bia);
        hype(HypeEntityType.SCHEME, ownPrivate.getId(), owner.getId(), 50.0, false, 1.0);
        hype(HypeEntityType.SCHEME, biaFollowers.getId(), bia.getId(), 95.0, false, 30.0);
        hype(HypeEntityType.SCHEME, biaPublic.getId(), bia.getId(), 80.0, true, 4.0);

        SavedItemRepository saved = mock(SavedItemRepository.class);
        SavedItem s1 = new SavedItem(owner, TargetType.SCHEME, biaFollowers.getId());
        s1.setSavedAt(t0.plusSeconds(40));
        SavedItem s2 = new SavedItem(owner, TargetType.SCHEME, biaPublic.getId());
        s2.setSavedAt(t0.plusSeconds(30));
        when(schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(owner.getId(), SchemeStatus.ARCHIVED)).thenReturn(List.of(ownNoHype, ownPrivate));
        when(saved.findByUserIdAndTargetTypeOrderBySavedAtDesc(owner.getId(), TargetType.SCHEME)).thenReturn(List.of(s1, s2));
        when(schemes.findById(biaFollowers.getId())).thenReturn(java.util.Optional.of(biaFollowers));
        when(schemes.findById(biaPublic.getId())).thenReturn(java.util.Optional.of(biaPublic));
        LookbookService service = new LookbookService(schemes, mock(SchemeItemRepository.class), pieces, saved, null, null, null, null, viewsById(),
                null, null, null, null, guard, null);
        service.setHypeV2(hypeRepo, HypeScoreConfig.defaults());
        CurrentUser me = session(owner);

        // padrão: a ordem recente de sempre
        assertThat(idsOf(service.savedLooks(me, null, 0, 20))).containsExactly(biaFollowers.getId(), biaPublic.getId(), ownNoHype.getId(), ownPrivate.getId());
        // maior Hype: público de terceiro (80) e o Hype pessoal do dono (50); o 95 "só para seguidores" não ordena; sem Hype por último
        assertThat(idsOf(service.savedLooks(me, null, "hype_desc", 0, 20))).containsExactly(biaPublic.getId(), ownPrivate.getId(), biaFollowers.getId(), ownNoHype.getId());
        // menor Hype: sem Hype continua por último (nunca vira 0)
        assertThat(idsOf(service.savedLooks(me, null, "hype_asc", 0, 20))).containsExactly(ownPrivate.getId(), biaPublic.getId(), biaFollowers.getId(), ownNoHype.getId());
        // em crescimento: Δ pontos (o +30 não elegível também fica de fora)
        assertThat(idsOf(service.savedLooks(me, null, "growth", 0, 20))).startsWith(biaPublic.getId(), ownPrivate.getId());
    }

    @Test
    void similarityGroupsCarryTheAverageV2HypeApartAndNeverZero() {
        AcervoGroupRepository acervo = mock(AcervoGroupRepository.class);
        UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID(), d = UUID.randomUUID();
        hype(HypeEntityType.SCHEME, a, owner.getId(), 60.0, false, null);
        hype(HypeEntityType.SCHEME, b, owner.getId(), 80.0, true, null);
        hype(HypeEntityType.SCHEME, c, owner.getId(), null, true, null);   // dados insuficientes: fora da média
        AcervoGroup withHype = new AcervoGroup();
        withHype.assignId(UUID.randomUUID());
        withHype.setLabel("casual · trabalho");
        withHype.setMemberIdsJson(Json.write(List.of(a.toString(), b.toString(), c.toString())));
        withHype.setMemberCount(3);
        AcervoGroup noHype = new AcervoGroup();
        noHype.assignId(UUID.randomUUID());
        noHype.setLabel("festa");
        noHype.setMemberIdsJson(Json.write(List.of(d.toString())));
        noHype.setMemberCount(1);
        when(acervo.findByUserIdAndEntityTypeOrderByMemberCountDesc(owner.getId(), HypeEntityType.SCHEME)).thenReturn(List.of(withHype, noHype));
        LookbookService service = new LookbookService(schemes, null, pieces, null, null, acervo, null, null, null, null, null, null, null, guard, null);
        service.setHypeV2(hypeRepo, HypeScoreConfig.defaults());

        List<Map<String, Object>> groups = service.groups(session(owner), HypeEntityType.SCHEME);
        assertThat(groups).allSatisfy(g -> assertThat(g).containsEntry("kind", "SIMILARITY").containsKeys("id", "label", "memberIds", "count", "computedAt"));
        assertThat((Map<String, Object>) groups.get(0).get("hype")).containsEntry("avgScore", 70.0).containsEntry("level", HypeLevel.HOT.name())
                .containsEntry("items", 2).containsEntry("members", 3);
        assertThat((Map<String, Object>) groups.get(1).get("hype")).containsEntry("avgScore", null).containsEntry("level", null).containsEntry("items", 0);
    }

    @Test
    void profileLooksSortByHypeWithPrivacyForVisitors() {
        User visitorUser = new User();
        visitorUser.assignId(UUID.randomUUID());
        visitorUser.setUsername("bia");
        Instant t0 = Instant.parse("2026-09-01T10:00:00Z");
        Scheme newest = look(SchemeStatus.PUBLISHED, Visibility.PUBLIC, t0.plusSeconds(30));
        Scheme followersOnly = look(SchemeStatus.PUBLISHED, Visibility.FOLLOWERS, t0.plusSeconds(20));
        Scheme popular = look(SchemeStatus.PUBLISHED, Visibility.PUBLIC, t0.plusSeconds(10));
        hype(HypeEntityType.SCHEME, followersOnly.getId(), owner.getId(), 99.0, false, null);
        hype(HypeEntityType.SCHEME, popular.getId(), owner.getId(), 75.0, true, null);
        when(guard.canView(any(), eq(owner.getId()), any())).thenReturn(true);
        ProfileService profiles = new ProfileService(null, null, schemes, null, pieces, null, null, guard, hypeRepo, HypeScoreConfig.defaults());
        List<Scheme> published = List.of(newest, followersOnly, popular);

        // visitante: só o Hype público ordena (o 99 de "só para seguidores" é pessoal do dono); sem Hype segue a ordem recente
        assertThat(profiles.publishedLooks(session(visitorUser), owner, false, published, "hype_desc")).containsExactly(popular, newest, followersOnly);
        // o dono ordena pelo próprio Hype pessoal
        assertThat(profiles.publishedLooks(session(owner), owner, true, published, "hype_desc")).containsExactly(followersOnly, popular, newest);
        // sem ordenação: igual a antes
        assertThat(profiles.publishedLooks(session(visitorUser), owner, false, published, "recent")).containsExactly(newest, followersOnly, popular);
        assertThat(LookbookService.lookSort(null)).isEqualTo("recent");
        assertThat(LookbookService.lookSort("maior_hype")).isEqualTo("hype_desc");
        assertThat(LookbookService.lookSort("GROWTH")).isEqualTo("growth");
        assertThat(LookbookService.lookSort("qualquer")).isEqualTo("recent");
    }
}
