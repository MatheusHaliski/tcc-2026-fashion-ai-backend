package br.com.fashionai.domain.repository.store;

import br.com.fashionai.domain.model.store.PhysicalStoreReturnCase;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PhysicalStoreReturnCaseRepository extends JpaRepository<PhysicalStoreReturnCase, UUID> {
    Optional<PhysicalStoreReturnCase> findByOrderIdAndBuyerIdAndCommandKey(UUID orderId, UUID buyerId, String commandKey);

    List<PhysicalStoreReturnCase> findByOrderIdAndStatusNotIn(UUID orderId, Collection<String> closedStatuses);

    List<PhysicalStoreReturnCase> findByBuyerIdOrderByCreatedAtDesc(UUID buyerId);

    List<PhysicalStoreReturnCase> findBySellerIdOrderByCreatedAtDesc(UUID sellerId);

    List<PhysicalStoreReturnCase> findAllByOrderByCreatedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from PhysicalStoreReturnCase c where c.id = :id")
    Optional<PhysicalStoreReturnCase> lockById(@Param("id") UUID id);
}
