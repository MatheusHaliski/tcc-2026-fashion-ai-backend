package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.ports.CounterStorePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Domínio Looks (RF53): origem do look (ia, manual, remix) e estados que a tela envia — antes publicados/rascunhos/arquivados
 * eram ignorados — e, no Lote 2 do HypeScore (P1-07/P2-15), ordenação e filtro de Meus looks pelo Hype v2 (Hype PESSOAL do
 * dono, inclusive de look privado; sem dados por último, nunca 0) e o rótulo v2 do PNG do card.
 */
class SchemeFiltersTest {
    static Scheme scheme(SchemeOrigin origin, CreationMode mode, SchemeStatus status) {
        Scheme s = new Scheme();
        s.setOrigin(origin);
        s.setCreationMode(mode);
        s.setStatus(status);
        return s;
    }

    @Test
    void kindSeparatesAiManualAndRemix() {
        assertThat(SchemeService.kindOf(scheme(SchemeOrigin.CRIAR_LOOK, CreationMode.MANUAL, SchemeStatus.DRAFT))).isEqualTo("manual");
        assertThat(SchemeService.kindOf(scheme(SchemeOrigin.PROVADOR, CreationMode.MANUAL, SchemeStatus.DRAFT))).isEqualTo("manual");
        assertThat(SchemeService.kindOf(scheme(SchemeOrigin.CRIAR_LOOK, CreationMode.AI_ASSISTED, SchemeStatus.DRAFT))).isEqualTo("ia");
        for (SchemeOrigin o : new SchemeOrigin[]{SchemeOrigin.COPILOT, SchemeOrigin.AUTOPILOTO, SchemeOrigin.VISTA_ME, SchemeOrigin.SMART_MIRROR}) {
            assertThat(SchemeService.kindOf(scheme(o, CreationMode.MANUAL, SchemeStatus.DRAFT))).as(o.name()).isEqualTo("ia");
        }
        assertThat(SchemeService.kindOf(scheme(SchemeOrigin.REMIX, CreationMode.MANUAL, SchemeStatus.DRAFT))).isEqualTo("remix");
        Scheme derived = scheme(SchemeOrigin.COPILOT, CreationMode.AI_ASSISTED, SchemeStatus.DRAFT);
        derived.setOriginalScheme(new Scheme());
        assertThat(SchemeService.kindOf(derived)).as("derivado de outro look é remix, mesmo vindo do Copilot").isEqualTo("remix");
    }

    @Test
    void statesSentByTheScreenActuallyFilter() {
        Scheme published = scheme(SchemeOrigin.CRIAR_LOOK, CreationMode.MANUAL, SchemeStatus.PUBLISHED);
        Scheme draft = scheme(SchemeOrigin.CRIAR_LOOK, CreationMode.MANUAL, SchemeStatus.DRAFT);
        Scheme archived = scheme(SchemeOrigin.CRIAR_LOOK, CreationMode.MANUAL, SchemeStatus.ARCHIVED);
        assertThat(SchemeService.stateMatches(published, "publicados")).isTrue();
        assertThat(SchemeService.stateMatches(draft, "publicados")).isFalse();
        assertThat(SchemeService.stateMatches(draft, "rascunhos")).isTrue();
        assertThat(SchemeService.stateMatches(published, "rascunhos")).isFalse();
        assertThat(SchemeService.stateMatches(archived, "arquivados")).isTrue();
        assertThat(SchemeService.stateMatches(draft, "arquivados")).isFalse();
        draft.setFavorite(true);
        assertThat(SchemeService.stateMatches(draft, "favoritos")).isTrue();
        assertThat(SchemeService.stateMatches(published, "")).isTrue();
        assertThat(SchemeService.stateMatches(published, "todos")).isTrue();
    }

    // ------------------------------------------------------------------ RF53 · Lote 2 — Hype v2 em Meus looks

    private final UUID uid = UUID.randomUUID();
    private final CurrentUser me = new CurrentUser(uid, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);

    private Scheme look(String title, Visibility visibility, int minutesAgo) {
        User u = new User();
        u.assignId(uid);
        u.setUsername("ana");
        u.setProfileType(ProfileType.PESSOAL);
        Scheme s = scheme(SchemeOrigin.CRIAR_LOOK, CreationMode.MANUAL, SchemeStatus.PUBLISHED);
        s.assignId(UUID.randomUUID());
        s.setUser(u);
        s.setTitle(title);
        s.setVisibility(visibility);
        s.markCreatedAt(Instant.now().minusSeconds(60L * minutesAgo));
        return s;
    }

    private static HypeScoreCurrent hype(Scheme s, Double score, Double delta, boolean publicEligible) {
        HypeScoreCurrent h = new HypeScoreCurrent();
        h.setEntityType(HypeEntityType.SCHEME);
        h.setEntityId(s.getId());
        h.setStatus(score == null ? HypeStatus.INSUFFICIENT_DATA : HypeStatus.AVAILABLE);
        h.setScore(score == null ? null : BigDecimal.valueOf(score));
        h.setLevel(score == null ? null : HypeScoreConfig.defaults().level(score));
        h.setDeltaPoints(delta == null ? null : BigDecimal.valueOf(delta));
        h.setDimensions(new HypeDimensions());
        h.setPublicEligible(publicEligible);
        h.setCalculatedAt(Instant.now());
        return h;
    }

