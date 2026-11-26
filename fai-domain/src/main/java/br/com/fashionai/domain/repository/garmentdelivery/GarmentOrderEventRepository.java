package br.com.fashionai.domain.repository.garmentdelivery;

import br.com.fashionai.domain.model.garmentdelivery.GarmentOrderEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface GarmentOrderEventRepository extends JpaRepository<GarmentOrderEvent, UUID> {
    List<GarmentOrderEvent> findByOrderIdOrderByOccurredAtAsc(UUID orderId);

    @Modifying
    @Query("delete from GarmentOrderEvent e where e.orderId in :orderIds")
    int purgeOrders(@Param("orderIds") Collection<UUID> orderIds);
}
