package br.com.fashionai.infrastructure.ai.ocr;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import br.com.fashionai.application.imaging.TextReaderPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.nio.FloatBuffer;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * OCR local (RF4 — marca pelo logo sem depender de IA remota): PP-OCRv4 (PaddleOCR, Apache-2.0) em ONNX, os mesmos
 * modelos do RapidOCR, rodando no servidor com o ONNX Runtime. Duas etapas:
 * <ol>
 *   <li><b>Detecção</b> (DBNet): mapa de probabilidade de texto → componentes conexos → caixas (lado menor ≥ 736 px,
 *       múltiplo de 32; limiar 0,3; caixa com média ≥ 0,5; expansão 1,6).</li>
 *   <li><b>Reconhecimento</b> (CRNN): cada caixa em altura 48 → decodificação CTC gulosa com o dicionário embutido no
 *       próprio modelo (metadado {@code character}).</li>
 * </ol>
 * Entrada das duas redes: BGR, (x/255 − 0,5)/0,5, como no RapidOCR. Texto vertical e girado não é tratado (logos de
 * roupa são horizontais).
 */
@Component
public class OnnxTextReader implements TextReaderPort {
    private static final Logger log = LoggerFactory.getLogger(OnnxTextReader.class);
    static final String DET = "/models/ocr/ppocrv4_det.onnx";
    static final String REC = "/models/ocr/ppocrv4_rec.onnx";
    private static final int DET_MIN_SIDE = 736, DET_MAX_SIDE = 1600, REC_H = 48, REC_MAX_W = 1280;
    private static final float DB_THRESH = 0.3f, BOX_THRESH = 0.5f;
    private static final double UNCLIP = 1.6;
    private static final int MAX_BOXES = 60;

    private final Object lock = new Object();
    private volatile boolean failed;
    private OrtSession det, rec;
    private String detIn, recIn;
    private List<String> dict;

    @Override
    public boolean available() {
        return !failed;
    }

    @Override
    public List<Line> read(BufferedImage source) {
        if (!init()) {
            return List.of();
        }
        BufferedImage img = onWhite(source, DET_MAX_SIDE);
        int w = img.getWidth(), h = img.getHeight();
        try {
            List<int[]> boxes = detect(img);
            List<Line> out = new ArrayList<>();
            for (int[] b : boxes) {
                int bw = b[2] - b[0], bh = b[3] - b[1];
                if (bw < 4 || bh < 4 || bh > bw * 1.5) {
                    continue;                                     // vertical ou minúsculo: fora
                }
                Line line = recognize(img.getSubimage(b[0], b[1], bw, bh),
                        new double[]{b[0] / (double) w, b[1] / (double) h, b[2] / (double) w, b[3] / (double) h});
                if (line != null && !line.text().isBlank()) {
                    out.add(line);
                }
            }
            return out;
        } catch (Exception ex) {
            log.warn("OCR local falhou: {}", ex.getMessage());
            return List.of();
        }
    }

