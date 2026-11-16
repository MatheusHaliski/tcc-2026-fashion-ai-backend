package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.PlanStep;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrder;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrderEvent;
import br.com.fashionai.domain.repository.garmentdelivery.GarmentOrderEventRepository;
import br.com.fashionai.domain.repository.garmentdelivery.GarmentOrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Relógio da fábrica aplicado a uma encomenda: sob o lock da linha, grava as etapas do plano que já aconteceram e ainda
 * não têm evento (único por encomenda e etapa) e avisa a dona na expedição e na entrega. Chamado ao ler a encomenda e
 * pela varredura agendada; repetir não grava nem avisa de novo.
 */
@Component
public class GarmentOrderProgress {
    private static final Set<String> NOTIFIED = Set.of("SHIPPED", "DELIVERED");

    private final GarmentOrderRepository orders;
    private final GarmentOrderEventRepository events;
    private final NotificationService notifications;
    private final Clock clock;

    @Autowired
    public GarmentOrderProgress(GarmentOrderRepository orders, GarmentOrderEventRepository events, NotificationService notifications) {
        this(orders, events, notifications, Clock.systemUTC());
    }

    GarmentOrderProgress(GarmentOrderRepository orders, GarmentOrderEventRepository events, NotificationService notifications, Clock clock) {
        this.orders = orders;
        this.events = events;
        this.notifications = notifications;
        this.clock = clock;
    }

    /** A encomenda precisa chegar já travada pelo chamador ({@code lockById}). Devolve todos os eventos, em ordem. */
    List<GarmentOrderEvent> materialize(GarmentOrder order, Instant now) {
        List<PlanStep> plan = GarmentOrderViews.plan(order);
        List<GarmentOrderEvent> rows = new ArrayList<>(events.findByOrderIdOrderByOccurredAtAsc(order.getId()));
        Set<String> seen = rows.stream().map(GarmentOrderEvent::getStage).collect(Collectors.toSet());
        Instant limit = order.getCancelledAt() != null ? order.getCancelledAt() : now;
        for (PlanStep step : plan) {
            if (step.at().isAfter(limit) || seen.contains(step.stage())) {
                continue;
            }
            rows.add(events.save(new GarmentOrderEvent(order.getId(), step.stage(), step.at())));
            if (NOTIFIED.contains(step.stage()) && order.getReceivedAt() == null) {
                notifyOwner(order, step.stage());
            }
        }
        String status = FactoryPlanRules.status(plan, now, order.getCancelledAt(), order.getReceivedAt());
        if (!status.equals(order.getStatus())) {
            orders.markStatus(order.getId(), status);
        }
        rows.sort(Comparator.comparing(GarmentOrderEvent::getOccurredAt));
        return rows;
    }

    /** A próxima etapa do plano já chegou e a encomenda ainda está em andamento (a varredura só trava quem precisa). */
    boolean due(GarmentOrder order, Instant now) {
        if (order.getCancelledAt() != null || order.getReceivedAt() != null) {
            return false;
        }
        List<PlanStep> plan = GarmentOrderViews.plan(order);
        int next = FactoryPlanRules.index(order.getStatus()) + 1;
        return next < plan.size() && !plan.get(next).at().isAfter(now);
    }

    /** Uma encomenda por transação (varredura). */
    @Transactional
    public void advance(UUID orderId) {
        orders.lockById(orderId).ifPresent(order -> materialize(order, clock.instant()));
    }

    private void notifyOwner(GarmentOrder order, String stage) {
        boolean shipped = "SHIPPED".equals(stage);
        notifications.notify(order.getOwnerId(), null, NotificationType.GARMENT_DELIVERY, "GARMENT_ORDER", order.getId(),
                Msg.k(shipped ? "garmentDelivery.notif.expedida.titulo" : "garmentDelivery.notif.entregue.titulo"),
                shipped ? Msg.k("garmentDelivery.notif.expedida.corpo", order.getTrackingCode())
                        : Msg.k("garmentDelivery.notif.entregue.corpo", order.getProjectTitle()),
                Map.of("href", "/atelier/orders/" + order.getId()));
    }
}
