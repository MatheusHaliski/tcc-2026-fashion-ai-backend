package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.InventoryScoreSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryScoreSnapshotRepository extends JpaRepository<InventoryScoreSnapshot, UUID> {
    Optional<InventoryScoreSnapshot> findByUserIdAndPeriodTypeAndPeriodDate(UUID userId, String type, LocalDate date);

    List<InventoryScoreSnapshot> findTop60ByUserIdAndPeriodTypeOrderByPeriodDateDesc(UUID userId, String type);

    List<InventoryScoreSnapshot> findByPeriodTypeAndPeriodDate(String type, LocalDate date);
}
