package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de CaptureSession (RF4 · captura adaptativa). */
public interface CaptureSessionRepository extends JpaRepository<CaptureSession, UUID> {
    List<CaptureSession> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<CaptureSession> findByDraftJobId(UUID draftJobId);

    List<CaptureSession> findByStatusInAndUpdatedAtBefore(Collection<CaptureSessionStatus> status, Instant before);

    long countByStatus(CaptureSessionStatus status);
}
