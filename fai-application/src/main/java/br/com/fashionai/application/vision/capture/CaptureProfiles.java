package br.com.fashionai.application.vision.capture;

import br.com.fashionai.application.vision.VisionSignal;
import br.com.fashionai.application.vision.capture.CaptureProfile.Condition;
import br.com.fashionai.application.vision.capture.CaptureProfile.Guidance;
import br.com.fashionai.application.vision.capture.CaptureProfile.Reveal;
import br.com.fashionai.application.vision.capture.CaptureProfile.SecondaryView;
import br.com.fashionai.application.vision.spec.PhotographySpecs;
import br.com.fashionai.domain.model.enums.CaptureView;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.vision.VisionSignal.BRAND;
import static br.com.fashionai.application.vision.VisionSignal.MATERIAL;
import static br.com.fashionai.application.vision.VisionSignal.MODEL;
import static br.com.fashionai.application.vision.VisionSignal.PATTERN;
import static br.com.fashionai.application.vision.VisionSignal.PRODUCT_LINE;
import static br.com.fashionai.application.vision.VisionSignal.SUBCATEGORY;
import static br.com.fashionai.domain.model.enums.CaptureView.*;

/**
 * RF4 · Perfis de captura v1 ({@value #VERSION}). Cobrem todas as subcategorias da taxonomia; os pesos
 * {@code informs} são heurísticos na v1 e recalibráveis pelo ganho realizado de cada pedido (capture_requests).
 */
public final class CaptureProfiles {
    public static final String VERSION = "CAPTURE_PROFILES_V1";
    public static final String GENERIC = "GENERIC";

    private static final Map<String, CaptureProfile> BY_ID = new LinkedHashMap<>();
    private static final Map<String, CaptureProfile> BY_SUBCATEGORY = new LinkedHashMap<>();
    private static final Map<String, String> BY_CATEGORY = Map.of("upper_piece", "TSHIRT", "lower_piece", "PANTS",
            "shoes_piece", "SNEAKER", "accessory_piece", GENERIC, "full_body_piece", "DRESS");

    private static final Map<String, String> PANTS_EDGES = edges("waistband", "hems", "legs", "legs");
    private static final Map<String, String> UPPER_EDGES = edges("shoulders", "hem", "sleeves", "sleeves");
    private static final Map<String, String> SHOE_EDGES = edges("collar", "sole", "toe_or_heel", "toe_or_heel");

