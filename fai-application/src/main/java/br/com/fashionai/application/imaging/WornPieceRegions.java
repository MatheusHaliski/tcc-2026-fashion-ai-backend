package br.com.fashionai.application.imaging;

import br.com.fashionai.application.moderation.ImageSafetyPorts.ClassMap;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.List;

/**
 * RF4 · várias peças numa foto VESTIDA, sem IA remota: o mapa de classes do segmentador de pessoa (cabelo, pele do corpo,
 * pele do rosto, roupa, acessório) vira uma região por peça. As divisões vêm da geometria do corpo e da cor do tecido —
 * não há classificador de roupa aqui, só o que dá para medir:
 * <ul>
 *   <li><b>boné/chapéu</b>: roupa ou acessório acima do rosto (o cabelo não conta);</li>
 *   <li><b>calçado</b>: a faixa de baixo da pessoa — uma segunda faixa de "roupa" depois da pele das pernas (bermuda)
 *       ou o salto de cor no fim da calça;</li>
 *   <li><b>peça de cima × de baixo</b>: o maior salto de cor entre as linhas da roupa (a barra da camiseta sobre o cós);</li>
 *   <li><b>peça única</b>: uma cor só do pescoço quase aos pés (vestido, macacão).</li>
 * </ul>
 * Só a pessoa conta: o maior bloco conexo com rosto (ou pele) do mapa; bolsas e sapatos de uma vitrine ao fundo ficam de
 * fora. Trabalha na grade do mapa (≈256 px) com a foto reduzida à mesma grade; as caixas saem em % da foto.
 */
public final class WornPieceRegions {
    private WornPieceRegions() {
    }

    public enum Kind { HEADWEAR, UPPER, LOWER, FULL, SHOES }

    /**
     * @param bottomFrac onde a peça termina, em fração da altura da pessoa (0 = topo da cabeça, 1 = sola) — decide
     *                   bermuda × calça
     * @param coverage   fração da imagem coberta pelos pixels da peça
     */
    public record Worn(Kind kind, double x, double y, double width, double height, int rgb, double bottomFrac, double coverage) {
    }

    /** rosto + cabelo abaixo disto (fração da imagem) e sem pele do corpo: não há pessoa, é uma foto de peças. */
    static final double MIN_HEAD = 0.0005;   // ≈ 33 px num mapa de 256×256: uma pessoa de corpo inteiro a alguns metros
    static final double MIN_SKIN = 0.01;
    /** pixels de roupa numa linha para a linha contar como roupa (na grade do mapa) */
    static final int MIN_ROW = 3;
    /** salto de cor (RGB) que separa duas peças empilhadas; abaixo disto é a mesma peça com sombra */
    static final double SPLIT_DIST = 30;
    /** peça única do pescoço até aqui (fração da altura da pessoa) é um vestido/macacão, não uma camiseta */
    static final double FULL_FRAC = 0.78;

