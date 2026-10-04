package br.com.fashionai.application.imaging;

import br.com.fashionai.application.ai.local.ColorMath;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Files;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * RF4 · Estúdio da imagem padrão — catálogo da caixa do selo FAI em cada arte de /public/assets_pecas
 * ({@code catalog/default-piece-logos.json}). O teste garante que toda arte tem caixa válida; com
 * {@code -Dlogo.catalog.rebuild=1} o localizador abaixo refaz as caixas e grava, em {@code target/}, o JSON e uma imagem
 * por arte com a caixa desenhada, para a conferência visual (as caixas que o localizador erra são ajustadas à mão).
 */
class DefaultPieceLogoCatalogTest {
    static final File ASSETS = new File("../public/assets_pecas");
    static final File CATALOG = new File("../fai-web/src/main/resources/catalog/default-piece-logos.json");

    @Test
    @SuppressWarnings("unchecked")
    void everyDefaultArtHasAValidLogoBox() throws Exception {
        assumeTrue(ASSETS.isDirectory() && CATALOG.isFile(), "assets de peças fora do checkout");
        Map<String, Object> catalog = new ObjectMapper().readValue(CATALOG, Map.class);
        List<String> arts;
        try (Stream<java.nio.file.Path> files = Files.walk(ASSETS.toPath(), 2)) {
            arts = files.filter(p -> p.getParent() != null && p.getParent().getFileName().toString().matches("0\\d_.*"))
                    .filter(p -> p.toString().endsWith(".png"))
                    .map(p -> "/assets_pecas/" + ASSETS.toPath().relativize(p).toString().replace('\\', '/')).sorted().toList();
        }
        assertThat(arts).isNotEmpty();
        for (String art : arts) {
            assertThat(catalog).as("caixa do logo para %s", art).containsKey(art);
            List<Number> box = (List<Number>) ((Map<String, Object>) catalog.get(art)).get("box");
            assertThat(box).hasSize(4);
            assertThat(box.get(0).doubleValue()).isBetween(0.0, 1.0).isLessThan(box.get(2).doubleValue());
            assertThat(box.get(1).doubleValue()).isBetween(0.0, 1.0).isLessThan(box.get(3).doubleValue());
            assertThat(box.get(2).doubleValue()).isLessThanOrEqualTo(1.0);
            assertThat(box.get(3).doubleValue()).isLessThanOrEqualTo(1.0);
        }
        if (System.getProperty("logo.catalog.rebuild") == null) {
            return;
        }
        StringBuilder json = new StringBuilder("{\n");
        int k = 0;
        for (String art : arts) {
            BufferedImage img = ImageOps.toArgb(ImageIO.read(new File(ASSETS, art.substring("/assets_pecas/".length()))));
            double[] b = badge(img);
            if (b != null) {
                json.append(String.format(Locale.ROOT, "  \"%s\": {\"box\": [%.3f, %.3f, %.3f, %.3f], \"source\": \"selo\"},%n", art, b[0], b[1], b[2], b[3]));
            }
            ImageOps.Box gb = ImageOps.alphaBounds(img);
            BufferedImage out = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = out.createGraphics();
            g.setColor(new Color(0xDDDDDD));
            g.fillRect(0, 0, img.getWidth(), img.getHeight());
            g.drawImage(img, 0, 0, null);
            if (b != null) {
                g.setColor(Color.RED);
                g.setStroke(new BasicStroke(6));
                g.drawRect((int) (gb.x() + b[0] * gb.w()), (int) (gb.y() + b[1] * gb.h()), (int) ((b[2] - b[0]) * gb.w()), (int) ((b[3] - b[1]) * gb.h()));
            }
            g.dispose();
            ImageIO.write(out, "jpg", new File(String.format("target/logo-catalog-%02d.jpg", k++)));
        }
        Files.writeString(new File("target/default-piece-logos.json").toPath(), json.append("}\n").toString());
    }

