package br.com.fashionai.domain.repository.store;

import br.com.fashionai.domain.model.store.PhysicalStoreReturnEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PhysicalStoreReturnEventRepository extends JpaRepository<PhysicalStoreReturnEvent, UUID> {
    List<PhysicalStoreReturnEvent> findByCaseIdOrderByCreatedAtAsc(UUID caseId);
}
