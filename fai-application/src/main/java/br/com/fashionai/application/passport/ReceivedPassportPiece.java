package br.com.fashionai.application.passport;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ImageOrigin;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.Visibility;

/** Builds the recipient's private representation; personal photos, notes and seals never follow. */
final class ReceivedPassportPiece {
    private ReceivedPassportPiece() {}

    static WardrobeItem create(WardrobeItem original, User recipient, String care, AssetCatalogService assets) {
        WardrobeItem next = new WardrobeItem();
        next.setUser(recipient);
        next.setName(original.getName());
        next.setCategory(original.getCategory());
        next.setSubcategory(original.getSubcategory());
        next.setColor(original.getColor());
        next.setMaterial(original.getMaterial());
        next.setBrandName(original.getBrandName());
        next.setSizeLabel(original.getSizeLabel());
        next.setVisibility(Visibility.PRIVATE);
        next.setCatalogProductId(original.getCatalogProductId());
        next.setCatalogVariantId(original.getCatalogVariantId());
        next.setCondition(original.getCondition());
        next.setEstadoConservacao(original.getEstadoConservacao());
        next.setTipoLavagem(original.getTipoLavagem());
        next.setCareInstructions(care == null ? null : care.substring(0, Math.min(care.length(), 512)));
        next.setPieceOrigin("TROCADA");
        next.setRemixedFromPieceId(original.getId());
        next.setModerationStatus(ModerationStatus.PENDING);
        if (original.getImageOrigin() == ImageOrigin.CATALOG
                && original.getImageUrl() != null && !original.getImageUrl().isBlank()) {
            next.setImageUrl(original.getImageUrl());
            next.setImageOrigin(ImageOrigin.CATALOG);
        } else {
            String image = assets.defaultPieceImage(original.getCategory(), original.getSubcategory());
            next.setImageUrl(image == null || image.isBlank() ? "/_derived/pecas_default/generic.svg" : image);
            next.setImageOrigin(ImageOrigin.DEFAULT);
            next.setDefaultImage(true);
        }
        return next;
    }
}
