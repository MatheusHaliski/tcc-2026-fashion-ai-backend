package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.WeekPlan;
import br.com.fashionai.domain.model.enums.WeekPlanStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WeekPlanRepository extends JpaRepository<WeekPlan, UUID> {
    Optional<WeekPlan> findFirstByUserIdAndStatusOrderByWeekStartDesc(UUID userId, WeekPlanStatus status);

    List<WeekPlan> findByUserIdOrderByWeekStartDesc(UUID userId);
}
