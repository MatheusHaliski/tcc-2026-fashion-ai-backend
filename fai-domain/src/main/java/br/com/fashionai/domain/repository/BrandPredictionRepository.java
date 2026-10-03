package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de BrandPrediction (RF4 · captura adaptativa). */
public interface BrandPredictionRepository extends JpaRepository<BrandPrediction, UUID> {
    List<BrandPrediction> findBySessionIdOrderByCreatedAtDesc(UUID sessionId);

    List<BrandPrediction> findByCreatedAtAfter(Instant after);
}
