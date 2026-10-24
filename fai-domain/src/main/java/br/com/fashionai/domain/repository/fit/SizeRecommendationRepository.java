package br.com.fashionai.domain.repository.fit;

import br.com.fashionai.domain.model.fit.SizeRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface SizeRecommendationRepository extends JpaRepository<SizeRecommendation, UUID> {
    void deleteByOwnerId(UUID ownerId);
    Optional<SizeRecommendation> findByIdAndOwnerId(UUID id, UUID ownerId);
    Optional<SizeRecommendation> findByOwnerIdAndRequestKey(UUID ownerId, String requestKey);
}
