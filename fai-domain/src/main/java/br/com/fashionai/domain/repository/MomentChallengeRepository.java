package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.MomentChallenge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface MomentChallengeRepository extends JpaRepository<MomentChallenge, UUID> {
    List<MomentChallenge> findByMomentIdOrderBySortOrderAsc(UUID momentId);

    List<MomentChallenge> findByMomentIdIn(Collection<UUID> momentIds);

    void deleteByMomentId(UUID momentId);
}
