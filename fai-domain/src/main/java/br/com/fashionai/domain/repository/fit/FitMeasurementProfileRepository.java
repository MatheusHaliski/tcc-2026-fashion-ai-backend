package br.com.fashionai.domain.repository.fit;

import br.com.fashionai.domain.model.fit.FitMeasurementProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface FitMeasurementProfileRepository extends JpaRepository<FitMeasurementProfile, UUID> {
    void deleteByOwnerId(UUID ownerId);
    Optional<FitMeasurementProfile> findByOwnerId(UUID ownerId);
}
