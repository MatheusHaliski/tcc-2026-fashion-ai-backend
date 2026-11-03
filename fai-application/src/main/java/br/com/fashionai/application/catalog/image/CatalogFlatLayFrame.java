package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogImage;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Total frame a partir do flat lay da Fase 2 (services/garment_gpu, GPU própria no RunPod), aprovado por uma pessoa e
 * gravado por scripts/catalog/apply_flat_lays.py (V85). É reconstrução por IA, não pixels fotografados: sai com
 * {@code aiGenerated=true} para a interface mostrar o selo, e só enquanto a foto do catálogo de onde ele veio for a
 * mesma (id, URL original e SHA-256). Sem flat lay válido, vale a Peça inteira real (processedWhole).
 */
final class CatalogFlatLayFrame {
    static final String VERSION = "FLAT_LAY_V1";
    static final String APPROVED = "APPROVED";

    private CatalogFlatLayFrame() {
    }

    /** O flat lay aprovado ou, sem ele (ou desatualizado), o Total frame de pixels reais recebido. */
    static Map<String, Object> orElse(CatalogImage image, Map<String, Object> fallback) {
        Map<String, Object> flatLay = of(image);
        return flatLay != null ? flatLay : fallback;
    }

    static Map<String, Object> of(CatalogImage image) {
        if (image == null || !APPROVED.equals(image.getFlatLayStatus()) || !webUrl(image.getFlatLayUrl())
                || image.getFlatLayJson() == null) {
            return null;
        }
        Map<String, Object> info = Json.map(image.getFlatLayJson());   // JSON inválido vira mapa vazio: sem versão
        if (!current(image, info)) {
            return null;
        }
        Map<String, Object> frame = new LinkedHashMap<>();
        frame.put("url", image.getFlatLayUrl());
        frame.put("box", Map.of("x", 0.0, "y", 0.0, "w", 1.0, "h", 1.0));   // já renderizado no quadro 3:4
        frame.put("background", info.getOrDefault("background", "#FFFFFF"));
        frame.put("width", info.getOrDefault("width", 900));
        frame.put("height", info.getOrDefault("height", 1200));
        frame.put("truncated", List.of());
        frame.put("alpha", false);
        frame.put("processed", true);
        frame.put("rendered", true);
        frame.put("aiGenerated", true);
        if (webUrl(image.getFlatLayBackUrl())) {
            frame.put("backUrl", image.getFlatLayBackUrl());
        }
        frame.put("version", VERSION);
        return frame;
    }

    /** Gerado desta mesma linha e desta mesma foto: troca de foto ou nova análise da origem invalida o flat lay. */
    private static boolean current(CatalogImage image, Map<String, Object> info) {
        if (!VERSION.equals(info.get("version")) || image.getId() == null
                || !image.getId().toString().equals(Objects.toString(info.get("imageId"), null))
                || !Objects.equals(image.getImageUrl(), info.get("originalUrl"))) {
            return false;
        }
        Object sha = info.get("sourceSha256");
        return sha == null || image.getSourceSha256() == null || sha.equals(image.getSourceSha256());
    }

    private static boolean webUrl(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(value);
            return Set.of("https", "http").contains(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (IllegalArgumentException invalid) {
            return false;
        }
    }
}
