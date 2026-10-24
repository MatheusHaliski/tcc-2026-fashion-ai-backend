package br.com.fashionai.domain.repository.fit;

import br.com.fashionai.domain.model.fit.FitFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface FitFeedbackRepository extends JpaRepository<FitFeedback, UUID> {
    @org.springframework.data.jpa.repository.Query("select f from FitFeedback f join SizeRecommendation r on f.recommendationId = r.id where f.ownerId = :ownerId and r.ownerId = :ownerId and r.productId = :productId and r.chartRevision = :chartRevision order by f.createdAt desc")
    java.util.List<FitFeedback> findOwnHistory(@org.springframework.data.repository.query.Param("ownerId") UUID ownerId,
        @org.springframework.data.repository.query.Param("productId") UUID productId,
        @org.springframework.data.repository.query.Param("chartRevision") Integer chartRevision, org.springframework.data.domain.Pageable pageable);
    Optional<FitFeedback> findByRecommendationIdAndOwnerIdAndExperienceKey(UUID recommendationId, UUID ownerId, String experienceKey);
    Optional<FitFeedback> findByIdAndOwnerId(UUID id, UUID ownerId);
    java.util.List<FitFeedback> findByRecommendationIdAndOwnerId(UUID recommendationId, UUID ownerId);
    void deleteByOwnerId(UUID ownerId);
}