    private static Map<UUID, HypeScoreCurrent> byId(HypeScoreCurrent... rows) {
        return java.util.Arrays.stream(rows).collect(Collectors.toMap(HypeScoreCurrent::getEntityId, h -> h));
    }

    private static List<String> titles(List<Scheme> list) {
        return list.stream().map(Scheme::getTitle).toList();
    }

    @Test
    void sortNamesAndLevelThresholdsFollowTheCloset() {
        assertThat(SchemeService.lookSort(null)).isEqualTo("recent");
        assertThat(SchemeService.lookSort("recentes")).isEqualTo("recent");
        assertThat(SchemeService.lookSort("hype")).isEqualTo("hype_desc");
        assertThat(SchemeService.lookSort("HYPE_DESC")).isEqualTo("hype_desc");
        assertThat(SchemeService.lookSort("hype_asc")).isEqualTo("hype_asc");
        assertThat(SchemeService.lookSort("growth")).isEqualTo("growth");
        assertThat(SchemeService.lookSort("worn")).as("usos são de peça, não de look").isEqualTo("recent");
        int[] t = HypeScoreConfig.defaults().levelThresholds();
        assertThat(SchemeService.hypeMinimum("HOT", t)).isEqualTo(t[2]);
        assertThat(SchemeService.hypeMinimum("viral", t)).isEqualTo(t[4]);
        assertThat(SchemeService.hypeMinimum("LOW_SIGNAL", t)).isZero();
        assertThat(SchemeService.hypeMinimum("", t)).as("sem faixa = sem filtro").isNull();
        assertThat(SchemeService.hypeMinimum("QUALQUER", t)).as("faixa desconhecida é ignorada").isNull();
    }

    @Test
    void hypeOrderKeepsLooksWithoutDataLastAndTiesInRecentOrder() {
        Scheme a = look("A", Visibility.PUBLIC, 1), b = look("B", Visibility.PUBLIC, 2), c = look("C", Visibility.PUBLIC, 3),
                d = look("D", Visibility.PUBLIC, 4), e = look("E", Visibility.PUBLIC, 5);
        // lista chega do repositório do mais recente para o mais antigo; D não tem linha (não calculado), E é insuficiente
        Map<UUID, HypeScoreCurrent> h = byId(hype(a, 40.0, 1.0, true), hype(b, 82.0, -3.0, true), hype(c, 40.0, 9.0, true), hype(e, null, null, true));
        List<Scheme> recent = List.of(a, b, c, d, e);
        assertThat(titles(SchemeService.byHype(recent, "hype_desc", null, h))).containsExactly("B", "A", "C", "D", "E");
        assertThat(titles(SchemeService.byHype(recent, "hype_asc", null, h))).as("menor Hype: sem dados continua no fim").containsExactly("A", "C", "B", "D", "E");
        assertThat(titles(SchemeService.byHype(recent, "growth", null, h))).containsExactly("C", "A", "B", "D", "E");
        assertThat(titles(SchemeService.byHype(recent, "recent", null, h))).containsExactly("A", "B", "C", "D", "E");
    }

    @Test
    void levelFilterUsesTheDisplayedRoundingAndDropsLooksWithoutHype() {
        Scheme hot = look("quase 60", Visibility.PUBLIC, 1), relevant = look("59,4", Visibility.PUBLIC, 2), none = look("sem dados", Visibility.PUBLIC, 3);
        Map<UUID, HypeScoreCurrent> h = byId(hype(hot, 59.6, null, true), hype(relevant, 59.4, null, true), hype(none, null, null, true));
        int[] t = HypeScoreConfig.defaults().levelThresholds();
        // 59,6 aparece como 60 e já é "Em alta"; 59,4 aparece como 59 (Relevante); sem dados nunca vira 0 nem entra
        assertThat(titles(SchemeService.byHype(List.of(hot, relevant, none), "recent", SchemeService.hypeMinimum("HOT", t), h))).containsExactly("quase 60");
        assertThat(titles(SchemeService.byHype(List.of(hot, relevant, none), "recent", SchemeService.hypeMinimum("RELEVANT", t), h))).containsExactly("quase 60", "59,4");
    }

