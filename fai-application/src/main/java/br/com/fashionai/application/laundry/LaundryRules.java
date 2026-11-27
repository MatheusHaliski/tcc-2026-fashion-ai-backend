package br.com.fashionai.application.laundry;

import br.com.fashionai.domain.model.WardrobeItem;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Regras puras do ciclo de lavanderia: transições válidas e agrupamento sugerido por instrução declarada ou
 * composição conhecida. Peça sem instrução nem composição nunca entra em sugestão: é sinalizada como dado ausente.
 */
public final class LaundryRules {
    private LaundryRules() {
    }

    /** limpa → usada → lavagem → limpa; "limpa" também pode ir direto para lavagem (lavar antes de usar). */
    public static boolean canTransition(String from, String to) {
        return switch (to) {
            case "WORN" -> "CLEAN".equals(from);
            case "IN_WASH" -> "WORN".equals(from) || "CLEAN".equals(from);
            case "CLEAN" -> "WORN".equals(from) || "IN_WASH".equals(from);
            default -> false;
        };
    }

    public record Group(String key, String source, List<UUID> pieceIds) { }
    public record Suggestions(List<Group> groups, List<UUID> missingData) { }

    /** Agrupa por código de lavagem declarado; sem ele, por composição textual; sem nenhum, vai para a lista de ausentes. */
    public static Suggestions group(List<WardrobeItem> worn) {
        Map<String, Group> groups = new LinkedHashMap<>();
        List<UUID> missing = new ArrayList<>();
        for (WardrobeItem item : worn) {
            String key;
            String source;
            if (item.getTipoLavagem() != null && item.getTipoLavagem().getCodigo() != null) {
                key = "WASH:" + item.getTipoLavagem().getCodigo();
                source = "DECLARED_INSTRUCTION";
            } else if (item.getMaterial() != null && !item.getMaterial().isBlank()) {
                key = "MATERIAL:" + item.getMaterial().trim().toLowerCase(Locale.ROOT);
                source = "DECLARED_COMPOSITION";
            } else {
                missing.add(item.getId());
                continue;
            }
            groups.computeIfAbsent(key, k -> new Group(k, source, new ArrayList<>())).pieceIds().add(item.getId());
        }
        return new Suggestions(List.copyOf(groups.values()), List.copyOf(missing));
    }
}
