package br.com.fashionai.domain.repository.sourcing;

import br.com.fashionai.domain.model.sourcing.AtelierQuoteRequest;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AtelierQuoteRequestRepository extends JpaRepository<AtelierQuoteRequest, UUID> {
    List<AtelierQuoteRequest> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    List<AtelierQuoteRequest> findBySupplierIdOrderByCreatedAtDesc(UUID supplierId);

    List<AtelierQuoteRequest> findBySupplierIdAndProjectId(UUID supplierId, UUID projectId);

    Optional<AtelierQuoteRequest> findByProjectIdAndRequestedByAndRequestId(UUID projectId, UUID requestedBy, String requestId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from AtelierQuoteRequest r where r.id = :id")
    Optional<AtelierQuoteRequest> lockById(@Param("id") UUID id);
}
