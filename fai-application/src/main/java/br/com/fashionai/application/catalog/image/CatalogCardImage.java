package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import static br.com.fashionai.application.catalog.image.CatalogPhotoEvidence.contextColor;
import static br.com.fashionai.application.catalog.image.CatalogPhotoEvidence.photoSet;
import static br.com.fashionai.application.catalog.image.CatalogPhotoEvidence.wholeFrame;
import static br.com.fashionai.application.catalog.image.CatalogPreviewCache.currentPreview;
import static br.com.fashionai.application.catalog.image.CatalogPreviewCache.currentPreviewSource;
import static br.com.fashionai.application.catalog.image.CatalogPreviewCache.previewAssets;

/** Leitura do card de uma foto do catálogo (lista/detalhe), só a partir do que está gravado na linha. */
final class CatalogCardImage {
    private CatalogCardImage() {
    }

    /**
     * Imagem que o card deve mostrar e como: master processado (nível B) ou URL original com o recorte semântico (nível A).
     * null = sem enquadramento aprovado; a interface deve mostrar estado de processamento/erro, nunca foto crua.
     */
    static Map<String, Object> cardImage(CatalogImage canonical) {
        if (canonical == null || !"APPROVED".equals(canonical.getProcessingStatus())
                || canonical.getUsageStatus() == CatalogImageUsage.REJECTED || "REJECTED".equals(canonical.getReviewStatus())) {
            return null;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        Map<String, Object> selectionCrop = canonical.getCropJson() == null ? Map.of() : Json.map(canonical.getCropJson());
        if (!Boolean.TRUE.equals(selectionCrop.get("ruleCompliant")) || !(selectionCrop.get("crop") instanceof Map<?, ?>)) return null;
        boolean automaticFrame = selectionCrop.get("selectionFrame") instanceof Map<?, ?> frame
                && Boolean.TRUE.equals(frame.get("automatic"));
        Map<String, Object> preview = previewAssets(canonical);
        if (!preview.isEmpty() && !currentPreviewSource(canonical)) return null;
        if (currentPreviewSource(canonical) && preview.get("fabricUrl") instanceof String fabricUrl && !fabricUrl.isBlank()) {
            m.put("url", fabricUrl); m.put("thumbnailUrl", fabricUrl); m.put("mode", "PROCESSED"); m.put("aspect", "3:4");
        } else if (preview.isEmpty() && canonical.getAssetsJson() != null && (!selectionCrop.containsKey("selectionFrame") || automaticFrame)
                && Json.map(canonical.getAssetsJson()).get("card") instanceof String) {
            Map<String, Object> assets = Json.map(canonical.getAssetsJson());
            m.put("url", assets.getOrDefault("card", canonical.getStoredUrl()));
            m.put("thumbnailUrl", assets.get("thumbnail"));
            m.put("mode", "PROCESSED");
        } else if (selectionCrop.containsKey("selectionFrame")) {
            m.put("url", canonical.getImageUrl()); m.put("mode", "SEMANTIC_CROP");
            m.put("crop", selectionCrop.get("crop")); m.put("aspect", "3:4");
            m.put("framing", selectionCrop.get("selectionFrame"));
        } else {
            m.put("url", canonical.getImageUrl());
            m.put("mode", "SEMANTIC_CROP");
            if (canonical.getCropJson() != null) {
                Map<String, Object> crop = Json.map(canonical.getCropJson());
                m.put("crop", crop.get("crop"));
                m.put("background", crop.get("background"));
                m.put("aspect", crop.get("aspect"));
            }
        }
        if (!automaticFrame && canonical.getCropJson() != null) {
            m.put("aspect", Json.map(canonical.getCropJson()).get("aspect"));
        }
        m.put("sourceUrl", canonical.getImageUrl());
        m.put("imageId", canonical.getId());
        m.put("qualityScore", canonical.getQualityScore());
        m.put("pipelineVersion", canonical.getPipelineVersion());
        if (currentPreviewSource(canonical)) m.put("previewCache", preview);
        Map<String, Object> whole = wholeFrame(canonical);
        if (whole != null) m.put("whole", whole);
        return m;
    }

    static Map<String, Object> cardImage(CatalogImage canonical,CatalogProduct product,List<CatalogVariant> productVariants) {
        if (canonical == null || product == null || !Objects.equals(canonical.getProductId(),product.getId())) return null;
        if(!CatalogImageIdentity.matches(canonical,product,null,productVariants)) return null;
        Map<String, Object> photo = photoSet(canonical, product,productVariants);
        if (!photo.isEmpty() && Set.of("READY","DEFAULT","REVIEW","INELIGIBLE","RETRY").contains(String.valueOf(photo.get("status")))) {
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("url", "READY".equals(photo.get("status")) ? photo.get("fabricUrl") : photo.get("defaultAssetUrl"));
            card.put("mode", "READY".equals(photo.get("status")) ? "PROCESSED" : "DEFAULT");
            card.put("sourceUrl", canonical.getImageUrl()); card.put("photoSet", photo); card.put("defaultAssetUrl", photo.get("defaultAssetUrl"));
            card.put("aspect", "3:4"); card.put("imageId", canonical.getId());
            if ("READY".equals(photo.get("status"))) card.put("whole", Map.of("url",photo.get("wholeUrl"),"box",Map.of("x",0,"y",0,"w",1,"h",1),"rendered",true,"processed",true,"version","CATALOG_PHOTO_SET_V2"));
            return card;
        }
        // An existing photo-set verdict cannot fall through to an older source/crop after
        // its source hash or product context changed. The product remains visible with its default asset.
        if (canonical.getAssetsJson() != null && Json.map(canonical.getAssetsJson()).get("photoSet") instanceof Map<?,?> previous
                && "CATALOG_PHOTO_SET_V2".equals(previous.get("version"))) return null;
        Map<String, Object> preview = previewAssets(canonical);
        if (!preview.isEmpty() && !currentPreview(product, canonical, Boolean.TRUE.equals(preview.get("persisted")),productVariants)) return null;
        Map<String,Object> card=cardImage(canonical);
        if (card != null && card.containsKey("whole")) {
            Map<String,Object> wholeContext=canonical.getWholeJson()==null ? Map.of() : Json.map(canonical.getWholeJson());
            if (!Objects.equals(product.getCategory(),wholeContext.get("category"))
                    || !Objects.equals(product.getSubcategory(),wholeContext.get("subcategory"))
                    || !Objects.equals(contextColor(product,canonical,productVariants),wholeContext.get("color"))) card.remove("whole");
        }
        return card;
    }
}
