package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairLooks.Boss;
import br.com.fashionai.application.flair.FlairLooks.Clash;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.Score;
import br.com.fashionai.application.flair.FlairLooks.Synergy;
import br.com.fashionai.application.flair.FlairLooks.Theme;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.stream.Collectors;

import static br.com.fashionai.application.flair.FlairLookStats.synergies;
import static br.com.fashionai.application.flair.FlairLookStats.weight;
import static br.com.fashionai.application.flair.FlairLooks.LABELS;
import static br.com.fashionai.application.flair.FlairLooks.STATS;
import static br.com.fashionai.application.flair.FlairLooks.theme;
import static br.com.fashionai.application.flair.FlairLooks.winner;

/**
 * Pontuação de um look num tema no {@link FlairLooks}: a nota contextual e a Battle of Looks, e as variantes de modo
 * (Combo Battle, Fashion Boss e FLAIR Runway).
 */
final class FlairLookScoring {
    private FlairLookScoring() {
    }

    // ------------------------------------------------------------------ pontuação contextual

    /** Pontuação do look no tema: pesos do tema sobre os 10 atributos + ocasião/estilo do tema + condições. */
    public static Score score(Look l, Theme t) {
        List<String> notes = new ArrayList<>();
        Map<String, Double> v = new LinkedHashMap<>();
        l.stats().forEach((k, x) -> v.put(k, x.doubleValue()));
        int n = Math.max(1, l.cards().size());
        if (!t.occasions().isEmpty()) {
            double fit = l.cards().stream().filter(c -> c.occasions().stream().anyMatch(t.occasions()::contains)).count() / (double) n;
            v.put("OCCASION", 0.7 * fit * 100 + 0.3 * v.get("OCCASION"));
        }
        if (!t.styles().isEmpty()) {
            double fit = l.cards().stream().filter(c -> c.styles().stream().anyMatch(t.styles()::contains)).count() / (double) n;
            v.put("STYLE", Math.min(120, v.get("STYLE") + 12 * fit));
        }
        if (t.boostStyle() != null && l.styles().contains(t.boostStyle()) && t.boostStat() != null) {
            v.put(t.boostStat(), v.get(t.boostStat()) * (1 + t.boostPct()));
            notes.add(t.boostStyle() + " → +" + Math.round(t.boostPct() * 100) + "% " + LABELS.get(t.boostStat()));
        }
        for (Synergy x : synergies(l.cards(), t)) {
            if (x.code().equals("VINTAGE_REVIVAL") && t.styles().contains("vintage")) {
                v.put("TREND", v.get("TREND") + 10);
                notes.add(Msg.t("flairLooks.vintage_revival_no_evento_retro"));
            }
        }
        double sw = 0, sum = 0;
        Map<String, Double> parts = new LinkedHashMap<>();
        for (String k : STATS) {
            double wt = weight(t, k);
            sw += wt;
            sum += wt * v.get(k);
            parts.put(k, Math.round(wt * v.get(k) * 10) / 10.0);
        }
        double total = sum / sw;
        if (!t.bonusSubcategories().isEmpty() && l.cards().stream().anyMatch(c -> t.bonusSubcategories().contains(c.subcategory()))) {
            total += t.bonusPoints();
            notes.add(Msg.t("flairLooks.pela_peca_exigida_no_tema", t.bonusPoints()));
        }
        if (t.requireStyle() != null) {
            if (l.styles().contains(t.requireStyle())) {
                total += 5;
                notes.add(Msg.t("flairLooks.tem_peca_5", t.requireStyle()));
            } else {
                total -= 15;
                notes.add(Msg.t("flairLooks.sem_peca_15", t.requireStyle()));
            }
        }
        if (!l.synergies().isEmpty()) {
            notes.add(l.synergies().stream().map(x -> x.emoji() + " " + x.label()).collect(Collectors.joining(", ")));
        }
        return new Score(Math.round(total * 10) / 10.0, parts, notes);
    }

    /** Battle of Looks: Look A × Look B no tema sorteado — o contexto muda os pesos, não só o HypeScore. */
    public static Clash battle(Look a, Look b, Theme t) {
        Score sa = score(a, t), sb = score(b, t);
        List<Map<String, Object>> bd = new ArrayList<>();
        for (String k : STATS) {
            bd.add(Map.of("stat", k, "label", LABELS.get(k), "weight", weight(t, k), "a", a.stats().get(k), "b", b.stats().get(k)));
        }
        List<String> notes = new ArrayList<>();
        sa.notes().forEach(x -> notes.add("A: " + x));
        sb.notes().forEach(x -> notes.add("B: " + x));
        return new Clash(t.emoji() + " " + t.label(), a.title(), b.title(), sa.total(), sb.total(), winner(sa.total(), sb.total()), notes, bd);
    }

    // ------------------------------------------------------------------ Combo Battle

    public static double comboScore(Look l, Theme t) {
        int combos = synergies(l.cards(), t).stream().mapToInt(Synergy::bonus).sum();
        return Math.round((combos * 2 + score(l, t).total() * 0.3) * 10) / 10.0;
    }

    // ------------------------------------------------------------------ Boss

    /** O boss tem os atributos fixos acima e 72 nos demais; a luta usa o tema preferido dele. */
    public static Look bossLook(Boss b) {
        Map<String, Integer> s = new LinkedHashMap<>();
        STATS.forEach(k -> s.put(k, b.stats().getOrDefault(k, 72)));
        Theme t = theme(b.theme());
        return new Look(null, b.emoji() + " " + b.name(), "BOSS", null, s, List.of(), 88, t.styles(), t.occasions(), List.of("neutral"), List.of(), List.of());
    }

    /** Boss não tem cartas: a pontuação dele é só a média ponderada dos atributos no tema. */
    public static double bossScore(Look boss, Theme t) {
        double sw = 0, sum = 0;
        for (String k : STATS) {
            double wt = weight(t, k);
            sw += wt;
            sum += wt * boss.stats().get(k);
        }
        return Math.round(sum / sw * 10) / 10.0;
    }

    // ------------------------------------------------------------------ Runway

    /** Nota da FLAIR Runway: 40% IA + 30% compatibilidade temática + 20% comunidade + 10% originalidade (± júri). */
    public static double runwayScore(Look l, Theme t, int stage, long seed) {
        double judge = new Random(seed * 31 + stage * 7L + Objects.hashCode(l.schemeId())).nextGaussian() * 1.5;
        return Math.round((0.4 * l.stats().get("AI") + 0.3 * score(l, t).total() + 0.2 * l.stats().get("COMMUNITY") + 0.1 * l.stats().get("ORIGINALITY") + judge) * 10) / 10.0;
    }
}
