package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.catalog.image.CatalogImagePipelineService.WHOLE_PROCESSED_VERSION;

/**
 * Provas gravadas numa linha de catalog_images, sem baixar nada: photo set ligado à fonte (versão, URL, SHA-256,
 * categoria, variante, cor), preflight medido, Peça inteira processada e elegibilidade para a Prova com IA.
 */
final class CatalogPhotoEvidence {
    private CatalogPhotoEvidence() {
    }

    @SuppressWarnings("unchecked")
    static Map<String,Object> photoSet(CatalogImage image, CatalogProduct product,List<CatalogVariant> productVariants) {
        if(image==null || product==null || !Objects.equals(image.getProductId(),product.getId()) || image.getAssetsJson()==null || image.getUsageStatus()==CatalogImageUsage.REJECTED || "REJECTED".equals(image.getReviewStatus())) return Map.of();
        if(!CatalogImageIdentity.matches(image,product,null,productVariants)) return Map.of();
        Object raw=Json.map(image.getAssetsJson()).get("photoSet");
        if(!(raw instanceof Map<?,?> m) || !"CATALOG_PHOTO_SET_V2".equals(m.get("version"))
          || !Objects.equals(image.getImageUrl(),m.get("sourceUrl")) || !Objects.equals(image.getSourceSha256(),m.get("sourceSha256"))
          || !Objects.equals(product.getCategory(),m.get("category")) || !Objects.equals(product.getSubcategory(),m.get("subcategory"))
          || !sameId(image.getVariantId(),m.get("variantId")) || m.containsKey("imageId")&&!sameId(image.getId(),m.get("imageId"))
          || !Objects.equals(contextColor(product,image,productVariants),m.get("color"))
          || !(m.get("defaultAssetUrl") instanceof String url) || !url.startsWith("/api/catalog/default-asset?")) return Map.of();
        if("READY".equals(m.get("status")) && (!validSha256(image.getSourceSha256())
                || !derivativeUrl(m.get("wholeUrl"), image.getImageUrl()) || !derivativeUrl(m.get("fabricUrl"), image.getImageUrl())
                || Objects.equals(m.get("wholeUrl"),m.get("fabricUrl"))
                || !(m.get("metrics") instanceof Map<?,?> metrics) || !validPreflight(metrics.get("preflight")))) return Map.of();
        return (Map<String,Object>)m;
    }

    static String contextColor(CatalogProduct product,CatalogImage image,List<CatalogVariant> productVariants) {
        if (product!=null&&image!=null&&image.getVariantId()!=null) {
            String color=productVariants.stream().filter(v->Objects.equals(v.getProductId(),product.getId())
                    &&Objects.equals(v.getId(),image.getVariantId())).map(CatalogVariant::getColor)
                    .filter(Objects::nonNull).findFirst().orElse(null);
            if(color!=null) return color;
        }
        return product==null?null:product.getColor();
    }

    static boolean validSha256(String value) { return value != null && value.matches("[0-9a-f]{64}"); }
    private static boolean sameId(UUID expected,Object actual) {
        return expected==null?actual==null:expected.toString().equals(Objects.toString(actual,null));
    }
    private static boolean derivativeUrl(Object raw, String sourceUrl) {
        if (!(raw instanceof String value) || value.isBlank() || Objects.equals(value,sourceUrl)) return false;
        try {
            URI uri=URI.create(value);
            return Set.of("https","http").contains(uri.getScheme()) && uri.getHost()!=null && uri.getUserInfo()==null;
        } catch (IllegalArgumentException ex) { return false; }
    }

    /** Total frame requires a source-bound derivative with measured, complete semantic isolation. */
    static Map<String, Object> wholeFrame(CatalogImage canonical) {
        // Legacy studio/background/skin heuristics cannot prove semantic isolation.
        // Only a derivative with current source-bound preflight evidence is exposed.
        return processedWhole(canonical);
    }

    static boolean validPreflight(Object raw) {
        if (!(raw instanceof Map<?, ?> evidence)) return false;
        double height = number(evidence.get("sourceGarmentHeightFraction"));
        return "CATALOG_SOURCE_PREFLIGHT_V1".equals(evidence.get("version"))
                && "PASS".equals(evidence.get("status"))
                && Boolean.TRUE.equals(evidence.get("measurementReliable"))
                && Boolean.TRUE.equals(evidence.get("complete")) && Boolean.FALSE.equals(evidence.get("occluded"))
                && Boolean.TRUE.equals(evidence.get("isolationVerified"))
                && Boolean.TRUE.equals(evidence.get("humanAssessmentComplete"))
                && Double.isFinite(height) && height >= .25 && height <= 1;
    }

