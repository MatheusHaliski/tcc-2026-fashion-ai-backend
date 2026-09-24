package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de FlairModeState. */
public interface FlairModeStateRepository extends JpaRepository<FlairModeState, UUID> {
    Optional<FlairModeState> findByUserIdAndModeAndSeasonKey(UUID userId, String mode, String seasonKey);

    List<FlairModeState> findByModeAndSeasonKey(String mode, String seasonKey);
}
