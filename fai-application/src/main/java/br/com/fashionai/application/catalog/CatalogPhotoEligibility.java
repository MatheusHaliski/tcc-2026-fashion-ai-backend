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
        return raw instanceof Map<?, ?> evidence && "INELIGIBLE".equals(evidence.get("state"));
    }
}
