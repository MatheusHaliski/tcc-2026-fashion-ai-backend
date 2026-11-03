package br.com.fashionai.application.service;

import br.com.fashionai.application.flair.FlairLooks.Clash;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Visões de jogo dos modos do FLAIR: look enxuto, confronto e vencedor de uma série de rodadas. */
final class FlairModeViews {
    private FlairModeViews() {
    }

    /** Visão enxuta do look (sem a lista completa de cartas) para as telas de jogo. */
    static Map<String, Object> lookView(Look l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("schemeId", l.schemeId());
        m.put("title", l.title());
        m.put("owner", l.owner());
        m.put("coverUrl", l.coverUrl());
        m.put("rating", l.rating());
        m.put("stats", l.stats());
        m.put("synergies", l.synergies());
        m.put("styles", l.styles());
        m.put("occasions", l.occasions());
        m.put("cards", l.cards().stream().map(c -> Map.of("id", c.id(), "name", c.name(), "imageUrl", String.valueOf(c.imageUrl()), "category", c.category(),
                "rarity", c.rarity(), "power", c.power())).toList());
        return m;
    }

    static Map<String, Object> clashView(Clash c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", c.label());
        m.put("a", c.a());
        m.put("b", c.b());
        m.put("scoreA", c.scoreA());
        m.put("scoreB", c.scoreB());
        m.put("winner", c.winner());
        m.put("notes", c.notes());
        m.put("breakdown", c.breakdown());
        return m;
    }

    static String overall(List<Clash> rounds) {
        long a = rounds.stream().filter(r -> "A".equals(r.winner())).count(), b = rounds.stream().filter(r -> "B".equals(r.winner())).count();
        if (a != b) {
            return a > b ? "A" : "B";
        }
        double sa = rounds.stream().mapToDouble(Clash::scoreA).sum(), sb = rounds.stream().mapToDouble(Clash::scoreB).sum();
        return FlairLooks.winner(sa, sb);
    }
}
