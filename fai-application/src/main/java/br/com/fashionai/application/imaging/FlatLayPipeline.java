package br.com.fashionai.application.imaging;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageProviderPorts.BackgroundRemovalPort;
import br.com.fashionai.application.imaging.ImageProviderPorts.ColorNormalizationPort;
import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Pipeline híbrido de padronização Flat Lay do RF4 (ANALISE_RF4_Flat_Lay_Pipeline.md / RFC §RF4):
 * 1 validação → 2 remoção de fundo (rembg → remove.bg → local) → 3 correção de perspectiva (PCA/deskew) →
 * 4 normalização de cor (Cloudinary → gray-world local) → 5 composição 1024×1024 → 6 validação de
 * qualidade (≥ 0,6) → 7 thumbnail 300×300. Cada etapa externa cai para a local sem interromper o pipeline
 * (RNF8) e registra provedor, tempo e custo — viram PipelineJob.stagesJson e ProcessingJobLog.
 */
@Component
public class FlatLayPipeline {
    private static final Logger log = LoggerFactory.getLogger(FlatLayPipeline.class);
    public static final int CANVAS = 1024;
    public static final int THUMB = 300;

    private final List<BackgroundRemovalPort> backgroundRemovers;
    private final List<ColorNormalizationPort> colorNormalizers;

    public FlatLayPipeline(List<BackgroundRemovalPort> backgroundRemovers, List<ColorNormalizationPort> colorNormalizers) {
        this.backgroundRemovers = backgroundRemovers;
        this.colorNormalizers = colorNormalizers;
    }

    public record Stage(String name, String provider, long ms, BigDecimal costUsd, boolean ok, boolean fallback, String note) {
    }

    public record Result(byte[] processedPng, byte[] processedWhiteJpeg, byte[] thumbnailPng, String mimeType,
                         int originalWidth, int originalHeight, ImageOps.Cutout cutout, QualityMetrics.Report quality,
                         List<Stage> stages, BigDecimal totalCostUsd, long totalMs, boolean fallbackUsed,
                         boolean backgroundRemoved, Map<String, Object> metadata, BufferedImage original,
                         BufferedImage studioSource, java.util.Set<String> truncated) {
    }

    /** Lado maior da fonte do estúdio: o Flat Lay (1024 px) jogaria fora o detalhe de uma foto de celular de 12 MP. */
    public static final int STUDIO_SOURCE_MAX = 2400;

    /** A foto pode mostrar uma pessoa? Pele estranha à peça no recorte local ({@link FlatLayMasks#mayShowPerson}). */
    static boolean mayShowPerson(ImageOps.Cutout local, BufferedImage original) {
        return FlatLayMasks.mayShowPerson(local, original);
    }

    public boolean externalAvailable() {
        return backgroundRemovers.stream().anyMatch(BackgroundRemovalPort::available)
                || colorNormalizers.stream().anyMatch(ColorNormalizationPort::available);
    }

