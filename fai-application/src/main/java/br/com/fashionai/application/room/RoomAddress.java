package br.com.fashionai.application.room;

import br.com.fashionai.application.common.Msg;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * RF32 §1.1 — endereço estável e legível de uma posição do quarto, usado pelo Copilot e pelo Vista-me.
 * Zonas: door:{n}/hanger:{k} · drawer:{n} · top:{n} · base:{n} · shoe:{n} · bags:{n} · jewelry:{n} · chair:{n} · season:{n}.
 */
public record RoomAddress(String zone, int index, int sub) {
    private static final Pattern PATTERN = Pattern.compile("^(door|drawer|top|base|shoe|bags|jewelry|chair|season):(\\d+)(?:/hanger:(\\d+))?$");

    public static Optional<RoomAddress> parse(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        Matcher m = PATTERN.matcher(raw.trim().toLowerCase(Locale.ROOT));
        if (!m.matches()) {
            return Optional.empty();
        }
        String zone = m.group(1);
        int index = Integer.parseInt(m.group(2));
        int sub = m.group(3) == null ? 0 : Integer.parseInt(m.group(3));
        if (zone.equals("door") && sub == 0) {
            return Optional.empty();
        }
        return Optional.of(new RoomAddress(zone, index, sub));
    }

    public static RoomAddress door(int door, int hanger) {
        return new RoomAddress("door", door, hanger);
    }

    public static RoomAddress of(String zone, int index) {
        return new RoomAddress(zone, index, 0);
    }

    /** Identificador do módulo que contém a posição (para enquadrar a câmera, RF32.CA09). */
    public String moduleId() {
        return switch (zone) {
            case "door", "drawer" -> zone + ":" + index;
            default -> zone;
        };
    }

    @Override
    public String toString() {
        return zone.equals("door") ? "door:" + index + "/hanger:" + sub : zone + ":" + index;
    }

    /** Rótulo exibido ("Porta 2", "Gaveta 4 · Jeans", "Sapateira · posição 4"). */
    public String label(Map<String, String> drawerLabels) {
        return switch (zone) {
            case "door" -> Msg.t("roomAddress.porta", index);
            case "drawer" -> {
                String l = drawerLabels == null ? null : drawerLabels.get(String.valueOf(index));
                yield Msg.t("roomAddress.gaveta", index) + (l == null || l.isBlank() ? "" : " · " + l);
            }
            case "top" -> Msg.t("roomAddress.maleiro");
            case "base" -> Msg.t("roomAddress.base_posicao", index);
            case "shoe" -> Msg.t("roomAddress.sapateira_posicao", index);
            case "bags" -> Msg.t("roomAddress.vitrine_de_bolsas_posicao", index);
            case "jewelry" -> Msg.t("roomAddress.porta_joias_posicao", index);
            case "chair" -> Msg.t("roomAddress.cadeira");
            case "season" -> Msg.t("common.maleiro_de_estacao");
            default -> toString();
        };
    }
}
