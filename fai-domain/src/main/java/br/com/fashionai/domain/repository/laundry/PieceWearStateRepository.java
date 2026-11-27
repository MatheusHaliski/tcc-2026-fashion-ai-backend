package br.com.fashionai.domain.repository.laundry;

import br.com.fashionai.domain.model.laundry.PieceWearState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PieceWearStateRepository extends JpaRepository<PieceWearState, UUID> {
    Optional<PieceWearState> findByPieceId(UUID pieceId);

    List<PieceWearState> findByOwnerId(UUID ownerId);

    List<PieceWearState> findByOwnerIdAndState(UUID ownerId, String state);

    List<PieceWearState> findByPieceIdIn(Collection<UUID> pieceIds);

    List<PieceWearState> findByBatchId(UUID batchId);
}
