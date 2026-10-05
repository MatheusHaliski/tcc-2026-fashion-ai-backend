package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.vision.landmarks.LandmarkDetector;

/** Peças de cima e de corpo inteiro: gola/decote, parte alta do peito, logo e abotoamento. */
public final class UpperPieceFramingStrategy implements FramingStrategy {
    private final PieceType type;

    public UpperPieceFramingStrategy(PieceType type) {
        this.type = type;
    }

    @Override
    public PieceType pieceType() {
        return type;
    }

    @Override
    public Focus focus(NRect product, SemanticRegionRegistry.Profile profile, LandmarkDetector.Result lm) {
        Focus base = FramingStrategy.fromRegistry(product, profile);
        LandmarkDetector.Landmark neck = FramingStrategy.visible(lm, "neckline_center");
        if (neck == null) {
            return base;
        }
        LandmarkDetector.Landmark ls = FramingStrategy.visible(lm, "left_shoulder"), rs = FramingStrategy.visible(lm, "right_shoulder");
        double top = neck.y();
        if (ls != null && rs != null) {
            top = Math.min(top, Math.min(ls.y(), rs.y()));
        }
        NRect rect = FramingStrategy.anchorTop(base.rect(), product, neck.x(), top - 0.02 * product.h());
        return new Focus(base.name(), rect, base.critical(), "LANDMARKS");
    }
}
