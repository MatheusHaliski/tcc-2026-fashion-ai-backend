package br.com.fashionai.domain.repository.laundry;

import br.com.fashionai.domain.model.laundry.PieceWearStateLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PieceWearStateLogRepository extends JpaRepository<PieceWearStateLog, UUID> {
    List<PieceWearStateLog> findTop20ByPieceIdOrderByChangedAtDesc(UUID pieceId);

    List<PieceWearStateLog> findByOwnerId(UUID ownerId);
}
