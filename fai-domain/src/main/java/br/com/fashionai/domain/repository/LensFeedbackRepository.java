package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.LensFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** RF54 · Correções feitas nas peças detectadas pelo Lens. */
public interface LensFeedbackRepository extends JpaRepository<LensFeedback, UUID> {
    List<LensFeedback> findByScanId(UUID scanId);

    List<LensFeedback> findByDetectionId(UUID detectionId);
}
