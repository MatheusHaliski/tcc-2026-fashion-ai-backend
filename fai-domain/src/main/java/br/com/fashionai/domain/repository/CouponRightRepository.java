package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de CouponRight. */
public interface CouponRightRepository extends JpaRepository<CouponRight, UUID> {
    Optional<CouponRight> findByUserIdAndSourceTypeAndSourceId(UUID userId, String sourceType, UUID sourceId);

    List<CouponRight> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, String status);

    List<CouponRight> findByOwnerIdOrderByCreatedAtDesc(UUID ownerId);

    long countByOwnerIdAndStatus(UUID ownerId, String status);

    long countBySourceTypeAndSourceIdAndStatus(String sourceType, UUID sourceId, String status);
}
