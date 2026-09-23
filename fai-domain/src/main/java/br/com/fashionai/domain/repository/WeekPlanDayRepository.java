package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.WeekPlanDay;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WeekPlanDayRepository extends JpaRepository<WeekPlanDay, UUID> {
    List<WeekPlanDay> findByWeekPlanIdOrderByDayDate(UUID weekPlanId);
}