    /**
     * Selo FAI: centro creme com a sacola preta "FAI", anel laranja e borda preta. Acha o centro creme (com a sacola
     * escura dentro) e mede o raio do selo lançando raios até a borda preta.
     */
    static double[] badge(BufferedImage src) {
        BufferedImage img = ImageOps.scaleToFit(src, 900, 900);
        int w = img.getWidth(), h = img.getHeight(), n = w * h;
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        boolean[] cream = new boolean[n], dark = new boolean[n], in = new boolean[n];
        for (int i = 0; i < n; i++) {
            if ((px[i] >>> 24) < 200) continue;
            in[i] = true;
            double[] lab = ColorMath.lab(px[i]);
            cream[i] = lab[0] > 70 && lab[1] > -8 && lab[1] < 20 && lab[2] > 0 && lab[2] < 42;
            dark[i] = lab[0] < 30;
        }
        // cor dominante do tecido (moda em Lab quantizado): o raio para quando volta ao tecido
        Map<Integer, Integer> hist = new HashMap<>();
        double[][] labs = new double[n][];
        for (int i = 0; i < n; i += 1) {
            if (!in[i]) continue;
            labs[i] = ColorMath.lab(px[i]);
            int key = ((int) (labs[i][0] / 8)) * 10000 + ((int) (labs[i][1] / 8) + 50) * 100 + ((int) (labs[i][2] / 8) + 50);
            hist.merge(key, 1, Integer::sum);
        }
        int mode = hist.entrySet().stream().max(Map.Entry.comparingByValue()).get().getKey();
        double fl = (mode / 10000) * 8 + 4, fa = ((mode / 100) % 100 - 50) * 8 + 4, fb = (mode % 100 - 50) * 8 + 4;
        boolean[] fabric = new boolean[n];
        for (int i = 0; i < n; i++) {
            if (labs[i] == null) continue;
            double dl = labs[i][0] - fl, da = labs[i][1] - fa, db = labs[i][2] - fb;
            fabric[i] = Math.sqrt(dl * dl * 0.5 + da * da + db * db) < 22;
        }
        boolean[] grown = cream.clone();
        for (int pass = 0; pass < 3; pass++) {
            boolean[] next = grown.clone();
            for (int y = 1; y < h - 1; y++) for (int x = 1; x < w - 1; x++) {
                int i = y * w + x;
                if (!grown[i] && (grown[i - 1] || grown[i + 1] || grown[i - w] || grown[i + w])) next[i] = true;
            }
            grown = next;
        }
        int[] label = new int[n];
        ArrayDeque<Integer> q = new ArrayDeque<>();
        double best = 0; double[] box = null; int id = 0;
        ImageOps.Box gb = ImageOps.alphaBounds(img);
        for (int s0 = 0; s0 < n; s0++) {
            if (!grown[s0] || label[s0] != 0) continue;
            id++;
            int x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0;
            q.add(s0); label[s0] = id;
            while (!q.isEmpty()) {
                int i = q.poll(), x = i % w, y = i / w;
                x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); area++;
                for (int j : new int[]{x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w})
                    if (j >= 0 && j < n && grown[j] && label[j] == 0) { label[j] = id; q.add(j); }
            }
            int bw = x1 - x0 + 1, bh = y1 - y0 + 1;
            if (area < 40 || Math.max(bw, bh) / (double) Math.min(bw, bh) > 2.2 || Math.max(bw, bh) > Math.max(gb.w(), gb.h()) * 0.5) continue;
            int d = 0, tot = 0;
            for (int y = y0; y <= y1; y++) for (int x = x0; x <= x1; x++) { tot++; if (dark[y * w + x]) d++; }
            double darkFrac = d / (double) tot;
            if (darkFrac < 0.04) continue;
            double cx = (x0 + x1) / 2.0, cy = (y0 + y1) / 2.0, cr = Math.max(bw, bh) / 2.0;
            // raios: do creme para fora até voltar ao tecido (4 px seguidos) ou sair da peça; de lado o selo vira elipse
            java.util.List<Double> rx = new java.util.ArrayList<>(), ry = new java.util.ArrayList<>(), hits = new java.util.ArrayList<>();
            for (int k = 0; k < 32; k++) {
                double a = Math.PI * 2 * k / 32, dx = Math.cos(a), dy = Math.sin(a);
                double cmin = Math.min(bw, bh) / 2.0;
                int run = 0;
                for (double t = cmin; t < cr * 6; t += 1) {
                    int x = (int) Math.round(cx + dx * t), y = (int) Math.round(cy + dy * t);
                    boolean out = x < 0 || y < 0 || x >= w || y >= h || !in[y * w + x];
                    run = !out && fabric[y * w + x] ? run + 1 : 0;
                    if (out || run >= 4) {
                        double tt = out ? t : t - 4;
                        if (!out) hits.add(tt);
                        if (Math.abs(dx) >= Math.abs(dy)) rx.add(Math.abs(dx) * tt); else ry.add(Math.abs(dy) * tt);
                        break;
                    }
                }
            }
            if (hits.size() < 8 || rx.size() < 4 || ry.size() < 4) continue;     // sem tecido em volta: não é um selo aplicado
            Collections.sort(rx); Collections.sort(ry); Collections.sort(hits);
            double Rx = rx.get(rx.size() / 2) / Math.cos(Math.PI / 8), Ry = ry.get(ry.size() / 2) / Math.cos(Math.PI / 8);
            double med = hits.get(hits.size() / 2), spread = (hits.get(hits.size() * 3 / 4) - hits.get(hits.size() / 4)) / med;
            if (spread > 0.6 || Rx < bw / 2.0 * 1.5 || Ry < bh / 2.0 * 1.5 || Rx > bw / 2.0 * 5 || Ry > bh / 2.0 * 5) continue;
            double score = Math.sqrt(Rx * Ry) * Math.min(1, hits.size() / 20.0);
            if (score > best) {
                best = score;
                box = new double[]{Math.max(0, (cx - Rx - gb.x()) / gb.w()), Math.max(0, (cy - Ry - gb.y()) / gb.h()),
                        Math.min(1, (cx + Rx - gb.x()) / gb.w()), Math.min(1, (cy + Ry - gb.y()) / gb.h())};
            }
        }
        if (box == null) {
            // sem selo: letras creme grandes (camiseta "FAI"): o maior grupo creme vira a caixa
            int[] lab2 = new int[n]; int id2 = 0; int bestA = 0;
            for (int s0 = 0; s0 < n; s0++) {
                if (!grown[s0] || lab2[s0] != 0) continue;
                id2++;
                int x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0;
                q.add(s0); lab2[s0] = id2;
                while (!q.isEmpty()) {
                    int i = q.poll(), x = i % w, y = i / w;
                    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); area++;
                    for (int j : new int[]{x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w})
                        if (j >= 0 && j < n && grown[j] && lab2[j] == 0) { lab2[j] = id2; q.add(j); }
                }
                if (area > bestA && area > gb.w() * gb.h() * 0.01) {
                    bestA = area;
                    double pad = Math.max(x1 - x0, y1 - y0) * 0.12;
                    box = new double[]{Math.max(0, (x0 - pad - gb.x()) / gb.w()), Math.max(0, (y0 - pad - gb.y()) / gb.h()),
                            Math.min(1, (x1 + pad - gb.x()) / gb.w()), Math.min(1, (y1 + pad - gb.y()) / gb.h())};
                }
            }
        }
        return box;
    }

}
