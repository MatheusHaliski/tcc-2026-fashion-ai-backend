package br.com.fashionai.domain.repository.sourcing;

import br.com.fashionai.domain.model.sourcing.AtelierProductionRequest;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AtelierProductionRequestRepository extends JpaRepository<AtelierProductionRequest, UUID> {
    List<AtelierProductionRequest> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    List<AtelierProductionRequest> findByProducerIdOrderByCreatedAtDesc(UUID producerId);

    Optional<AtelierProductionRequest> findByProjectIdAndRequestedByAndRequestId(UUID projectId, UUID requestedBy, String requestId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from AtelierProductionRequest r where r.id = :id")
    Optional<AtelierProductionRequest> lockById(@Param("id") UUID id);
}
