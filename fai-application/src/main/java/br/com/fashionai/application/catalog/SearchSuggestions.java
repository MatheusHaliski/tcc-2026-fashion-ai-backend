package br.com.fashionai.application.catalog;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.taxonomy.Taxonomy;

/**
 * Sugestões "Tente:" da busca sem resultado: termos do vocabulário (estilos, ocasiões, cores, subcategorias, marcas)
 * parecidos com o digitado. Nunca o próprio termo, nem pelo código nem pelo nome na tela ("jaqueta" × "jacket").
 */
public final class SearchSuggestions {
    static final double MIN_SIMILARITY = 0.75;

    private SearchSuggestions() {
    }

    public static List<String> similar(String term, Collection<String> vocab) {
        String n = LocalAdvisors.normalize(term);
        return vocab.stream()
                .filter(v -> !LocalAdvisors.normalize(Taxonomy.label(v)).equals(n) && !LocalAdvisors.normalize(v.replace('_', ' ')).equals(n))
                .map(v -> Map.entry(v, LocalAdvisors.jaroWinkler(n, LocalAdvisors.normalize(v.replace('_', ' ')))))
                .filter(e -> e.getValue() >= MIN_SIMILARITY)
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(5)
                .map(Map.Entry::getKey)
                .toList();
    }
}
