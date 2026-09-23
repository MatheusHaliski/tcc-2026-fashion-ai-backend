package br.com.fashionai.application.imaging;

import br.com.fashionai.domain.model.enums.BodyBuild;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.TryOnLayer;

import java.util.LinkedHashMap;
import java.util.Map;
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

    public record Body(MannequinSex sex, BodyBuild build, double shoulderW, double waistW, double hipW, double headR,
                       Map<String, Point> landmarks, Map<String, Box> anchors) {
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
        return new Body(s, b, shoulder, waist, hip, headR, lm, anchors);
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
        Body body = body(sex, build);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sex", body.sex());
        out.put("build", body.build());
        out.put("skinTone", skinTone);
        out.put("skinHex", SKIN_TONES.getOrDefault(skinTone, SKIN_TONES.get("media")));
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
