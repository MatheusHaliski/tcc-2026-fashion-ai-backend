package br.com.fashionai.application.service;

import java.time.LocalDate;
import java.time.temporal.IsoFields;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Calendário das temporadas do FLAIR e leitura tolerante dos números e ids gravados no estado JSON dos modos. */
final class FlairModeValues {
    private FlairModeValues() {
    }

    static LocalDate today() {
        return FlairService.today();
    }

    static String seasonKey() {
        LocalDate d = today();
        return d.getYear() + "-T" + String.format("%02d", (d.getDayOfYear() - 1) / 28 + 1);
    }

    static String weekKey() {
        LocalDate d = today();
        return d.get(IsoFields.WEEK_BASED_YEAR) + "-W" + String.format("%02d", d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
    }

    static int num(Object o) {
        return o instanceof Number n ? n.intValue() : 0;
    }

    static List<UUID> ids(Object raw) {
        if (!(raw instanceof List<?> l)) {
            return List.of();
        }
        return l.stream().filter(Objects::nonNull).map(String::valueOf).filter(x -> !x.isBlank()).map(UUID::fromString).toList();
    }
}
