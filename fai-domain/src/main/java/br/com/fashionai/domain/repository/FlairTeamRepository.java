package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de FlairTeam. */
public interface FlairTeamRepository extends JpaRepository<FlairTeam, UUID> {
    Optional<FlairTeam> findByCode(String code);

    List<FlairTeam> findTop20ByOrderByPointsDesc();
}
