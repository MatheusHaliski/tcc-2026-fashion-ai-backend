package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.enums.MomentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MomentRepository extends JpaRepository<Moment, UUID> {
    Optional<Moment> findBySlug(String slug);

    List<Moment> findByStatusIn(Collection<MomentStatus> statuses);

    List<Moment> findByIdIn(Collection<UUID> ids);

    List<Moment> findByGroupIdOrderByStartAtDesc(UUID groupId);

    /** Momentos cuja janela toca o intervalo (calendário anual/mensal). */
    List<Moment> findByStatusInAndStartAtLessThanAndEndAtGreaterThan(Collection<MomentStatus> statuses, Instant before, Instant after);

    List<Moment> findByStatusInAndStartAtBetweenOrderByStartAtAsc(Collection<MomentStatus> statuses, Instant from, Instant to);

    List<Moment> findAllByOrderByStartAtDesc();
}
