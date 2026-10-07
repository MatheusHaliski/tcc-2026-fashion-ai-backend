package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.Mood;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
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
 * Looks (RF5/RF7/RF9/RF19): montar com IA (ou com o compositor local) só com peças do próprio acervo, salvar, publicar,
 * editar com diff da IA, remixar look de outra pessoa, arquivar e gerar o card PNG.
 */
class SchemeServiceTest {
    private Kit kit;
    private World world;
    private SchemeService schemes;
    private CurrentUser ana;
    private List<WardrobeItem> mine;

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
        mine = world.piecesOf(world.me);
    }

    private SchemeService.ItemForm item(WardrobeItem w) {
        return new SchemeService.ItemForm(w.getId(), null, null, null, new BigDecimal("0.1"), new BigDecimal("0.2"), null, null, null,
                Map.of("brightness", 1.1, "contrast", 1.0));
    }

    private SchemeService.SchemeForm form(String title, List<WardrobeItem> pieces, Boolean publish) {
        return new SchemeService.SchemeForm(title, "Um look para o fim de semana", List.of("casual"), List.of("streetwear"), Season.SUMMER,
                Mood.COMFORTABLE, Visibility.PUBLIC, null, pieces.stream().map(this::item).toList(), CreationMode.MANUAL, null, null,
                Map.of("color", "#F4F2EF"), false, "atelier", "LISTA_VERTICAL", List.of("#praia", "verão"), List.of(), publish, false);
    }

    private static byte[] jpeg(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "jpg", out);
        return out.toByteArray();
    }

    @Test
    void construtorMostraAsPecasDoAcervoPorCategoria() {
        Map<String, Object> b = schemes.builder(ana);
        assertThat(b).containsEntry("status", "PRONTO").containsEntry("eligiblePieces", 12);
        assertThat(map(b.get("lists"))).containsKeys("upper_piece", "lower_piece");
        assertThat(schemes.builder(Kit.as(world.person("vazia", 0))).get("status")).isEqualTo("PRONTO");
    }

    @Test
    void composicaoComIaCaiNoCompositorLocalSemProvedor() {
        StyleDna dna = new StyleDna();
        dna.setUser(world.me);
        dna.setColorPalette("#000000,#ffffff");
        dna.setStyleKeywords("streetwear,casual");
        kit.dep(StyleDnaRepository.class).save(dna);
        SchemeService.ComposeResult r = schemes.compose(ana, new SchemeService.ComposeRequest(List.of("casual"), List.of("streetwear"), "COMFORTABLE",
                "SUMMER", "algo leve com tênis branco", List.of()), AiCapability.SCHEME_COMPOSER);
        assertThat(r.compositions()).isNotEmpty();
        assertThat(r.fallbackUsed() || "local".equals(r.provider())).isTrue();
        assertThat(r.withScores(null).scores()).isNull();
        assertThat(r.withOrientation(Map.of()).orientation()).isNull();
        String key = SchemeService.combinationKey(r.compositions().get(0).items().stream().map(p -> p.wardrobeItemId()).toList());
        SchemeService.ComposeResult again = schemes.compose(ana, new SchemeService.ComposeRequest(null, null, null, null, null, List.of(key)),
                AiCapability.SCHEME_COMPOSER);
        assertThat(again.compositions()).noneMatch(c -> SchemeService.combinationKey(c.items().stream().map(p -> p.wardrobeItemId()).toList()).equals(key));
    }

    @Test
    void salvarPublicarELerOLook() {
        Map<String, Object> created = schemes.create(ana, form("Look de sábado", mine.subList(0, 3), true));
        Views.SchemeView v = (Views.SchemeView) created.get("scheme");
        UUID id = v.id();
        Scheme s = kit.dep(SchemeRepository.class).findById(id).orElseThrow();
        assertThat(s.getStatus()).isEqualTo(SchemeStatus.PUBLISHED);
        assertThat(s.getTotalPrice()).isEqualByComparingTo("360.00");
        assertThat(s.getTags()).contains("praia");
        Map<String, Object> got = schemes.get(Kit.as(world.rival), id);
        assertThat(got).containsKeys("scheme", "wearstyles", "seals", "canEdit");
        assertThat(got.get("canEdit")).isEqualTo(false);
        assertThat(s.getViewCount()).isEqualTo(1);
        assertThat(schemes.get(ana, id).get("canEdit")).isEqualTo(true);
        assertThat(schemes.renderCard(Kit.as(world.rival), id, true)).isNotEmpty();
        assertThat(schemes.preview(ana, form("Prévia", mine.subList(0, 2), false))).isNotEmpty();
    }

    @Test
    void regrasDoFormularioDoLook() {
        assertThatThrownBy(() -> schemes.create(ana, form("Sem peças", List.of(), false))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> schemes.create(ana, form("x", mine.subList(0, 2), false))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> schemes.create(ana, form("De outra pessoa", world.piecesOf(world.rival).subList(0, 2), false))).isInstanceOf(ApiException.class);
        mine.get(0).setDisponivel(false);
        assertThatThrownBy(() -> schemes.create(ana, form("Indisponível", mine.subList(0, 2), false))).isInstanceOf(ApiException.class);
        SchemeService.SchemeForm badTags = new SchemeService.SchemeForm("Tags erradas", null, List.of("inventada"), List.of("streetwear"), null, null, null, null,
                List.of(item(mine.get(1))), null, null, null, null, null, null, null, null, null, null, null);
        assertThatThrownBy(() -> schemes.create(ana, badTags)).isInstanceOf(ApiException.class);
        SchemeService.SchemeForm noId = new SchemeService.SchemeForm("Sem id", null, List.of("casual"), List.of(), null, null, null, null,
                List.of(new SchemeService.ItemForm(null, SchemeSlot.TOP, null, null, null, null, null, null, null, null)), null, null, null, null, null,
                null, null, null, null, null, null);
        assertThatThrownBy(() -> schemes.create(ana, noId)).isInstanceOf(ApiException.class);
    }

    @Test
    void editarTrocandoPecasPublicarETornarPrivado() {
        UUID id = ((Views.SchemeView) schemes.create(ana, form("Look editável", mine.subList(0, 3), false)).get("scheme")).id();
        Map<String, Object> pub = schemes.publish(ana, id, Visibility.PUBLIC);
        assertThat(pub).containsKey("scheme");
        Map<String, Object> upd = schemes.update(ana, id, form("Look editado", mine.subList(1, 4), true));
        assertThat(upd).containsKeys("scheme", "revalidationPending");
        SchemeService.SchemeForm priv = new SchemeService.SchemeForm("Look editado", null, List.of("casual"), List.of("streetwear"), null, null,
                Visibility.PRIVATE, null, null, null, null, null, null, null, null, null, null, null, null, null);
        assertThat(schemes.update(ana, id, priv)).containsKey("scheme");
        assertThatThrownBy(() -> schemes.update(ana, id, form("Look editado", List.of(), false))).isInstanceOf(ApiException.class);
        assertThat(schemes.toggles(ana, id, true, false)).containsEntry("favorite", true).containsEntry("disponivel", false);
        assertThat(schemes.archive(ana, id)).containsEntry("status", SchemeStatus.ARCHIVED);
        assertThatThrownBy(() -> schemes.get(Kit.as(world.rival), id)).isInstanceOf(ApiException.class);
        assertThat(schemes.canView(Kit.as(world.rival), kit.dep(SchemeRepository.class).findById(id).orElseThrow())).isFalse();
    }

    @Test
    void melhorarComIaEAplicarSoOQueFoiAceito() {
        UUID id = world.lookIds(world.me).get(0);
        Map<String, Object> diff = schemes.improve(ana, id, "deixe mais elegante para a noite");
        assertThat(diff).containsKeys("changes", "explanation");
        Map<String, Object> current = Map.of("title", "A", "occasion", List.of("casual"), "season", "SUMMER");
        String json = "{\"changes\":[{\"field\":\"title\",\"proposed\":\"Noite\",\"reason\":\"r\"},{\"field\":\"occasion\",\"proposed\":[\"party\"]},"
                + "{\"field\":\"season\",\"proposed\":\"MONSOON\"},{\"field\":\"inexistente\",\"proposed\":1}]}";
        assertThat(schemes.parseDiff(json, current)).hasSize(2);
        assertThat(schemes.parseDiff("nada", current)).isNull();
        Map<String, Object> accepted = Map.of("title", "Noite elegante", "description", "Para jantar", "occasion", List.of("party"), "style", List.of("classic"),
                "season", "WINTER", "mood", "ELEGANT", "visibility", "FOLLOWERS");
        assertThat(schemes.applyDiff(ana, id, accepted)).containsKey("scheme");
        Scheme s = kit.dep(SchemeRepository.class).findById(id).orElseThrow();
        assertThat(s.getTitle()).isEqualTo("Noite elegante");
        assertThat(s.getVisibility()).isEqualTo(Visibility.FOLLOWERS);
        assertThatThrownBy(() -> schemes.applyDiff(ana, id, Map.of("mood", "BRAVO"))).isInstanceOf(ApiException.class);
    }

    @Test
    void remixarLookDeOutraPessoaComAsPropriasPecas() {
        UUID src = world.lookIds(world.rival).get(0);
        Map<String, Object> r = schemes.remix(ana, src);
        Map<String, Object> prefill = map(r.get("prefill"));
        assertThat((List<?>) prefill.get("items")).isNotEmpty();
        assertThat(String.valueOf(r.get("next"))).contains(src.toString());
        // o remix salvo aponta para a origem e conta na origem
        List<SchemeService.ItemForm> items = new ArrayList<>();
        for (Object o : (List<?>) prefill.get("items")) {
            items.add((SchemeService.ItemForm) o);
        }
        SchemeService.SchemeForm f = new SchemeService.SchemeForm("Meu remix", null, List.of("casual"), List.of("streetwear"), null, null, null, null,
                items, null, null, src, null, null, null, null, null, null, true, null);
        schemes.create(ana, f);
        assertThat(kit.dep(SchemeRepository.class).findById(src).orElseThrow().getRemixCount()).isEqualTo(1);
        kit.dep(SchemeRepository.class).findById(src).orElseThrow().setDisponivel(false);
        assertThatThrownBy(() -> schemes.remix(ana, src)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> schemes.create(ana, f)).isInstanceOf(ApiException.class);
    }

    @Test
    void fotoDoLookComoAFotoDeUmPost() throws Exception {
        Map<String, Object> up = schemes.uploadLookPhoto(ana, jpeg(800, 1000));
        assertThat(up).containsEntry("width", 800).containsKey("pipeline");
        assertThatThrownBy(() -> schemes.uploadLookPhoto(ana, jpeg(200, 200))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> schemes.uploadLookPhoto(ana, jpeg(1200, 400))).isInstanceOf(ApiException.class);
        String url = String.valueOf(up.get("url"));
        SchemeService.SchemeForm withPhoto = new SchemeService.SchemeForm("Com foto", null, List.of("casual"), List.of("streetwear"), null, null, null, null,
                List.of(item(mine.get(0)), item(mine.get(4))), null, null, null, Map.of("scheme", Map.of("photo", Map.of("url", url))), null, null, null,
                null, null, null, null);
        UUID id = ((Views.SchemeView) schemes.create(ana, withPhoto).get("scheme")).id();
        assertThat(kit.dep(SchemeRepository.class).findById(id).orElseThrow().getCoverImageUrl()).isEqualTo(url);
        SchemeService.SchemeForm foreign = new SchemeService.SchemeForm("Foto alheia", null, List.of("casual"), List.of("streetwear"), null, null, null, null,
                List.of(item(mine.get(0))), null, null, null, Map.of("photo", Map.of("url", "/media/users/outra/looks/x.jpg")), null, null, null,
                null, null, null, null);
        assertThatThrownBy(() -> schemes.create(ana, foreign)).isInstanceOf(ApiException.class);
    }

    @Test
    void meusLooksFiltradosPorEstadoOrigemEHype() {
        UUID archived = world.lookIds(world.me).get(5);
        schemes.archive(ana, archived);
        assertThat(schemes.mine(ana, null, null, 0, 20).items()).hasSize(5);
        assertThat(schemes.mine(ana, null, "arquivados", 0, 20).items()).hasSize(1);
        assertThat(schemes.mine(ana, "casual", "publicados", "manual", 0, 2).items()).hasSize(2);
        assertThat(schemes.mine(ana, null, null, "todos", "hype", "HOT", 0, 20).items()).hasSize(5);   // sem faixas configuradas, o filtro de Hype não corta
        assertThat(schemes.mine(ana, null, "favoritos", null, "hype_asc", null, 0, 20).items()).isEmpty();
        for (String st : List.of("disponivel", "indisponivel", "rascunhos", "outro")) {
            schemes.mine(ana, null, st, null, "growth", null, 0, 20);
        }
        assertThat(SchemeService.lookSort("maior_hype")).isEqualTo("hype_desc");
        assertThat(SchemeService.lookSort("menor_hype")).isEqualTo("hype_asc");
        assertThat(SchemeService.lookSort(null)).isEqualTo("recent");
        assertThat(SchemeService.hypeMinimum("viral", new int[]{20, 40, 60, 80, 90})).isNotNull();
        assertThat(SchemeService.hypeMinimum(null, null)).isNull();
        assertThat(SchemeService.moreRestrictive(Visibility.PUBLIC, Visibility.FOLLOWERS)).isEqualTo(Visibility.FOLLOWERS);
        assertThat(SchemeService.moreRestrictive(null, Visibility.PUBLIC)).isEqualTo(Visibility.PUBLIC);
        assertThat(SchemeService.cardHypeLabel(null, null, true)).isNull();
        assertThat(SchemeService.placeholder(mine.get(0)).getWidth()).isEqualTo(420);
        assertThat(schemes.suggestSealsAfterSave(ana, archived)).isNotNull();
    }
}
