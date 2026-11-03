package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.RoomLayout;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;

import static br.com.fashionai.application.service.RoomService.BASE_CAPACITY;
import static br.com.fashionai.application.service.RoomService.DRAWER_CAPACITY;
import static br.com.fashionai.application.service.RoomService.HANGERS_PER_DOOR;
import static br.com.fashionai.application.service.RoomService.SHOE_RACK_CAPACITY;
import static br.com.fashionai.application.service.RoomService.TOP_CAPACITY;

/**
 * Meu Quarto — módulos do móvel no JSON do {@link RoomLayout}: módulos de fábrica por nível (RF35 §5.3), leitura de
 * módulos e capacidades, rótulos das gavetas e suas origens, chaves do quarto e total de posições. Regras puras.
 */
final class RoomModules {
    private RoomModules() {
    }

    static Map<String, Object> module(String id, String slotType, String mold, int widthCm, int capacity, String label,
                                      String sku, Map<String, Object> finish) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("slotType", slotType);
        m.put("mold", mold);
        m.put("widthCm", widthCm);
        m.put("capacity", capacity);
        m.put("label", label);
        m.put("sku", sku);
        m.put("finish", finish);
        return m;
    }

    /** RF35 §5.3 — módulos do móvel por nível. O FAI Origem (Estreia) é propositalmente simples. */
    static List<Map<String, Object>> defaultModules(FaiPointsService.Level level) {
        Map<String, Object> white = Map.of("color", "#F4F2EF", "texture", "fosco", "roughness", 0.8);
        List<Map<String, Object>> mods = new ArrayList<>();
        for (int d = 1; d <= 4; d++) {
            mods.add(module("door:" + d, "DOOR", "PRT-AB60", 60, HANGERS_PER_DOOR, Msg.t("room.modulo.porta", d), "FAI-PRT-AB60-WHT-FOS", white));
        }
        for (int n = 1; n <= 24; n++) {
            mods.add(module("drawer:" + n, "DRAWER", "GAV-STD", 0, DRAWER_CAPACITY, Msg.t("room.modulo.gaveta", n), null, white));
        }
        mods.add(module("top", "TOP", null, 0, TOP_CAPACITY, Msg.t("wardrobeCreator.maleiro"), null, null));
        mods.add(module("base", "BASE", null, 0, BASE_CAPACITY, Msg.t("room.modulo.base"), null, null));
        mods.add(module("handles", "HANDLE", "PUX-CAV", 0, 0, Msg.t("room.modulo.puxadores"), null, Map.of("color", "#F4F2EF", "texture", "cava")));
        mods.add(module("light", "LIGHT", "LUZ-LED", 0, 0, Msg.t("room.iluminacao"), null, Map.of("kelvin", 4000, "guided", false)));
        mods.add(module("rug", "RUG", "TAP-RND", 0, 0, Msg.t("room.modulo.tapete"), null, null));
        mods.add(module("bed", "BED", "BED-DBL", 280, 0, Msg.t("room.double_bed"), null, Map.of()));
        mods.add(module("saleRack", "SALE_RACK", "RACK-MOB", 160, 0, Msg.t("room.support_rack"), null, Map.of()));
        mods.add(module("hangers", "HANGER", "CAB-STD", 0, 0, Msg.t("wardrobeCreator.cabides"), null, Map.of("color", "#6B5A4A", "texture", "madeira")));
        mods.add(module("logo", "LOGO", "LOG-PLC", 0, 0, Msg.t("room.logo_das_portas"), null, null));
        // Smart Mirror (RF28) — módulo trocável na loja do quarto (retangular, arco, oval, camarim com luzes)
        mods.add(module("mirror", "MIRROR", "ESP-RET", 0, 0, Msg.t("room.espelho"), null,
                Map.of("color", "#6B4A2F", "texture", "madeira", "material", "MADEIRA", "roughness", 0.6, "metalness", 0.0)));
        if (level.atLeast(FaiPointsService.Level.LOFT)) {
            for (int d = 5; d <= 6; d++) {
                mods.add(module("door:" + d, "DOOR", "PRT-AB90", 90, HANGERS_PER_DOOR, Msg.t("room.modulo.porta", d), null, white));
            }
            for (int n = 25; n <= 36; n++) {
                mods.add(module("drawer:" + n, "DRAWER", "GAV-STD", 0, DRAWER_CAPACITY, Msg.t("room.modulo.gaveta", n), null, white));
            }
        }
        if (level.atLeast(FaiPointsService.Level.STUDIO)) {
            mods.add(module("shoe", "SHOE_RACK", "SAP-MOD90", 90, SHOE_RACK_CAPACITY, Msg.t("wardrobeCreator.sapateira"), null, white));
            mods.add(module("bags", "BAG_DISPLAY", "VIT-BOL", 60, 8, Msg.t("common.vitrine_de_bolsas"), null, null));
            mods.add(module("jewelry", "JEWELRY", "JOI-POR", 30, 12, Msg.t("room.modulo.porta_joias"), null, null));
        }
        if (level.atLeast(FaiPointsService.Level.LOFT)) {
            mods.add(module("island", "ISLAND", "ILH-BAN", 120, 3, Msg.t("room.ilha_central_bancada_de_looks"), null, null));
        }
        if (level.atLeast(FaiPointsService.Level.LOFT)) {
            mods.add(module("season", "SEASON_STORAGE", null, 0, 60, Msg.t("common.maleiro_de_estacao"), null, null));
        }
        if (level.atLeast(FaiPointsService.Level.LOFT)) {
            mods.add(module("signature", "SIGNATURE", null, 0, 0, Msg.t("room.closet_de_assinatura"), null, null));
        }
        return mods;
    }

    static List<Map<String, Object>> modules(RoomLayout layout) {
        return Json.list(layout.getModulesJson());
    }

    static Optional<Map<String, Object>> module(RoomLayout layout, String id) {
        return modules(layout).stream().filter(m -> id.equals(String.valueOf(m.get("id")))).findFirst();
    }

    static int capacity(Map<String, Object> module) {
        return module.get("capacity") instanceof Number n ? n.intValue() : 0;
    }

    @SuppressWarnings("unchecked")
    static Map<String, String> labels(RoomLayout layout) {
        Map<String, Object> root = Json.map(layout.getDrawerLabelsJson());
        Object v = root.get("labels");
        Map<String, String> out = new TreeMap<>((a, b) -> Integer.compare(Integer.parseInt(a), Integer.parseInt(b)));
        if (v instanceof Map<?, ?> m) {
            m.forEach((k, val) -> {
                if (val != null && !String.valueOf(val).isBlank()) {
                    out.put(String.valueOf(k), String.valueOf(val));
                }
            });
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    static Map<String, String> labelSources(RoomLayout layout) {
        Object v = Json.map(layout.getDrawerLabelsJson()).get("sources");
        Map<String, String> out = new HashMap<>();
        if (v instanceof Map<?, ?> m) {
            m.forEach((k, val) -> out.put(String.valueOf(k), String.valueOf(val)));
        }
        return out;
    }

    static void saveLabels(RoomLayout layout, Map<String, String> labels, Map<String, String> sources) {
        layout.setDrawerLabelsJson(Json.write(Map.of("labels", labels, "sources", sources)));
    }

    @SuppressWarnings("unchecked")
    static List<String> keys(RoomLayout layout) {
        return module(layout, "keys").map(m -> m.get("users") instanceof List<?> l ? l.stream().map(String::valueOf).toList() : List.<String>of())
                .orElse(List.of());
    }

    static int positions(RoomLayout layout) {
        return modules(layout).stream().filter(m -> Set.of("DOOR", "DRAWER", "BASE", "SHOE_RACK", "BAG_DISPLAY", "JEWELRY")
                .contains(String.valueOf(m.get("slotType")))).mapToInt(RoomModules::capacity).sum();
    }
}
