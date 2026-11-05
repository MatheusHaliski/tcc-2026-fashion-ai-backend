package br.com.fashionai.domain.repository.store;

import br.com.fashionai.domain.model.store.PhysicalStoreReturnEvidence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PhysicalStoreReturnEvidenceRepository extends JpaRepository<PhysicalStoreReturnEvidence, UUID> {
    List<PhysicalStoreReturnEvidence> findByCaseIdOrderByCreatedAtAsc(UUID caseId);

    Optional<PhysicalStoreReturnEvidence> findByCaseIdAndUploaderIdAndCommandKey(UUID caseId, UUID uploaderId, String commandKey);

    List<PhysicalStoreReturnEvidence> findByUploaderId(UUID uploaderId);
}
