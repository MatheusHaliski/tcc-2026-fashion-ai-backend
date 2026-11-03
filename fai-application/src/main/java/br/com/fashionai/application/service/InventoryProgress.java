package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.service.InventoryScoreService.Result;
import br.com.fashionai.domain.model.InventoryScoreSnapshot;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.repository.InventoryScoreSnapshotRepository;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** RF34.CA07/DET-G05 — progresso pessoal: variação no mês, evolução mês a mês e recordes (nunca comparados com outros). */
final class InventoryProgress {
    private final InventoryScoreSnapshotRepository snapshots;
    private final PieceUsageDiaryEntryRepository diary;

    InventoryProgress(InventoryScoreSnapshotRepository snapshots, PieceUsageDiaryEntryRepository diary) {
        this.snapshots = snapshots;
        this.diary = diary;
    }

    Integer monthDelta(UUID userId, Result r) {
        LocalDate prevMonth = LocalDate.now(FaiPointsService.ZONE).withDayOfMonth(1).minusMonths(1);
        return snapshots.findByUserIdAndPeriodTypeAndPeriodDate(userId, "MONTH", prevMonth).map(InventoryScoreSnapshot::getScore)
                .filter(Objects::nonNull).map(s -> r.score() == null ? null : r.score() - s).orElse(null);
    }

    /** RF34.CA07 — evolução: snapshot atual × mês anterior (score, reutilizadas, looks únicos, esquecidas, versatilidade). */
    Map<String, Object> evolution(UUID userId, Result r) {
        LocalDate prevMonth = LocalDate.now(FaiPointsService.ZONE).withDayOfMonth(1).minusMonths(1);
        Optional<InventoryScoreSnapshot> prev = snapshots.findByUserIdAndPeriodTypeAndPeriodDate(userId, "MONTH", prevMonth);
        Map<String, Object> now = new LinkedHashMap<>();
        now.put("score", r.score());
        now.put("rescued", r.metrics().get("rescued"));
        now.put("uniqueLooks", r.metrics().get("uniqueLooks"));
        now.put("forgotten", r.metrics().get("forgotten"));
        now.put("versatility", r.dims().get("V"));
        Map<String, Object> before = new LinkedHashMap<>();
        prev.ifPresent(s -> {
            Map<String, Object> m = Json.map(s.getMetricsJson());
            Map<String, Object> d = Json.map(s.getDimensionsJson());
            before.put("score", s.getScore());
            before.put("rescued", m.get("rescued"));
            before.put("uniqueLooks", m.get("uniqueLooks"));
            before.put("forgotten", m.get("forgotten"));
            before.put("versatility", d.get("V"));
        });
        List<Map<String, Object>> history = snapshots.findTop60ByUserIdAndPeriodTypeOrderByPeriodDateDesc(userId, "DAY").stream()
                .map(s -> Map.<String, Object>of("date", s.getPeriodDate(), "score", s.getScore() == null ? 0 : s.getScore())).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("title", Msg.t("inventoryScore.seu_guarda_roupa_evoluiu_este"));
        out.put("now", now);
        out.put("previousMonth", before.isEmpty() ? null : before);
        out.put("history", history);
        return out;
    }

    /** DET-G05 — recordes pessoais, nunca comparados com outros usuários. */
    Map<String, Object> records(UUID userId, Result r) {
        List<PieceUsageDiaryEntry> entries = diary.findByUserIdAndUsedOnAfter(userId, LocalDate.of(2000, 1, 1));
        Map<LocalDate, String> dailyKeys = new HashMap<>();
        Map<LocalDate, List<UUID>> dailyPieces = new HashMap<>();
        for (PieceUsageDiaryEntry e : entries) {
            if ("DAILY_LOOK".equals(e.getSource())) {
                dailyPieces.computeIfAbsent(e.getUsedOn(), k -> new ArrayList<>()).add(e.getWardrobeItemId());
            }
        }
        dailyPieces.forEach((d, ids) -> dailyKeys.put(d, SchemeService.combinationKey(ids)));
        // sequência sem repetir, com Cabide de Reserva (DET-G06): 1 dia perdido por semana não quebra
        int best = 0, streak = 0, reserveUsedWeek = -1;
        Set<String> inStreak = new HashSet<>();
        LocalDate d = dailyKeys.keySet().stream().min(Comparator.naturalOrder()).orElse(null);
        LocalDate today = LocalDate.now(FaiPointsService.ZONE);
        while (d != null && !d.isAfter(today)) {
            String k = dailyKeys.get(d);
            int week = d.getDayOfYear() / 7 + d.getYear() * 60;
            if (k != null && inStreak.add(k)) {
                streak++;
            } else if (k == null && reserveUsedWeek != week) {
                reserveUsedWeek = week; // cabide de reserva protege o dia
            } else {
                best = Math.max(best, streak);
                streak = 0;
                inStreak.clear();
                if (k != null) {
                    inStreak.add(k);
                    streak = 1;
                }
            }
            d = d.plusDays(1);
        }
        best = Math.max(best, streak);
        Map<LocalDate, Integer> rescuedPerWeek = new HashMap<>();
        entries.stream().filter(e -> e.getNote() != null && e.getNote().startsWith("resgate"))
                .forEach(e -> rescuedPerWeek.merge(e.getUsedOn().with(java.time.DayOfWeek.MONDAY), 1, Integer::sum));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("noRepeatStreak", best);
        out.put("currentStreak", streak);
        out.put("rescuedInAWeek", rescuedPerWeek.values().stream().max(Integer::compare).orElse(0));
        out.put("uniqueLooks", r.metrics().get("uniqueLooks"));
        out.put("note", Msg.t("inventoryScore.recordes_so_seus_nunca_comparados"));
        return out;
    }
}
