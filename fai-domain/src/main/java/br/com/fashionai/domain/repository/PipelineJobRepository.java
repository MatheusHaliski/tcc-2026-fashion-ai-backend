package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
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
    List<PipelineJob> findTop50ByUserIdOrderByCreatedAtDesc(UUID userId);

    List<PipelineJob> findByStatusOrderByQueuedAtAsc(PipelineJobStatus status);

    List<PipelineJob> findByTypeAndInputResourceIdOrderByCreatedAtDesc(PipelineJobType type, UUID inputResourceId);

    List<PipelineJob> findByTypeAndFinishedAtBetween(PipelineJobType type, Instant from, Instant to);

    List<PipelineJob> findTop200ByOrderByCreatedAtDesc();
}
