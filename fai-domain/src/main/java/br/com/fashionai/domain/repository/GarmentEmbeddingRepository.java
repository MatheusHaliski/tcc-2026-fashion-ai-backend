package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de GarmentEmbedding (RF4 · captura adaptativa). */
public interface GarmentEmbeddingRepository extends JpaRepository<GarmentEmbedding, UUID> {
    List<GarmentEmbedding> findTop5000ByModelVersionAndCategory(String modelVersion, String category);

    List<GarmentEmbedding> findByUserId(UUID userId);

    Optional<GarmentEmbedding> findByImageIdAndModelVersion(UUID imageId, String modelVersion);
}
