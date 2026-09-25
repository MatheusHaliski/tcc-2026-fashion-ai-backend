package br.com.fashionai.application.imaging;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.local.ColorMath;

import java.awt.image.BufferedImage;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

/**
 * RF4 · Estúdio — efeito "manequim invisível" (ghost mannequin) sem manequim na foto:
 * <ol>
 *   <li><b>limpeza</b>: tira o gancho do cabide (haste fina no topo) e o pescoço de manequim/busto que sobe acima da
 *       gola com cor que não existe na peça;</li>
 *   <li><b>decote</b>: o recorte deixa um "vazio" entre as pontas da gola; ali entra o interior das costas da peça
 *       (cor da própria peça, mais escura, com a borda da gola de trás e a textura espelhada do tecido);</li>
 *   <li><b>aberturas</b>: a abertura da gola fechada (furo no alto do recorte) recebe o mesmo interior; furos minúsculos
 *       são falhas do recorte e são reparados com a cor em volta. Espaços legítimos (entre manga e corpo) ficam.</li>
 * </ol>
 * Só vale para peças com gola/decote (parte de cima, casaco, peça inteira) — nunca para bolsa, calçado ou calça.
 */
final class GhostMannequin {
    private GhostMannequin() {
    }

    static final Set<String> NECK_KINDS = Set.of("TOP", "OUTERWEAR", "FULL_BODY");

    /** @param crop recorte aplicado pela limpeza (coordenadas da imagem de entrada); null quando não mudou o quadro */
    record Result(BufferedImage image, List<String> notes, boolean hanger, boolean mannequin, boolean neck, int openings,
                  int repaired, ImageOps.Box crop) {
        boolean changed() {
            return hanger || mannequin || neck || openings > 0 || repaired > 0;
        }
    }

    static boolean neckGarment(String kind) {
        return kind == null || NECK_KINDS.contains(kind);
    }

    // ================================================================== 1) limpeza: cabide e manequim

