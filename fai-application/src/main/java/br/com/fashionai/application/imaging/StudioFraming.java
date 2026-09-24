package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * RF4 · Estúdio — enquadramento de foto de produto: a peça inteira ocupa o quadro (margens mínimas), a proporção do
 * quadro acompanha a peça (9:16, 2:3, 4:5, 1:1 ou 5:4) e todo lado que a foto original cortou (barra, mangas) "sangra" para
 * fora da borda — o corte nunca fica flutuando sobre o fundo. Fundo, sombra e composição também moram aqui.
 */
final class StudioFraming {
    private StudioFraming() {
    }

    /** Margens (fração do quadro) dos lados inteiros; lado cortado usa {@link #BLEED} (negativo: passa da borda). */
    static final double TOP = 0.05, BOTTOM = 0.065, SIDE = 0.04, BLEED = -0.008;
    /** 9:16 é a tela do celular inteira (vestido, calça, casaco longo); 5:4 para peças largas (bolsa, tênis de lado). */
    static final int[][] ASPECTS = {{9, 16}, {2, 3}, {4, 5}, {1, 1}, {5, 4}};

    /**
     * @param width   largura do quadro · @param height altura · @param scale escala da peça · @param ox, oy canto da
     *                peça no quadro (pode ser negativo quando sangra) · @param fill fração do quadro ocupada pela peça
     */
    record Frame(int width, int height, double scale, double ox, double oy, Set<String> bleed, double fill, String aspect) {
    }

    /** Escolhe a proporção que mais preenche (ou só 1:1) e posiciona a peça respeitando os lados cortados. */
    static Frame frame(int gw, int gh, Set<String> bleed, int longSide, boolean adaptive) {
        return frame(gw, gh, bleed, Set.of(), longSide, adaptive);
    }

    /**
     * @param flush lados que só a forma sugere como corte (barra reta sem confirmação da foto): a peça fica rente à
     *              borda do quadro, sem perder nenhum pixel; os demais lados de {@code bleed} passam da borda
     */
    static Frame frame(int gw, int gh, Set<String> bleed, Set<String> flush, int longSide, boolean adaptive) {
        Frame best = null;
        for (int[] ar : ASPECTS) {
            if (!adaptive && ar[0] != ar[1]) {
                continue;
            }
            int w = ar[0] <= ar[1] ? (int) Math.round(longSide * ar[0] / (double) ar[1]) : longSide;
            int h = ar[0] <= ar[1] ? longSide : (int) Math.round(longSide * ar[1] / (double) ar[0]);
            Frame f = place(gw, gh, bleed, flush, w, h, ar[0] + ":" + ar[1]);
            // empate técnico (±3%): prefere o quadrado (grades) e depois o 4:5 (vitrine de celular)
            if (best == null || f.fill() > best.fill() * 1.03
                    || f.fill() > best.fill() * 0.97 && rank(f.aspect()) < rank(best.aspect())) {
                best = f;
            }
        }
        return best;
    }

    private static int rank(String aspect) {
        return switch (aspect) {
            case "1:1" -> 0;
            case "4:5" -> 1;
            default -> 2;
        };
    }

    static Frame place(int gw, int gh, Set<String> bleed, Set<String> flush, int w, int h, String aspect) {
        boolean bl = bleed.contains("left"), br = bleed.contains("right"), bt = bleed.contains("top"), bb = bleed.contains("bottom");
        double mL = bl ? edge("left", flush) : SIDE, mR = br ? edge("right", flush) : SIDE, mT = bt ? edge("top", flush) : TOP,
                mB = bb ? edge("bottom", flush) : BOTTOM;
        double availW = w * (1 - mL - mR), availH = h * (1 - mT - mB);
        double s = Math.min(availW / gw, availH / gh);
        double pw = gw * s, ph = gh * s;
        double ox = bl && !br ? w * mL : br && !bl ? w * (1 - mR) - pw : w * mL + (availW - pw) / 2;
        double oy = bt && !bb ? h * mT : bb && !bt ? h * (1 - mB) - ph : h * mT + (availH - ph) / 2;
        double visW = Math.min(w, ox + pw) - Math.max(0, ox), visH = Math.min(h, oy + ph) - Math.max(0, oy);
        double fill = Math.max(0, visW) * Math.max(0, visH) / (w * (double) h);
        return new Frame(w, h, s, ox, oy, bleed, fill, aspect);
    }

    private static double edge(String side, Set<String> flush) {
        return flush.contains(side) ? 0 : BLEED;
    }

