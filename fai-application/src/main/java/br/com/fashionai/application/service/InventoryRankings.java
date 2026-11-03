package br.com.fashionai.application.service;

import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.InventoryScoreService.Result;
import br.com.fashionai.domain.model.InventoryScoreSnapshot;
import br.com.fashionai.domain.model.RankingOptIn;
import br.com.fashionai.domain.model.RankingPosition;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.InventoryScoreSnapshotRepository;
import br.com.fashionai.domain.repository.RankingOptInRepository;
import br.com.fashionai.domain.repository.RankingPositionRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static br.com.fashionai.application.service.InventoryScoreService.CITY_K_ANONYMITY;
import static br.com.fashionai.application.service.InventoryScoreService.band;

/** RF34 §6 (CA08/CA09) — opt-in, posições por segmento com k-anonimato na cidade e o job que as materializa. */
final class InventoryRankings {
    private final RankingOptInRepository optIns;
    private final RankingPositionRepository positions;
    private final InventoryScoreSnapshotRepository snapshots;
    private final UserRepository users;
    private final StyleDnaRepository dnas;

    InventoryRankings(RankingOptInRepository optIns, RankingPositionRepository positions,
                      InventoryScoreSnapshotRepository snapshots, UserRepository users, StyleDnaRepository dnas) {
        this.optIns = optIns;
        this.positions = positions;
        this.snapshots = snapshots;
        this.users = users;
        this.dnas = dnas;
    }

    Map<String, Object> optIn(CurrentUser user, boolean optedIn, boolean shareCity, String city) {
        RankingOptIn o = optIns.findById(user.id()).orElseGet(RankingOptIn::new);
        o.setUserId(user.id());
        o.setOptedIn(optedIn);
        o.setShareCity(optedIn && shareCity);
        o.setCity(optedIn && shareCity ? InputSanitizer.clean(city == null ? "" : city, 80) : null);
        o.setUpdatedAt(Instant.now());
        optIns.save(o);
        if (!optedIn) {
            positions.findByUserId(user.id()).forEach(positions::delete);
        }
        return Map.of("optedIn", o.isOptedIn(), "shareCity", o.isShareCity(), "city", String.valueOf(o.getCity()),
                "note", Msg.t("inventoryScore.sem_opt_in_voce_ve"));
    }

    /** Posições da pessoa por segmento, a partir da nota já calculada. */
    Map<String, Object> rankings(CurrentUser user, Result r) {
        Optional<RankingOptIn> o = optIns.findById(user.id()).filter(RankingOptIn::isOptedIn);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("score", r.score());
        out.put("optedIn", o.isPresent());
        if (o.isEmpty()) {
            out.put("message", Msg.t("inventoryScore.participe_dos_rankings_para_ver"));
            out.put("available", List.of("GLOBAL", "PAIS", "CIDADE", "FAIXA", "ESTILO", "SUSTENTAVEL", "VERSATEIS", "RISING"));
            return out;
        }
        List<Map<String, Object>> rows = positions.findByUserId(user.id()).stream().sorted(Comparator.comparing(RankingPosition::getSegment))
                .map(p -> Map.<String, Object>of("segment", p.getSegment(), "position", p.getPosition(), "total", p.getTotal(),
                        "topPercent", p.getTopPercent(), "value", p.getValue(), "computedAt", p.getComputedAt(),
                        "top", positions.findTop20BySegmentOrderByPositionDesc(p.getSegment()).stream()
                                .sorted(Comparator.comparingInt(RankingPosition::getPosition).reversed())
                                .limit(5).map(t -> Map.of("position", t.getPosition(), "value", t.getValue(),
                                        "user", users.findById(t.getUserId()).map(User::getUsername).orElse("—"))).toList())).toList();
        out.put("positions", rows);
        out.put("note", Msg.t("inventoryScore.colecionadores_mede_completude_de"));
        return out;
    }

