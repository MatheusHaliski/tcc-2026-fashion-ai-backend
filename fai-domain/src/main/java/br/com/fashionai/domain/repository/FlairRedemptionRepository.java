package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de FlairRedemption. */
public interface FlairRedemptionRepository extends JpaRepository<FlairRedemption, UUID> {
    Optional<FlairRedemption> findByCombinationIdAndUserId(UUID combinationId, UUID userId);

    List<FlairRedemption> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<FlairRedemption> findByCombinationBrandIdOrderByCreatedAtDesc(UUID brandUserId);

    Optional<FlairRedemption> findByCode(String code);

    boolean existsByCode(String code);
}
