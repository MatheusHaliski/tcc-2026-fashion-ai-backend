package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.LensScan;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    /**
     * Inspirações "Quero": só scans com alguma peça marcada "Quero" e não descartada, filtrados NO BANCO antes de paginar
     * (o total e o "tem mais" contam só esses). {@code saved} nulo = todos; true = salvos; false = não salvos.
     */
    @Query(value = "select s from LensScan s where s.userId = :userId"
            + " and (:saved is null or (:saved = true and s.savedAt is not null) or (:saved = false and s.savedAt is null))"
            + " and exists (select d.id from LensDetection d where d.scanId = s.id and d.wantedAt is not null and d.dismissedAt is null)"
            + " order by s.createdAt desc",
            countQuery = "select count(s) from LensScan s where s.userId = :userId"
                    + " and (:saved is null or (:saved = true and s.savedAt is not null) or (:saved = false and s.savedAt is null))"
                    + " and exists (select d.id from LensDetection d where d.scanId = s.id and d.wantedAt is not null and d.dismissedAt is null)")
    Page<LensScan> findWantedByUserId(@Param("userId") UUID userId, @Param("saved") Boolean saved, Pageable pageable);

    List<LensScan> findByUserId(UUID userId);

    /** Retenção: scans não salvos já vencidos (o job apaga em lotes). */
    List<LensScan> findTop200BySavedAtIsNullAndExpiresAtBefore(Instant now);
}