    public Result run(byte[] bytes, boolean allowExternal) {
        long started = System.nanoTime();
        List<Stage> stages = new ArrayList<>();
        long t = System.nanoTime();
        String mime = ImageOps.requireAcceptedImage(bytes);
        BufferedImage original = ImageOps.decode(bytes);
        stages.add(new Stage("VALIDACAO", "local", ms(t), BigDecimal.ZERO, true, false, mime));

        // privacidade: foto com pessoa (pele estranha à peça no recorte local) nunca sai do servidor — nem para a remoção de
        // fundo (rembg/remove.bg) nem para a normalização de cor; o recorte e a cor ficam no motor local
        ImageOps.Cutout local = null;
        if (allowExternal && externalAvailable()) {
            t = System.nanoTime();
            local = ImageOps.removeBackgroundLocal(original);
            if (mayShowPerson(local, original)) {
                allowExternal = false;
                stages.add(new Stage("PRIVACIDADE", "local", ms(t), BigDecimal.ZERO, true, false, Msg.t("flatLay.pessoa_sem_provedor_externo")));
            }
        }

        // 2 — remoção de fundo
        t = System.nanoTime();
        ImageOps.Cutout cutout = null;
        boolean fallback = false;
        if (allowExternal) {
            for (BackgroundRemovalPort port : backgroundRemovers) {
                if (!port.available()) {
                    continue;
                }
                try {
                    Optional<ProviderImage> res = port.removeBackground(bytes, mime);
                    if (res.isPresent()) {
                        BufferedImage img = ImageOps.decode(res.get().bytes());
                        ImageOps.Box box = ImageOps.alphaBounds(img);
                        double coverage = box.empty() ? 0 : box.w() * (double) box.h() / (img.getWidth() * (double) img.getHeight());
                        cutout = new ImageOps.Cutout(img, coverage, Math.max(0.8, res.get().confidence()), 0xFFFFFF);
                        stages.add(new Stage("REMOCAO_FUNDO", res.get().provider(), ms(t), res.get().costUsd(), true, false, "ok"));
                        break;
                    }
                } catch (RuntimeException ex) {
                    log.warn("Remoção de fundo externa falhou: {}", ex.getMessage());
                    stages.add(new Stage("REMOCAO_FUNDO", "externo", ms(t), BigDecimal.ZERO, false, true, ex.getMessage()));
                }
            }
        }
        if (cutout == null) {
            t = System.nanoTime();
            cutout = local != null ? local : ImageOps.removeBackgroundLocal(original);
            fallback = allowExternal && backgroundRemovers.stream().anyMatch(BackgroundRemovalPort::available);
            stages.add(new Stage("REMOCAO_FUNDO", "local-floodfill", ms(t), BigDecimal.ZERO, cutout.confidence() >= 0.45,
                    true, String.format(Msg.t("flatLay.confianca_2f"), cutout.confidence())
                    + (cutout.warning() == null ? "" : " — " + cutout.warning())));
        }
        boolean backgroundRemoved = cutout.confidence() >= 0.45;
        // lados em que a peça encosta na borda da foto (foto cortou a barra/mangas): o estúdio faz a peça "sangrar" ali
        java.util.Set<String> truncated = truncatedSides(cutout.image());

        // 3 — correção de perspectiva (deskew pela PCA da máscara)
        t = System.nanoTime();
        double[] axis = ImageOps.principalAxis(cutout.image());
        double principal = axis[0];
        // forma sem eixo dominante (peça quase "quadrada"): o ângulo da PCA é ruído → não gira
        double correction = axis[1] >= ImageOps.DESKEW_MIN_ELONGATION ? ImageOps.deskewAngle(principal) : 0;
        BufferedImage straight = ImageOps.rotate(cutout.image(), correction);
        BufferedImage cropped = ImageOps.crop(straight, ImageOps.alphaBounds(straight));
        stages.add(new Stage("CORRECAO_PERSPECTIVA", "local-pca", ms(t), BigDecimal.ZERO, true, false,
                String.format(Msg.t("flatLay.eixo_1f_alongamento_2f_correcao"), principal, axis[1], correction)));

        // 4 — normalização de cor
        t = System.nanoTime();
        BufferedImage normalized = null;
        double colorScore = 0.7;
        boolean externalColor = false;
        if (allowExternal) {
            for (ColorNormalizationPort port : colorNormalizers) {
                if (!port.available()) {
                    continue;
                }
                try {
                    Optional<ProviderImage> res = port.normalize(ImageOps.png(cropped), "image/png");
                    if (res.isPresent()) {
                        normalized = ImageOps.decode(res.get().bytes());
                        colorScore = Math.max(0.8, res.get().confidence());
                        externalColor = true;
                        stages.add(new Stage("NORMALIZACAO_COR", res.get().provider(), ms(t), res.get().costUsd(), true, false, "ok"));
                        break;
                    }
                } catch (RuntimeException ex) {
                    stages.add(new Stage("NORMALIZACAO_COR", "externo", ms(t), BigDecimal.ZERO, false, true, ex.getMessage()));
                }
            }
        }
        if (normalized == null) {
            t = System.nanoTime();
            ImageFilters.NormalizationResult nr = ImageFilters.normalize(cropped);
            normalized = nr.image();
            colorScore = nr.score();
            stages.add(new Stage("NORMALIZACAO_COR", "local-grayworld", ms(t), BigDecimal.ZERO, true,
                    allowExternal && colorNormalizers.stream().anyMatch(ColorNormalizationPort::available),
                    String.format(Msg.t("flatLay.ganhos_r_2f_g_2f"), nr.gainR(), nr.gainG(), nr.gainB())));
        }

        // 4b — fonte do estúdio em alta resolução: máscara do recorte aplicada à foto original (≤ 2400 px), mesma
        // correção de inclinação e mesma normalização de cor
        BufferedImage hi = hiResCutout(original, cutout.image());
        BufferedImage studioSource;
        if (hi != cutout.image()) {
            BufferedImage hs = ImageOps.rotate(hi, correction);
            hs = ImageOps.crop(hs, ImageOps.alphaBounds(hs));
            // a cor do provedor externo não é reproduzível aqui: a fonte fica com a cor da foto (o estúdio realça depois)
            studioSource = externalColor ? hs : ImageFilters.normalize(hs).image();
        } else {
            studioSource = normalized;
        }

        // 5 — composição 1024 (transparente para o card + fundo branco para compartilhar)
        t = System.nanoTime();
        BufferedImage composed = ImageOps.composeCentered(normalized, CANVAS, 0.08, null, false);
        BufferedImage white = ImageOps.composeCentered(normalized, CANVAS, 0.08, Color.WHITE, true);
        stages.add(new Stage("COMPOSICAO", "local-java2d", ms(t), BigDecimal.ZERO, true, false, Msg.t("flatLay.px_margem_8", (CANVAS))));

        // 6 — validação de qualidade
        t = System.nanoTime();
        QualityMetrics.Report quality = QualityMetrics.evaluate(original, composed, cutout.confidence(), colorScore);
        stages.add(new Stage("VALIDACAO_QUALIDADE", "local", ms(t), BigDecimal.ZERO, quality.accepted(), false,
                String.format(Msg.t("flatLay.nota_2f_limiar_2f"), quality.overall(), QualityMetrics.ACCEPTANCE_THRESHOLD)));

        // 7 — thumbnail. Recorte reprovado (backgroundRemoved = false): o cadastro guarda a foto original como imagem da
        // peça, e a miniatura acompanha — feita do recorte, ela saía quase toda branca (o que sobrou foi fundo/borda)
        t = System.nanoTime();
        BufferedImage thumb = ImageOps.composeCentered(backgroundRemoved ? normalized : original, THUMB, 0.06, Color.WHITE, false);
        stages.add(new Stage("THUMBNAIL", "local", ms(t), BigDecimal.ZERO, true, false,
                THUMB + "×" + THUMB + (backgroundRemoved ? "" : " · " + Msg.t("flatLay.miniatura_da_original"))));

        BigDecimal cost = stages.stream().map(Stage::costUsd).reduce(BigDecimal.ZERO, BigDecimal::add);
        boolean anyFallback = fallback || stages.stream().anyMatch(Stage::fallback);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("background_removal_confidence", round(cutout.confidence()));
        if (cutout.warning() != null) {
            meta.put("background_removal_warning", cutout.warning());
        }
        meta.put("perspective_correction_applied", correction != 0);
        meta.put("perspective_correction_degrees", round(correction));
        meta.put("color_normalization_score", round(colorScore));
        meta.put("composition_quality", quality.metrics().get("centering"));
        meta.put("failed_stages", stages.stream().filter(s -> !s.ok()).map(Stage::name).toList());
        meta.put("retry_count", 0);
        meta.put("fallback_used", anyFallback);
        meta.put("canvas", CANVAS);
        meta.put("truncated_sides", List.copyOf(truncated));
        meta.put("studio_source", studioSource.getWidth() + "×" + studioSource.getHeight());
        return new Result(ImageOps.png(composed), ImageOps.jpeg(white, 0.9f), ImageOps.png(thumb), mime,
                original.getWidth(), original.getHeight(), cutout, quality, stages, cost, ms(started), anyFallback,
                backgroundRemoved, meta, original, studioSource, truncated);
    }

    /**
     * Lados do recorte que encostam na borda da foto (foto que cortou a barra ou as mangas): o estúdio não pode deixar
     * esse corte "flutuando" ({@link FlatLayMasks#truncatedSides}).
     */
    public static java.util.Set<String> truncatedSides(BufferedImage cut) {
        return FlatLayMasks.truncatedSides(cut);
    }

    /** Máscara do recorte aplicada à original reduzida a {@link #STUDIO_SOURCE_MAX} ({@link FlatLayMasks#hiResCutout}). */
    static BufferedImage hiResCutout(BufferedImage original, BufferedImage cut) {
        return FlatLayMasks.hiResCutout(original, cut);
    }

    private static long ms(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
