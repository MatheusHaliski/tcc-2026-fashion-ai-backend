package br.com.fashionai.application.service;

import br.com.fashionai.application.service.InventoryScoreService.Dimension;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.RoomLayout;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.InventoryScoreRules.available;
import static br.com.fashionai.application.service.InventoryScoreRules.pct;
import static br.com.fashionai.application.service.InventoryScoreRubric.NAMES;
import static br.com.fashionai.application.service.InventoryScoreService.REVIEW_DAYS;
import static br.com.fashionai.application.service.InventoryScoreRubric.WEIGHTS;

/** RF34 §3.5 — dimensão Organização (O), lida do Meu Quarto (rótulos e endereços das peças). */
final class InventoryRoomDimension {
    private InventoryRoomDimension() {
    }

    /** O — organização: posição coerente com o tipo, gavetas ocupadas com rótulo e cesto revisado. */
    static void organization(InventoryScoreSheet sheet, RoomService room) {
        UUID userId = sheet.userId;
        List<WardrobeItem> all = sheet.all;
        Map<String, Integer> dims = sheet.dims;
        List<Dimension> explain = sheet.explain;
        RoomLayout layout = room.layout(userId);
        Map<String, String> labels = room.labels(layout);
        Map<String, String> labelSources = room.labelSources(layout);
        Map<UUID, RoomService.Location> where = room.locateAll(userId);
        long coherent = 0, located = 0;
        Set<String> occupiedDrawers = new HashSet<>();
        List<Map<String, Object>> incoherent = new ArrayList<>();
        for (WardrobeItem w : all) {
            RoomService.Location loc = where.get(w.getId());
            if (loc == null) {
                continue;
            }
            located++;
            if (loc.address().zone().equals("drawer")) {
                occupiedDrawers.add(String.valueOf(loc.address().index()));
            }
            if (RoomService.coherent(w, loc.address(), labels)) {
                coherent++;
            } else if (incoherent.size() < 5) {
                incoherent.add(Map.of("pieceId", w.getId(), "name", String.valueOf(w.getName()), "value", loc.label(), "hint", Msg.t("inventoryScore.mova_para_a_posicao_do")));
            }
        }
        double coer = located == 0 ? 1 : (double) coherent / located;
        long labeled = occupiedDrawers.stream().filter(d -> labels.containsKey(d) && !"DEFAULT".equals(labelSources.getOrDefault(d, "DEFAULT"))).count();
        double rot = occupiedDrawers.isEmpty() ? 1 : (double) labeled / occupiedDrawers.size();
        List<WardrobeItem> unavailable = all.stream().filter(w -> !available(w)).toList();
        Instant reviewCut = Instant.now().minus(REVIEW_DAYS, ChronoUnit.DAYS);
        long stale = unavailable.stream().filter(w -> w.getUpdatedAt() != null && w.getUpdatedAt().isBefore(reviewCut)).count();
        double rev = unavailable.isEmpty() ? 1 : 1 - (double) stale / unavailable.size();
        int oVal = (int) Math.round(100 * (0.5 * coer + 0.3 * rot + 0.2 * rev));
        dims.put("O", oVal);
        List<Map<String, Object>> oDown = new ArrayList<>(incoherent);
        if (rot < 1) {
            oDown.add(Map.of("name", Msg.t("inventoryScore.gavetas_sem_rotulo"), "value", (occupiedDrawers.size() - labeled) + " de " + occupiedDrawers.size(),
                    "hint", Msg.t("inventoryScore.renomeie_no_modo_organizar_ou")));
        }
        if (stale > 0) {
            oDown.add(Map.of("name", Msg.t("inventoryScore.cesto_esquecido"), "value", Msg.t("inventoryScore.peca_s_indisponivel_is_ha", (stale)), "hint", Msg.t("inventoryScore.revise_o_cesto")));
        }
        explain.add(new Dimension("O", NAMES.get("O"), oVal, WEIGHTS.get("O"), Msg.t("inventoryScore.das_pecas_estao_numa_posicao", (pct(coer)), pct(rot), pct(rev)), oDown));
    }
}
