package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonParts;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonSegmentationPort;

import java.awt.image.BufferedImage;
import java.util.Optional;

/**
 * Evidência de pessoa no pipeline: pele estranha à peça (segmentador próprio) combinada com o segmentador de pessoa,
 * quando existe, na foto inteira, no recorte e nos quadros só de tecido e da regra do produto.
 */
final class CatalogPersonEvidence {
    private final PersonSegmentationPort persons;

    CatalogPersonEvidence(PersonSegmentationPort persons) {
        this.persons = persons;
    }

    /** Pele estranha à peça (segmentador próprio) combinada com o segmentador de pessoa, quando disponível. */
    double humanEvidence(BufferedImage src, ProductSegmenter.Segmentation seg) {
        double evidence = seg.foreignSkin();
        if (persons != null && persons.available()) {
            try {
                Optional<PersonParts> parts = persons.segment(src);
                if (parts.isPresent()) {
                    double skin = parts.get().person() * (parts.get().bodySkin() + parts.get().faceSkin());
                    evidence = Math.max(evidence, skin / Math.max(0.05, seg.coverage()));
                }
            } catch (RuntimeException ignored) {
                // segmentador indisponível não derruba o pipeline: fica a evidência local
            }
        }
        return Math.min(1, evidence);
    }

    double cropHumanEvidence(BufferedImage selected) {
        int[] pixels = selected.getRGB(0, 0, selected.getWidth(), selected.getHeight(), null, 0, selected.getWidth());
        boolean[] opaque = new boolean[pixels.length];
        java.util.Arrays.fill(opaque, true);
        double skin = ProductSegmenter.foreignSkin(pixels, opaque);
        if (persons != null && persons.available()) {
            try {
                Optional<PersonParts> parts = persons.segment(selected);
                if (parts.isPresent()) skin = Math.max(skin, parts.get().person() * (parts.get().bodySkin() + parts.get().faceSkin()));
            } catch (RuntimeException ignored) { /* local evidence remains available */ }
        }
        // This crop promises fabric only: residual hands/skin require review even when they occupy a small region.
        return skin > 0.005 ? Math.max(0.06, skin) : 0;
    }

    /** Quadro só de tecido aprovado pela máscara, mas com pessoa vista pelo segmentador: recusado (HUMAN_IN_FABRIC_FRAME). */
    FabricFrame.Result checkFabric(ProductSegmenter.Segmentation seg, FabricFrame.Result fabric) {
        if (fabric.ok()) {
            NRect fc = fabric.crop();
            BufferedImage selected = ImageOps.crop(seg.cutout(), new ImageOps.Box((int) Math.round(fc.x() * seg.width()), (int) Math.round(fc.y() * seg.height()),
                    (int) Math.round(fc.w() * seg.width()), (int) Math.round(fc.h() * seg.height())));
            if (fabricHumanEvidence(selected)) {
                fabric = new FabricFrame.Result(false, "HUMAN_IN_FABRIC_FRAME", fc, fabric.target(), fabric.anchorSource(), fabric.anchorX(),
                        fabric.anchorY(), fabric.region(), fabric.fabricCoverage(), fabric.skinExcluded(), fabric.cropWidthPx(), fabric.erosionPx());
            }
        }
        return fabric;
    }

    /**
     * Segunda opinião sobre o quadro da regra do produto: com o segmentador de pessoa, pele/rosto no quadro (parte da foto)
     * recusa — numa parte de cima/baixo, o quadro mostraria a pessoa; num objeto, ele não está isolado.
     */
    ProductRuleFrame.Result checkPerson(BufferedImage src, ProductRuleFrame.Result r) {
        if (!r.ok() || persons == null || !persons.available()) return r;
        NRect c = r.crop().clampTo(new NRect(0, 0, 1, 1));
        int x = (int) Math.round(c.x() * src.getWidth()), y = (int) Math.round(c.y() * src.getHeight());
        int cw = Math.min(src.getWidth() - x, (int) Math.round(c.w() * src.getWidth())), ch = Math.min(src.getHeight() - y, (int) Math.round(c.h() * src.getHeight()));
        if (cw < 8 || ch < 8 || !fabricHumanEvidence(ImageOps.crop(src, new ImageOps.Box(x, y, cw, ch)))) return r;
        boolean garment = r.rule() != null && r.rule().fit() == SemanticRegionRegistry.FramingRule.Fit.COVER
                && r.rule().align() == SemanticRegionRegistry.FramingRule.Align.TOP;
        return new ProductRuleFrame.Result(false, garment ? "HUMAN_IN_FRAME" : "PIECE_NOT_ISOLATED", r.crop(), r.aspectW(), r.aspectH(),
                r.rule(), r.ruleOrigin(), r.registryVersion(), r.pieceType(), r.subcategory(), r.target(), r.focusName(), r.focus(),
                r.product(), true, r.skinShare(), r.garmentCoverage(), r.coverageScope(), r.objectInside(), r.padding(), r.background(),
                r.truncated(), r.sideView(), r.compliance(), r.cropWidthPx(), r.observations());
    }

    /**
     * Segunda opinião sobre o quadro só de tecido: o segmentador de pessoa, quando existe, não pode ver pele/rosto no quadro.
     * Sem ele vale a máscara do tecido (que já tirou as manchas de pele); a heurística local de pele daria falso positivo em
     * estampas bege/rosadas.
     */
    private boolean fabricHumanEvidence(BufferedImage selected) {
        if (persons == null || !persons.available()) return false;
        try {
            Optional<PersonParts> parts = persons.segment(selected);
            return parts.isPresent() && parts.get().person() * (parts.get().bodySkin() + parts.get().faceSkin()) > 0.02;
        } catch (RuntimeException e) {
            return false;
        }
    }
}
