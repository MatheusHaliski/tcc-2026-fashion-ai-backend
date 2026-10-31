package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.Mood;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Caracterização do remix de look (RF19.CA13) — escrita antes da extração de {@code SchemeRemixPrototype}:
 * forma exata do prefill (ordem das chaves, sem id/selos/visibilidade/status), cópia do layout por peça,
 * casamento por similaridade com limiar 1.0, peça já usada não se repete e peças faltantes com a ação sugerida.
 */
class SchemeRemixCharacterizationTest {
    private Kit kit;
    private World world;
    private SchemeService schemes;
    private CurrentUser ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        when(kit.dep(MediaService.class).put(anyString(), any(), anyString()))
                .thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/jpeg"));
        when(kit.dep(Guard.class).canView(any(), any(), any())).thenReturn(true);
        kit.real(WardrobeService.class);
        kit.real(BackgroundStudioService.class);
        kit.real(SchemeCardRenderer.class);
        schemes = kit.build(SchemeService.class);
        ana = Kit.as(world.me);
    }

    private User bare(String username) {
        return kit.dep(UserRepository.class).save(Kit.user(username));
    }

    private WardrobeItem piece(User u, String category, String subcategory, String color) {
        return kit.dep(WardrobeItemRepository.class).save(Kit.piece(u, subcategory + " " + color + " " + u.getUsername(), category, subcategory, color));
    }

    private static List<SchemeService.ItemForm> forms(Object items) {
        List<SchemeService.ItemForm> out = new ArrayList<>();
        for (Object o : (List<?>) items) {
            out.add((SchemeService.ItemForm) o);
        }
        return out;
    }

    @Test
    void prefillTemOrdemDeChavesFixaENaoCopiaIdentidadeSelosNemVisibilidade() {
        Scheme src = world.looksOf(world.rival).get(0);
        src.setDescription("Descrição original");
        src.setSeason(Season.WINTER);
        src.setMood(Mood.ELEGANT);
        src.setCardSkin("atelier");
        src.setStudioConfigJson("{\"color\":\"#101010\"}");
        src.setTags("praia,verao");

        Map<String, Object> r = schemes.remix(ana, src.getId());

        assertThat(r.keySet()).containsExactlyInAnyOrder("prefill", "missingPieces", "source", "next");
        assertThat(r.get("next")).isEqualTo("/create-look?remix=" + src.getId());
        Map<String, Object> source = map(r.get("source"));
        assertThat(source.keySet()).containsExactlyInAnyOrder("id", "title", "owner");
        assertThat(source).containsEntry("id", src.getId()).containsEntry("title", src.getTitle());

        Map<String, Object> prefill = map(r.get("prefill"));
        assertThat(prefill.keySet()).containsExactly("title", "description", "occasion", "style", "season", "mood", "items",
                "background", "cardSkin", "remixedFromId", "origin");
        assertThat(prefill).containsEntry("title", Msg.t("scheme.remix_de", src.getTitle()))
                .containsEntry("description", "Descrição original")
                .containsEntry("occasion", List.of("casual"))
                .containsEntry("style", List.of("streetwear"))
                .containsEntry("season", Season.WINTER)
                .containsEntry("mood", Mood.ELEGANT)
                .containsEntry("background", Map.of("color", "#101010"))
                .containsEntry("cardSkin", "atelier")
                .containsEntry("remixedFromId", src.getId())
                .containsEntry("origin", SchemeOrigin.REMIX);
        // nova identidade: nada de id, selos, visibilidade, status, tags ou autoria copiados para o rascunho
        assertThat(prefill).doesNotContainKeys("id", "seals", "visibility", "status", "tags", "user", "publishedAt");
    }

    @Test
    void outraPessoaCasaCadaPecaPorSubcategoriaNoProprioAcervoMantendoSlotEOrdem() {
        Scheme src = world.looksOf(world.rival).get(0);
        List<SchemeItem> srcItems = world.itemsOf(src);

        Map<String, Object> r = schemes.remix(ana, src.getId());

        List<SchemeService.ItemForm> items = forms(map(r.get("prefill")).get("items"));
        assertThat((List<?>) r.get("missingPieces")).isEmpty();
        assertThat(items).hasSize(srcItems.size());
        for (int i = 0; i < items.size(); i++) {
            WardrobeItem mapped = kit.dep(WardrobeItemRepository.class).findById(items.get(i).wardrobeItemId()).orElseThrow();
            assertThat(mapped.getUser().getId()).isEqualTo(world.me.getId());
            assertThat(mapped.getSubcategory()).isEqualTo(srcItems.get(i).getWardrobeItem().getSubcategory());
            assertThat(items.get(i).slot()).isEqualTo(srcItems.get(i).getSlot());
            assertThat(items.get(i).sortOrder()).isEqualTo(srcItems.get(i).getSortOrder());
        }
        assertThat(items.stream().map(SchemeService.ItemForm::wardrobeItemId).distinct()).hasSize(items.size());
    }

    @Test
    void donoRemixandoOProprioLookReusaAsMesmasPecasECopiaOLayout() {
        Scheme src = world.looksOf(world.me).get(0);
        List<SchemeItem> srcItems = world.itemsOf(src);
        SchemeItem first = srcItems.get(0);
        first.setZIndex(7);
        first.setPositionX(new BigDecimal("0.3"));
        first.setPositionY(new BigDecimal("0.6"));
        first.setScale(new BigDecimal("1.5"));
        first.setRotation(new BigDecimal("12"));
        first.setOpacity(new BigDecimal("0.8"));
        first.setFiltersJson("{\"brightness\":1.1}");

        Map<String, Object> r = schemes.remix(ana, src.getId());

        List<SchemeService.ItemForm> items = forms(map(r.get("prefill")).get("items"));
        assertThat(items.stream().map(SchemeService.ItemForm::wardrobeItemId).toList())
                .containsExactlyElementsOf(srcItems.stream().map(si -> si.getWardrobeItem().getId()).toList());
        SchemeService.ItemForm f = items.get(0);
        assertThat(f).isEqualTo(new SchemeService.ItemForm(first.getWardrobeItem().getId(), first.getSlot(), first.getSortOrder(), 7,
                new BigDecimal("0.3"), new BigDecimal("0.6"), new BigDecimal("1.5"), new BigDecimal("12"), new BigDecimal("0.8"),
                Map.of("brightness", 1.1)));
        assertThat((List<?>) r.get("missingPieces")).isEmpty();
    }

    @Test
    void limiarDeSimilaridadePecaUsadaUmaVezEFaltantesComAcao() {
        User hel = bare("hel");
        User gil = bare("gil");
        WardrobeItem polo = piece(hel, "upper_piece", "polo", "white");
        WardrobeItem shorts = piece(hel, "lower_piece", "shorts", "navy");
        WardrobeItem sneakers = piece(hel, "shoes_piece", "casual_sneakers", "white");
        WardrobeItem sneakers2 = piece(hel, "shoes_piece", "casual_sneakers", "black");
        Scheme src = world.look(hel, "Look da Hel", polo, shorts, sneakers, sneakers2);
        // categoria igual + mesma cor = 0.5 + 0.5 = 1.0 → casa
        WardrobeItem tank = piece(gil, "upper_piece", "tank_top", "white");
        // categoria igual + mesma família de cor (Azul) = 0.5 + 0.25 = 0.75 → não casa
        piece(gil, "lower_piece", "skirt", "blue");
        // subcategoria igual = 1.0 → casa só uma vez; o segundo tênis da origem fica faltando
        WardrobeItem mySneakers = piece(gil, "shoes_piece", "casual_sneakers", "red");

        Map<String, Object> r = schemes.remix(Kit.as(gil), src.getId());

        List<SchemeService.ItemForm> items = forms(map(r.get("prefill")).get("items"));
        assertThat(items.stream().map(SchemeService.ItemForm::wardrobeItemId).toList()).containsExactly(tank.getId(), mySneakers.getId());
        assertThat(items.stream().map(SchemeService.ItemForm::slot).toList()).containsExactly(SchemeSlot.TOP, SchemeSlot.SHOES);
        List<?> missing = (List<?>) r.get("missingPieces");
        assertThat(missing).hasSize(2);
        for (Object o : missing) {
            Map<String, Object> m = map(o);
            assertThat(m.keySet()).containsExactlyInAnyOrder("sourcePiece", "action");
            assertThat(m.get("action")).isEqualTo(Msg.t("scheme.adicionar_ao_guarda_roupa_ou"));
        }
        assertThat(((Views.PieceRow) map(missing.get(0)).get("sourcePiece")).id()).isEqualTo(shorts.getId());
        assertThat(((Views.PieceRow) map(missing.get(1)).get("sourcePiece")).id()).isEqualTo(sneakers2.getId());
    }

    @Test
    void lookIndisponivelNaoPodeSerRemixado() {
        Scheme src = world.looksOf(world.rival).get(0);
        src.setDisponivel(false);
        assertThatThrownBy(() -> schemes.remix(ana, src.getId())).isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code()).isEqualTo("INDISPONIVEL");
    }
}
