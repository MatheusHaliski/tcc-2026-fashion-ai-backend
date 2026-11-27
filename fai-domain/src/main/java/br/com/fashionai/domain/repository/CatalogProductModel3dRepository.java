package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.CatalogProductModel3d;
import br.com.fashionai.domain.model.enums.CatalogModelStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CatalogProductModel3dRepository extends JpaRepository<CatalogProductModel3d, UUID> {
    List<CatalogProductModel3d> findByCatalogProductIdInAndStatus(Collection<UUID> catalogProductIds, CatalogModelStatus status);
}
