package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * RF4 · Foto do feed — enquadramento por template de categoria. Em vez de um corte fixo em pixels, cada template
 * posiciona a peça por <b>pontos de referência da própria roupa</b> medidos na máscara do recorte, para que peças do
 * mesmo tipo fiquem com escala e posição comparáveis na grade:
 * <ul>
 *   <li><b>TOP</b> (camiseta, blusa, polo, regata…): gola no topo do quadro, largura do peito (logo abaixo das cavas)
 *       sempre com a mesma fração da largura, centro no tronco — ombros, extremidades das mangas e estampa frontal
 *       ficam visíveis; a barra pode sair pela base;</li>
 *   <li><b>OUTERWEAR</b> (jaqueta, casaco, blazer…): mesmas âncoras do TOP, mas a barra continua dentro do quadro;</li>
 *   <li><b>PANTS</b> (calças): cós no topo e o recorte termina na metade dos joelhos (gancho + 47% da entreperna),
 *       preservando cintura, bolsos, fechamento e o formato das pernas;</li>
 *   <li><b>SHORTS</b>, <b>SKIRT</b>, <b>FULL_BODY</b>: peça inteira, cós/decote na mesma altura;</li>
 *   <li><b>SHOES</b>: sola numa linha de chão fixa; <b>BAG</b> e <b>ACCESSORY</b>: objeto inteiro centralizado.</li>
 * </ul>
 * O quadro é sempre 4:5. Nada é inventado: quando a foto não contém a região exigida (gola, mangas, cós, joelhos), o
 * resultado lista o que falta em {@code missing} — a tela pede outra foto ou ajuste manual. A peça nunca é distorcida:
 * só escala uniforme e translação.
 */
public final class FeedFraming {
    private FeedFraming() {
    }

    public static final int WIDTH = 800, HEIGHT = 1000;

    public enum Template { TOP, OUTERWEAR, PANTS, SHORTS, SKIRT, FULL_BODY, SHOES, BAG, ACCESSORY }

    /** Posições-alvo no quadro (frações): onde cada ponto de referência cai. */
    static final double TOP_COLLAR_Y = 0.08, TOP_CHEST_W = 0.56, PANTS_WAIST_Y = 0.06, PANTS_KNEE_Y = 1.0,
            WAIST_Y = 0.08, FULL_TOP_Y = 0.05, SHOE_GROUND_Y = 0.72;

