package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de ModelRegistryEntry (RF4 · captura adaptativa). */
public interface ModelRegistryEntryRepository extends JpaRepository<ModelRegistryEntry, UUID> {
    Optional<ModelRegistryEntry> findByNameAndModelVersion(String name, String modelVersion);

    List<ModelRegistryEntry> findAllByOrderByNameAscCreatedAtDesc();

    List<ModelRegistryEntry> findByNameAndDeploymentStatus(String name, ModelDeploymentStatus status);
}
