package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.BrandRegions;
import br.com.fashionai.application.imaging.GarmentCrop;
import br.com.fashionai.application.imaging.ImageOps;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Geometria do recorte do pipeline (puro): foco do cós em peça de baixo, recorte só de tecido (GARMENT_COVER),
 * centróide da máscara e logo dentro do recorte.
 */
final class CatalogCropGeometry {
    private CatalogCropGeometry() {
    }

    /** Peça de baixo: o foco vai do cós ao gancho dentro da região da peça (máscara ou cintura estimada da pessoa). */
    static FramingStrategy.Focus waistFocus(ProductSegmenter.Segmentation seg, SemanticRegionRegistry.Profile profile,
                                            GarmentCrop.LowerRegion lower) {
        ImageOps.Box region = lower.box();
        NRect waist = new NRect(region.x() / (double) seg.width(), region.y() / (double) seg.height(),
                region.w() / (double) seg.width(), region.h() / (double) seg.height());
        return new FramingStrategy.Focus(profile.focus().name(), waist.sub(new NRect(0, 0, 1, 0.50)),
                List.of(new SemanticRegionRegistry.Region("waistband", waist.sub(new NRect(0.05, 0, 0.9, 0.12)))),
                lower.estimatedPerson() ? "ESTIMATED_PERSON_WAIST" : "WAIST_TO_CROTCH_MASK");
    }

    static SemanticCropper.Result fabricCover(ProductSegmenter.Segmentation seg, BufferedImage product,
                                              SemanticCropper.Result prior, FramingStrategy.Focus focus, ImageOps.Box region, boolean lower) {
        var found = GarmentCrop.find(product, lower ? 2 : 4, lower ? 1 : 5, focus.rect().cx() * seg.width(), lower ? region.y() + Math.min(region.h(), region.w() / 2.0) * 0.32 : focus.rect().cy() * seg.height(), region);
        Map<String, Object> compliance = new LinkedHashMap<>(prior.compliance());
        compliance.put("mode", "GARMENT_COVER");
        compliance.put("pipelineVersion", GarmentCrop.VERSION);
        if (found.isEmpty()) {
            compliance.put("foregroundOnly", false);
            compliance.put("ok", false);
            return new SemanticCropper.Result(prior.best(), prior.detail(), prior.analysis(), prior.candidates(), prior.rule(), compliance);
        }
        ImageOps.Box box = found.get();
        NRect crop = new NRect(box.x() / (double) seg.width(), box.y() / (double) seg.height(),
                box.w() / (double) seg.width(), box.h() / (double) seg.height());
        double fx = (focus.rect().cx() - crop.x()) / crop.w(), fy = (focus.rect().cy() - crop.y()) / crop.h();
        boolean focused = fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1;
        double critical = focus.critical().stream().mapToDouble(r -> r.rect().insideOf(crop)).max().orElse(1);
        Map<String, Double> parts = new LinkedHashMap<>(prior.best().parts());
        parts.put("completeness", 1.0); // the whole-piece analysis ROI and source are retained separately
        parts.put("critical", critical);
        parts.put("focus", focused ? 1.0 : focus.rect().insideOf(crop));
        parts.put("occupancy", 1.0);
        parts.put("margin", 1.0);
        parts.put("padding", 1.0);
        parts.put("foregroundCoverage", 1.0);
        compliance.put("aspect", lower ? "2:1" : "4:5");
        compliance.put("foregroundOnly", true);
        compliance.put("foregroundCoverage", 1.0);
        compliance.put("frameFilledByProduct", 1.0);
        compliance.put("widthFilledByProduct", 1.0);
        compliance.put("productInsideFrame", NRect.r4(seg.productBox().insideOf(crop)));
        compliance.put("focusCenter", Map.of("x", NRect.r4(fx), "y", NRect.r4(fy)));
        compliance.put("focusInTopHalf", focused && fy <= 0.5);
        compliance.put("ok", focused && (prior.rule() == null || !prior.rule().focusTopHalf() || fy <= 0.5));
        double score = 0.7 + 0.2 * parts.get("focus") + 0.1 * parts.get("distractor");
        var candidate = new SemanticCropper.Candidate(crop, score, 1, 0, parts);
        List<SemanticCropper.Candidate> candidates = new ArrayList<>();
        candidates.add(candidate); candidates.addAll(prior.candidates());
        return new SemanticCropper.Result(candidate, prior.detail(), prior.analysis(), List.copyOf(candidates), prior.rule(), compliance);
    }

    static Boolean logoInside(BufferedImage product, NRect crop) {
        try {
            double[] box = BrandRegions.detectLogo(product);
            return box == null ? null : NRect.of(box).insideOf(crop) >= 0.9;
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** visualCenter: centróide da máscara (peso real da peça, não o meio da caixa — manga aberta não puxa o centro). */
    static NRect centroid(ProductSegmenter.Segmentation seg) {
        double sx = 0, sy = 0;
        long n = 0;
        boolean[] m = seg.mask();
        for (int i = 0; i < m.length; i += 2) {
            if (m[i]) {
                sx += i % seg.width();
                sy += i / seg.width();
                n++;
            }
        }
        return n == 0 ? seg.productBox() : new NRect(sx / n / seg.width(), sy / n / seg.height(), 0, 0);
    }
}
