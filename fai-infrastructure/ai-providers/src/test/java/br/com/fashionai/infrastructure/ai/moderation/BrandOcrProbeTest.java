package br.com.fashionai.infrastructure.ai.moderation;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.TextReaderPort;
import br.com.fashionai.application.imaging.WornPieceRegions;
import br.com.fashionai.infrastructure.ai.ocr.OnnxTextReader;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.awt.image.ConvolveOp;
import java.awt.image.Kernel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;

/**
 * Sonda do OCR em tecido dobrado (fora do repositório; -Dfai.probe.dir): para a peça de cima de cada foto vestida, o que
 * o leitor devolve em cada variação (escala, nitidez, contraste local, rotação), sem limiar — para escolher a correção.
 */
class BrandOcrProbeTest {
    @Test
    void variants() throws Exception {
        String dir = System.getProperty("fai.probe.dir");
        Assumptions.assumeTrue(dir != null && !dir.isBlank());
        Path out = Path.of(dir, "out");
        Files.createDirectories(out);
        OnnxPersonSegmenter seg = new OnnxPersonSegmenter();
        OnnxTextReader ocr = new OnnxTextReader();
        for (Path f : Files.list(Path.of(dir)).filter(p -> p.toString().matches("(?i).*\\.(jpe?g|png)$")).sorted().toList()) {
            BufferedImage img = ImageOps.decode(Files.readAllBytes(f));
            var map = seg.classes(img);
            if (map.isEmpty()) continue;
            List<WornPieceRegions.Worn> worn = WornPieceRegions.detect(img, map.get());
            WornPieceRegions.Worn upper = worn.stream().filter(w -> w.kind() == WornPieceRegions.Kind.UPPER || w.kind() == WornPieceRegions.Kind.FULL).findFirst().orElse(null);
            if (upper == null) continue;
            int x0 = (int) (upper.x() * img.getWidth() / 100), y0 = (int) (upper.y() * img.getHeight() / 100);
            int cw = (int) Math.min(img.getWidth() - x0, Math.ceil(upper.width() * img.getWidth() / 100)), ch = (int) Math.min(img.getHeight() - y0, Math.ceil(upper.height() * img.getHeight() / 100));
            BufferedImage crop = img.getSubimage(x0, y0, cw, ch);
            String name = f.getFileName().toString().replaceAll("\\.[^.]+$", "");
            Files.write(out.resolve(name + "-upper.png"), ImageOps.png(ImageOps.scaleToFit(crop, 600, 600)));
            System.out.println("### " + name + " upper " + cw + "x" + ch);
            // zonas do peito (BrandRegions) × escala × rotação × polaridade × divisão de caixas altas em duas linhas
            for (br.com.fashionai.application.imaging.BrandRegions.Zone z : br.com.fashionai.application.imaging.BrandRegions.zones(crop, "upper_piece")) {
                BufferedImage zc = br.com.fashionai.application.imaging.BrandRegions.crop(crop, z, 768);
                for (boolean invert : new boolean[]{false, true}) {
                    for (int rot : new int[]{-8, 0, 8}) {
                        BufferedImage v = invert ? invert(zc) : zc;
                        if (rot != 0) v = ImageOps.rotate(v, rot);
                        String plain = lines(ocr.read(v)), split = lines(readSplit(ocr, v));
                        if (!plain.isBlank() || !split.isBlank()) System.out.println(String.format(Locale.ROOT, "zone=%s inv=%s rot=%d: %s || split: %s", z.id(), invert, rot, plain, split));
                    }
                }
            }
            if (System.getProperty("fai.probe.full") == null) continue;
            for (int scale : new int[]{1, 2, 3}) {
                for (boolean sharpen : new boolean[]{false, true}) {
                    for (boolean contrast : new boolean[]{false, true}) {
                        for (int rot : new int[]{-12, -6, 0, 6, 12}) {
                            BufferedImage v = ImageOps.scale(crop, cw * scale, ch * scale);
                            if (contrast) v = localContrast(v);
                            if (sharpen) v = sharpen(v);
                            if (rot != 0) v = ImageOps.rotate(v, rot);
                            StringBuilder sb = new StringBuilder();
                            for (TextReaderPort.Line l : ocr.read(v)) {
                                sb.append(String.format(Locale.ROOT, "[%s %.2f] ", l.text(), l.confidence()));
                            }
                            if (sb.length() > 0) {
                                System.out.println(String.format(Locale.ROOT, "s%d sharp=%s contrast=%s rot=%d: %s", scale, sharpen, contrast, rot, sb));
                            }
                        }
                    }
                }
            }
        }
    }

