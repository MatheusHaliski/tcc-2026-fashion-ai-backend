package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.service.InventoryScoreService.Result;
import br.com.fashionai.domain.model.InventoryScoreSnapshot;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.InventoryScoreSnapshotRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;

/** RF34 §7/§4.3 — snapshot do dia e do mês e as conquistas ligadas ao score. */
final class InventoryScoreRecorder {
    private final InventoryScoreSnapshotRepository snapshots;
    private final AchievementService achievements;

    InventoryScoreRecorder(InventoryScoreSnapshotRepository snapshots, AchievementService achievements) {
        this.snapshots = snapshots;
        this.achievements = achievements;
    }

    void snapshot(Result r, LocalDate today) {
        for (String type : List.of("DAY", "MONTH")) {
            LocalDate key = type.equals("DAY") ? today : today.withDayOfMonth(1);
            InventoryScoreSnapshot s = snapshots.findByUserIdAndPeriodTypeAndPeriodDate(r.userId(), type, key).orElseGet(InventoryScoreSnapshot::new);
            s.setUserId(r.userId());
            s.setPeriodType(type);
            s.setPeriodDate(key);
            s.setScore(r.score());
            s.setEligible(r.eligible());
            s.setDimensionsJson(Json.write(r.dims()));
            Map<String, Object> m = new LinkedHashMap<>();
            for (String k : List.of("pieces", "forgotten", "rescued", "uniqueLooks", "windowLooks", "validCombos", "discoveredCombos", "styleCount")) {
                m.put(k, r.metrics().get(k));
            }
            s.setMetricsJson(Json.write(m));
            s.setComputedAt(Instant.now());
            snapshots.save(s);
        }
    }

    void checkAchievements(Result r, List<WardrobeItem> all, Map<UUID, TreeSet<LocalDate>> usageAll) {
        UUID u = r.userId();
        if (r.dims().getOrDefault("C", 0) >= 95) {
            achievements.grant(u, "CURADOR");
        }
        if (r.score() != null && r.score() >= 900) {
            achievements.grant(u, "SIGNATURE_CLOSET");
        }
        long rescuedLifetime = all.stream().filter(w -> {
            TreeSet<LocalDate> uses = usageAll.getOrDefault(w.getId(), new TreeSet<>());
            LocalDate prev = w.getCreatedAt() == null ? LocalDate.now(FaiPointsService.ZONE) : LocalDate.ofInstant(w.getCreatedAt(), FaiPointsService.ZONE);
            for (LocalDate d : uses) {
                if (ChronoUnit.DAYS.between(prev, d) >= RoomService.FORGOTTEN_DAYS) {
                    return true;
                }
                prev = d;
            }
            return false;
        }).count();
        if (rescuedLifetime >= 10) {
            achievements.grant(u, "SEGUNDA_CHANCE");
        }
        if (((Number) r.metrics().getOrDefault("styleCount", 0)).longValue() >= 10) {
            achievements.grant(u, "CAMALEAO");
        }
        if (((Number) r.metrics().getOrDefault("uniqueLooks", 0)).longValue() >= 50) {
            achievements.grant(u, "STYLIST");
        }
        @SuppressWarnings("unchecked") List<String> topUsed = (List<String>) r.metrics().getOrDefault("topUsed", List.of());
        @SuppressWarnings("unchecked") List<String> rescued = (List<String>) r.metrics().getOrDefault("rescuedIds", List.of());
        if (topUsed.stream().anyMatch(rescued::contains)) {
            achievements.grant(u, "HIDDEN_GEM");
        }
    }
}
