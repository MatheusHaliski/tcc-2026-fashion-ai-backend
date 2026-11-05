package br.com.fashionai.domain.repository.laundry;

import br.com.fashionai.domain.model.laundry.LaundryBatch;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LaundryBatchRepository extends JpaRepository<LaundryBatch, UUID> {
    List<LaundryBatch> findByOwnerIdOrderByStartedAtDesc(UUID ownerId);

    List<LaundryBatch> findByOwnerIdAndStatusOrderByStartedAtDesc(UUID ownerId, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from LaundryBatch b where b.id = :id")
    Optional<LaundryBatch> lockById(@Param("id") UUID id);
}
