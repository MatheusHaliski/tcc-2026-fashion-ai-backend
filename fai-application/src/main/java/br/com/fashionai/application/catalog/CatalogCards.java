package br.com.fashionai.application.catalog;

import br.com.fashionai.application.catalog.image.CatalogImageIdentity;
import br.com.fashionai.application.catalog.image.CatalogImagePipelineService;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.TaxonomyAttribute;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Card do produto do catálogo (RF47) como o front recebe: lista, busca e detalhe partem deste mapa. A ordem das chaves é
 * contrato do JSON (CatalogServiceModel3dTest). Extraído do CatalogService sem mudar o resultado; quem acrescenta
 * campos por lista (ex.: {@code model3dUrl}, CatalogProductModels) faz isso depois, numa consulta só.
 */
final class CatalogCards {
    private CatalogCards() {
    }

    static Map<String, Object> card(CatalogProduct p, Brand b, CatalogImage img, List<CatalogVariant> productVariants) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("brand", b == null ? null : Map.of("id", b.getId(), "name", b.getName(), "slug", b.getSlug(),
                "logoUrl", String.valueOf(b.getLogoUrl())));
        // produtos importados antes da limpeza podem trazer marcação HTML da loja no título
        m.put("productName", CatalogIngestService.plainText(p.getProductName()));
        m.put("modelName", CatalogIngestService.plainText(p.getModelName()));
        m.put("category", p.getCategory());
        m.put("subcategory", p.getSubcategory());
        m.put("color", p.getColor());
        m.put("colorName", p.getColorName());
        m.put("colorHex", p.getColor() == null ? null : Taxonomy.hex(p.getColor()));
        m.put("material", p.getMaterial());
        m.put("variation", p.getVariationCode());
        m.put("attributes", TaxonomyAttribute.toMap(p.getAttributes(), java.util.Set.of()));
        m.put("collection", p.getCollection());
        m.put("description", p.getDescription());
        DesignTraits design = CatalogService.designOf(p);
        m.put("design", design.isEmpty() ? null : design.toMap());
        m.put("gender", p.getGender());
        m.put("productCode", p.getProductCode());
        m.put("sku", p.getSku());
        Map<String, Object> catalogImage = CatalogImagePipelineService.cardImage(img, p, productVariants);
        UUID effective = CatalogImageIdentity.effectiveVariantId(img, p, productVariants);
        if (effective != null) {
            if (catalogImage != null) catalogImage.put("variantId", effective);
            productVariants.stream().filter(v -> effective.equals(v.getId())).findFirst().ifPresent(v -> applyVariant(m, v));
        }
        m.put("imageUrl", catalogImage == null ? null : catalogImage.get("url"));
        m.put("imageProcessingStatus", catalogImage != null ? "READY" : img != null && List.of("PENDING", "DOWNLOADING").contains(img.getProcessingStatus()) ? "PENDING" : "ERROR");
        m.put("catalogImage", catalogImage);
        m.put("imageSource", img == null ? null : CatalogIngestService.provenance(img));
        m.put("source", Map.of("type", p.getSourceType().name(), "domain", String.valueOf(p.getSourceDomain()),
                "productUrl", String.valueOf(p.getOfficialProductUrl()), "status", p.getSourceStatus().name(),
                "lastVerifiedAt", String.valueOf(p.getLastVerifiedAt())));
        m.put("ingestionStatus", p.getIngestionStatus().name());
        m.put("ownersCount", p.getOwnersCount());
        return m;
    }

    static Map<String, Object> variantMap(CatalogVariant v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", v.getId());
        m.put("key", v.getVariantKey());
        m.put("color", v.getColor());
        m.put("colorName", v.getColorName());
        m.put("code", v.getVariantCode());
        m.put("sku", v.getSku());
        return m;
    }

    /** A variante escolhida (cor) passa a valer no card: cor, nome da cor e hex. */
    static void applyVariant(Map<String, Object> card, CatalogVariant variant) {
        String color = variant.getColor() == null ? (String) card.get("color") : variant.getColor();
        card.put("selectedVariant", variantMap(variant));
        card.put("color", color);
        if (variant.getColorName() != null) card.put("colorName", variant.getColorName());
        card.put("colorHex", color == null ? null : Taxonomy.hex(color));
    }
}
