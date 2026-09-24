package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de FlairTerritory. */
public interface FlairTerritoryRepository extends JpaRepository<FlairTerritory, UUID> {
    List<FlairTerritory> findByMapCode(String mapCode);

    Optional<FlairTerritory> findByMapCodeAndTerritoryCode(String mapCode, String territoryCode);
}
