package br.com.fashionai.application.photoedit;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.MediaService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.domain.model.PieceImage;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ImageOrigin;
import br.com.fashionai.domain.model.enums.PieceImageType;
import br.com.fashionai.domain.repository.PieceImageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PhotoEditServiceTest {
    private final CurrentUser user = new CurrentUser(UUID.randomUUID(), "u", "USER", null, true, null, null, null);
    private final UUID pieceId = UUID.randomUUID();
    private final List<PieceImage> rows = new ArrayList<>();
    private final Map<String, byte[]> files = new HashMap<>();
    private WardrobeService wardrobe;
    private WardrobeItem piece;
    private PhotoEditService service;

    @BeforeEach
    void setUp() {
        wardrobe = mock(WardrobeService.class);
        piece = new WardrobeItem();
        piece.assignId(pieceId);
        piece.setOriginalImageUrl("https://media.test/users/u/pieces/p/original.png");
        piece.setImageOrigin(ImageOrigin.USER_PHOTO);
        when(wardrobe.owned(any(), eq(pieceId))).thenReturn(piece);
        MediaService media = mock(MediaService.class);
        when(media.readImage(piece.getOriginalImageUrl())).thenAnswer(inv -> Optional.of(PhotoRecipeTest.photo()));
        when(media.put(anyString(), any(), anyString())).thenAnswer(inv -> {
            files.put("https://media.test/" + inv.getArgument(0), inv.getArgument(1));
            return new MediaStoragePort.StoredObject(inv.getArgument(0), "https://media.test/" + inv.getArgument(0), 1L, "image/png");
        });
        when(media.read(anyString())).thenAnswer(inv -> Optional.ofNullable(files.get(inv.<String>getArgument(0))));
        PieceImageRepository images = mock(PieceImageRepository.class);
        when(images.save(any())).thenAnswer(inv -> {
            PieceImage i = inv.getArgument(0);
            if (i.getId() == null) {
                i.assignId(UUID.randomUUID());
                rows.add(i);
            }
            return i;
        });
        when(images.findByPieceIdOrderByCreatedAtAsc(pieceId)).thenAnswer(inv -> List.copyOf(rows));
        when(images.findById(any())).thenAnswer(inv -> rows.stream().filter(r -> r.getId().equals(inv.getArgument(0))).findFirst());
        // recorte de teste: a camiseta azul do centro é a peça
        service = new PhotoEditService(wardrobe, media, images, img -> new br.com.fashionai.application.imaging.ImageOps.Cutout(mask(img), 1, cutConfidence, 0xFFFFFF, null),
                img -> textOrLogo);
    }

    /** Confiança que o recortador de teste declara e se a "peça" tem texto/logo — cada teste ajusta. */
    private double cutConfidence = 1;
    private boolean textOrLogo = false;

    static BufferedImage mask(BufferedImage img) {
        BufferedImage m = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < img.getHeight(); y++) {
            for (int x = 0; x < img.getWidth(); x++) {
                if ((img.getRGB(x, y) & 0xFF) > 120) {
                    m.setRGB(x, y, 0xFF000000);
                }
            }
        }
        return m;
    }

    static Map<String, Object> canonical(Object... extra) {
        List<Object> ops = new ArrayList<>(List.of(Map.of("op", "crop", "rect", Map.of("x", 0.1, "y", 0.0, "w", 0.8, "h", 1.0), "aspect", "4:5"),
                Map.of("op", "background", "kind", "WHITE", "shadow", "NONE")));
        ops.addAll(List.of(extra));
        return Map.of("version", 1, "target", "CANONICAL", "ops", ops);
    }

    @Test
    void salvarCanonicaGravaVersaoComReceitaETrocaAFotoDaPeca() {
        Map<String, Object> v = service.save(user, pieceId, canonical());
        assertThat(v.get("target")).isEqualTo("CANONICAL");
        assertThat(v.get("current")).isEqualTo(true);
        assertThat(v.get("recipe")).isNotNull();
        verify(wardrobe).replaceImage(eq(user), eq(pieceId), any(), isNull());
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getImageType()).isEqualTo(PieceImageType.CANONICAL);
        assertThat(rows.get(0).getAnalysisJson()).contains("\"generative\":false");
        assertThat(rows.get(0).getWidth() * 5).isEqualTo(rows.get(0).getHeight() * 4);

        service.save(user, pieceId, canonical(Map.of("op", "tone", "exposureEv", 0.3)));
        assertThat(rows.get(0).isSuperseded()).isTrue();
        assertThat(rows.get(1).isSuperseded()).isFalse();
        assertThat(service.versions(user, pieceId)).hasSize(2).first().satisfies(m -> assertThat(m.get("current")).isEqualTo(true));
    }

    @Test
    void apresentacaoFicaAoLadoSemTrocarAFotoDaPeca() {
        service.save(user, pieceId, Map.of("target", "PRESENTATION", "ops", List.of(Map.of("op", "filter", "style", "MONO", "strength", 1))));
        verify(wardrobe, never()).replaceImage(any(), any(), any(), any());
        assertThat(rows.get(0).getImageType()).isEqualTo(PieceImageType.PRESENTATION);
        assertThatThrownBy(() -> service.restore(user, pieceId, rows.get(0).getId())).isInstanceOf(ApiException.class);
    }

    @Test
    void receitaForaDaPoliticaEhRecusadaComOsMotivos() {
        assertThatThrownBy(() -> service.save(user, pieceId, Map.of("target", "CANONICAL", "ops",
                List.of(Map.of("op", "filter", "style", "MONO", "strength", 1)))))
                .isInstanceOf(ApiException.class).hasMessageContaining("OPERACAO_SO_NA_APRESENTACAO:filter").hasMessageContaining("CANONICA_EXIGE_QUADRO_4_5");
        assertThat(rows).isEmpty();
    }

    @Test
    void mudarMuitoACorGeraAvisoNaPrevia() {
        Map<String, Object> p = service.preview(user, pieceId, canonical(Map.of("op", "tone", "exposureEv", 1.8, "saturation", 15)));
        assertThat(p.get("warnings").toString()).contains("COR_DIFERENTE_DA_PECA_REAL");
        assertThat(((Map<?, ?>) p.get("quality")).get("colorDeltaE")).isNotNull();
        assertThat((String) p.get("png")).isNotBlank();
    }

    @Test
    void pecaDoCatalogoNaoTemFotoPropriaParaEditar() {
        piece.setImageOrigin(ImageOrigin.CATALOG);
        assertThatThrownBy(() -> service.session(user, pieceId)).isInstanceOf(ApiException.class).hasMessageContaining("foto sua");
    }

    @Test
    void restaurarVersaoAnteriorVoltaAFotoEReordenaAVigente() {
        service.save(user, pieceId, canonical());
        service.save(user, pieceId, canonical(Map.of("op", "tone", "exposureEv", 0.5)));
        UUID first = rows.get(0).getId();
        service.restore(user, pieceId, first);
        assertThat(rows.get(0).isSuperseded()).isFalse();
        assertThat(rows.get(1).isSuperseded()).isTrue();
        verify(wardrobe, times(3)).replaceImage(eq(user), eq(pieceId), any(), isNull());
    }

    @Test
    void automaticoSugereReceitaCanonicaValida() {
        @SuppressWarnings("unchecked")
        Map<String, Object> recipe = (Map<String, Object>) service.auto(user, pieceId).get("recipe");
        PhotoRecipe parsed = PhotoRecipe.parse(recipe);
        assertThat(RecipePolicy.violations(parsed, 1)).isEmpty();
        assertThat(parsed.ops()).anyMatch(o -> o instanceof PhotoRecipe.Crop c && "4:5".equals(c.aspect()));
    }

    @Test
    void espelharComTextoNaPecaEhRecusadoNaCanonicaEAvisadoNaApresentacao() {
        textOrLogo = true;
        assertThatThrownBy(() -> service.preview(user, pieceId, canonical(Map.of("op", "flip", "axis", "H"))))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getMessage()).contains("ESPELHAR_INVERTE_TEXTO_OU_LOGO"));
        Map<String, Object> pres = service.preview(user, pieceId, Map.of("version", 1, "target", "PRESENTATION", "ops", List.of(Map.of("op", "flip", "axis", "H"))));
        assertThat((List<String>) pres.get("warnings")).contains("ESPELHO_COM_TEXTO_OU_LOGO");
        textOrLogo = false;
        assertThat((List<String>) service.preview(user, pieceId, canonical(Map.of("op", "flip", "axis", "H"))).get("warnings")).doesNotContain("ESPELHO_COM_TEXTO_OU_LOGO");
    }

    @Test
    void recorteIncertoAvisaNaPreviaENiveisEntramNaReceita() {
        cutConfidence = 0.2;
        Map<String, Object> out = service.preview(user, pieceId, canonical(Map.of("op", "levels", "black", 0.05, "white", 0.95, "gamma", 1.1)));
        assertThat((List<String>) out.get("warnings")).contains("RECORTE_INCERTO");
        assertThat(((Map<?, ?>) out.get("quality")).get("cutConfidence")).isEqualTo(0.2);
        cutConfidence = 0.9;
        assertThat((List<String>) service.preview(user, pieceId, canonical()).get("warnings")).doesNotContain("RECORTE_INCERTO");
        Map<String, Object> limits = (Map<String, Object>) service.session(user, pieceId).get("limits");
        assertThat(limits).containsKeys("canonicalBlack", "canonicalWhite", "canonicalGamma", "feather", "uncertainCut");
    }
}
