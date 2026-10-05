package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.LensDetection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** RF54 · Peças detectadas nos scans do Lens. */
public interface LensDetectionRepository extends JpaRepository<LensDetection, UUID> {
    List<LensDetection> findByScanIdOrderByOrdinalAsc(UUID scanId);

    List<LensDetection> findByScanIdIn(Collection<UUID> scanIds);

    Optional<LensDetection> findByIdAndScanId(UUID id, UUID scanId);
}
