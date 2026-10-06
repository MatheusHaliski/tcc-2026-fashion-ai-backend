package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.SavedItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.GroupingType;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeScorePanelVersion;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Lookbook (RF6): o perfil com Closet, Looks, salvos e favoritos; o Look do Dia com o painel escolhido; a cápsula
 * (peças-base e fator de versatilidade); agrupamentos sugeridos por similaridade e os agrupamentos editoriais (coleções,
 * eras, temporadas) conforme o tipo de perfil.
 */
class LookbookServiceTest {
    private Kit kit;
    private World world;
    private LookbookService lookbook;
    private CurrentUser ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        when(kit.dep(Guard.class).canView(any(), any(), any())).thenReturn(true);
        when(kit.dep(Guard.class).deny(any(), any(), any())).thenAnswer(i -> new ApiException(403, "NEGADO", "negado"));
        kit.real(WardrobeService.class);
        kit.real(BackgroundStudioService.class);
        kit.real(SchemeCardRenderer.class);
        kit.real(SchemeService.class);
        lookbook = kit.build(LookbookService.class);
        ana = Kit.as(world.me);
        // Ana salvou dois looks e uma peça da Bia
        for (UUID id : world.lookIds(world.rival).subList(0, 2)) {
            SavedItem s = new SavedItem();
            s.setUser(world.me);
            s.setTargetType(TargetType.SCHEME);
            s.setTargetId(id);
            kit.dep(SavedItemRepository.class).save(s);
        }
        SavedItem p = new SavedItem();
        p.setUser(world.me);
        p.setTargetType(TargetType.PIECE);
        p.setTargetId(world.piecesOf(world.rival).get(0).getId());
        kit.dep(SavedItemRepository.class).save(p);
        world.piecesOf(world.me).get(0).setFavorite(true);
        world.looksOf(world.me).get(0).setFavorite(true);
    }

    @Test
    void visaoGeralDoPerfilEAbas() {
        Map<String, Object> self = lookbook.overview(ana, world.me.getId());
        assertThat(self).containsEntry("self", true).containsEntry("visible", true).containsKey("tabs");
        Map<String, Object> visit = lookbook.overview(Kit.as(world.rival), world.me.getId());
        assertThat(visit).containsEntry("self", false);
        assertThatThrownBy(() -> lookbook.overview(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);
        assertThat(lookbook.publications(Kit.as(world.rival), world.me.getId(), 0, 10).items()).isNotEmpty();
        assertThat(lookbook.favorites(ana, world.me.getId())).isNotEmpty();
        assertThat(lookbook.favorites(Kit.as(world.rival), world.me.getId())).isNotEmpty();
    }

    @Test
    void salvosOrdenadosEFiltrados() {
        assertThat(lookbook.savedLooks(ana, null, 0, 10).items()).hasSize(8);   // os 6 looks dela + os 2 salvos da Bia
        assertThat(lookbook.savedLooks(ana, "casual", "hype", 0, 3).items()).hasSize(3);
        assertThat(lookbook.savedLooks(ana, "formal", 0, 10).items()).isEmpty();
        assertThat(lookbook.savedPieces(ana, null, 0, 10).items()).hasSize(1);
        assertThat(lookbook.savedPieces(ana, "lower_piece", 0, 10).items()).isEmpty();
        UUID saved = world.lookIds(world.rival).get(0);
        lookbook.favorite(ana, saved, true);
        assertThat(lookbook.favorite(ana, world.lookIds(world.me).get(1), true)).containsEntry("favorite", true);
        lookbook.removeSaved(ana, saved);
        assertThatThrownBy(() -> lookbook.removeSaved(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);
        assertThat(LookbookService.lookSort("menor_hype")).isNotBlank();
        assertThat(LookbookService.lookSort(null)).isEqualTo("recent");
    }

    @Test
    void lookDoDiaComPainelEscolhido() {
        Map<String, Object> empty = lookbook.dailyLookTab(ana, false);
        assertThat(empty).containsKey("empty").containsEntry("panelVersion", "SPOTLIGHT_CLASSICO");
        DailyLook dl = new DailyLook();
        dl.setUser(world.me);
        dl.setScheme(world.looksOf(world.me).get(0));
        dl.setLookDate(LocalDate.now());
        when(kit.dep(DailyLookService.class).today(world.me.getId())).thenReturn(Optional.of(dl));
        assertThat(lookbook.dailyLookTab(ana, true)).containsKeys("scheme", "panel");
        assertThat(lookbook.setPanelVersion(ana, HypeScorePanelVersion.PASSARELA)).containsEntry("panelVersion", "PASSARELA");
        assertThat(lookbook.setPanelVersion(ana, null)).containsEntry("panelVersion", "SPOTLIGHT_CLASSICO");
        assertThat(LookbookService.panelVersions()).hasSize(6);
        lookbook.markDailyLook(ana, world.lookIds(world.me).get(1));
    }

    @Test
    void capsulaComFatorDeVersatilidade() {
        Map<String, Object> c = lookbook.capsule(ana, null);
        assertThat((Integer) c.get("basePieces")).isGreaterThan(0);
        assertThat(c).containsKeys("factor", "cards", "filters");
        assertThat((List<?>) lookbook.capsule(ana, "shoes_piece").get("cards")).hasSize(2);
        User nova = kit.dep(UserRepository.class).save(Kit.user("nova"));
        assertThat(lookbook.capsule(Kit.as(nova), null)).containsKey("empty");
    }

    @Test
    void agrupamentosSugeridosPorSimilaridade() {
        assertThatThrownBy(() -> lookbook.suggestGroups(ana, HypeEntityType.PIECE)).isInstanceOf(ApiException.class);
        for (int i = 0; i < 12; i++) {
            kit.dep(WardrobeItemRepository.class).save(Kit.piece(world.me, "camiseta " + i, "upper_piece", "t_shirt", i % 2 == 0 ? "white" : "black"));
        }
        Map<String, Object> pieces = lookbook.suggestGroups(ana, HypeEntityType.PIECE);
        assertThat((List<?>) pieces.get("groups")).isNotEmpty();
        assertThat(lookbook.groups(ana, HypeEntityType.PIECE)).isNotEmpty();
        Map<String, Object> looks = lookbook.suggestGroups(ana, HypeEntityType.SCHEME);
        assertThat(looks).containsEntry("kind", "SIMILARITY");
        UUID first = (UUID) map(((List<?>) pieces.get("groups")).get(0)).get("id");
        lookbook.discardGroup(ana, first);
        assertThatThrownBy(() -> lookbook.discardGroup(ana, first)).isInstanceOf(ApiException.class);
    }

    @Test
    void agrupamentosEditoriaisPorTipoDePerfil() {
        assertThatThrownBy(() -> lookbook.createGrouping(ana, new LookbookService.GroupingForm(GroupingType.TOUR, "Turnê", null, null, null, null, null, null, null)))
                .isInstanceOf(ApiException.class);
        Map<String, Object> g = lookbook.createGrouping(ana, new LookbookService.GroupingForm(GroupingType.EVOLUTION, "Minha evolução", "De 2020 até hoje",
                null, "luz de fim de tarde", 2020, 2026, "#aa3344", 1));
        UUID id = (UUID) g.get("id");
        assertThat(g).containsEntry("label", "Minha evolução");
        assertThatThrownBy(() -> lookbook.createGrouping(ana, new LookbookService.GroupingForm(GroupingType.SEASON, "Período", null, null, null, 2026, 2020, null, null)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> lookbook.createGrouping(ana, new LookbookService.GroupingForm(GroupingType.SEASON, "Cor", null, null, null, null, null, "vermelho", null)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> lookbook.createGrouping(ana, new LookbookService.GroupingForm(GroupingType.SEASON, "Ano", null, null, null, 1500, null, null, null)))
                .isInstanceOf(ApiException.class);
        assertThat(lookbook.updateGrouping(ana, id, new LookbookService.GroupingForm(null, "Evolução", "nova", null, "chuva", null, 2027, "", 2)))
                .containsEntry("label", "Evolução");
        Map<String, Object> assigned = lookbook.assignToGrouping(ana, id, world.lookIds(world.me).subList(0, 2), List.of(world.piecesOf(world.me).get(0).getId()));
        assertThat(assigned).containsEntry("assigned", 3);
        assertThat(lookbook.groupingsOf(Kit.as(world.rival), world.me.getId())).hasSize(1);
        assertThat(lookbook.groupingSchemes(Kit.as(world.rival), id)).hasSize(2);
        lookbook.deleteGrouping(ana, id);
        assertThat(lookbook.groupingsOf(ana, world.me.getId())).isEmpty();
        assertThat(lookbook.assignToGrouping(ana, null, null, null)).containsEntry("assigned", 0);

        User marca = Kit.user("marca");
        marca.setProfileType(ProfileType.MARCA);
        kit.dep(UserRepository.class).save(marca);
        assertThat(lookbook.createGrouping(Kit.as(marca), new LookbookService.GroupingForm(GroupingType.SIGNATURE_SERIES, "Série", null, null, null,
                2025, null, null, null))).containsKey("id");
        User celeb = Kit.user("celeb");
        celeb.setProfileType(ProfileType.CELEBRIDADE);
        kit.dep(UserRepository.class).save(celeb);
        assertThat(lookbook.createGrouping(Kit.as(celeb), new LookbookService.GroupingForm(GroupingType.ERA, "Era pop", null, null, null,
                2010, 2014, null, null))).containsKey("id");
    }
}
