package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de PieceImage (RF4 · captura adaptativa). */
public interface PieceImageRepository extends JpaRepository<PieceImage, UUID> {
    List<PieceImage> findBySessionIdOrderByCreatedAtAsc(UUID sessionId);

    List<PieceImage> findByPieceIdOrderByCreatedAtAsc(UUID pieceId);
}