    static Result cleanup(BufferedImage piece, String kind) {
        List<String> notes = new ArrayList<>();
        if ("ACCESSORY".equals(kind) || "SHOES".equals(kind)) {
            return new Result(piece, notes, false, false, false, 0, 0, null);
        }
        int w = piece.getWidth(), h = piece.getHeight();
        int[] px = piece.getRGB(0, 0, w, h, null, 0, w);
        boolean hanger = false, mannequin = false;
        // gancho do cabide: linhas do topo com um único trecho estreito (≤ 5% da largura) por ≥ 3% da altura
        int hookRows = 0;
        for (int y = 0; y < h * 0.35; y++) {
            int count = 0, runs = 0;
            boolean prev = false;
            for (int x = 0; x < w; x++) {
                boolean on = (px[y * w + x] >>> 24) >= 128;
                if (on) {
                    count++;
                    if (!prev) {
                        runs++;
                    }
                }
                prev = on;
            }
            if (count == 0 && hookRows == 0) {
                continue;
            }
            if (count <= w * 0.05 && runs <= 1) {
                hookRows = y + 1;
            } else {
                break;
            }
        }
        double hookLimit = kind == null ? 0.05 : 0.03;              // sem categoria, só gancho bem evidente
        if (hookRows >= h * hookLimit) {
            int hx0 = w, hx1 = -1;
            for (int x = 0; x < w; x++) {
                if ((px[(hookRows - 1) * w + x] >>> 24) >= 128) {
                    hx0 = Math.min(hx0, x);
                    hx1 = Math.max(hx1, x);
                }
            }
            List<Integer> hookPx = new ArrayList<>();
            for (int i = 0; i < Math.min(px.length, hookRows * w); i++) {
                if ((px[i] >>> 24) >= 200) {
                    hookPx.add(px[i]);
                }
                px[i] = 0;
            }
            double[] hookColor = hookPx.size() >= 10 ? medianLab(hookPx) : null;
            int hookEnd = hookRows;
            // a haste continua dentro do decote até encostar na gola: segue o trecho estreito linha a linha
            int hookW = Math.max(2, hx1 - hx0 + 1);
            for (int y = hookRows; y < h * 0.4 && hx1 >= 0; y++) {
                int[] run = runAround(px, w, y, hx0 - 3, hx1 + 3);
                if (run == null || run[1] - run[0] + 1 > Math.max(hookW * 1.8, w * 0.03) || isOnlyRun(px, w, y, run)) {
                    break;
                }
                for (int x = run[0]; x <= run[1]; x++) {
                    px[y * w + x] = 0;
                }
                hx0 = run[0];
                hx1 = run[1];
                hookEnd = y + 1;
            }
            // a ponta da haste por cima da gola: some o que tem a cor da haste na mesma coluna
            if (hookColor != null) {
                for (int y = hookEnd; y < Math.min(h, hookEnd + hookW * 3); y++) {
                    boolean any = false;
                    for (int x = Math.max(0, hx0 - 1); x <= Math.min(w - 1, hx1 + 1); x++) {
                        int i = y * w + x;
                        if ((px[i] >>> 24) >= 128 && deltaE(ColorMath.lab(px[i]), hookColor) < 12) {
                            px[i] = 0;
                            any = true;
                        }
                    }
                    if (!any) {
                        break;
                    }
                }
            }
            hanger = true;
            notes.add(Msg.t("ghostMannequin.gancho_do_cabide_removido"));
        }
        // pescoço de manequim/busto: coluna no centro que sobe acima da linha dos ombros/pontas da gola, com cor
        // (mediana) de manequim diferente do corpo da peça — gola alta e capuz têm a cor da peça e ficam
        if (kind != null && NECK_KINDS.contains(kind)) {
            int[] top = new int[w];
            java.util.Arrays.fill(top, -1);
            for (int x = 0; x < w; x++) {
                for (int y = 0; y < h; y++) {
                    if ((px[y * w + x] >>> 24) >= 128) {
                        top[x] = y;
                        break;
                    }
                }
            }
            int leftTip = minTop(top, (int) (w * 0.10), (int) (w * 0.38)), rightTip = minTop(top, (int) (w * 0.62), (int) (w * 0.90));
            if (leftTip >= 0 && rightTip >= 0) {
                int tipsY = Math.max(leftTip, rightTip);
                int limit = tipsY - (int) (h * 0.02);
                int bx0 = (int) (w * 0.30), bx1 = (int) (w * 0.70);
                List<Integer> neckPx = new ArrayList<>();
                int minY = h;
                for (int y = 0; y < Math.max(0, limit); y++) {
                    for (int x = bx0; x < bx1; x++) {
                        if ((px[y * w + x] >>> 24) >= 200) {
                            neckPx.add(px[y * w + x]);
                            minY = Math.min(minY, y);
                        }
                    }
                }
                if (neckPx.size() >= w * h * 0.004 && tipsY - minY >= h * 0.06) {
                    double[] med = medianLab(neckPx);
                    double[][] centers = bodyPalette(px, w, h);
                    // superfície lisa (plástico/pele) × trama de tecido: gola alta e capuz têm a textura do corpo
                    double smooth = texture(px, w, h, 0, Math.max(1, limit), bx0, bx1) / Math.max(0.5, texture(px, w, h, (int) (h * 0.35), (int) (h * 0.85), 0, w));
                    if (centers != null && mannequinLike(med) && nearest(centers, med) > 8 && smooth < 0.7) {
                        // remove a coluna e o que continua dela para baixo (mesma cor) dentro da faixa central
                        boolean[] erase = new boolean[w * h];
                        ArrayDeque<Integer> q = new ArrayDeque<>();
                        for (int y = 0; y < Math.max(0, limit); y++) {
                            for (int x = bx0; x < bx1; x++) {
                                int i = y * w + x;
                                if ((px[i] >>> 24) >= 128) {
                                    erase[i] = true;
                                    q.add(i);
                                }
                            }
                        }
                        while (!q.isEmpty()) {
                            int i = q.poll(), x = i % w, y = i / w;
                            int[] nb = {x > bx0 ? i - 1 : -1, x < bx1 - 1 ? i + 1 : -1, y < h * 0.5 ? i + w : -1};
                            double[] here = ColorMath.lab(px[i]);
                            for (int j : nb) {
                                if (j < 0 || j >= erase.length || erase[j] || (px[j] >>> 24) < 128) {
                                    continue;
                                }
                                double[] there = ColorMath.lab(px[j]);
                                if (deltaE(there, med) < 12 && deltaE(there, here) < 6) {       // não atravessa a gola
                                    erase[j] = true;
                                    q.add(j);
                                }
                            }
                        }
                        grow(erase, w, h, 2);
                        for (int i = 0; i < erase.length; i++) {
                            if (erase[i] && (px[i] >>> 24) > 0 && (deltaE(ColorMath.lab(px[i]), med) < 14 || i / w < limit)) {
                                px[i] = 0;
                            }
                        }
                        mannequin = true;
                        notes.add(Msg.t("ghostMannequin.pescoco_do_manequim_removido"));
                    }
                }
            }
        }
        if (!hanger && !mannequin) {
            return new Result(piece, notes, false, false, false, 0, 0, null);
        }
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        out.setRGB(0, 0, w, h, px, 0, w);
        ImageOps.Box box = ImageOps.alphaBounds(out);
        return box.empty() ? new Result(piece, notes, false, false, false, 0, 0, null)
                : new Result(ImageOps.crop(out, box), notes, hanger, mannequin, false, 0, 0, box);
    }

