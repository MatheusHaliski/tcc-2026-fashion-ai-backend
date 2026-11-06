package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.CatalogAccessibilityAttributes;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CatalogAccessibilityAttributesRepository extends JpaRepository<CatalogAccessibilityAttributes, UUID> {
    Optional<CatalogAccessibilityAttributes> findByProductId(UUID productId);

    List<CatalogAccessibilityAttributes> findByProductIdIn(Collection<UUID> productIds);

    List<CatalogAccessibilityAttributes> findByDeclaredBy(UUID declaredBy);

    List<CatalogAccessibilityAttributes> findTop200ByOrderByUpdatedAtDesc();
}
