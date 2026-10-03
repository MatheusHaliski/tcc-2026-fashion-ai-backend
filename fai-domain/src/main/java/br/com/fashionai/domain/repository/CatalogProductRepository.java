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

/** Repositório Spring Data de CatalogProduct (RF47 · catálogo global). */
public interface CatalogProductRepository extends JpaRepository<CatalogProduct, UUID> {
    Optional<CatalogProduct> findByDedupKey(String dedupKey);

    Optional<CatalogProduct> findFirstByGtin(String gtin);

    Optional<CatalogProduct> findFirstByEan(String ean);

    Optional<CatalogProduct> findFirstByUpc(String upc);

    Optional<CatalogProduct> findFirstBySku(String sku);

    Optional<CatalogProduct> findFirstByProductCode(String productCode);

    Optional<CatalogProduct> findFirstByCanonicalUrl(String canonicalUrl);

    List<CatalogProduct> findByBrandIdAndIngestionStatusIn(UUID brandId, Collection<CatalogIngestionStatus> status);

    long countByBrandIdAndIngestionStatusIn(UUID brandId, Collection<CatalogIngestionStatus> status);

    List<CatalogProduct> findByIngestionStatusAndCreatedAtBefore(CatalogIngestionStatus status, Instant before);

    List<CatalogProduct> findTop200BySourceStatusInOrderByLastVerifiedAtAsc(Collection<CatalogSourceStatus> status);

    /** Candidatos pelo índice FULLTEXT (ngram), filtrados por marca/categoria/subcategoria quando informados. */
    @Query(value = "SELECT p.* FROM catalog_products p WHERE p.ingestion_status IN ('VALIDATED','PERSISTABLE','REFERENCE_ONLY') "
            + "AND (:brandId IS NULL OR p.brand_id = :brandId) AND (:category IS NULL OR p.category = :category) "
            + "AND (:subcategory IS NULL OR p.subcategory = :subcategory) "
            + "AND (:terms IS NULL OR MATCH(p.search_text) AGAINST (:terms IN BOOLEAN MODE)) "
            + "ORDER BY p.owners_count DESC LIMIT 200", nativeQuery = true)
    List<CatalogProduct> candidates(@Param("brandId") String brandId, @Param("category") String category,
                                    @Param("subcategory") String subcategory, @Param("terms") String terms);
}
