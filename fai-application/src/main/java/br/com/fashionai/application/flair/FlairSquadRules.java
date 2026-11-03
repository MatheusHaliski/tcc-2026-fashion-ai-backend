package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairLooks.Clash;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.Theme;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.flair.FlairLookScoring.battle;
import static br.com.fashionai.application.flair.FlairLookScoring.score;
import static br.com.fashionai.application.flair.FlairLooks.DIVISIONS;
import static br.com.fashionai.application.flair.FlairLooks.winner;

/**
 * FLAIR Squad e Fashion League no {@link FlairLooks}: a melhor escalação por situação, as rodadas, a divisão pelos
 * pontos e a partida da liga com substituições e cartas especiais.
 */
final class FlairSquadRules {
    private FlairSquadRules() {
    }

    // ------------------------------------------------------------------ Squad 5×5 (e Liga)

    /** Melhor escalação: cada situação recebe um look diferente, maximizando a soma (força bruta, até 5! = 120). */
    public static List<Integer> assign(List<Look> looks, List<Theme> situations) {
        int m = situations.size();
        List<Integer> idx = new ArrayList<>();
        for (int i = 0; i < looks.size(); i++) {
            idx.add(i);
        }
        List<Integer> best = new ArrayList<>();
        double[] bestScore = {-1};
        permute(idx, 0, m, looks, situations, bestScore, best);
        return best;
    }

    private static void permute(List<Integer> idx, int k, int m, List<Look> looks, List<Theme> sits, double[] best, List<Integer> out) {
        if (k == Math.min(m, idx.size())) {
            double s = 0;
            for (int i = 0; i < k; i++) {
                s += score(looks.get(idx.get(i)), sits.get(i)).total();
            }
            if (s > best[0]) {
                best[0] = s;
                out.clear();
                out.addAll(idx.subList(0, k));
            }
            return;
        }
        for (int i = k; i < idx.size(); i++) {
            java.util.Collections.swap(idx, k, i);
            permute(idx, k + 1, m, looks, sits, best, out);
            java.util.Collections.swap(idx, k, i);
        }
    }

    public static List<Clash> squad(List<Look> a, List<Look> b, List<Theme> situations) {
        List<Integer> pa = assign(a, situations), pb = assign(b, situations);
        List<Clash> out = new ArrayList<>();
        for (int r = 0; r < situations.size(); r++) {
            Theme t = situations.get(r);
            Look la = r < pa.size() ? a.get(pa.get(r)) : null, lb = r < pb.size() ? b.get(pb.get(r)) : null;
            if (la == null && lb == null) {
                continue;
            }
            if (la == null || lb == null) {
                out.add(new Clash(t.emoji() + " " + t.label(), la == null ? "—" : la.title(), lb == null ? "—" : lb.title(), la == null ? 0 : score(la, t).total(),
                        lb == null ? 0 : score(lb, t).total(), la == null ? "B" : "A", List.of(Msg.t("flairLooks.w_o_o_outro_lado")), List.of()));
                continue;
            }
            out.add(battle(la, lb, t));
        }
        return out;
    }

    public static Map<String, Object> division(int points) {
        String[] d = DIVISIONS.get(0);
        for (String[] x : DIVISIONS) {
            if (points >= Integer.parseInt(x[0])) {
                d = x;
            }
        }
        return Map.of("code", d[1], "label", d[2], "from", Integer.parseInt(d[0]));
    }

    /** Partida da Fashion League: titulares por situação, até 2 substituições por reservas e cartas especiais (+3). */
    public static List<Clash> leagueMatch(List<Look> startersA, List<Look> reservesA, List<Card> specialsA, List<Look> startersB,
                                          List<Look> reservesB, List<Card> specialsB, List<Theme> situations) {
        List<Clash> base = squad(startersA, startersB, situations);
        List<Clash> out = new ArrayList<>();
        int subsA = 0, subsB = 0;
        List<Integer> pa = assign(startersA, situations), pb = assign(startersB, situations);
        for (int r = 0; r < base.size(); r++) {
            Clash c = base.get(r);
            Theme t = situations.get(r);
            double sa = c.scoreA(), sb = c.scoreB();
            List<String> notes = new ArrayList<>(c.notes());
            String la = c.a(), lb = c.b();
            if (subsA < 2 && !reservesA.isEmpty()) {
                Look best = reservesA.stream().max(Comparator.comparingDouble(x -> score(x, t).total())).get();
                double bs = score(best, t).total();
                if (bs > sa + 3) {
                    notes.add(Msg.t("flairLooks.a_substituicao_entra_no_lugar", best.title(), la));
                    la = best.title();
                    sa = bs;
                    subsA++;
                }
            }
            if (subsB < 2 && !reservesB.isEmpty()) {
                Look best = reservesB.stream().max(Comparator.comparingDouble(x -> score(x, t).total())).get();
                double bs = score(best, t).total();
                if (bs > sb + 3) {
                    notes.add(Msg.t("flairLooks.b_substituicao_entra_no_lugar", best.title(), lb));
                    lb = best.title();
                    sb = bs;
                    subsB++;
                }
            }
            if (specialsA.stream().anyMatch(x -> x.occasions().stream().anyMatch(t.occasions()::contains) || x.styles().stream().anyMatch(t.styles()::contains))) {
                sa += 3;
                notes.add(Msg.t("flairLooks.a_carta_especial_3"));
            }
            if (specialsB.stream().anyMatch(x -> x.occasions().stream().anyMatch(t.occasions()::contains) || x.styles().stream().anyMatch(t.styles()::contains))) {
                sb += 3;
                notes.add(Msg.t("flairLooks.b_carta_especial_3"));
            }
            out.add(new Clash(c.label(), la, lb, Math.round(sa * 10) / 10.0, Math.round(sb * 10) / 10.0, winner(sa, sb), notes, c.breakdown()));
        }
        return out;
    }

}
