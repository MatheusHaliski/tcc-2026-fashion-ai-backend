package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de FlairProfile. */
public interface FlairProfileRepository extends JpaRepository<FlairProfile, UUID> {
    Optional<FlairProfile> findByUserId(UUID userId);

    List<FlairProfile> findTop20ByOrderByRankPointsDesc();
}
