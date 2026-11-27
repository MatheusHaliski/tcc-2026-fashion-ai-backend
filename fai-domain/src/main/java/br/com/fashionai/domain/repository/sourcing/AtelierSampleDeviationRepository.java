package br.com.fashionai.domain.repository.sourcing;

import br.com.fashionai.domain.model.sourcing.AtelierSampleDeviation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AtelierSampleDeviationRepository extends JpaRepository<AtelierSampleDeviation, UUID> {
    List<AtelierSampleDeviation> findByProductionRequestIdOrderByCreatedAtAsc(UUID productionRequestId);
}
