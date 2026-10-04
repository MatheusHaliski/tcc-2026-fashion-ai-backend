package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de CatalogVariant (RF47 · catálogo global). */
public interface CatalogVariantRepository extends JpaRepository<CatalogVariant, UUID> {
    List<CatalogVariant> findByProductIdOrderByVariantKey(UUID productId);

    List<CatalogVariant> findByProductIdIn(Collection<UUID> productIds);

    Optional<CatalogVariant> findFirstByGtinOrSkuOrVariantCode(String gtin, String sku, String variantCode);

    Optional<CatalogVariant> findByProductIdAndVariantKey(UUID productId, String variantKey);
}
