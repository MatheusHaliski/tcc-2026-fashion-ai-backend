package br.com.fashionai.application.laundry;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.WeekPlanDay;
import br.com.fashionai.domain.model.enums.WeekPlanStatus;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.domain.repository.WeekPlanDayRepository;
import br.com.fashionai.domain.repository.WeekPlanRepository;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** CA4 — avisa quando um look planejado (planejador da semana ativo, de hoje em diante) usa peça ainda em lavagem. */
final class LaundryConflicts {
    private final WeekPlanRepository plans;
    private final WeekPlanDayRepository planDays;
    private final WardrobeItemRepository pieces;
    private final Clock clock;

    LaundryConflicts(WeekPlanRepository plans, WeekPlanDayRepository planDays, WardrobeItemRepository pieces, Clock clock) {
        this.plans = plans;
        this.planDays = planDays;
        this.pieces = pieces;
        this.clock = clock;
    }

    List<Map<String, Object>> of(UUID userId, Set<UUID> inWash) {
        if (inWash.isEmpty()) return List.of();
        LocalDate today = LocalDate.now(clock);
        List<Map<String, Object>> out = new ArrayList<>();
        plans.findFirstByUserIdAndStatusOrderByWeekStartDesc(userId, WeekPlanStatus.ACTIVE).ifPresent(plan -> {
            for (WeekPlanDay day : planDays.findByWeekPlanIdOrderByDayDate(plan.getId())) {
                if (day.getDayDate() == null || day.getDayDate().isBefore(today) || day.getPieceIdsJson() == null) continue;
                for (UUID pieceId : Json.uuids(day.getPieceIdsJson())) {
                    if (!inWash.contains(pieceId)) continue;
                    String name = pieces.findById(pieceId).map(WardrobeItem::getName).orElse(null);
                    out.add(LaundryViews.conflict(day.getDayDate(), day.getEventLabel(), pieceId, name));
                }
            }
        });
        return out;
    }
}
