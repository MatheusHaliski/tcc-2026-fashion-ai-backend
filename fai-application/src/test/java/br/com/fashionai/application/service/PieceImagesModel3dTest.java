package br.com.fashionai.application.service;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/** Etapa 3 — a peça que vem do catálogo herda o modelo 3D de vitrine publicado do produto; sem modelo, nada muda. */
class PieceImagesModel3dTest {
    private final AssetCatalogService assets = mock(AssetCatalogService.class);

    @Test
    void productModelBecomesThePieceShowcaseModel() {
        WardrobeItem w = new WardrobeItem();
        PieceImages.fromCatalog(w, new CatalogPick(UUID.randomUUID(), null, "/c.jpg", null, Map.of(),
                "/media/catalog/model3d/x/a.glb"), assets);
        assertThat(w.getModel3dUrl()).isEqualTo("/media/catalog/model3d/x/a.glb");
        assertThat(w.getModel3dStatus()).isEqualTo(Model3dStatus.COMPLETED);
        assertThat(w.getModel3dGeneratedAt()).isNotNull();
        assertThat(w.getImageUrl()).isEqualTo("/c.jpg");
    }

    @Test
    void withoutProductModelThePieceHasNoModel() {
        for (CatalogPick pick : new CatalogPick[]{new CatalogPick(UUID.randomUUID(), null, "/c.jpg"),
                new CatalogPick(UUID.randomUUID(), null, "/c.jpg", null, null, "  ")}) {
            WardrobeItem w = new WardrobeItem();
            PieceImages.fromCatalog(w, pick, assets);
            assertThat(w.getModel3dUrl()).isNull();
            assertThat(w.getModel3dStatus()).isNull();
        }
    }
}
