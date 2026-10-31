package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.WardrobeItem;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Regras puras da foto de estúdio (RF4): tipo da peça, dicas (cortes e logo), transparência, versão do feed e fundos. */
final class PieceStudioHints {
    private PieceStudioHints() {
    }

    /** Tipo da peça para o estúdio (manequim invisível só em peças com gola): categoria/subcategoria → slot. */
    static String studioKind(String category, String subcategory) {
        if (category == null) {
            return null;
        }
        return switch (category) {
            case "upper_piece" -> java.util.Set.of("jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono")
                    .contains(subcategory) ? "OUTERWEAR" : "TOP";
            case "lower_piece" -> "BOTTOM";
            case "shoes_piece" -> "SHOES";
            case "full_body_piece" -> "FULL_BODY";
            case "accessory_piece" -> "ACCESSORY";
            default -> null;
        };
    }

    /** Dicas do estúdio a partir do que já foi guardado: lados cortados (Flat Lay) e logo apontado pela IA. */
    static br.com.fashionai.application.imaging.StudioPipeline.Hints studioHints(String category, String subcategory, Object truncatedSides, Object logo) {
        String kind = studioKind(category, subcategory);
        java.util.Set<String> truncated = truncatedSides instanceof List<?> l
                ? l.stream().map(String::valueOf).collect(Collectors.toCollection(java.util.LinkedHashSet::new)) : null;
        double[] box = null;
        if (logo instanceof Map<?, ?> lm && lm.get("box") instanceof List<?> b && b.size() == 4
                && b.stream().allMatch(v -> v instanceof Number)) {
            box = b.stream().mapToDouble(v -> ((Number) v).doubleValue()).toArray();
        }
        return new br.com.fashionai.application.imaging.StudioPipeline.Hints(kind, truncated, box, box == null ? null : "ia",
                br.com.fashionai.application.imaging.FeedFraming.template(category, subcategory, kind), category, subcategory);
    }

    static br.com.fashionai.application.imaging.StudioPipeline.Hints studioHints(WardrobeItem w) {
        Map<String, Object> meta = Json.map(w.getFlatLayMetadataJson());
        Object logo = meta.get("detected") instanceof Map<?, ?> d ? d.get("logo") : null;
        return studioHints(w.getCategory(), w.getSubcategory(), meta.get("truncated_sides"), logo);
    }

    static boolean hasTransparency(BufferedImage img) {
        if (!img.getColorModel().hasAlpha()) {
            return false;
        }
        for (int y = 0; y < img.getHeight(); y += 4) {
            if ((img.getRGB(0, y) >>> 24) < 16 || (img.getRGB(img.getWidth() - 1, y) >>> 24) < 16) {
                return true;
            }
        }
        for (int x = 0; x < img.getWidth(); x += 4) {
            if ((img.getRGB(x, 0) >>> 24) < 16 || (img.getRGB(x, img.getHeight() - 1) >>> 24) < 16) {
                return true;
            }
        }
        return false;
    }

    static boolean currentFeedVersion(WardrobeItem item) {
        Object studio = Json.map(item.getFlatLayMetadataJson()).get("studio");
        if (!(studio instanceof Map<?, ?> st) || !(st.get("feed") instanceof Map<?, ?> feed)) return false;
        return br.com.fashionai.application.imaging.GarmentCrop.VERSION.equals(feed.get("pipelineVersion"));
    }

    /** Fundos de estúdio disponíveis (+ "auto", que escolhe pela cor da peça). */
    static List<Map<String, Object>> backdrops() {
        List<Map<String, Object>> out = new ArrayList<>();
        out.add(Map.of("id", "auto", "label", Msg.t("wardrobe.automatico_contraste_com_a_peca")));
        for (var b : br.com.fashionai.application.imaging.StudioPipeline.BACKDROPS) {
            out.add(Map.of("id", b.id(), "label", b.label(), "hex", b.hex(), "edge", String.format("#%06X", b.edge())));
        }
        return out;
    }
}
