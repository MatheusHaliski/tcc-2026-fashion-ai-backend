package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MomentParticipationRepository extends JpaRepository<MomentParticipation, UUID> {
    Optional<MomentParticipation> findByMomentIdAndUserId(UUID momentId, UUID userId);

    List<MomentParticipation> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<MomentParticipation> findByMomentId(UUID momentId);

    List<MomentParticipation> findByMomentIdAndStatusIn(UUID momentId, Collection<MomentParticipationStatus> statuses);

    long countByMomentIdAndStatusIn(UUID momentId, Collection<MomentParticipationStatus> statuses);

    List<MomentParticipation> findByMomentIdInAndUserId(Collection<UUID> momentIds, UUID userId);
}
