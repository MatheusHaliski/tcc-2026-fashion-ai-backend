package br.com.fashionai.application.imaging;

import br.com.fashionai.application.common.Msg;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Validação de qualidade do Flat Lay (RFC RF4 §5): nitidez (variância do Laplaciano), exposição,
 * cobertura, centralização, uniformidade de fundo, resolução e confiança do recorte. Nota geral
 * ponderada; aceita quando ≥ 0,6 — abaixo disso a peça é salva e o usuário recebe recomendações de refazer.
 */
public final class QualityMetrics {
    public static final double ACCEPTANCE_THRESHOLD = 0.6;

    private QualityMetrics() {
    }

    public record Report(Map<String, Double> metrics, double overall, boolean accepted, List<String> issues,
                         List<String> recommendations) {
    }

    public static Report evaluate(BufferedImage original, BufferedImage composed, double bgConfidence,
                                  double colorNormalizationScore) {
        Map<String, Double> m = new LinkedHashMap<>();
        m.put("sharpness", sharpness(original));
        m.put("exposure", exposure(original));
        ImageOps.Box box = ImageOps.alphaBounds(composed);
        double area = composed.getWidth() * (double) composed.getHeight();
        double coverage = box.empty() ? 0 : (box.w() * (double) box.h()) / area;
        m.put("coverage", coverage >= 0.35 && coverage <= 0.9 ? 1.0 : Math.max(0, 1 - Math.abs(coverage - 0.6) * 2));
        double cx = box.x() + box.w() / 2.0;
        double cy = box.y() + box.h() / 2.0;
        double off = Math.hypot(cx - composed.getWidth() / 2.0, cy - composed.getHeight() / 2.0) / (composed.getWidth() / 2.0);
        m.put("centering", Math.max(0, 1 - off * 3));
        m.put("background_removal", bgConfidence);
        m.put("resolution", Math.min(1, Math.min(original.getWidth(), original.getHeight()) / 800.0));
        m.put("color_normalization", colorNormalizationScore);
        double overall = m.get("sharpness") * 0.22 + m.get("exposure") * 0.14 + m.get("coverage") * 0.12
                + m.get("centering") * 0.08 + m.get("background_removal") * 0.22 + m.get("resolution") * 0.12
                + m.get("color_normalization") * 0.10;
        overall = Math.round(overall * 1000) / 1000.0;
        List<String> issues = new ArrayList<>();
        List<String> recs = new ArrayList<>();
        if (m.get("sharpness") < 0.45) {
            issues.add(Msg.t("qualityMetrics.foto_tremida_ou_desfocada"));
            recs.add(Msg.t("qualityMetrics.apoie_o_celular_e_fotografe"));
        }
        if (m.get("exposure") < 0.5) {
            issues.add(Msg.t("qualityMetrics.exposicao_inadequada"));
            recs.add(Msg.t("qualityMetrics.evite_contraluz_e_sombras_fortes"));
        }
        if (m.get("background_removal") < 0.5) {
            issues.add(Msg.t("qualityMetrics.fundo_pouco_contrastante"));
            recs.add(Msg.t("qualityMetrics.fotografe_a_peca_esticada_sobre"));
        }
        if (m.get("resolution") < 0.6) {
            issues.add(Msg.t("qualityMetrics.resolucao_baixa"));
            recs.add(Msg.t("qualityMetrics.use_a_camera_principal_sem"));
        }
        return new Report(m, overall, overall >= ACCEPTANCE_THRESHOLD, issues, recs);
    }

    /** Variância do Laplaciano normalizada — 1,0 a partir de ~300 (foto nítida). */
    public static double sharpness(BufferedImage img) {
        BufferedImage small = ImageOps.scaleToFit(img, 800, 800);
        int w = small.getWidth();
        int h = small.getHeight();
        int[] px = small.getRGB(0, 0, w, h, null, 0, w);
        double[] gray = new double[px.length];
        for (int i = 0; i < px.length; i++) {
            int p = px[i];
            gray[i] = ((p >> 16) & 0xFF) * 0.299 + ((p >> 8) & 0xFF) * 0.587 + (p & 0xFF) * 0.114;
        }
        double sum = 0;
        double sumSq = 0;
        long n = 0;
        for (int y = 1; y < h - 1; y++) {
            for (int x = 1; x < w - 1; x++) {
                int i = y * w + x;
                double lap = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
                sum += lap;
                sumSq += lap * lap;
                n++;
            }
        }
        if (n == 0) {
            return 0;
        }
        double mean = sum / n;
        double variance = sumSq / n - mean * mean;
        return Math.min(1, variance / 300.0);
    }

    public static double exposure(BufferedImage img) {
        BufferedImage small = ImageOps.scaleToFit(img, 400, 400);
        int[] px = small.getRGB(0, 0, small.getWidth(), small.getHeight(), null, 0, small.getWidth());
        double sum = 0;
        int clipped = 0;
        for (int p : px) {
            double l = (((p >> 16) & 0xFF) * 0.299 + ((p >> 8) & 0xFF) * 0.587 + (p & 0xFF) * 0.114) / 255;
            sum += l;
            if (l < 0.02 || l > 0.98) {
                clipped++;
            }
        }
        double mean = sum / px.length;
        double score = mean >= 0.25 && mean <= 0.85 ? 1 : 1 - Math.min(1, Math.abs(mean - 0.55) * 2.5);
        return Math.max(0, score - clipped / (double) px.length);
    }
}
