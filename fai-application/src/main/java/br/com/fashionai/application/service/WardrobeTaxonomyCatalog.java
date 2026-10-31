package br.com.fashionai.application.service;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.taxonomy.TaxonomyRegistry;
import br.com.fashionai.domain.repository.BrandRepository;

import java.util.LinkedHashMap;
import java.util.Map;

/** Vocabulário do formulário da peça: taxonomia, imagens padrão por tipo/subtipo, marcas e a taxonomia estendida. */
final class WardrobeTaxonomyCatalog {
    private WardrobeTaxonomyCatalog() {
    }

    static Map<String, Object> build(AssetCatalogService assets, BrandRepository brands) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("subcategories", Taxonomy.SUBCATEGORIES);
        out.put("colors", Taxonomy.COLORS);
        out.put("colorFamilies", Taxonomy.COLOR_FAMILY);
        out.put("materials", Taxonomy.MATERIALS);
        out.put("sizes", Taxonomy.SIZES);
        out.put("sexes", Taxonomy.SEXES);
        out.put("occasions", Taxonomy.OCCASIONS);
        out.put("styles", Taxonomy.STYLES);
        out.put("marketSeasons", Taxonomy.MARKET_SEASONS);
        out.put("marketGenders", Taxonomy.MARKET_GENDERS);
        Map<String, Object> allowed = new LinkedHashMap<>();
        Taxonomy.SUBCATEGORIES.keySet().forEach(c -> allowed.put(c, Taxonomy.allowedOccasions(c)));
        out.put("allowedOccasionsByCategory", allowed);
        out.put("wearstylesByPart", Taxonomy.WEARSTYLES_BY_PART);
        out.put("wearstyleGroups", Taxonomy.WEARSTYLE_GROUPS);
        // selos nunca são rótulos padronizados: vêm da análise da IA (marca/celebridade com peça semelhante — SealService)
        Map<String, String> defaults = new LinkedHashMap<>();
        defaults.put("generic", assets.defaultPieceImage(null, null));
        Taxonomy.SUBCATEGORIES.keySet().forEach(c -> defaults.put(c, assets.defaultPieceImage(c, null)));
        out.put("defaultImages", defaults);
        // imagem-asset de cada subtipo: a prévia do card troca a imagem ao escolher a subcategoria (peça ainda sem foto)
        Map<String, String> bySub = new LinkedHashMap<>();
        Taxonomy.SUBCATEGORIES.forEach((c, subs) -> subs.forEach(sub -> bySub.putIfAbsent(sub, assets.defaultPieceImage(c, sub))));
        out.put("defaultImagesBySubcategory", bySub);
        TaxonomyRegistry.get().legacySubcategories()
                .forEach(l -> bySub.putIfAbsent(l.code(), assets.defaultPieceImage(l.category(), l.code())));
        out.put("brands", brands.findAllByOrderByName().stream().map(b -> Map.of("id", b.getId(), "name", b.getName(),
                "slug", b.getSlug(), "logoUrl", String.valueOf(b.getLogoUrl()))).toList());
        out.putAll(br.com.fashionai.application.taxonomy.TaxonomyView.extended());
        return out;
    }
}
