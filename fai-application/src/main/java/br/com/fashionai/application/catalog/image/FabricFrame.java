package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Quadro 3:4 preenchido pela peça, sem fundo, cabide, pele ou outro objeto.
 * Parte superior: gola; inferior: zíper; calçado: logo; acessório: centro.
 * A máscara exclui fundo e pele e é erodida antes do recorte. Quando não há
 * região suficiente, recusa o enquadramento. Focos sem landmark são estimados
 * e ficam identificados como ESTIMATED_* nos metadados.
 */
public final class FabricFrame {
    public static final String VERSION = "FABRIC_FRAME_34_V2";
    static final int ASPECT_W = 3, ASPECT_H = 4;
    /** largura mínima do tecido no quadro, em pixels da máscara (a saída de 900 px amplia no máximo ~6×) */
    static final int MIN_WIDTH_PX = 120;
    /** largura mínima do quadro em relação à largura da peça: menos que isso é um detalhe, não a peça */
    static final double MIN_PRODUCT_FRACTION = 0.14;
    /** caixa do primeiro plano menor que isso (fração da foto) é um fragmento, não a peça */
    static final double MIN_BOX_AREA = 0.06;
    /** mancha da cor do fundo dentro da peça a partir da qual é buraco (fração da foto); menor é detalhe da estampa */
    static final double MIN_HOLE_AREA = 0.0012;
    /** mancha de pele a partir da qual é pessoa (fração da foto) */
    static final double MIN_SKIN_AREA = 0.0004;
    static final Set<String> OPEN_FRONT = Set.of("jacket", "blazer", "coat", "cardigan", "vest", "parka", "windbreaker", "kimono");
    static final Set<String> NO_FLY = Set.of("skirt", "skort", "leggings", "culottes");
    /**
     * @param crop          quadro normalizado na foto (null sem quadro)
     * @param target        o que o quadro mostra (collar, fly, front_below_waistband, bodice, logo, center)
     * @param anchorSource  PIPELINE_LANDMARK quando veio de um landmark detectado; senão ESTIMATED_*
     * @param skinExcluded  fração do produto tirada da máscara por ser pele (evidência de pessoa)
     */
    public record Result(boolean ok, String reason, NRect crop, String target, String anchorSource, double anchorX, double anchorY,
                         NRect region, double fabricCoverage, double skinExcluded, int cropWidthPx, int erosionPx) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("version", VERSION);
            m.put("ok", ok);
            m.put("reason", reason);
            m.put("crop", crop == null ? null : crop.toMap());
            m.put("aspect", "3:4");
            m.put("target", target);
            m.put("anchor", Map.of("x", NRect.r4(anchorX), "y", NRect.r4(anchorY), "source", anchorSource == null ? "" : anchorSource));
            m.put("region", region == null ? null : region.toMap());
            m.put("fabricCoverage", NRect.r4(fabricCoverage));
            m.put("skinExcluded", NRect.r4(skinExcluded));
            m.put("cropWidthPx", cropWidthPx);
            m.put("erosionPx", erosionPx);
            return m;
        }

        static Result none(String reason, String target, double skin) {
            return new Result(false, reason, null, target, null, 0, 0, null, 0, skin, 0, 0);
        }
    }

    private FabricFrame() { }

    /**
     * Máscara do tecido antes da erosão, com a caixa de tudo o que é primeiro plano (peça e quem a veste). Também guarda o
     * primeiro plano inteiro ({@code fg}, maior componente), os buracos com a cor do fundo ({@code hole}), a pele estranha à
     * peça ({@code skin}) e a cor do fundo de estúdio ({@code bg}, null sem fundo uniforme): a regra do produto
     * ({@link ProductRuleFrame}) monta a própria máscara a partir deles, sem segmentar de novo.
     */
    record Mask(int w, int h, int[] px, boolean[] fabric, ImageOps.Box box, double skinShare, String reason,
                boolean[] fg, boolean[] hole, boolean[] skin, int[] bg) {
        Mask(int w, int h, int[] px, boolean[] fabric, ImageOps.Box box, double skinShare, String reason) {
            this(w, h, px, fabric, box, skinShare, reason, null, null, null, null);
        }

        boolean person() { return skinShare >= 0.01; }
    }

    public static Result find(ProductSegmenter.Segmentation seg, PieceType type, String subcategory, FramingStrategy.Focus focus) {
        return find(mask(seg, type), type, subcategory, focus);
    }

    /** O mesmo, com a máscara já calculada (o pipeline calcula uma vez para o quadro de tecido e para a regra do produto). */
    static Result find(Mask m, PieceType type, String subcategory, FramingStrategy.Focus focus) {
        String sub = subcategory == null ? "" : subcategory.trim().toLowerCase(Locale.ROOT);
        String target = target(type, sub);
        if (m.reason() != null) return Result.none(m.reason(), target, m.skinShare());
        int w = m.w(), h = m.h();
        Plan plan = FabricPlanner.plan(type, sub, m.fabric(), m.px(), w, h, m.box(), focus, m.person());
        if (plan.reason() != null) return Result.none(plan.reason(), target, m.skinShare());
        int erosion = Math.max(2, (int) Math.round(Math.min(w, h) * 0.004));
        boolean[] fabric = FabricMasks.erode(m.fabric(), w, h, erosion);
        NRect region = new NRect(plan.region().x() / (double) w, plan.region().y() / (double) h, plan.region().w() / (double) w, plan.region().h() / (double) h);
        ImageOps.Box c = FabricAnchor.anchored(fabric, w, h, plan.region(), plan.ax(), plan.ay());
        double ax = plan.ax() / w, ay = plan.ay() / h, skin = m.skinShare();
        if (c == null) {
            return new Result(false, "NO_FABRIC_REGION", null, target, plan.source(), ax, ay, region, 0, skin, 0, erosion);
        }
        double coverage = FabricMasks.coverage(fabric, w, c);
        NRect crop = new NRect(c.x() / (double) w, c.y() / (double) h, c.w() / (double) w, c.h() / (double) h);
        if (coverage < 1) {
            return new Result(false, "FABRIC_COVERAGE_BELOW_100", crop, target, plan.source(), ax, ay, region, coverage, skin, c.w(), erosion);
        }
        if (c.w() < MIN_WIDTH_PX || c.w() < m.box().w() * MIN_PRODUCT_FRACTION) {
            return new Result(false, "FABRIC_REGION_TOO_SMALL", crop, target, plan.source(), ax, ay, region, coverage, skin, c.w(), erosion);
        }
        return new Result(true, null, crop, target, plan.source(), ax, ay, region, coverage, skin, c.w(), erosion);
    }

    /**
     * Máscara do tecido: primeiro plano do fundo de estúdio (ou do segmentador confiante), só o maior componente, sem pixel
     * da cor do fundo em lugar nenhum (fundo cercado pela alça da bolsa, entre o braço e o corpo) e sem pele estranha à peça.
     */
    static Mask mask(ProductSegmenter.Segmentation seg, PieceType type) {
        if (seg == null) return new Mask(0, 0, null, null, null, 0, "NO_PRODUCT");
        int w = seg.width(), h = seg.height();
        int[] px = seg.cutout().getRGB(0, 0, w, h, null, 0, w);
        int[] bg = FabricColors.studioBackground(px, w, h);
        boolean[] fg;
        if (bg != null) {
            fg = FabricMasks.studioForeground(px, w, h, bg);
        } else {
            // fundo sem cor uniforme (cena, parede com objetos): só a máscara do segmentador, e só se ele estiver confiante
            if (seg.empty() || seg.confidence() < 0.6) return new Mask(w, h, px, null, null, 0, "BACKGROUND_NOT_UNIFORM");
            fg = new boolean[w * h];
            for (int i = 0; i < fg.length; i++) fg[i] = seg.mask()[i] && (px[i] >>> 24) >= 160;
        }
        fg = FabricMasks.largestComponent(fg, w, h);
        int fx0 = w, fy0 = h, fx1 = -1, fy1 = -1;
        for (int i = 0; i < fg.length; i++) if (fg[i]) { int x = i % w, y = i / w; fx0 = Math.min(fx0, x); fy0 = Math.min(fy0, y); fx1 = Math.max(fx1, x); fy1 = Math.max(fy1, y); }
        if (fx1 < 0) return new Mask(w, h, px, null, null, 0, "NO_PRODUCT");
        int[][] garment = FabricColors.garmentColors(px, fg, w, new ImageOps.Box(fx0, fy0, fx1 - fx0 + 1, fy1 - fy0 + 1), type);
        // candidatos a "não tecido" dentro do primeiro plano: cor do fundo (buraco cercado) e pele estranha à peça
        boolean[] hole = new boolean[w * h], skinPx = new boolean[w * h];
        for (int i = 0; i < hole.length; i++) {
            if (!fg[i]) continue;
            if (bg != null && FabricColors.dist2(px[i], bg) <= 18 * 18) hole[i] = true;
            else if (FabricColors.foreignSkin(px[i], garment)) skinPx[i] = true;
        }
        // só manchas de tamanho de verdade (fundo cercado pela alça, entre o braço e o corpo; rosto, mão, perna): pontinhos
        // claros ou bege de uma estampa continuam tecido
        hole = FabricMasks.keepLarge(hole, w, h, (int) Math.round(w * h * MIN_HOLE_AREA));
        skinPx = FabricMasks.keepLarge(skinPx, w, h, (int) Math.round(w * h * MIN_SKIN_AREA));
        boolean[] fabric = new boolean[w * h];
        long product = 0, skin = 0;
        int x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (int i = 0; i < fabric.length; i++) {
            if (!fg[i]) continue;
            product++;
            int x = i % w, y = i / w;
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
            if (hole[i]) continue;                                          // cor do fundo: buraco cercado, nunca tecido
            if (skinPx[i]) { skin++; continue; }                            // pele de cor diferente da peça: pessoa
            fabric[i] = true;
        }
        if (product == 0) return new Mask(w, h, px, null, null, 0, "NO_PRODUCT");
        ImageOps.Box box = new ImageOps.Box(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
        // fragmento: só um detalhe sobrou do primeiro plano (peça da cor do fundo), não a peça
        if ((double) box.w() * box.h() < (double) w * h * MIN_BOX_AREA) return new Mask(w, h, px, null, box, 0, "SEGMENTATION_FRAGMENT");
        return new Mask(w, h, px, fabric, box, (double) skin / product, null, fg, hole, skinPx, bg);
    }

    static String target(PieceType type, String sub) {
        return switch (type) {
            case UPPER_PIECE -> "collar";
            case LOWER_PIECE -> NO_FLY.contains(sub) ? "front_below_waistband" : "fly";
            case FULL_BODY_PIECE -> "bodice";
            case SHOES_PIECE -> "logo";
            case ACCESSORY_PIECE -> "center";
        };
    }

    record Plan(ImageOps.Box region, double ax, double ay, String source, String reason) {
        Plan(ImageOps.Box region, double ax, double ay, String source) { this(region, ax, ay, source, null); }
        static Plan refuse(String reason) { return new Plan(new ImageOps.Box(0, 0, 0, 0), 0, 0, null, reason); }
    }

    /** Região (em pixels da máscara) e ponto de ancoragem de cada categoria/subcategoria: {@link FabricPlanner}. */
    static Plan plan(PieceType type, String sub, boolean[] fabric, int[] px, int w, int h, ImageOps.Box b, FramingStrategy.Focus focus,
                     boolean person) {
        return FabricPlanner.plan(type, sub, fabric, px, w, h, b, focus, person);
    }

    /** Erosão quadrada de raio r: {@link FabricMasks#erode}. */
    static boolean[] erode(boolean[] in, int w, int h, int r) {
        return FabricMasks.erode(in, w, h, r);
    }
}
