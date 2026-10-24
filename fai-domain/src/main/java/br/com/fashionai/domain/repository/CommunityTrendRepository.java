package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.CommunityTrend;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface CommunityTrendRepository extends JpaRepository<CommunityTrend, UUID> {
    Page<CommunityTrend> findByStatusAndEndsAtAfter(String status, Instant now, Pageable pageable);
    Page<CommunityTrend> findByStatusAndKindAndEndsAtAfter(String status, String kind, Instant now, Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from CommunityTrend t where t.id = :id")
    Optional<CommunityTrend> lockById(@Param("id") UUID id);
}
