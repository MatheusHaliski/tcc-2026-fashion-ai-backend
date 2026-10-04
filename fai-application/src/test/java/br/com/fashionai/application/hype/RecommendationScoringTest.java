package br.com.fashionai.application.hype;

import br.com.fashionai.application.hype.RecommendationScoring.Mode;
import br.com.fashionai.application.hype.RecommendationScoring.Scores;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationScoringTest {
    private final Scores familiar = new Scores(92, 40, 10, 30);
    private final Scores bold = new Scores(35, 70, 95, 60);

    @Test
    void safeModePrioritizesStyleDnaAndExperimentalPrioritizesDistance() {
        assertThat(RecommendationScoring.rankValue(Mode.SAFE, familiar)).isGreaterThan(RecommendationScoring.rankValue(Mode.SAFE, bold));
        assertThat(RecommendationScoring.rankValue(Mode.EXPERIMENTAL, bold)).isGreaterThan(RecommendationScoring.rankValue(Mode.EXPERIMENTAL, familiar));
    }

    @Test
    void hypeIsContextNeverTheMainCriterion() {
        RecommendationScoring.WEIGHTS.values().forEach(w -> {
            double total = w[0] + w[1] + w[2] + w[3];
            assertThat(w[1] / total).isLessThanOrEqualTo(0.20);
        });
        Scores viralButFarFromStyle = new Scores(20, 100, 50, 50);
        Scores onStyleQuiet = new Scores(90, 10, 50, 50);
        assertThat(RecommendationScoring.rankValue(Mode.DISCOVERY, onStyleQuiet)).isGreaterThan(RecommendationScoring.rankValue(Mode.DISCOVERY, viralButFarFromStyle));
    }

    @Test
    void missingDimensionsAreNeutral() {
        assertThat(RecommendationScoring.rankValue(Mode.SAFE, new Scores(null, null, null, null))).isEqualTo(50.0);
    }

    @Test
    void noveltyCountsPairsNeverCombinedBefore() {
        UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID();
        Set<String> seen = Set.of(RecommendationScoring.pair(a, b));
        assertThat(RecommendationScoring.novelty(List.of(a, b, c), seen)).isEqualTo(67);
        assertThat(RecommendationScoring.novelty(List.of(b, a), seen)).isZero();
        assertThat(RecommendationScoring.novelty(List.of(a), seen)).isNull();
    }

    @Test
    void reuseRewardsBringingIdlePiecesBack() {
        assertThat(RecommendationScoring.reuse(List.of(120L, 60L))).isEqualTo(100);
        assertThat(RecommendationScoring.reuse(List.of(0L, 30L))).isEqualTo(25);
        assertThat(RecommendationScoring.reuse(List.of())).isNull();
    }

    @Test
    void modesParseFromPortugueseAndEnglish() {
        assertThat(Mode.parse("seguro")).isEqualTo(Mode.SAFE);
        assertThat(Mode.parse("DESCOBERTA")).isEqualTo(Mode.DISCOVERY);
        assertThat(Mode.parse("experimental")).isEqualTo(Mode.EXPERIMENTAL);
        assertThat(Mode.parse("")).isNull();
        assertThat(Mode.parse("xyz")).isNull();
    }
}
