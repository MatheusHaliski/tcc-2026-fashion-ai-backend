package br.com.fashionai.application.lens;

import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.service.MultiPieceService;
import br.com.fashionai.application.vision.analysis.GarmentEmbedder;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.LensDetectionStatus;
import br.com.fashionai.domain.model.enums.LensScanStatus;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Governança da leitura do Lens (RF54 + RF24.CA13/CA16): traduz o resultado do detector de várias peças
 * ({@link MultiPieceService.PieceDetection} com o {@link AiOutcome} governado) para a proveniência do scan e as linhas
 * de peça. Puro: sem repositório, storage, cota ou relógio — {@link LensService#process} continua dono da transação,
 * da gravação e da devolução da cota.
 * <ul>
 *   <li>Falha do detector ({@code det == null}) é {@code FAILED}, nunca um sucesso fictício; sem peças é
 *       {@code NO_FASHION_FOUND}.</li>
 *   <li>Leitura local só explica o motivo quando o motor registrou consentimento negado ou cota da IA.</li>
 *   <li>A versão do modelo registra detector e embedder (limite de 160 caracteres da coluna).</li>
 * </ul>
 */
final class LensScanProvenance {
    static final int MODEL_VERSION_MAX = 160;

    private LensScanProvenance() {
    }

    /** Leitura sem IA externa: uma peça cobrindo a foto, como quando a IA não está disponível. */
    static MultiPieceService.PieceDetection localDetection() {
        return new MultiPieceService.PieceDetection(List.of(MultiPieceService.localPiece()), "local", null);
    }

    /** Proveniência e estado do scan a partir do resultado do detector ({@code null} = o detector falhou). */
    static void stamp(LensScan scan, MultiPieceService.PieceDetection det) {
        AiOutcome<?> outcome = det == null ? null : det.outcome();
        scan.setAiSource(det == null ? "local" : det.source());
        scan.setModelVersion(modelVersion(outcome));
        scan.setAiInferenceId(outcome == null ? null : outcome.inferenceId());
        if (det == null) {
            scan.setStatus(LensScanStatus.FAILED);
            scan.setErrorCode("FAILED");
        } else if (det.pieces().isEmpty()) {
            scan.setStatus(LensScanStatus.NO_FASHION_FOUND);
            scan.setErrorCode("NO_FASHION_FOUND");
        } else {
            scan.setStatus(LensScanStatus.READY);
            scan.setErrorCode(degradedReason(det));
        }
    }

    /** Por que a leitura ficou local (a UI explica): consentimento ou cota da IA. Nulo quando não há o que explicar. */
    static String degradedReason(MultiPieceService.PieceDetection det) {
        if (det == null || !"local".equals(det.source()) || det.outcome() == null) {
            return null;
        }
        AiCallResult r = det.outcome().result();
        return r == AiCallResult.CONSENT_DENIED ? "CONSENT_REQUIRED" : r == AiCallResult.RATE_LIMITED ? "QUOTA" : null;
    }

    static String modelVersion(AiOutcome<?> outcome) {
        String detector = outcome == null || outcome.provider() == null ? "local"
                : "local".equals(outcome.provider()) ? "local" : outcome.provider() + ":" + outcome.model();
        String v = "multi-piece-detector@" + detector + "+" + GarmentEmbedder.MODEL.key();
        return v.length() > MODEL_VERSION_MAX ? v.substring(0, MODEL_VERSION_MAX) : v;
    }

    /** Ordem de leitura: de cima para baixo, depois da esquerda para a direita. Vazia quando o detector falhou. */
    static List<MultiPieceService.DetectedPiece> readingOrder(MultiPieceService.PieceDetection det) {
        List<MultiPieceService.DetectedPiece> ordered = new ArrayList<>(det == null ? List.of() : det.pieces());
        ordered.sort(Comparator.comparingDouble((MultiPieceService.DetectedPiece p) -> p.box().y())
                .thenComparingDouble(p -> p.box().x()));
        return ordered;
    }

    /** Peça do detector → linha do scan, com a leitura local do recorte (cores, padrão, embedding). */
    static LensDetection fromDetected(UUID scanId, int ordinal, MultiPieceService.DetectedPiece p, BufferedImage photo) {
        LensViews.Box box = new LensViews.Box(p.box().x(), p.box().y(), p.box().width(), p.box().height());
        LensImageAnalysis.Reading read = LensImageAnalysis.read(photo, box, p.color());
        LensDetection d = new LensDetection();
        d.setScanId(scanId);
        d.setOrdinal(ordinal);
        d.setBoxJson(Json.write(box));
        d.setCategory(p.category());
        d.setSubcategory(p.subcategory());
        d.setMaterial(p.material());
        d.setSex(p.sex());
        d.setLabel(p.name() != null && !p.name().isBlank() ? p.name() : LensService.defaultLabel(p.category(), p.subcategory()));
        d.setColorsJson(Json.write(read.colors()));
        d.setPattern(read.pattern());
        d.setStyleTags(Json.csv(p.style()));
        d.setOccasionTags(Json.csv(p.occasion()));
        d.setConfidence(BigDecimal.valueOf(p.confidence()).setScale(3, RoundingMode.HALF_UP));
        Map<String, Object> conf = new LinkedHashMap<>();
        conf.put("detection", p.confidence());
        conf.put("pattern", Math.round(read.patternConfidence() * 100) / 100.0);
        d.setAttributeConfidenceJson(Json.write(conf));
        d.setEmbeddingJson(Json.write(LensService.round4(read.embedding())));
        d.setEmbeddingModel(GarmentEmbedder.MODEL.key());
        d.setStatus(LensDetectionStatus.DETECTED);
        return d;
    }
}
