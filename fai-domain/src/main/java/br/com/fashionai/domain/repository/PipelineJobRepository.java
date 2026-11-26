package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de PipelineJob (MySQL — fonte da verdade). */
public interface PipelineJobRepository extends JpaRepository<PipelineJob, UUID> {
    List<PipelineJob> findTop100ByTypeOrderByQueuedAtDesc(PipelineJobType type);

    List<PipelineJob> findTop20ByTypeAndStatusInOrderByQueuedAtAsc(PipelineJobType type, Collection<PipelineJobStatus> statuses);

    List<PipelineJob> findTop50ByUserIdOrderByCreatedAtDesc(UUID userId);

    List<PipelineJob> findByStatusOrderByQueuedAtAsc(PipelineJobStatus status);

    List<PipelineJob> findByTypeAndInputResourceIdOrderByCreatedAtDesc(PipelineJobType type, UUID inputResourceId);

    List<PipelineJob> findByTypeAndFinishedAtBetween(PipelineJobType type, Instant from, Instant to);

    List<PipelineJob> findTop200ByOrderByCreatedAtDesc();

    /**
     * Rascunho DO DONO travado para escrita: serializa dois "Salvar" simultâneos do mesmo rascunho (idempotência do RF4).
     * A busca é sempre por (id, dono) — a chave única uq_pipeline_jobs_id_user —, então o id de um rascunho de outra
     * pessoa nunca devolve linha.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select j from PipelineJob j where j.id = :id and j.user.id = :userId")
    Optional<PipelineJob> findDraftForUpdate(@Param("id") UUID id, @Param("userId") UUID userId);

    /** Rascunho do dono, sem trava (leitura e nova tentativa de marca). */
    Optional<PipelineJob> findByIdAndUserId(UUID id, UUID userId);
}
