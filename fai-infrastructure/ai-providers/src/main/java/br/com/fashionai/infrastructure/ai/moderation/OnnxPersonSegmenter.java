package br.com.fashionai.infrastructure.ai.moderation;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import br.com.fashionai.application.moderation.ImageSafetyPorts;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonParts;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonSegmentationPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.nio.FloatBuffer;
import java.util.Map;
import java.util.Optional;

/**
 * Segmentação de pessoa local (moderação de imagens enviadas, docs/seguranca/moderacao-de-imagens.md): o modelo
 * selfie_multiclass_256x256 do MediaPipe (Apache-2.0), convertido para ONNX por
 * {@code scripts/moderacao/converter-segmentador.sh}, separa cada pixel em fundo, cabelo, pele do corpo, pele do rosto,
 * roupa e acessório. Roda no próprio servidor, sem enviar a foto a ninguém. Entrada: RGB 256×256 em [0, 1], imagem
 * encaixada sem distorcer (faixas pretas); saída: probabilidade das 6 classes por pixel.
 */
@Component
public class OnnxPersonSegmenter implements PersonSegmentationPort {
    private static final Logger log = LoggerFactory.getLogger(OnnxPersonSegmenter.class);
    static final String MODEL = "/models/selfie_multiclass_256x256.onnx";
    private static final int SIZE = 256;
    private static final int CLASSES = 6;
    private static final int BODY_SKIN = 2, FACE_SKIN = 3, CLOTHES = 4;

    private final Object lock = new Object();
    private volatile boolean failed;
    private OrtSession session;
    private String input;

    @Override
    public boolean available() {
        return !failed;
    }

    @Override
    public Optional<PersonParts> segment(BufferedImage image) {
        return classes(image).map(map -> {
            long[] count = new long[CLASSES];
            for (byte c : map.classes()) {
                count[c]++;
            }
            long valid = (long) map.width() * map.height(), person = valid - count[0];
            double p = Math.max(1, person);
            return new PersonParts(person / (double) valid, count[BODY_SKIN] / p, count[FACE_SKIN] / p, count[CLOTHES] / p);
        });
    }

    /** A mesma inferência da moderação, devolvendo a classe de cada pixel (sem as faixas de encaixe). */
    @Override
    public Optional<ImageSafetyPorts.ClassMap> classes(BufferedImage image) {
        OrtSession s = session();
        if (s == null) {
            return Optional.empty();
        }
        int w = image.getWidth(), h = image.getHeight();
        double k = SIZE / (double) Math.max(w, h);
        int sw = Math.max(1, (int) Math.round(w * k)), sh = Math.max(1, (int) Math.round(h * k));
        int ox = (SIZE - sw) / 2, oy = (SIZE - sh) / 2;
        BufferedImage canvas = new BufferedImage(SIZE, SIZE, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = canvas.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(image, ox, oy, sw, sh, null);
        g.dispose();
        FloatBuffer in = FloatBuffer.allocate(SIZE * SIZE * 3);
        for (int y = 0; y < SIZE; y++) {
            for (int x = 0; x < SIZE; x++) {
                int rgb = canvas.getRGB(x, y);
                in.put(((rgb >> 16) & 0xFF) / 255f).put(((rgb >> 8) & 0xFF) / 255f).put((rgb & 0xFF) / 255f);
            }
        }
        in.rewind();
        OrtEnvironment env = OrtEnvironment.getEnvironment();
        try (OnnxTensor t = OnnxTensor.createTensor(env, in, new long[]{1, SIZE, SIZE, 3});
             OrtSession.Result r = s.run(Map.of(input, t))) {
            FloatBuffer out = ((OnnxTensor) r.get(0)).getFloatBuffer();
            byte[] classes = new byte[sw * sh];
            for (int y = oy; y < oy + sh; y++) {
                for (int x = ox; x < ox + sw; x++) {
                    int base = (y * SIZE + x) * CLASSES, best = 0;
                    for (int c = 1; c < CLASSES; c++) {
                        if (out.get(base + c) > out.get(base + best)) {
                            best = c;
                        }
                    }
                    classes[(y - oy) * sw + (x - ox)] = (byte) best;
                }
            }
            return Optional.of(new ImageSafetyPorts.ClassMap(sw, sh, classes));
        } catch (Exception ex) {
            log.warn("Segmentação de pessoa falhou: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    /** Carrega o modelo na primeira imagem (16 MB); sem ele (ou sem a biblioteca nativa), a porta se declara indisponível. */
    private OrtSession session() {
        if (session != null || failed) {
            return session;
        }
        synchronized (lock) {
            if (session == null && !failed) {
                try (InputStream is = OnnxPersonSegmenter.class.getResourceAsStream(MODEL)) {
                    if (is == null) {
                        throw new IllegalStateException("modelo ausente: " + MODEL);
                    }
                    OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
                    opts.setIntraOpNumThreads(2);
                    OrtSession created = OrtEnvironment.getEnvironment().createSession(is.readAllBytes(), opts);
                    input = created.getInputNames().iterator().next();
                    session = created;
                } catch (Throwable ex) {       // UnsatisfiedLinkError da biblioteca nativa também desliga a porta
                    failed = true;
                    log.error("Segmentador de pessoa indisponível: {}", ex.toString());
                }
            }
            return session;
        }
    }
}
