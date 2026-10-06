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

/** Repositório Spring Data de CatalogImage (RF47 · catálogo global). */
public interface CatalogImageRepository extends JpaRepository<CatalogImage, UUID> {
    List<CatalogImage> findByProductIdOrderByPrimaryDescCreatedAtAsc(UUID productId);

    List<CatalogImage> findByProductIdInAndPrimaryTrue(Collection<UUID> productIds);

    Optional<CatalogImage> findByProductIdAndImageUrlHash(UUID productId, String hash);

    /**
     * Fila do worker do pipeline de imagens: pendentes, falhas com tentativas restantes, versão antiga do pipeline e
     * DOWNLOADING abandonado (processo caiu no meio) há mais de {@code stale}.
     */
    @Query("select i from CatalogImage i where i.usageStatus <> br.com.fashionai.domain.model.enums.CatalogImageUsage.REJECTED "
            + "and i.attempts < :maxAttempts and (i.processingStatus in ('PENDING', 'FAILED') "
            + "or (i.processingStatus = 'DOWNLOADING' and i.updatedAt < :stale) "
            + "or (i.pipelineVersion is not null and i.pipelineVersion <> :version and i.processingStatus <> 'DOWNLOADING')) "
            + "order by i.attempts asc, i.createdAt asc")
    List<CatalogImage> pipelineQueue(@Param("version") String version, @Param("maxAttempts") int maxAttempts,
                                     @Param("stale") Instant stale, Pageable page);

    /** Mesmo conteúdo já analisado nesta versão (cache por sourceImageHash: outra URL da mesma foto). */
    /** Todas as análises já feitas para os mesmos bytes: quem chama escolhe a de contexto compatível. */
    List<CatalogImage> findBySourceSha256AndPipelineVersionAndProcessingStatusIn(String sha, String version, Collection<String> statuses);

    List<CatalogImage> findByProductIdInAndCanonicalTrue(Collection<UUID> productIds);

    List<CatalogImage> findByReviewStatusOrderByProcessedAtAsc(String reviewStatus, Pageable page);

    long countByProcessingStatus(String status);

    long countByReviewStatus(String status);

    long countByCanonicalTrue();

    @Query("select avg(i.qualityScore) from CatalogImage i where i.qualityScore is not null")
    Double averageQuality();

    @Query("select i.processingStatus, count(i) from CatalogImage i group by i.processingStatus")
    List<Object[]> countByStatus();

    @Query("select i.gateReasons, count(i) from CatalogImage i where i.gateReasons is not null group by i.gateReasons order by count(i) desc")
    List<Object[]> topReasons(Pageable page);
}
