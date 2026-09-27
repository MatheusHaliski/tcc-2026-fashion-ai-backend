package br.com.fashionai.application.imaging;

import br.com.fashionai.application.common.Msg;

import java.awt.image.BufferedImage;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * RF4 — critérios de aceite da foto da peça. A foto só entra no acervo se seguir os princípios de fotografia de produto:
 * <ol>
 *   <li><b>fundo</b>: a peça se separa do fundo (fundo liso e contrastante);</li>
 *   <li><b>inteira</b>: a peça está inteira no quadro — nenhum lado encosta na borda da foto (sem cortes);</li>
 *   <li><b>enquadramento</b>: a peça ocupa uma parte razoável da foto e tem resolução própria suficiente;</li>
 *   <li><b>alinhamento</b>: a peça está reta (até 25° o pipeline endireita; além disso a foto é recusada);</li>
 *   <li><b>frontal</b>: câmera a 90° sobre a peça esticada — roupa vista de frente é simétrica (esquerda × direita);</li>
 *   <li><b>peca_unica</b>: uma peça por foto (calçados, brincos, luvas e meias podem vir em par);</li>
 *   <li><b>nitidez</b> e <b>exposicao</b>: nem tremida, nem escura/estourada.</li>
 * </ol>
 * O formato identificável como o tipo escolhido (subtipo por similaridade/IA) é conferido depois, com a análise
 * ({@link #shapeCheck}). Tudo local, determinístico e barato: roda antes de qualquer chamada paga de IA.
 */
public final class PhotoAcceptance {
    public static final double BACKGROUND_MIN = 0.45;
    public static final double MIN_AREA_FRACTION = 0.06;
    public static final int MIN_PIECE_PX = 240;
    public static final double MAX_TILT = 25;
    /** Peça sem eixo comprido (camiseta, moletom) o pipeline não endireita: acima disso, a foto é recusada. */
    public static final double MAX_TILT_SQUARE = 10;
    /**
     * Calibrado com perspectiva projetiva (câmera girada no eixo vertical): o lado distante com metade da altura do
     * próximo (≈ 45° fora dos 90°) reprova; ângulos leves passam aqui e ficam com a avaliação da IA ("viewAngle").
     */
    public static final double SYMMETRY_MIN = 0.78;
    /** Fração mínima da área da peça para um pedaço separado contar como "outro objeto" (sujeira do recorte não conta). */
    static final double COMPONENT_MIN_SHARE = 0.10;
    public static final double SHARPNESS_MIN = 0.05;
    /** Mais da metade da peça sem detalhe (preto puro ou branco estourado) = foto escura ou estourada. */
    public static final double MAX_CLIPPED = 0.5;
    /** Sem IA, o formato precisa lembrar ao menos uma referência da categoria escolhida. */
    public static final double LOCAL_SHAPE_MIN = 0.55;
    /** Sem IA: outra categoria com similaridade maior por esta folga = a foto não é do tipo escolhido. */
    public static final double LOCAL_OTHER_MARGIN = 0.10;
    static final Set<String> GARMENTS = Set.of("upper_piece", "lower_piece", "full_body_piece");

    private PhotoAcceptance() {
    }

    /** Um critério avaliado: {@code value} é a medida, {@code threshold} o limite; {@code message} só quando reprova. */
    public record Check(String id, boolean ok, double value, double threshold, String message) {
    }

    public record Report(boolean accepted, List<Check> checks) {
        public List<Check> failed() {
            return checks.stream().filter(c -> !c.ok()).toList();
        }

        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("accepted", accepted);
            m.put("checks", checks.stream().map(c -> {
                Map<String, Object> x = new LinkedHashMap<>();
                x.put("id", c.id());
                x.put("ok", c.ok());
                x.put("value", c.value());
                x.put("threshold", c.threshold());
                if (c.message() != null) {
                    x.put("message", c.message());
                }
                return x;
            }).toList());
            return m;
        }
    }

    /**
     * @param category  categoria escolhida pela pessoa (nula = desconhecida)
     * @param cutout    recorte no quadro da foto (mesmas dimensões da foto de trabalho), com alfa
     * @param truncated lados em que a peça encosta na borda da foto ({@link FlatLayPipeline#truncatedSides})
     */
    public static Report evaluate(String category, int originalW, int originalH, ImageOps.Cutout cutout, Set<String> truncated,
                                  QualityMetrics.Report quality) {
        List<Check> checks = new ArrayList<>();
        BufferedImage img = cutout.image();
        BufferedImage small = ImageOps.scaleToFit(img, 320, 320);
        int components = components(small);
        ImageOps.Box box = Silhouette.maskBounds(img);
        double areaFraction = box.empty() ? 0 : box.w() * (double) box.h() / (img.getWidth() * (double) img.getHeight());
        // peça minúscula no quadro: o recorte nem acha o que separar — a orientação certa é aproximar a câmera
        if (cutout.confidence() < BACKGROUND_MIN && cutout.coverage() < 0.02) {
            checks.add(check("enquadramento", false, round(areaFraction), MIN_AREA_FRACTION,
                    Msg.t("photoAcceptance.pequena", Math.round(areaFraction * 100))));
            return new Report(false, checks);
        }
        // recorte "partido" em dois pedaços grandes é o par (tênis, brincos) ou duas peças — quem decide é "peca_unica"
        boolean separated = cutout.confidence() >= BACKGROUND_MIN || cutout.warning() != null && components >= 2;
        checks.add(check("fundo", separated, cutout.confidence(), BACKGROUND_MIN, Msg.t("photoAcceptance.fundo")));
        // sem recorte confiável as medidas de forma não valem nada: só o fundo (e o corte na borda, quando houver)
        if (!separated) {
            if (truncated != null && !truncated.isEmpty()) {
                checks.add(check("inteira", false, truncated.size(), 0, Msg.t("photoAcceptance.inteira", sides(truncated))));
            }
            return new Report(false, checks);
        }
        checks.add(check("inteira", truncated == null || truncated.isEmpty(), truncated == null ? 0 : truncated.size(), 0,
                Msg.t("photoAcceptance.inteira", sides(truncated))));
        checks.add(check("enquadramento", areaFraction >= MIN_AREA_FRACTION, round(areaFraction), MIN_AREA_FRACTION,
                Msg.t("photoAcceptance.pequena", Math.round(areaFraction * 100))));
        // resolução da própria peça na foto original (o recorte pode ter sido feito numa cópia reduzida)
        double toOriginal = originalW / (double) img.getWidth();
        int piecePx = (int) Math.round(Math.min(box.w(), box.h()) * toOriginal);
        checks.add(check("resolucao", piecePx >= MIN_PIECE_PX, piecePx, MIN_PIECE_PX, Msg.t("photoAcceptance.resolucao", piecePx)));

        int maxComponents = category == null || !Set.of("upper_piece", "lower_piece").contains(category) ? 2 : 1;
        checks.add(check("peca_unica", components <= maxComponents, components, maxComponents,
                Msg.t("photoAcceptance.varias", components)));

        double[] axis = ImageOps.principalAxis(img);
        boolean elongated = axis[1] >= ImageOps.DESKEW_MIN_ELONGATION;
        double deviation = Math.abs(axis[0] - Math.round(axis[0] / 90.0) * 90.0);
        if (category != null && GARMENTS.contains(category)) {
            // roupa de frente é simétrica (sem o tipo, não dá para exigir: calçado de perfil não é simétrico): o eixo de simetria dá a inclinação (a PCA não serve em peça "quadrada")
            double[] sym = components > 1 ? new double[]{1, 0} : bestSymmetry(small);
            double tilt = elongated ? deviation : Math.abs(sym[1]);
            double maxTilt = elongated ? MAX_TILT : MAX_TILT_SQUARE;
            checks.add(check("alinhamento", tilt < maxTilt, round(tilt), maxTilt, Msg.t("photoAcceptance.inclinada", Math.round(tilt))));
            checks.add(check("frontal", sym[0] >= SYMMETRY_MIN, sym[0], SYMMETRY_MIN,
                    Msg.t("photoAcceptance.frontal", Math.round(sym[0] * 100))));
        } else {
            checks.add(check("alinhamento", !elongated || deviation < MAX_TILT, round(deviation), MAX_TILT,
                    Msg.t("photoAcceptance.inclinada", Math.round(deviation))));
        }
        if (quality != null) {
            double sharp = quality.metrics().getOrDefault("sharpness", 1.0);
            checks.add(check("nitidez", sharp >= SHARPNESS_MIN, round(sharp), SHARPNESS_MIN, Msg.t("photoAcceptance.desfocada")));
        }
        double clipped = clippedShare(small);
        checks.add(check("exposicao", clipped <= MAX_CLIPPED, round(clipped), MAX_CLIPPED, Msg.t("photoAcceptance.exposicao")));
        return new Report(checks.stream().allMatch(Check::ok), checks);
    }

    /**
     * [simetria, ângulo]: a maior simetria esquerda × direita girando a silhueta entre −20° e 20° (passo 2°) e o ângulo em
     * que ela acontece — a inclinação da peça no plano, mesmo quando ela não tem eixo "comprido" para a PCA.
     */
    static double[] bestSymmetry(BufferedImage small) {
        double best = -1;
        double angle = 0;
        for (int a = -20; a <= 20; a += 2) {
            double s = Silhouette.symmetry(Silhouette.of(a == 0 ? small : ImageOps.rotate(small, a)));
            // empate técnico: fica com o menor giro (peça já reta)
            if (s > best + 0.005 || Math.abs(s - best) <= 0.005 && Math.abs(a) < Math.abs(angle)) {
                best = Math.max(best, s);
                angle = a;
            }
        }
        return new double[]{best, angle};
    }

    /** Fração da peça sem detalhe: preto puro ou branco estourado (luminância &lt; 2% ou &gt; 98%). */
    static double clippedShare(BufferedImage img) {
        int[] px = img.getRGB(0, 0, img.getWidth(), img.getHeight(), null, 0, img.getWidth());
        long on = 0;
        long clipped = 0;
        for (int p : px) {
            if ((p >>> 24) <= 128) {
                continue;
            }
            on++;
            double l = (((p >> 16) & 0xFF) * 0.299 + ((p >> 8) & 0xFF) * 0.587 + (p & 0xFF) * 0.114) / 255;
            if (l < 0.02 || l > 0.98) {
                clipped++;
            }
        }
        return on == 0 ? 0 : clipped / (double) on;
    }

    /**
     * Critério "formato identificável": com a análise da IA, vale o que ela viu (a peça é do tipo escolhido); sem IA, a
     * silhueta precisa lembrar alguma referência da categoria ({@link #LOCAL_SHAPE_MIN}) e nenhuma outra categoria pode
     * ser muito mais parecida ({@link #LOCAL_OTHER_MARGIN}).
     *
     * @param aiMatches      a IA confirma que a foto é do tipo escolhido (null = IA não respondeu)
     * @param aiConfidence   confiança da IA nessa resposta
     * @param detectedLabel  rótulo do tipo que a IA (ou a silhueta) viu, para a mensagem
     * @param bestLocal      maior similaridade com as referências da categoria escolhida
     * @param bestOther      maior similaridade com as referências das outras categorias
     */
    public static Check shapeCheck(String categoryLabel, Boolean aiMatches, double aiConfidence, String detectedLabel,
                                   double bestLocal, double bestOther) {
        if (aiMatches != null) {
            boolean ok = aiMatches || aiConfidence < 0.7;
            return check("formato", ok, round(aiConfidence), 0.7,
                    Msg.t("photoAcceptance.tipo", categoryLabel, detectedLabel == null ? "?" : detectedLabel));
        }
        if (bestOther - bestLocal >= LOCAL_OTHER_MARGIN) {
            return check("formato", false, round(bestLocal), round(bestOther - LOCAL_OTHER_MARGIN),
                    Msg.t("photoAcceptance.tipo", categoryLabel, detectedLabel == null ? "?" : detectedLabel));
        }
        return check("formato", bestLocal >= LOCAL_SHAPE_MIN, round(bestLocal), LOCAL_SHAPE_MIN,
                Msg.t("photoAcceptance.formato", categoryLabel));
    }

    /** O que a IA viu na foto (peça cortada, de lado, várias peças) — só reprova com confiança alta. */
    public static List<Check> aiPhotoChecks(Boolean fullyVisible, String viewAngle, Boolean singlePiece, double confidence,
                                            String category) {
        List<Check> out = new ArrayList<>();
        if (confidence < 0.7) {
            return out;
        }
        if (Boolean.FALSE.equals(fullyVisible)) {
            out.add(check("inteira_ia", false, round(confidence), 0.7, Msg.t("photoAcceptance.ia_cortada")));
        }
        if (viewAngle != null && GARMENTS.contains(category) && !viewAngle.startsWith("frontal")) {
            out.add(check("frontal_ia", false, round(confidence), 0.7, Msg.t("photoAcceptance.ia_angulo")));
        }
        // o prompt já conta o par (tênis, brincos, luvas) como UMA peça: "não é peça única" com confiança alta são itens
        // diferentes (duas bolsas, pés trocados, dois vestidos) — reprova em qualquer categoria. A contagem local de
        // pedaços aceita 2 em calçado/acessório justamente por causa do par; quem separa par de "duas peças" é a IA.
        if (Boolean.FALSE.equals(singlePiece)) {
            out.add(check("peca_unica_ia", false, round(confidence), 0.7, Msg.t("photoAcceptance.ia_varias")));
        }
        return out;
    }

    private static Check check(String id, boolean ok, double value, double threshold, String message) {
        return new Check(id, ok, value, threshold, ok ? null : message);
    }

    private static String sides(Set<String> truncated) {
        if (truncated == null || truncated.isEmpty()) {
            return "";
        }
        return String.join(", ", truncated.stream().map(s -> Msg.t("photoAcceptance.lado." + s)).toList());
    }

    /** Pedaços separados da máscara (alfa &gt; 128) com pelo menos {@link #COMPONENT_MIN_SHARE} da área da peça. */
    static int components(BufferedImage img) {
        int w = img.getWidth();
        int h = img.getHeight();
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        boolean[] on = new boolean[w * h];
        int total = 0;
        for (int i = 0; i < px.length; i++) {
            on[i] = (px[i] >>> 24) > 128;
            if (on[i]) {
                total++;
            }
        }
        if (total == 0) {
            return 0;
        }
        boolean[] seen = new boolean[w * h];
        List<Integer> sizes = new ArrayList<>();
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        for (int start = 0; start < on.length; start++) {
            if (!on[start] || seen[start]) {
                continue;
            }
            int size = 0;
            queue.add(start);
            seen[start] = true;
            while (!queue.isEmpty()) {
                int i = queue.poll();
                size++;
                int x = i % w;
                int y = i / w;
                for (int dy = -1; dy <= 1; dy++) {
                    for (int dx = -1; dx <= 1; dx++) {
                        int nx = x + dx;
                        int ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
                            continue;
                        }
                        int j = ny * w + nx;
                        if (on[j] && !seen[j]) {
                            seen[j] = true;
                            queue.add(j);
                        }
                    }
                }
            }
            sizes.add(size);
        }
        final int all = total;
        return (int) sizes.stream().filter(s -> s >= all * COMPONENT_MIN_SHARE).count();
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
