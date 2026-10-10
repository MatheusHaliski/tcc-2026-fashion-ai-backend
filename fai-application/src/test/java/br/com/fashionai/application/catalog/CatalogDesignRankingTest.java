package br.com.fashionai.application.catalog;

import org.junit.jupiter.api.Test;

import java.util.Comparator;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** RF47 · Duas camisetas da mesma marca e do mesmo tipo: o texto descritivo da pessoa decide qual é a dela. */
class CatalogDesignRankingTest {
    private final CatalogNormalizer n = CatalogNormalizer.get();
    private final CatalogDesignInterpreter interpreter = CatalogDesignInterpreter.get();
    private final CatalogMatchScorer scorer = new CatalogMatchScorer(n);

    private CatalogMatchScorer.Candidate shirt(String name, String color, String colorName, String description) {
        return new CatalogMatchScorer.Candidate("calvin-klein", "upper_piece", "t_shirt", name, name, color, colorName, null, List.of(), List.of(),
                List.of(), interpreter.ofProduct(name, description, colorName, color), description);
    }

    private final CatalogMatchScorer.Candidate monogram = shirt("Camiseta Monogram Allover", "gray", "Cinza/Preto",
            "Camiseta com o monograma CK estampado em toda a superfície, frente e verso, em cinza e preto.");
    private final CatalogMatchScorer.Candidate central = shirt("Camiseta Logo Central", "blue", "Azul",
            "Camiseta toda azul com um único logo CK branco no centro do peito.");
    private final CatalogMatchScorer.Candidate small = shirt("Camiseta Logo Pequeno", "black", "Preto",
            "Camiseta preta lisa com logo pequeno branco no peito esquerdo.");

    private CatalogMatchScorer.Intent intent(String text) {
        DesignTraits d = interpreter.interpret(text);
        List<String> words = n.tokens(text).stream().filter(t -> !d.consumed().contains(t) && !List.of("calvin", "klein", "ck", "camisa", "camiseta").contains(t)).toList();
        return new CatalogMatchScorer.Intent("calvin-klein", "upper_piece", "shirt", words, null, d);
    }

    private String best(String text) {
        CatalogMatchScorer.Intent q = intent(text);
        return List.of(monogram, central, small).stream()
                .max(Comparator.comparingDouble(c -> scorer.score(q, c, null).total())).orElseThrow().productName();
    }

    @Test
    void monogramaCinzaEPretoEmTodaASuperficie() {
        assertThat(best("camisa calvin klein com o logo ck em toda a superfície, frente e verso, nas cores cinza e preto"))
                .isEqualTo("Camiseta Monogram Allover");
        assertThat(best("camiseta ck monograma cinza")).isEqualTo("Camiseta Monogram Allover");
    }

    @Test
    void todaAzulComUmUnicoLogoCentralBranco() {
        assertThat(best("camisa calvin klein toda azul com um logo ck branco no centro")).isEqualTo("Camiseta Logo Central");
        assertThat(best("camisa ck azul logo branco grande no meio")).isEqualTo("Camiseta Logo Central");
    }

    @Test
    void motivosDoCardDizemOQueBateu() {
        CatalogMatchScorer.Score s = scorer.score(intent("camisa toda azul com um logo ck branco no centro"), central, null);
        assertThat(s.designMatch()).isGreaterThan(0.9);
        assertThat(s.reasons()).extracting(CatalogMatchScorer.Reason::facet).contains("pattern", "placement", "baseColor", "printColor");
        assertThat(s.reasons()).allMatch(CatalogMatchScorer.Reason::ok);
        CatalogMatchScorer.Score wrong = scorer.score(intent("camisa toda azul com um logo ck branco no centro"), monogram, null);
        assertThat(wrong.total()).isLessThan(s.total() - 0.2);
    }
}
