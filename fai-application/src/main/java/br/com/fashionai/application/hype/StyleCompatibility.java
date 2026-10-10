package br.com.fashionai.application.hype;

import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Compatibilidade PESSOAL (0–100) entre uma peça/look e o DNA de estilo de quem está vendo. É deliberadamente separada
 * do HypeScore: uma peça pode ter Hype 94 e compatibilidade 38% — o FashionAI mostra as duas e nunca mistura (o Hype mede
 * relevância no ecossistema; a compatibilidade mede aderência ao seu estilo).
 *
 * <p>Fórmula: 0,5 · estilos + 0,3 · cores + 0,2 · ocasiões, cada termo pelo coeficiente de sobreposição |A∩B| ÷ min(|A|,|B|)
 * (uma peça "casual" combina 100% com um DNA que inclui "casual", em vez de 1/5 no Jaccard). Termos sem dado de um dos
 * lados saem da média; sem DNA, o resultado é nulo ("defina seu DNA").</p>
 */
public final class StyleCompatibility {
    private StyleCompatibility() {
    }

    public record Profile(Set<String> styles, Set<String> colors, Set<String> occasions) {
        public boolean empty() {
            return styles.isEmpty() && colors.isEmpty() && occasions.isEmpty();
        }
    }

    public static Profile profile(Collection<String> styles, Collection<String> colors, Collection<String> occasions) {
        return new Profile(norm(styles), norm(colors), norm(occasions));
    }

    /** @return 0–100 com os termos usados, ou nulo quando não há base de comparação */
    public static Map<String, Object> score(Profile dna, Profile item) {
        if (dna == null || dna.empty() || item == null || item.empty()) {
            return null;
        }
        Map<String, Object> parts = new LinkedHashMap<>();
        double num = 0, den = 0;
        Double s = overlap(dna.styles(), item.styles());
        if (s != null) {
            num += 0.5 * s;
            den += 0.5;
            parts.put("styles", Math.round(s * 100));
        }
        Double c = overlap(dna.colors(), item.colors());
        if (c != null) {
            num += 0.3 * c;
            den += 0.3;
            parts.put("colors", Math.round(c * 100));
        }
        Double o = overlap(dna.occasions(), item.occasions());
        if (o != null) {
            num += 0.2 * o;
            den += 0.2;
            parts.put("occasions", Math.round(o * 100));
        }
        if (den == 0) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("score", Math.round(100 * num / den));
        out.put("parts", parts);
        return out;
    }

    static Double overlap(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) {
            return null;
        }
        Set<String> inter = new HashSet<>(a);
        inter.retainAll(b);
        return (double) inter.size() / Math.min(a.size(), b.size());
    }

    private static Set<String> norm(Collection<String> values) {
        if (values == null) {
            return Set.of();
        }
        return values.stream().filter(v -> v != null && !v.isBlank()).map(v -> v.trim().toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
    }
}
