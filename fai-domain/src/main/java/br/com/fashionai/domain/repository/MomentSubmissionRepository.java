package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.MomentSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MomentSubmissionRepository extends JpaRepository<MomentSubmission, UUID> {
    Optional<MomentSubmission> findByMomentIdAndSchemeId(UUID momentId, UUID schemeId);

    List<MomentSubmission> findByMomentIdAndWithdrawnFalseOrderBySubmittedAtDesc(UUID momentId);

    List<MomentSubmission> findByMomentIdAndUserIdAndWithdrawnFalse(UUID momentId, UUID userId);

    List<MomentSubmission> findByUserIdAndWithdrawnFalse(UUID userId);

    List<MomentSubmission> findByMomentIdInAndWithdrawnFalse(Collection<UUID> momentIds);

    long countByMomentIdAndWithdrawnFalse(UUID momentId);
}
