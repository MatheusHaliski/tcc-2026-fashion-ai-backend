package br.com.fashionai.application.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Os mesmos casos de dedup-cases.json rodam no pipeline Python (scripts/catalog/tests): Java e Python geram a mesma chave. */
class DedupParityTest {
    @Test
    void chavesIguaisAsDoPipelinePython() throws Exception {
        JsonNode cases = new ObjectMapper().readTree(getClass().getResourceAsStream("/catalog/dedup-cases.json"));
        CatalogNormalizer n = CatalogNormalizer.get();
        for (JsonNode c : cases) {
            String key = n.dedupKey(c.path("brand").asText(), c.path("subcategory").asText(), t(c, "gtin"), null, null, t(c, "sku"),
                    t(c, "product_code"), c.hasNonNull("url") ? CatalogNormalizer.canonicalUrl(c.get("url").asText()) : null,
                    t(c, "model"), t(c, "variant"), t(c, "title"), t(c, "color"));
            assertThat(key).as(c.toString()).isEqualTo(c.get("expected").asText());
        }
    }

    private static String t(JsonNode c, String f) {
        return c.hasNonNull(f) ? c.get(f).asText() : null;
    }
}
