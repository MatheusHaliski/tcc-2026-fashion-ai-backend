package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.FlairTier;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Retrato da peça na carta FLAIR do {@link FlairCollectionService}: nível e nota ({@link FlairTier}) com o produto e a
 * marca do catálogo, a prévia mostrada no criador, as tags (requisitos dos Desafios) e o Hype v2 público do verso.
 */
final class FlairCardSnapshot {
    private final CatalogProductRepository catalog;
    private final BrandRepository brands;
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;

    FlairCardSnapshot(CatalogProductRepository catalog, BrandRepository brands, HypeScoreCurrentRepository hypeScores,
                      HypeScoreConfig hypeConfig) {
        this.catalog = catalog;
        this.brands = brands;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
    }

    FlairTier.Result tierOf(WardrobeItem w) {
        CatalogProduct product = w.getCatalogProductId() == null ? null : catalog.findById(w.getCatalogProductId()).orElse(null);
        Brand brand = w.getBrand() != null ? w.getBrand() : product != null ? brands.findById(product.getBrandId()).orElse(null) : null;
        FlairTier.Input in = new FlairTier.Input(w.getCategory(), w.getSubcategory(), w.getPrice() == null ? null : w.getPrice().doubleValue(),
                min(product), max(product), brand == null ? null : brand.getPriceTier(),
                notBlank(w.getBrandName()) || brand != null || w.getBrandProfile() != null, w.getBrandProfile() != null,
                !Json.csv(w.getStyleTags()).isEmpty(), !Json.csv(w.getOccasionTags()).isEmpty(), notBlank(w.getColor()),
                notBlank(w.getMaterial()), w.getStudioImageUrl() != null, w.getModel3dStatus() == Model3dStatus.COMPLETED);
        return FlairTier.compute(in);
    }

    static Map<String, Object> previewOf(FlairTier.Result r, String category) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ovr", r.ovr());
        out.put("tier", r.tier());
        out.put("position", FlairTier.position(category));
        out.put("priceVerified", r.priceVerified());
        out.put("cappedByUnverifiedPrice", r.cappedByUnverifiedPrice());
        out.put("basis", r.basis());
        out.put("season", FlairService.season());
        return out;
    }

    /** Estilos, ocasiões, cor e material da peça (requisitos e sintonia dos Desafios de Montagem, FLAIR-UT §14.5). */
    static Map<String, Object> tagsOf(WardrobeItem w) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("styles", w == null ? List.of() : Json.csv(w.getStyleTags()));
        t.put("occasions", w == null ? List.of() : Json.csv(w.getOccasionTags()));
        t.put("colors", w == null || !notBlank(w.getColor()) ? List.of() : List.of(w.getColor()));
        t.put("materials", w == null || !notBlank(w.getMaterial()) ? List.of() : List.of(w.getMaterial().toLowerCase(java.util.Locale.ROOT)));
        return t;
    }

    /** As 7 dimensões do verso + o score, só do Hype PÚBLICO; sem ele, nada (a carta mostra "—", nunca 0). */
    String hypeSnapshot(UUID pieceId) {
        HypeScoreCurrent h = hypeScores.findByEntityTypeAndEntityIdInAndAlgorithmVersion(HypeEntityType.PIECE, List.of(pieceId),
                hypeConfig.algorithmVersion()).stream().findFirst().orElse(null);
        if (h == null || !h.isPublicEligible() || h.getScore() == null) {
            return null;
        }
        HypeDimensions d = h.getDimensions() == null ? new HypeDimensions() : h.getDimensions();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("POP", num(d.getPopularity()));
        m.put("ENG", num(d.getEngagement()));
        m.put("TRD", num(d.getTrend()));
        m.put("ORI", num(d.getOriginality()));
        m.put("RAR", num(d.getRarity()));
        m.put("LON", num(d.getLongevity()));
        m.put("NOV", num(d.getNovelty()));
        m.put("HYP", num(h.getScore()));
        return Json.write(m);
    }

    static Double min(CatalogProduct p) {
        if (p == null) {
            return null;
        }
        BigDecimal v = p.getPriceMin() != null ? p.getPriceMin() : p.getListPrice();
        return v == null ? null : v.doubleValue();
    }

    static Double max(CatalogProduct p) {
        if (p == null) {
            return null;
        }
        BigDecimal v = p.getPriceMax() != null ? p.getPriceMax() : p.getListPrice();
        return v == null ? null : v.doubleValue();
    }

    static Double num(BigDecimal v) {
        return v == null ? null : Math.round(v.doubleValue() * 10) / 10.0;
    }

    static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
