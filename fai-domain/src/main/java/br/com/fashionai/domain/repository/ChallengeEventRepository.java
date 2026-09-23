package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.ChallengeEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChallengeEventRepository extends JpaRepository<ChallengeEvent, UUID> {
    List<ChallengeEvent> findByInstanceIdAndUserId(UUID instanceId, UUID userId);

    List<ChallengeEvent> findByInstanceId(UUID instanceId);

    boolean existsByInstanceIdAndUserIdAndEvidenceTypeAndRefId(UUID i, UUID u, String e, UUID r);
}
