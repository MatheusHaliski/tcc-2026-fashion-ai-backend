package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.Piece3dCustomization;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface Piece3dCustomizationRepository extends JpaRepository<Piece3dCustomization, UUID> {
    Optional<Piece3dCustomization> findByPieceIdAndOwnerId(UUID pieceId, UUID ownerId);

    List<Piece3dCustomization> findByOwnerId(UUID ownerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Piece3dCustomization c where c.pieceId = :pieceId and c.ownerId = :ownerId")
    Optional<Piece3dCustomization> lockByPieceIdAndOwnerId(@Param("pieceId") UUID pieceId, @Param("ownerId") UUID ownerId);
}
