package br.com.fashionai.application.vision.spec;

import br.com.fashionai.application.vision.spec.PhotographySpec.Alignment;
import br.com.fashionai.application.vision.spec.PhotographySpec.BackgroundMode;
import br.com.fashionai.application.vision.spec.PhotographySpec.Composition;
import br.com.fashionai.application.vision.spec.PhotographySpec.DetailRegion;
import br.com.fashionai.domain.model.enums.CaptureView;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * RF4 · Catálogo das especificações fotográficas v1. Mudar uma regra de enquadramento = nova versão ({@code _V2}),
 * nunca editar a v1: os assets já gerados guardam o id da spec que os produziu.
 */
public final class PhotographySpecs {
    public static final String GENERIC_FRONT = "GENERIC_FRONT_V1";
    public static final String SHOE_SINGLE = "SHOE_SINGLE_CANONICAL_V1";
    public static final String SHOE_PAIR = "SHOE_PAIR_CANONICAL_V1";
    public static final String LOGO_DETAIL = "LOGO_DETAIL_V1";
    public static final String TEXTURE_DETAIL = "TEXTURE_DETAIL_V1";
    public static final String LABEL_DETAIL = "LABEL_DETAIL_V1";
    public static final String PANTS_DETAIL = "PANTS_DETAIL_V1";

    private static final Map<String, PhotographySpec> SPECS = new LinkedHashMap<>();

    private static final List<String> PANTS_MANDATORY = List.of("waistband_center", "crotch", "left_hem", "right_hem");
    private static final List<String> UPPER_MANDATORY = List.of("neckline_center", "left_shoulder", "right_shoulder", "hem_center");
    private static final List<String> UPPER_REGIONS = List.of("neckline", "shoulders", "sleeves", "hem");
    private static final List<String> SHOE_MANDATORY = List.of("toe", "heel");
    private static final List<String> SHOE_REGIONS = List.of("toe", "heel", "sole");

