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
            double total = java.util.Arrays.stream(w).sum();
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
    void usageRewardsPiecesActuallyWorn() {
        assertThat(RecommendationScoring.usage(List.of(8, 16))).isEqualTo(100);
        assertThat(RecommendationScoring.usage(List.of(0, 4))).isEqualTo(25);
        assertThat(RecommendationScoring.usage(List.of())).isNull();
    }

    @Test
    void sustainabilityRewardsOwnedAndLittleWornPieces() {
        // tudo próprio e nunca usado: 0,5·1 + 0,5·1 = 100
        assertThat(RecommendationScoring.sustainability(List.of(0, 0), 2, 2)).isEqualTo(100);
        // metade a comprar e peças muito usadas valem menos
        assertThat(RecommendationScoring.sustainability(List.of(9, 9), 1, 2)).isEqualTo(38);
        assertThat(RecommendationScoring.sustainability(List.of(), 0, 0)).isNull();
    }

    @Test
    void sixDimensionsAllCountAndMissingOnesStayNeutral() {
        Scores sustainable = new Scores(60, 50, 50, 50, 90, 95);
        Scores wasteful = new Scores(60, 50, 50, 50, 10, 5);
        for (Mode m : Mode.values()) {
            assertThat(RecommendationScoring.rankValue(m, sustainable)).isGreaterThan(RecommendationScoring.rankValue(m, wasteful));
        }
        assertThat(new Scores(1, 2, 3, 4).toMap()).containsEntry("usage", null).containsEntry("sustainability", null);
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
