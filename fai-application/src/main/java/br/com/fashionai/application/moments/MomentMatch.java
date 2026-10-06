package br.com.fashionai.application.moments;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * MomentMatchScore (§13–§15): compatibilidade CONTEXTUAL entre um look (ou peça) e um Momento, 0–100, independente do
 * HypeScore e da compatibilidade pessoal. Nunca decide "certo/errado" (não existe HalloweenLook = true/false): devolve
 * um grau e as razões, para a interface explicar "forte associação ao tema pela combinação de preto, laranja e
 * elementos dark" — e nunca "você está corretamente vestido".
 *
 * <p>Dimensões (todas por sobreposição sobre as taxonomias existentes, sem IA no caminho da pontuação):
 * styleMatch (0,30), colorMatch (0,25), occasionMatch (0,15), themeMatch (0,15: interpretação escolhida/mais próxima),
 * itemMatch (0,10: peças sugeridas/obrigatórias), creativeInterpretation (0,05: mistura do tema com estilos FORA
 * do tema — recompensa a leitura própria, não a cópia). Dimensões sem base nos dois lados saem da média.</p>
 */
public final class MomentMatch {
    private MomentMatch() {
    }

    /** Lado do Momento: tags do Momento + do desafio escolhido + da interpretação. */
    public record Context(Set<String> styles, Set<String> colors, Set<String> occasions, Set<String> items,
                          List<Interpretation> interpretations) {
        public boolean empty() {
            return styles.isEmpty() && colors.isEmpty() && occasions.isEmpty() && items.isEmpty() && interpretations.isEmpty();
        }
    }

    public record Interpretation(String key, Set<String> styles, Set<String> colors) {
    }

    /** Lado do look: estilos, cores, ocasiões e subcategorias das peças. */
    public record Subject(Set<String> styles, Set<String> colors, Set<String> occasions, Set<String> items) {
        public boolean empty() {
            return styles.isEmpty() && colors.isEmpty() && occasions.isEmpty() && items.isEmpty();
        }
    }

    public record Result(int score, Map<String, Integer> parts, String interpretation, List<String> reasons) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("score", score);
            m.put("parts", parts);
            m.put("interpretation", interpretation);
            m.put("reasons", reasons);
            return m;
        }
    }

    public static Context context(Collection<String> styles, Collection<String> colors, Collection<String> occasions,
                                  Collection<String> items, List<Interpretation> interpretations) {
        return new Context(norm(styles), norm(colors), norm(occasions), norm(items), interpretations == null ? List.of() : interpretations);
    }

    public static Subject subject(Collection<String> styles, Collection<String> colors, Collection<String> occasions, Collection<String> items) {
        return new Subject(norm(styles), norm(colors), norm(occasions), norm(items));
    }

    public static Interpretation interpretation(String key, Collection<String> styles, Collection<String> colors) {
        return new Interpretation(key, norm(styles), norm(colors));
    }

    /** @return resultado 0–100 com partes e razões, ou nulo quando não há base de comparação de nenhum lado */
    public static Result score(Context ctx, Subject s) {
        if (ctx == null || ctx.empty() || s == null || s.empty()) {
            return null;
        }
        Map<String, Integer> parts = new LinkedHashMap<>();
        List<String> reasons = new ArrayList<>();
        double num = 0, den = 0;

        Double style = overlap(ctx.styles(), s.styles());
        if (style != null) {
            num += 0.30 * style;
            den += 0.30;
            parts.put("styleMatch", pct(style));
            if (style >= 0.5) {
                reasons.add("style:" + String.join(",", inter(ctx.styles(), s.styles())));
            }
        }
        Double color = overlap(ctx.colors(), s.colors());
        if (color != null) {
            num += 0.25 * color;
            den += 0.25;
            parts.put("colorMatch", pct(color));
            if (color >= 0.5) {
                reasons.add("color:" + String.join(",", inter(ctx.colors(), s.colors())));
            }
        }
        Double occ = overlap(ctx.occasions(), s.occasions());
        if (occ != null) {
            num += 0.15 * occ;
            den += 0.15;
            parts.put("occasionMatch", pct(occ));
        }
        // interpretação mais próxima: o look não precisa seguir a leitura dominante do tema (§18)
        String best = null;
        double bestTheme = -1;
        for (Interpretation i : ctx.interpretations()) {
            Double is = overlap(i.styles(), s.styles());
            Double ic = overlap(i.colors(), s.colors());
            double v = is == null && ic == null ? -1 : ((is == null ? 0 : is) + (ic == null ? 0 : ic)) / ((is == null ? 0 : 1) + (ic == null ? 0 : 1));
            if (v > bestTheme) {
                bestTheme = v;
                best = i.key();
            }
        }
        if (bestTheme >= 0) {
            num += 0.15 * bestTheme;
            den += 0.15;
            parts.put("themeMatch", pct(bestTheme));
            if (bestTheme >= 0.5) {
                reasons.add("theme:" + best);
            }
        }
        Double item = overlap(ctx.items(), s.items());
        if (item != null) {
            num += 0.10 * item;
            den += 0.10;
            parts.put("itemMatch", pct(item));
        }
        // interpretação criativa: tema presente (algum sinal ≥ 0,5) + estilos próprios fora do tema
        if (!ctx.styles().isEmpty() && !s.styles().isEmpty()) {
            Set<String> own = new HashSet<>(s.styles());
            own.removeAll(ctx.styles());
            boolean themed = (style != null && style >= 0.5) || (color != null && color >= 0.5) || bestTheme >= 0.5;
            double creative = themed && !own.isEmpty() ? Math.min(1, own.size() / 2.0) : 0;
            num += 0.05 * creative;
            den += 0.05;
            parts.put("creativeInterpretation", pct(creative));
            if (creative > 0) {
                reasons.add("creative:" + String.join(",", own));
            }
        }
        if (den == 0) {
            return null;
        }
        return new Result((int) Math.round(100 * num / den), parts, bestTheme >= 0.5 ? best : null, reasons);
    }

    static Double overlap(Set<String> a, Set<String> b) {
        if (a == null || b == null || a.isEmpty() || b.isEmpty()) {
            return null;
        }
        Set<String> inter = new HashSet<>(a);
        inter.retainAll(b);
        return inter.size() / (double) Math.min(a.size(), b.size());
    }

    private static Set<String> inter(Set<String> a, Set<String> b) {
        Set<String> inter = new LinkedHashSet<>(a);
        inter.retainAll(b);
        return inter;
    }

    private static int pct(double v) {
        return (int) Math.round(v * 100);
    }

    static Set<String> norm(Collection<String> values) {
        Set<String> out = new LinkedHashSet<>();
        if (values != null) {
            for (String v : values) {
                if (v != null && !v.isBlank()) {
                    out.add(v.trim().toLowerCase(Locale.ROOT));
                }
            }
        }
        return out;
    }
}