    static String lines(List<TextReaderPort.Line> ls) {
        StringBuilder sb = new StringBuilder();
        for (TextReaderPort.Line l : ls) sb.append(String.format(Locale.ROOT, "[%s %.2f] ", l.text(), l.confidence()));
        return sb.toString();
    }

    /** caixa alta (duas linhas juntas pela dilatação): lê a metade de cima e a de baixo separadamente */
    static List<TextReaderPort.Line> readSplit(TextReaderPort ocr, BufferedImage img) {
        List<TextReaderPort.Line> out = new java.util.ArrayList<>();
        for (TextReaderPort.Line l : ocr.read(img)) {
            double[] b = l.box();
            int x0 = (int) (b[0] * img.getWidth()), y0 = (int) (b[1] * img.getHeight());
            int bw = Math.max(1, (int) ((b[2] - b[0]) * img.getWidth())), bh = Math.max(1, (int) ((b[3] - b[1]) * img.getHeight()));
            if (bh > bw * 0.45 && bh >= 24) {
                int pad = bh / 8;
                for (int half = 0; half < 2; half++) {
                    int yy = Math.max(0, y0 + half * bh / 2 - pad), hh = Math.min(img.getHeight() - yy, bh / 2 + 2 * pad);
                    BufferedImage part = ImageOps.scale(img.getSubimage(Math.max(0, x0 - pad), yy, Math.min(img.getWidth() - Math.max(0, x0 - pad), bw + 2 * pad), hh), (bw + 2 * pad) * 3, hh * 3);
                    out.addAll(ocr.read(part));
                }
            } else {
                out.add(l);
            }
        }
        return out;
    }

    static BufferedImage invert(BufferedImage src) {
        BufferedImage out = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < src.getHeight(); y++) for (int x = 0; x < src.getWidth(); x++) out.setRGB(x, y, ~src.getRGB(x, y) & 0xFFFFFF);
        return out;
    }

    static BufferedImage sharpen(BufferedImage src) {
        BufferedImage rgb = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(src, 0, 0, null);
        g.dispose();
        float[] k = {0, -1, 0, -1, 5, -1, 0, -1, 0};
        return new ConvolveOp(new Kernel(3, 3, k), ConvolveOp.EDGE_NO_OP, null).filter(rgb, null);
    }

    /** contraste local: cada pixel menos a média da vizinhança (32 px) somada ao cinza médio, amplificado 1,6x */
    static BufferedImage localContrast(BufferedImage src) {
        int w = src.getWidth(), h = src.getHeight();
        int[] px = src.getRGB(0, 0, w, h, null, 0, w);
        float[] lum = new float[w * h];
        for (int i = 0; i < px.length; i++) {
            lum[i] = (((px[i] >> 16) & 255) * 0.299f + ((px[i] >> 8) & 255) * 0.587f + (px[i] & 255) * 0.114f);
        }
        int r = Math.max(8, Math.min(w, h) / 10);
        float[] blur = boxBlur(lum, w, h, r);
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        int[] o = new int[w * h];
        for (int i = 0; i < px.length; i++) {
            int v = Math.max(0, Math.min(255, Math.round(128 + (lum[i] - blur[i]) * 1.6f)));
            o[i] = (v << 16) | (v << 8) | v;
        }
        out.setRGB(0, 0, w, h, o, 0, w);
        return out;
    }

    static float[] boxBlur(float[] in, int w, int h, int r) {
        float[] tmp = new float[in.length], out = new float[in.length];
        for (int y = 0; y < h; y++) {
            float s = 0; int n = 0;
            for (int x = -r; x <= r; x++) { if (x >= 0 && x < w) { s += in[y * w + x]; n++; } }
            for (int x = 0; x < w; x++) {
                tmp[y * w + x] = s / n;
                int add = x + r + 1, rem = x - r;
                if (add < w) { s += in[y * w + add]; n++; }
                if (rem >= 0) { s -= in[y * w + rem]; n--; }
            }
        }
        for (int x = 0; x < w; x++) {
            float s = 0; int n = 0;
            for (int y = -r; y <= r; y++) { if (y >= 0 && y < h) { s += tmp[y * w + x]; n++; } }
            for (int y = 0; y < h; y++) {
                out[y * w + x] = s / n;
                int add = y + r + 1, rem = y - r;
                if (add < h) { s += tmp[add * w + x]; n++; }
                if (rem >= 0) { s -= tmp[rem * w + x]; n--; }
            }
        }
        return out;
    }
}