    /**
     * Cortes retos no próprio recorte: foto que cortou a barra/mangas (ou recorte antigo, sem o metadado do Flat Lay).
     * Para cada lado, procura a reta (inclinação até ±6°) que passa pelo maior número de pontos do perfil daquele lado,
     * perto da borda do recorte; ≥ 30% do lado sobre a mesma reta é corte, não barra de roupa desenhada.
     *
     * @return lado → inclinação em graus (0 = reto)
     */
    static java.util.Map<String, Double> cuts(BufferedImage piece) {
        int w = piece.getWidth(), h = piece.getHeight();
        int[] px = piece.getRGB(0, 0, w, h, null, 0, w);
        int[] bottom = new int[w], top = new int[w], left = new int[h], right = new int[h];
        java.util.Arrays.fill(bottom, -1);
        java.util.Arrays.fill(top, -1);
        java.util.Arrays.fill(left, -1);
        java.util.Arrays.fill(right, -1);
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if ((px[y * w + x] >>> 24) >= 128) {
                    if (top[x] < 0) {
                        top[x] = y;
                    }
                    bottom[x] = y;
                    if (left[y] < 0) {
                        left[y] = x;
                    }
                    right[y] = x;
                }
            }
        }
        int[] invTop = new int[w], invLeft = new int[h];
        for (int x = 0; x < w; x++) {
            invTop[x] = top[x] < 0 ? -1 : h - 1 - top[x];
        }
        for (int y = 0; y < h; y++) {
            invLeft[y] = left[y] < 0 ? -1 : w - 1 - left[y];
        }
        java.util.Map<String, Double> out = new java.util.LinkedHashMap<>();
        // base/topo: ≥ 30% da largura; laterais: ≥ 40% da altura (a borda de uma manga reta não é corte)
        double[] b = line(bottom, h, 0.30), t = line(invTop, h, 0.30), l = line(invLeft, w, 0.40), r = line(right, w, 0.40);
        if (b != null) {
            out.put("bottom", b[0]);
        }
        if (t != null) {
            out.put("top", -t[0]);
        }
        // corte lateral de foto fica no mesmo ângulo da câmera (o do corte de base/topo, ou reto); lateral de roupa
        // afunilada ou evasê tem outra inclinação e não é corte
        double camera = b != null ? b[0] : t != null ? -t[0] : 0;
        if (l != null && Math.abs(-l[0] - camera) <= 1.2) {
            out.put("left", -l[0]);
        }
        if (r != null && Math.abs(r[0] - camera) <= 1.2) {
            out.put("right", r[0]);
        }
        return out;
    }

    /**
     * Perfil "extremo" (maior coordenada por posição): melhor reta perto do limite (último 15%) por votação de
     * inclinações, numa faixa de 3 px (corte de foto é reto de verdade); devolve {ângulo em graus, pontos} ou null.
     */
    private static double[] line(int[] profile, int limit, double minShare) {
        int n = profile.length, bestCount = 0;
        double bestSlope = 0;
        for (double m = -0.105; m <= 0.105; m += 0.0025) {
            java.util.Map<Integer, Integer> bins = new java.util.HashMap<>();
            for (int i = 0; i < n; i++) {
                if (profile[i] < limit * 0.85) {
                    continue;
                }
                int bin = (int) Math.floor((profile[i] - m * i) / 1.5);
                bins.merge(bin, 1, Integer::sum);
            }
            for (java.util.Map.Entry<Integer, Integer> e : bins.entrySet()) {
                int c = e.getValue() + bins.getOrDefault(e.getKey() + 1, 0);
                if (c > bestCount) {
                    bestCount = c;
                    bestSlope = m;
                }
            }
        }
        return bestCount >= n * minShare ? new double[]{Math.toDegrees(Math.atan(bestSlope)), bestCount} : null;
    }

    /** Lados cortados (conjunto) — compatível com o uso antigo. */
    static Set<String> straightCuts(BufferedImage piece) {
        return new LinkedHashSet<>(cuts(piece).keySet());
    }

    /** Fundo de estúdio: degradê radial (centro um pouco acima do meio), o mesmo que a tela cheia desenha em volta. */
    static int[] backdrop(int w, int h, StudioPipeline.Backdrop bd) {
        int[] bg = new int[w * h];
        int cr = (bd.center() >> 16) & 255, cg = (bd.center() >> 8) & 255, cb = bd.center() & 255;
        int er = (bd.edge() >> 16) & 255, eg = (bd.edge() >> 8) & 255, eb = bd.edge() & 255;
        double radius = Math.max(w, h) * 0.78;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                double dx = (x - w * 0.5) / radius, dy = (y - h * 0.40) / radius;
                double t = Math.min(1, Math.sqrt(dx * dx + dy * dy));
                t = t * t * (3 - 2 * t);
                double m = t;          // sem "piso": o degradê continua igual fora da foto (tela cheia sem emenda)
                bg[y * w + x] = 0xFF000000 | (lerp(cr, er, m) << 16) | (lerp(cg, eg, m) << 8) | lerp(cb, eb, m);
            }
        }
        return bg;
    }

    /** Fundo + sombra projetada + sombra de contato + peça, no quadro calculado por {@link #frame}. */
    static BufferedImage compose(BufferedImage piece, StudioPipeline.Backdrop bd, Frame f) {
        int W = f.width(), H = f.height();
        int pw = Math.max(1, (int) Math.round(piece.getWidth() * f.scale())), ph = Math.max(1, (int) Math.round(piece.getHeight() * f.scale()));
        BufferedImage scaled = downscale(piece, pw, ph);
        int ox = (int) Math.round(f.ox()), oy = (int) Math.round(f.oy());
        int[] out = backdrop(W, H, bd);
        int[] sp = scaled.getRGB(0, 0, pw, ph, null, 0, pw);
        boolean floating = !f.bleed().contains("bottom");        // peça cortada na base não "pousa": sem sombra no chão
        if (floating) {
            int s = 4, sw = Math.max(2, W / s), sh = Math.max(2, H / s);
            float unit = Math.max(W, H) / 1600f;
            float[] alpha = new float[sw * sh];
            int offX = Math.round(12 * unit / s), offY = Math.round(20 * unit / s);
            for (int y = 0; y < ph; y += s) {
                for (int x = 0; x < pw; x += s) {
                    int ax = (ox + x) / s + offX, ay = (oy + y) / s + offY;
                    if (ax >= 0 && ay >= 0 && ax < sw && ay < sh) {
                        alpha[ay * sw + ax] = Math.max(alpha[ay * sw + ax], (sp[y * pw + x] >>> 24) / 255f);
                    }
                }
            }
            alpha = StudioPipeline.boxBlur(alpha, sw, sh, Math.max(2, Math.round(7 * unit)), 3);
            float[] contact = new float[sw * sh];
            double ccx = (ox + pw / 2.0) / s, ccy = (oy + ph) / (double) s - 2, rx = pw * 0.40 / s, ry = Math.max(2, H * 0.012 / s);
            for (int y = 0; y < sh; y++) {
                for (int x = 0; x < sw; x++) {
                    double ex = (x - ccx) / rx, ey = (y - ccy) / ry;
                    contact[y * sw + x] = (float) Math.max(0, 1 - (ex * ex + ey * ey));
                }
            }
            contact = StudioPipeline.boxBlur(contact, sw, sh, Math.max(2, Math.round(4 * unit)), 3);
            int shr = (bd.shadow() >> 16) & 255, shg = (bd.shadow() >> 8) & 255, shb = bd.shadow() & 255;
            for (int y = 0; y < H; y++) {
                for (int x = 0; x < W; x++) {
                    float sa = 0.42f * StudioPipeline.bilinear(alpha, sw, sh, (x + 0.5f) / s - 0.5f, (y + 0.5f) / s - 0.5f)
                            + 0.35f * StudioPipeline.bilinear(contact, sw, sh, (x + 0.5f) / s - 0.5f, (y + 0.5f) / s - 0.5f);
                    sa = Math.min(0.62f, sa);
                    if (sa > 0.002f) {
                        int p = out[y * W + x];
                        out[y * W + x] = 0xFF000000 | (lerp((p >> 16) & 255, shr, sa) << 16) | (lerp((p >> 8) & 255, shg, sa) << 8) | lerp(p & 255, shb, sa);
                    }
                }
            }
        }
        for (int y = 0; y < ph; y++) {
            int cy = oy + y;
            if (cy < 0 || cy >= H) {
                continue;
            }
            for (int x = 0; x < pw; x++) {
                int cx = ox + x;
                if (cx < 0 || cx >= W) {
                    continue;
                }
                int p = sp[y * pw + x];
                float a = (p >>> 24) / 255f;
                if (a <= 0) {
                    continue;
                }
                int q = out[cy * W + cx];
                out[cy * W + cx] = 0xFF000000 | (lerp((q >> 16) & 255, (p >> 16) & 255, a) << 16)
                        | (lerp((q >> 8) & 255, (p >> 8) & 255, a) << 8) | lerp(q & 255, p & 255, a);
            }
        }
        BufferedImage res = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
        res.setRGB(0, 0, W, H, out, 0, W);
        return res;
    }

    /** Redução em passos de no máximo 2× (a bicúbica de uma vez só serrilha ao reduzir muito). */
    static BufferedImage downscale(BufferedImage img, int w, int h) {
        BufferedImage cur = img;
        while (cur.getWidth() > w * 2 || cur.getHeight() > h * 2) {
            cur = ImageOps.scale(cur, Math.max(w, cur.getWidth() / 2), Math.max(h, cur.getHeight() / 2));
        }
        return cur.getWidth() == w && cur.getHeight() == h ? cur : ImageOps.scale(cur, w, h);
    }

    private static int lerp(int a, int b, double t) {
        return (int) Math.round(a + (b - a) * t);
    }
}
