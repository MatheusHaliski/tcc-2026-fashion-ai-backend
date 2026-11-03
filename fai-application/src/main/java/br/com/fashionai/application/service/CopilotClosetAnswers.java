package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.WardrobeItem;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Respostas sobre o próprio acervo: onde está a peça (CA09), peças esquecidas (CA11) e Inventory Score (CA13). */
final class CopilotClosetAnswers extends CopilotTools {
    CopilotClosetAnswers(CopilotContext ctx) {
        super(ctx);
    }

    /** CA09 — "Onde está meu tênis branco?" → endereço e destaque no quarto. */
    Map<String, Object> whereIs(CurrentUser user, String message, String view) {
        List<WardrobeItem> found = searchPieces(user.id(), message);
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        if (found.isEmpty()) {
            out.put("text", Msg.t("copilot.nao_encontrei_essa_peca_no"));
            out.put("actions", List.of(Map.of("type", "ADD_PIECE", "href", "/pieces/new")));
            out.put("chips", List.of());
            return out;
        }
        List<Map<String, Object>> chips = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        for (WardrobeItem w : found) {
            RoomService.Location loc = where.get(w.getId());
            if (loc == null) {
                loc = room.locate(user.id(), w.getId()).orElse(null);
                if (loc != null) {
                    where.put(w.getId(), loc);
                }
            }
            chips.add(chip(w, where));
            if (sb.length() > 0) {
                sb.append(' ');
            }
            sb.append(Msg.t("copilot.sua")).append(w.getName()).append(Msg.t("copilot.esta_em")).append(loc == null ? Msg.t("common.posicao_desconhecida") : loc.label()).append("**.");
            if (!w.isDisponivel()) {
                sb.append(Msg.t("copilot.esta_no_cesto_indisponivel"));
            }
        }
        out.put("text", sb.toString());
        out.put("chips", chips);
        WardrobeItem first = found.get(0);
        RoomService.Location loc = where.get(first.getId());
        if (loc != null) {
            out.put("roomHighlight", Map.of("pieceId", first.getId(), "address", loc.address().toString(), "moduleId", loc.moduleId(),
                    "applyNow", "QUARTO".equalsIgnoreCase(view)));
        }
        out.put("tools", List.of("buscar_pecas", "localizar_peca"));
        return out;
    }

    /** CA11 — peças esquecidas ordenadas por tempo sem uso + [Criar look com elas]. */
    Map<String, Object> forgotten(CurrentUser user) {
        LocalDate today = LocalDate.now(FaiPointsService.ZONE);
        Map<UUID, LocalDate> last = room.lastDiaryDates(user.id(), today.minusYears(10));
        List<WardrobeItem> list = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(w -> RoomService.forgotten(w, RoomService.lastUse(w, last), today))
                .sorted(Comparator.comparing((WardrobeItem w) -> Optional.ofNullable(RoomService.lastUse(w, last))
                        .orElse(LocalDate.ofInstant(w.getCreatedAt(), FaiPointsService.ZONE))))
                .toList();
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        if (list.isEmpty()) {
            out.put("text", Msg.t("copilot.boa_noticia_nenhuma_peca_esta"));
            out.put("chips", List.of());
            return out;
        }
        List<Map<String, Object>> chips = new ArrayList<>();
        StringBuilder sb = new StringBuilder(Msg.t("copilot.estas_pecas_estao_paradas_ha"));
        for (WardrobeItem w : list.stream().limit(8).toList()) {
            LocalDate ref = Optional.ofNullable(RoomService.lastUse(w, last)).orElse(LocalDate.ofInstant(w.getCreatedAt(), FaiPointsService.ZONE));
            Map<String, Object> c = chip(w, where);
            c.put("daysUnused", ChronoUnit.DAYS.between(ref, today));
            chips.add(c);
            long days = ChronoUnit.DAYS.between(ref, today);
            sb.append("\n• ").append(w.getName()).append(" — ").append(days == 1 ? Msg.t("copilot.um_dia") : Msg.t("copilot.n_dias", days));
        }
        out.put("text", sb.toString());
        out.put("chips", chips);
        out.put("actions", List.of(Map.of("type", "COMPOSE_WITH", "label", Msg.t("common.criar_look_com_elas"), "pieceIds", list.stream().limit(3).map(WardrobeItem::getId).toList()),
                Map.of("type", "CHALLENGE", "label", Msg.t("common.segunda_chance"), "code", "SECOND_CHANCE")));
        out.put("tools", List.of("historico_uso"));
        return out;
    }

    /** CA13 — as 2 dimensões mais fracas com números e ações diretas. */
    Map<String, Object> improveInventory(CurrentUser user) {
        Map<String, Object> hints = inventory.improvementHints(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        if (!Boolean.TRUE.equals(hints.get("eligible"))) {
            out.put("text", Msg.t("copilot.o_inventory_score_aparece_a"));
            out.put("actions", List.of(Map.of("type", "ADD_PIECE", "href", "/pieces/new")));
            return out;
        }
        @SuppressWarnings("unchecked") List<InventoryScoreService.Dimension> weakest = (List<InventoryScoreService.Dimension>) hints.get("weakest");
        StringBuilder sb = new StringBuilder(Msg.t("copilot.seu_inventory_score_e_as", hints.get("score")));
        for (InventoryScoreService.Dimension d : weakest) {
            sb.append("\n• **").append(d.name()).append(" ").append(d.value()).append("** — ").append(d.rule());
        }
        out.put("text", sb.toString());
        out.put("dimensions", weakest);
        out.put("actions", hints.get("actions"));
        out.put("suggestedChallenges", hints.get("suggestedChallenges"));
        out.put("tools", List.of("ler_inventory_score"));
        return out;
    }
}
