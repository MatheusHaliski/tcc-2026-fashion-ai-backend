package br.com.fashionai.application.hype;

import br.com.fashionai.application.hype.HypeSnapshotService.Lifetime;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.repository.HypeSignalDailyRepository;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * HypeScore v2 — leitura pura do agregado de sinais para o job: as contagens reais por tipo de sinal (janela atual ×
 * anterior × horizonte) e o histórico anterior ao horizonte ({@link Lifetime}).
 */
final class HypeSignalHistory {
    private HypeSignalHistory() {
    }

    /**
     * Sinais reais de cada entidade por tipo (curtidas, salvos, usos…): eventos na janela atual, na anterior e no
     * horizonte inteiro. É o que a análise completa mostra ao lado das dimensões — números de verdade, não só o score.
     */
    static Map<UUID, Map<String, Map<String, Object>>> signalCounts(List<br.com.fashionai.domain.model.HypeSignalDaily> rows, LocalDate today, int windowDays) {
        Map<UUID, Map<String, Map<String, Object>>> out = new HashMap<>();
        for (br.com.fashionai.domain.model.HypeSignalDaily row : rows) {
            long age = ChronoUnit.DAYS.between(row.getSignalDate(), today);
            Map<String, Object> c = out.computeIfAbsent(row.getEntityId(), k -> new java.util.TreeMap<>())
                    .computeIfAbsent(row.getSignalType().name(), k -> new LinkedHashMap<>(Map.of("current", 0L, "previous", 0L, "total", 0L)));
            long n = row.getEventCount();
            c.put("total", (Long) c.get("total") + n);
            if (age >= 0 && age < windowDays) {
                c.put("current", (Long) c.get("current") + n);
            } else if (age >= windowDays && age < 2L * windowDays) {
                c.put("previous", (Long) c.get("previous") + n);
            }
        }
        return out;
    }

    static Map<UUID, Lifetime> lifetime(List<HypeSignalDailyRepository.SignalTotal> totals, HypeScoreConfig config) {
        Map<UUID, double[]> acc = new HashMap<>();
        for (HypeSignalDailyRepository.SignalTotal t : totals) {
            if (t.getEntityId() == null || t.getSignalType() == null) {
                continue;
            }
            double[] a = acc.computeIfAbsent(t.getEntityId(), k -> new double[3]);
            double events = t.getEvents() == null ? 0 : t.getEvents();
            if (HypeCalculator.isInteraction(t.getSignalType())) {
                double weighted = t.getWeighted() != null ? t.getWeighted().doubleValue() : events;
                a[0] += weighted * config.signalWeight(t.getSignalType());
                a[1] += events;
            } else if (t.getSignalType() == HypeSignalType.LOOK_VIEWED || t.getSignalType() == HypeSignalType.PIECE_VIEWED) {
                a[2] += events;
            }
        }
        Map<UUID, Lifetime> out = new HashMap<>();
        acc.forEach((id, a) -> out.put(id, new Lifetime(a[0], a[1], a[2])));
        return out;
    }
}
