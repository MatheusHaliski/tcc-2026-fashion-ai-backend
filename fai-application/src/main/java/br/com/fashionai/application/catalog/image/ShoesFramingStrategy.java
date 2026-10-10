package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.vision.landmarks.LandmarkDetector;

/**
 * Calçados: cadarço, lingueta e cabedal. Sem cadarço (mocassim, sandália, bota, salto) o registro marca
 * {@code laceless} e o foco é a região equivalente: gáspea, tiras ou cano.
 */
public final class ShoesFramingStrategy implements FramingStrategy {
    @Override
    public PieceType pieceType() {
        return PieceType.SHOES_PIECE;
    }

    @Override
    public Focus focus(NRect product, SemanticRegionRegistry.Profile profile, LandmarkDetector.Result lm) {
        Focus base = FramingStrategy.fromRegistry(product, profile);
        if (profile.laceless()) {
            return base;
        }
        LandmarkDetector.Landmark collar = FramingStrategy.visible(lm, "collar_top"), toe = FramingStrategy.visible(lm, "toe");
        if (collar == null || toe == null || Math.abs(toe.x() - collar.x()) < 0.1 * product.w()) {
            return base;
        }
        // vista lateral: cadarço e lingueta ficam entre a boca (collar_top) e ~60% do caminho até o bico, na parte alta
        double x0 = Math.min(collar.x(), collar.x() + 0.6 * (toe.x() - collar.x()));
        double x1 = Math.max(collar.x(), collar.x() + 0.6 * (toe.x() - collar.x()));
        double y0 = Math.max(product.y(), collar.y() - 0.04 * product.h());
        double y1 = Math.min(product.y2(), product.y() + 0.65 * product.h());
        return new Focus(base.name(), new NRect(x0, y0, x1 - x0, Math.max(0.05 * product.h(), y1 - y0)), base.critical(), "LANDMARKS");
    }
}
