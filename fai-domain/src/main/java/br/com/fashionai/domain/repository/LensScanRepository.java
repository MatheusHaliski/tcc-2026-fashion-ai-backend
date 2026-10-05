package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.LensScan;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** RF54 · Scans do FashionAI Lens (sempre filtrados pelo dono). */
public interface LensScanRepository extends JpaRepository<LensScan, UUID> {
    Optional<LensScan> findByIdAndUserId(UUID id, UUID userId);

    Page<LensScan> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<LensScan> findByUserIdAndSavedAtIsNotNullOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<LensScan> findByUserIdAndSavedAtIsNullOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<LensScan> findByUserId(UUID userId);

    /** Retenção: scans não salvos já vencidos (o job apaga em lotes). */
    List<LensScan> findTop200BySavedAtIsNullAndExpiresAtBefore(Instant now);
}