    static {
        // parte de baixo
        product("PANTS_FRONT_V1", CaptureView.FRONT_VIEW, "4:5", 1600, 2000, 0.9,
                List.of("waistband_center", "left_hem", "right_hem"), PANTS_MANDATORY, List.of("waistband", "legs", "hems"), 8, Alignment.CENTER, Composition.ANY);
        product("PANTS_BACK_V1", CaptureView.BACK_VIEW, "4:5", 1600, 2000, 0.9,
                List.of("waistband_center", "left_hem", "right_hem"), PANTS_MANDATORY, List.of("waistband", "back_pockets", "legs", "hems"), 8, Alignment.CENTER, Composition.ANY);
        detail(PANTS_DETAIL, CaptureView.BRAND_DETAIL, "4:3", 1600, 1200, DetailRegion.TOP_BAND);
        product("SHORTS_FRONT_V1", CaptureView.FRONT_VIEW, "1:1", 1600, 1600, 0.88,
                List.of("waistband_center"), List.of("waistband_center", "left_hem", "right_hem"), List.of("waistband", "hems"), 8, Alignment.CENTER, Composition.ANY);
        product("SKIRT_FRONT_V1", CaptureView.FRONT_VIEW, "4:5", 1600, 2000, 0.88,
                List.of("waistband_center"), List.of("waistband_center", "hem_center"), List.of("waistband", "hem"), 8, Alignment.CENTER, Composition.ANY);
        // parte de cima e corpo inteiro
        product("TSHIRT_FRONT_V1", CaptureView.FRONT_VIEW, "1:1", 1600, 1600, 0.88,
                List.of("left_shoulder", "right_shoulder"), UPPER_MANDATORY, UPPER_REGIONS, 8, Alignment.CENTER, Composition.ANY);
        product("SHIRT_FRONT_V1", CaptureView.FRONT_VIEW, "4:5", 1600, 2000, 0.88,
                List.of("left_shoulder", "right_shoulder"), UPPER_MANDATORY, List.of("neckline", "shoulders", "sleeves", "hem", "buttons"), 8, Alignment.CENTER, Composition.ANY);
        product("POLO_FRONT_V1", CaptureView.FRONT_VIEW, "1:1", 1600, 1600, 0.88,
                List.of("left_shoulder", "right_shoulder"), UPPER_MANDATORY, List.of("neckline", "shoulders", "sleeves", "hem", "chest"), 8, Alignment.CENTER, Composition.ANY);
        product("KNITWEAR_FRONT_V1", CaptureView.FRONT_VIEW, "1:1", 1600, 1600, 0.88,
                List.of("left_shoulder", "right_shoulder"), UPPER_MANDATORY, UPPER_REGIONS, 8, Alignment.CENTER, Composition.ANY);
        product("OUTERWEAR_FRONT_V1", CaptureView.FRONT_VIEW, "4:5", 1600, 2000, 0.88,
                List.of("left_shoulder", "right_shoulder"), UPPER_MANDATORY, List.of("neckline", "shoulders", "sleeves", "hem", "closure"), 8, Alignment.CENTER, Composition.ANY);
        product("UPPER_BACK_V1", CaptureView.BACK_VIEW, "1:1", 1600, 1600, 0.88,
                List.of("left_shoulder", "right_shoulder"), List.of("hem_center"), List.of("shoulders", "hem"), 8, Alignment.CENTER, Composition.ANY);
        product("DRESS_FRONT_V1", CaptureView.FRONT_VIEW, "2:3", 1600, 2400, 0.9,
                List.of("left_shoulder", "right_shoulder"), List.of("neckline_center", "hem_center"), List.of("neckline", "shoulders", "hem"), 8, Alignment.CENTER, Composition.ANY);
        // calçados: um pé, sem espelhar, alinhado pela sola; o par só lado a lado
        product("SNEAKER_SIDE_V1", CaptureView.LEFT_SIDE, "4:3", 1600, 1200, 0.86,
                List.of("sole_front", "sole_back"), SHOE_MANDATORY, SHOE_REGIONS, 6, Alignment.BASELINE, Composition.SINGLE);
        product("SNEAKER_THREE_QUARTER_V1", CaptureView.THREE_QUARTER, "4:3", 1600, 1200, 0.86,
                List.of("sole_front", "sole_back"), SHOE_MANDATORY, SHOE_REGIONS, 6, Alignment.BASELINE, Composition.SINGLE);
        product("SNEAKER_SOLE_V1", CaptureView.SOLE_VIEW, "2:3", 1200, 1800, 0.9,
                List.of(), SHOE_MANDATORY, List.of("sole"), 10, Alignment.CENTER, Composition.SINGLE);
        product(SHOE_SINGLE, CaptureView.THREE_QUARTER, "4:3", 1600, 1200, 0.86,
                List.of("sole_front", "sole_back"), SHOE_MANDATORY, SHOE_REGIONS, 6, Alignment.BASELINE, Composition.SINGLE);
        product(SHOE_PAIR, CaptureView.THREE_QUARTER, "16:9", 1920, 1080, 0.86,
                List.of(), List.of(), SHOE_REGIONS, 6, Alignment.BASELINE, Composition.PAIR);
        product("BOOT_SIDE_V1", CaptureView.LEFT_SIDE, "1:1", 1600, 1600, 0.88,
                List.of("sole_front", "sole_back"), List.of("toe", "heel", "collar_top"), List.of("toe", "heel", "sole", "shaft"), 6, Alignment.BASELINE, Composition.SINGLE);
        product("SANDAL_TOP_V1", CaptureView.TOP_VIEW, "3:4", 1200, 1600, 0.88,
                List.of(), List.of(), List.of("straps", "sole"), 10, Alignment.CENTER, Composition.SINGLE);
        product("HEEL_SIDE_V1", CaptureView.LEFT_SIDE, "4:3", 1600, 1200, 0.86,
                List.of("sole_front", "sole_back"), SHOE_MANDATORY, SHOE_REGIONS, 6, Alignment.BASELINE, Composition.SINGLE);
        // acessórios
        product("BAG_FRONT_V1", CaptureView.FRONT_VIEW, "1:1", 1600, 1600, 0.86,
                List.of(), List.of("handle_top"), List.of("body", "handles"), 8, Alignment.CENTER, Composition.ANY);
        product("BACKPACK_FRONT_V1", CaptureView.FRONT_VIEW, "4:5", 1600, 2000, 0.86,
                List.of(), List.of("handle_top"), List.of("body", "handles"), 8, Alignment.CENTER, Composition.ANY);
        product("WALLET_FRONT_V1", CaptureView.FRONT_VIEW, "4:3", 1600, 1200, 0.86,
                List.of(), List.of(), List.of("body"), 8, Alignment.CENTER, Composition.ANY);
        product("BELT_FRONT_V1", CaptureView.FRONT_VIEW, "3:2", 1800, 1200, 0.9,
                List.of(), List.of(), List.of("buckle"), 10, Alignment.CENTER, Composition.ANY);
        product("WATCH_FACE_V1", CaptureView.WATCH_FACE, "4:5", 1600, 2000, 0.92,
                List.of("dial_center"), List.of("dial_center"), List.of("dial"), 10, Alignment.CENTER, Composition.ANY);
        product("WATCH_BACK_V1", CaptureView.WATCH_BACK, "1:1", 1600, 1600, 0.9,
                List.of(), List.of(), List.of("caseback"), 15, Alignment.CENTER, Composition.ANY);
        product("GLASSES_FRONT_V1", CaptureView.FRONT_VIEW, "16:9", 1920, 1080, 0.9,
                List.of("left_lens_center", "right_lens_center"), List.of("left_lens_center", "right_lens_center"), List.of("frame"), 6, Alignment.CENTER, Composition.ANY);
        product("CAP_FRONT_V1", CaptureView.FRONT_VIEW, "1:1", 1600, 1600, 0.86,
                List.of(), List.of(), List.of("crown", "brim"), 8, Alignment.CENTER, Composition.ANY);
        product("HAT_FRONT_V1", CaptureView.FRONT_VIEW, "1:1", 1600, 1600, 0.86,
                List.of(), List.of(), List.of("crown", "brim"), 8, Alignment.CENTER, Composition.ANY);
        product("SCARF_FLAT_V1", CaptureView.FRONT_VIEW, "1:1", 1600, 1600, 0.9,
                List.of(), List.of(), List.of("whole"), 10, Alignment.CENTER, Composition.ANY);
        product("NECKWEAR_FLAT_V1", CaptureView.FRONT_VIEW, "2:3", 1200, 1800, 0.9,
                List.of(), List.of(), List.of("whole"), 10, Alignment.CENTER, Composition.ANY);
        product("JEWELRY_MACRO_V1", CaptureView.FRONT_VIEW, "1:1", 1600, 1600, 0.8,
                List.of(), List.of(), List.of("whole"), 15, Alignment.CENTER, Composition.ANY);
        product(GENERIC_FRONT, CaptureView.FRONT_VIEW, "1:1", 1600, 1600, 0.86,
                List.of(), List.of(), List.of("whole"), 8, Alignment.CENTER, Composition.ANY);
        // detalhes derivados (recortes da própria foto, sem geração)
        detail(LOGO_DETAIL, CaptureView.LOGO_DETAIL, "1:1", 1200, 1200, DetailRegion.LOGO);
        detail(TEXTURE_DETAIL, CaptureView.TEXTURE_DETAIL, "1:1", 1024, 1024, DetailRegion.TEXTURE);
        detail(LABEL_DETAIL, CaptureView.LABEL_DETAIL, "3:4", 1200, 1600, DetailRegion.WHOLE);
    }

    private PhotographySpecs() {
    }

    private static void product(String id, CaptureView view, String ratio, int w, int h, double coverage, List<String> anchors,
                                List<String> mandatory, List<String> regions, double rotation, Alignment alignment,
                                Composition composition) {
        SPECS.put(id, new PhotographySpec(id, 1, view, ratio, w, h, coverage, anchors, mandatory, regions, rotation, 6,
                0.04, BackgroundMode.TRANSPARENT, alignment, composition, 2.0, DetailRegion.NONE));
    }

    private static void detail(String id, CaptureView view, String ratio, int w, int h, DetailRegion region) {
        SPECS.put(id, new PhotographySpec(id, 1, view, ratio, w, h, 0.96, List.of(), List.of(), List.of(), 0, 0,
                0.02, BackgroundMode.WHITE, Alignment.CENTER, Composition.ANY, 2.0, region));
    }

    public static Optional<PhotographySpec> find(String id) {
        return Optional.ofNullable(id == null ? null : SPECS.get(id));
    }

    public static PhotographySpec get(String id) {
        return find(id).orElseThrow(() -> new IllegalArgumentException("Especificação fotográfica desconhecida: " + id));
    }

    public static Collection<PhotographySpec> all() {
        return SPECS.values();
    }
}
