package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.RoomInventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomInventoryItemRepository extends JpaRepository<RoomInventoryItem, UUID> {
    List<RoomInventoryItem> findByUserId(UUID userId);

    boolean existsByUserIdAndSku(UUID userId, String sku);

    long countByUserIdAndSku(UUID userId, String sku);

    List<RoomInventoryItem> findBySku(String sku);
}