    /**
     * @param frame     escala e posição da peça (mesmo formato do quadro do estúdio)
     * @param landmarks pontos medidos na peça (frações da caixa da peça, 0–1)
     * @param missing   regiões que o template exige e a foto não tem (collar, sleeves, chest, waist, knees, hem, full)
     * @param estimated algum ponto foi estimado por proporção (não medido)
     */
    public record Feed(Template template, StudioFraming.Frame frame, Map<String, Object> landmarks, List<String> missing,
                       boolean estimated, double[] pieceSize) {
        /** Caixa da peça no quadro (frações: esquerda, topo, direita, base) — pode passar de 0–1 onde a peça sangra. */
        public List<Double> box() {
            double l = frame.ox() / frame.width(), t = frame.oy() / frame.height();
            double r = (frame.ox() + pieceSize[0] * frame.scale()) / frame.width(), b = (frame.oy() + pieceSize[1] * frame.scale()) / frame.height();
            return java.util.stream.DoubleStream.of(l, t, r, b).map(v -> Math.round(v * 1000) / 1000.0).boxed().toList();
        }

        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("template", template.name());
            m.put("aspect", "4:5");
            m.put("width", frame.width());
            m.put("height", frame.height());
            m.put("fill", Math.round(frame.fill() * 100) / 100.0);
            m.put("landmarks", landmarks);
            m.put("box", box());
            m.put("missing", missing);
            m.put("estimated", estimated);
            return m;
        }
    }

    /** Template pela categoria e subcategoria do cadastro; {@code kind} (dica do estúdio) quando não há categoria. */
    public static Template template(String category, String subcategory, String kind) {
        String sub = subcategory == null ? "" : subcategory;
        if (category != null) {
            switch (category) {
                case "upper_piece":
                    return Set.of("jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono").contains(sub)
                            ? Template.OUTERWEAR : Template.TOP;
                case "lower_piece":
                    if (Set.of("skirt", "skort").contains(sub)) {
                        return Template.SKIRT;
                    }
                    return Set.of("shorts", "bermuda_shorts", "denim_shorts").contains(sub) ? Template.SHORTS : Template.PANTS;
                case "full_body_piece":
                    return Template.FULL_BODY;
                case "shoes_piece":
                    return Template.SHOES;
                case "accessory_piece":
                    return Set.of("handbag", "crossbody_bag", "tote_bag", "clutch", "backpack").contains(sub)
                            ? Template.BAG : Template.ACCESSORY;
                default:
                    break;
            }
        }
        if (kind == null) {
            return Template.ACCESSORY;
        }
        return switch (kind) {
            case "TOP" -> Template.TOP;
            case "OUTERWEAR" -> Template.OUTERWEAR;
            case "BOTTOM" -> Template.PANTS;
            case "FULL_BODY" -> Template.FULL_BODY;
            case "SHOES" -> Template.SHOES;
            default -> Template.ACCESSORY;
        };
    }

    /** Perfil da máscara por linha: extremos, trecho central (o que contém o eixo da peça) e número de trechos. */
    record Profile(int w, int h, int top, int bottom, int left, int right, int[] l, int[] r, int[] cl, int[] cr, int[] runs,
                   double scale, boolean[] mask, double holes) {
        int width(int y) {
            return l[y] < 0 ? 0 : r[y] - l[y] + 1;
        }

        int central(int y) {
            return cl[y] < 0 ? 0 : cr[y] - cl[y] + 1;
        }
    }

    /** Máscara reduzida (≤ 600 px) para medir; as medidas voltam na escala da peça. */
    static Profile profile(BufferedImage piece) {
        double k = Math.min(1, 600.0 / Math.max(piece.getWidth(), piece.getHeight()));
        BufferedImage img = k < 1 ? ImageOps.scale(piece, Math.max(1, (int) Math.round(piece.getWidth() * k)),
                Math.max(1, (int) Math.round(piece.getHeight() * k))) : piece;
        int w = img.getWidth(), h = img.getHeight();
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        boolean[] mask = new boolean[w * h];
        for (int i = 0; i < mask.length; i++) {
            mask[i] = (px[i] >>> 24) >= 128;
        }
        int opaque = 0;
        for (boolean b : mask) {
            opaque += b ? 1 : 0;
        }
        int filled = fillHoles(mask, w, h);
        double holes = opaque == 0 ? 0 : filled / (double) (opaque + filled);
        int[] l = new int[h], r = new int[h], runs = new int[h];
        long sx = 0, n = 0;
        int top = -1, bottom = -1, left = w, right = -1;
        for (int y = 0; y < h; y++) {
            l[y] = -1;
            r[y] = -1;
            boolean in = false;
            for (int x = 0; x < w; x++) {
                boolean o = mask[y * w + x];
                if (o) {
                    if (l[y] < 0) {
                        l[y] = x;
                    }
                    r[y] = x;
                    sx += x;
                    n++;
                    if (!in) {
                        runs[y]++;
                    }
                }
                in = o;
            }
            if (l[y] >= 0) {
                if (top < 0) {
                    top = y;
                }
                bottom = y;
                left = Math.min(left, l[y]);
                right = Math.max(right, r[y]);
            }
        }
        // eixo da peça: média das colunas opacas; o trecho central de cada linha é o que contém esse eixo (ou o mais
        // próximo dele) — separa o tronco das mangas soltas e a perna esquerda da direita
        int axis = n == 0 ? w / 2 : (int) Math.round(sx / (double) n);
        int[] cl = new int[h], cr = new int[h];
        for (int y = 0; y < h; y++) {
            cl[y] = -1;
            cr[y] = -1;
            if (l[y] < 0) {
                continue;
            }
            int best = Integer.MAX_VALUE;
            int x = l[y];
            while (x <= r[y]) {
                if (!mask[y * w + x]) {
                    x++;
                    continue;
                }
                int s = x;
                while (x <= r[y] && mask[y * w + x]) {
                    x++;
                }
                int e = x - 1;
                int d = axis < s ? s - axis : axis > e ? axis - e : 0;
                if (d < best) {
                    best = d;
                    cl[y] = s;
                    cr[y] = e;
                }
            }
        }
        return new Profile(w, h, top, bottom, left, right, l, r, cl, cr, runs, k, mask, holes);
    }

    /**
     * Buracos internos (mão que cobria o peito na foto vestida, recorte de estampa) fazem parte da silhueta da peça:
     * medir com eles partiria o tronco em pedaços. Preenche o que não se liga à borda da imagem pelo lado de fora.
     */
    static int fillHoles(boolean[] mask, int w, int h) {
        boolean[] outside = new boolean[w * h];
        java.util.ArrayDeque<Integer> q = new java.util.ArrayDeque<>();
        for (int x = 0; x < w; x++) {
            for (int y : new int[]{0, h - 1}) {
                int i = y * w + x;
                if (!mask[i] && !outside[i]) {
                    outside[i] = true;
                    q.add(i);
                }
            }
        }
        for (int y = 0; y < h; y++) {
            for (int x : new int[]{0, w - 1}) {
                int i = y * w + x;
                if (!mask[i] && !outside[i]) {
                    outside[i] = true;
                    q.add(i);
                }
            }
        }
        while (!q.isEmpty()) {
            int i = q.poll(), x = i % w;
            int[] nb = {x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w};
            for (int j : nb) {
                if (j >= 0 && j < w * h && !mask[j] && !outside[j]) {
                    outside[j] = true;
                    q.add(j);
                }
            }
        }
        int filled = 0;
        for (int i = 0; i < mask.length; i++) {
            if (!outside[i] && !mask[i]) {
                mask[i] = true;
                filled++;
            }
        }
        return filled;
    }

    /**
     * @param piece    peça recortada (ARGB, fundo transparente), já sem as bordas vazias
     * @param template template da categoria
     * @param cut      lados que a foto original cortou (top/bottom/left/right)
     */
    /**
     * Foto do feed pela Regra de Enquadramento do Produto (docs/catalogo/PIPELINE_IMAGENS_CATALOGO.md §9.1), a mesma
     * das fotos do acervo: o template continua medindo a peça (gola, cós, joelhos, o que falta na foto), e o quadro 4:5
     * sai da regra da categoria no registro — parte de cima e de baixo preenchem o quadro pelo topo (gola / cós na
     * metade superior), calçado e óculos ocupam a largura, relógio com o mostrador no centro, joias, gorro, cachecol,
     * cinto e demais acessórios inteiros dentro do quadro. Sem categoria, o enquadramento antigo do template.
     */
    public static Feed frame(BufferedImage piece, Template template, Set<String> cut, String category, String subcategory) {
        Feed base = frame(piece, template, cut);
        if (category == null || category.isBlank()) {
            return base;
        }
        br.com.fashionai.application.catalog.image.SemanticRegionRegistry.Profile profile =
                br.com.fashionai.application.catalog.image.SemanticRegionRegistry.get()
                        .profile(br.com.fashionai.application.catalog.image.PieceType.of(category), subcategory);
        if (profile.rule() == null) {
            return base;
        }
        Profile p = profile(piece);
        br.com.fashionai.application.catalog.image.NRect product = new br.com.fashionai.application.catalog.image.NRect(
                p.left() / (double) p.w(), p.top() / (double) p.h(), (p.right() - p.left() + 1) / (double) p.w(),
                (p.bottom() - p.top() + 1) / (double) p.h());
        br.com.fashionai.application.catalog.image.FramingStrategy.Focus focus = new br.com.fashionai.application.catalog.image.FramingStrategy.Focus(
                profile.focus().name(), product.sub(profile.focus().rect()), List.of(), "REGISTRY");
        br.com.fashionai.application.catalog.image.NRect c = br.com.fashionai.application.catalog.image.SemanticCropper.ruleCrop(
                p.w(), p.h(), WIDTH / (double) HEIGHT, product, focus, profile.rule(), profile.margin()[0]);
        double s = WIDTH / (c.w() * p.w()), ox = -c.x() * p.w() * s, oy = -c.y() * p.h() * s;
        Set<String> cuts = cut == null ? Set.of() : cut;
        Map<String, Object> lm = new LinkedHashMap<>(base.landmarks());
        lm.put("rule", profile.rule().toMap());
        lm.put("focus", profile.focus().name());
        List<String> missing = new ArrayList<>(base.missing());
        // regra 4 (calçado de lado): par fotografado de frente/de trás ou um pé de frente não vira lateral no recorte —
        // a tela pede a foto de lado em vez de publicar como se a regra estivesse cumprida
        if ("SIDE".equals(profile.rule().view()) && !looksSideView(p)) {
            missing.add("side_view");
            lm.put("view", "NOT_SIDE");
        }
        return new Feed(base.template(), place(p, s, ox, oy, WIDTH, HEIGHT, bleedOf(p, s, ox, oy, WIDTH, HEIGHT, cuts)), lm,
                missing, base.estimated(), base.pieceSize());
    }

    /**
     * Vista lateral do calçado pela máscara: um pé de frente é mais alto que largo, e o par visto de frente ou de trás são
     * duas manchas com um vão vertical no meio (de lado os pés se sobrepõem e a silhueta é contínua e comprida).
     */
    static boolean looksSideView(Profile p) {
        int bw = p.right() - p.left() + 1, bh = p.bottom() - p.top() + 1;
        if (bw <= 0 || bh <= 0) {
            return true;
        }
        if (bw / (double) bh < 0.9) {
            return false;
        }
        int from = p.left() + (int) (bw * 0.3), to = p.left() + (int) (bw * 0.7);
        for (int x = from; x <= to; x++) {
            int filled = 0;
            for (int y = p.top(); y <= p.bottom(); y++) {
                filled += p.mask()[y * p.w() + x] ? 1 : 0;
            }
            if (filled < bh * 0.03) {
                return false;   // coluna vazia no miolo: dois pés separados (par de frente/de trás)
            }
        }
        return true;
    }

    public static Feed frame(BufferedImage piece, Template template, Set<String> cut) {
        Set<String> cuts = cut == null ? Set.of() : cut;
        Profile p = profile(piece);
        if (p.top() < 0) {
            throw new IllegalArgumentException("recorte vazio");
        }
        Feed feed = switch (template) {
            case TOP, OUTERWEAR -> upper(p, template, cuts);
            case PANTS -> pants(p, cuts);
            case SHORTS, SKIRT -> lowerWhole(p, template, cuts);
            case FULL_BODY -> whole(p, template, cuts, FULL_TOP_Y, 0.90, 0.86);
            case SHOES -> shoes(p, cuts);
            case BAG -> centered(p, template, cuts, 0.76, 0.68, 0.52);
            case ACCESSORY -> centered(p, template, cuts, 0.64, 0.58, 0.50);
        };
        // roupa com buraco fechado por dentro: algo (mão, braço, bolsa) cobria a peça na foto — não se inventa o que
        // faltou; a tela pede outra foto (bolsa com alça e acessórios têm vãos de verdade e ficam de fora)
        if (p.holes() > 0.02 && template != Template.BAG && template != Template.ACCESSORY && template != Template.SHOES) {
            feed.missing().add("occluded");
        }
        return feed;
    }

    // ---------------------------------------------------------------- partes de cima

    private static Feed upper(Profile p, Template t, Set<String> cuts) {
        int h = p.bottom() - p.top() + 1;
        List<String> missing = new ArrayList<>();
        boolean estimated = false;
        // largura do tronco: mediana do trecho central na parte de baixo da peça (60–90% da altura)
        List<Integer> lower = new ArrayList<>();
        double cxSum = 0;
        int cxN = 0;
        for (int y = p.top() + (int) (h * 0.60); y <= p.top() + (int) (h * 0.90) && y <= p.bottom(); y++) {
            if (p.central(y) > 0) {
                lower.add(p.central(y));
                cxSum += (p.cl()[y] + p.cr()[y]) / 2.0;
                cxN++;
            }
        }
        int torso = lower.isEmpty() ? p.right() - p.left() + 1 : median(lower);
        double cx = cxN == 0 ? (p.left() + p.right()) / 2.0 : cxSum / cxN;
        // cava: descendo a partir da linha mais larga, a última linha em que o trecho central ainda tem as mangas
        int widest = p.top();
        for (int y = p.top(); y <= p.top() + h * 0.55; y++) {
            if (p.central(y) > p.central(widest)) {
                widest = y;
            }
        }
        int armpit = -1;
        if (p.central(widest) > torso * 1.18) {
            for (int y = widest; y <= p.bottom(); y++) {
                if (p.central(y) <= torso * 1.12) {
                    armpit = y;
                    break;
                }
            }
        }
        if (armpit < 0) {                                   // sem mangas abertas (regata, colete, mangas junto ao corpo)
            armpit = p.top() + (int) Math.round(h * 0.30);
            estimated = true;
        }
        // peito: média do trecho central logo abaixo da cava (3–15% da altura)
        double chestSum = 0;
        int chestN = 0;
        for (int y = armpit + (int) (h * 0.03); y <= armpit + (int) (h * 0.15) && y <= p.bottom(); y++) {
            if (p.central(y) > 0) {
                chestSum += p.central(y);
                chestN++;
            }
        }
        double chest = chestN == 0 ? torso : chestSum / chestN;
        // peito implausível (menos de 35% da largura da peça: braço colado ao corpo, recorte irregular) → estimativa
        double bboxW = p.right() - p.left() + 1;
        if (chest < bboxW * 0.35) {
            chest = Math.max(torso, bboxW * 0.35);
            estimated = true;
        }
        if (cuts.contains("top")) {
            missing.add("collar");
        }
        if (cuts.contains("left") || cuts.contains("right")) {
            missing.add("sleeves");
        }
        if (cuts.contains("bottom") && p.bottom() - armpit < chest * 0.5) {
            missing.add("chest");
        }
        int W = WIDTH, H = HEIGHT;
        double s = TOP_CHEST_W * W / chest;
        // envergadura medida a partir do centro do tronco (a manga mais comprida decide; a peça fica centrada no tronco)
        double span = 2 * Math.max(cx - p.left(), p.right() + 1 - cx);
        // mangas muito abertas: encolhe até caber a envergadura (extremidades das mangas visíveis), sem o peito cair
        // abaixo de 85% da âncora — manga longa e larga demais sai pelas laterais
        if (span * s > W * 0.98) {
            s = Math.max(s * 0.85, W * 0.96 / span);
        }
        if (t == Template.OUTERWEAR && h * s > H * (1 - TOP_COLLAR_Y - 0.05)) {
            s = Math.max(s * 0.72, H * (1 - TOP_COLLAR_Y - 0.05) / h);      // casaco: a barra continua no quadro
        }
        double ox = W * 0.5 - cx * s, oy = H * TOP_COLLAR_Y - p.top() * s;
        Map<String, Object> lm = new LinkedHashMap<>();
        lm.put("collarY", rel(p.top(), p.top(), h));
        lm.put("armpitY", rel(armpit, p.top(), h));
        lm.put("hemY", 1.0);
        lm.put("chestWidth", round(chest / (p.right() - p.left() + 1)));
        lm.put("torsoCenterX", round((cx - p.left()) / (p.right() - p.left() + 1)));
        return new Feed(t, place(p, s, ox, oy, W, H, bleedOf(p, s, ox, oy, W, H, cuts)), lm, missing, estimated, size(p));
    }

    // ---------------------------------------------------------------- partes de baixo

    /** Linha do gancho: primeira linha abaixo do cós em que as pernas se separam (dois trechos grandes). */
    static int crotch(Profile p, int waistW, double waistC) {
        int h = p.bottom() - p.top() + 1;
        int from = p.top() + (int) Math.round(h * 0.08);
        for (int y = from; y <= p.bottom() - 3; y++) {
            if (legsApart(p, y, waistW, waistC) && legsApart(p, y + 1, waistW, waistC) && legsApart(p, y + 2, waistW, waistC)) {
                return y;
            }
        }
        return -1;
    }

    /**
     * Pernas separadas na linha: os dois maiores trechos têm largura de perna (≥ 18% do cós) e o vão entre eles fica
     * perto do eixo do cós (± 30% da largura) — bolso ou rasgo não contam.
     */
    private static boolean legsApart(Profile p, int y, int waistW, double waistC) {
        if (y > p.bottom() || p.runs()[y] < 2 || p.l()[y] < 0) {
            return false;
        }
        int a0 = -1, a1 = -1, b0 = -1, b1 = -1;              // dois maiores trechos (a ≥ b)
        int x = p.l()[y];
        while (x <= p.r()[y]) {
            if (!p.mask()[y * p.w() + x]) {
                x++;
                continue;
            }
            int s = x;
            while (x <= p.r()[y] && p.mask()[y * p.w() + x]) {
                x++;
            }
            int e = x - 1, len = e - s + 1;
            if (a0 < 0 || len > a1 - a0 + 1) {
                b0 = a0;
                b1 = a1;
                a0 = s;
                a1 = e;
            } else if (b0 < 0 || len > b1 - b0 + 1) {
                b0 = s;
                b1 = e;
            }
        }
        if (b0 < 0 || a1 - a0 + 1 < waistW * 0.18 || b1 - b0 + 1 < waistW * 0.18) {
            return false;
        }
        double gap = a0 < b0 ? (a1 + b0) / 2.0 : (b1 + a0) / 2.0;
        return Math.abs(gap - waistC) <= waistW * 0.30;
    }

    private static Feed pants(Profile p, Set<String> cuts) {
        int h = p.bottom() - p.top() + 1;
        List<String> missing = new ArrayList<>();
        boolean estimated = false;
        int band = Math.max(1, (int) Math.round(h * 0.03));
        double waistW = 0, waistC = 0;
        int n = 0;
        for (int y = p.top(); y < p.top() + band; y++) {
            if (p.width(y) > 0) {
                waistW += p.width(y);
                waistC += (p.l()[y] + p.r()[y]) / 2.0;
                n++;
            }
        }
        waistW = n == 0 ? p.right() - p.left() + 1 : waistW / n;
        waistC = n == 0 ? (p.left() + p.right()) / 2.0 : waistC / n;
        int crotch = crotch(p, (int) waistW, waistC);
        double knee;
        if (crotch < 0) {
            knee = p.top() + h * 0.58;                      // sem gancho visível: proporção média de calça
            estimated = true;
        } else {
            // metade do joelho ≈ 47% da entreperna; com a barra cortada, entreperna ≈ 2× a largura do cós (peça aberta)
            double inseam = cuts.contains("bottom") ? Math.max(p.bottom() - crotch, waistW * 2.0) : p.bottom() - crotch;
            knee = crotch + inseam * 0.47;
            estimated = cuts.contains("bottom");
        }
        if (cuts.contains("top")) {
            missing.add("waist");
        }
        if (knee > p.bottom() + h * 0.02) {
            missing.add("knees");                           // a foto termina antes dos joelhos
            knee = p.bottom();
        }
        int W = WIDTH, H = HEIGHT;
        double s = (PANTS_KNEE_Y - PANTS_WAIST_Y) * H / Math.max(1, knee - p.top());
        int maxW = 0;
        for (int y = p.top(); y <= Math.min(p.bottom(), (int) Math.ceil(knee)); y++) {
            maxW = Math.max(maxW, p.width(y));
        }
        if (maxW * s > W * 0.96) {
            s = W * 0.96 / maxW;                            // calça larga: cabe na largura, cós continua no mesmo lugar
        }
        double ox = W * 0.5 - waistC * s, oy = H * PANTS_WAIST_Y - p.top() * s;
        Map<String, Object> lm = new LinkedHashMap<>();
        lm.put("waistY", 0.0);
        lm.put("waistWidth", round(waistW / (p.right() - p.left() + 1)));
        lm.put("crotchY", crotch < 0 ? null : rel(crotch, p.top(), h));
        lm.put("kneeY", rel(knee, p.top(), h));
        lm.put("hemY", 1.0);
        Set<String> bleed = bleedOf(p, s, ox, oy, W, H, cuts);
        return new Feed(Template.PANTS, place(p, s, ox, oy, W, H, bleed), lm, missing, estimated, size(p));
    }

    /** Short e saia: peça inteira, cós na mesma altura e barra dentro do quadro. */
    private static Feed lowerWhole(Profile p, Template t, Set<String> cuts) {
        int h = p.bottom() - p.top() + 1, w = p.right() - p.left() + 1;
        List<String> missing = new ArrayList<>();
        if (cuts.contains("top")) {
            missing.add("waist");
        }
        if (cuts.contains("bottom")) {
            missing.add("hem");
        }
        int W = WIDTH, H = HEIGHT;
        double s = Math.min((0.90 - WAIST_Y) * H / h, 0.88 * W / w);
        double waistC = (p.l()[p.top()] + p.r()[p.top()]) / 2.0;
        double ox = W * 0.5 - waistC * s, oy = H * WAIST_Y - p.top() * s;
        Map<String, Object> lm = new LinkedHashMap<>();
        lm.put("waistY", 0.0);
        lm.put("hemY", 1.0);
        return new Feed(t, place(p, s, ox, oy, W, H, bleedOf(p, s, ox, oy, W, H, cuts)), lm, missing, false, size(p));
    }

    // ---------------------------------------------------------------- peça inteira, calçados e objetos

    private static Feed whole(Profile p, Template t, Set<String> cuts, double topY, double maxH, double maxW) {
        int h = p.bottom() - p.top() + 1, w = p.right() - p.left() + 1;
        List<String> missing = new ArrayList<>();
        if (!cuts.isEmpty()) {
            missing.add("full");
        }
        int W = WIDTH, H = HEIGHT;
        double s = Math.min(maxH * H / h, maxW * W / w);
        double cx = axis(p);
        double ox = W * 0.5 - cx * s, oy = H * topY - p.top() * s;
        Map<String, Object> lm = new LinkedHashMap<>();
        lm.put("topY", 0.0);
        lm.put("hemY", 1.0);
        return new Feed(t, place(p, s, ox, oy, W, H, bleedOf(p, s, ox, oy, W, H, cuts)), lm, missing, false, size(p));
    }

    private static Feed shoes(Profile p, Set<String> cuts) {
        int h = p.bottom() - p.top() + 1, w = p.right() - p.left() + 1;
        List<String> missing = new ArrayList<>();
        if (!cuts.isEmpty()) {
            missing.add("full");
        }
        int W = WIDTH, H = HEIGHT;
        double s = Math.min(0.80 * W / w, 0.55 * H / h);
        double ox = W * 0.5 - (p.left() + p.right()) / 2.0 * s, oy = H * SHOE_GROUND_Y - (p.bottom() + 1) * s;
        Map<String, Object> lm = new LinkedHashMap<>();
        lm.put("groundY", 1.0);
        return new Feed(Template.SHOES, place(p, s, ox, oy, W, H, bleedOf(p, s, ox, oy, W, H, cuts)), lm, missing, false, size(p));
    }

    private static Feed centered(Profile p, Template t, Set<String> cuts, double maxW, double maxH, double cy) {
        int h = p.bottom() - p.top() + 1, w = p.right() - p.left() + 1;
        List<String> missing = new ArrayList<>();
        if (!cuts.isEmpty()) {
            missing.add("full");
        }
        int W = WIDTH, H = HEIGHT;
        double s = Math.min(maxW * W / w, maxH * H / h);
        double ox = W * 0.5 - (p.left() + p.right()) / 2.0 * s, oy = H * cy - (p.top() + p.bottom()) / 2.0 * s;
        return new Feed(t, place(p, s, ox, oy, W, H, bleedOf(p, s, ox, oy, W, H, cuts)), new LinkedHashMap<>(), missing, false, size(p));
    }

    // ---------------------------------------------------------------- utilitários

    /**
     * O perfil foi medido numa cópia reduzida (fator {@code p.scale()}); o quadro devolvido vale para a peça original.
     * A peça é recortada na caixa opaca antes do estúdio, então a origem do perfil coincide com a da peça.
     */
    private static StudioFraming.Frame place(Profile p, double s, double ox, double oy, int W, int H, Set<String> bleed) {
        double k = p.scale();
        double sPiece = s * k;                              // pixel da peça original → pixel do quadro
        double pw = p.w() / k * sPiece, ph = p.h() / k * sPiece;
        double visW = Math.min(W, ox + pw) - Math.max(0, ox), visH = Math.min(H, oy + ph) - Math.max(0, oy);
        double fill = Math.max(0, visW) * Math.max(0, visH) / (W * (double) H);
        return new StudioFraming.Frame(W, H, sPiece, ox, oy, bleed, fill, "4:5");
    }

    /** Lados em que a peça passa da borda do quadro (sem sombra de chão quando a base sai) + os cortes da foto. */
    private static Set<String> bleedOf(Profile p, double s, double ox, double oy, int W, int H, Set<String> cuts) {
        Set<String> out = new LinkedHashSet<>(cuts);
        if (ox + p.left() * s < -1) {
            out.add("left");
        }
        if (ox + (p.right() + 1) * s > W + 1) {
            out.add("right");
        }
        if (oy + p.top() * s < -1) {
            out.add("top");
        }
        if (oy + (p.bottom() + 1) * s > H + 1) {
            out.add("bottom");
        }
        return out;
    }

    /** Tamanho da peça original (px) — o perfil foi medido numa cópia reduzida. */
    private static double[] size(Profile p) {
        return new double[]{p.w() / p.scale(), p.h() / p.scale()};
    }

    private static double axis(Profile p) {
        double sum = 0;
        int n = 0;
        for (int y = p.top(); y <= p.bottom(); y++) {
            if (p.l()[y] >= 0) {
                sum += (p.l()[y] + p.r()[y]) / 2.0;
                n++;
            }
        }
        return n == 0 ? (p.left() + p.right()) / 2.0 : sum / n;
    }

    private static int median(List<Integer> xs) {
        List<Integer> s = new ArrayList<>(xs);
        s.sort(Integer::compare);
        return s.get(s.size() / 2);
    }

    private static double rel(double y, int top, int h) {
        return round((y - top) / Math.max(1.0, h));
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
