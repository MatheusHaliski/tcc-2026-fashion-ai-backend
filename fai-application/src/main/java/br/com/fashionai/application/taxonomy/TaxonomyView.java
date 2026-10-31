package br.com.fashionai.application.taxonomy;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Assembles the extended public taxonomy response without persistence or wardrobe mutations. */
public final class TaxonomyView {
    private TaxonomyView() { }

    public static Map<String, Object> extended() {
        TaxonomyRegistry reg = TaxonomyRegistry.get();
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> bySub = new LinkedHashMap<>();
        Taxonomy.SUBCATEGORIES.values().forEach(subs -> subs.forEach(sub -> bySub.put(sub, reg.variationsOf(sub).stream()
                .map(l -> Map.of("code", l.code(), "tier", l.tier(), "priority", l.priority())).toList())));
        out.put("variationsBySubcategory", bySub);
        Map<String, Object> variations = new LinkedHashMap<>();
        reg.variations().forEach((code, v) -> variations.put(code, Map.of("labels", v.labels(), "description", v.description())));
        out.put("variations", variations);
        out.put("dimensions", reg.dimensions().stream().map(d -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", d.code());
            m.put("labels", d.labels());
            m.put("multiValued", d.multiValued());
            m.put("maxPerPiece", d.maxPerPiece());
            m.put("maxPerScheme", d.maxPerScheme());
            m.put("attribute", d.attribute() && !Taxonomy.FIELD_DIMENSIONS.contains(d.code()));
            m.put("appliesTo", d.appliesTo());
            m.put("values", d.values().stream().filter(v -> !v.legacy()).map(v -> {
                Map<String, Object> x = new LinkedHashMap<>();
                x.put("code", v.code());
                x.put("labels", v.labels());
                x.put("tier", v.tier());
                x.put("priority", v.priority());
                if (v.group() != null) {
                    x.put("group", v.group());
                }
                if (!v.appliesTo().isEmpty()) {
                    x.put("appliesTo", v.appliesTo());
                }
                return x;
            }).toList());
            return m;
        }).toList());
        Map<String, Object> legacy = new LinkedHashMap<>();
        reg.legacySubcategories().forEach(l -> legacy.put(l.code(), Map.of("category", l.category(), "replacedBy", l.replacedBy(),
                "implies", l.implies(), "labels", l.labels())));
        out.put("legacySubcategories", legacy);
        Map<String, Object> subLabels = new LinkedHashMap<>();
        Taxonomy.SUBCATEGORIES.values().forEach(subs -> subs.forEach(sub -> reg.subcategory(sub).ifPresent(x -> subLabels.put(sub, x.labels()))));
        out.put("subcategoryLabels", subLabels);
        return out;
    }
}
