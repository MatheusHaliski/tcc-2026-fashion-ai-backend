package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.FlairChallengeSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface FlairChallengeSubmissionRepository extends JpaRepository<FlairChallengeSubmission, UUID> {
    List<FlairChallengeSubmission> findByChallengeIdAndUserIdOrderByAttemptDesc(UUID challengeId, UUID userId);

    List<FlairChallengeSubmission> findByChallengeIdOrderByCreatedAtDesc(UUID challengeId);

    List<FlairChallengeSubmission> findByUserIdAndChallengeIdIn(UUID userId, Collection<UUID> challengeIds);

    List<FlairChallengeSubmission> findByChallengeIdIn(Collection<UUID> challengeIds);
}
