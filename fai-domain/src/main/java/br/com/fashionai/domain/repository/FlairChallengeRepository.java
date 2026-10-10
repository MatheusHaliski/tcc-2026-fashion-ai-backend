package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.enums.FlairChallengeStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FlairChallengeRepository extends JpaRepository<FlairChallenge, UUID> {
    Optional<FlairChallenge> findBySlug(String slug);

    List<FlairChallenge> findByStatusOrderBySortOrderAsc(FlairChallengeStatus status);

    List<FlairChallenge> findByMomentIdOrderBySortOrderAsc(UUID momentId);

    List<FlairChallenge> findByGroupCode(String groupCode);

    List<FlairChallenge> findAllByOrderBySortOrderAsc();
}
