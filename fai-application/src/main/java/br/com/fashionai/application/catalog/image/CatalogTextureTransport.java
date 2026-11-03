package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.catalog.image.CatalogImagePipelineService.TexturePhoto;
import br.com.fashionai.application.catalog.image.CatalogImagePipelineService.TextureView;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.WebFetchPort;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.enums.CatalogImageType;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogVariantRepository;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.catalog.image.CatalogCardImage.cardImage;
import static br.com.fashionai.application.catalog.image.CatalogPreviewCache.previewAssets;

/**
 * Bytes da foto que o provador veste: derivado isolado aprovado, preview persistido ou o original da mesma peça e
 * variante — nunca outra cor, nunca as costas no lugar da frente (nem a frente no lugar das costas).
 */
final class CatalogTextureTransport {
    private final CatalogImageRepository images;
    private final CatalogProductRepository products;
    private final CatalogVariantRepository variants;
    private final WebFetchPort web;
    private final MediaStoragePort storage;
    private final CatalogImageBindings bindings;

    CatalogTextureTransport(CatalogImageRepository images, CatalogProductRepository products, CatalogVariantRepository variants,
                            WebFetchPort web, MediaStoragePort storage, CatalogImageBindings bindings) {
        this.images = images;
        this.products = products;
        this.variants = variants;
        this.web = web;
        this.storage = storage;
        this.bindings = bindings;
    }

    /** Frente antes de detalhe, lateral e costas: a textura do provador e a verificação do enquadramento são da FRENTE da
     *  peça (uma foto de costas servida como frente vestia o avatar com o capuz e a etiqueta na frente). */
    static int viewRank(CatalogImage image) {
        CatalogImageType type = image.getImageType();
        if (type == null || type == CatalogImageType.FRONT) return 0;
        return switch (type) { case DETAIL, TOP -> 1; case SIDE -> 2; case BACK, SOLE -> 3; default -> 1; };
    }

    TexturePhoto texturePhoto(UUID productId, boolean isolated, UUID variantId, UUID imageId, TextureView view) {
        boolean back = view == TextureView.BACK;
        CatalogProduct product=products.findById(productId).orElseThrow(()->ApiException.notFound("catalog product"));
        if (br.com.fashionai.application.catalog.CatalogPhotoEligibility.excluded(product))
            throw ApiException.badRequest("PRODUTO_RECUSADO", "Este produto foi recusado.");
        var productVariants=variants.findByProductIdOrderByVariantKey(productId);
        var requestedVariant=bindings.selectedVariant(product,productVariants,variantId,imageId);
        List<CatalogImage> candidates=images.findByProductIdOrderByPrimaryDescCreatedAtAsc(productId).stream()
                .filter(i->productId.equals(i.getProductId()))
                // a foto escolhida (imageId) é a da frente: nas costas vale a variante dela, não a própria foto
                .filter(i->back||imageId==null||imageId.equals(i.getId()))
                .filter(i->CatalogImageIdentity.matches(i,product,requestedVariant,productVariants))
                .filter(i->i.getUsageStatus()!=CatalogImageUsage.REJECTED&&!"REJECTED".equals(i.getReviewStatus()))
                .filter(i->back ? i.getImageType()==CatalogImageType.BACK : imageId!=null||i.getImageType()!=CatalogImageType.BACK)
                // a foto canônica é a da frente: as costas valem quando aprovadas, sem exigir o selo de canônica
                .filter(i->"READY".equals(bindings.boundPhotoSet(i,product).get("status"))
                        || "APPROVED".equals(i.getProcessingStatus())&&(back||i.isCanonical()||variantId!=null||imageId!=null))
                .filter(i->!Set.of("REVIEW","INELIGIBLE","RETRY").contains(String.valueOf(bindings.boundPhotoSet(i,product).get("status"))))
                .sorted(java.util.Comparator.comparing((CatalogImage i)->!"READY".equals(bindings.boundPhotoSet(i,product).get("status")))
                        .thenComparing(CatalogTextureTransport::viewRank)
                        .thenComparing(i->!i.isCanonical()).thenComparing(i->String.valueOf(i.getId())))
                .toList();
        for (CatalogImage selected:candidates) {
            Map<String,Object> cleaned=bindings.boundPhotoSet(selected,product);
            if ("DEFAULT".equals(cleaned.get("status"))) continue;
            Map<String,Object> approvedCard=cardImage(selected,product,productVariants);
            if (approvedCard!=null&&approvedCard.get("whole") instanceof Map<?,?> whole
                    &&Boolean.TRUE.equals(whole.get("processed"))&&bindings.allowsPersistence(product,selected)) {
                try {
                    Optional<String> key=storage.keyOf((String)whole.get("url"));
                    if (key.isPresent()) {
                        byte[] data=storage.get(key.get());
                        return new TexturePhoto(data,ImageOps.requireAcceptedImage(data));
                    }
                } catch (RuntimeException unavailable) {
                    // Try another verified photo of the same selected variant. Do not substitute another color.
                }
            }
            if (isolated) continue;
            if (bindings.allowsPersistence(product,selected)&&bindings.currentBoundPreview(product,selected,true)
                    &&previewAssets(selected).get("whole") instanceof Map<?,?> whole&&whole.get("url") instanceof String url) {
                try {
                    Optional<String> key=storage.keyOf(url);
                    if(key.isPresent()) {byte[] bytes=storage.get(key.get());return new TexturePhoto(bytes,ImageOps.requireAcceptedImage(bytes));}
                } catch (RuntimeException unavailable) { /* Approved original remains an explicitly non-isolated transport. */ }
            }
            Optional<WebFetchPort.Fetched> fetched=web.get(selected.getImageUrl(),(int)ImageOps.MAX_UPLOAD_BYTES,"image/");
            if(fetched.isPresent()) {
                try {return new TexturePhoto(fetched.get().body(),ImageOps.requireAcceptedImage(fetched.get().body()));}
                catch (RuntimeException unreadable) { /* Keep trying only this product/variant's alternatives. */ }
            }
        }
        if(back) throw new ApiException(404,"CATALOG_BACK_PHOTO_UNAVAILABLE","Esta peça e variante não têm foto das costas.");
        if(isolated) throw new ApiException(422,"CATALOG_ISOLATED_PHOTO_UNAVAILABLE","Foto isolada ainda não disponível para esta peça e variante.");
        throw new ApiException(422,"CATALOG_IMAGE_FETCH_FAILED","Não foi possível carregar a foto desta peça e variante.");
    }
}
