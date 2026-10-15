package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.PhysicalStoreOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PhysicalStoreOrderRepository extends JpaRepository<PhysicalStoreOrder, UUID> {
    List<PhysicalStoreOrder> findByBuyerUserIdOrderByCreatedAtDesc(UUID buyerUserId);
    List<PhysicalStoreOrder> findAllByOrderByCreatedAtDesc();
}
