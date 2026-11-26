package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.PlanStep;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Relógio da Fábrica FashionAI (docs/garment-delivery §6.6): o plano é calculado uma vez, na criação, por regras puras
 * (linha de produção, tecido, complexidade e região); o estado é o da última etapa cujo instante já passou. Padrão:
 * horas úteis (seg–sex, 9h–18h, horário de Brasília). Demonstração: o ciclo inteiro em 180 segundos.
 */
final class FactoryPlanRules {
    private FactoryPlanRules() {
    }

    static final List<String> STAGES = List.of("PLACED", "PATTERN", "CUTTING", "SEWING", "FINISHING", "QUALITY_CHECK",
            "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED");
    static final String RECEIVED = "RECEIVED";
    static final String CANCELLED = "CANCELLED";
    static final String STANDARD = "STANDARD";
    static final String DEMO = "DEMO";
    /** Cancelar só antes do corte. */
    static final Set<String> CANCELLABLE = Set.of("PLACED", "PATTERN");
    /** Etapas que ainda geram eventos na varredura. */
    static final Set<String> ACTIVE = Set.of("PLACED", "PATTERN", "CUTTING", "SEWING", "FINISHING", "QUALITY_CHECK", "SHIPPED", "OUT_FOR_DELIVERY");

    static final ZoneId FACTORY_ZONE = ZoneId.of("America/Sao_Paulo");
    private static final LocalTime OPEN = LocalTime.of(9, 0);
    private static final LocalTime CLOSE = LocalTime.of(18, 0);
    private static final int WORKDAY_HOURS = 9;
    private static final int[] DEMO_SECONDS = {0, 15, 40, 65, 95, 120, 140, 160, 180};
    private static final Map<String, Integer> SEWING_HOURS = Map.of("CAM", 9, "CMS", 18, "MAL", 14, "ALF", 36, "CAL", 18, "CUR", 9, "VES", 27);
    private static final Set<String> DELICATE_CUT = Set.of("LEATHER", "SUEDE", "SILK", "SATIN", "VELVET", "CASHMERE");

    static List<PlanStep> plan(Instant placedAt, String speed, String line, String materialCode, String complexity, int transitDays) {
        List<PlanStep> out = new ArrayList<>();
        if (DEMO.equals(speed)) {
            for (int i = 0; i < STAGES.size(); i++) {
                out.add(new PlanStep(STAGES.get(i), placedAt.plusSeconds(DEMO_SECONDS[i])));
            }
            return List.copyOf(out);
        }
        int extra = "HIGH".equals(complexity) ? 9 : "MEDIUM".equals(complexity) ? 4 : 0;
        int[] hours = {
                0,
                3,
                "HIGH".equals(complexity) ? 14 : 9,
                DELICATE_CUT.contains(materialCode) ? 9 : 5,
                SEWING_HOURS.getOrDefault(line, 9) + extra,
                6,
                4,
                Math.max(1, transitDays) * WORKDAY_HOURS,
                4};
        Instant at = placedAt;
        for (int i = 0; i < STAGES.size(); i++) {
            at = i == 0 ? placedAt : addWorkingHours(at, hours[i]);
            out.add(new PlanStep(STAGES.get(i), at));
        }
        return List.copyOf(out);
    }

    /** Soma horas úteis: fora do expediente, a contagem começa na próxima abertura. */
    static Instant addWorkingHours(Instant from, int hours) {
        ZonedDateTime t = open(from.atZone(FACTORY_ZONE));
        Duration remaining = Duration.ofHours(hours);
        while (true) {
            Duration available = Duration.between(t, t.with(CLOSE));
            if (remaining.compareTo(available) <= 0) {
                return t.plus(remaining).toInstant();
            }
            remaining = remaining.minus(available);
            t = open(t.with(CLOSE).plusMinutes(1));
        }
    }

    private static ZonedDateTime open(ZonedDateTime t) {
        ZonedDateTime x = t;
        if (!x.toLocalTime().isBefore(CLOSE)) {
            x = x.plusDays(1).with(OPEN);
        } else if (x.toLocalTime().isBefore(OPEN)) {
            x = x.with(OPEN);
        }
        while (x.getDayOfWeek() == DayOfWeek.SATURDAY || x.getDayOfWeek() == DayOfWeek.SUNDAY) {
            x = x.plusDays(1).with(OPEN);
        }
        return x;
    }

    /** Última etapa do plano cujo instante já chegou. */
    static String stageAt(List<PlanStep> plan, Instant now) {
        String current = STAGES.getFirst();
        for (PlanStep step : plan) {
            if (!step.at().isAfter(now)) {
                current = step.stage();
            }
        }
        return current;
    }

    /** Estado efetivo: cancelada e recebida vêm da ação da pessoa; o resto, do relógio. */
    static String status(List<PlanStep> plan, Instant now, Instant cancelledAt, Instant receivedAt) {
        if (cancelledAt != null) {
            return CANCELLED;
        }
        if (receivedAt != null) {
            return RECEIVED;
        }
        return stageAt(plan, now);
    }

    static Instant at(List<PlanStep> plan, String stage) {
        return plan.stream().filter(s -> s.stage().equals(stage)).map(PlanStep::at).findFirst().orElse(null);
    }

    /** Fração do tempo entre a encomenda e a entrega (cancelada: até o cancelamento; recebida: 1). */
    static double progress(List<PlanStep> plan, Instant now, Instant cancelledAt, Instant receivedAt) {
        if (receivedAt != null) {
            return 1.0;
        }
        Instant start = plan.getFirst().at();
        Instant end = plan.getLast().at();
        Instant point = cancelledAt != null ? cancelledAt : now;
        double total = Math.max(1, Duration.between(start, end).toMillis());
        double done = Duration.between(start, point).toMillis();
        return Math.round(Math.min(1.0, Math.max(0.0, done / total)) * 1000) / 1000.0;
    }

    static int index(String stage) {
        int i = STAGES.indexOf(stage);
        return i >= 0 ? i : RECEIVED.equals(stage) ? STAGES.size() : -1;
    }
}
