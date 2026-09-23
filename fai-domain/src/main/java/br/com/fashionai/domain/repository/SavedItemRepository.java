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

/** Repositório Spring Data de SavedItem (MySQL — fonte da verdade). */
public interface SavedItemRepository extends JpaRepository<SavedItem, UUID> {
    List<SavedItem> findByUserIdAndTargetTypeOrderBySavedAtDesc(UUID userId, TargetType targetType);

    Optional<SavedItem> findByUserIdAndTargetTypeAndTargetId(UUID userId, TargetType targetType, UUID targetId);

    long countByUserIdAndTargetType(UUID userId, TargetType targetType);

    long countByTargetTypeAndTargetId(TargetType targetType, UUID targetId);

    void deleteByTargetTypeAndTargetId(TargetType targetType, UUID targetId);
}
