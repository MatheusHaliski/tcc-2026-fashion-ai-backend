package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de FlairMatchEntry. */
public interface FlairMatchEntryRepository extends JpaRepository<FlairMatchEntry, UUID> {
    List<FlairMatchEntry> findByMatchIdOrderBySideAsc(UUID matchId);

    List<FlairMatchEntry> findTop30ByUserIdOrderByCreatedAtDesc(UUID userId);

    List<FlairMatchEntry> findByMatchModeAndMatchPlayDateOrderByScoreDesc(String mode, LocalDate playDate);

    Optional<FlairMatchEntry> findFirstByUserIdAndMatchModeAndMatchPlayDate(UUID userId, String mode, LocalDate playDate);

    List<FlairMatchEntry> findByUserIdAndCreatedAtAfter(UUID userId, Instant since);
}
