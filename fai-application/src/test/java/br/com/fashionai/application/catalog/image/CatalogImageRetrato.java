package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogImage;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Supplier;

/**
 * Retrato de caracterização do pipeline de imagens do catálogo (lote R93): pixels por SHA-256, linhas de
 * {@code catalog_images} e análises como JSON estável (instantes → {@code <t>}, tempos de estágio → 0).
 */
final class CatalogImageRetrato {
    private static final Path DIR = Path.of("src/test/resources/catalog/image");

    private final StringBuilder out = new StringBuilder();

    private CatalogImageRetrato() {
    }

    static CatalogImageRetrato start() {
        return new CatalogImageRetrato();
    }

    /** Uma linha do retrato: rótulo e valor em JSON normalizado. */
    CatalogImageRetrato line(String label, Object value) {
        out.append(label).append(" = ").append(normalize(Json.write(canonical(value)))).append('\n');
        return this;
    }

    /**
     * Ordem estável sem depender da JVM: chaves de mapa ordenadas, conjuntos ordenados, e texto JSON (colunas
     * crop/metrics/assets, respostas do protocolo) relido como estrutura — {@code Map.of}/{@code Set.of} iteram numa
     * ordem sorteada a cada JVM.
     */
    static Object canonical(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> sorted = new TreeMap<>();
            map.forEach((k, v) -> sorted.put(String.valueOf(k), canonical(v)));
            return sorted;
        }
        if (value instanceof Set<?> set) {
            List<Object> items = new ArrayList<>(set.stream().map(CatalogImageRetrato::canonical).toList());
            items.sort(Comparator.comparing(Json::write));
            return items;
        }
        if (value instanceof Collection<?> list) {
            return list.stream().map(CatalogImageRetrato::canonical).toList();
        }
        if (value instanceof String s && (s.startsWith("{") || s.startsWith("["))) {
            try {
                return canonical(Json.MAPPER.readValue(s, Object.class));
            } catch (RuntimeException notJson) {
                return s;
            }
        }
        return value;
    }

    /** Resultado de uma chamada ou o erro de negócio que ela lançou (status, código e mensagem). */
    CatalogImageRetrato call(String label, Supplier<?> action) {
        Object value;
        try {
            value = action.get();
        } catch (ApiException e) {
            value = Map.of("error", e.status() + " " + e.code(), "message", String.valueOf(e.getMessage()));
        }
        return line(label, value == null ? "null" : value);
    }

    String text() {
        return out.toString();
    }

    static String normalize(String text) {
        return text.replaceAll("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z", "<t>")
                .replaceAll("\"ms\":\\d+", "\"ms\":0")
                .replaceAll("uma de \\[[A-Z_, ]+]", "uma de <ACTIONS>");
    }

    static String sha(byte[] bytes) {
        return bytes == null ? null : CatalogImagePipeline.sha256(bytes);
    }

    /** Pixels ARGB da imagem: largura×altura e SHA-256 (independe do codificador). */
    static String pixels(BufferedImage image) {
        if (image == null) {
            return null;
        }
        int[] argb = image.getRGB(0, 0, image.getWidth(), image.getHeight(), null, 0, image.getWidth());
        ByteBuffer buffer = ByteBuffer.allocate(argb.length * 4);
        buffer.asIntBuffer().put(argb);
        return image.getWidth() + "x" + image.getHeight() + " " + CatalogImagePipeline.sha256(buffer.array());
    }

    /** Todas as colunas de uma linha de catalog_images que o serviço lê ou grava. */
    static Map<String, Object> row(CatalogImage i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", i.getId());
        m.put("productId", i.getProductId());
        m.put("variantId", i.getVariantId());
        m.put("imageUrl", i.getImageUrl());
        m.put("imageType", i.getImageType());
        m.put("primary", i.isPrimary());
        m.put("usageStatus", i.getUsageStatus());
        m.put("storedUrl", i.getStoredUrl());
        m.put("width", i.getWidth());
        m.put("height", i.getHeight());
        m.put("mime", i.getMime());
        m.put("sourceSha256", i.getSourceSha256());
        m.put("phash", i.getPhash());
        m.put("processingStatus", i.getProcessingStatus());
        m.put("pipelineVersion", i.getPipelineVersion());
        m.put("qualityScore", i.getQualityScore() == null ? null : i.getQualityScore().toPlainString());
        m.put("gateReasons", i.getGateReasons());
        m.put("viewRole", i.getViewRole());
        m.put("canonical", i.isCanonical());
        m.put("reviewStatus", i.getReviewStatus());
        m.put("cropJson", i.getCropJson());
        m.put("metricsJson", i.getMetricsJson());
        m.put("assetsJson", i.getAssetsJson());
        m.put("wholeUrl", i.getWholeUrl());
        m.put("wholeJson", i.getWholeJson());
        m.put("wholeStatus", i.getWholeStatus());
        m.put("wholePipelineVersion", i.getWholePipelineVersion());
        m.put("attempts", i.getAttempts());
        m.put("processedAt", i.getProcessedAt() == null ? null : "<t>");
        return m;
    }

    /** Análise completa: veredito, recorte, métricas, estágios (sem tempo), depuração e pixels gerados. */
    static Map<String, Object> analysis(CatalogImagePipeline.Analysis a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("outcome", a.outcome());
        m.put("reasons", a.reasons());
        m.put("manualReview", a.manualReview());
        m.put("confidence", a.confidence());
        m.put("mime", a.mime());
        m.put("size", a.width() + "x" + a.height());
        m.put("sha256", a.sha256());
        m.put("phash", a.phash());
        m.put("pieceType", a.pieceType());
        m.put("productBox", a.productBox() == null ? null : a.productBox().toMap());
        m.put("focus", a.focus() == null ? null : Map.of("name", a.focus().name(), "rect", a.focus().rect().toMap(),
                "source", a.focus().source(), "critical", a.focus().critical().stream()
                        .map(r -> Map.of("name", r.name(), "rect", r.rect().toMap())).toList()));
        m.put("cropJson", a.cropJson());
        m.put("metrics", a.metrics());
        m.put("qualityScore", a.qualityScore());
        m.put("background", a.background());
        m.put("detailView", a.detailView());
        m.put("stages", a.stages().stream().map(s -> s.name() + ": " + s.note()).toList());
        m.put("debug", a.debug());
        BackgroundNormalizer.Rendered r = a.rendered();
        m.put("rendered", r == null ? null : List.of(pixels(r.transparent()), pixels(r.white()), pixels(r.neutral()),
                pixels(r.card()), pixels(r.thumbnail()), r.colorPreservation(), r.width() + "x" + r.height()));
        CatalogPreviewRenderer.Frames f = a.previewFrames();
        Map<String, Object> frames = new LinkedHashMap<>();
        if (f != null) {
            frames.put("fabric", pixels(f.fabric()));
            frames.put("whole", pixels(f.whole()));
            frames.put("wholeMetadata", f.wholeMetadata());
            frames.put("wholeUnavailableReason", f.wholeUnavailableReason());
        }
        m.put("previewFrames", f == null ? null : frames);
        return m;
    }

    /** Lê o retrato versionado; com -Dretrato.gravar=true antes grava o texto atual (só no código original). */
    static String golden(String text, String name) throws IOException {
        Path file = DIR.resolve(name);
        if (Boolean.getBoolean("retrato.gravar")) {
            Files.createDirectories(file.getParent());
            Files.writeString(file, text, StandardCharsets.UTF_8);
        }
        return Files.readString(file, StandardCharsets.UTF_8);
    }
}
