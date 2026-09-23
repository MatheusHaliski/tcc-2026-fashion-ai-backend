package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de Promotion (MySQL — fonte da verdade). */
public interface PromotionRepository extends JpaRepository<Promotion, UUID> {
    Optional<Promotion> findByCode(String code);

    List<Promotion> findBySealIdOrderByCreatedAtDesc(UUID sealId);

    List<Promotion> findByOwnerUserIdOrderByCreatedAtDesc(UUID ownerUserId);

    long countByCampaignId(UUID campaignId);

    List<Promotion> findBySealBondId(UUID sealBondId);

    List<Promotion> findByOwnerUserIdAndStatusOrderByCreatedAtDesc(UUID ownerUserId, br.com.fashionai.domain.model.enums.PromotionStatus status);
}
