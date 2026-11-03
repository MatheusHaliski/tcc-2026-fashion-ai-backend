package br.com.fashionai.application.service;

import br.com.fashionai.application.service.InventoryScoreService.Dimension;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.Scheme;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

import static br.com.fashionai.application.service.InventoryScoreRules.available;
import static br.com.fashionai.application.service.InventoryScoreRules.daysSince;
import static br.com.fashionai.application.service.InventoryScoreRules.lastUse;
import static br.com.fashionai.application.service.InventoryScoreRules.pairKey;
import static br.com.fashionai.application.service.InventoryScoreRules.pct;
import static br.com.fashionai.application.service.InventoryScoreService.MIN_EXPOSURE_DAYS;
import static br.com.fashionai.application.service.InventoryScoreRubric.NAMES;
import static br.com.fashionai.application.service.InventoryScoreRubric.WEIGHTS;

/** RF34 §3.3/§3.6 — dimensões do uso no tempo: Utilização (U) e Descoberta (R). */
final class InventoryUsageDimensions {
    private InventoryUsageDimensions() {
    }

    /** U — utilização: peças expostas (disponíveis por 7 dias ou mais) usadas na janela. */
    static void utilization(InventoryScoreSheet sheet, InventoryUsageHistory history) {
        UUID userId = sheet.userId;
        List<WardrobeItem> all = sheet.all;
        LocalDate since = sheet.since;
        LocalDate today = sheet.today;
        Map<UUID, TreeSet<LocalDate>> usage = sheet.usage;
        Map<UUID, TreeSet<LocalDate>> usageAll = sheet.usageAll;
        Map<String, Integer> dims = sheet.dims;
        List<Dimension> explain = sheet.explain;
        Map<UUID, Long> exposure = history.exposureDays(userId, all, since, today);
        List<WardrobeItem> exposed = all.stream().filter(w -> exposure.getOrDefault(w.getId(), 0L) >= MIN_EXPOSURE_DAYS).toList();
        long usedInWindow = exposed.stream().filter(w -> usage.containsKey(w.getId())).count();
        int uVal = exposed.isEmpty() ? 0 : (int) Math.round(100.0 * usedInWindow / exposed.size());
        dims.put("U", uVal);
        List<WardrobeItem> forgottenNow = all.stream().filter(w -> available(w))
                .filter(w -> RoomService.forgotten(w, lastUse(w, usageAll), today)).toList();
        explain.add(new Dimension("U", NAMES.get("U"), uVal, WEIGHTS.get("U"), Msg.t("inventoryScore.de_pecas_expostas_disponiveis_por", (usedInWindow), exposed.size(), uVal),
                forgottenNow.stream().sorted(Comparator.comparing(w -> Optional.ofNullable(lastUse(w, usageAll)).orElse(LocalDate.MIN)))
                        .limit(5).map(w -> Map.<String, Object>of("pieceId", w.getId(), "name", String.valueOf(w.getName()),
                                "value", Msg.t("inventoryScore.dias_sem_uso", (daysSince(w, usageAll, today))), "hint", Msg.t("inventoryScore.leve_ao_espelho_ou_a"))).toList()));
        sheet.exposed = exposed;
        sheet.usedInWindow = usedInWindow;
        sheet.forgottenNow = forgottenNow;
    }

