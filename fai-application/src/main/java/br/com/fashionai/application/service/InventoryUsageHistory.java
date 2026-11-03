package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeAvailabilityChange;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.WardrobeAvailabilityChangeRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.InventoryScoreRules.available;
import static br.com.fashionai.application.service.InventoryScoreRules.overlap;

/** RF34 §3.3 — histórico de uso (diário com antifraude) e de exposição (transições de disponibilidade) na janela. */
final class InventoryUsageHistory {
    private final PieceUsageDiaryEntryRepository diary;
    private final WardrobeAvailabilityChangeRepository availability;

    InventoryUsageHistory(PieceUsageDiaryEntryRepository diary, WardrobeAvailabilityChangeRepository availability) {
        this.diary = diary;
        this.availability = availability;
    }

    /** Uso por peça e dia (diário), respeitando o antifraude: esquema com ≥ 2 peças que sobreviveu 24 h. */
    Map<UUID, TreeSet<LocalDate>> usageDays(UUID userId, LocalDate since, Map<UUID, Scheme> schemeById) {
        Map<UUID, TreeSet<LocalDate>> out = new HashMap<>();
        Instant survival = Instant.now().minus(24, ChronoUnit.HOURS);
        for (PieceUsageDiaryEntry e : diary.findByUserIdAndUsedOnAfter(userId, since)) {
            if ("SCHEME".equals(e.getSource()) || "DAILY_LOOK".equals(e.getSource())) {
                Scheme s = e.getSchemeId() == null ? null : schemeById.get(e.getSchemeId());
                if (s == null || s.getCreatedAt() == null || s.getCreatedAt().isAfter(survival)) {
                    continue;
                }
            }
            out.computeIfAbsent(e.getWardrobeItemId(), k -> new TreeSet<>()).add(e.getUsedOn());
        }
        return out;
    }

    /** Dias de exposição (disponível) na janela, a partir do histórico de transições (§3.3). */
    Map<UUID, Long> exposureDays(UUID userId, List<WardrobeItem> all, LocalDate since, LocalDate today) {
        Map<UUID, List<WardrobeAvailabilityChange>> byPiece = availability.findByUserIdOrderByChangedAtAsc(userId).stream()
                .collect(Collectors.groupingBy(WardrobeAvailabilityChange::getWardrobeItemId));
        Map<UUID, Long> out = new HashMap<>();
        Instant start = since.atStartOfDay(FaiPointsService.ZONE).toInstant();
        Instant end = today.plusDays(1).atStartOfDay(FaiPointsService.ZONE).toInstant();
        for (WardrobeItem w : all) {
            List<WardrobeAvailabilityChange> log = byPiece.getOrDefault(w.getId(), List.of());
            Instant cursor = w.getCreatedAt() == null ? start : w.getCreatedAt();
            boolean avail = log.isEmpty() ? available(w) : true; // sem log: estado atual desde o cadastro; com log: começa disponível no cadastro
            long seconds = 0;
            for (WardrobeAvailabilityChange c : log) {
                Instant at = c.getChangedAt();
                if (avail) {
                    seconds += overlap(cursor, at, start, end);
                }
                avail = c.isAvailable();
                cursor = at;
            }
            if (avail) {
                seconds += overlap(cursor, end, start, end);
            }
            out.put(w.getId(), seconds / 86_400);
        }
        return out;
    }
}
