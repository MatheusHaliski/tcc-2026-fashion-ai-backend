package br.com.fashionai.application.service;

import br.com.fashionai.application.acervo.AcervoLugares;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.TaxonomyAttribute;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização da vista de uma peça do guarda-roupa no espelho (era {@code MirrorService.pieceView}): as mesmas chaves,
 * na mesma ordem e com os mesmos valores — o espelho, a folha da parte, a lista e as sugestões leem este formato.
 */
class MirrorPieceViewsTest {
    private final User ana = Kit.user("ana");

    @Test
    void pecaGuardadaNoAcervoComModeloEAtributos() {
        WardrobeItem w = Kit.piece(ana, "Jaqueta jeans", "upper_piece", "jacket", "blue");
        w.setVariationCode("OVERSIZED");
        w.setStudioImageUrl("/media/jaqueta-estudio.png");
        w.getAttributes().add(new TaxonomyAttribute("LENGTH", "CROPPED", "USER", BigDecimal.ONE, 0));
        w.setModel3dUrl("/media/jaqueta.glb");
        w.setModel3dStatus(Model3dStatus.COMPLETED);
        UUID gaveta = UUID.randomUUID(), armario = UUID.randomUUID();
        Map<UUID, AcervoLugares.Lugar> where = Map.of(w.getId(), new AcervoLugares.Lugar(gaveta, armario, "Closet / Armário / Gaveta 1", "GAVETA", false));

        Map<String, Object> v = MirrorPieceViews.pieceView(w, where);

        assertThat(v.keySet()).containsExactly("id", "name", "category", "subcategory", "color", "colorHex", "imageUrl", "thumbnailUrl",
                "studioImageUrl", "variation", "attributes", "available", "slot", "address", "addressLabel", "moduleId", "model3dUrl",
                "model3dStatus", "photoProcessingStatus");
        assertThat(v).containsEntry("id", w.getId()).containsEntry("name", "Jaqueta jeans").containsEntry("category", "upper_piece")
                .containsEntry("subcategory", "jacket").containsEntry("color", "blue").containsEntry("imageUrl", "/media/Jaqueta-jeans.png")
                .containsEntry("thumbnailUrl", "/media/Jaqueta-jeans-thumb.png").containsEntry("studioImageUrl", "/media/jaqueta-estudio.png")
                .containsEntry("variation", "OVERSIZED").containsEntry("attributes", Map.of("LENGTH", List.of("CROPPED")))
                .containsEntry("available", true).containsEntry("slot", "outer_layer")
                .containsEntry("address", gaveta.toString()).containsEntry("addressLabel", "Closet / Armário / Gaveta 1")
                .containsEntry("moduleId", armario.toString()).containsEntry("model3dUrl", "/media/jaqueta.glb")
                .containsEntry("model3dStatus", "COMPLETED").containsEntry("photoProcessingStatus", "NEW");
        assertThat((String) v.get("colorHex")).startsWith("#");
    }

    @Test
    void pecaSemLugarIndisponivelESemModelo() {
        WardrobeItem w = Kit.piece(ana, "Colar", "accessory_piece", "necklace", "gold");
        w.setDisponivel(false);

        Map<String, Object> v = MirrorPieceViews.pieceView(w, Map.of());

        assertThat(v).containsEntry("available", false).containsEntry("slot", "accessory").containsEntry("address", null)
                .containsEntry("addressLabel", null).containsEntry("moduleId", null).containsEntry("model3dUrl", null)
                .containsEntry("model3dStatus", null).containsEntry("attributes", Map.of());
    }
}
