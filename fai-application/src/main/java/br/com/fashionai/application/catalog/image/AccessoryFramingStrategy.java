package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.vision.landmarks.LandmarkDetector;

/** Acessórios: o objeto inteiro e o detalhe-assinatura (mostrador do relógio, fecho da bolsa, fivela, ponte dos óculos). */
public final class AccessoryFramingStrategy implements FramingStrategy {
    @Override
    public PieceType pieceType() {
        return PieceType.ACCESSORY_PIECE;
    }

    @Override
    public Focus focus(NRect product, SemanticRegionRegistry.Profile profile, LandmarkDetector.Result lm) {
        Focus base = FramingStrategy.fromRegistry(product, profile);
        LandmarkDetector.Landmark dial = FramingStrategy.visible(lm, "dial_center");
        if (dial == null) {
            dial = FramingStrategy.visible(lm, "bridge_center");
        }
        if (dial == null) {
            return base;
        }
        NRect r = base.rect();
        double x = Math.max(product.x(), Math.min(product.x2() - r.w(), dial.x() - r.w() / 2));
        double y = Math.max(product.y(), Math.min(product.y2() - r.h(), dial.y() - r.h() / 2));
        return new Focus(base.name(), new NRect(x, y, r.w(), r.h()), base.critical(), "LANDMARKS");
    }
}
