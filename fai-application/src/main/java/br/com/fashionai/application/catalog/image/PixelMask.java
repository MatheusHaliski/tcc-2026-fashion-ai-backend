package br.com.fashionai.application.catalog.image;

import java.awt.image.BufferedImage;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Máscara por pixel (0–255) no espaço de uma imagem de trabalho: o produto, a pessoa, a roupa, um objeto. Operações
 * só de conjunto (e, ou, menos), componentes conexos e dilatação — nada que crie conteúdo. 255 = dentro.
 */
public final class PixelMask {
    private final int width;
    private final int height;
    private final byte[] v;

    public PixelMask(int width, int height) {
        if (width <= 0 || height <= 0) {
            throw new IllegalArgumentException("máscara vazia");
        }
        this.width = width;
        this.height = height;
        this.v = new byte[width * height];
    }

    private PixelMask(int width, int height, byte[] v) {
        this.width = width;
        this.height = height;
        this.v = v;
    }

    /** Alfa da imagem (ARGB); sem canal alfa, tudo dentro. */
    public static PixelMask fromAlpha(BufferedImage img) {
        int w = img.getWidth(), h = img.getHeight();
        PixelMask m = new PixelMask(w, h);
        boolean alpha = img.getColorModel().hasAlpha();
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        for (int i = 0; i < px.length; i++) {
            m.v[i] = (byte) (alpha ? (px[i] >>> 24) : 255);
        }
        return m;
    }

    public int width() {
        return width;
    }

    public int height() {
        return height;
    }

    public int get(int x, int y) {
        return v[y * width + x] & 0xFF;
    }

    public void set(int x, int y, int value) {
        v[y * width + x] = (byte) Math.max(0, Math.min(255, value));
    }

    public boolean on(int x, int y) {
        return get(x, y) >= 128;
    }

    public PixelMask copy() {
        return new PixelMask(width, height, v.clone());
    }

    /** Pixels "dentro" (≥ 128). */
    public long count() {
        long n = 0;
        for (byte b : v) {
            if ((b & 0xFF) >= 128) {
                n++;
            }
        }
        return n;
    }

    public double fraction() {
        return count() / (double) v.length;
    }

    /** Caixa dos pixels dentro, normalizada; vazia quando não há nenhum. */
    public Region bounds() {
        int x0 = width, y0 = height, x1 = -1, y1 = -1;
        for (int y = 0; y < height; y++) {
            int row = y * width;
            for (int x = 0; x < width; x++) {
                if ((v[row + x] & 0xFF) >= 128) {
                    x0 = Math.min(x0, x);
                    x1 = Math.max(x1, x);
                    y0 = Math.min(y0, y);
                    y1 = Math.max(y1, y);
                }
            }
        }
        if (x1 < 0) {
            return new Region(0, 0, 0, 0);
        }
        return new Region(x0 / (double) width, y0 / (double) height, (x1 + 1) / (double) width, (y1 + 1) / (double) height);
    }

    /** Fração dos pixels de {@code this} que também estão em {@code o} (mesma resolução ou reamostrada). */
    public double overlap(PixelMask o) {
        PixelMask b = o.width == width && o.height == height ? o : o.resized(width, height);
        long in = 0, both = 0;
        for (int i = 0; i < v.length; i++) {
            if ((v[i] & 0xFF) >= 128) {
                in++;
                if ((b.v[i] & 0xFF) >= 128) {
                    both++;
                }
            }
        }
        return in == 0 ? 0 : both / (double) in;
    }

    public PixelMask and(PixelMask o) {
        PixelMask b = same(o);
        byte[] out = new byte[v.length];
        for (int i = 0; i < v.length; i++) {
            out[i] = (byte) Math.min(v[i] & 0xFF, b.v[i] & 0xFF);
        }
        return new PixelMask(width, height, out);
    }

    public PixelMask or(PixelMask o) {
        PixelMask b = same(o);
        byte[] out = new byte[v.length];
        for (int i = 0; i < v.length; i++) {
            out[i] = (byte) Math.max(v[i] & 0xFF, b.v[i] & 0xFF);
        }
        return new PixelMask(width, height, out);
    }

    /** {@code this} sem os pixels de {@code o}: o que {@code o} cobre fica fora (buraco transparente, nunca preenchido). */
    public PixelMask minus(PixelMask o) {
        PixelMask b = same(o);
        byte[] out = new byte[v.length];
        for (int i = 0; i < v.length; i++) {
            out[i] = (byte) Math.max(0, (v[i] & 0xFF) - (b.v[i] & 0xFF));
        }
        return new PixelMask(width, height, out);
    }

