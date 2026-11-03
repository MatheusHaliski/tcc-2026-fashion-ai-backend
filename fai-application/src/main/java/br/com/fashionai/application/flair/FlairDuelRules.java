package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairEngine.Combo;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import br.com.fashionai.application.flair.FlairEngine.DuelResult;
import br.com.fashionai.application.flair.FlairEngine.Round;

import java.util.ArrayList;
import java.util.List;

import static br.com.fashionai.application.flair.FlairEngine.DUEL_ROUNDS;

/**
 * Disputas entre decks do {@link FlairEngine}: o duelo de estilo em 5 rodadas (com as habilidades das cartas) e a nota
 * da batalha de ocasião do dia.
 */
final class FlairDuelRules {
    private FlairDuelRules() {
    }

    // ------------------------------------------------------------------ duelo

    /**
     * Duelo de estilo em 5 rodadas (EDGE, RANGE, CLOUT, GLOW, ART): cada lado revela a média do atributo no deck, com
     * as habilidades das cartas, +8 com a maioria das cartas em SYNC, parte da Sinergia de estilo no EDGE e a sinergia
     * de marca a 75% da força. Vence quem ganhar mais rodadas; empate não dá vitória a ninguém.
     */
    public static DuelResult duel(Deck a, Deck b) {
        List<Round> rounds = new ArrayList<>();
        int wa = 0, wb = 0;
        for (String stat : DUEL_ROUNDS) {
            List<String> notes = new ArrayList<>();
            double va = side(a, b, stat, notes, "A"), vb = side(b, a, stat, notes, "B");
            String w = Math.abs(va - vb) < 0.5 ? "DRAW" : va > vb ? "A" : "B";
            if (!"DRAW".equals(w)) {
                Deck loser = "A".equals(w) ? b : a;
                if (Math.abs(va - vb) < 10 && loser.abilities().stream().anyMatch(x -> x.code().equals("SHIELD"))) {
                    notes.add(Msg.t("flair.escudo_de_derrota_por_menos", ("A".equals(w) ? "B" : "A")));
                    w = "DRAW";
                }
            }
            if ("A".equals(w)) {
                wa++;
            } else if ("B".equals(w)) {
                wb++;
            }
            rounds.add(new Round(stat, Math.round(va * 10) / 10.0, Math.round(vb * 10) / 10.0, w, notes));
        }
        return new DuelResult(rounds, wa, wb, wa == wb ? "DRAW" : wa > wb ? "A" : "B");
    }

    static double side(Deck me, Deck other, String stat, List<String> notes, String tag) {
        List<Card> cards = new ArrayList<>(me.cards());
        if (cards.isEmpty()) {
            return 0;
        }
        if ("EDGE".equals(stat) && other.abilities().stream().anyMatch(x -> x.code().equals("STATEMENT_LOCK")) && cards.size() > 1) {
            Card strongest = cards.stream().max((x, y) -> Integer.compare(x.stats().get("EDGE"), y.stats().get("EDGE"))).get();
            cards.remove(strongest);
            notes.add(Msg.t("flair.statement_lock_bloqueou", strongest.name(), tag));
        }
        double sum = 0;
        long street = cards.stream().filter(c -> c.styles().contains("streetwear") || c.styles().contains("urban")).count();
        for (Card c : cards) {
            double v = c.stats().get(stat);
            if ("EDGE".equals(stat) && c.ability() != null && c.ability().code().equals("TRENDSETTER")) {
                v *= 2;
                notes.add(Msg.t("flair.trendsetter_dobrou_o_edge_de", c.name(), tag));
            }
            if ("EDGE".equals(stat) && c.ability() != null && c.ability().code().equals("HYPE_BOOST")) {
                v += 15 * Math.max(0, street - 1);
            }
            sum += v;
        }
        double val = sum / cards.size();
        if ("GLOW".equals(stat) && me.abilities().stream().anyMatch(x -> x.code().equals("SPOTLIGHT"))) {
            val += 30;
            notes.add(Msg.t("flair.spotlight_30_glow", tag));
        }
        long synced = me.cards().stream().filter(c -> c.stats().get("SYNC") == 100).count();
        if (synced * 2 > me.cards().size()) {
            val += 8;
        }
        if ("EDGE".equals(stat)) {
            val += me.combos().stream().filter(c -> c.code().equals("STYLE_SYNERGY")).mapToInt(c -> c.points() / 4).sum();
        }
        return val * (1 + (me.brandMultiplier() - 1) * 0.75);
    }

    // ------------------------------------------------------------------ batalha de ocasião

    /** Nota da batalha de ocasião do dia: cobertura da ocasião + RANGE, EDGE e GLOW médios + combos. */
    public static double occasionScore(Deck d, String occasion) {
        if (d.cards().isEmpty()) {
            return 0;
        }
        double fit = d.cards().stream().filter(c -> c.occasions().contains(occasion)).count() / (double) d.cards().size();
        double combos = d.combos().stream().mapToInt(Combo::points).sum();
        return Math.round((fit * 100 * 0.4 + d.avg().get("RANGE") * 0.2 + d.avg().get("EDGE") * 0.2 + d.avg().get("GLOW") * 0.2 + combos * 0.3) * 10) / 10.0;
    }
}
