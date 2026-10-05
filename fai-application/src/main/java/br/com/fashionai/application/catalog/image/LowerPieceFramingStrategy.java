package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.vision.landmarks.LandmarkDetector;

/** Calças, shorts e saias: cós, bolsos frontais (jeans: bolso relógio) e costuras superiores. */
public final class LowerPieceFramingStrategy implements FramingStrategy {
    @Override
    public PieceType pieceType() {
        return PieceType.LOWER_PIECE;
    }

    @Override
    public Focus focus(NRect product, SemanticRegionRegistry.Profile profile, LandmarkDetector.Result lm) {
        Focus base = FramingStrategy.fromRegistry(product, profile);
        LandmarkDetector.Landmark waist = FramingStrategy.visible(lm, "waistband_center");
        if (waist == null) {
            return base;
        }
        NRect rect = FramingStrategy.anchorTop(base.rect(), product, waist.x(), waist.y() - 0.02 * product.h());
        return new Focus(base.name(), rect, base.critical(), "LANDMARKS");
    }
}
