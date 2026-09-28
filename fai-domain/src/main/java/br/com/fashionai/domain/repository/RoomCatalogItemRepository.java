package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.RoomCatalogItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomCatalogItemRepository extends JpaRepository<RoomCatalogItem, String> {
    List<RoomCatalogItem> findByActiveTrueOrderByPricePoints();

    List<RoomCatalogItem> findByCreatorUserIdOrderByCreatedAtDesc(java.util.UUID creatorUserId);

    /** Compra: trava o item (SELECT … FOR UPDATE) até o commit — o estoque de edição limitada é conferido e baixado em fila. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from RoomCatalogItem c where c.sku = :sku")
    Optional<RoomCatalogItem> lockBySku(@Param("sku") String sku);
}