    // ------------------------------------------------------------------ detecção (DBNet)
    private List<int[]> detect(BufferedImage img) throws Exception {
        int w = img.getWidth(), h = img.getHeight();
        double ratio = Math.min(w, h) < DET_MIN_SIDE ? DET_MIN_SIDE / (double) Math.min(w, h) : 1.0;
        if (Math.max(w, h) * ratio > 2000) {
            ratio = 2000.0 / Math.max(w, h);
        }
        int rw = Math.max(32, (int) Math.round(w * ratio / 32.0) * 32);
        int rh = Math.max(32, (int) Math.round(h * ratio / 32.0) * 32);
        BufferedImage r = scale(img, rw, rh);
        float[] prob;
        OrtEnvironment env = OrtEnvironment.getEnvironment();
        try (OnnxTensor t = OnnxTensor.createTensor(env, chw(r), new long[]{1, 3, rh, rw});
             OrtSession.Result res = det.run(Map.of(detIn, t))) {
            FloatBuffer fb = ((OnnxTensor) res.get(0)).getFloatBuffer();
            prob = new float[rw * rh];
            fb.get(prob);
        }
        boolean[] bin = new boolean[prob.length];
        for (int i = 0; i < prob.length; i++) {
            bin[i] = prob[i] > DB_THRESH;
        }
        // dilatação 2x2 (use_dilation do PP-OCR): junta letras vizinhas da mesma palavra
        boolean[] dil = bin.clone();
        for (int y = 0; y < rh; y++) {
            for (int x = 0; x < rw; x++) {
                if (bin[y * rw + x]) {
                    if (x + 1 < rw) dil[y * rw + x + 1] = true;
                    if (y + 1 < rh) dil[(y + 1) * rw + x] = true;
                    if (x + 1 < rw && y + 1 < rh) dil[(y + 1) * rw + x + 1] = true;
                }
            }
        }
        List<int[]> boxes = new ArrayList<>();
        boolean[] seen = new boolean[dil.length];
        ArrayDeque<Integer> stack = new ArrayDeque<>();
        for (int i = 0; i < dil.length; i++) {
            if (!dil[i] || seen[i]) {
                continue;
            }
            int x0 = rw, y0 = rh, x1 = -1, y1 = -1, n = 0;
            double sum = 0;
            stack.push(i);
            seen[i] = true;
            while (!stack.isEmpty()) {
                int p = stack.pop();
                int px = p % rw, py = p / rw;
                x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
                sum += prob[p];
                n++;
                for (int dy = -1; dy <= 1; dy++) {
                    for (int dx = -1; dx <= 1; dx++) {
                        int nx = px + dx, ny = py + dy;
                        if (nx >= 0 && ny >= 0 && nx < rw && ny < rh) {
                            int q = ny * rw + nx;
                            if (dil[q] && !seen[q]) {
                                seen[q] = true;
                                stack.push(q);
                            }
                        }
                    }
                }
            }
            int bw = x1 - x0 + 1, bh = y1 - y0 + 1;
            if (Math.min(bw, bh) < 3 || sum / n < BOX_THRESH) {
                continue;
            }
            // unclip: afasta cada lado pela distância área × razão ÷ perímetro (retângulo)
            double d = bw * (double) bh * UNCLIP / (2.0 * (bw + bh));
            double sx = w / (double) rw, sy = h / (double) rh;
            int ax0 = clamp((int) Math.floor((x0 - d) * sx), w), ay0 = clamp((int) Math.floor((y0 - d) * sy), h);
            int ax1 = clamp((int) Math.ceil((x1 + 1 + d) * sx), w), ay1 = clamp((int) Math.ceil((y1 + 1 + d) * sy), h);
            if (ax1 - ax0 >= 5 && ay1 - ay0 >= 5) {
                boxes.add(new int[]{ax0, ay0, ax1, ay1, n});
            }
        }
        boxes = mergeLine(boxes);
        boxes.sort(Comparator.comparingInt((int[] b) -> -b[4]));
        List<int[]> top = new ArrayList<>(boxes.subList(0, Math.min(MAX_BOXES, boxes.size())));
        top.sort(Comparator.<int[]>comparingInt(b -> b[1]).thenComparingInt(b -> b[0]));
        return top;
    }

