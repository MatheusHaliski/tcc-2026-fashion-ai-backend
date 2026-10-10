package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.GarmentAsset3d;
import br.com.fashionai.domain.model.enums.GarmentAssetStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface GarmentAsset3dRepository extends JpaRepository<GarmentAsset3d, UUID> {
    List<GarmentAsset3d> findByPieceIdInAndStatus(Collection<UUID> pieceIds, GarmentAssetStatus status);

    List<GarmentAsset3d> findByCatalogProductIdInAndStatus(Collection<UUID> catalogProductIds, GarmentAssetStatus status);

    List<GarmentAsset3d> findByPieceIdOrderByCreatedAtDesc(UUID pieceId);
}
