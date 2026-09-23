package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.RankingPosition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RankingPositionRepository extends JpaRepository<RankingPosition, UUID> {
    List<RankingPosition> findByUserId(UUID userId);

    void deleteBySegment(String segment);

    List<RankingPosition> findTop20BySegmentOrderByPositionDesc(String segment);
}
