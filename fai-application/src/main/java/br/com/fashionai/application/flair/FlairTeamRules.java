package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.Theme;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import static br.com.fashionai.application.flair.FlairLookScoring.score;
import static br.com.fashionai.application.flair.FlairLookStats.clamp;
import static br.com.fashionai.application.flair.FlairLooks.ROLES;

/**
 * Duplas e equipes no {@link FlairLooks}: a harmonia entre dois looks (Tag Team) e o valor por função e o rating do
 * elenco do Ultimate Team.
 */
final class FlairTeamRules {
    private FlairTeamRules() {
    }

    // ------------------------------------------------------------------ Tag Team

    /** Team Harmony: estética compatível entre os dois looks da dupla (estilo, cor e ocasião). */
    public static int harmony(Look a, Look b) {
        double st = jaccard(a.styles(), b.styles()), oc = jaccard(a.occasions(), b.occasions());
        Set<String> fa = new HashSet<>(a.families()), fb = new HashSet<>(b.families());
        fa.remove("neutral");
        fb.remove("neutral");
        double col = fa.isEmpty() || fb.isEmpty() ? 0.85 : jaccard(new ArrayList<>(fa), new ArrayList<>(fb)) * 0.6 + 0.4;
        return clamp(40 + st * 30 + col * 20 + oc * 15);
    }

    static double jaccard(Collection<String> a, Collection<String> b) {
        Set<String> i = new HashSet<>(a);
        i.retainAll(b);
        Set<String> u = new HashSet<>(a);
        u.addAll(b);
        return u.isEmpty() ? 0 : i.size() / (double) u.size();
    }

    public static double tagScore(Look a, Look b, Theme t) {
        return Math.round(((score(a, t).total() + score(b, t).total()) / 2 * 0.8 + harmony(a, b) * 0.2) * 10) / 10.0;
    }

    // ------------------------------------------------------------------ Ultimate Team

    public static int roleValue(Look l, String role) {
        String stat = ROLES.get(role);
        if ("RATING".equals(stat)) {
            return l.rating();
        }
        if ("WILD".equals(stat)) {
            // imprevisível: o maior atributo do look vale inteiro, o menor puxa pouco
            int max = l.stats().values().stream().mapToInt(Integer::intValue).max().orElse(0);
            int min = l.stats().values().stream().mapToInt(Integer::intValue).min().orElse(0);
            return clamp(max * 0.8 + min * 0.2);
        }
        if ("STYLE".equals(stat)) {
            return clamp((l.stats().get("STYLE") + l.stats().get("AI")) / 2.0);
        }
        return l.stats().get(stat);
    }

    public static Map<String, Object> teamRating(Map<String, Look> roster) {
        List<Look> looks = roster.values().stream().filter(Objects::nonNull).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        if (looks.isEmpty()) {
            m.put("rating", 0);
            return m;
        }
        double rating = roster.entrySet().stream().filter(e -> e.getValue() != null).mapToInt(e -> roleValue(e.getValue(), e.getKey())).average().orElse(0);
        double chem = 0;
        int pairs = 0;
        for (int i = 0; i < looks.size(); i++) {
            for (int j = i + 1; j < looks.size(); j++) {
                chem += harmony(looks.get(i), looks.get(j));
                pairs++;
            }
        }
        Set<String> styles = looks.stream().flatMap(l -> l.styles().stream()).collect(Collectors.toSet());
        Set<String> occ = looks.stream().flatMap(l -> l.occasions().stream()).collect(Collectors.toSet());
        m.put("rating", clamp(rating));
        m.put("chemistry", clamp(pairs == 0 ? 70 : chem / pairs));
        m.put("diversity", clamp(styles.size() * 7 + occ.size() * 5));
        m.put("trend", clamp(looks.stream().mapToInt(l -> l.stats().get("TREND")).average().orElse(0)));
        m.put("creativity", clamp(looks.stream().mapToInt(l -> l.stats().get("ORIGINALITY")).average().orElse(0)));
        m.put("community", clamp(looks.stream().mapToInt(l -> l.stats().get("COMMUNITY")).average().orElse(0)));
        return m;
    }
}
