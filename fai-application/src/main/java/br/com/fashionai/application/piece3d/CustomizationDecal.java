package br.com.fashionai.application.piece3d;

import br.com.fashionai.application.common.ApiException;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Logo ou estampa projetado no tecido (mesma forma de {@code DecalEdit} em lib/atelier3d/decals.ts). O documento guarda
 * só os parâmetros e, no máximo, uma imagem pequena enviada pela pessoa (data URL PNG/JPEG/WebP).
 */
public record CustomizationDecal(String node, String target, String image, List<Double> position, List<Double> normal,
                                 Double size, Double aspect, Double rotation, String color, Boolean visible) {
    public static final int MAX_DECALS = 8;
    public static final int MAX_IMAGE_CHARS = 400_000;
    private static final Pattern IMAGE = Pattern.compile("data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+");
    private static final Pattern KEY = Pattern.compile("[A-Za-z0-9_.:-]{1,40}");

    /** Valida o mapa de decalques do documento (nulo vira vazio). */
    public static Map<String, CustomizationDecal> validated(Map<String, CustomizationDecal> decals) {
        if (decals == null) {
            return Map.of();
        }
        if (decals.size() > MAX_DECALS) {
            throw invalid("Logos e estampas demais.");
        }
        for (var e : decals.entrySet()) {
            if (e.getKey() == null || !KEY.matcher(e.getKey()).matches() || e.getValue() == null) {
                throw invalid("Logo inválido.");
            }
            e.getValue().check();
        }
        return decals;
    }

    private void check() {
        if (node == null || !node.matches("n[0-9]{1,5}")) {
            throw invalid("Logo sem peça.");
        }
        if (target != null && !target.matches("n[0-9]{1,5}\\.p[0-9]{1,5}")) {
            throw invalid("Estampa inválida.");
        }
        if (image != null && (image.length() > MAX_IMAGE_CHARS || !IMAGE.matcher(image).matches())) {
            throw invalid("Imagem do logo inválida: use PNG, JPEG ou WebP pequenos.");
        }
        if (image == null && target == null) {
            throw invalid("Logo sem imagem.");
        }
        vector(position, 10_000);
        vector(normal, 10_000);
        range(size, 0.01, 1.5);
        range(aspect, 0.05, 20);
        range(rotation, -100, 100);
        if (color != null && !color.matches("#[0-9a-fA-F]{6}")) {
            throw invalid("Cor inválida.");
        }
    }

    private static void vector(List<Double> values, double bound) {
        if (values == null || values.size() != 3) {
            throw invalid("Vetor com tamanho errado.");
        }
        values.forEach(v -> range(v, -bound, bound));
    }

    private static void range(Double value, double low, double high) {
        if (value == null || !Double.isFinite(value) || value < low || value > high) {
            throw invalid("Número fora do intervalo.");
        }
    }

    private static ApiException invalid(String message) {
        return ApiException.badRequest("CUSTOMIZATION_INVALID", message);
    }
}
