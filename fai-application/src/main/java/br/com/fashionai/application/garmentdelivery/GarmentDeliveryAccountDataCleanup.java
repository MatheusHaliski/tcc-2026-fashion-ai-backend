package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.privacy.AccountDataCleanup;
import br.com.fashionai.domain.repository.garmentdelivery.GarmentOrderEventRepository;
import br.com.fashionai.domain.repository.garmentdelivery.GarmentOrderRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Exclusão de conta: as encomendas da pessoa (prefixo do CEP, apelido, cotação, eventos) saem inteiras. A peça recebida
 * e o passaporte seguem a limpeza do guarda-roupa e do passaporte; designers excluídos aparecem como "Conta excluída".
 */
@Component
public class GarmentDeliveryAccountDataCleanup implements AccountDataCleanup {
    private final GarmentOrderRepository orders;
    private final GarmentOrderEventRepository events;

    public GarmentDeliveryAccountDataCleanup(GarmentOrderRepository orders, GarmentOrderEventRepository events) {
        this.orders = orders;
        this.events = events;
    }

    @Override
    @Transactional
    public void purge(UUID userId) {
        // Remoção explícita dos filhos: vale também em bancos de teste sem ON DELETE CASCADE.
        List<UUID> ids = orders.findIdsByOwnerId(userId);
        if (!ids.isEmpty()) {
            events.purgeOrders(ids);
        }
        orders.purgeByOwnerId(userId);
    }
}
