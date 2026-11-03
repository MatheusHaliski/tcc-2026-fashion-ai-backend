package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Ability;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairEngine.Combo;
import br.com.fashionai.application.flair.FlairEngine.Deck;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.flair.FlairEngine.STATS;

/**
 * Regras do deck do {@link FlairEngine}: combos (estilo, ocasião, estação, materiais), sinergia de marca, bônus da
 * estação do esquema, habilidade ICON e as médias dos atributos.
 */
final class FlairDeckRules {
    private FlairDeckRules() {
    }

    // ------------------------------------------------------------------ deck

    public static Deck deck(String schemeId, String title, List<Card> cards, String schemeSeason, String currentSeason) {
        List<Combo> combos = new ArrayList<>();
        if (!cards.isEmpty()) {
            Map<String, Integer> styleCount = count(cards.stream().map(Card::styles).toList());
            int style = styleCount.values().stream().filter(c -> c >= 2).mapToInt(c -> 8 * c).sum();
            if (style > 0) {
                combos.add(new Combo("STYLE_SYNERGY", Msg.t("flair.sinergia_de_estilo"), Math.min(60, style)));
            }
            Set<String> shared = new HashSet<>(cards.get(0).occasions());
            cards.forEach(c -> shared.retainAll(c.occasions()));
            if (!shared.isEmpty() && cards.size() >= 2) {
                combos.add(new Combo("OCCASION_SYNERGY", Msg.t("flair.sinergia_de_ocasiao"), Math.min(48, 12 * shared.size())));
            }
            Map<String, Integer> seasons = count(cards.stream().map(c -> List.of(c.season())).toList());
            seasons.remove("ALL");
            if (seasons.values().stream().anyMatch(c -> c >= 3)) {
                combos.add(new Combo("SEASON_SWEEP", Msg.t("flair.varredura_de_estacao"), 25));
            }
            long materials = cards.stream().map(Card::material).filter(m -> m != null && !m.isBlank()).distinct().count();
            if (materials >= 3) {
                combos.add(new Combo("MATERIAL_CONTRAST", Msg.t("flair.contraste_de_materiais"), (int) Math.min(36, 6 * materials)));
            }
        }
        Map<String, Integer> brands = count(cards.stream().map(c -> c.brandName() == null || c.brandName().isBlank() ? List.<String>of() : List.of(c.brandName().toLowerCase(Locale.ROOT))).toList());
        String topBrand = brands.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(null);
        int same = topBrand == null ? 0 : brands.get(topBrand);
        double brandMult = same >= 4 ? 1.35 : same == 3 ? 1.20 : same == 2 ? 1.10 : 1.0;
        int seasonBonus = schemeSeason != null && schemeSeason.equals(currentSeason) ? 15 : 0;
        double avgPower = cards.stream().mapToInt(Card::power).average().orElse(0);
        int comboPts = combos.stream().mapToInt(Combo::points).sum();
        List<Ability> abilities = cards.stream().map(Card::ability).filter(a -> a != null).toList();
        boolean icon = abilities.stream().anyMatch(a -> a.code().equals("ICON"));
        int power = (int) Math.round((avgPower + comboPts + seasonBonus) * brandMult * (icon ? 1.2 : 1));
        Map<String, Integer> avg = new LinkedHashMap<>();
        STATS.forEach(s -> avg.put(s, (int) Math.round(cards.stream().mapToInt(c -> c.stats().get(s)).average().orElse(0))));
        return new Deck(schemeId, title, cards, combos, brandMult, topBrand, seasonBonus, power, avg, abilities);
    }

    private static Map<String, Integer> count(Collection<List<String>> lists) {
        Map<String, Integer> m = new HashMap<>();
        lists.forEach(l -> new HashSet<>(l).forEach(v -> m.merge(v, 1, Integer::sum)));
        return m;
    }
}