    /** Manequim de vitrine: branco/cinza/preto (croma baixo), pele ou madeira (matiz 20–80°, croma moderado). */
    static boolean mannequinLike(double[] lab) {
        double chroma = Math.hypot(lab[1], lab[2]);
        if (chroma < 10) {
            return true;
        }
        double hue = Math.toDegrees(Math.atan2(lab[2], lab[1]));
        return hue >= 20 && hue <= 80 && chroma <= 45 && lab[0] >= 25 && lab[0] <= 92;
    }

    // ================================================================== 2–3) decote e aberturas

    static Result fill(BufferedImage piece, String kind) {
        List<String> notes = new ArrayList<>();
        if (!neckGarment(kind)) {
            return new Result(piece, notes, false, false, false, 0, 0, null);
        }
        int w = piece.getWidth(), h = piece.getHeight();
        int[] px = piece.getRGB(0, 0, w, h, null, 0, w);
        int f = Math.max(1, (int) Math.ceil(Math.max(w, h) / 600.0));    // grade de análise ≤ 600 px
        int gw = (w + f - 1) / f, gh = (h + f - 1) / f;
        boolean[] m = new boolean[gw * gh];
        for (int y = 0; y < gh; y++) {
            for (int x = 0; x < gw; x++) {
                m[y * gw + x] = (px[Math.min(h - 1, y * f + f / 2) * w + Math.min(w - 1, x * f + f / 2)] >>> 24) >= 128;
            }
        }
        int area = 0;
        for (boolean b : m) {
            area += b ? 1 : 0;
        }
        if (area < 100) {
            return new Result(piece, notes, false, false, false, 0, 0, null);
        }
        float[] lum = StudioQuality.luminance(px);
        float[] lumBlur = StudioPipeline.boxBlur(lum, w, h, 2, 2);
        boolean neck = false;
        int openings = 0, repaired = 0;

        // --- aberturas fechadas (furos): fora = alcançável a partir da borda da grade
        boolean[] outside = new boolean[gw * gh];
        ArrayDeque<Integer> q = new ArrayDeque<>();
        for (int x = 0; x < gw; x++) {
            seed(m, outside, q, x, gw);
            seed(m, outside, q, (gh - 1) * gw + x, gw);
        }
        for (int y = 0; y < gh; y++) {
            seed(m, outside, q, y * gw, gw);
            seed(m, outside, q, y * gw + gw - 1, gw);
        }
        while (!q.isEmpty()) {
            int i = q.poll(), x = i % gw;
            int[] nb = {x > 0 ? i - 1 : -1, x < gw - 1 ? i + 1 : -1, i - gw, i + gw};
            for (int j : nb) {
                if (j >= 0 && j < m.length && !m[j] && !outside[j]) {
                    outside[j] = true;
                    q.add(j);
                }
            }
        }
        int[] label = new int[gw * gh];
        List<int[]> holes = new ArrayList<>();                  // {área, minX, minY, maxX, maxY, somaX, somaY}
        for (int s0 = 0; s0 < m.length; s0++) {
            if (m[s0] || outside[s0] || label[s0] != 0) {
                continue;
            }
            int id = holes.size() + 1;
            int[] hb = {0, Integer.MAX_VALUE, Integer.MAX_VALUE, -1, -1, 0, 0};
            q.add(s0);
            label[s0] = id;
            while (!q.isEmpty()) {
                int i = q.poll(), x = i % gw, y = i / gw;
                hb[0]++;
                hb[1] = Math.min(hb[1], x);
                hb[2] = Math.min(hb[2], y);
                hb[3] = Math.max(hb[3], x);
                hb[4] = Math.max(hb[4], y);
                hb[5] += x;
                hb[6] += y;
                int[] nb = {x > 0 ? i - 1 : -1, x < gw - 1 ? i + 1 : -1, i - gw, i + gw};
                for (int j : nb) {
                    if (j >= 0 && j < m.length && !m[j] && !outside[j] && label[j] == 0) {
                        label[j] = id;
                        q.add(j);
                    }
                }
            }
            holes.add(hb);
        }
        final int garmentArea = area;
        long midHoles = holes.stream().filter(hb -> hb[0] > garmentArea * 0.001).count();
        boolean lace = midHoles > 8;                            // renda/tela: os furos são o desenho do tecido
        if (lace) {
            notes.add(Msg.t("ghostMannequin.tecido_vazado_aberturas_preservadas"));
        }
        for (int k = 0; k < holes.size() && !lace; k++) {
            int[] hb = holes.get(k);
            double cx = hb[5] / (double) hb[0], cy = hb[6] / (double) hb[0];
            boolean tiny = hb[0] < area * 0.002;
            boolean neckHole = cy < gh * 0.38 && Math.abs(cx - gw / 2.0) < gw * 0.22 && hb[0] < area * 0.12;
            if (!tiny && !neckHole) {
                continue;                                       // espaço legítimo (entre manga e corpo): fica
            }
            int x0 = hb[1] * f, y0 = hb[2] * f, x1 = Math.min(w - 1, (hb[3] + 1) * f), y1 = Math.min(h - 1, (hb[4] + 1) * f);
            int ring = ringColor(px, w, h, x0, y0, x1, y1, Math.max(3, (int) ((y1 - y0) * 0.3)));
            for (int y = y0; y <= y1; y++) {
                for (int x = x0; x <= x1; x++) {
                    if (label[Math.min(gh - 1, y / f) * gw + Math.min(gw - 1, x / f)] != k + 1) {
                        continue;
                    }
                    int i = y * w + x;
                    if (tiny) {
                        px[i] = under(px[i], ring);
                    } else {
                        double t = y1 == y0 ? 0.5 : (y - y0) / (double) (y1 - y0);
                        px[i] = under(px[i], shade(ring, 0.72 - 0.27 * t, 0));
                    }
                }
            }
            if (tiny) {
                repaired++;
            } else {
                openings++;
            }
        }
        if (openings > 0) {
            notes.add(Msg.t("ghostMannequin.abertura_da_gola_preenchida_com"));
        }
        if (repaired > 0) {
            notes.add(Msg.t("ghostMannequin.falha_s_do_recorte_reparada", (repaired)));
        }

        // --- decote aberto entre as pontas da gola
        int[] top = new int[gw];
        Arrays.fill(top, -1);
        for (int x = 0; x < gw; x++) {
            for (int y = 0; y < gh; y++) {
                if (m[y * gw + x]) {
                    top[x] = y;
                    break;
                }
            }
        }
        int l = argTop(top, (int) (gw * 0.15), gw / 2), r = argTop(top, gw / 2 + 1, (int) (gw * 0.85));
        if (l >= 0 && r > l) {
            double depth = 0;
            for (int x = l + 1; x < r; x++) {
                if (top[x] >= 0) {
                    depth = Math.max(depth, top[x] - chord(top, l, r, x));
                }
            }
            double width = r - l, center = (l + r) / 2.0;
            if (depth >= gh * 0.035 && width >= gw * 0.12 && width <= gw * 0.65 && Math.abs(center - gw / 2.0) <= gw * 0.15) {
                neck = true;
                double sag = depth * 0.22;
                // cor da peça logo abaixo da gola da frente
                long sr = 0, sg = 0, sb = 0, sn = 0;
                for (int x = l + 1; x < r; x++) {
                    if (top[x] < 0) {
                        continue;
                    }
                    int fx = Math.min(w - 1, x * f + f / 2);
                    for (int y = (int) ((top[x] + gh * 0.015) * f); y < Math.min(h, (top[x] + gh * 0.06) * f); y += Math.max(1, f)) {
                        int p = px[y * w + fx];
                        if ((p >>> 24) >= 250) {
                            sr += (p >> 16) & 255;
                            sg += (p >> 8) & 255;
                            sb += p & 255;
                            sn++;
                        }
                    }
                }
                int base = sn == 0 ? 0x808080 : (int) ((sr / sn) << 16 | (sg / sn) << 8 | (sb / sn));
                for (int x = l * f; x < Math.min(w, (r + 1) * f); x++) {
                    double gx = x / (double) f;
                    if (gx <= l || gx >= r) {
                        continue;
                    }
                    int gxi = Math.min(gw - 1, (int) gx);
                    if (top[gxi] < 0) {
                        continue;
                    }
                    double u = (gx - l) / width;
                    double yBack = (chord(top, l, r, gx) + sag * Math.sin(Math.PI * u)) * f;
                    double yFront = frontEdge(px, w, h, x, top[gxi] * f);
                    if (yFront - yBack < 1) {
                        continue;
                    }
                    double side = 0.85 + 0.15 * Math.sin(Math.PI * u);  // cantos do decote mais escuros
                    for (int y = (int) Math.floor(yBack); y < (int) Math.ceil(yFront) && y < h; y++) {
                        if (y < 0) {
                            continue;
                        }
                        int i = y * w + x;
                        double t = (y - yBack) / (yFront - yBack);
                        double k = t < 0.14 ? 0.95 - 0.15 * (t / 0.14) : 0.62 - 0.20 * ((t - 0.14) / 0.86);   // borda da gola de trás → sombra
                        // textura do tecido espelhada a partir da frente (mesma trama, sem colar uma cópia óbvia)
                        int my = (int) Math.min(h - 1, yFront + (yFront - y) + 2);
                        float detail = (px[my * w + x] >>> 24) >= 250 ? lum[my * w + x] - lumBlur[my * w + x] : 0;
                        int inner = shade(base, k * side, detail * 0.7f);
                        double cover = y < yBack ? 0 : Math.min(1, y + 1 - yBack);   // antisserrilhado na borda de trás
                        px[i] = under(px[i], (((int) Math.round(255 * cover)) << 24) | (inner & 0x00FFFFFF));
                    }
                }
                notes.add(Msg.t("ghostMannequin.decote_interior_das_costas_preenchido"));
            }
        }
        if (!neck && openings == 0 && repaired == 0) {
            return new Result(piece, notes, false, false, false, 0, 0, null);
        }
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        out.setRGB(0, 0, w, h, px, 0, w);
        return new Result(out, notes, false, false, neck, openings, repaired, null);
    }

