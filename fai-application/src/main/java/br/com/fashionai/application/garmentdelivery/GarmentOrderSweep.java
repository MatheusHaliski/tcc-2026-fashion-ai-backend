package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.domain.model.garmentdelivery.GarmentOrder;
import br.com.fashionai.domain.repository.garmentdelivery.GarmentOrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Varredura leve do relógio da fábrica: encomendas em andamento cuja próxima etapa já chegou recebem os eventos (e as
 * notificações de expedição e entrega) mesmo sem ninguém abrir a página. Idempotente: o evento é único por etapa.
 */
@Component
public class GarmentOrderSweep {
    private static final Logger log = LoggerFactory.getLogger(GarmentOrderSweep.class);

    private final GarmentOrderRepository orders;
    private final GarmentOrderProgress progress;
    private final boolean enabled;

    public GarmentOrderSweep(GarmentOrderRepository orders, GarmentOrderProgress progress,
                             @Value("${fashionai.garment-delivery.sweep-enabled:true}") boolean enabled) {
        this.orders = orders;
        this.progress = progress;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${fashionai.garment-delivery.sweep-ms:20000}", initialDelayString = "${fashionai.garment-delivery.sweep-initial-ms:30000}")
    public void sweep() {
        if (!enabled) {
            return;
        }
        Instant now = Instant.now();
        int advanced = 0;
        for (GarmentOrder order : orders.findTop200ByStatusInOrderByPlacedAtAsc(FactoryPlanRules.ACTIVE)) {
            try {
                if (progress.due(order, now)) {
                    progress.advance(order.getId());
                    advanced++;
                }
            } catch (RuntimeException ex) {
                log.warn("Garment Delivery: encomenda {} não avançou nesta varredura ({})", order.getId(), ex.toString());
            }
        }
        if (advanced > 0) {
            log.debug("Garment Delivery: {} encomendas avançaram", advanced);
        }
    }
}
