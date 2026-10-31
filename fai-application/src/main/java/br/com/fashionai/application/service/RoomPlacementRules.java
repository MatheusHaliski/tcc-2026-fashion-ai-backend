package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.domain.model.WardrobeItem;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Regras puras de posicionamento do Meu Quarto (RF32.CA02 / RF34 §3.5): qual endereço é coerente com o tipo da
 * peça, quantas peças cabem numa gaveta, qual gaveta/porta a peça prefere e que rótulo sugerir para uma gaveta.
 * Sem repositório, Spring ou relógio — {@link RoomService} continua dono da ocupação, transação e persistência.
 */
final class RoomPlacementRules {
    static final Set<String> OUTERWEAR = Set.of("jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono");
    static final Set<String> KNITWEAR = Set.of("sweater", "sweatshirt", "hoodie", "vest");
    static final Set<String> DENIM = Set.of("jeans", "denim_shorts");
    static final Set<String> GYM = Set.of("sweatpants", "jogger_pants", "leggings", "training_shoes", "running_shoes");
    static final Set<String> BAGS = Set.of("handbag", "crossbody_bag", "tote_bag", "clutch", "backpack");
    static final Set<String> JEWELRY = Set.of("necklace", "bracelet", "earrings", "ring", "watch");
    static final Set<String> INTIMATES = Set.of("socks");
    static final Map<String, String> SUBCATEGORY_PT = Map.ofEntries(Map.entry("skirt", "Saias"), Map.entry("shorts", "Shorts"),
            Map.entry("bermuda_shorts", "Bermudas"), Map.entry("tailored_pants", "Alfaiataria"), Map.entry("chino_pants", "Chinos"),
            Map.entry("cargo_pants", "Cargo"), Map.entry("casual_pants", "Calças casuais"), Map.entry("culottes", "Pantacourts"),
            Map.entry("skort", "Short-saias"), Map.entry("belt", "Cintos"), Map.entry("scarf", "Lenços"), Map.entry("cap", Msg.k("room.bones")),
            Map.entry("hat", "Chapéus"), Map.entry("sunglasses", Msg.k("room.oculos")), Map.entry("t_shirt", "Camisetas"));
    /** Portas do cabideiro percorridas na busca por cabide livre (door:1 … door:6). */
    static final int DOORS = 6;

    private RoomPlacementRules() {
    }

    static String nz(String s) {
        return s == null ? "" : s;
    }

    private static boolean occHas(WardrobeItem w, String... codes) {
        List<String> occ = Json.csv(w.getOccasionTags());
        for (String c : codes) {
            if (occ.contains(c)) {
                return true;
            }
        }
        return false;
    }

    /** Categoria de gaveta preferida por tipo/tags (§1.1) — null = qualquer gaveta livre. */
    static String preferredDrawerLabel(WardrobeItem w) {
        String cat = nz(w.getCategory());
        String sub = nz(w.getSubcategory());
        if (cat.equals("accessory_piece")) {
            return INTIMATES.contains(sub) ? Msg.t("room.intimas") : Msg.t("room.acessorios");
        }
        if (DENIM.contains(sub)) {
            return "Jeans";
        }
        if (GYM.contains(sub) || occHas(w, "sport", "gym")) {
            return "Academia";
        }
        if (occHas(w, "beach")) {
            return "Praia";
        }
        return null;
    }

    /** Ordem das portas para cabide: a preferida pelo tipo (peça inteira 4, casaco 3, malha 2, demais 1) e depois 1…6. */
    static List<Integer> hangerDoorOrder(String category, String subcategory) {
        String sub = nz(subcategory);
        int pref = "full_body_piece".equals(category) ? 4 : OUTERWEAR.contains(sub) ? 3 : KNITWEAR.contains(sub) ? 2 : 1;
        List<Integer> order = new ArrayList<>(List.of(pref));
        for (int d = 1; d <= DOORS; d++) {
            if (d != pref) {
                order.add(d);
            }
        }
        return order;
    }

    /** RF32.CA02 / RF34 §3.5 — o endereço é coerente com o tipo e com a categoria da gaveta? */
    static boolean coherent(WardrobeItem w, RoomAddress a, Map<String, String> labels) {
        String cat = nz(w.getCategory());
        String sub = nz(w.getSubcategory());
        return switch (a.zone()) {
            case "door" -> cat.equals("upper_piece") || cat.equals("full_body_piece");
            case "drawer" -> {
                if (!(cat.equals("lower_piece") || cat.equals("accessory_piece") || cat.equals("shoes_piece"))) {
                    yield false;
                }
                String label = labels.get(String.valueOf(a.index()));
                if (label == null) {
                    yield true;
                }
                yield switch (label.toLowerCase(Locale.ROOT)) {
                    case "jeans" -> DENIM.contains(sub);
                    case "academia" -> GYM.contains(sub) || occHas(w, "sport", "gym");
                    case "praia" -> occHas(w, "beach");
                    case "acessórios", "acessorios" -> cat.equals("accessory_piece");
                    case "íntimas", "intimas" -> INTIMATES.contains(sub);
                    case "favoritas" -> w.isFavorite();
                    default -> true;
                };
            }
            case "base", "shoe" -> cat.equals("shoes_piece");
            case "bags" -> BAGS.contains(sub);
            case "jewelry" -> JEWELRY.contains(sub);
            default -> true; // cadeira, maleiro de estação: nunca penalizam
        };
    }

    static int drawerCapacity(String category) {
        return "shoes_piece".equals(category) ? 1 : "lower_piece".equals(category) ? 2 : 4;
    }

    static String titleCase(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    /** Sugestão local de rótulo para uma gaveta pelo conteúdo dominante (maioria simples; senão mantém o atual). */
    static String suggestLabel(List<WardrobeItem> content, String current) {
        if (content.isEmpty()) {
            return current;
        }
        Map<String, Long> votes = new HashMap<>();
        for (WardrobeItem w : content) {
            String pref = preferredDrawerLabel(w);
            if (pref == null) {
                pref = SUBCATEGORY_PT.getOrDefault(nz(w.getSubcategory()), titleCase(nz(w.getSubcategory()).replace('_', ' ')));
            }
            votes.merge(pref, 1L, Long::sum);
        }
        Map.Entry<String, Long> top = votes.entrySet().stream().max(Map.Entry.comparingByValue()).orElseThrow();
        return top.getValue() * 2 >= content.size() ? top.getKey() : current;
    }
}
