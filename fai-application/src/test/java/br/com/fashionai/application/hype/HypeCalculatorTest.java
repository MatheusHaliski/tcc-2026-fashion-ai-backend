package br.com.fashionai.application.hype;

import br.com.fashionai.application.hype.HypeCalculator.Baseline;
import br.com.fashionai.application.hype.HypeResult.HypeReason;
import br.com.fashionai.application.hype.HypeScoreConfig.Dimension;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class HypeCalculatorTest {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private final HypeCalculator calc = new HypeCalculator(config);
    private static final int H = 84;

    /** Montador de entradas para os cenários (atividade em "curtidas", índice 0 = hoje). */
    static final class In {
        final double[] activity = new double[H];
        final double[] interactions = new double[H];
        final double[] views = new double[H];
        final Map<HypeSignalType, double[]> windows = new EnumMap<>(HypeSignalType.class);
        HypeEntityType type = HypeEntityType.PIECE;
        double lifetime;
        double lifetimeViews;
        int age = 120;
        Double presence;
        Double cohort;
        Double surprise;
        Double influence;
        boolean limited;

        In likes(int day, double n) {
            activity[day] += n;
            interactions[day] += n;
            windows.computeIfAbsent(HypeSignalType.LIKE_CREATED, k -> new double[2]);
            if (day < 7) {
                windows.get(HypeSignalType.LIKE_CREATED)[0] += n;
            } else if (day < 14) {
                windows.get(HypeSignalType.LIKE_CREATED)[1] += n;
            }
            return this;
        }

        In signal(HypeSignalType t, int day, double n) {
            activity[day] += n;
            windows.computeIfAbsent(t, k -> new double[2]);
            if (day < 7) {
                windows.get(t)[0] += n;
            } else if (day < 14) {
                windows.get(t)[1] += n;
            }
            return this;
        }

        In weekly(double... perWeek) {   // perWeek[0] = semana atual; distribui no 1º dia da semana
            for (int k = 0; k < perWeek.length; k++) {
                likes(k * 7 + 3, perWeek[k]);
            }
            return this;
        }

        In views(double n) {
            for (int d = 0; d < 28; d++) {
                views[d] += n / 28.0;
            }
            return this;
        }

        HypeInputs build() {
            double events = 0;
            for (double v : activity) {
                events += v;
            }
            return new HypeInputs(type, activity, interactions, views, windows, lifetime, lifetimeViews, events, age, presence, cohort, surprise, influence, limited);
        }
    }

    @Test
    void noSignalsMeansInsufficientDataNotZero() {
        HypeResult r = calc.compute(new In().build(), Baseline.empty());
        assertThat(r.status()).isEqualTo(HypeStatus.INSUFFICIENT_DATA);
        assertThat(r.score()).isNull();
        assertThat(r.level()).isNull();
        assertThat(r.reasons()).extracting(HypeReason::code).contains("INSUFFICIENT_DATA");
    }

    @Test
    void scoreIsAlwaysWithinZeroAndOneHundredAndHasALevel() {
        HypeResult r = calc.compute(new In().weekly(5, 5, 5, 5).build(), Baseline.empty());
        assertThat(r.status()).isEqualTo(HypeStatus.AVAILABLE);
        assertThat(r.score()).isBetween(0.0, 100.0);
        assertThat(r.level()).isEqualTo(config.level(r.score()));
    }

    @Test
    void tenThousandOldInteractionsAndTwoThisWeekDoNotMeanHighTrend() {
        In old = new In().likes(3, 2).likes(10, 2);
        old.lifetime = 10_000;
        HypeResult r = calc.compute(old.build(), Baseline.empty());
        assertThat(r.dimensions().get(Dimension.TREND)).isBetween(45.0, 55.0);
        assertThat(r.dimensions().get(Dimension.POPULARITY)).isGreaterThan(90.0);
    }

    @Test
    void trendIsNotPopularity() {
        In popular = new In().weekly(40, 41, 40, 42, 40, 41, 40, 40);
        popular.lifetime = 3000;
        In growing = new In().weekly(30, 6, 2, 1);
        growing.age = 40;
        List<HypeInputs> population = new ArrayList<>();
        population.add(popular.build());
        population.add(growing.build());
        for (int i = 1; i <= 8; i++) {   // comunidade "média": atividade estável e algum histórico
            In f = new In().weekly(i, i, i, i);
            f.lifetime = i * 10;
            population.add(f.build());
        }
        Baseline base = calc.baseline(population);
        HypeResult a = calc.compute(popular.build(), base);
        HypeResult b = calc.compute(growing.build(), base);
        assertThat(a.dimensions().get(Dimension.POPULARITY)).isGreaterThan(b.dimensions().get(Dimension.POPULARITY));
        assertThat(b.dimensions().get(Dimension.TREND)).isGreaterThan(a.dimensions().get(Dimension.TREND));
        assertThat(a.reasons()).extracting(HypeReason::code).contains("POPULAR_NOT_GROWING");
        assertThat(b.reasons()).extracting(HypeReason::code).contains("SMALL_BUT_GROWING");
    }

    @Test
    void acceleratingGrowthRaisesVelocityAndDeceleratingLowersIt() {
        // das semanas mais antigas para as mais novas: +4%, +11%, +28% (acelera) × +28%, +11%, +4% (desacelera)
        HypeResult up = calc.compute(new In().weekly(148, 115, 104, 100).build(), Baseline.empty());
        HypeResult down = calc.compute(new In().weekly(148, 142, 128, 100).build(), Baseline.empty());
        assertThat(up.dimensions().get(Dimension.TREND_VELOCITY)).isGreaterThan(60.0);
        assertThat(down.dimensions().get(Dimension.TREND_VELOCITY)).isLessThan(40.0);
    }

    @Test
    void recentEventsWeighMoreForTrend() {
        HypeResult today = calc.compute(new In().likes(0, 6).likes(9, 3).build(), Baseline.empty());
        HypeResult endOfWindow = calc.compute(new In().likes(6, 6).likes(9, 3).build(), Baseline.empty());
        assertThat(today.dimensions().get(Dimension.TREND)).isGreaterThan(endOfWindow.dimensions().get(Dimension.TREND));
    }

    @Test
    void engagementIsNormalizedByReach() {
        In few = new In().weekly(10, 10).views(200);
        In many = new In().weekly(10, 10).views(20_000);
        List<HypeInputs> pop = new ArrayList<>();
        for (int i = 1; i <= 6; i++) {
            pop.add(new In().weekly(i, i).views(i * 300).build());
        }
        pop.add(few.build());
        pop.add(many.build());
        Baseline base = calc.baseline(pop);
        double eFew = calc.compute(few.build(), base).dimensions().get(Dimension.ENGAGEMENT);
        double eMany = calc.compute(many.build(), base).dimensions().get(Dimension.ENGAGEMENT);
        assertThat(eFew).isGreaterThan(eMany);
    }

    @Test
    void twoInteractionsInTwoViewsDoNotBecomeAPerfectRate() {
        In tiny = new In().likes(1, 2).views(2);
        double rate = calc.smoothedRate(tiny.build(), 0.3);
        assertThat(rate).isLessThan(0.5);
    }

    @Test
    void rarityComesFromFrequencyNeverFromFewInteractions() {
        In unknown = new In().likes(1, 1).likes(2, 1).likes(3, 1);
        assertThat(calc.compute(unknown.build(), Baseline.empty()).dimensions()).doesNotContainKey(Dimension.RARITY);
        In common = new In().likes(1, 3);
        common.presence = 0.5;
        In rare = new In().likes(1, 3);
        rare.presence = 0.01;
        assertThat(calc.compute(rare.build(), Baseline.empty()).dimensions().get(Dimension.RARITY))
                .isGreaterThan(calc.compute(common.build(), Baseline.empty()).dimensions().get(Dimension.RARITY));
        In limited = new In().likes(1, 3);
        limited.presence = 0.5;
        limited.limited = true;
        assertThat(calc.compute(limited.build(), Baseline.empty()).dimensions().get(Dimension.RARITY)).isGreaterThanOrEqualTo(85.0);
    }

    @Test
    void sustainedRelevanceIsAClassicNotATrend() {
        In classic = new In().weekly(10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10);
        classic.age = 400;
        HypeResult r = calc.compute(classic.build(), Baseline.empty());
        assertThat(r.dimensions().get(Dimension.LONGEVITY)).isGreaterThanOrEqualTo(95.0);
        assertThat(r.dimensions().get(Dimension.TREND)).isBetween(40.0, 60.0);
        assertThat(r.momentum()).isEqualTo(HypeMomentum.CLASSIC);
        assertThat(r.reasons()).extracting(HypeReason::code).contains("CLASSIC_PROFILE");
    }

    @Test
    void longevityNeedsTimeAlive() {
        In fresh = new In().weekly(10, 10);
        fresh.age = 10;
        HypeResult r = calc.compute(fresh.build(), Baseline.empty());
        assertThat(r.dimensions().get(Dimension.LONGEVITY)).isLessThan(30.0);
        assertThat(r.dimensions().get(Dimension.NOVELTY)).isGreaterThan(75.0);
    }

    @Test
    void comebackAfterADormantPeriodCountsAsNovelty() {
        In back = new In().likes(1, 3).likes(60, 4);
        back.age = 365;
        HypeResult r = calc.compute(back.build(), Baseline.empty());
        assertThat(r.dimensions().get(Dimension.NOVELTY)).isGreaterThanOrEqualTo(70.0);
        assertThat(r.signals()).containsEntry("revival", true);
    }

    @Test
    void privatePieceWithoutOwnSignalsUsesTheSimilarPiecesTrend() {
        In priv = new In().signal(HypeSignalType.PIECE_USED, 40, 3);
        priv.cohort = 31.0;
        HypeResult r = calc.compute(priv.build(), Baseline.empty());
        assertThat(r.dimensions().get(Dimension.TREND)).isGreaterThan(55.0);
        assertThat(r.reasons()).anySatisfy(x -> {
            assertThat(x.code()).isEqualTo("SIMILAR_GROWTH");
            assertThat(x.value()).isEqualTo(31.0);
        });
    }

    @Test
    void explanationsQuoteTheSignalThatGrew() {
        In saves = new In().signal(HypeSignalType.SAVE_CREATED, 2, 10).signal(HypeSignalType.SAVE_CREATED, 9, 7);
        HypeResult r = calc.compute(saves.build(), Baseline.empty());
        assertThat(r.reasons()).anySatisfy(x -> {
            assertThat(x.code()).isEqualTo("SAVES_GROWTH");
            assertThat(x.value()).isEqualTo(43.0);
        });
    }

    @Test
    void influenceOnlyCountsForLooksThatWereRemixed() {
        In piece = new In().weekly(5, 5);
        piece.influence = 10.0;
        assertThat(calc.compute(piece.build(), Baseline.empty()).dimensions()).doesNotContainKey(Dimension.INFLUENCE);
        In look = new In().weekly(5, 5);
        look.type = HypeEntityType.SCHEME;
        look.influence = 0.0;
        assertThat(calc.compute(look.build(), Baseline.empty()).dimensions()).doesNotContainKey(Dimension.INFLUENCE);
        look.influence = 84.0;
        assertThat(calc.compute(look.build(), Baseline.empty()).dimensions().get(Dimension.INFLUENCE)).isGreaterThan(90.0);
    }

    @Test
    void weightedMeanRenormalizesOverPresentDimensions() {
        Map<Dimension, Double> dims = new EnumMap<>(Dimension.class);
        dims.put(Dimension.POPULARITY, 80.0);
        dims.put(Dimension.TREND, 40.0);
        double s = HypeCalculator.weighted(dims, config.weights(HypeEntityType.PIECE));
        assertThat(s).isCloseTo((0.20 * 80 + 0.18 * 40) / 0.38, within(1e-9));
        assertThat(HypeCalculator.weighted(Map.of(), config.weights(HypeEntityType.PIECE))).isZero();
    }

    @Test
    void zeroScoreIsAValidLowSignalLevel() {
        Map<Dimension, Double> zeros = new EnumMap<>(Dimension.class);
        for (Dimension d : Dimension.values()) {
            zeros.put(d, 0.0);
        }
        assertThat(HypeCalculator.weighted(zeros, config.weights(HypeEntityType.PIECE))).isZero();
        assertThat(config.level(0)).isEqualTo(HypeLevel.LOW_SIGNAL);
    }

    @Test
    void directionUsesTheStableBand() {
        assertThat(calc.direction(82, 68.0)).isEqualTo("UP");
        assertThat(calc.direction(63, 70.0)).isEqualTo("DOWN");
        assertThat(calc.direction(77, 76.0)).isEqualTo("STABLE");
        assertThat(calc.direction(77, null)).isNull();
    }

    @Test
    void percentileUsesMidrankAndSmallPopulationsUseTheAbsoluteCurve() {
        double[] pop = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
        assertThat(HypeCalculator.normalize(10, pop, 1)).isEqualTo(95.0);
        assertThat(HypeCalculator.normalize(0, pop, 1)).isZero();
        assertThat(HypeCalculator.normalize(3, new double[]{1, 2}, 3)).isCloseTo(100 * (1 - Math.exp(-1)), within(1e-9));
    }
}
