package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

import static br.com.fashionai.application.catalog.image.CatalogImagePipelineService.PREVIEW_CACHE_VERSION;
import static br.com.fashionai.application.catalog.image.CatalogPhotoEvidence.validPreflight;
import static br.com.fashionai.application.catalog.image.CatalogPreviewCache.previewContext;

/**
 * Gravação dos derivados de uma foto: o cache {@code previewFrames} (tecido e Peça inteira no nível B, só metadados no
 * nível A) e o master com as variantes branco/neutro/card/thumb no storage do FashionAI.
 */
final class CatalogPreviewWriter {
    private final MediaStoragePort storage;
    private final CatalogImageBindings bindings;

    CatalogPreviewWriter(MediaStoragePort storage, CatalogImageBindings bindings) {
        this.storage = storage;
        this.bindings = bindings;
    }

    /** Persist stable derivatives once; reference-only sources keep URLs and framing metadata without copying bytes. */
    void rememberPreview(CatalogProduct product, CatalogImage image, CatalogImagePipeline.Analysis analysis, byte[] source, boolean persist) {
        Map<String, Object> crop = image.getCropJson() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(Json.map(image.getCropJson()));
        Map<?, ?> frame = analysis != null && analysis.debug().get("productFrame") instanceof Map<?, ?> f ? f : Map.of();
        if (analysis != null) {
            if (!Boolean.TRUE.equals(frame.get("ok")) || !(frame.get("crop") instanceof Map<?, ?>)) return;
            crop.put("crop", frame.get("crop")); crop.put("aspect", "3:4"); crop.put("ruleCompliant", true);
            if (!crop.containsKey("selectionFrame")) crop.put("selectionFrame", Map.of("version", ProductRuleFrame.VERSION, "sourceSha256", analysis.sha256(), "automatic", true));
            image.setCropJson(Json.write(crop));
        } else if (!Boolean.TRUE.equals(crop.get("ruleCompliant")) || !(crop.get("crop") instanceof Map<?, ?>)) return;
        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("version", PREVIEW_CACHE_VERSION);
        preview.put("sourceUrl", image.getImageUrl()); preview.put("sourceSha256", image.getSourceSha256());
        preview.put("contextHash", previewContext(product, image, persist, bindings.contextVariants(image)));
        preview.put("status", "READY"); preview.put("persisted", persist); preview.put("generatedAt", Instant.now().toString());
        if (persist && analysis != null) {
            CatalogPreviewRenderer.Frames frames = analysis.previewFrames();
            java.awt.image.BufferedImage fabric = frames == null ? CatalogPreviewRenderer.fabricFrom(source, frame) : frames.fabric();
            if (fabric == null) return;
            String key = "catalog/previews/" + image.getProductId() + "/" + image.getId() + "/"
                    + preview.get("contextHash") + "/" + analysis.sha256() + "/";
            preview.put("fabricUrl", put(key + "fabric.jpg", ImageOps.jpeg(fabric, .92f), "image/jpeg"));
            image.setUsageStatus(CatalogImageUsage.PERSISTED);
            preview.put("width", fabric.getWidth()); preview.put("height", fabric.getHeight());
            Map<String,Object> selectedPhotoSet = bindings.boundPhotoSet(image,product);
            Object sourceMetrics = selectedPhotoSet.get("metrics");
            if (frames != null && frames.whole() != null && sourceMetrics instanceof Map<?,?> verifiedMetrics
                    && validPreflight(verifiedMetrics.get("preflight"))) {
                String wholeUrl = put(key + "whole.png", ImageOps.png(frames.whole()), "image/png");
                Map<String, Object> whole = new LinkedHashMap<>(frames.wholeMetadata());
                whole.put("url", wholeUrl); whole.put("rendered", true); whole.put("processed", true);
                preview.put("whole", whole); preview.put("wholeStatus", "READY");
                image.setWholeUrl(wholeUrl); image.setWholeJson(Json.write(whole)); image.setWholeStatus("DONE");
                image.setWholePipelineVersion(CatalogPreviewRenderer.VERSION);
            } else {
                preview.put("wholeStatus", "UNAVAILABLE");
                preview.put("wholeUnavailableReason", frames == null ? "MISSING_SEGMENTATION" : frames.wholeUnavailableReason());
            }
        } else {
            preview.put("wholeStatus", "REFERENCE_ONLY");
        }
        Map<String, Object> assets = image.getAssetsJson() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(Json.map(image.getAssetsJson()));
        // A successful explicit retry may replace a prior DEFAULT-only verdict.
        // Keep it on errors or partial frames; only two persisted masked views qualify.
        if (persist && preview.get("whole") instanceof Map<?, ?> whole && Boolean.TRUE.equals(whole.get("rendered"))
                && assets.get("photoSet") instanceof Map<?, ?> previous && "DEFAULT".equals(previous.get("status")))
            assets.remove("photoSet");
        assets.put("previewFrames", preview); image.setAssetsJson(Json.write(assets));
    }

    Map<String, Object> store(CatalogImage img, BackgroundNormalizer.Rendered r) {
        String base = "catalog/" + img.getProductId() + "/" + img.getId() + "/" + CatalogImagePipeline.VERSION.toLowerCase(Locale.ROOT) + "/";
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("master", put(base + "master.png", ImageOps.png(r.transparent()), "image/png"));
        out.put("white", put(base + "white.jpg", ImageOps.jpeg(r.white(), 0.92f), "image/jpeg"));
        out.put("neutral", put(base + "neutral.jpg", ImageOps.jpeg(r.neutral(), 0.92f), "image/jpeg"));
        out.put("card", put(base + "card.jpg", ImageOps.jpeg(r.card(), 0.9f), "image/jpeg"));
        out.put("thumbnail", put(base + "thumb.jpg", ImageOps.jpeg(r.thumbnail(), 0.85f), "image/jpeg"));
        out.put("width", r.width());
        out.put("height", r.height());
        return out;
    }

    private String put(String key, byte[] body, String type) {
        storage.put(key, body, type);
        return storage.publicUrl(key).toString();
    }
}