    // ================================================================== utilidades

    /** Trecho opaco da linha {@code y} que cruza o intervalo [x0, x1]; null se não houver. */
    private static int[] runAround(int[] px, int w, int y, int x0, int x1) {
        for (int x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
            if ((px[y * w + x] >>> 24) >= 128) {
                int a = x, b = x;
                while (a > 0 && (px[y * w + a - 1] >>> 24) >= 128) {
                    a--;
                }
                while (b < w - 1 && (px[y * w + b + 1] >>> 24) >= 128) {
                    b++;
                }
                return new int[]{a, b};
            }
        }
        return null;
    }

    private static boolean isOnlyRun(int[] px, int w, int y, int[] run) {
        for (int x = 0; x < w; x++) {
            if ((x < run[0] || x > run[1]) && (px[y * w + x] >>> 24) >= 128) {
                return false;
            }
        }
        return true;
    }

    /** Aspereza média (|L − L suavizado|) na faixa: trama de tecido × superfície lisa. */
    private static double texture(int[] px, int w, int h, int y0, int y1, int x0, int x1) {
        double sum = 0;
        long n = 0;
        for (int y = Math.max(2, y0); y < Math.min(h - 2, y1); y += 2) {
            for (int x = Math.max(2, x0); x < Math.min(w - 2, x1); x += 2) {
                int i = y * w + x;
                if ((px[i] >>> 24) < 250 || (px[i - 2] >>> 24) < 250 || (px[i + 2] >>> 24) < 250
                        || (px[i - 2 * w] >>> 24) < 250 || (px[i + 2 * w] >>> 24) < 250) {
                    continue;
                }
                double c = lum(px[i]), avg = (lum(px[i - 1]) + lum(px[i + 1]) + lum(px[i - w]) + lum(px[i + w])) / 4;
                sum += Math.abs(c - avg);
                n++;
            }
        }
        return n == 0 ? 0 : sum / n;
    }