    @Test
    void ownerSeesOwnPrivateLookHypeInMyLooks() {
        HypeScoreCurrentRepository repo = mock(HypeScoreCurrentRepository.class);
        SchemeRepository schemes = mock(SchemeRepository.class);
        SchemeService service = service(schemes, repo);
        Scheme publicLook = look("Público", Visibility.PUBLIC, 1);
        Scheme privateLook = look("Privado", Visibility.PRIVATE, 2);
        Scheme newLook = look("Novo", Visibility.FOLLOWERS, 0);
        when(schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(uid, SchemeStatus.ARCHIVED)).thenReturn(List.of(newLook, publicLook, privateLook));
        // o look privado tem Hype pessoal (publicEligible = false): para o dono ele conta na ordem e no filtro
        List<HypeScoreCurrent> rows = List.of(hype(publicLook, 64.0, null, true), hype(privateLook, 91.0, null, false));
        when(repo.findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.SCHEME), anyCollection(), eq(HypeScoreConfig.DEFAULT_VERSION)))
                .thenAnswer(inv -> rows.stream().filter(r -> ((Collection<?>) inv.getArgument(1)).contains(r.getEntityId())).toList());

        Views.Page<Views.SchemeView> sorted = service.mine(me, null, null, null, "hype_desc", null, 0, 20);
        assertThat(sorted.items().stream().map(Views.SchemeView::title).toList()).containsExactly("Privado", "Público", "Novo");

        Views.Page<Views.SchemeView> hot = service.mine(me, null, null, null, null, "HOT", 0, 20);
        assertThat(hot.items().stream().map(Views.SchemeView::title).toList()).as("faixa mínima Em alta, ordem recente mantida")
                .containsExactly("Público", "Privado");
        assertThat(hot.total()).isEqualTo(2);
    }

    @Test
    void recentOrderNeverReadsTheHypeTable() {
        HypeScoreCurrentRepository repo = mock(HypeScoreCurrentRepository.class);
        SchemeRepository schemes = mock(SchemeRepository.class);
        SchemeService service = service(schemes, repo);
        Scheme a = look("A", Visibility.PUBLIC, 1);
        when(schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(uid, SchemeStatus.ARCHIVED)).thenReturn(List.of(a));
        assertThat(service.mine(me, null, null, null, 0, 20).items()).hasSize(1);
        assertThat(service.mine(me, null, null, null, "recent", "", 0, 20).items()).hasSize(1);
        verify(repo, never()).findByEntityTypeAndEntityIdInAndAlgorithmVersion(any(), any(), any());
    }

    @Test
    void cardPngShowsV2ScoreWithLevelTextAndOmitsWithoutDataOrForThirdParties() {
        SchemeService service = service(mock(SchemeRepository.class), mock(HypeScoreCurrentRepository.class));
        Scheme s = look("Look", Visibility.PRIVATE, 1);
        HypeScoreCurrent personal = hype(s, 76.4, null, false);
        String owner = service.cardHypeLabel(personal, true);
        assertThat(owner).isEqualTo(Msg.t("schemeHype.card", BigDecimal.valueOf(76), Msg.t("schemeHype.level.TRENDING")));
        assertThat(owner).as("fora de requisição o idioma é pt-BR").isEqualTo("HypeScore 76 · Tendência");
        assertThat(owner).doesNotContain("%");
        assertThat(service.cardHypeLabel(personal, false)).as("Hype pessoal não sai no PNG pedido por terceiros").isNull();
        assertThat(service.cardHypeLabel(hype(s, 76.4, null, true), false)).isEqualTo(owner);
        assertThat(service.cardHypeLabel(hype(s, null, null, true), true)).as("dados insuficientes: omite, nunca 0").isNull();
        assertThat(service.cardHypeLabel(null, true)).as("ainda não calculado: omite").isNull();
        assertThat(SchemeService.cardHypeLabel(BigDecimal.valueOf(89.6), HypeLevel.VIRAL, true)).as("a faixa segue o número arredondado")
                .isEqualTo(Msg.t("schemeHype.card", BigDecimal.valueOf(90), Msg.t("schemeHype.level.VIRAL")));
    }

    @Test
    void cardFooterMovesTheHypeChipAboveThePriceWhenItDoesNotFit() {
        assertThat(SchemeCardRenderer.hypeFitsBeside(900, 50, 200, 180, 260)).isTrue();
        assertThat(SchemeCardRenderer.hypeFitsBeside(900, 50, 200, 260, 320)).isFalse();
        assertThat(SchemeCardRenderer.hypeFitsBeside(900, 50, 200, 0, 560)).as("sem preço sobra a linha toda").isTrue();
    }

    private SchemeService service(SchemeRepository schemes, HypeScoreCurrentRepository hypeScores) {
        SchemeItemRepository items = mock(SchemeItemRepository.class);
        when(items.findBySchemeIdOrderBySortOrder(any())).thenReturn(new ArrayList<>());
        return new SchemeService(schemes, items, mock(WardrobeItemRepository.class), mock(UserRepository.class), mock(ReactionRepository.class),
                mock(SavedItemRepository.class), mock(WardrobeService.class), mock(BackgroundStudioService.class), mock(SealService.class),
                mock(SchemeCardRenderer.class), mock(ProjectionService.class), mock(NotificationService.class), mock(CounterStorePort.class),
                mock(MediaService.class), mock(AiEngine.class), mock(Guard.class), mock(Audit.class), mock(DailyLookService.class),
                mock(ApplicationEventPublisher.class), mock(StyleDnaRepository.class), hypeScores, HypeScoreConfig.defaults());
    }
}
