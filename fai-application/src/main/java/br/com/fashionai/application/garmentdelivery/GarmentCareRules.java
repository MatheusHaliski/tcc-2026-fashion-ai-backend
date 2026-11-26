package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.CareLabel;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.Composition;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.CompositionLine;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static java.util.Map.entry;

/**
 * Regra pura da etiqueta de cuidados (docs/garment-delivery §6.3): o perfil mais delicado entre as fibras com pelo menos
 * 10% (ou o tipo de tecido) define lavagem, alvejante, tambor, ferro, limpeza a seco, secagem natural, dicas e o código
 * de TipoLavagem gravado na peça. Elastano presente limita tambor e ferro a "baixa".
 */
final class GarmentCareRules {
    private GarmentCareRules() {
    }

    /** Perfis do mais resistente ao mais delicado (a posição é o peso). */
    static final List<String> PROFILES = List.of("STURDY", "SYNTHETIC", "DENIM", "UNSPECIFIED", "DELICATE", "FINE", "LEATHER");

    private static final Map<String, String> FIBER_PROFILE = Map.ofEntries(
            entry("COTTON", "STURDY"), entry("LINEN", "STURDY"), entry("POLYESTER", "SYNTHETIC"), entry("POLYAMIDE", "SYNTHETIC"),
            entry("ACRYLIC", "SYNTHETIC"), entry("VISCOSE", "DELICATE"), entry("SILK", "FINE"), entry("WOOL", "FINE"),
            entry("CASHMERE", "FINE"), entry("LEATHER", "LEATHER"), entry("FAUX_LEATHER", "LEATHER"));

    private static final Map<String, String> MATERIAL_PROFILE = Map.ofEntries(
            entry("DENIM", "DENIM"), entry("SATIN", "DELICATE"), entry("VELVET", "DELICATE"), entry("KNIT", "DELICATE"),
            entry("FLEECE", "SYNTHETIC"), entry("CANVAS", "STURDY"), entry("CORDUROY", "STURDY"), entry("LEATHER", "LEATHER"),
            entry("SUEDE", "LEATHER"), entry("FAUX_LEATHER", "LEATHER"));

    static CareLabel label(Composition composition, String materialCode) {
        String profile = profile(composition, materialCode);
        boolean elastane = composition.lines().stream().anyMatch(l -> "ELASTANE".equals(l.fiber()));
        String main = composition.lines().isEmpty() ? "" : composition.lines().getFirst().fiber();
        CareLabel base = switch (profile) {
            case "LEATHER" -> new CareLabel(profile, "DO_NOT_WASH", "DO_NOT_BLEACH", "DO_NOT_TUMBLE", "DO_NOT_IRON",
                    "FAUX_LEATHER".equals(materialCode) || "FAUX_LEATHER".equals(main) ? "DO_NOT_DRY_CLEAN" : "PROFESSIONAL_ONLY",
                    "LINE_DRY_SHADE", List.of("KEEP_FROM_HEAT", "STORE_HANGER", "STAIN_BLOT", "TEST_HIDDEN_AREA"), "NAO_LAVAR");
            case "FINE" -> new CareLabel(profile, "HAND_30", "DO_NOT_BLEACH", "DO_NOT_TUMBLE", "IRON_LOW", "DRY_CLEAN",
                    "SILK".equals(main) ? "LINE_DRY_SHADE" : "FLAT_DRY_SHADE",
                    List.of("AIR_BETWEEN_WEARS", "SILK".equals(main) ? "STORE_HANGER" : "STORE_FOLDED", "STEAM_CREASES",
                            "STAIN_ACT_FAST", "STAIN_COLD_WATER"), "LAVAR_A_MAO");
            case "DELICATE" -> new CareLabel(profile, "MACHINE_30_GENTLE", "DO_NOT_BLEACH", "DO_NOT_TUMBLE", "IRON_LOW", "DRY_CLEAN",
                    "KNIT".equals(materialCode) ? "FLAT_DRY" : "LINE_DRY_SHADE",
                    List.of("WASH_INSIDE_OUT", "KNIT".equals(materialCode) ? "STORE_FOLDED" : "STORE_HANGER", "STEAM_CREASES",
                            "STAIN_ACT_FAST", "STAIN_COLD_WATER"), "MAQUINA_30_DELICADO");
            case "DENIM" -> new CareLabel(profile, "MACHINE_40", "DO_NOT_BLEACH", "TUMBLE_LOW", "IRON_MEDIUM", "DRY_CLEAN", "LINE_DRY",
                    List.of("WASH_INSIDE_OUT", "WASH_SEPARATELY_FIRST", "WASH_AFTER_FEW_USES", "STORE_FOLDED", "STAIN_ACT_FAST"), "MAQUINA_40");
            case "SYNTHETIC" -> new CareLabel(profile, "MACHINE_40", "DO_NOT_BLEACH", "TUMBLE_LOW", "IRON_LOW", "DRY_CLEAN", "LINE_DRY",
                    List.of("STORE_HANGER", "KEEP_FROM_HEAT", "STAIN_GREASE", "STAIN_ACT_FAST"), "MAQUINA_40");
            case "STURDY" -> new CareLabel(profile, "MACHINE_40", "NON_CHLORINE", "LINEN".equals(main) ? "TUMBLE_LOW" : "TUMBLE_MEDIUM",
                    "IRON_HIGH", "DRY_CLEAN", "LINE_DRY",
                    List.of("WASH_SEPARATELY_FIRST", "STORE_HANGER", "STEAM_CREASES", "STAIN_GREASE", "STAIN_ACT_FAST"), "MAQUINA_40");
            default -> new CareLabel("UNSPECIFIED", "HAND_30", "DO_NOT_BLEACH", "DO_NOT_TUMBLE", "IRON_LOW", "DRY_CLEAN",
                    "LINE_DRY_SHADE", List.of("TEST_HIDDEN_AREA", "STAIN_ACT_FAST", "STAIN_COLD_WATER"), "LAVAR_A_MAO");
        };
        return elastane ? stretch(base) : base;
    }

    /** O perfil de maior peso entre o do tecido e o das fibras com pelo menos 10% (todas, se nenhuma chega a 10%). */
    static String profile(Composition composition, String materialCode) {
        int best = -1;
        List<CompositionLine> relevant = new ArrayList<>(composition.lines().stream().filter(l -> l.percent() >= 10).toList());
        if (relevant.isEmpty()) {
            relevant.addAll(composition.lines());
        }
        for (CompositionLine line : relevant) {
            best = Math.max(best, PROFILES.indexOf(FIBER_PROFILE.getOrDefault(line.fiber(), "")));
        }
        best = Math.max(best, PROFILES.indexOf(MATERIAL_PROFILE.getOrDefault(materialCode, "")));
        return best < 0 ? "UNSPECIFIED" : PROFILES.get(best);
    }

    private static CareLabel stretch(CareLabel care) {
        String tumble = "TUMBLE_MEDIUM".equals(care.tumble()) ? "TUMBLE_LOW" : care.tumble();
        String iron = care.iron().startsWith("IRON_") ? "IRON_LOW" : care.iron();
        return new CareLabel(care.profile(), care.wash(), care.bleach(), tumble, iron, care.dryClean(), care.naturalDry(),
                care.tips(), care.washCode());
    }
}