    /**
     * Peça inteira processada: o JPEG 900×1200 com a peça recortada (sem pessoa, sem fundo da marca) e a caixa dela no
     * quadro. Vale também para foto com modelo — é a peça isolada, não a foto original. null sem o processamento.
     */
    static Map<String, Object> processedWhole(CatalogImage canonical) {
        if (canonical == null || canonical.getWholeUrl() == null || canonical.getWholeUrl().isBlank()
                || !"DONE".equals(canonical.getWholeStatus()) || canonical.getWholeJson() == null) return null;
        Map<String, Object> info = Json.map(canonical.getWholeJson());
        if (!WHOLE_PROCESSED_VERSION.equals(canonical.getWholePipelineVersion())
                || !WHOLE_PROCESSED_VERSION.equals(info.get("version"))
                || !Objects.equals(canonical.getImageUrl(),info.get("sourceUrl"))
                || !validSha256(canonical.getSourceSha256()) || !Objects.equals(canonical.getSourceSha256(),info.get("sourceSha256"))
                || !sameId(canonical.getVariantId(),info.get("variantId"))
                || info.containsKey("imageId")&&!sameId(canonical.getId(),info.get("imageId"))
                || !derivativeUrl(canonical.getWholeUrl(),canonical.getImageUrl())
                || !validPreflight(info.get("preflight"))) return null;
        if (info.get("truncated") instanceof List<?> sides && !sides.isEmpty()) return null;
        if (!(info.get("box") instanceof Map<?, ?> box)) return null;
        double x = number(box.get("x")), y = number(box.get("y")), w = number(box.get("w")), h = number(box.get("h"));
        if (!(w > 0 && h > 0 && w <= .501 && h <= .501 && Math.abs(Math.max(w,h)-.5) <= .001 && Math.abs(x-(1-w)/2) <= .001 && Math.abs(y-(1-h)/2) <= .001)) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("url", canonical.getWholeUrl());
        m.put("box", Map.of("x", x, "y", y, "w", w, "h", h));
        m.put("background", info.getOrDefault("background", "#F4F5F7"));
        m.put("width", info.getOrDefault("width", 900));
        m.put("height", info.getOrDefault("height", 1200));
        m.put("truncated", info.get("truncated") instanceof List<?> sides ? sides : List.of());
        m.put("alpha", false);
        m.put("processed", true);
        m.put("version", WHOLE_PROCESSED_VERSION);
        return m;
    }

    private static double number(Object value) {
        return value instanceof Number n ? n.doubleValue() : Double.NaN;
    }

    /**
     * Foto do catálogo que pode ir à GPU na Prova com IA: a canônica aprovada e gravada com autorização da fonte (nunca a
     * cópia forçada pelo responsável) e comprovadamente sem pessoa — sem modelo vestindo e com a evidência de pele medida
     * abaixo do limite. Sem essa medição, fica de fora: foto de marca com gente não vai à GPU.
     */
    static boolean vtonGarment(CatalogImage image) {
        if (image == null || !image.isCanonical() || !"APPROVED".equals(image.getProcessingStatus())
                || image.getUsageStatus() != CatalogImageUsage.PERSISTED || image.getStoredUrl() == null) return false;
        Map<String, Object> assets = image.getAssetsJson() == null ? Map.of() : Json.map(image.getAssetsJson());
        if (assets.get("persistenceDecision") instanceof Map<?, ?> decision && "FORCED_CATEGORY_FRAME".equals(decision.get("mode"))) return false;
        Map<String, Object> metrics = image.getMetricsJson() == null ? Map.of() : Json.map(image.getMetricsJson());
        Map<?, ?> debug = metrics.get("debug") instanceof Map<?, ?> d ? d : Map.of();
        Map<?, ?> productFrame = debug.get("productFrame") instanceof Map<?, ?> f ? f : Map.of();
        if (Boolean.TRUE.equals(productFrame.get("model"))) return false;
        return debug.get("sourceHumanEvidence") instanceof Number human && human.doubleValue() < ProductRuleFrame.MIN_PERSON_SKIN;
    }
}
