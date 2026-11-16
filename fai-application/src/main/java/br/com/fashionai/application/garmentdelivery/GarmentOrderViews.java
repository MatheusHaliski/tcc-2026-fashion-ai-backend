package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.*;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrder;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrderEvent;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.garmentdelivery.FactoryPlanRules.*;

/**
 * Projeções da encomenda a partir do que está congelado (cotação e plano) e do relógio: estado, progresso, linha do
 * tempo, o que a pessoa pode fazer agora. Rastreio só depois da expedição; medida conferida só depois do controle.
 */
final class GarmentOrderViews {
    private GarmentOrderViews() {
    }

    /** Envelope do plano em plan_json. */
    record Plan(List<PlanStep> steps) {
    }

    static List<PlanStep> plan(GarmentOrder order) {
        Plan plan = Json.read(order.getPlanJson(), Plan.class);
        if (plan == null || plan.steps() == null || plan.steps().isEmpty()) {
            throw new IllegalStateException("Plano da encomenda ilegível: " + order.getId());
        }
        return plan.steps();
    }

    static Frozen frozen(GarmentOrder order) {
        Frozen frozen = Json.read(order.getQuoteJson(), Frozen.class);
        if (frozen == null) {
            throw new IllegalStateException("Cotação da encomenda ilegível: " + order.getId());
        }
        return frozen;
    }

    static OrderSummary summary(GarmentOrder order, Instant now) {
        List<PlanStep> plan = plan(order);
        Frozen frozen = frozen(order);
        return new OrderSummary(order.getId(), status(plan, now, order.getCancelledAt(), order.getReceivedAt()), order.getSpeed(),
                order.getProjectTitle(), order.getSizeLabel(), frozen.garment().imageUrl(), order.getSerialNumber(), order.getPlacedAt(),
                plan.getLast().at(), progress(plan, now, order.getCancelledAt(), order.getReceivedAt()), order.getPriceTotal(), order.getCurrency());
    }

    static OrderDetail detail(GarmentOrder order, List<GarmentOrderEvent> events, List<Designer> designers, Instant now) {
        List<PlanStep> plan = plan(order);
        Frozen frozen = frozen(order);
        String status = status(plan, now, order.getCancelledAt(), order.getReceivedAt());
        String reached = order.getCancelledAt() != null ? stageAt(plan, order.getCancelledAt()) : stageAt(plan, now);
        boolean open = order.getCancelledAt() == null && order.getReceivedAt() == null;
        boolean checked = index(reached) >= index("QUALITY_CHECK");
        List<Measure> measures = frozen.measurements().stream()
                .map(m -> checked ? m : new Measure(m.point(), m.protocol(), m.base(), m.value(), m.tolerance(), null)).toList();
        return new OrderDetail(order.getId(), order.getVersion(), status, order.getSpeed(), now, order.getPlacedAt(), plan.getLast().at(),
                progress(plan, now, order.getCancelledAt(), order.getReceivedAt()), open && CANCELLABLE.contains(reached),
                open && "DELIVERED".equals(reached), order.getSerialNumber(), order.getLotCode(),
                index(reached) >= index("SHIPPED") ? order.getTrackingCode() : null, FactoryIdentifiers.FACTORY_CODE,
                order.getProjectId(), order.getRevisionId(), order.getRevisionNumber(), order.getProjectTitle(), order.getSpecDigest(),
                frozen.garment(), order.getSizeLabel(), frozen.composition(), frozen.care(), measures, frozen.price(), frozen.delivery(),
                designers, timeline(plan, events, order, now), order.getCancelledAt(), order.getReceivedAt(), order.getPieceId(),
                "SIMULATION_NO_CHARGE_NO_PHYSICAL_SHIPMENT");
    }

    /** Uma linha por etapa do plano, mais a confirmação de recebimento ou o cancelamento quando houver. */
    static List<TimelineStep> timeline(List<PlanStep> plan, List<GarmentOrderEvent> events, GarmentOrder order, Instant now) {
        Map<String, Instant> occurred = events.stream()
                .collect(Collectors.toMap(GarmentOrderEvent::getStage, GarmentOrderEvent::getOccurredAt, (a, b) -> a));
        Instant cancelled = order.getCancelledAt();
        String reached = stageAt(plan, cancelled != null ? cancelled : now);
        boolean closed = order.getReceivedAt() != null;
        List<TimelineStep> out = new ArrayList<>();
        for (PlanStep step : plan) {
            int i = index(step.stage());
            String state = cancelled != null && i > index(reached) ? "SKIPPED"
                    : i < index(reached) || (i == index(reached) && (closed || cancelled != null)) ? "DONE"
                    : i == index(reached) ? "CURRENT" : "UPCOMING";
            out.add(new TimelineStep(step.stage(), step.at(), occurred.get(step.stage()), state));
        }
        if (closed) {
            out.add(new TimelineStep(RECEIVED, order.getReceivedAt(), order.getReceivedAt(), "DONE"));
        } else if (cancelled == null) {
            out.add(new TimelineStep(RECEIVED, null, null, "UPCOMING"));
        }
        if (cancelled != null) {
            out.add(new TimelineStep(CANCELLED, cancelled, cancelled, "DONE"));
        }
        return out;
    }

    /** Designers sem nome (o que fica congelado) → com o nome atual de cada conta. */
    static List<Designer> named(List<Designer> designers, Function<UUID, String> username) {
        return designers.stream().map(d -> new Designer(d.userId(), username.apply(d.userId()), d.role())).toList();
    }
}
