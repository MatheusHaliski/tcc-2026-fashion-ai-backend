package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.FlairGameReward;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FlairGameRewardRepository extends JpaRepository<FlairGameReward, UUID> {
    Optional<FlairGameReward> findByUserIdAndChallengeIdAndCode(UUID userId, UUID challengeId, String code);

    List<FlairGameReward> findByUserIdAndChallengeId(UUID userId, UUID challengeId);

    List<FlairGameReward> findByUserIdAndChallengeIdIn(UUID userId, Collection<UUID> challengeIds);
}
