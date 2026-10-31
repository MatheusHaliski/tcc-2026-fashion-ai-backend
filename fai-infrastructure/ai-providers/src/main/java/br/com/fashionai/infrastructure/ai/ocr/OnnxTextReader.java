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
import java.util.ArrayList;
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
 * roupa são horizontais). O pós-processamento puro fica em {@link DbNetBoxes} (caixas) e {@link CtcGreedyDecoder} (texto);
 * aqui ficam só o ciclo de vida das sessões ONNX, a conversão da imagem em tensor e a montagem das {@code Line}.
 */
@Component
public class OnnxTextReader implements TextReaderPort {
    private static final Logger log = LoggerFactory.getLogger(OnnxTextReader.class);
    static final String DET = "/models/ocr/ppocrv4_det.onnx";
    static final String REC = "/models/ocr/ppocrv4_rec.onnx";
    private static final int DET_MAX_SIDE = 1600, REC_H = 48, REC_MAX_W = 1280;

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

    /** Só o CRNN num recorte de uma linha (sem o detector): ~30 ms, para as variações da leitura em tecido dobrado. */
    @Override
    public java.util.Optional<Line> recognize(BufferedImage lineCrop) {
        if (!init() || lineCrop.getWidth() < 4 || lineCrop.getHeight() < 4) {
            return java.util.Optional.empty();
        }
        try {
            Line line = recognize(onWhite(lineCrop, REC_MAX_W), null);
            return line == null || line.text().isBlank() ? java.util.Optional.empty() : java.util.Optional.of(line);
        } catch (Exception ex) {
            log.warn("OCR local (reconhecimento) falhou: {}", ex.getMessage());
            return java.util.Optional.empty();
        }
    }

    // ------------------------------------------------------------------ detecção (DBNet)
    private List<int[]> detect(BufferedImage img) throws Exception {
        int w = img.getWidth(), h = img.getHeight();
        int[] size = DbNetBoxes.inputSize(w, h);
        int rw = size[0], rh = size[1];
        BufferedImage r = scale(img, rw, rh);
        float[] prob;
        OrtEnvironment env = OrtEnvironment.getEnvironment();
        try (OnnxTensor t = OnnxTensor.createTensor(env, chw(r), new long[]{1, 3, rh, rw});
             OrtSession.Result res = det.run(Map.of(detIn, t))) {
            FloatBuffer fb = ((OnnxTensor) res.get(0)).getFloatBuffer();
            prob = new float[rw * rh];
            fb.get(prob);
        }
        return DbNetBoxes.boxes(prob, rw, rh, w, h);
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
            CtcGreedyDecoder.Decoded text = CtcGreedyDecoder.decode(o.getFloatBuffer(), (int) shape[1], (int) shape[2], dict);
            return text == null ? null : new Line(text.text(), text.confidence(), box);
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
                    List<String> dct = CtcGreedyDecoder.dictionary(r.getMetadata().getCustomMetadata().get("character"));
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
