package br.com.fashionai.application.hype;

import br.com.fashionai.application.hype.HypeScoreConfig.Dimension;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HypeScoreConfigTest {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();

    @Test
    void levelsFollowTheDocumentedRanges() {
        assertThat(config.level(0)).isEqualTo(HypeLevel.LOW_SIGNAL);
        assertThat(config.level(19)).isEqualTo(HypeLevel.LOW_SIGNAL);
        assertThat(config.level(20)).isEqualTo(HypeLevel.NICHE);
        assertThat(config.level(39)).isEqualTo(HypeLevel.NICHE);
        assertThat(config.level(40)).isEqualTo(HypeLevel.RELEVANT);
        assertThat(config.level(59)).isEqualTo(HypeLevel.RELEVANT);
        assertThat(config.level(60)).isEqualTo(HypeLevel.HOT);
        assertThat(config.level(74)).isEqualTo(HypeLevel.HOT);
        assertThat(config.level(75)).isEqualTo(HypeLevel.TRENDING);
        assertThat(config.level(89)).isEqualTo(HypeLevel.TRENDING);
        assertThat(config.level(90)).isEqualTo(HypeLevel.VIRAL);
        assertThat(config.level(100)).isEqualTo(HypeLevel.VIRAL);
    }

    @Test
    void levelFollowsTheRoundedNumberShownToTheUser() {
        assertThat(config.level(89.6)).isEqualTo(HypeLevel.VIRAL);   // a interface mostra 90
        assertThat(config.level(89.4)).isEqualTo(HypeLevel.TRENDING);
    }

    @Test
    void defaultWeightsMatchTheDocumentedStartingPoint() {
        assertThat(config.weights(HypeEntityType.PIECE)).containsEntry(Dimension.POPULARITY, 0.20).containsEntry(Dimension.NOVELTY, 0.06)
                .doesNotContainKey(Dimension.INFLUENCE);
        assertThat(config.weights(HypeEntityType.SCHEME)).containsEntry(Dimension.INFLUENCE, 0.08);
        double sum = config.weights(HypeEntityType.PIECE).values().stream().mapToDouble(Double::doubleValue).sum();
        assertThat(sum).isCloseTo(1.0, org.assertj.core.data.Offset.offset(1e-9));
        assertThat(config.algorithmVersion()).isEqualTo("HYPE_V2_1");
    }

    @Test
    void invalidPropertiesFallBackInsteadOfBreakingTheBoot() {
        HypeScoreConfig odd = new HypeScoreConfig("HYPE_V9", "popularity=abc,unknown=0.5,trend=0.3", "", "LIKE_CREATED=2,NOPE=1", 7, 12, 7, 30, 3, 3, 20,
                "10,5,1", 2, 7, 24, 7, 0.5, 365);
        assertThat(odd.weights(HypeEntityType.PIECE)).containsOnlyKeys(Dimension.TREND);
        assertThat(odd.signalWeight(HypeSignalType.LIKE_CREATED)).isEqualTo(2.0);
        assertThat(odd.signalWeight(HypeSignalType.SHARE_CREATED)).isZero();
        assertThat(odd.levelThresholds()).containsExactly(20, 40, 60, 75, 90);   // limiares fora de ordem → padrão
        assertThat(odd.algorithmVersion()).isEqualTo("HYPE_V9");
    }

    @Test
    void decayLambdaIsDerivedFromTheHalfLife() {
        assertThat(Math.exp(-config.decayLambda() * 7)).isCloseTo(0.5, org.assertj.core.data.Offset.offset(1e-9));
    }
}
