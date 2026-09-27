package br.com.fashionai.application.imaging;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.domain.model.enums.ModerationStatus;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Visão local (fallback dos sub-motores #1 Piece Analyzer e #2 Content Moderator). Heurísticas
 * determinísticas e baratas — a cor dominante é confiável; a categoria pela silhueta é fraca e por isso
 * sai com confiança baixa, o que faz o formulário ficar vazio com aviso (RF4.CA03).
 */
public final class LocalVision {
    public static final double PREFILL_CONFIDENCE = 0.55;

    private LocalVision() {
    }

    /**
     * @param logoBox  caixa do logo na imagem enviada à IA (0–1000: x0, y0, x1, y1); null quando não há logo
     * @param insights o resto do que a análise viu (ocasião, estilo, zona da marca, avaliação da foto, subtipos)
     */
    public record PieceGuess(String category, String subcategory, String color, String material, String brand,
                             String sex, Map<String, Double> confidence, double overall, List<String> palette,
                             double[] logoBox, Insights insights) {
        public PieceGuess(String category, String subcategory, String color, String material, String brand, String sex,
                          Map<String, Double> confidence, double overall, List<String> palette, double[] logoBox) {
            this(category, subcategory, color, material, brand, sex, confidence, overall, palette, logoBox, Insights.NONE);
        }

        public PieceGuess {
            insights = insights == null ? Insights.NONE : insights;
        }

        public PieceGuess withInsights(Insights i) {
            return new PieceGuess(category, subcategory, color, material, brand, sex, confidence, overall, palette, logoBox, i);
        }
    }

    /**
     * O que a análise (IA ou motor local) viu além dos campos básicos.
     *
     * @param name             nome sugerido para a peça (null = montar pelo subtipo e cor)
     * @param brandZone        zona onde a marca foi lida (gola, peito_esquerdo, peito_direito, centro_peito…)
     * @param brandEvidence    o que foi lido/visto ("texto NIKE bordado")
     * @param matchesCategory  a foto é do tipo escolhido pela pessoa (null = não avaliado)
     * @param detectedCategory tipo que a análise viu na foto
     * @param fullyVisible     a peça aparece inteira, sem cortes (null = não avaliado)
     * @param viewAngle        frontal_90 · angulo · lateral · dobrada (null = não avaliado)
     * @param singlePiece      uma peça só na foto (null = não avaliado)
     * @param photoConfidence  confiança dessa avaliação da foto
     * @param ranking          subtipos mais parecidos, do mais parecido para o menos
     */
    public record Insights(String name, List<String> occasion, List<String> style, String brandZone, String brandEvidence,
                           Boolean matchesCategory, String detectedCategory, Boolean fullyVisible, String viewAngle,
                           Boolean singlePiece, double photoConfidence, List<SubtypeReferences.Match> ranking) {
        public static final Insights NONE = new Insights(null, List.of(), List.of(), null, null, null, null, null, null, null, 0, List.of());

        public Insights {
            occasion = occasion == null ? List.of() : occasion;
            style = style == null ? List.of() : style;
            ranking = ranking == null ? List.of() : ranking;
        }

        public Insights withRanking(List<SubtypeReferences.Match> r) {
            return new Insights(name, occasion, style, brandZone, brandEvidence, matchesCategory, detectedCategory, fullyVisible,
                    viewAngle, singlePiece, photoConfidence, r);
        }
    }

    public static PieceGuess analyzePiece(ImageOps.Cutout cutout) {
        BufferedImage img = cutout.image();
        int[] fg = ImageOps.foregroundPixels(img, Math.max(1, Math.max(img.getWidth(), img.getHeight()) / 160));
        List<ColorMath.Cluster> clusters = ColorMath.kmeans(fg, 4);
        String color = null;
        double colorConf = 0;
        List<String> palette = new ArrayList<>();
        if (!clusters.isEmpty()) {
            ColorMath.Cluster main = clusters.get(0);
            color = ColorMath.nearestTaxonomyColor(main.rgb());
            colorConf = Math.min(0.9, 0.35 + main.share() * 0.6) * (cutout.confidence() >= 0.5 ? 1 : 0.8);
            if (clusters.size() >= 3 && clusters.get(0).share() < 0.45 && clusters.get(2).share() > 0.15) {
                color = "multicolor";
                colorConf = 0.6;
            }
            clusters.forEach(c -> palette.add(c.hex()));
        }
        ImageOps.Box box = ImageOps.alphaBounds(img);
        double ratio = box.empty() ? 1 : box.h() / (double) box.w();
        String category;
        String subcategory;
        double catConf;
        if (ratio > 1.7) {
            category = "lower_piece";
            subcategory = "jeans".equals(color) || "denim".equals(color) || "blue".equals(color) ? "jeans" : "casual_pants";
            catConf = 0.42;
        } else if (ratio < 0.6) {
            category = "shoes_piece";
            subcategory = "casual_sneakers";
            catConf = 0.35;
        } else if (ratio > 1.25) {
            category = "full_body_piece";
            subcategory = "dress";
            catConf = 0.3;
        } else {
            category = "upper_piece";
            subcategory = "t_shirt";
            catConf = 0.38;
        }
        Map<String, Double> conf = new LinkedHashMap<>();
        conf.put("category", catConf);
        conf.put("subcategory", catConf * 0.8);
        conf.put("color", round(colorConf));
        conf.put("material", 0.0);
        conf.put("brand", 0.0);
        double overall = round((catConf + colorConf) / 2);
        return new PieceGuess(category, subcategory, color, null, null, null, conf, overall, palette, null);
    }

    public record ModerationVerdict(ModerationStatus status, double confidence, List<String> reasons, boolean needsHumanReview) {
    }

    /**
     * Moderação local — nunca aprova por omissão: só aprova quando há um objeto bem recortado, sem
     * proporção relevante de tons de pele; em qualquer dúvida devolve PENDING para a fila humana.
     */
    public static ModerationVerdict moderate(BufferedImage original, ImageOps.Cutout cutout) {
        List<String> reasons = new ArrayList<>();
        int[] fg = ImageOps.foregroundPixels(cutout.image(), Math.max(1, cutout.image().getWidth() / 200));
        double skin = skinRatio(fg);
        if (original.getWidth() < 200 || original.getHeight() < 200) {
            reasons.add(Msg.t("localVision.imagem_pequena_demais_para_avaliar"));
        }
        if (cutout.coverage() < 0.03) {
            reasons.add(Msg.t("localVision.nenhum_objeto_identificavel_no_primeiro"));
            return new ModerationVerdict(ModerationStatus.REJECTED_NOT_CLOTHING, 0.55, reasons, true);
        }
        if (skin > 0.35) {
            reasons.add(String.format(Msg.t("localVision.proporcao_alta_de_tons_de"), skin * 100));
        }
        if (cutout.confidence() < 0.45) {
            reasons.add(Msg.t("localVision.recorte_pouco_confiavel_nao_e"));
        }
        if (reasons.isEmpty()) {
            return new ModerationVerdict(ModerationStatus.APPROVED, round(0.6 + (0.35 - skin) * 0.5), List.of(Msg.t("localVision.objeto_unico_sem_pele_exposta")), false);
        }
        return new ModerationVerdict(ModerationStatus.PENDING, 0.4, reasons, true);
    }

    /** Detecção clássica de pele em YCbCr (Chai & Ngan). */
    public static double skinRatio(int[] pixels) {
        if (pixels.length == 0) {
            return 0;
        }
        int skin = 0;
        for (int p : pixels) {
            int r = (p >> 16) & 0xFF;
            int g = (p >> 8) & 0xFF;
            int b = p & 0xFF;
            double cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
            double cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
            if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
                skin++;
            }
        }
        return skin / (double) pixels.length;
    }

    private static double round(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
