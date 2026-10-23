package br.com.fashionai.application.catalog;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class CatalogPhotoEligibilityTest {
    @Test
    void legacyAndUncertainProductsStayVisibleWithoutAProductExclusion() {
        CatalogProduct product = new CatalogProduct();
        product.setIngestionStatus(CatalogIngestionStatus.VALIDATED);
        assertThat(CatalogPhotoEligibility.excluded(product)).isFalse();
        for (String state : new String[]{"UNKNOWN", "REVIEW", "RETRY", "PASS"}) {
            product.setMetadataJson(Json.write(Map.of("catalogPhotoEligibility", Map.of("state", state))));
            assertThat(CatalogPhotoEligibility.excluded(product)).as(state).isFalse();
        }
    }

    @Test
    void explicitProductExclusionAndRejectedIngestionCannotBeReadded() {
        CatalogProduct product = new CatalogProduct();
        product.setIngestionStatus(CatalogIngestionStatus.VALIDATED);
        product.setMetadataJson(Json.write(Map.of("catalogPhotoEligibility", Map.of("state", "INELIGIBLE",
                "version", "CATALOG_UNSAFE_QUARANTINE_V2", "reason", "SOURCE_GARMENT_BELOW_MIN_HEIGHT"))));
        assertThat(CatalogPhotoEligibility.excluded(product)).isTrue();
        product.setMetadataJson(null); product.setIngestionStatus(CatalogIngestionStatus.REJECTED);
        assertThat(CatalogPhotoEligibility.excluded(product)).isTrue();
    }
}
