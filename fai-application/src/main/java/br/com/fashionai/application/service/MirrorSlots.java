package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.SchemeSlot;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF33 — regras puras dos slots do espelho: em que slot a peça entra, leitura do {@code slots_json}, lista do
 * espelho (rack), disponibilidade e completude determinística do look (sem IA).
 */
final class MirrorSlots {
    static String slotOf(WardrobeItem w) {
        String cat = w.getCategory() == null ? "" : w.getCategory();
        return switch (cat) {
            case "upper_piece" -> w.getSubcategory() != null && RoomService.OUTERWEAR.contains(w.getSubcategory()) ? "outer_layer" : "upper";
            case "lower_piece" -> "lower";
            case "full_body_piece" -> "dress";
            case "shoes_piece" -> "shoes";
            default -> "accessory";
        };
    }

    static SchemeSlot schemeSlot(String slot) {
        return switch (slot) {
            case "upper" -> SchemeSlot.TOP;
            case "lower" -> SchemeSlot.BOTTOM;
            case "dress" -> SchemeSlot.FULL_BODY;
            case "shoes" -> SchemeSlot.SHOES;
            case "outer_layer" -> SchemeSlot.OUTERWEAR;
            default -> SchemeSlot.ACCESSORY;
        };
    }

    static List<UUID> accessories(Map<String, Object> slots) {
        List<UUID> out = new ArrayList<>();
        if (slots.get("accessory") instanceof List<?> l) {
            for (Object o : l) {
                try {
                    out.add(UUID.fromString(String.valueOf(o)));
                } catch (IllegalArgumentException ignored) {
                    // id inválido é ignorado
                }
            }
        }
        return out;
    }

    static UUID single(Map<String, Object> slots, String slot) {
        Object v = slots.get(slot);
        if (v == null) {
            return null;
        }
        try {
            return UUID.fromString(String.valueOf(v));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    /** Teto da lista do espelho (peças trazidas para provar). */
    static final int MAX_RACK = 24;

    /**
     * Lista do espelho (QUARTO-ESPELHO): as peças trazidas do quarto para provar, na ordem em que chegaram. É separada do
     * que está vestido (slots): vestir tira da lista para o corpo e a peça continua na lista; tirar da lista nunca apaga
     * a peça do guarda-roupa.
     */
    static List<UUID> rack(Map<String, Object> slots) {
        List<UUID> out = new ArrayList<>();
        if (slots.get("rack") instanceof List<?> l) {
            for (Object o : l) {
                try {
                    UUID id = UUID.fromString(String.valueOf(o));
                    if (!out.contains(id)) {
                        out.add(id);
                    }
                } catch (IllegalArgumentException ignored) {
                    // id inválido é ignorado
                }
            }
        }
        return out;
    }

    static void putRack(Map<String, Object> slots, List<UUID> rack) {
        slots.put("rack", rack.stream().map(UUID::toString).toList());
    }

    /** Põe a peça na lista do espelho (sem duplicar; a mais antiga sai quando passa do teto). @return se entrou agora */
    static boolean addToRack(Map<String, Object> slots, UUID pieceId) {
        List<UUID> rack = rack(slots);
        if (rack.contains(pieceId)) {
            return false;
        }
        rack.add(pieceId);
        while (rack.size() > MAX_RACK) {
            rack.remove(0);
        }
        putRack(slots, rack);
        return true;
    }

    static List<UUID> allIds(Map<String, Object> slots) {
        List<UUID> ids = new ArrayList<>();
        for (String slot : List.of("outer_layer", "upper", "dress", "lower", "shoes")) {
            UUID id = single(slots, slot);
            if (id != null) {
                ids.add(id);
            }
        }
        ids.addAll(accessories(slots));
        return ids;
    }

    static boolean available(WardrobeItem w) {
        return w.isDisponivel() && w.getAvailabilityStatus() == AvailabilityStatus.AVAILABLE;
    }

    static boolean complete(Map<String, Object> slots) {
        boolean top = single(slots, "upper") != null && single(slots, "lower") != null;
        return (top || single(slots, "dress") != null) && single(slots, "shoes") != null;
    }

    /** Regra de completude determinística (sem IA): avisos de categoria faltando (CA03). */
    static List<Map<String, Object>> missing(Map<String, Object> slots) {
        List<Map<String, Object>> out = new ArrayList<>();
        boolean dress = single(slots, "dress") != null;
        if (!dress && single(slots, "upper") == null) {
            out.add(Map.of("slot", "upper", "message", Msg.t("mirror.esse_look_ainda_nao_possui"), "action", Msg.t("mirror.sugerir_peca_superior")));
        }
        if (!dress && single(slots, "lower") == null) {
            out.add(Map.of("slot", "lower", "message", Msg.t("mirror.esse_look_ainda_nao_possui_2"), "action", Msg.t("mirror.sugerir_peca_inferior")));
        }
        if (single(slots, "shoes") == null) {
            out.add(Map.of("slot", "shoes", "message", Msg.t("mirror.esse_look_ainda_nao_possui_3"), "action", Msg.t("mirror.sugerir_calcado")));
        }
        return out;
    }

    static String key(List<UUID> ids) {
        return SchemeService.combinationKey(ids);
    }
}