    /** Job (§7) — materializa as posições por segmento entre participantes com opt-in. */
    int recomputeRankings() {
        List<RankingOptIn> participants = optIns.findByOptedInTrue();
        record Row(UUID userId, int score, Map<String, Object> dims, String country, String city, String band, String archetype, Integer rising) {
        }
        List<Row> rows = new ArrayList<>();
        LocalDate thirtyAgo = LocalDate.now(FaiPointsService.ZONE).minusDays(30);
        for (RankingOptIn p : participants) {
            List<InventoryScoreSnapshot> latest = snapshots.findTop60ByUserIdAndPeriodTypeOrderByPeriodDateDesc(p.getUserId(), "DAY");
            if (latest.isEmpty() || !latest.get(0).isEligible() || latest.get(0).getScore() == null) {
                continue;
            }
            InventoryScoreSnapshot s = latest.get(0);
            User u = users.findById(p.getUserId()).orElse(null);
            if (u == null) {
                continue;
            }
            Integer rising = latest.stream().filter(x -> !x.getPeriodDate().isAfter(thirtyAgo) && x.getScore() != null).findFirst()
                    .map(x -> s.getScore() - x.getScore()).orElse(null);
            String archetype = dnas.findByUserId(p.getUserId()).map(d -> d.getArchetype().name()).orElse(null);
            rows.add(new Row(p.getUserId(), s.getScore(), Json.map(s.getDimensionsJson()), u.getCountry(), p.isShareCity() ? p.getCity() : null,
                    band(s.getScore()), archetype, rising));
        }
        Map<String, Map<UUID, Double>> segments = new LinkedHashMap<>();
        for (Row row : rows) {
            put(segments, "GLOBAL", row.userId(), row.score());
            if (row.country() != null) {
                put(segments, "PAIS:" + row.country(), row.userId(), row.score());
            }
            if (row.city() != null) {
                put(segments, "CIDADE:" + row.city(), row.userId(), row.score());
            }
            put(segments, "FAIXA:" + row.band(), row.userId(), row.score());
            if (row.archetype() != null) {
                put(segments, "ESTILO:" + row.archetype(), row.userId(), row.score());
            }
            double uVal = num(row.dims().get("U")), rVal = num(row.dims().get("R")), vVal = num(row.dims().get("V"));
            put(segments, "SUSTENTAVEL", row.userId(), 0.5 * uVal + 0.5 * rVal);
            put(segments, "VERSATEIS", row.userId(), vVal);
            if (row.rising() != null) {
                put(segments, "RISING", row.userId(), row.rising());
            }
        }
        int written = 0;
        for (Map.Entry<String, Map<UUID, Double>> seg : segments.entrySet()) {
            if (seg.getKey().startsWith("CIDADE:") && seg.getValue().size() < CITY_K_ANONYMITY) {
                positions.deleteBySegment(seg.getKey());
                continue; // RF34.CA09 — k-anonimato
            }
            positions.deleteBySegment(seg.getKey());
            List<Map.Entry<UUID, Double>> ordered = seg.getValue().entrySet().stream().sorted(Map.Entry.comparingByValue()).toList();
            int total = ordered.size();
            for (int i = 0; i < total; i++) {
                int position = i + 1; // crescente, 1-indexada (§6)
                RankingPosition p = new RankingPosition();
                p.setSegment(seg.getKey());
                p.setUserId(ordered.get(i).getKey());
                p.setPosition(position);
                p.setTotal(total);
                p.setTopPercent(BigDecimal.valueOf(100.0 * (total - position + 1) / total).setScale(2, RoundingMode.HALF_UP));
                p.setValue(BigDecimal.valueOf(ordered.get(i).getValue()).setScale(2, RoundingMode.HALF_UP));
                p.setComputedAt(Instant.now());
                positions.save(p);
                written++;
            }
        }
        return written;
    }

    private static void put(Map<String, Map<UUID, Double>> segments, String key, UUID user, double value) {
        segments.computeIfAbsent(key, k -> new HashMap<>()).put(user, value);
    }

    private static double num(Object o) {
        return o instanceof Number n ? n.doubleValue() : 0;
    }
}