    static {
        // ── parte de baixo
        add(new CaptureProfile("PANTS", "LOWER", List.of("jeans", "tailored_pants", "casual_pants", "chino_pants",
                "cargo_pants", "jogger_pants", "sweatpants", "leggings", "culottes"), FRONT_VIEW, List.of(BACK_VIEW), "PANTS",
                PANTS_EDGES, List.of("waistband", "hems"),
                List.of("front_waistband", "back_waistband_patch", "back_pockets", "front_rivets", "inner_label"),
                List.of(sv(BACK_VIEW, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.85, PRODUCT_LINE, 0.4, MODEL, 0.3, SUBCATEGORY, 0.2, PATTERN, 0.1),
                        sv(LABEL_DETAIL, Condition.ALWAYS, 1.1, Reveal.NEW_REGION, BRAND, 0.8, MATERIAL, 0.8, PRODUCT_LINE, 0.5, MODEL, 0.5),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.45),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.7, PATTERN, 0.5)),
                specs(FRONT_VIEW, "PANTS_FRONT_V1", BACK_VIEW, "PANTS_BACK_V1"), 0, false,
                new Guidance("pants", "PORTRAIT", 60, 90, "plain_contrast", "diffuse")));
        add(new CaptureProfile("SHORTS", "LOWER", List.of("shorts", "bermuda_shorts", "denim_shorts", "skort"), FRONT_VIEW,
                List.of(BACK_VIEW), "PANTS", PANTS_EDGES, List.of("waistband", "hems"),
                List.of("front_waistband", "back_waistband_patch", "back_pockets", "inner_label"),
                List.of(sv(BACK_VIEW, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.8, PRODUCT_LINE, 0.3, SUBCATEGORY, 0.2),
                        sv(LABEL_DETAIL, Condition.ALWAYS, 1.25, Reveal.NEW_REGION, BRAND, 0.7, MATERIAL, 0.8),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.65),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.7, PATTERN, 0.5)),
                specs(FRONT_VIEW, "SHORTS_FRONT_V1", BACK_VIEW, "SHORTS_FRONT_V1"), 0, false,
                new Guidance("shorts", "PORTRAIT", 50, 70, "plain_contrast", "diffuse")));
        add(new CaptureProfile("SKIRT", "LOWER", List.of("skirt"), FRONT_VIEW, List.of(), "SKIRT",
                edges("waistband", "hem", "whole", "whole"), List.of("waistband", "hem"), List.of("inner_label", "waistband"),
                List.of(sv(LABEL_DETAIL, Condition.ALWAYS, 1.2, Reveal.NEW_REGION, BRAND, 0.7, MATERIAL, 0.8),
                        sv(BACK_VIEW, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.4, PATTERN, 0.1),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.6),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.7, PATTERN, 0.5)),
                specs(FRONT_VIEW, "SKIRT_FRONT_V1"), 0, false, new Guidance("skirt", "PORTRAIT", 50, 80, "plain_contrast", "diffuse")));
        // ── parte de cima e corpo inteiro
        add(upper("TSHIRT", List.of("t_shirt", "tank_top", "crop_top", "bodysuit"), "TSHIRT_FRONT_V1", "tshirt",
                List.of(sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.7),
                        sv(LABEL_DETAIL, Condition.ALWAYS, 1.15, Reveal.NEW_REGION, BRAND, 0.75, MATERIAL, 0.85),
                        sv(BACK_VIEW, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.35, PATTERN, 0.2),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.7, PATTERN, 0.5))));
        add(upper("SHIRT", List.of("shirt", "blouse"), "SHIRT_FRONT_V1", "shirt",
                List.of(sv(LABEL_DETAIL, Condition.ALWAYS, 1.1, Reveal.NEW_REGION, BRAND, 0.8, MATERIAL, 0.85),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.7),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.7, PATTERN, 0.5),
                        sv(BACK_VIEW, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.25))));
        add(upper("POLO", List.of("polo_shirt"), "POLO_FRONT_V1", "polo",
                List.of(sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.8),
                        sv(LABEL_DETAIL, Condition.ALWAYS, 1.1, Reveal.NEW_REGION, BRAND, 0.75, MATERIAL, 0.85),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.7, PATTERN, 0.4))));
        add(upper("KNITWEAR", List.of("sweater", "sweatshirt", "hoodie", "cardigan"), "KNITWEAR_FRONT_V1", "knit",
                List.of(sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.7),
                        sv(LABEL_DETAIL, Condition.ALWAYS, 1.15, Reveal.NEW_REGION, BRAND, 0.75, MATERIAL, 0.85),
                        sv(BACK_VIEW, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.4, PATTERN, 0.2),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.75, PATTERN, 0.5))));
        add(upper("OUTERWEAR", List.of("blazer", "jacket", "coat", "parka", "windbreaker", "vest", "kimono"), "OUTERWEAR_FRONT_V1", "jacket",
                List.of(sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.7),
                        sv(INNER_LABEL, Condition.ALWAYS, 1.25, Reveal.NEW_REGION, BRAND, 0.8, MATERIAL, 0.85),
                        sv(HARDWARE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.5),
                        sv(BACK_VIEW, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.45),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.7, PATTERN, 0.4))));
        add(new CaptureProfile("DRESS", "FULL_BODY", List.of("dress", "jumpsuit", "romper", "overalls", "matching_set"),
                FRONT_VIEW, List.of(), "DRESS", edges("neckline", "hem", "sleeves", "sleeves"), List.of("neckline", "hem"),
                List.of("inner_label", "chest"),
                List.of(sv(LABEL_DETAIL, Condition.ALWAYS, 1.15, Reveal.NEW_REGION, BRAND, 0.75, MATERIAL, 0.85),
                        sv(BACK_VIEW, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.3, PATTERN, 0.1),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.5),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.7, PATTERN, 0.5)),
                specs(FRONT_VIEW, "DRESS_FRONT_V1", BACK_VIEW, "UPPER_BACK_V1"), 0, false,
                new Guidance("dress", "PORTRAIT", 80, 120, "plain_contrast", "diffuse")));
        // ── calçados
        add(new CaptureProfile("SNEAKER", "FOOTWEAR", List.of("casual_sneakers", "running_shoes", "training_shoes",
                "basketball_shoes", "skate_shoes", "high_top_sneakers"), THREE_QUARTER, List.of(LEFT_SIDE, RIGHT_SIDE), "FOOTWEAR",
                SHOE_EDGES, List.of("toe_or_heel", "sole"), List.of("side_panel", "tongue", "heel", "insole", "outsole"),
                List.of(sv(RIGHT_SIDE, Condition.OTHER_SIDE, 1.0, Reveal.NEW_REGION, BRAND, 0.75, MODEL, 0.3),
                        sv(LEFT_SIDE, Condition.OTHER_SIDE, 1.0, Reveal.NEW_REGION, BRAND, 0.75, MODEL, 0.3),
                        sv(TONGUE_LABEL, Condition.ALWAYS, 1.15, Reveal.NEW_REGION, BRAND, 0.6, MODEL, 0.9, PRODUCT_LINE, 0.8),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.6),
                        sv(INNER_LABEL, Condition.MODEL_WANTED, 1.3, Reveal.NEW_REGION, MODEL, 0.7, BRAND, 0.5),
                        sv(SOLE_VIEW, Condition.MODEL_WANTED, 1.3, Reveal.NEW_REGION, MODEL, 0.5, PRODUCT_LINE, 0.5, BRAND, 0.3)),
                specs(THREE_QUARTER, "SNEAKER_THREE_QUARTER_V1", LEFT_SIDE, "SNEAKER_SIDE_V1", RIGHT_SIDE, "SNEAKER_SIDE_V1",
                        SOLE_VIEW, "SNEAKER_SOLE_V1"), 0, false, new Guidance("sneaker", "LANDSCAPE", 30, 50, "plain_contrast", "diffuse")));
        add(shoe("BOOT", List.of("ankle_boots", "long_boots", "combat_boots"), LEFT_SIDE, List.of(THREE_QUARTER), "boot",
                edges("shaft", "sole", "toe_or_heel", "toe_or_heel"),
                List.of(sv(RIGHT_SIDE, Condition.OTHER_SIDE, 1.0, Reveal.NEW_REGION, BRAND, 0.5),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.6),
                        sv(INNER_LABEL, Condition.ALWAYS, 1.25, Reveal.NEW_REGION, BRAND, 0.65, MODEL, 0.6),
                        sv(SOLE_VIEW, Condition.MODEL_WANTED, 1.3, Reveal.NEW_REGION, BRAND, 0.4, MODEL, 0.4)),
                specs(LEFT_SIDE, "BOOT_SIDE_V1", RIGHT_SIDE, "BOOT_SIDE_V1", THREE_QUARTER, PhotographySpecs.SHOE_SINGLE)));
        add(shoe("FORMAL_SHOE", List.of("loafers", "moccasins", "oxford_shoes", "derby_shoes"), THREE_QUARTER, List.of(LEFT_SIDE), "formal_shoe",
                SHOE_EDGES,
                List.of(sv(INNER_LABEL, Condition.ALWAYS, 1.15, Reveal.NEW_REGION, BRAND, 0.8, MODEL, 0.5),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.5),
                        sv(SOLE_VIEW, Condition.MODEL_WANTED, 1.3, Reveal.NEW_REGION, BRAND, 0.4, MODEL, 0.4)),
                specs(THREE_QUARTER, PhotographySpecs.SHOE_SINGLE, LEFT_SIDE, "SNEAKER_SIDE_V1")));
        add(shoe("SANDAL", List.of("sandals", "flip_flops", "espadrilles"), TOP_VIEW, List.of(THREE_QUARTER), "sandal",
                edges("straps_or_sole", "straps_or_sole", "straps_or_sole", "straps_or_sole"),
                List.of(sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.7),
                        sv(SOLE_VIEW, Condition.ALWAYS, 1.2, Reveal.NEW_REGION, BRAND, 0.5, MODEL, 0.3)),
                specs(TOP_VIEW, "SANDAL_TOP_V1", THREE_QUARTER, PhotographySpecs.SHOE_SINGLE)));
        // salto alto: a sola pode ser assinatura da marca (sola vermelha), então ela entra como vista útil normal
        add(shoe("HEEL", List.of("heels"), LEFT_SIDE, List.of(THREE_QUARTER), "heel", SHOE_EDGES,
                List.of(sv(INNER_LABEL, Condition.ALWAYS, 1.15, Reveal.NEW_REGION, BRAND, 0.75),
                        sv(SOLE_VIEW, Condition.ALWAYS, 1.2, Reveal.NEW_REGION, BRAND, 0.55),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.5)),
                specs(LEFT_SIDE, "HEEL_SIDE_V1", RIGHT_SIDE, "HEEL_SIDE_V1", THREE_QUARTER, PhotographySpecs.SHOE_SINGLE)));
        add(shoe("FLAT", List.of("flats"), THREE_QUARTER, List.of(LEFT_SIDE), "flat", SHOE_EDGES,
                List.of(sv(INNER_LABEL, Condition.ALWAYS, 1.15, Reveal.NEW_REGION, BRAND, 0.75),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.5),
                        sv(SOLE_VIEW, Condition.MODEL_WANTED, 1.3, Reveal.NEW_REGION, BRAND, 0.3, MODEL, 0.4)),
                specs(THREE_QUARTER, PhotographySpecs.SHOE_SINGLE, LEFT_SIDE, "SNEAKER_SIDE_V1")));
        // ── acessórios
        add(acc("BAG", List.of("handbag", "crossbody_bag", "tote_bag", "clutch"), FRONT_VIEW, List.of(THREE_QUARTER), "BAG", "bag",
                edges("handles", "body", "body", "body"), List.of("body", "handles"), List.of("front_logo", "hardware", "inner_label"),
                List.of(sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.75),
                        sv(INNER_LABEL, Condition.ALWAYS, 1.25, Reveal.NEW_REGION, BRAND, 0.8, MODEL, 0.4),
                        sv(HARDWARE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.55),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.75, PATTERN, 0.5)),
                specs(FRONT_VIEW, "BAG_FRONT_V1", THREE_QUARTER, "BAG_FRONT_V1"), 0, false, 40, 70));
        add(acc("BACKPACK", List.of("backpack"), FRONT_VIEW, List.of(), "BAG", "backpack",
                edges("handles", "body", "body", "body"), List.of("body", "handles"), List.of("front_logo", "straps", "inner_label"),
                List.of(sv(BACK_VIEW, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.55),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.7),
                        sv(INNER_LABEL, Condition.ALWAYS, 1.25, Reveal.NEW_REGION, BRAND, 0.7, MATERIAL, 0.6),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.7)),
                specs(FRONT_VIEW, "BACKPACK_FRONT_V1", BACK_VIEW, "BACKPACK_FRONT_V1"), 0, false, 50, 80));
        add(acc("WALLET", List.of("wallet"), FRONT_VIEW, List.of(), "GENERIC", "wallet",
                edges("body", "body", "body", "body"), List.of("body"), List.of("front_logo", "inner_view"),
                List.of(sv(INNER_VIEW, Condition.ALWAYS, 1.1, Reveal.NEW_REGION, BRAND, 0.7),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.7),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.7)),
                specs(FRONT_VIEW, "WALLET_FRONT_V1", INNER_VIEW, "WALLET_FRONT_V1"), 0, false, 25, 40));
        add(acc("BELT", List.of("belt"), FRONT_VIEW, List.of(), "GENERIC", "belt",
                edges("whole", "whole", "strap", "strap"), List.of("buckle"), List.of("buckle", "strap_back"),
                List.of(sv(BUCKLE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.75),
                        sv(INNER_LABEL, Condition.ALWAYS, 1.15, Reveal.NEW_REGION, BRAND, 0.7, MATERIAL, 0.7),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.6)),
                specs(FRONT_VIEW, "BELT_FRONT_V1"), 0, false, 40, 70));
        add(acc("WATCH", List.of("watch"), WATCH_FACE, List.of(), "WATCH", "watch",
                edges("strap", "strap", "dial", "dial"), List.of("dial"), List.of("dial", "caseback", "clasp"),
                List.of(sv(WATCH_BACK, Condition.ALWAYS, 1.15, Reveal.NEW_REGION, BRAND, 0.7, MODEL, 0.9, PRODUCT_LINE, 0.7, MATERIAL, 0.4),
                        sv(CLASP_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.6, MODEL, 0.3)),
                specs(WATCH_FACE, "WATCH_FACE_V1", WATCH_BACK, "WATCH_BACK_V1"), 0.6, false, 20, 35));
        add(acc("GLASSES", List.of("sunglasses", "eyeglasses"), FRONT_VIEW, List.of(), "GLASSES", "glasses",
                edges("frame", "frame", "frame", "frame"), List.of("frame"), List.of("lens", "temple_inside", "bridge"),
                List.of(sv(TEMPLE_DETAIL, Condition.ALWAYS, 1.1, Reveal.NEW_REGION, BRAND, 0.75, MODEL, 0.85, PRODUCT_LINE, 0.6),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.6)),
                specs(FRONT_VIEW, "GLASSES_FRONT_V1"), 0.3, false, 25, 40));
        add(acc("CAP", List.of("cap"), FRONT_VIEW, List.of(THREE_QUARTER), "GENERIC", "cap",
                edges("crown", "brim", "crown", "crown"), List.of("crown", "brim"), List.of("front_panel", "back_strap", "inner_label"),
                List.of(sv(BACK_VIEW, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.55),
                        sv(INNER_LABEL, Condition.ALWAYS, 1.2, Reveal.NEW_REGION, BRAND, 0.7, MATERIAL, 0.6),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.6)),
                specs(FRONT_VIEW, "CAP_FRONT_V1", THREE_QUARTER, "CAP_FRONT_V1", BACK_VIEW, "CAP_FRONT_V1"), 0, false, 30, 50));
        add(acc("HAT", List.of("hat", "beanie"), FRONT_VIEW, List.of(), "GENERIC", "hat",
                edges("crown", "brim", "brim", "brim"), List.of("crown", "brim"), List.of("front", "inner_label"),
                List.of(sv(INNER_LABEL, Condition.ALWAYS, 1.2, Reveal.NEW_REGION, BRAND, 0.7, MATERIAL, 0.7),
                        sv(BACK_VIEW, Condition.ALWAYS, 1.0, Reveal.NEW_REGION, BRAND, 0.4),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.6),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.6)),
                specs(FRONT_VIEW, "HAT_FRONT_V1", BACK_VIEW, "HAT_FRONT_V1"), 0, false, 30, 50));
        add(acc("SCARF", List.of("scarf"), FRONT_VIEW, List.of(), "GENERIC", "scarf",
                edges("whole", "whole", "whole", "whole"), List.of("whole"), List.of("label", "corner", "edge"),
                List.of(sv(LABEL_DETAIL, Condition.ALWAYS, 1.1, Reveal.NEW_REGION, BRAND, 0.75, MATERIAL, 0.85),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.7, PATTERN, 0.7),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.6)),
                specs(FRONT_VIEW, "SCARF_FLAT_V1"), 0, false, 60, 100));
        add(acc("NECKWEAR", List.of("tie", "bow_tie"), FRONT_VIEW, List.of(), "GENERIC", "tie",
                edges("whole", "whole", "whole", "whole"), List.of("whole"), List.of("label", "back"),
                List.of(sv(LABEL_DETAIL, Condition.ALWAYS, 1.1, Reveal.NEW_REGION, BRAND, 0.75, MATERIAL, 0.85),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.7, PATTERN, 0.7)),
                specs(FRONT_VIEW, "NECKWEAR_FLAT_V1"), 0, false, 30, 60));
        add(acc("JEWELRY", List.of("necklace", "bracelet", "earrings", "ring"), FRONT_VIEW, List.of(), "GENERIC", "jewelry",
                edges("whole", "whole", "whole", "whole"), List.of("whole"), List.of("engraving", "clasp", "hallmark"),
                List.of(sv(ENGRAVING_DETAIL, Condition.ALWAYS, 1.2, Reveal.NEW_REGION, BRAND, 0.65, MATERIAL, 0.6),
                        sv(CLASP_DETAIL, Condition.ALWAYS, 1.1, Reveal.NEW_REGION, BRAND, 0.5, MATERIAL, 0.3)),
                specs(FRONT_VIEW, "JEWELRY_MACRO_V1"), 0, true, 10, 25));
        add(acc("SMALL_ACCESSORY", List.of("gloves", "socks", "hair_accessory"), FRONT_VIEW, List.of(), "GENERIC", "generic",
                edges("whole", "whole", "whole", "whole"), List.of("whole"), List.of("label"),
                List.of(sv(LABEL_DETAIL, Condition.ALWAYS, 1.1, Reveal.NEW_REGION, BRAND, 0.7, MATERIAL, 0.8),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.5),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.6)),
                specs(FRONT_VIEW, PhotographySpecs.GENERIC_FRONT), 0, false, 30, 50));
        add(acc(GENERIC, List.of(), FRONT_VIEW, List.of(), "GENERIC", "generic",
                edges("whole", "whole", "whole", "whole"), List.of("whole"), List.of("label", "logo"),
                List.of(sv(LABEL_DETAIL, Condition.ALWAYS, 1.1, Reveal.NEW_REGION, BRAND, 0.6, MATERIAL, 0.7),
                        sv(LOGO_DETAIL, Condition.ALWAYS, 1.0, Reveal.ZOOM_VISIBLE_LOGO, BRAND, 0.5),
                        sv(TEXTURE_DETAIL, Condition.ALWAYS, 1.0, Reveal.NEUTRAL, MATERIAL, 0.6, PATTERN, 0.5)),
                specs(FRONT_VIEW, PhotographySpecs.GENERIC_FRONT), 0, false, 40, 70));
    }

    private CaptureProfiles() {
    }

    private static CaptureProfile upper(String id, List<String> subs, String spec, String overlay, List<SecondaryView> views) {
        return new CaptureProfile(id, "UPPER", subs, FRONT_VIEW, List.of(), "UPPER", UPPER_EDGES,
                List.of("neckline", "shoulders", "hem"), List.of("chest", "neck_label", "inner_label", "sleeve"), views,
                specs(FRONT_VIEW, spec, BACK_VIEW, "UPPER_BACK_V1"), 0, false,
                new Guidance(overlay, "PORTRAIT", 60, 90, "plain_contrast", "diffuse"));
    }

    private static CaptureProfile shoe(String id, List<String> subs, CaptureView primary, List<CaptureView> alternatives,
                                       String overlay, Map<String, String> edges, List<SecondaryView> views,
                                       Map<CaptureView, String> specs) {
        return new CaptureProfile(id, "FOOTWEAR", subs, primary, alternatives, "FOOTWEAR", edges, List.of("toe_or_heel", "sole"),
                List.of("side_panel", "heel", "insole", "outsole"), views, specs, 0, false,
                new Guidance(overlay, "LANDSCAPE", 30, 50, "plain_contrast", "diffuse"));
    }

    private static CaptureProfile acc(String id, List<String> subs, CaptureView primary, List<CaptureView> alternatives,
                                      String landmarks, String overlay, Map<String, String> edges, List<String> required,
                                      List<String> brandRegions, List<SecondaryView> views, Map<CaptureView, String> specs,
                                      double modelImportance, boolean appearanceLimited, int minCm, int maxCm) {
        return new CaptureProfile(id, "ACCESSORY", subs, primary, alternatives, landmarks, edges, required, brandRegions,
                views, specs, modelImportance, appearanceLimited,
                new Guidance(overlay, "PORTRAIT", minCm, maxCm, "plain_contrast", "diffuse"));
    }

    private static Map<String, String> edges(String top, String bottom, String left, String right) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("top", top);
        m.put("bottom", bottom);
        m.put("left", left);
        m.put("right", right);
        return m;
    }

    private static Map<CaptureView, String> specs(Object... kv) {
        Map<CaptureView, String> m = new EnumMap<>(CaptureView.class);
        for (int i = 0; i < kv.length; i += 2) {
            m.put((CaptureView) kv[i], (String) kv[i + 1]);
        }
        return m;
    }

    private static SecondaryView sv(CaptureView view, Condition condition, double effort, Reveal reveal, Object... kv) {
        Map<VisionSignal, Double> informs = new EnumMap<>(VisionSignal.class);
        for (int i = 0; i < kv.length; i += 2) {
            informs.put((VisionSignal) kv[i], (Double) kv[i + 1]);
        }
        return new SecondaryView(view, informs, condition, effort, reveal);
    }

    private static void add(CaptureProfile p) {
        BY_ID.put(p.id(), p);
        for (String s : p.subcategories()) {
            BY_SUBCATEGORY.put(s, p);
        }
    }

    /** Perfil da subcategoria; sem ela, o perfil padrão da categoria; sem nada, o genérico. */
    public static CaptureProfile resolve(String category, String subcategory) {
        if (subcategory != null && BY_SUBCATEGORY.containsKey(subcategory)) {
            return BY_SUBCATEGORY.get(subcategory);
        }
        return BY_ID.get(category == null ? GENERIC : BY_CATEGORY.getOrDefault(category, GENERIC));
    }

    public static CaptureProfile get(String id) {
        CaptureProfile p = BY_ID.get(id);
        return p != null ? p : BY_ID.get(GENERIC);
    }

    public static Collection<CaptureProfile> all() {
        return BY_ID.values();
    }

    public static boolean covers(String subcategory) {
        return BY_SUBCATEGORY.containsKey(subcategory);
    }

    /** Spec do asset canônico para a vista; vista sem spec própria cai na genérica (ou no pé único, em calçados). */
    public static String specFor(CaptureProfile p, CaptureView view) {
        String id = p.specs().get(view);
        if (id != null) {
            return id;
        }
        if (!view.wholeProduct()) {
            return view == TEXTURE_DETAIL ? PhotographySpecs.TEXTURE_DETAIL
                    : view == LOGO_DETAIL ? PhotographySpecs.LOGO_DETAIL : PhotographySpecs.LABEL_DETAIL;
        }
        return "FOOTWEAR".equals(p.family()) ? PhotographySpecs.SHOE_SINGLE : PhotographySpecs.GENERIC_FRONT;
    }

    public static List<Map<String, Object>> describe() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (CaptureProfile p : BY_ID.values()) {
            out.add(p.toMap());
        }
        return out;
    }
}
