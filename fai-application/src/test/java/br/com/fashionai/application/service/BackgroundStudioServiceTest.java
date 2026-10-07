package br.com.fashionai.application.service;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.ImageProviderPorts;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.BackgroundAnimation;
import br.com.fashionai.domain.model.enums.ContainerOrigin;
import br.com.fashionai.domain.model.enums.Season;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Background Studio (RF11): catálogo de cores, gradientes, presets AURA, materiais e skins; direção recomendada pelo
 * estilo do look; arte por IA (com galeria pré-gerada quando não há provedor); imagem própria recortada para o card; e
 * as regras do container (travado pela direção recomendada, manual ou indefinido) ao salvar e ao voltar ao padrão.
 */
class BackgroundStudioServiceTest {
    private Kit kit;
    private World world;
    private BackgroundStudioService studio;
    private AssetCatalogService assets;
    private CurrentUser ana;
    private Scheme look;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        assets = kit.dep(AssetCatalogService.class);
        Map<String, Object> grad = Map.of("id", "frost", "stops", List.of("#ffffff", "#ccddee"), "animation", "SNOW");
        when(assets.gradient(anyString())).thenAnswer(i -> "nope".equals(i.getArgument(0)) ? Optional.empty() : Optional.of(grad));
        when(assets.auraVariant(anyString())).thenAnswer(i -> "nope".equals(i.getArgument(0)) ? Optional.empty() : Optional.of(Map.of("id", i.getArgument(0))));
        when(assets.material(anyString())).thenAnswer(i -> "nope".equals(i.getArgument(0)) ? Optional.empty() : Optional.of(Map.of("id", i.getArgument(0))));
        when(assets.cardSkin(anyString())).thenAnswer(i -> "nope".equals(i.getArgument(0)) ? Optional.empty() : Optional.of(Map.of("id", i.getArgument(0))));
        when(assets.resolveCombination(anyString(), anyString(), anyBoolean(), anyBoolean()))
                .thenReturn(Map.of("strategy", "asset", "url", "/media/aura.mp4", "posterUrl", "/media/aura.jpg"));
        when(assets.nativeContainer(any())).thenReturn("#101010");
        when(assets.list("auraPresets")).thenReturn(List.of(Map.of("id", "a1", "name", "Neon urbano", "prompt", "cidade neon noturna", "archetype", "edgy",
                "variants", List.of("a1-v1")), Map.of("id", "a2", "name", "Praia", "prompt", "areia e mar", "archetype", "boho")));
        when(assets.skin("atelier")).thenReturn(Optional.of(Map.of("thumbnailPrompt", Map.of("scheme", "atelier card", "piece", "atelier piece"),
                "negativePrompt", "no text")));
        MediaService media = kit.dep(MediaService.class);
        when(media.put(anyString(), any(), anyString())).thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/jpeg"));
        when(media.requireOwnedMedia(any(), anyString(), any(), anyString())).thenAnswer(i -> new MediaService.OwnedMedia("k", i.getArgument(1)));
        ImageProviderPorts.ImageGenerationPort offline = new ImageProviderPorts.ImageGenerationPort() {
            public boolean available() {
                return false;
            }

            public Optional<ImageProviderPorts.ProviderImage> generate(String p, String n, int w, int h) {
                return Optional.empty();
            }
        };
        kit.with(List.of(offline));
        studio = kit.build(BackgroundStudioService.class);
        ana = Kit.as(world.me);
        look = world.looksOf(world.me).get(0);
    }

    private static byte[] jpeg(int w, int h) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB), "jpg", out);
        return out.toByteArray();
    }

    private static Map<String, Object> cfg(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    @Test
    void catalogoEDirecaoRecomendada() {
        Map<String, Object> c = studio.catalog();
        assertThat(c).containsKeys("colors", "directions", "anatomies", "sealPlacements", "animations").containsEntry("imageGenerationAvailable", false);
        Map<String, Object> rec = studio.recommend(List.of("streetwear", "urban"), List.of("party"));
        assertThat(rec).containsKeys("id", "combination", "containerColor", "reason");
        assertThat(studio.recommend(null, null)).containsKey("id");
        assertThat(studio.combination("a1-v1", "m1", true, false)).containsEntry("strategy", "asset");
    }

    @Test
    void arteComIaSemProvedorOfereceAGaleria() {
        assertThatThrownBy(() -> studio.generateArt(ana, new BackgroundStudioService.ArtRequest(" ", null, null, null, false, null))).isInstanceOf(ApiException.class);
        Map<String, Object> r = studio.generateArt(ana, new BackgroundStudioService.ArtRequest("rua com neon à noite", "editorial_spread", null, "anos 90", true, "PIECE"));
        assertThat(r).containsEntry("status", "FALLBACK_GALLERY");
        List<?> sug = (List<?>) r.get("suggestions");
        assertThat(map(sug.get(0))).containsEntry("presetId", "a1");
        assertThat(studio.generateSkinThumbnail(Kit.admin(world.me), "atelier", true)).containsEntry("status", "FALLBACK");
        assertThatThrownBy(() -> studio.generateSkinThumbnail(Kit.admin(world.me), "nao-existe", false)).isInstanceOf(ApiException.class);
    }

    @Test
    void imagemPropriaRecortadaParaOCard() throws Exception {
        Map<String, Object> up = studio.upload(ana, jpeg(1200, 1600), "PIECE");
        assertThat(up).containsEntry("width", 900).containsEntry("height", 2080).containsEntry("croppedFrom", "1200x1600");
        assertThat(studio.upload(ana, jpeg(1600, 900), null)).containsEntry("height", 2160);
        assertThatThrownBy(() -> studio.upload(ana, jpeg(300, 300), null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> studio.upload(ana, jpeg(2000, 450), null)).isInstanceOf(ApiException.class);
        assertThat(BackgroundStudioService.cropTo(new BufferedImage(500, 500, BufferedImage.TYPE_INT_RGB), 900, 2160).getHeight()).isEqualTo(2160);
    }

    @Test
    void salvarComAuraMaterialAnimacaoESkin() {
        Map<String, Object> scheme = cfg("color", "#112233", "gradient", Map.of("type", "radial", "angle", 90, "stops", List.of("#000000", "#ffffff")),
                "gradientPresetId", "frost", "aura", cfg("variantId", "a1-v1", "format", "MOSAICO", "animated", true), "materialId", "m1",
                "animation", "SHIMMER", "cardSkin", "atelier", "layoutAnatomy", "GRADE_PECAS", "silhouette", "RETA",
                "uploadUrl", "/media/users/" + world.me.getId() + "/backgrounds/x.jpg", "container", cfg("color", "#abcdef"));
        Map<String, Object> r = studio.saveScheme(ana, look.getId(), cfg("scheme", scheme), false);
        assertThat(r).containsEntry("cardSkin", "atelier").containsEntry("containerOrigin", ContainerOrigin.MANUAL);
        assertThat(look.getBackgroundVideoUrl()).isEqualTo("/media/aura.mp4");
        assertThat(look.getBackgroundAnimationType()).isEqualTo(BackgroundAnimation.SHIMMER);
        assertThat(look.getBackgroundArtUrl()).contains("/backgrounds/");
        SchemeCardRenderer.Background bg = studio.rendererBackground(look);
        assertThat(bg).isNotNull();
        // limpar o container e o gradiente
        studio.applyToScheme(look, cfg("container", cfg("color", null), "gradient", null, "animation", null), false);
        assertThat(look.getContainerOrigin()).isEqualTo(ContainerOrigin.INDEFINIDA);
        assertThat(look.getBackgroundGradient()).isNull();
        assertThat(look.getBackgroundAnimationType()).isEqualTo(BackgroundAnimation.NONE);
        // fundo por preset salvo: o renderer lê as cores do preset
        studio.applyToScheme(look, cfg("seasonalPresetId", "frost"), false);
        assertThat(studio.rendererBackground(look)).isNotNull();
        studio.applyToScheme(look, null, false);
        Map<String, Object> pieces = new HashMap<>();
        pieces.put("anatomy", "PECA_AMPLIADO");
        studio.applyToScheme(look, cfg("pieces", pieces), false);
        assertThat(pieces).containsKey("sealPlacement");
    }

    @Test
    void direcaoRecomendadaTravaOContainer() {
        studio.applyToScheme(look, cfg("direction", "EDITORIAL_SPREAD"), true);
        assertThat(look.isContainerMandatory()).isTrue();
        assertThat(look.getContainerColor()).isEqualTo("#101010");
        assertThatThrownBy(() -> studio.applyToScheme(look, cfg("container", cfg("color", "#ffffff")), false)).isInstanceOf(ApiException.class);
        studio.applyToScheme(look, cfg("container", cfg("color", "#101010")), false);
        assertThat(studio.resetScheme(ana, look.getId())).containsEntry("containerMandatory", true);
        assertThat(look.getContainerColor()).isEqualTo("#101010");
        assertThatThrownBy(() -> studio.applyToScheme(look, cfg("direction", "NAO_EXISTE"), true)).isInstanceOf(ApiException.class);
        Scheme other = world.looksOf(world.me).get(1);
        studio.applyToScheme(other, cfg("container", cfg("color", "#222222")), false);
        assertThat(studio.resetScheme(ana, other.getId())).containsEntry("reset", true);
        assertThat(other.getContainerOrigin()).isEqualTo(ContainerOrigin.INDEFINIDA);
    }

    @Test
    void cartelaSazonalPrecisaDaEstacao() {
        assertThatThrownBy(() -> studio.applyToScheme(look, cfg("seasonalAuto", true), false)).isInstanceOf(ApiException.class);
        for (Season s : Season.values()) {
            look.setSeason(s);
            studio.applyToScheme(look, cfg("seasonalAuto", true), false);
            assertThat(look.getBackgroundAnimationType()).isEqualTo(BackgroundAnimation.SNOW);
        }
    }

    @Test
    void valoresInvalidosSaoRecusados() {
        for (Map<String, Object> bad : List.of(cfg("color", "azul"), cfg("gradientPresetId", "nope"), cfg("seasonalPresetId", "nope"),
                cfg("aura", cfg("variantId", "nope")), cfg("materialId", "nope"), cfg("layoutAnatomy", "LEGO", "materialId", "m1"),
                cfg("aura", cfg("variantId", "a1", "format", "VIDEO"), "materialId", "m1"), cfg("aura", cfg("format", "MOSAICO")),
                cfg("silhouette", "CUBO"), cfg("cardSkin", "nope"), cfg("layoutAnatomy", "NADA"), cfg("container", cfg("color", "verde")))) {
            assertThatThrownBy(() -> studio.applyToScheme(look, bad, false)).isInstanceOf(ApiException.class);
        }
        assertThatThrownBy(() -> studio.applyToScheme(look, cfg("pieces", cfg("anatomy", "NADA")), false)).isInstanceOf(ApiException.class);
    }

    @Test
    void fundoDaPecaComRevisao() {
        WardrobeItem w = world.piecesOf(world.me).get(0);
        Map<String, Object> first = studio.savePiece(ana, w.getId(), cfg("color", "#ffffff"));
        assertThat(map(first.get("background"))).containsEntry("rev", 1);
        assertThat(map(studio.savePiece(ana, w.getId(), cfg("color", "#000000", "baseRev", 1)).get("background"))).containsEntry("rev", 2);
        assertThatThrownBy(() -> studio.savePiece(ana, w.getId(), cfg("color", "#111111", "baseRev", 1))).isInstanceOf(ApiException.class);
        assertThat(BackgroundStudioService.withRevision(null, "texto")).isEqualTo("texto");
        assertThatThrownBy(() -> studio.savePiece(ana, java.util.UUID.randomUUID(), cfg())).isInstanceOf(ApiException.class);
        Map<String, Object> pc = new HashMap<>();
        pc.put(w.getId().toString(), cfg("color", "#333333"));
        assertThat(studio.saveScheme(ana, look.getId(), cfg("pieces", pc), false)).containsKey("studio");
        assertThat(BackgroundStudioService.zero()).isZero();
        when(assets.list(eq("materials"))).thenReturn(List.of());
    }
}
