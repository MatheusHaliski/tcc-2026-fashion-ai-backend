package br.com.fashionai.application.imaging;

import br.com.fashionai.domain.model.enums.BodyBuild;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.TryOnLayer;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Geometria do manequim 2D (RF18 — masculino/feminino, porte e tom de pele). Coordenadas normalizadas
 * (0–1) sobre um canvas 2:3; o frontend recebe a mesma tabela (GET /api/rf18/mannequin) e desenha o SVG
 * com os mesmos pontos, para que a prévia no navegador e o render do servidor coincidam. Os landmarks
 * de pé/perna e mão/rosto alimentam o Category Fallback Compositor (#18).
 */
public final class MannequinGeometry {
    public static final int WIDTH = 768;
    public static final int HEIGHT = 1152;
    public static final Map<String, String> SKIN_TONES = new LinkedHashMap<>();

    static {
        SKIN_TONES.put("porcelana", "#F4D7C5");
        SKIN_TONES.put("clara", "#E8C1A0");
        SKIN_TONES.put("media", "#C99A6E");
        SKIN_TONES.put("oliva", "#A97C50");
        SKIN_TONES.put("morena", "#8A5A3B");
        SKIN_TONES.put("escura", "#5E3A26");
        SKIN_TONES.put("retinta", "#3F261A");
    }

    private MannequinGeometry() {
    }

    public record Box(double x, double y, double w, double h) {
        public Map<String, Double> toMap() {
            return Map.of("x", x, "y", y, "w", w, "h", h);
        }
    }

    public record Point(double x, double y) {
    }

    /**
     * Corpo do manequim 2D. {@code levels} são as alturas (fração da altura do canvas, de cima para baixo) de cada
     * referencial: headTop, chin, neck, shoulder, chest, waist, hip, crotch, knee, ankle. Com o Avatar 3D elas vêm das
     * mesmas fórmulas do corpo 3D (lib/avatar3d/body-spec.ts); sem avatar, são as do manequim genérico.
     */
    public record Body(MannequinSex sex, BodyBuild build, double shoulderW, double waistW, double hipW, double headR,
                       Map<String, Point> landmarks, Map<String, Box> anchors, Map<String, Double> levels, Params params) {
    }

    /** Proporções canônicas do corpo (frações da estatura), iguais às de {@code BodyParams} do Avatar 3D. */
    public record Params(double stature, double shoulderW, double chestW, double waistW, double hipW, double legLen,
                         double armLen, double headH, double build) {
    }

    /** De onde veio cada dado do manequim: avatar (medido/informado) ou preferências genéricas. */
    public record Identity(String source, String sex, String sexSource, String skinHex, String skinSource, Double heightCm,
                           Map<String, String> sources, List<String> warnings) {
    }

    static final double CANVAS_TOP = 0.045;
    static final double CANVAS_ANKLE = 0.9;
    static final double ANKLE_FRAC = 0.039;

    /** Pixels por metro: do topo da cabeça (0,045 H) ao tornozelo (0,9 H) cabe a estatura menos o tornozelo. */
    public static double pxPerMeter(double stature) {
        return (CANVAS_ANKLE - CANVAS_TOP) * HEIGHT / (stature * (1 - ANKLE_FRAC));
    }

    /** Lê {@code model.body.params} do Avatar 3D salvo (frações da estatura), ou vazio se não há corpo válido. */
    @SuppressWarnings("unchecked")
    public static Optional<Params> paramsOf(Map<String, Object> model) {
        if (model == null || !(model.get("body") instanceof Map<?, ?> body) || !(body.get("params") instanceof Map<?, ?> pm)) {
            return Optional.empty();
        }
        Map<String, Object> q = (Map<String, Object>) pm;
        double stature = num(q, "stature", 0);
        if (stature < 1.2 || stature > 2.2) {
            return Optional.empty();
        }
        return Optional.of(new Params(stature, clamp(num(q, "shoulderW", 0.19), 0.15, 0.26), clamp(num(q, "chestW", 0.175), 0.12, 0.26),
                clamp(num(q, "waistW", 0.15), 0.1, 0.24), clamp(num(q, "hipW", 0.205), 0.14, 0.28), clamp(num(q, "legLen", 0.53), 0.44, 0.6),
                clamp(num(q, "armLen", 0.333), 0.28, 0.4), clamp(num(q, "headH", 0.13), 0.1, 0.16), clamp(num(q, "build", 0), -1.5, 2.5)));
    }

    /** Sexo do corpo do avatar ({@code model.body.sex}), se houver. */
    public static Optional<MannequinSex> sexOf(Map<String, Object> model) {
        if (model == null || !(model.get("body") instanceof Map<?, ?> body) || body.get("sex") == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(MannequinSex.valueOf(String.valueOf(body.get("sex"))));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /**
     * Identidade do manequim: com avatar, o sexo, a pele (medida na foto do rosto) e a origem de cada medida vêm dele;
     * sem avatar, tudo é preferência genérica (tom de pele e porte escolhidos).
     */
    @SuppressWarnings("unchecked")
    public static Identity identity(Map<String, Object> avatar, MannequinSex sex, String skinTone, boolean bodyFromAvatar) {
        Map<String, Object> model = avatar == null ? null : (Map<String, Object>) avatar.get("model");
        String skinHex = SKIN_TONES.getOrDefault(skinTone, SKIN_TONES.get("media"));
        String skinSource = "preference";
        if (model != null && model.get("skin") instanceof String hex && hex.matches("#[0-9a-fA-F]{6}")) {
            skinHex = hex;
            skinSource = "observed";
        }
        Map<String, String> sources = new LinkedHashMap<>();
        Double heightCm = null;
        List<String> warnings = new ArrayList<>();
        if (bodyFromAvatar && model.get("body") instanceof Map<?, ?> body) {
            if (body.get("sources") instanceof Map<?, ?> src) {
                src.forEach((k, v) -> sources.put(String.valueOf(k), String.valueOf(v)));
            }
            if (body.get("heightCm") instanceof Number n) {
                heightCm = n.doubleValue();
            }
            if (body.get("warnings") instanceof List<?> w) {
                w.forEach(x -> warnings.add(String.valueOf(x)));
            }
        }
        return new Identity(bodyFromAvatar ? "avatar" : "preferences", sex.name(), bodyFromAvatar ? "avatar" : "preference", skinHex, skinSource,
                heightCm, sources, warnings);
    }

    private static double num(Map<String, Object> m, String k, double d) {
        return m.get(k) instanceof Number n ? n.doubleValue() : d;
    }

    private static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    /**
     * Manequim 2D derivado do corpo canônico do Avatar 3D: mesmas larguras, alturas e caixas das peças que o corpo 3D
     * (body-spec.ts / photoBox em mannequin.tsx), projetadas no canvas 2:3. É o que garante que o provador 2D e o
     * visualizador 3D mostrem a mesma pessoa.
     */
    public static Body fromParams(MannequinSex sex, Params p) {
        MannequinSex s = sex == null ? MannequinSex.FEMININO : sex;
        double H = p.stature();
        double g = 1 + 0.12 * p.build();
        double k = pxPerMeter(H);
        java.util.function.DoubleUnaryOperator fx = m -> m * k / WIDTH;                       // metros → fração da largura
        java.util.function.DoubleUnaryOperator fy = m -> CANVAS_ANKLE - (m - ANKLE_FRAC * H) * k / HEIGHT; // altura (m) → fração do canvas
        double shoulderY = (0.818 - (0.13 - p.headH()) * 0.5) * H;
        double neckBaseY = shoulderY + 0.03 * H;
        double hipJointY = p.legLen() * H;
        double crotchY = hipJointY - 0.045 * H;
        double kneeY = 0.285 * (p.legLen() / 0.53) * H;
        double waistY = hipJointY + (shoulderY - hipJointY) * 0.38;
        double chestY = hipJointY + (shoulderY - hipJointY) * 0.72;
        double chinY = (1 - p.headH()) * H;
        double sh = p.shoulderW() * H / 2;
        double delt = 0.034 * H * g;
        double shoulder = fx.applyAsDouble(2 * (sh + delt * 0.55));
        double waist = fx.applyAsDouble(p.waistW() * H * g);
        double hip = fx.applyAsDouble(p.hipW() * H * g);
        double headR = p.headH() * H * k / 2.45 / WIDTH;
        Map<String, Double> lv = new LinkedHashMap<>();
        lv.put("headTop", CANVAS_TOP);
        lv.put("chin", fy.applyAsDouble(chinY));
        lv.put("neck", fy.applyAsDouble(neckBaseY));
        lv.put("shoulder", fy.applyAsDouble(shoulderY));
        lv.put("chest", fy.applyAsDouble(chestY));
        lv.put("waist", fy.applyAsDouble(waistY));
        lv.put("hip", fy.applyAsDouble(hipJointY));
        lv.put("crotch", fy.applyAsDouble(crotchY));
        lv.put("knee", fy.applyAsDouble(kneeY));
        lv.put("ankle", CANVAS_ANKLE);
        Map<String, Point> lm = landmarks(shoulder, hip, headR, lv);
        double armAng = Math.toRadians(12);
        double upper = p.armLen() * H * (0.188 / 0.333);
        double fore = p.armLen() * H * (0.145 / 0.333);
        double wristX = fx.applyAsDouble(sh + Math.sin(armAng) * upper + Math.sin(armAng * 0.8) * fore);
        double wristY = fy.applyAsDouble(shoulderY - 0.012 * H - Math.cos(armAng) * upper - Math.cos(armAng * 0.8) * fore);
        lm.put("wrist_left", new Point(0.5 - wristX, wristY));
        lm.put("wrist_right", new Point(0.5 + wristX, wristY));
        lm.put("hand_left", new Point(0.5 - wristX - 0.01, wristY + 0.04));
        lm.put("hand_right", new Point(0.5 + wristX + 0.01, wristY + 0.04));
        // caixas das peças: as mesmas do photoBox 3D (largura pela distância entre ombros, altura pelos níveis)
        Map<String, Box> an = new LinkedHashMap<>();
        double topW = fx.applyAsDouble(3.4 * sh);
        double topY = fy.applyAsDouble(neckBaseY + 0.01 * H);
        an.put("TOP", new Box(0.5 - topW / 2, topY, topW, (neckBaseY - crotchY + 0.04 * H) * k / HEIGHT));
        double outerW = fx.applyAsDouble(3.7 * sh);
        an.put("OUTERWEAR", new Box(0.5 - outerW / 2, fy.applyAsDouble(neckBaseY + 0.02 * H), outerW, (neckBaseY - crotchY + 0.09 * H) * k / HEIGHT));
        double hw = p.hipW() * H / 2 * g;
        double bottomW = fx.applyAsDouble(3.1 * hw);
        double bottomTop = waistY + 0.025 * H;
        an.put("BOTTOM", new Box(0.5 - bottomW / 2, fy.applyAsDouble(bottomTop), bottomW, (bottomTop - 0.02 * H) * k / HEIGHT));
        an.put("FULL_BODY", new Box(0.5 - topW / 2, topY, topW, (neckBaseY - kneeY + 0.05 * H) * k / HEIGHT));
        double shoesW = fx.applyAsDouble(2.4 * hw);
        an.put("SHOES", new Box(0.5 - shoesW / 2, fy.applyAsDouble(0.1 * H), shoesW, 0.12 * H * k / HEIGHT));
        an.put("feet", an.get("SHOES"));
        accessoryAnchors(an, shoulder, waist, headR, lv, lm);
        return new Body(s, BodyBuild.MEDIUM, shoulder, waist, hip, headR, lm, an, lv, p);
    }

    /** Níveis do manequim genérico (sem avatar). */
    static Map<String, Double> genericLevels(boolean male) {
        Map<String, Double> lv = new LinkedHashMap<>();
        lv.put("headTop", 0.045);
        lv.put("chin", 0.14);
        lv.put("neck", 0.168);
        lv.put("shoulder", 0.205);
        lv.put("chest", 0.3);
        lv.put("waist", male ? 0.455 : 0.43);
        lv.put("hip", 0.52);
        lv.put("crotch", 0.56);
        lv.put("knee", 0.7);
        lv.put("ankle", 0.9);
        return lv;
    }

    private static Map<String, Point> landmarks(double shoulder, double hip, double headR, Map<String, Double> lv) {
        Map<String, Point> lm = new LinkedHashMap<>();
        lm.put("head_top", new Point(0.5, lv.get("headTop")));
        lm.put("eyes", new Point(0.5, lv.get("headTop") + 0.053));
        lm.put("ear_left", new Point(0.5 - headR * 0.95, lv.get("headTop") + 0.058));
        lm.put("ear_right", new Point(0.5 + headR * 0.95, lv.get("headTop") + 0.058));
        lm.put("neck", new Point(0.5, lv.get("neck")));
        lm.put("shoulder_left", new Point(0.5 - shoulder / 2, lv.get("shoulder")));
        lm.put("shoulder_right", new Point(0.5 + shoulder / 2, lv.get("shoulder")));
        lm.put("waist", new Point(0.5, lv.get("waist")));
        lm.put("hip", new Point(0.5, lv.get("hip")));
        lm.put("knee_left", new Point(0.5 - hip * 0.22, lv.get("knee")));
        lm.put("knee_right", new Point(0.5 + hip * 0.22, lv.get("knee")));
        lm.put("ankle_left", new Point(0.5 - hip * 0.2, lv.get("ankle")));
        lm.put("ankle_right", new Point(0.5 + hip * 0.2, lv.get("ankle")));
        lm.put("foot_left", new Point(0.5 - hip * 0.2, lv.get("ankle") + 0.035));
        lm.put("foot_right", new Point(0.5 + hip * 0.2, lv.get("ankle") + 0.035));
        return lm;
    }

    private static void accessoryAnchors(Map<String, Box> an, double shoulder, double waist, double headR, Map<String, Double> lv, Map<String, Point> lm) {
        double top = lv.get("headTop");
        an.put("face", new Box(0.5 - headR * 1.1, top + 0.033, headR * 2.2, 0.045));
        an.put("head", new Box(0.5 - headR * 1.35, top - 0.027, headR * 2.7, 0.07));
        an.put("neck", new Box(0.5 - shoulder * 0.28, lv.get("neck") - 0.003, shoulder * 0.56, 0.1));
        an.put("ears", new Box(0.5 - headR * 1.2, top + 0.053, headR * 2.4, 0.03));
        Point wr = lm.get("wrist_right");
        an.put("wrist", new Box(wr.x() - 0.0275, wr.y() - 0.015, 0.055, 0.035));
        an.put("hand", new Box(wr.x() - 0.05, wr.y() + 0.01, 0.15, 0.17));
        an.put("finger", new Box(wr.x() + 0.005, wr.y() + 0.06, 0.03, 0.02));
        an.put("waist", new Box(0.5 - waist * 0.62, lv.get("waist") - 0.015, waist * 1.24, 0.035));
        an.put("shoulder_bag", new Box(0.5 + shoulder / 2 - 0.04, lv.get("shoulder") + 0.095, 0.16, 0.2));
    }

    public static Body body(MannequinSex sex, BodyBuild build) {
        MannequinSex s = sex == null ? MannequinSex.FEMININO : sex;
        BodyBuild b = build == null ? BodyBuild.MEDIUM : build;
        double factor = switch (b) {
            case SLIM -> 0.92;
            case MEDIUM -> 1.0;
            case ATHLETIC -> 1.08;
            case CURVY -> 1.03;
            case PLUS -> 1.16;
        };
        boolean male = s == MannequinSex.MASCULINO;
        double shoulder = (male ? 0.37 : 0.32) * factor;
        double waist = (male ? 0.25 : 0.21) * factor * (b == BodyBuild.PLUS ? 1.08 : 1);
        double hip = (male ? 0.27 : 0.31) * factor * (b == BodyBuild.CURVY ? 1.1 : 1);
        double headR = male ? 0.058 : 0.054;
        Map<String, Point> lm = new LinkedHashMap<>();
        lm.put("head_top", new Point(0.5, 0.045));
        lm.put("eyes", new Point(0.5, 0.098));
        lm.put("ear_left", new Point(0.5 - headR * 0.95, 0.103));
        lm.put("ear_right", new Point(0.5 + headR * 0.95, 0.103));
        lm.put("neck", new Point(0.5, 0.168));
        lm.put("shoulder_left", new Point(0.5 - shoulder / 2, 0.205));
        lm.put("shoulder_right", new Point(0.5 + shoulder / 2, 0.205));
        lm.put("waist", new Point(0.5, male ? 0.455 : 0.43));
        lm.put("hip", new Point(0.5, 0.52));
        lm.put("wrist_left", new Point(0.5 - shoulder / 2 - 0.045, 0.505));
        lm.put("wrist_right", new Point(0.5 + shoulder / 2 + 0.045, 0.505));
        lm.put("hand_left", new Point(0.5 - shoulder / 2 - 0.05, 0.545));
        lm.put("hand_right", new Point(0.5 + shoulder / 2 + 0.05, 0.545));
        lm.put("knee_left", new Point(0.5 - hip * 0.22, 0.7));
        lm.put("knee_right", new Point(0.5 + hip * 0.22, 0.7));
        lm.put("ankle_left", new Point(0.5 - hip * 0.2, 0.9));
        lm.put("ankle_right", new Point(0.5 + hip * 0.2, 0.9));
        lm.put("foot_left", new Point(0.5 - hip * 0.2, 0.935));
        lm.put("foot_right", new Point(0.5 + hip * 0.2, 0.935));

        Map<String, Box> anchors = new LinkedHashMap<>();
        double topW = shoulder * 1.55;
        anchors.put("TOP", new Box(0.5 - topW / 2, 0.185, topW, 0.36));
        double outerW = shoulder * 1.68;
        anchors.put("OUTERWEAR", new Box(0.5 - outerW / 2, 0.178, outerW, 0.43));
        double bottomW = hip * 1.25;
        anchors.put("BOTTOM", new Box(0.5 - bottomW / 2, 0.44, bottomW, 0.47));
        anchors.put("FULL_BODY", new Box(0.5 - topW / 2, 0.185, topW, 0.62));
        anchors.put("SHOES", new Box(0.5 - hip * 0.46, 0.885, hip * 0.92, 0.075));
        anchors.put("feet", anchors.get("SHOES"));
        anchors.put("face", new Box(0.5 - headR * 1.1, 0.078, headR * 2.2, 0.045));
        anchors.put("head", new Box(0.5 - headR * 1.35, 0.018, headR * 2.7, 0.07));
        anchors.put("neck", new Box(0.5 - shoulder * 0.28, 0.165, shoulder * 0.56, 0.1));
        anchors.put("ears", new Box(0.5 - headR * 1.2, 0.098, headR * 2.4, 0.03));
        anchors.put("wrist", new Box(0.5 + shoulder / 2 + 0.02, 0.49, 0.055, 0.035));
        anchors.put("hand", new Box(0.5 + shoulder / 2 - 0.01, 0.5, 0.15, 0.17));
        anchors.put("finger", new Box(0.5 + shoulder / 2 + 0.035, 0.55, 0.03, 0.02));
        anchors.put("waist", new Box(0.5 - waist * 0.62, (male ? 0.455 : 0.43) - 0.015, waist * 1.24, 0.035));
        anchors.put("shoulder_bag", new Box(0.5 + shoulder / 2 - 0.04, 0.3, 0.16, 0.2));
        return new Body(s, b, shoulder, waist, hip, headR, lm, anchors, genericLevels(male), null);
    }

    /** Camada do provador (RF18.CA02): base → intermediária → externa → acessório. */
    public static TryOnLayer layerOf(SchemeSlot slot) {
        return switch (slot) {
            case BOTTOM -> TryOnLayer.BASE;
            case TOP, FULL_BODY -> TryOnLayer.INTERMEDIATE;
            case OUTERWEAR -> TryOnLayer.OUTER;
            case SHOES, ACCESSORY -> TryOnLayer.ACCESSORY;
        };
    }

    /** Âncora de uma peça: roupas vão pelo slot; acessórios rígidos vão pelo landmark da subcategoria (#18). */
    public static String anchorOf(SchemeSlot slot, String subcategory) {
        if (slot != SchemeSlot.ACCESSORY) {
            return slot.name();
        }
        String sub = subcategory == null ? "" : subcategory;
        if (Set.of("sunglasses", "eyeglasses").contains(sub)) {
            return "face";
        }
        if (Set.of("hat", "cap", "beanie", "hair_accessory").contains(sub)) {
            return "head";
        }
        if (Set.of("necklace", "scarf", "tie", "bow_tie").contains(sub)) {
            return "neck";
        }
        if ("earrings".equals(sub)) {
            return "ears";
        }
        if (Set.of("watch", "bracelet").contains(sub)) {
            return "wrist";
        }
        if ("ring".equals(sub)) {
            return "finger";
        }
        if ("belt".equals(sub)) {
            return "waist";
        }
        if (Set.of("crossbody_bag", "backpack", "tote_bag").contains(sub)) {
            return "shoulder_bag";
        }
        if ("socks".equals(sub)) {
            return "feet";
        }
        return "hand";
    }

    /** Regra de substituição (RF18.CA03): a mesma camada na mesma âncora aceita uma peça só. */
    public static String replacementKey(SchemeSlot slot, String subcategory) {
        return layerOf(slot).name() + ":" + anchorOf(slot, subcategory);
    }

    /** RF18.CA08: manequim masculino aceita MASCULINO/UNISSEX; feminino aceita FEMININO/UNISSEX. */
    public static boolean sexMatches(MannequinSex mannequin, String pieceSex) {
        if (pieceSex == null || "UNISSEX".equals(pieceSex)) {
            return true;
        }
        return mannequin.name().equals(pieceSex);
    }

    public static Map<String, Object> describe(MannequinSex sex, BodyBuild build, String skinTone) {
        return describe(body(sex, build), skinTone, SKIN_TONES.getOrDefault(skinTone, SKIN_TONES.get("media")));
    }

    public static Map<String, Object> describe(Body body, String skinTone, String skinHex) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sex", body.sex());
        out.put("build", body.build());
        out.put("skinTone", skinTone);
        out.put("skinHex", skinHex);
        out.put("levels", body.levels());
        if (body.params() != null) {
            Map<String, Object> pm = new LinkedHashMap<>();
            pm.put("stature", body.params().stature());
            pm.put("shoulderW", body.params().shoulderW());
            pm.put("chestW", body.params().chestW());
            pm.put("waistW", body.params().waistW());
            pm.put("hipW", body.params().hipW());
            pm.put("legLen", body.params().legLen());
            pm.put("armLen", body.params().armLen());
            pm.put("headH", body.params().headH());
            pm.put("build", body.params().build());
            out.put("params", pm);
        }
        out.put("width", WIDTH);
        out.put("height", HEIGHT);
        out.put("shoulderW", body.shoulderW());
        out.put("waistW", body.waistW());
        out.put("hipW", body.hipW());
        out.put("headR", body.headR());
        Map<String, Object> lm = new LinkedHashMap<>();
        body.landmarks().forEach((k, v) -> lm.put(k, Map.of("x", v.x(), "y", v.y())));
        out.put("landmarks", lm);
        Map<String, Object> an = new LinkedHashMap<>();
        body.anchors().forEach((k, v) -> an.put(k, v.toMap()));
        out.put("anchors", an);
        out.put("skinTones", SKIN_TONES);
        return out;
    }
}
