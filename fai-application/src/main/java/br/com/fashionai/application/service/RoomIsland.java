package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import org.springframework.beans.factory.ObjectProvider;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Meu Quarto — ilha central (Loft): bancada que compara 2–3 looks do próprio dono, com o Hype pessoal v2 (RF53 · P3-06). */
final class RoomIsland {
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final Guard guard;
    private final ObjectProvider<HypeQueryService> hype;
    private final RoomFurniture furniture;

    RoomIsland(RoomContext ctx) {
        this.schemes = ctx.schemes;
        this.schemeItems = ctx.schemeItems;
        this.guard = ctx.guard;
        this.hype = ctx.hype;
        this.furniture = ctx.furniture;
    }

    /** Loft — bancada de looks: comparar 2–3 esquemas lado a lado. */
    Map<String, Object> island(CurrentUser user, List<UUID> schemeIds) {
        if (!furniture.levelOf(user.id()).atLeast(FaiPointsService.Level.LOFT)) {
            throw new ApiException(409, "NIVEL_INSUFICIENTE", Msg.t("room.a_ilha_central_e_liberada"));
        }
        if (schemeIds == null || schemeIds.size() < 2 || schemeIds.size() > 3) {
            throw ApiException.badRequest("QUANTIDADE_INVALIDA", Msg.t("room.compare_2_ou_3_looks"));
        }
        List<Scheme> owned = new ArrayList<>();
        for (UUID id : schemeIds) {
            Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound("Esquema"));
            guard.requireOwner(user, s.getUser().getId(), "scheme:" + id);
            owned.add(s);
        }
        Map<String, Object> hypeOf = islandHype(user, schemeIds);
        List<Map<String, Object>> looks = new ArrayList<>();
        for (Scheme s : owned) {
            UUID id = s.getId();
            List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("title", s.getTitle());
            m.put("coverImageUrl", s.getCoverImageUrl());
            m.put("occasion", Json.csv(s.getOccasion()));
            m.put("style", Json.csv(s.getStyle()));
            m.put("totalPrice", s.getTotalPrice());
            // RF53 · P3-06: HypeScore v2 do look (Hype pessoal do dono, também de look privado); sem cálculo = NOT_CALCULATED, nunca 0
            m.put("hype", hypeOf.getOrDefault(id.toString(), Map.of("status", "NOT_CALCULATED")));
            m.put("pieces", items.stream().map(si -> Map.of("id", si.getWardrobeItem().getId(), "name", String.valueOf(si.getWardrobeItem().getName()),
                    "slot", si.getSlot().name(), "imageUrl", String.valueOf(si.getWardrobeItem().getImageUrl()))).toList());
            looks.add(m);
        }
        return Map.of("looks", looks, "module", "island");
    }

    /** Resumos v2 em lote (mesmo formato dos cards); a ilha só compara looks do próprio dono, então lê o Hype pessoal. */
    @SuppressWarnings("unchecked")
    Map<String, Object> islandHype(CurrentUser user, List<UUID> schemeIds) {
        HypeQueryService q = hype == null ? null : hype.getIfAvailable();
        if (q == null) {
            return Map.of();
        }
        Object items = q.summaries(user, HypeEntityType.SCHEME, schemeIds).get("items");
        return items instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }
}
