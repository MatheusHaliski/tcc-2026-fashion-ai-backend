package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de AiReviewItem (RF4 · captura adaptativa). */
public interface AiReviewItemRepository extends JpaRepository<AiReviewItem, UUID> {
    List<AiReviewItem> findByStatusOrderByCreatedAtAsc(AiReviewStatus status);

    List<AiReviewItem> findByCreatedAtAfter(Instant after);

    List<AiReviewItem> findByPieceId(UUID pieceId);

    List<AiReviewItem> findByProductId(UUID productId);

    List<AiReviewItem> findByTargetTypeAndStatusOrderByCreatedAtAsc(String targetType, AiReviewStatus status);
}
