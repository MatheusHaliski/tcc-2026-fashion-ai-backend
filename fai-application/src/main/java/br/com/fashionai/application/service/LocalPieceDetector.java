package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.imaging.LocalPieceRegions;
import br.com.fashionai.application.imaging.WornPieceRegions;
import br.com.fashionai.application.moderation.ImageSafetyPorts;
import br.com.fashionai.application.service.MultiPieceService.Box;
import br.com.fashionai.application.service.MultiPieceService.DetectedPiece;
import br.com.fashionai.application.service.MultiPieceService.LocalDetection;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.List;

/**
 * RF4 · detecção de peças sem IA remota (extraída de {@link MultiPieceService}): com uma pessoa na foto, o segmentador
 * local separa a roupa vestida por lugar do corpo (boné, peça de cima, de baixo, calçado); sem pessoa, as regiões de
 * superfície ({@link LocalPieceRegions}, que devolve UMA região para uma peça só). A cor vem dos pixels da própria peça.
 * O que não se mede não é sugerido: a peça de superfície sai sem tipo, subtipo e nome, para a pessoa escolher.
 */
final class LocalPieceDetector {
    private LocalPieceDetector() {
    }

    /** Peça de baixo que termina acima disto (fração da altura da pessoa, do topo da cabeça à sola) é bermuda/short. */
    static final double SHORTS_BOTTOM_FRAC = 0.80;

    static LocalDetection detect(BufferedImage photo, List<ImageSafetyPorts.PersonSegmentationPort> segmenters) {
        List<WornPieceRegions.Worn> worn = segmenters.stream().filter(ImageSafetyPorts.PersonSegmentationPort::available)
                .findFirst().flatMap(s -> s.classes(photo)).map(m -> WornPieceRegions.detect(photo, m)).orElse(List.of());
        if (!worn.isEmpty()) {
            List<DetectedPiece> pieces = new ArrayList<>();
            for (WornPieceRegions.Worn r : worn) {
                String category = switch (r.kind()) {
                    case HEADWEAR -> "accessory_piece";
                    case UPPER -> "upper_piece";
                    case LOWER -> "lower_piece";
                    case FULL -> "full_body_piece";
                    case SHOES -> "shoes_piece";
                };
                String sub = switch (r.kind()) {
                    case HEADWEAR -> "cap";
                    case UPPER -> "t_shirt";
                    case LOWER -> r.bottomFrac() < SHORTS_BOTTOM_FRAC ? "shorts" : "casual_pants";
                    case FULL -> "dress";
                    case SHOES -> "casual_sneakers";
                };
                if (!Taxonomy.SUBCATEGORIES.getOrDefault(category, List.of()).contains(sub)) {
                    sub = Taxonomy.SUBCATEGORIES.getOrDefault(category, List.of()).stream().findFirst().orElse(null);
                }
                pieces.add(new DetectedPiece(pieces.size(), null, category, sub, ColorMath.nearestTaxonomyColor(r.rgb()), null, null,
                        List.of(), List.of(), new Box(r.x(), r.y(), r.width(), r.height()), 0.6));
            }
            return new LocalDetection(List.copyOf(pieces), "local-pessoa");
        }
        List<DetectedPiece> surface = surfacePieces(photo);
        return new LocalDetection(surface, surface.size() == 1 && surface.get(0).box().width() == 100 ? "local" : "local-superficie");
    }

    static List<DetectedPiece> surfacePieces(BufferedImage photo) {
        List<LocalPieceRegions.Region> regions = LocalPieceRegions.detect(photo);
        if (regions.isEmpty()) {
            return List.of(MultiPieceService.localPiece());
        }
        List<DetectedPiece> pieces = new ArrayList<>();
        for (LocalPieceRegions.Region region : regions) {
            pieces.add(new DetectedPiece(pieces.size(), null, null, null, ColorMath.nearestTaxonomyColor(region.rgb()), null, null, List.of(), List.of(),
                    new Box(region.x(), region.y(), region.width(), region.height()), 0.45));
        }
        return List.copyOf(pieces);
    }
}