    /**
     * Junta caixas da mesma linha de texto: em letra grande (logo no peito), a primeira ou a última letra às vezes vira
     * um bloco à parte, mais alto que largo, que sozinho seria descartado como texto vertical ("L" + "ACOSTE"). Duas
     * caixas se juntam quando se sobrepõem na vertical (≥ 55% da menor altura), têm altura parecida (razão ≤ 1,6) e o vão
     * entre elas é menor que 0,6 × a altura.
     */
    static List<int[]> mergeLine(List<int[]> in) {
        List<int[]> boxes = new ArrayList<>(in);
        boolean merged = true;
        while (merged) {
            merged = false;
            outer:
            for (int i = 0; i < boxes.size(); i++) {
                for (int j = i + 1; j < boxes.size(); j++) {
                    int[] a = boxes.get(i), b = boxes.get(j);
                    int ha = a[3] - a[1], hb = b[3] - b[1];
                    int overlap = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
                    int gap = Math.max(a[0], b[0]) - Math.min(a[2], b[2]);
                    if (overlap >= 0.55 * Math.min(ha, hb) && Math.max(ha, hb) <= 1.6 * Math.min(ha, hb) && gap < 0.6 * Math.max(ha, hb)) {
                        boxes.set(i, new int[]{Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3]), a[4] + b[4]});
                        boxes.remove(j);
                        merged = true;
                        break outer;
                    }
                }
            }
        }
        return boxes;
    }

    // ------------------------------------------------------------------ reconhecimento (CRNN + CTC)
    private Line recognize(BufferedImage crop, double[] box) throws Exception {
        int w = crop.getWidth(), h = crop.getHeight();
        int tw = Math.min(REC_MAX_W, Math.max(REC_H, (int) Math.ceil(REC_H * (double) w / h)));
        int padW = Math.max(320, tw);
        BufferedImage r = scale(crop, tw, REC_H);
        float[] data = new float[3 * REC_H * padW];              // resto à direita = 0 (preenchimento do PP-OCR)
        int plane = REC_H * padW;
        for (int y = 0; y < REC_H; y++) {
            for (int x = 0; x < tw; x++) {
                int rgb = r.getRGB(x, y);
                int i = y * padW + x;
                data[i] = norm(rgb & 0xFF);                        // B
                data[plane + i] = norm((rgb >> 8) & 0xFF);         // G
                data[2 * plane + i] = norm((rgb >> 16) & 0xFF);    // R
            }
        }
        OrtEnvironment env = OrtEnvironment.getEnvironment();
        try (OnnxTensor t = OnnxTensor.createTensor(env, FloatBuffer.wrap(data), new long[]{1, 3, REC_H, padW});
             OrtSession.Result res = rec.run(Map.of(recIn, t))) {
            OnnxTensor o = (OnnxTensor) res.get(0);
            long[] shape = o.getInfo().getShape();
            int steps = (int) shape[1], classes = (int) shape[2];
            FloatBuffer fb = o.getFloatBuffer();
            StringBuilder sb = new StringBuilder();
            double conf = 0;
            int kept = 0, prev = 0;
            for (int s = 0; s < steps; s++) {
                int best = 0;
                float bp = -1;
                for (int c = 0; c < classes; c++) {
                    float v = fb.get(s * classes + c);
                    if (v > bp) {
                        bp = v;
                        best = c;
                    }
                }
                if (best != 0 && best != prev && best < dict.size()) {
                    sb.append(dict.get(best));
                    conf += bp;
                    kept++;
                }
                prev = best;
            }
            return kept == 0 ? null : new Line(sb.toString().trim(), conf / kept, box);
        }
    }

    // ------------------------------------------------------------------ utilidades
    private boolean init() {
        if (rec != null) {
            return true;
        }
        if (failed) {
            return false;
        }
        synchronized (lock) {
            if (rec == null && !failed) {
                try {
                    OrtEnvironment env = OrtEnvironment.getEnvironment();
                    OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
                    opts.setIntraOpNumThreads(2);
                    OrtSession d = env.createSession(bytes(DET), opts);
                    OrtSession r = env.createSession(bytes(REC), opts);
                    String chars = r.getMetadata().getCustomMetadata().get("character");
                    if (chars == null || chars.isEmpty()) {
                        throw new IllegalStateException("dicionário ausente no modelo de reconhecimento");
                    }
                    List<String> dct = new ArrayList<>();
                    dct.add("");                                   // 0 = branco do CTC
                    // mesma lista do RapidOCR (splitlines): nenhuma linha é descartada, senão os índices se deslocam
                    List<String> lines = new ArrayList<>(List.of(chars.split("\n", -1)));
                    if (chars.endsWith("\n")) {
                        lines.remove(lines.size() - 1);
                    }
                    dct.addAll(lines);
                    dct.add(" ");                                  // espaço no fim (use_space_char)
                    detIn = d.getInputNames().iterator().next();
                    recIn = r.getInputNames().iterator().next();
                    dict = dct;
                    det = d;
                    rec = r;
                } catch (Throwable ex) {                           // sem modelo ou sem biblioteca nativa: porta indisponível
                    failed = true;
                    log.error("OCR local indisponível: {}", ex.toString());
                }
            }
            return rec != null;
        }
    }

    private static byte[] bytes(String res) throws Exception {
        try (InputStream is = OnnxTextReader.class.getResourceAsStream(res)) {
            if (is == null) {
                throw new IllegalStateException("modelo ausente: " + res);
            }
            return is.readAllBytes();
        }
    }

    private static FloatBuffer chw(BufferedImage img) {
        int w = img.getWidth(), h = img.getHeight(), plane = w * h;
        float[] data = new float[3 * plane];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int rgb = img.getRGB(x, y);
                int i = y * w + x;
                data[i] = norm(rgb & 0xFF);
                data[plane + i] = norm((rgb >> 8) & 0xFF);
                data[2 * plane + i] = norm((rgb >> 16) & 0xFF);
            }
        }
        return FloatBuffer.wrap(data);
    }

    private static float norm(int v) {
        return (v / 255f - 0.5f) / 0.5f;
    }

    private static int clamp(int v, int max) {
        return Math.max(0, Math.min(max, v));
    }

    /** RGB sobre branco (peça recortada com transparência) e lado maior limitado. */
    static BufferedImage onWhite(BufferedImage src, int maxSide) {
        double k = Math.min(1.0, maxSide / (double) Math.max(src.getWidth(), src.getHeight()));
        int w = Math.max(1, (int) Math.round(src.getWidth() * k)), h = Math.max(1, (int) Math.round(src.getHeight() * k));
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, w, h);
        g.drawImage(src, 0, 0, w, h, null);
        g.dispose();
        return out;
    }

    private static BufferedImage scale(BufferedImage src, int w, int h) {
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(src, 0, 0, w, h, null);
        g.dispose();
        return out;
    }
}
