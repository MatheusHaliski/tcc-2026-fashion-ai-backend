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

/** Repositório Spring Data de SealBond (MySQL — fonte da verdade). */
public interface SealBondRepository extends JpaRepository<SealBond, UUID> {
    List<SealBond> findBySchemeIdOrderByCreatedAtDesc(UUID schemeId);

    List<SealBond> findByTargetOwnerIdAndStatusOrderByCreatedAtAsc(UUID targetOwnerId, SealBondStatus status);

    List<SealBond> findByRequestedByIdAndStatusOrderByCreatedAtDesc(UUID requestedById, SealBondStatus status);

    List<SealBond> findByRequestedByIdOrderByCreatedAtDesc(UUID requestedById);

    List<SealBond> findBySchemeIdAndTargetOwnerIdAndStatusIn(UUID schemeId, UUID targetOwnerId, Collection<SealBondStatus> statuses);

    List<SealBond> findByTargetOwnerIdAndStatusIn(UUID targetOwnerId, Collection<SealBondStatus> statuses);

    List<SealBond> findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(UUID targetOwnerId, SealBondStatus status);

    List<SealBond> findBySchemeId(UUID schemeId);

    java.util.Optional<SealBond> findBySealCode(String sealCode);

    long countByTargetOwnerIdAndStatus(UUID targetOwnerId, SealBondStatus status);

    long countByTargetOwnerId(UUID targetOwnerId);
}
