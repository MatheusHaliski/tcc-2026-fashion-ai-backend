package br.com.fashionai.domain.repository.sourcing;

import br.com.fashionai.domain.model.sourcing.AtelierBomItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AtelierBomItemRepository extends JpaRepository<AtelierBomItem, UUID> {
    List<AtelierBomItem> findByRevisionIdAndRemovedAtIsNullOrderByCreatedAtAsc(UUID revisionId);

    Optional<AtelierBomItem> findByProjectIdAndAuthorIdAndRequestId(UUID projectId, UUID authorId, String requestId);
}
