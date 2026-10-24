package br.com.fashionai.application.catalog;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import java.util.Map;

/** Only an audited product exclusion hides a legacy product; absent measurements stay unknown. */
public final class CatalogPhotoEligibility {
    private CatalogPhotoEligibility() { }

    public static boolean excluded(CatalogProduct product) {
        if (product == null || product.getIngestionStatus() == CatalogIngestionStatus.REJECTED) return true;
        Object raw = Json.map(product.getMetadataJson()).get("catalogPhotoEligibility");
        return raw instanceof Map<?, ?> evidence && "INELIGIBLE".equals(evidence.get("state"))
                && "CATALOG_UNSAFE_QUARANTINE_V2".equals(evidence.get("version"))
                && "CATALOG_SOURCE_PREFLIGHT_V1".equals(evidence.get("algorithmVersion"))
                && "SOURCE_GARMENT_BELOW_MIN_HEIGHT".equals(evidence.get("reason"))
                && digest(evidence.get("reportSha256")) && digest(evidence.get("evidenceSha256"));
    }

    private static boolean digest(Object value) { return value instanceof String hash && hash.matches("[0-9a-f]{64}"); }
}
