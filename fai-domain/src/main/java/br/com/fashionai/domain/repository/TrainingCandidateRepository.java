package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de TrainingCandidate (RF4 · captura adaptativa). */
public interface TrainingCandidateRepository extends JpaRepository<TrainingCandidate, UUID> {
    List<TrainingCandidate> findByDatasetAndStatusIn(VisionDataset dataset, Collection<TrainingCandidateStatus> status);

    List<TrainingCandidate> findByUserId(UUID userId);
}
