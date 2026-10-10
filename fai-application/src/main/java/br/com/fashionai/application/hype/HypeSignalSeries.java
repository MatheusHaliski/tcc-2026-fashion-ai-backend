package br.com.fashionai.application.hype;

import br.com.fashionai.domain.model.HypeSignalDaily;
import br.com.fashionai.domain.model.enums.HypeSignalType;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * HypeScore v2 — séries diárias de UMA entidade montadas a partir de {@code hype_signal_daily} (índice 0 = hoje).
 * Puro: recebe as linhas já lidas, sem tocar no banco.
 */
public record HypeSignalSeries(double[] activity, double[] interactions, double[] views, Map<HypeSignalType, double[]> windows,
                               double totalEvents, Integer daysSinceLastActivity) {

    static HypeSignalSeries empty(int horizonDays) {
        return new HypeSignalSeries(new double[horizonDays], new double[horizonDays], new double[horizonDays], new EnumMap<>(HypeSignalType.class), 0, null);
    }

    /** Agrupa as linhas por entidade e monta as séries de cada uma. */
    public static Map<UUID, HypeSignalSeries> build(List<HypeSignalDaily> rows, LocalDate today, HypeScoreConfig config) {
        int horizon = config.horizonDays();
        int w = config.windowDays();
        Map<UUID, double[][]> arrays = new HashMap<>();
        Map<UUID, Map<HypeSignalType, double[]>> windows = new HashMap<>();
        Map<UUID, double[]> totals = new HashMap<>();
        Map<UUID, Integer> lastActive = new HashMap<>();
        for (HypeSignalDaily r : rows) {
            int age = (int) ChronoUnit.DAYS.between(r.getSignalDate(), today);
            if (age < 0 || age >= horizon) {
                continue;
            }
            UUID id = r.getEntityId();
            double[][] a = arrays.computeIfAbsent(id, k -> new double[][]{new double[horizon], new double[horizon], new double[horizon]});
            double weighted = r.getWeightedCount() == null ? r.getEventCount() : r.getWeightedCount().doubleValue();
            double signalWeight = config.signalWeight(r.getSignalType());
            a[0][age] += weighted * signalWeight;
            if (HypeCalculator.isInteraction(r.getSignalType())) {
                a[1][age] += weighted * signalWeight;
            }
            if (r.getSignalType() == HypeSignalType.LOOK_VIEWED || r.getSignalType() == HypeSignalType.PIECE_VIEWED) {
                a[2][age] += r.getEventCount();
            }
            if (age < 2 * w) {
                windows.computeIfAbsent(id, k -> new EnumMap<>(HypeSignalType.class))
                        .computeIfAbsent(r.getSignalType(), k -> new double[2])[age < w ? 0 : 1] += r.getEventCount();
            }
            totals.computeIfAbsent(id, k -> new double[1])[0] += r.getEventCount();
            if (r.getEventCount() > 0) {
                lastActive.merge(id, age, Math::min);
            }
        }
        Map<UUID, HypeSignalSeries> out = new HashMap<>();
        arrays.forEach((id, a) -> out.put(id, new HypeSignalSeries(a[0], a[1], a[2],
                windows.getOrDefault(id, new EnumMap<>(HypeSignalType.class)), totals.get(id)[0], lastActive.get(id))));
        return out;
    }

    /** Soma da atividade ponderada numa janela [from, to) de dias atrás. */
    public double activityBetween(int from, int to) {
        return HypeCalculator.sum(activity, from, to);
    }
}
