package br.com.fashionai.application.catalog;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CatalogMatchScorerTest {
    private final CatalogNormalizer n = CatalogNormalizer.get();
    private final CatalogMatchScorer scorer = new CatalogMatchScorer(n);
    private final CatalogMatchScorer.Candidate af1 = new CatalogMatchScorer.Candidate("nike", "shoes_piece", "casual_sneakers",
            "Air Force 1 '07", "Air Force 1", "white", "White/White", null, List.of("AF1", "Air Force One"), List.of("CW2288-111"));
    private final CatalogMatchScorer.Candidate dunk = new CatalogMatchScorer.Candidate("nike", "shoes_piece", "casual_sneakers",
            "Dunk Low Retro", "Dunk Low", "white", "White/Black", null, List.of(), List.of("DD1391-100"));

    private CatalogMatchScorer.Intent q(String brand, String sub, String text, String color) {
        return new CatalogMatchScorer.Intent(brand, sub == null ? null : n.categoryOf(sub), sub, n.tokens(text), color);
    }

    @Test
    void airForceBrancoAchaOAirForce1() {
        CatalogMatchScorer.Intent intent = q("nike", "casual_sneakers", "air force", "white");
        assertThat(scorer.score(intent, af1, null).total()).isGreaterThan(0.9);
        assertThat(scorer.score(intent, af1, null).total()).isGreaterThan(scorer.score(intent, dunk, null).total());
    }

    @Test
    void prefixoEApelidoContam() {
        assertThat(scorer.score(q("nike", null, "air f", null), af1, null).textSimilarity()).isGreaterThan(0.8);
        assertThat(scorer.score(q(null, null, "af1", null), af1, null).textSimilarity()).isEqualTo(1.0);
        assertThat(scorer.score(q(null, null, "air force one", null), af1, null).textSimilarity()).isEqualTo(1.0);
        assertThat(scorer.score(q(null, null, "cw2288111", null), af1, null).textSimilarity()).isEqualTo(1.0);
    }

    @Test
    void erroDeDigitacaoAindaAcha() {
        assertThat(scorer.score(q("nike", null, "forse", null), af1, null).textSimilarity()).isGreaterThanOrEqualTo(0.7);
    }

    @Test
    void outraMarcaPerdeEScoreNaoEhCerteza() {
        CatalogMatchScorer.Candidate other = new CatalogMatchScorer.Candidate("adidas", "shoes_piece", "casual_sneakers",
                "Forum Low", "Forum", "white", "White", null, List.of(), List.of());
        CatalogMatchScorer.Score s = scorer.score(q("nike", "casual_sneakers", "air force", "white"), other, null);
        assertThat(s.brandMatch()).isZero();
        assertThat(s.total()).isLessThan(0.6);
    }
}