    /** Dilatação binária quadrada de raio {@code r} pixels. */
    public PixelMask dilate(int r) {
        if (r <= 0) {
            return copy();
        }
        PixelMask horiz = new PixelMask(width, height);
        for (int y = 0; y < height; y++) {
            int row = y * width;
            int last = -1_000_000;
            for (int x = 0; x < width; x++) {
                if ((v[row + x] & 0xFF) >= 128) {
                    last = x;
                }
                if (x - last <= r) {
                    horiz.v[row + x] = (byte) 255;
                }
            }
            last = 1_000_000;
            for (int x = width - 1; x >= 0; x--) {
                if ((v[row + x] & 0xFF) >= 128) {
                    last = x;
                }
                if (last - x <= r) {
                    horiz.v[row + x] = (byte) 255;
                }
            }
        }
        PixelMask out = new PixelMask(width, height);
        for (int x = 0; x < width; x++) {
            int last = -1_000_000;
            for (int y = 0; y < height; y++) {
                if ((horiz.v[y * width + x] & 0xFF) >= 128) {
                    last = y;
                }
                if (y - last <= r) {
                    out.v[y * width + x] = (byte) 255;
                }
            }
            last = 1_000_000;
            for (int y = height - 1; y >= 0; y--) {
                if ((horiz.v[y * width + x] & 0xFF) >= 128) {
                    last = y;
                }
                if (last - y <= r) {
                    out.v[y * width + x] = (byte) 255;
                }
            }
        }
        return out;
    }

    /** Componentes conexos (vizinhança 4) dos pixels dentro, do maior para o menor. */
    public List<PixelMask> components() {
        int[] label = new int[v.length];
        Arrays.fill(label, -1);
        List<int[]> sizes = new ArrayList<>();
        ArrayDeque<Integer> q = new ArrayDeque<>();
        int next = 0;
        for (int i = 0; i < v.length; i++) {
            if (label[i] != -1 || (v[i] & 0xFF) < 128) {
                continue;
            }
            int count = 0;
            label[i] = next;
            q.add(i);
            while (!q.isEmpty()) {
                int p = q.poll();
                count++;
                int x = p % width, y = p / width;
                if (x > 0) {
                    visit(p - 1, next, label, q);
                }
                if (x < width - 1) {
                    visit(p + 1, next, label, q);
                }
                if (y > 0) {
                    visit(p - width, next, label, q);
                }
                if (y < height - 1) {
                    visit(p + width, next, label, q);
                }
            }
            sizes.add(new int[]{next, count});
            next++;
        }
        sizes.sort((a, b) -> Integer.compare(b[1], a[1]));
        List<PixelMask> out = new ArrayList<>();
        for (int[] s : sizes) {
            PixelMask m = new PixelMask(width, height);
            for (int i = 0; i < v.length; i++) {
                if (label[i] == s[0]) {
                    m.v[i] = v[i];
                }
            }
            out.add(m);
        }
        return out;
    }

    private void visit(int p, int lbl, int[] label, ArrayDeque<Integer> q) {
        if (label[p] == -1 && (v[p] & 0xFF) >= 128) {
            label[p] = lbl;
            q.add(p);
        }
    }

    /** Reamostragem por vizinho mais próximo (máscaras de modelos em baixa resolução → imagem de trabalho). */
    public PixelMask resized(int w, int h) {
        PixelMask out = new PixelMask(w, h);
        for (int y = 0; y < h; y++) {
            int sy = Math.min(height - 1, (int) ((y + 0.5) * height / h));
            for (int x = 0; x < w; x++) {
                int sx = Math.min(width - 1, (int) ((x + 0.5) * width / w));
                out.v[y * w + x] = v[sy * width + sx];
            }
        }
        return out;
    }

    /** Aplica a máscara como alfa sobre a imagem (mesmo tamanho): fora da máscara, transparente. */
    public BufferedImage applyTo(BufferedImage img) {
        PixelMask m = img.getWidth() == width && img.getHeight() == height ? this : resized(img.getWidth(), img.getHeight());
        int w = img.getWidth(), h = img.getHeight();
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        boolean hasAlpha = img.getColorModel().hasAlpha();
        for (int i = 0; i < px.length; i++) {
            int a = hasAlpha ? px[i] >>> 24 : 255;
            int na = a * (m.v[i] & 0xFF) / 255;
            px[i] = (na << 24) | (px[i] & 0x00FFFFFF);
        }
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        out.setRGB(0, 0, w, h, px, 0, w);
        return out;
    }

    private PixelMask same(PixelMask o) {
        return o.width == width && o.height == height ? o : o.resized(width, height);
    }
}