    private static double lum(int p) {
        return 0.299 * ((p >> 16) & 255) + 0.587 * ((p >> 8) & 255) + 0.114 * (p & 255);
    }

    private static int minTop(int[] top, int from, int to) {
        int best = -1;
        for (int x = Math.max(0, from); x < Math.min(top.length, to); x++) {
            if (top[x] >= 0 && (best < 0 || top[x] < best)) {
                best = top[x];
            }
        }
        return best;
    }

    private static double[] medianLab(List<Integer> pixels) {
        List<Double> l = new ArrayList<>(), a = new ArrayList<>(), b = new ArrayList<>();
        for (int i = 0; i < pixels.size(); i += Math.max(1, pixels.size() / 4000)) {
            double[] lab = ColorMath.lab(pixels.get(i));
            l.add(lab[0]);
            a.add(lab[1]);
            b.add(lab[2]);
        }
        l.sort(Double::compare);
        a.sort(Double::compare);
        b.sort(Double::compare);
        return new double[]{l.get(l.size() / 2), a.get(a.size() / 2), b.get(b.size() / 2)};
    }

    /** Paleta (k-means, 4 tons) do corpo da peça: faixa de 35% a 85% da altura. */
    private static double[][] bodyPalette(int[] px, int w, int h) {
        int step = Math.max(1, Math.max(w, h) / 400);
        List<Integer> sample = new ArrayList<>();
        for (int y = (int) (h * 0.35); y < h * 0.85; y += step) {
            for (int x = 0; x < w; x += step) {
                if ((px[y * w + x] >>> 24) >= 250) {
                    sample.add(px[y * w + x]);
                }
            }
        }
        if (sample.size() < 50) {
            return null;
        }
        List<ColorMath.Cluster> palette = ColorMath.kmeans(sample.stream().mapToInt(Integer::intValue).toArray(), 4);
        return palette.stream().map(c -> ColorMath.lab(c.rgb())).toArray(double[][]::new);
    }