    public static List<Worn> detect(BufferedImage photo, ClassMap map) {
        int w = map.width(), h = map.height();
        byte[] cls = map.classes();
        if (cls.length != w * h || w < 8 || h < 8) {
            return List.of();
        }
        int[] px = ImageOps.scale(photo, w, h).getRGB(0, 0, w, h, null, 0, w);
        boolean[] person = personBlob(cls, w, h);
        if (person == null) {
            return List.of();
        }
        int[] clothes = new int[h], skin = new int[h], face = new int[h], hair = new int[h], other = new int[h], any = new int[h];
        long[] sr = new long[h], sg = new long[h], sb = new long[h];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int i = y * w + x;
                if (!person[i]) {
                    continue;
                }
                any[y]++;
                switch (cls[i]) {
                    case ClassMap.HAIR -> hair[y]++;
                    case ClassMap.BODY_SKIN -> skin[y]++;
                    case ClassMap.FACE_SKIN -> face[y]++;
                    case ClassMap.OTHER -> other[y]++;
                    default -> {
                        clothes[y]++;
                        int p = px[i];
                        sr[y] += (p >> 16) & 255;
                        sg[y] += (p >> 8) & 255;
                        sb[y] += p & 255;
                    }
                }
            }
        }
        int top = first(any, 1, 0, h - 1), bottom = last(any, 1, 0, h - 1);
        if (top < 0 || bottom - top < 8) {
            return List.of();
        }
        int personH = bottom - top + 1;
        int faceTop = first(face, 2, top, bottom), faceBottom = last(face, 2, top, bottom);
        if (faceTop < 0) {
            faceTop = first(hair, 2, top, bottom);
            faceBottom = last(hair, 2, top, bottom);
        }
        if (faceTop < 0) {
            faceTop = top;
            faceBottom = top + personH / 8;
        }
        List<Worn> out = new ArrayList<>();

        // boné/chapéu: linhas acima do rosto em que roupa+acessório domina sobre o cabelo
        int capTop = -1, capBottom = -1;
        for (int y = top; y < faceTop; y++) {
            if (clothes[y] + other[y] >= MIN_ROW && clothes[y] + other[y] >= hair[y]) {
                if (capTop < 0) {
                    capTop = y;
                }
                capBottom = y;
            }
        }
        if (capTop >= 0 && capBottom - capTop + 1 >= Math.max(2, personH * 0.02)) {
            out.add(region(Kind.HEADWEAR, cls, px, person, w, capTop, capBottom, true, top, personH));
        }

        // faixas de roupa abaixo do rosto (um buraco de até 1 % da altura ainda é a mesma faixa)
        List<int[]> runs = new ArrayList<>();
        int gapMax = Math.max(1, (int) Math.round(personH * 0.01));
        int runStart = -1, lastHit = -1;
        for (int y = Math.max(faceBottom, top); y <= bottom; y++) {
            boolean hit = clothes[y] + other[y] >= MIN_ROW;
            if (hit) {
                if (runStart < 0) {
                    runStart = y;
                }
                lastHit = y;
            } else if (runStart >= 0 && y - lastHit > gapMax) {
                runs.add(new int[]{runStart, lastHit});
                runStart = -1;
            }
        }
        if (runStart >= 0) {
            runs.add(new int[]{runStart, lastHit});
        }
        runs.removeIf(r -> r[1] - r[0] + 1 < Math.max(2, personH * 0.03));
        if (runs.isEmpty()) {
            return out;
        }
        int[] main = runs.get(0);
        int shoesTop = -1;
        // calçado: uma faixa separada no quinto de baixo da pessoa (pele das pernas entre a bermuda e o tênis)…
        if (runs.size() > 1) {
            int[] lastRun = runs.get(runs.size() - 1);
            if (lastRun[0] >= top + personH * 0.70 && lastRun != main) {
                shoesTop = lastRun[0];
            }
        }
        // …ou, com a calça comprida até o sapato, o salto de cor no fim da faixa única
        int lowerEnd = shoesTop > 0 ? Math.min(main[1], shoesTop - 1) : main[1];
        if (shoesTop < 0 && main[1] >= top + personH * 0.90) {
            int from = Math.max(main[0], (int) (bottom - personH * 0.22)), to = (int) (bottom - personH * 0.05);
            int cut = colourCut(clothes, sr, sg, sb, from, to, Math.max(2, (int) (personH * 0.03)));
            if (cut > 0) {
                shoesTop = cut;
                lowerEnd = cut - 1;
            }
        }
        // peça de cima × de baixo: o maior salto de cor entre as linhas da roupa, cada lado com ao menos 12 % da faixa
        int span = lowerEnd - main[0] + 1;
        int split = span >= 12 ? colourCut(clothes, sr, sg, sb, main[0] + (int) (span * 0.25), main[0] + (int) (span * 0.80),
                Math.max(2, (int) (span * 0.12))) : -1;
        if (split > 0) {
            out.add(region(Kind.UPPER, cls, px, person, w, main[0], split - 1, false, top, personH));
            out.add(region(Kind.LOWER, cls, px, person, w, split, lowerEnd, false, top, personH));
        } else {
            boolean full = (lowerEnd - top) / (double) personH >= FULL_FRAC;
            out.add(region(full ? Kind.FULL : Kind.UPPER, cls, px, person, w, main[0], lowerEnd, false, top, personH));
        }
        if (shoesTop > 0) {
            out.add(region(Kind.SHOES, cls, px, person, w, shoesTop, bottom, true, top, personH));
        }
        out.removeIf(r -> r.width() < 2 || r.height() < 2 || r.coverage() <= 0);
        return List.copyOf(out);
    }

    /**
     * Linha em que a cor média da roupa mais muda entre o que está acima e o que está abaixo (ambos com ao menos
     * {@code minSide} linhas); −1 quando o maior salto fica abaixo de {@link #SPLIT_DIST}.
     */
    static int colourCut(int[] clothes, long[] sr, long[] sg, long[] sb, int from, int to, int minSide) {
        int best = -1;
        double bestDist = SPLIT_DIST;
        for (int y = from + minSide; y <= to - minSide + 1; y++) {
            long ar = 0, ag = 0, ab = 0, an = 0, br = 0, bg = 0, bb = 0, bn = 0;
            for (int r = from; r < y; r++) {
                ar += sr[r];
                ag += sg[r];
                ab += sb[r];
                an += clothes[r];
            }
            for (int r = y; r <= to; r++) {
                br += sr[r];
                bg += sg[r];
                bb += sb[r];
                bn += clothes[r];
            }
            if (an < minSide * MIN_ROW || bn < minSide * MIN_ROW) {
                continue;
            }
            double d = PixelStats.distance(PixelStats.rgb(ar, ag, ab, an), PixelStats.rgb(br, bg, bb, bn));
            if (d > bestDist) {
                bestDist = d;
                best = y;
            }
        }
        return best;
    }

    /** Caixa, cor dominante e cobertura dos pixels de roupa (e de acessório, para boné e calçado) entre duas linhas. */
    private static Worn region(Kind kind, byte[] cls, int[] px, boolean[] person, int w, int y0, int y1, boolean withOther,
                               int personTop, int personH) {
        int h = cls.length / w;
        int[] idx = new int[(y1 - y0 + 1) * w];
        int n = 0, minX = w, maxX = -1, minY = h, maxY = -1;
        for (int y = y0; y <= y1; y++) {
            for (int x = 0; x < w; x++) {
                int i = y * w + x;
                if (!person[i]) {
                    continue;
                }
                int c = cls[i];
                if (c == ClassMap.CLOTHES || (withOther && c == ClassMap.OTHER)) {
                    idx[n++] = i;
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
        }
        if (n == 0) {
            return new Worn(kind, 0, 0, 0, 0, 0x808080, 0, 0);
        }
        double pad = 1.0;
        double x = Math.max(0, 100.0 * minX / w - pad), y = Math.max(0, 100.0 * minY / h - pad);
        double x2 = Math.min(100, 100.0 * (maxX + 1) / w + pad), y2 = Math.min(100, 100.0 * (maxY + 1) / h + pad);
        return new Worn(kind, round(x), round(y), round(x2 - x), round(y2 - y), PixelStats.dominant(px, idx, n),
                Math.round((y1 - personTop + 1) / (double) personH * 100) / 100.0, n / (double) (w * h));
    }

    /** O bloco conexo (8 vizinhos) de pixels não-fundo com mais rosto — ou, sem rosto, com mais pele do corpo. */
    static boolean[] personBlob(byte[] cls, int w, int h) {
        int size = w * h;
        int[] label = new int[size];
        int[] queue = new int[size];
        int labels = 0;
        long bestScore = -1;
        int bestLabel = -1;
        long headAll = 0, skinAll = 0;
        for (int i = 0; i < size; i++) {
            if (cls[i] == ClassMap.HAIR || cls[i] == ClassMap.FACE_SKIN) {
                headAll++;
            } else if (cls[i] == ClassMap.BODY_SKIN) {
                skinAll++;
            }
        }
        boolean useFace = headAll / (double) size >= MIN_HEAD;
        if (!useFace && skinAll / (double) size < MIN_SKIN) {
            return null;
        }
        for (int i = 0; i < size; i++) {
            if (label[i] != 0 || cls[i] == ClassMap.BACKGROUND) {
                continue;
            }
            int id = ++labels, head = 0, tail = 1;
            long faces = 0, skins = 0, clothes = 0;
            queue[0] = i;
            label[i] = id;
            while (head < tail) {
                int p = queue[head++], x = p % w, y = p / w;
                switch (cls[p]) {
                    case ClassMap.HAIR, ClassMap.FACE_SKIN -> faces++;
                    case ClassMap.BODY_SKIN -> skins++;
                    default -> clothes++;
                }
                for (int dy = -1; dy <= 1; dy++) {
                    for (int dx = -1; dx <= 1; dx++) {
                        int nx = x + dx, ny = y + dy;
                        if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
                            continue;
                        }
                        int q = ny * w + nx;
                        if (label[q] == 0 && cls[q] != ClassMap.BACKGROUND) {
                            label[q] = id;
                            queue[tail++] = q;
                        }
                    }
                }
            }
            // com mais de uma pessoa, a maior (mais roupa) e com rosto: quem está em primeiro plano
            long score = useFace ? faces * 8 + clothes : skins * 8 + clothes;
            if ((useFace ? faces : skins) > 0 && score > bestScore) {
                bestScore = score;
                bestLabel = id;
            }
        }
        if (bestLabel < 0) {
            return null;
        }
        boolean[] person = new boolean[size];
        for (int i = 0; i < size; i++) {
            person[i] = label[i] == bestLabel;
        }
        return person;
    }

    private static int first(int[] rows, int min, int from, int to) {
        for (int y = from; y <= to; y++) {
            if (rows[y] >= min) {
                return y;
            }
        }
        return -1;
    }

    private static int last(int[] rows, int min, int from, int to) {
        for (int y = to; y >= from; y--) {
            if (rows[y] >= min) {
                return y;
            }
        }
        return -1;
    }

    private static double round(double v) {
        return Math.round(v * 10) / 10.0;
    }
}