    /** R — descoberta: peças esquecidas resgatadas e looks da janela com par inédito. */
    static void discovery(InventoryScoreSheet sheet) {
        List<WardrobeItem> all = sheet.all;
        Map<UUID, TreeSet<LocalDate>> usageAll = sheet.usageAll;
        LocalDate today = sheet.today;
        LocalDate since = sheet.since;
        Instant sinceInstant = sheet.sinceInstant;
        Instant survival = sheet.survival;
        List<Scheme> allSchemes = sheet.allSchemes;
        Map<UUID, List<UUID>> schemePieces = sheet.schemePieces;
        Map<UUID, WardrobeItem> byId = sheet.byId;
        Map<String, Integer> dims = sheet.dims;
        List<Dimension> explain = sheet.explain;
        Set<UUID> f = new HashSet<>();
        Set<UUID> rescued = new HashSet<>();
        Map<UUID, Long> rescueGap = new HashMap<>();
        for (WardrobeItem w : all) {
            TreeSet<LocalDate> uses = usageAll.getOrDefault(w.getId(), new TreeSet<>());
            LocalDate created = w.getCreatedAt() == null ? today : LocalDate.ofInstant(w.getCreatedAt(), FaiPointsService.ZONE);
            LocalDate prev = created;
            boolean forgottenAtStart = false;
            LocalDate lastBeforeStart = uses.floor(since);
            LocalDate refStart = lastBeforeStart != null ? lastBeforeStart : created.isBefore(since) ? created : null;
            if (refStart != null && ChronoUnit.DAYS.between(refStart, since) >= RoomService.FORGOTTEN_DAYS) {
                forgottenAtStart = true;
                f.add(w.getId());
            }
            for (LocalDate u : uses) {
                long gap = ChronoUnit.DAYS.between(prev, u);
                if (gap >= RoomService.FORGOTTEN_DAYS && !u.isBefore(since)) {
                    // ficou esquecida (no início ou durante a janela) e voltou a um look
                    f.add(w.getId());
                    rescued.add(w.getId());
                    rescueGap.merge(w.getId(), gap, Math::max);
                }
                prev = u;
            }
            if (!forgottenAtStart && ChronoUnit.DAYS.between(prev, today) >= RoomService.FORGOTTEN_DAYS && prev.plusDays(RoomService.FORGOTTEN_DAYS).isAfter(since)) {
                f.add(w.getId()); // ficou esquecida durante a janela e ainda não voltou
            }
        }
        double resg = f.isEmpty() ? 1 : (double) rescued.size() / f.size();
        // Inéd: fração dos looks da janela com ao menos um par nunca combinado antes
        List<Scheme> chrono = allSchemes.stream().filter(s -> s.getCreatedAt() != null).sorted(Comparator.comparing(Scheme::getCreatedAt)).toList();
        Set<String> seenPairs = new HashSet<>();
        int novel = 0, windowSchemes = 0;
        for (Scheme s : chrono) {
            List<UUID> ids = schemePieces.getOrDefault(s.getId(), List.of());
            boolean inWindow = ids.size() >= 2 && s.getCreatedAt().isAfter(sinceInstant) && !s.getCreatedAt().isAfter(survival);
            boolean introduced = false;
            for (int i = 0; i < ids.size(); i++) {
                for (int j = i + 1; j < ids.size(); j++) {
                    if (seenPairs.add(pairKey(ids.get(i), ids.get(j)))) {
                        introduced = true;
                    }
                }
            }
            if (inWindow) {
                windowSchemes++;
                if (introduced) {
                    novel++;
                }
            }
        }
        double ined = windowSchemes == 0 ? 0 : (double) novel / windowSchemes;
        int rVal = (int) Math.round(100 * (0.5 * resg + 0.5 * ined));
        dims.put("R", rVal);
        explain.add(new Dimension("R", NAMES.get("R"), rVal, WEIGHTS.get("R"), (f.isEmpty() ? Msg.t("inventoryScore.nenhuma_peca_esquecida_nos_ultimos")
                : Msg.t("inventoryScore.de_pecas_esquecidas_voltaram_a", (rescued.size()), f.size(), pct(resg))) + "; "
                + (windowSchemes == 0 ? Msg.t("inventoryScore.sem_looks_novos_na_janela") : Msg.t("inventoryScore.de_looks_da_janela_trouxeram", (novel), windowSchemes)) + ".",
                f.stream().filter(id -> !rescued.contains(id)).map(byId::get).filter(Objects::nonNull).limit(5)
                        .map(w -> Map.<String, Object>of("pieceId", w.getId(), "name", String.valueOf(w.getName()), "value", Msg.t("inventoryScore.esquecida_ainda_sem_resgate"),
                                "hint", Msg.t("inventoryScore.monte_um_look_com_ela"))).toList()));
        sheet.f = f;
        sheet.rescued = rescued;
        sheet.rescueGap = rescueGap;
    }
}