    private static double deltaE(double[] a, double[] b) {
        return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]));
    }

    private static void grow(boolean[] m, int w, int h, int passes) {
        for (int pass = 0; pass < passes; pass++) {
            boolean[] next = m.clone();
            for (int y = 1; y < h - 1; y++) {
                for (int x = 1; x < w - 1; x++) {
                    int i = y * w + x;
                    if (!m[i] && (m[i - 1] || m[i + 1] || m[i - w] || m[i + w])) {
                        next[i] = true;
                    }
                }
            }
            System.arraycopy(next, 0, m, 0, m.length);
        }
    }

    private static void seed(boolean[] m, boolean[] outside, ArrayDeque<Integer> q, int i, int gw) {
        if (!m[i] && !outside[i]) {
            outside[i] = true;
            q.add(i);
        }
    }

    /** Coluna mais alta (menor y) no intervalo; em empate, a mais próxima do centro do intervalo. */
    private static int argTop(int[] top, int from, int to) {
        int best = -1;
        for (int x = Math.max(0, from); x < Math.min(top.length, to); x++) {
            if (top[x] >= 0 && (best < 0 || top[x] < top[best])) {
                best = x;
            }
        }
        return best;
    }

    private static double chord(int[] top, int l, int r, double x) {
        return top[l] + (top[r] - top[l]) * (x - l) / (double) (r - l);
    }

    /** Primeira linha opaca da coluna, a partir da estimativa da grade (borda da gola da frente em resolução total). */
    private static double frontEdge(int[] px, int w, int h, int x, int guess) {
        for (int y = Math.max(0, guess - 4); y < h; y++) {
            if ((px[y * w + x] >>> 24) >= 128) {
                return y;
            }
        }
        return guess;
    }

    /** Mediana (por canal) dos pixels opacos numa moldura em volta da caixa. */
    private static int ringColor(int[] px, int w, int h, int x0, int y0, int x1, int y1, int pad) {
        List<Integer> rs = new ArrayList<>(), gs = new ArrayList<>(), bs = new ArrayList<>();
        for (int y = Math.max(0, y0 - pad); y <= Math.min(h - 1, y1 + pad); y++) {
            for (int x = Math.max(0, x0 - pad); x <= Math.min(w - 1, x1 + pad); x++) {
                boolean inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
                int p = px[y * w + x];
                if (!inside && (p >>> 24) >= 250) {
                    rs.add((p >> 16) & 255);
                    gs.add((p >> 8) & 255);
                    bs.add(p & 255);
                }
            }
        }
        if (rs.isEmpty()) {
            return 0x808080;
        }
        return median(rs) << 16 | median(gs) << 8 | median(bs);
    }

    private static int median(List<Integer> v) {
        v.sort(Integer::compare);
        return v.get(v.size() / 2);
    }

    /** Cor do interior: a cor da peça escurecida por {@code k}, com o detalhe da trama somado. */
    private static int shade(int rgb, double k, float detail) {
        int r = StudioQuality.clamp((float) (((rgb >> 16) & 255) * k + detail));
        int g = StudioQuality.clamp((float) (((rgb >> 8) & 255) * k + detail));
        int b = StudioQuality.clamp((float) ((rgb & 255) * k + detail));
        return 0xFF000000 | r << 16 | g << 8 | b;
    }

    /** Põe {@code inner} por baixo do pixel atual (a borda antisserrilhada da peça continua por cima). */
    private static int under(int top, int inner) {
        float a = (top >>> 24) / 255f, ia = (inner >>> 24) / 255f;
        float oa = a + ia * (1 - a);
        if (oa <= 0) {
            return 0;
        }
        int r = Math.round((((top >> 16) & 255) * a + ((inner >> 16) & 255) * ia * (1 - a)) / oa);
        int g = Math.round((((top >> 8) & 255) * a + ((inner >> 8) & 255) * ia * (1 - a)) / oa);
        int b = Math.round(((top & 255) * a + (inner & 255) * ia * (1 - a)) / oa);
        return (Math.round(oa * 255) << 24) | (r << 16) | (g << 8) | b;
    }

    private static double nearest(double[][] centers, double[] lab) {
        double best = Double.MAX_VALUE;
        for (double[] c : centers) {
            best = Math.min(best, Math.sqrt((c[0] - lab[0]) * (c[0] - lab[0]) + (c[1] - lab[1]) * (c[1] - lab[1]) + (c[2] - lab[2]) * (c[2] - lab[2])));
        }
        return best;
    }
}
