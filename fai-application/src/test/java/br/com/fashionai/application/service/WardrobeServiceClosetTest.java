package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** RF6 Closet Digital (filtros, ordenações, Hype e selos), RF7 detalhe e visibilidade da peça. */
class WardrobeServiceClosetTest {
    Kit kit;
    World world;
    WardrobeService service;
    CurrentUser ana;
    Guard guard;
    HypeScoreConfig hypeConfig;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        guard = kit.dep(Guard.class);
        hypeConfig = kit.dep(HypeScoreConfig.class);
        when(hypeConfig.algorithmVersion()).thenReturn("v2");
        when(hypeConfig.levelThresholds()).thenReturn(new int[]{20, 40, 60, 75, 90});
        service = kit.build(WardrobeService.class);
        ana = Kit.as(world.me);
        world.piecesOf(world.me).forEach(w -> w.setModerationStatus(ModerationStatus.APPROVED));
    }

    static WardrobeService.ClosetFilter filter(String category, String color, String season, String occasion, String style,
                                               String state, String q, String sort, int page, int size, String hype, String seal) {
        return new WardrobeService.ClosetFilter(category, color, season, occasion, style, state, q, sort, page, size, hype, seal);
    }

    static WardrobeService.ClosetFilter sort(String sort) {
        return filter(null, null, null, null, null, null, null, sort, 0, 0, null, null);
    }

    HypeScoreCurrent hype(WardrobeItem w, double score, boolean pub) {
        HypeScoreCurrent h = new HypeScoreCurrent();
        h.setId(UUID.randomUUID());
        h.setEntityType(HypeEntityType.PIECE);
        h.setEntityId(w.getId());
        h.setAlgorithmVersion("v2");
        h.setScore(BigDecimal.valueOf(score));
        h.setDeltaPoints(BigDecimal.valueOf(score / 10));
        h.getDimensions().setTrend(BigDecimal.valueOf(score / 2));
        h.getDimensions().setRarity(BigDecimal.valueOf(100 - score));
        h.setPublicEligible(pub);
        h.setStatus(HypeStatus.AVAILABLE);
        h.setLevel(score >= 90 ? HypeLevel.VIRAL : HypeLevel.NICHE);
        return kit.dep(HypeScoreCurrentRepository.class).save(h);
    }

    @Test
    void filtrosDoClosetCombinam() {
        var all = service.closet(ana, null, sort(null));
        assertThat(all.items()).hasSize(12);
        assertThat(service.closet(ana, null, filter("lower_piece", null, null, null, null, null, null, null, 0, 0, null, null)).items())
                .allMatch(p -> "lower_piece".equals(p.category())).hasSize(3);
        // família da cor: "Branco" pega white
        assertThat(service.closet(ana, null, filter(null, "branco", null, null, null, null, null, null, 0, 0, null, null)).items()).hasSize(2);
        assertThat(service.closet(ana, null, filter(null, "red", null, null, null, null, null, null, 0, 0, null, null)).items()).hasSize(2);
        WardrobeItem jeans = world.piece(world.me, "jeans");
        jeans.setMarket("summer_female");
        assertThat(service.closet(ana, null, filter(null, null, "SUMMER", null, null, null, null, null, 0, 0, null, null)).items())
                .extracting(Views.PieceView::id).containsExactly(jeans.getId());
        assertThat(service.closet(ana, null, filter(null, null, null, "casual", null, null, null, null, 0, 0, null, null)).items()).hasSize(12);
        assertThat(service.closet(ana, null, filter(null, null, null, "formal", null, null, null, null, 0, 0, null, null)).items()).isEmpty();
        assertThat(service.closet(ana, null, filter(null, null, null, null, "classic", null, null, null, 0, 0, null, null)).items()).hasSize(5);
        jeans.setFavorite(true);
        assertThat(service.closet(ana, null, filter(null, null, null, null, null, "favoritos", null, null, 0, 0, null, null)).items()).hasSize(1);
        assertThat(service.closet(ana, null, filter(null, null, null, null, null, null, "HOODIE", null, 0, 0, null, null)).items()).hasSize(1);
        assertThat(service.closet(ana, null, filter(null, null, null, null, null, null, "marca0", null, 0, 0, null, null)).items()).hasSize(1);
        assertThat(service.closet(ana, null, filter(null, null, null, null, null, null, "cargo_pants", null, 0, 0, null, null)).items()).hasSize(1);
        // arquivada some
        jeans.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        assertThat(service.closet(ana, null, sort(null)).total()).isEqualTo(11);
    }

    @Test
    void paginaDoClosetLimitaETemProxima() {
        var p0 = service.closet(ana, world.me.getId(), filter(null, null, null, null, null, null, null, null, 0, 5, null, null));
        assertThat(p0.items()).hasSize(5);
        assertThat(p0.hasMore()).isTrue();
        var p2 = service.closet(ana, world.me.getId(), filter(null, null, null, null, null, null, null, null, 2, 5, null, null));
        assertThat(p2.items()).hasSize(2);
        assertThat(p2.hasMore()).isFalse();
        var alem = service.closet(ana, null, filter(null, null, null, null, null, null, null, null, -3, 500, null, null));
        assertThat(alem.size()).isEqualTo(60);
        assertThat(alem.page()).isZero();
    }

    @Test
    void ordenacoesDoCloset() {
        List<WardrobeItem> mine = world.piecesOf(world.me);
        for (int i = 0; i < mine.size(); i++) {
            mine.get(i).markCreatedAt(Instant.now().minusSeconds(1000L * i));
            mine.get(i).setPrice(i == 3 ? null : BigDecimal.valueOf(10 + i));
        }
        var nomes = service.closet(ana, null, sort("nome")).items().stream().map(Views.PieceView::name).toList();
        assertThat(nomes).isSortedAccordingTo(String.CASE_INSENSITIVE_ORDER);
        var preco = service.closet(ana, null, sort("preco")).items();
        assertThat(preco.get(0).name()).isEqualTo(mine.get(11).getName());
        assertThat(preco.get(11).name()).isEqualTo(mine.get(3).getName());
        var usadas = service.closet(ana, null, sort("mais_usadas")).items();
        assertThat(usadas.get(0).wearCount()).isEqualTo(3);
        var menos = service.closet(ana, null, sort("least_worn")).items();
        assertThat(menos.get(0).wearCount()).isZero();
        assertThat(service.closet(ana, null, sort("idle")).items()).hasSize(12);
        var recentes = service.closet(ana, null, sort("recentes")).items();
        assertThat(recentes.get(0).name()).isEqualTo(mine.get(0).getName());
    }

    @Test
    void ordenacoesEFaixaDeHype() {
        List<WardrobeItem> mine = world.piecesOf(world.me);
        hype(mine.get(0), 95, true);
        hype(mine.get(1), 59.6, false);
        hype(mine.get(2), 30, true);
        var desc = service.closet(ana, null, sort("hype")).items();
        assertThat(desc.get(0).id()).isEqualTo(mine.get(0).getId());
        assertThat(desc.get(2).id()).isEqualTo(mine.get(2).getId());
        var asc = service.closet(ana, null, sort("hype_asc")).items();
        assertThat(asc.get(0).id()).isEqualTo(mine.get(2).getId());
        assertThat(service.closet(ana, null, sort("growth")).items().get(0).id()).isEqualTo(mine.get(0).getId());
        assertThat(service.closet(ana, null, sort("rarity")).items().get(0).id()).isEqualTo(mine.get(2).getId());
        // "Em alta" (HOT = 60): 59,6 aparece como 60 e entra
        var hot = service.closet(ana, null, filter(null, null, null, null, null, null, null, null, 0, 0, "hot", null)).items();
        assertThat(hot).extracting(Views.PieceView::id).containsExactlyInAnyOrder(mine.get(0).getId(), mine.get(1).getId());
        // para terceiros só entra o score público
        when(guard.canView(any(), any(), any())).thenReturn(true);
        var visitante = service.closet(Kit.as(world.rival), world.me.getId(),
                filter(null, null, null, null, null, null, null, null, 0, 0, "HOT", null)).items();
        assertThat(visitante).extracting(Views.PieceView::id).containsExactly(mine.get(0).getId());
    }

    @Test
    void faixaMinimaDeCadaNivel() {
        assertThat(service.hypeMinimum("niche")).isEqualTo(20);
        assertThat(service.hypeMinimum("RELEVANT")).isEqualTo(40);
        assertThat(service.hypeMinimum("hot")).isEqualTo(60);
        assertThat(service.hypeMinimum("trending")).isEqualTo(75);
        assertThat(service.hypeMinimum("viral")).isEqualTo(90);
        assertThat(service.hypeMinimum("outro")).isZero();
    }

    @Test
    void filtroDeSelo() {
        List<WardrobeItem> mine = world.piecesOf(world.me);
        hype(mine.get(0), 95, true);
        var comHype = service.closet(ana, null, filter(null, null, null, null, null, null, null, null, 0, 0, null, "hype")).items();
        assertThat(comHype).extracting(Views.PieceView::id).containsExactly(mine.get(0).getId());
        // sem repositório de vínculos: ninguém tem selo de marca
        assertThat(service.closet(ana, null, filter(null, null, null, null, null, null, null, null, 0, 0, null, "marca")).items()).isEmpty();
        assertThat(service.closet(ana, null, filter(null, null, null, null, null, null, null, null, 0, 0, null, "any")).items()).hasSize(1);
        assertThat(service.closet(ana, null, filter(null, null, null, null, null, null, null, null, 0, 0, null, "xyz")).items()).hasSize(12);
    }

    @Test
    void closetDeOutraPessoaSoMostraVisivelEAprovado() {
        CurrentUser bia = Kit.as(world.rival);
        assertThat(service.closet(bia, world.me.getId(), sort(null)).items()).isEmpty();
        when(guard.canView(any(), any(), any())).thenReturn(true);
        world.piece(world.me, "jeans").setModerationStatus(ModerationStatus.PENDING);
        assertThat(service.closet(bia, world.me.getId(), sort(null)).items()).hasSize(11);
        assertThat(service.closet(null, world.me.getId(), sort(null)).items()).hasSize(11);
    }

    @Test
    void detalheDoDonoNaoContaVisitaNemPublicaSinal() {
        WardrobeItem w = world.piece(world.me, "jeans");
        Map<String, Object> d = service.detail(ana, w.getId(), null);
        assertThat(d).containsEntry("canEdit", true).containsKeys("piece", "wearstyles", "originSchemes");
        verify(kit.dep(ApplicationEventPublisher.class), never()).publishEvent(any(DomainEvents.HypeSignal.class));
    }

    @Test
    void detalheDeOutraPessoaPublicaSinalEListaLooksVisiveis() {
        WardrobeItem w = world.piece(world.me, "jeans");
        when(guard.canView(any(), any(), any())).thenReturn(true);
        Map<String, Object> d = service.detail(Kit.as(world.rival), w.getId(), null);
        assertThat(d).containsEntry("canEdit", false);
        verify(kit.dep(ApplicationEventPublisher.class)).publishEvent(any(DomainEvents.HypeSignal.class));
        // visitante sem conta: nada de sinal
        Map<String, Object> anon = service.detail(null, w.getId(), null);
        assertThat(anon).containsEntry("canEdit", false);
    }

    @Test
    void pecaEmModeracaoNaoApareceParaTerceiros() {
        WardrobeItem w = world.piece(world.me, "jeans");
        w.setModerationStatus(ModerationStatus.PENDING);
        assertThatThrownBy(() -> service.detail(Kit.as(world.rival), w.getId(), null)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(404));
        // admin vê mesmo assim
        assertThat(service.detail(Kit.admin(world.rival), w.getId(), null)).containsKey("piece");
        assertThatThrownBy(() -> service.detail(ana, UUID.randomUUID(), null)).isInstanceOf(ApiException.class);
    }

    @Test
    void pecaArquivadaMostraORetratoDoLook() {
        WardrobeItem w = world.piece(world.me, "jeans");
        w.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        when(guard.canView(any(), any(), any())).thenReturn(true);
        Scheme look = world.looksOf(world.me).get(0);
        SchemeItem si = world.itemsOf(look).stream().filter(i -> i.getWardrobeItem().getId().equals(w.getId())).findFirst().orElseThrow();
        si.setSnapshotJson("{\"name\":\"retrato\"}");
        CurrentUser bia = Kit.as(world.rival);
        Map<String, Object> d = service.detail(bia, w.getId(), look.getId());
        assertThat(d).containsEntry("notAvailableAnymore", true).containsEntry("fromSchemeId", look.getId());
        assertThat(World.map(d.get("snapshot"))).containsEntry("name", "retrato");
        // sem look de origem: retrato montado da própria peça
        Map<String, Object> sem = service.detail(bia, w.getId(), null);
        assertThat(sem.get("snapshot")).isNotNull();
        // look arquivado não vale
        look.setStatus(SchemeStatus.ARCHIVED);
        assertThat(service.schemeVisible(bia, look)).isFalse();
    }

    @Test
    void estadoDeQuemVeEContagemDeReacoes() {
        WardrobeItem w = world.piece(world.me, "jeans");
        assertThat(service.viewerState(null, w)).isEqualTo(Views.ViewerState.NONE);
        var st = service.viewerState(ana, w);
        assertThat(st.canEdit()).isTrue();
        assertThat(st.liked()).isFalse();
        assertThat(service.reactionCounts(TargetType.PIECE, w.getId())).containsKey("LIKE");
        world.me.setProfileVisibility(Visibility.PUBLIC);assertThat(WardrobeService.effectiveVisibility(w)).isEqualTo(Visibility.PUBLIC);
    }

    @Test
    void elegiveisSoDisponiveisEAceitas() {
        List<WardrobeItem> mine = world.piecesOf(world.me);
        mine.forEach(w -> {
            w.setDisponivel(true);
            w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        });
        mine.get(0).setModerationStatus(ModerationStatus.REJECTED_POLICY);
        mine.get(1).setModerationStatus(ModerationStatus.REJECTED_NOT_CLOTHING);
        mine.get(2).setAvailabilityStatus(AvailabilityStatus.UNAVAILABLE);
        mine.get(3).setDisponivel(false);
        assertThat(service.eligible(world.me.getId())).hasSize(8);
    }

    @Test
    void copiarPecaDeOutraPessoa() {
        WardrobeItem src = world.piece(world.rival, "hoodie");
        src.setModerationStatus(ModerationStatus.APPROVED);
        Views.PieceView copy = service.addToWardrobe(ana, src.getId());
        assertThat(copy.name()).isEqualTo(src.getName());
        assertThat(copy.id()).isNotEqualTo(src.getId());
        verify(kit.dep(ProjectionService.class)).piece(any());

        WardrobeItem minha = world.piece(world.me, "hoodie");
        assertThatThrownBy(() -> service.addToWardrobe(ana, minha.getId())).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("JA_E_SUA"));
        src.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        assertThatThrownBy(() -> service.addToWardrobe(ana, src.getId())).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(404));
        doThrow(ApiException.notFound("x")).when(guard).requireCanCreate(any());
        assertThatThrownBy(() -> service.addToWardrobe(ana, src.getId())).isInstanceOf(ApiException.class);
    }

    @Test
    void lookDeOutraPessoaPassaPelaVisibilidade() {
        Scheme look = world.looksOf(world.rival).get(0);
        when(guard.canView(any(), any(), any())).thenReturn(false);
        assertThat(service.schemeVisible(ana, look)).isFalse();
        when(guard.canView(any(), any(), any())).thenReturn(true);
        assertThat(service.schemeVisible(ana, look)).isTrue();
    }
}
