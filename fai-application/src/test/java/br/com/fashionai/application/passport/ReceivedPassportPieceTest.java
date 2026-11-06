package br.com.fashionai.application.passport;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ReceivedPassportPieceTest {
    @ParameterizedTest
    @CsvSource({"lower_piece,jeans", "upper_piece,coat", "shoes_piece,casual_sneakers", "accessory_piece,cap"})
    void resolvesTheActualCategoryWithoutCopyingPrivateData(String category, String subcategory) {
        var original = piece(category, subcategory);
        var assets = mock(AssetCatalogService.class);
        when(assets.defaultPieceImage(category, subcategory)).thenReturn("/default/" + subcategory + ".svg");
        var conservation = new EstadoConservacao();
        var wash = new TipoLavagem();
        original.setEstadoConservacao(conservation);
        original.setTipoLavagem(wash);
        var recipient = new User();
        var next = ReceivedPassportPiece.create(original, recipient, "Care instruction", assets);
        assertThat(next.getImageUrl()).isEqualTo("/default/" + subcategory + ".svg");
        assertThat(next.getCategory()).isEqualTo(category);
        assertThat(next.getSubcategory()).isEqualTo(subcategory);
        assertThat(next.getUser()).isSameAs(recipient);
        assertThat(next.getEstadoConservacao()).isSameAs(conservation);
        assertThat(next.getTipoLavagem()).isSameAs(wash);
        assertThat(next.isDefaultImage()).isTrue();
        assertThat(next.getImageOrigin()).isEqualTo(ImageOrigin.DEFAULT);
        assertThat(next.getVisibility()).isEqualTo(Visibility.PRIVATE);
        assertThat(next.getNotes()).isNull();
        assertThat(next.getPurchaseLocation()).isNull();
        assertThat(next.getSealIdsJson()).isNull();
        assertThat(next.getOriginalImageUrl()).isNull();
        assertThat(original.getImageUrl()).isEqualTo("/private/photo.png");
    }

    @Test
    void preservesCatalogPhotoAndFallsBackSafelyWhenAssetIsUnavailable() {
        var assets = mock(AssetCatalogService.class);
        var original = piece("lower_piece", "jeans");
        original.setImageOrigin(ImageOrigin.CATALOG);
        original.setImageUrl("/catalog/jeans.png");
        var catalog = ReceivedPassportPiece.create(original, new User(), null, assets);
        assertThat(catalog.getImageUrl()).isEqualTo("/catalog/jeans.png");
        assertThat(catalog.isDefaultImage()).isFalse();
        verifyNoInteractions(assets);
        original.setImageUrl(" ");
        var fallback = ReceivedPassportPiece.create(original, new User(), "a".repeat(600), assets);
        assertThat(fallback.getImageUrl()).isEqualTo("/_derived/pecas_default/generic.svg");
        assertThat(fallback.getCareInstructions()).hasSize(512);
    }

    private WardrobeItem piece(String category, String subcategory) {
        var piece = new WardrobeItem();
        piece.setCategory(category);
        piece.setSubcategory(subcategory);
        piece.setImageOrigin(ImageOrigin.USER_PHOTO);
        piece.setImageUrl("/private/photo.png");
        piece.setNotes("private notes");
        piece.setPurchaseLocation("private address");
        piece.setSealIdsJson("[\"private-seal\"]");
        return piece;
    }
}
