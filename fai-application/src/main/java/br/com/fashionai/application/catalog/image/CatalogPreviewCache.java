package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogVariant;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import static br.com.fashionai.application.catalog.image.CatalogImagePipelineService.PREVIEW_CACHE_VERSION;
import static br.com.fashionai.application.catalog.image.CatalogPhotoEvidence.contextColor;
import static br.com.fashionai.application.catalog.image.CatalogPhotoEvidence.validSha256;

/**
 * Cache {@code previewFrames} de uma foto: o hash do contexto (versões, categoria, produto, foto, variante, cor, vista,
 * persistência) e a prova de que o cache ainda é da mesma fonte (URL e SHA-256).
 */
final class CatalogPreviewCache {
    private CatalogPreviewCache() {
    }

    static String previewContext(CatalogProduct product, CatalogImage image, boolean persist,List<CatalogVariant> productVariants) {
        return CatalogImagePipeline.sha256(String.join("\n", PREVIEW_CACHE_VERSION, CatalogImagePipeline.VERSION,
                ProductRuleFrame.VERSION, Objects.toString(product == null ? null : product.getCategory(), ""),
                Objects.toString(product == null ? null : product.getSubcategory(), ""),
                Objects.toString(product == null ? null : product.getId(), ""),Objects.toString(image.getId(), ""),
                Objects.toString(image.getVariantId(), ""),Objects.toString(contextColor(product,image,productVariants), ""),
                Objects.toString(image.getImageType(), ""), Boolean.toString(persist)));
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> previewAssets(CatalogImage image) {
        if (image == null || image.getAssetsJson() == null) return Map.of();
        Object value = Json.map(image.getAssetsJson()).get("previewFrames");
        return value instanceof Map<?, ?> ? (Map<String, Object>) value : Map.of();
    }

    static boolean currentPreviewSource(CatalogImage image) {
        Map<String, Object> preview = previewAssets(image);
        return PREVIEW_CACHE_VERSION.equals(preview.get("version"))
                && Objects.equals(image.getImageUrl(), preview.get("sourceUrl"))
                && validSha256(image.getSourceSha256()) && Objects.equals(image.getSourceSha256(), preview.get("sourceSha256"));
    }

    static boolean currentPreview(CatalogProduct product, CatalogImage image, boolean persist,List<CatalogVariant> productVariants) {
        return CatalogImageIdentity.matches(image,product,null,productVariants) && currentPreviewSource(image)
                && Objects.equals(previewContext(product, image, persist,productVariants), previewAssets(image).get("contextHash"));
    }
}
