package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.CatalogProduct;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface SavedCatalogProductRepository extends Repository<CatalogProduct, UUID> {
    @Query(value = """
            SELECT p.* FROM saved_catalog_products s JOIN catalog_products p ON p.id = s.product_id
            WHERE s.user_id = :user AND p.ingestion_status IN ('DISCOVERED','VALIDATED','PERSISTABLE','REFERENCE_ONLY')
            """ + CatalogProductVisibility.SAFE_SQL + " ORDER BY s.saved_at DESC, s.product_id DESC", nativeQuery = true)
    Slice<CatalogProduct> saved(@Param("user") String userId, Pageable page);

    @Query(value = "SELECT product_id FROM saved_catalog_products WHERE user_id = :user", nativeQuery = true)
    List<String> ids(@Param("user") String userId);

    @Modifying
    @Query(value = """
            INSERT INTO saved_catalog_products (user_id, product_id, saved_at)
            VALUES (:user, :product, UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE saved_at = saved_at
            """, nativeQuery = true)
    void saveProduct(@Param("user") String userId, @Param("product") String productId);

    @Modifying
    @Query(value = "DELETE FROM saved_catalog_products WHERE user_id = :user AND product_id = :product", nativeQuery = true)
    void removeProduct(@Param("user") String userId, @Param("product") String productId);
}
