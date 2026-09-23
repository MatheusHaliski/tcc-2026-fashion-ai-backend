package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.PromotionRedemption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PromotionRedemptionRepository extends JpaRepository<PromotionRedemption, UUID> {
    long countByPromotionIdAndUserId(UUID promotionId, UUID userId);

    List<PromotionRedemption> findByUserIdOrderByRedeemedAtDesc(UUID userId);

    List<PromotionRedemption> findByPromotionId(UUID promotionId);

    long countByIssuerUserId(UUID issuerUserId);

    long countByPartnerBrandUserId(UUID partnerBrandUserId);
}
