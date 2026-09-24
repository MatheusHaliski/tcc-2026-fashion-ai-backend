package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de FlairTrophy. */
public interface FlairTrophyRepository extends JpaRepository<FlairTrophy, UUID> {
    List<FlairTrophy> findByUserIdOrderByCreatedAtDesc(UUID userId);

    boolean existsByUserIdAndModeAndTitleAndSeasonKey(UUID userId, String mode, String title, String seasonKey);
}
