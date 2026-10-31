package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;

/**
 * Prototype do "Adicionar" (copiar peça pública para o próprio closet): a cópia nasce da peça de origem com os campos
 * de catálogo, imagem e estúdio, a visibilidade padrão de quem copia e a referência à origem (remix). Fotos, uso,
 * reações e histórico não são copiados.
 */
final class PieceCopy {
    private PieceCopy() {
    }

    static WardrobeItem of(WardrobeItem src, User owner) {
        WardrobeItem copy = new WardrobeItem();
        copy.setUser(owner);
        copy.setName(src.getName());
        copy.setCategory(src.getCategory());
        copy.setSubcategory(src.getSubcategory());
        copy.setSex(src.getSex());
        copy.setBrand(src.getBrand());
        copy.setBrandName(src.getBrandName());
        copy.setColor(src.getColor());
        copy.setMaterial(src.getMaterial());
        copy.setSizeLabel(src.getSizeLabel());
        copy.setMarket(src.getMarket());
        copy.setOccasionTags(src.getOccasionTags());
        copy.setStyleTags(src.getStyleTags());
        copy.setPrice(src.getPrice());
        copy.setImageUrl(src.getImageUrl());
        copy.setThumbnailUrl(src.getThumbnailUrl());
        copy.setStudioImageUrl(src.getStudioImageUrl());
        copy.setStudioBackdrop(src.getStudioBackdrop());
        copy.setStudioDetailUrl(src.getStudioDetailUrl());
        copy.setDefaultImage(src.isDefaultImage());
        copy.setModerationStatus(src.getModerationStatus());
        copy.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
        copy.setVisibility(AccountService.defaultVisibility(owner));
        copy.setRemixedFromPieceId(src.getId());
        return copy;
    }
}
