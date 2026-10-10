package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.vision.landmarks.LandmarkDetector;

import java.util.List;

/**
 * CATEGORY-AWARE ROI DETECTION: cada piece_type decide onde está o que identifica a peça (semanticFocusRegion) e o que
 * não pode ser cortado. O registro dá a região padrão (relativa à caixa do produto); os landmarks da máscara, quando
 * confiáveis, ajustam a posição (gola de verdade, cós de verdade, cano de verdade).
 */
public interface FramingStrategy {
    record Focus(String name, NRect rect, List<SemanticRegionRegistry.Region> critical, String source) {
    }

    PieceType pieceType();

    Focus focus(NRect product, SemanticRegionRegistry.Profile profile, LandmarkDetector.Result landmarks);

    static FramingStrategy forType(PieceType type) {
        return switch (type) {
            case UPPER_PIECE, FULL_BODY_PIECE -> new UpperPieceFramingStrategy(type);
            case LOWER_PIECE -> new LowerPieceFramingStrategy();
            case SHOES_PIECE -> new ShoesFramingStrategy();
            case ACCESSORY_PIECE -> new AccessoryFramingStrategy();
        };
    }

    /** Região do registro levada para coordenadas da foto (relativa à caixa do produto). */
    static Focus fromRegistry(NRect product, SemanticRegionRegistry.Profile profile) {
        return new Focus(profile.focus().name(), product.sub(profile.focus().rect()), critical(product, profile), "REGISTRY");
    }

    static List<SemanticRegionRegistry.Region> critical(NRect product, SemanticRegionRegistry.Profile profile) {
        return profile.critical().stream().map(r -> new SemanticRegionRegistry.Region(r.name(), product.sub(r.rect()))).toList();
    }

    static LandmarkDetector.Landmark visible(LandmarkDetector.Result lm, String name) {
        if (lm == null) {
            return null;
        }
        LandmarkDetector.Landmark l = lm.get(name);
        return l != null && l.visible() && l.confidence() >= 0.5 ? l : null;
    }

    /** Desloca o retângulo para que o topo e o centro horizontal caiam no ponto dado, sem sair da caixa do produto. */
    static NRect anchorTop(NRect rect, NRect product, double cx, double top) {
        double x = Math.max(product.x(), Math.min(product.x2() - rect.w(), cx - rect.w() / 2));
        double y = Math.max(product.y(), Math.min(product.y2() - rect.h(), top));
        return new NRect(x, y, rect.w(), rect.h());
    }
}
