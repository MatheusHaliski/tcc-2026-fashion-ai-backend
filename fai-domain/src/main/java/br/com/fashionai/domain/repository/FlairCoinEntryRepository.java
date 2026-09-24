package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de FlairCoinEntry. */
public interface FlairCoinEntryRepository extends JpaRepository<FlairCoinEntry, UUID> {
    boolean existsByUserIdAndReasonAndRef(UUID userId, String reason, String ref);

    List<FlairCoinEntry> findTop30ByUserIdOrderByCreatedAtDesc(UUID userId);

    long countByUserIdAndReasonAndCreatedAtAfter(UUID userId, String reason, Instant since);
}
