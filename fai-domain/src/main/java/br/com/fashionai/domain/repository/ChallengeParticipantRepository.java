package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.ChallengeParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChallengeParticipantRepository extends JpaRepository<ChallengeParticipant, UUID> {
    List<ChallengeParticipant> findByInstanceId(UUID instanceId);

    List<ChallengeParticipant> findByUserIdAndStatusIn(UUID userId, Collection<String> statuses);

    Optional<ChallengeParticipant> findByInstanceIdAndUserId(UUID instanceId, UUID userId);

    List<ChallengeParticipant> findByUserId(UUID userId);
}
