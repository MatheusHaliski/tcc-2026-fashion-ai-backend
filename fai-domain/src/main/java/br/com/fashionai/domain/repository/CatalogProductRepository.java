package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
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

    Optional<CatalogProduct> findFirstByBrandIdAndSubcategoryAndModelNameIgnoreCase(UUID brandId, String subcategory, String modelName);

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

    /**
     * O acervo inteiro, paginado e em ordem estável (nome, id), com filtros opcionais por marca, categoria, subtipo e
     * texto (até três palavras, todas presentes no nome, modelo ou texto de busca): é o que "ver todas as peças" percorre —
     * sem pool, sem corte por pontuação. Cada {@code qN} já vem como padrão LIKE em minúsculas ("%camiseta%").
     */
    @Query(value = "SELECT p.* FROM catalog_products p WHERE p.ingestion_status IN ('VALIDATED','PERSISTABLE','REFERENCE_ONLY') "
            + "AND (:brandId IS NULL OR p.brand_id = :brandId) AND (:category IS NULL OR p.category = :category) "
            + "AND (:subcategory IS NULL OR p.subcategory = :subcategory) "
            + "AND (:q1 IS NULL OR LOWER(p.product_name) LIKE :q1 OR LOWER(p.model_name) LIKE :q1 OR LOWER(p.search_text) LIKE :q1) "
            + "AND (:q2 IS NULL OR LOWER(p.product_name) LIKE :q2 OR LOWER(p.model_name) LIKE :q2 OR LOWER(p.search_text) LIKE :q2) "
            + "AND (:q3 IS NULL OR LOWER(p.product_name) LIKE :q3 OR LOWER(p.model_name) LIKE :q3 OR LOWER(p.search_text) LIKE :q3) "
            + "ORDER BY p.product_name, p.id",
            countQuery = "SELECT COUNT(*) FROM catalog_products p WHERE p.ingestion_status IN ('VALIDATED','PERSISTABLE','REFERENCE_ONLY') "
                    + "AND (:brandId IS NULL OR p.brand_id = :brandId) AND (:category IS NULL OR p.category = :category) "
                    + "AND (:subcategory IS NULL OR p.subcategory = :subcategory) "
                    + "AND (:q1 IS NULL OR LOWER(p.product_name) LIKE :q1 OR LOWER(p.model_name) LIKE :q1 OR LOWER(p.search_text) LIKE :q1) "
                    + "AND (:q2 IS NULL OR LOWER(p.product_name) LIKE :q2 OR LOWER(p.model_name) LIKE :q2 OR LOWER(p.search_text) LIKE :q2) "
                    + "AND (:q3 IS NULL OR LOWER(p.product_name) LIKE :q3 OR LOWER(p.model_name) LIKE :q3 OR LOWER(p.search_text) LIKE :q3)",
            nativeQuery = true)
    Page<CatalogProduct> browse(@Param("brandId") String brandId, @Param("category") String category, @Param("subcategory") String subcategory,
                                @Param("q1") String q1, @Param("q2") String q2, @Param("q3") String q3, Pageable pageable);

    /**
     * Peças visíveis por marca e categoria numa consulta só ({@code [brand_id, category, total]}): a grade de marcas do
     * criador, do Provador e do Explorador sai daqui, sem carregar as peças de cada marca para contar.
     */
    @Query(value = "SELECT p.brand_id, p.category, COUNT(*) FROM catalog_products p "
            + "WHERE p.ingestion_status IN ('VALIDATED','PERSISTABLE','REFERENCE_ONLY') GROUP BY p.brand_id, p.category", nativeQuery = true)
    List<Object[]> visibleCountsByBrandAndCategory();

    /** Quantas peças visíveis há no acervo (o total mostrado nas telas). */
    @Query(value = "SELECT COUNT(*) FROM catalog_products p WHERE p.ingestion_status IN ('VALIDATED','PERSISTABLE','REFERENCE_ONLY')", nativeQuery = true)
    long countVisible();

    /** Candidatos pelo índice FULLTEXT (ngram), filtrados por marca/categoria/subcategoria quando informados. */
    @Query(value = "SELECT p.* FROM catalog_products p WHERE p.ingestion_status IN ('VALIDATED','PERSISTABLE','REFERENCE_ONLY') "
            + "AND (:brandId IS NULL OR p.brand_id = :brandId) AND (:category IS NULL OR p.category = :category) "
            + "AND (:subcategory IS NULL OR p.subcategory = :subcategory) "
            + "AND (:terms IS NULL OR MATCH(p.search_text) AGAINST (:terms IN BOOLEAN MODE)) "
            + "ORDER BY p.owners_count DESC LIMIT 200", nativeQuery = true)
    List<CatalogProduct> candidates(@Param("brandId") String brandId, @Param("category") String category,
                                    @Param("subcategory") String subcategory, @Param("terms") String terms);

    /** Candidatos que têm a cor pedida no produto ou numa variante ("camiseta azul": a que existe em azul). */
    @Query(value = "SELECT p.* FROM catalog_products p WHERE p.ingestion_status IN ('VALIDATED','PERSISTABLE','REFERENCE_ONLY') "
            + "AND (:brandId IS NULL OR p.brand_id = :brandId) AND (:category IS NULL OR p.category = :category) "
            + "AND (:subcategory IS NULL OR p.subcategory = :subcategory) "
            + "AND (p.color = :color OR EXISTS (SELECT 1 FROM catalog_variants v WHERE v.product_id = p.id AND v.color = :color)) "
            + "AND (:terms IS NULL OR MATCH(p.search_text) AGAINST (:terms IN BOOLEAN MODE)) "
            + "ORDER BY p.owners_count DESC LIMIT 200", nativeQuery = true)
    List<CatalogProduct> candidatesWithColor(@Param("brandId") String brandId, @Param("category") String category,
                                             @Param("subcategory") String subcategory, @Param("color") String color,
                                             @Param("terms") String terms);
}
