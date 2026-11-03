package br.com.fashionai.application.service;

import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.RoomService.FORGOTTEN_DAYS;
import static br.com.fashionai.application.service.RoomService.ZONE;

/**
 * Meu Quarto — estados comunicados pelo ambiente (§1.2): período do dia, decoração sazonal, último uso, peça esquecida,
 * resumo da peça na cena e o conjunto de estados (indisponível, esquecida, favorita, ícone, à venda...). Regras puras.
 */
final class RoomPieceStates {
    private RoomPieceStates() {
    }

    static String period(LocalDateTime now) {
        int h = now.getHour();
        return h < 6 ? "night" : h < 11 ? "morning" : h < 17 ? "afternoon" : h < 20 ? "golden" : "night";
    }

    static String seasonalDecoration(LocalDate d) {
        return switch (d.getMonthValue()) {
            case 6 -> "festa_junina";
            case 12 -> "fim_de_ano";
            case 4 -> "fashion_revolution_week";
            default -> null;
        };
    }

    /** Última data de uso conhecida (diário + lastWornDate); null = nunca usada. */
    static LocalDate lastUse(WardrobeItem w, Map<UUID, LocalDate> lastDiary) {
        LocalDate d = lastDiary.get(w.getId());
        LocalDate worn = w.getLastWornDate();
        if (d == null) {
            return worn;
        }
        return worn == null || d.isAfter(worn) ? d : worn;
    }

    static boolean forgotten(WardrobeItem w, LocalDate last, LocalDate today) {
        LocalDate ref = last != null ? last : w.getCreatedAt() == null ? today : LocalDate.ofInstant(w.getCreatedAt(), ZONE);
        return w.isDisponivel() && w.getAvailabilityStatus() == AvailabilityStatus.AVAILABLE
                && ChronoUnit.DAYS.between(ref, today) >= FORGOTTEN_DAYS;
    }

    static Map<String, Object> pieceSummary(WardrobeItem w, RoomAddress a, Map<String, String> labels, boolean owner, Set<String> states) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", w.getId());
        m.put("name", w.getName());
        m.put("category", w.getCategory());
        m.put("subcategory", w.getSubcategory());
        m.put("color", w.getColor());
        m.put("colorHex", Taxonomy.hex(w.getColor()));
        m.put("imageUrl", w.getImageUrl());
        m.put("thumbnailUrl", w.getThumbnailUrl());
        m.put("model3dUrl", w.getModel3dUrl());
        m.put("address", a == null ? null : a.toString());
        m.put("addressLabel", a == null ? null : a.label(labels));
        m.put("moduleId", a == null ? null : a.moduleId());
        m.put("storedInRoom", a != null && !a.zone().equals("chair"));
        m.put("roomOverflow", a == null || a.zone().equals("chair"));
        m.put("states", states);
        m.put("wearCount", w.getWearCount());
        m.put("origin", w.getPieceOrigin());
        if (w.isForSale() && w.getPrice() != null) {
            m.put("salePrice", w.getPrice());                 // etiqueta de preço na Arara do Desapego (peça à venda é pública)
        }
        if (owner) {
            m.put("costPerUse", w.getPrice() != null && w.getWearCount() > 0
                    ? w.getPrice().divide(BigDecimal.valueOf(w.getWearCount()), 2, RoundingMode.HALF_UP) : null);
        }
        return m;
    }

    static Set<String> statesOf(WardrobeItem w, RoomAddress a, LocalDate today, Map<UUID, LocalDate> lastDiary, Set<UUID> dailyLookPieces,
                         String iconPieceName) {
        Set<String> s = new java.util.LinkedHashSet<>();
        boolean unavailable = !w.isDisponivel() || w.getAvailabilityStatus() != AvailabilityStatus.AVAILABLE;
        if (unavailable) {
            s.add("INDISPONIVEL");
        } else if (forgotten(w, lastUse(w, lastDiary), today)) {
            s.add("ESQUECIDA");
        }
        if (w.isFavorite()) {
            s.add("FAVORITA");
        }
        if (iconPieceName != null && w.getName() != null && w.getName().equalsIgnoreCase(iconPieceName)) {
            s.add("ICONE");
        }
        if (w.isForSale()) {
            s.add("A_VENDA");
        }
        if (dailyLookPieces.contains(w.getId())) {
            s.add("LOOK_DO_DIA");
        }
        if (a != null && a.zone().equals("chair")) {
            s.add("CADEIRA");
        }
        if (a != null && a.zone().equals("season")) {
            s.add("FORA_DE_ESTACAO");
        }
        if (w.getImageUrl() == null || w.getPhotoProcessingStatus() == PhotoProcessingStatus.NEEDS_REUPLOAD
                || w.getPhotoProcessingStatus() == PhotoProcessingStatus.FAILED) {
            s.add("CROQUI");
        }
        if (w.getWearCount() >= 30) {
            s.add("30_USOS");
        }
        if ("GARIMPADA".equalsIgnoreCase(w.getPieceOrigin())) {
            s.add("GARIMPO");
        }
        return s;
    }
}
