package br.com.fashionai.application.service;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.service.WardrobeService.CatalogPick;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;

import java.util.Map;

/** Imagem da peça sem foto da pessoa: foto oficial do catálogo (RF47) ou a imagem padrão da subcategoria. */
final class PieceImages {
    private PieceImages() {
    }

    /** RF47 — produto do catálogo global: referência ao produto e a foto oficial (ou a padrão, sem foto). */
    static void fromCatalog(WardrobeItem w, CatalogPick pick, AssetCatalogService assets) {
        w.setCatalogProductId(pick.productId());
        w.setCatalogVariantId(pick.variantId());
        boolean hasImage = pick.imageUrl() != null && !pick.imageUrl().isBlank();
        String url = hasImage ? pick.imageUrl() : assets.defaultPieceImage(w.getCategory(), w.getSubcategory());
        w.setImageUrl(url);
        w.setThumbnailUrl(hasImage && pick.thumbnailUrl() != null && !pick.thumbnailUrl().isBlank() ? pick.thumbnailUrl() : url);
        w.setOriginalImageUrl(null);
        if (hasImage && pick.catalogImage() != null) {
            // o recorte semântico vai junto da peça: quem mostra a foto aplica o mesmo enquadramento do card
            w.setFlatLayMetadataJson(Json.write(Map.of("catalogImage", pick.catalogImage())));
        }
        w.setDefaultImage(!hasImage);
        w.setImageOrigin(hasImage ? br.com.fashionai.domain.model.enums.ImageOrigin.CATALOG
                : br.com.fashionai.domain.model.enums.ImageOrigin.DEFAULT);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
    }

    /** Imagem padrão da peça ({@code /public/assets_pecas}) quando a pessoa deixa a foto vazia. */
    static void useDefault(WardrobeItem w, AssetCatalogService assets) {
        String url = assets.defaultPieceImage(w.getCategory(), w.getSubcategory());
        w.setImageUrl(url);
        w.setThumbnailUrl(url);
        w.setOriginalImageUrl(null);
        w.setDefaultImage(true);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
    }

    /**
     * RF12.CA03 — a foto que era a imagem da peça foi excluída: a peça volta para a imagem padrão da subcategoria
     * (image_url é obrigatório; a peça nunca fica sem imagem).
     */
    static void afterPhotoDeletion(WardrobeItem w, AssetCatalogService assets) {
        String url = assets.defaultPieceImage(w.getCategory(), w.getSubcategory());
        w.setImageUrl(url);
        w.setThumbnailUrl(url);
        w.setStudioImageUrl(null);
        w.setStudioDetailUrl(null);
        w.setDefaultImage(true);
    }
}
