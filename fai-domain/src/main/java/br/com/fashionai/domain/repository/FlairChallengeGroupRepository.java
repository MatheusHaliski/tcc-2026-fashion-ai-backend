package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.FlairChallengeGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FlairChallengeGroupRepository extends JpaRepository<FlairChallengeGroup, UUID> {
    Optional<FlairChallengeGroup> findByCode(String code);

    List<FlairChallengeGroup> findAllByOrderBySortOrderAsc();
}
