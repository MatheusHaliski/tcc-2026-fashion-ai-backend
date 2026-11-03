package br.com.fashionai.application.hype;

import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Caracterização do HypeScore (equivalência numérica exata): entradas fixas, geradas com semente, e o retrato de cada
 * resultado (status, score, faixa, dimensões, momento, motivos, sinais e direção) gravado no código original.
 */
class HypeCalculatorGoldenTest {
    private static final HypeSignalType[] SIGNALS = HypeSignalType.values();

    static List<HypeInputs> inputs(HypeScoreConfig config, long seed, int n) {
        Random rnd = new Random(seed);
        int h = config.horizonDays();
        List<HypeInputs> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            double[] activity = new double[h];
            double[] interactions = new double[h];
            double[] views = new double[h];
            int profile = i % 5;   // 0 parado · 1 crescendo · 2 caindo · 3 constante · 4 retorno
            for (int d = 0; d < h; d++) {
                double base = switch (profile) {
                    case 0 -> d > 60 ? rnd.nextInt(3) : 0;
                    case 1 -> Math.max(0, 30 - d) * rnd.nextDouble();
                    case 2 -> d > 7 && d < 30 ? 10 * rnd.nextDouble() : rnd.nextInt(2);
                    case 3 -> 2 + rnd.nextInt(4);
                    default -> d < 5 ? 4 + rnd.nextInt(6) : d > 40 ? rnd.nextInt(2) : 0;
                };
                activity[d] = base;
                interactions[d] = base * rnd.nextDouble();
                views[d] = rnd.nextInt(10) == 0 ? 0 : base * 3 + rnd.nextInt(5);
            }
            Map<HypeSignalType, double[]> windows = new EnumMap<>(HypeSignalType.class);
            for (int k = 0; k < 1 + rnd.nextInt(5); k++) {
                windows.put(SIGNALS[rnd.nextInt(SIGNALS.length)], new double[]{rnd.nextInt(40), rnd.nextInt(30)});
            }
            HypeEntityType type = i % 3 == 0 ? HypeEntityType.SCHEME : HypeEntityType.PIECE;
            out.add(new HypeInputs(type, activity, interactions, views, windows, rnd.nextInt(500), rnd.nextInt(3000),
                    rnd.nextInt(7) == 0 ? rnd.nextInt(3) : rnd.nextInt(400), rnd.nextInt(200),
                    rnd.nextInt(4) == 0 ? null : rnd.nextDouble(), rnd.nextInt(3) == 0 ? null : rnd.nextDouble() * 120 - 50,
                    rnd.nextInt(5) == 0 ? null : rnd.nextDouble() * 8, type == HypeEntityType.SCHEME && rnd.nextBoolean() ? (double) rnd.nextInt(40) : null,
                    rnd.nextInt(6) == 0));
        }
        return out;
    }

    static Map<String, Object> portrait(HypeResult r, String direction) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", r.status());
        m.put("score", r.score());
        m.put("level", r.level());
        m.put("momentum", r.momentum());
        m.put("dimensions", r.dimensions());
        m.put("reasons", r.reasons());
        m.put("signals", r.signals());
        m.put("direction", direction);
        return m;
    }

    String run(HypeScoreConfig config, long seed, int n) {
        HypeCalculator calc = new HypeCalculator(config);
        List<HypeInputs> all = inputs(config, seed, n);
        HypeCalculator.Baseline base = calc.baseline(all.subList(0, n / 2));
        StringBuilder sb = new StringBuilder();
        sb.append("baseline ").append(HypeGolden.canonical(List.of(base.popularity(), base.engagement(), base.meanEngagementRate(),
                base.originality(), base.influence()))).append('\n');
        for (int i = 0; i < all.size(); i++) {
            HypeResult r = calc.compute(all.get(i), i % 4 == 0 ? HypeCalculator.Baseline.empty() : base);
            String dir = r.score() == null ? null : calc.direction(r.score(), i % 2 == 0 ? null : r.score() - 3 + (i % 7));
            sb.append(i).append(' ').append(HypeGolden.canonical(portrait(r, dir))).append('\n');
        }
        return sb.toString();
    }

    @Test
    void scoresIguaisAoRetratoComAConfiguracaoPadrao() throws Exception {
        HypeGolden.assertMatches("calculator-defaults", run(HypeScoreConfig.defaults(), 20261103L, 60));
    }

    @Test
    void scoresIguaisAoRetratoComOutraConfiguracao() throws Exception {
        HypeScoreConfig custom = new HypeScoreConfig("HYPE_TEST", "popularity=0.3,engagement=0.3,trend=0.4", HypeScoreConfig.DEFAULT_LOOK_WEIGHTS,
                "LIKE_CREATED=2,SAVE_CREATED=4", 5, 8, 4, 20, 2, 1.5, 10, "10,30,50,70,85", 3, 5, 12, 3, 0.4, 90);
        HypeGolden.assertMatches("calculator-custom", run(custom, 7L, 40));
    }

    @Test
    void configuracaoIgualAoRetrato() throws Exception {
        StringBuilder sb = new StringBuilder();
        for (HypeScoreConfig c : List.of(HypeScoreConfig.defaults(), new HypeScoreConfig("V", "trend=1,bogus=2,novelty=x", "influence=0.5", "LIKE_CREATED=-1,NOPE=3",
                0, 1, 0, 0, 0, 0, 0, "50,40,30,20,10", -1, 0, 0, -2, 3, 1), new HypeScoreConfig("V", null, null, null, 7, 12, 7, 30, 3, 3, 20, "1,2,x,4,5", 2, 7, 24, 7, 0.5, 365))) {
            sb.append(HypeGolden.canonical(c.describe())).append('\n');
            sb.append(HypeGolden.canonical(List.of(c.weights(HypeEntityType.PIECE), c.weights(HypeEntityType.SCHEME), c.decayLambda(), c.horizonDays(),
                    c.growthSmoothing(), c.engagementPrior(), c.stablePoints(), c.newAccountDays(), c.newAccountWeight(), c.historyMaxDays()))).append('\n');
            for (HypeSignalType t : SIGNALS) {
                sb.append(t).append('=').append(c.signalWeight(t)).append(' ');
            }
            for (int s = -5; s <= 105; s += 1) {
                sb.append(s).append(':').append(c.level(s - 0.5)).append(' ');
            }
            sb.append('\n');
        }
        HypeGolden.assertMatches("config", sb.toString());
    }
}
