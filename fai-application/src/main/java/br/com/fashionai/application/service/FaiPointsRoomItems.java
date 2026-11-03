package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomInventoryItem;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** RF35 — itens comprados no quarto: aplicar num módulo, retirar (volta ao acabamento de fábrica) e soltar deslocados. */
final class FaiPointsRoomItems {
    private final RoomCatalogItemRepository catalog;
    private final RoomInventoryItemRepository inventory;
    private final FaiPointsService.RoomLayoutAccess layouts;

    FaiPointsRoomItems(RoomCatalogItemRepository catalog, RoomInventoryItemRepository inventory,
                       FaiPointsService.RoomLayoutAccess layouts) {
        this.catalog = catalog;
        this.inventory = inventory;
        this.layouts = layouts;
    }

    /** Aplica num módulo compatível um item comprado e solta as unidades que ele desloca. */
    Map<String, Object> apply(CurrentUser user, UUID inventoryId, String moduleId) {
        RoomInventoryItem item = inventory.findById(inventoryId).orElseThrow(() -> ApiException.notFound("Item"));
        if (!item.getUserId().equals(user.id())) {
            throw ApiException.forbidden(Msg.t("faiPoints.item_de_outro_usuario"));
        }
        RoomCatalogItem c = catalog.findById(item.getSku()).orElseThrow();
        List<String> compatible = layouts.compatibleModules(user.id(), c);
        if (!compatible.contains(moduleId)) {
            throw new ApiException(409, "ENCAIXE_INCOMPATIVEL", Msg.t("faiPoints.o_item_cabe_em_rf35", String.join(", ", compatible)));
        }
        item.setAppliedModule(moduleId);
        layouts.applyFinish(user.id(), moduleId, c);
        releaseDisplaced(user.id(), item);
        return Map.of("applied", true, "module", moduleId, "sku", c.getSku());
    }

    /**
     * Retira do quarto um item comprado: o módulo volta ao acabamento de fábrica e o item continua no inventário (a
     * propriedade nunca depende de estar aplicado).
     */
    Map<String, Object> unapply(CurrentUser user, UUID inventoryId) {
        RoomInventoryItem item = inventory.findById(inventoryId).orElseThrow(() -> ApiException.notFound("Item"));
        if (!item.getUserId().equals(user.id())) {
            throw ApiException.forbidden(Msg.t("faiPoints.item_de_outro_usuario"));
        }
        if (item.getAppliedModule() == null) {
            throw new ApiException(409, "ITEM_NAO_APLICADO", Msg.t("room.item_not_applied"));
        }
        RoomCatalogItem c = catalog.findById(item.getSku()).orElseThrow();
        String module = item.getAppliedModule();
        layouts.resetFinish(user.id(), module, c);
        item.setAppliedModule(null);
        return Map.of("applied", false, "module", module, "sku", c.getSku(), "inventoryId", item.getId());
    }

    /**
     * Um módulo mostra um único item: depois de aplicar {@code applied}, as outras unidades que ocupavam o mesmo lugar (ou
     * cujo acabamento foi sobrescrito, como num guarda-roupa inteiro) deixam de constar como aplicadas — continuam no
     * inventário e podem ser reaplicadas.
     */
    void releaseDisplaced(UUID userId, RoomInventoryItem applied) {
        RoomLayout layout = layouts.layout(userId);
        List<Map<String, Object>> modules = layout == null ? List.of() : Json.list(layout.getModulesJson());
        for (RoomInventoryItem other : inventory.findByUserId(userId)) {
            if (other.getId() == null || other.getId().equals(applied.getId()) || other.getAppliedModule() == null) {
                continue;
            }
            String where = other.getAppliedModule();
            boolean present = !where.equals(applied.getAppliedModule()) && modules.stream()
                    .anyMatch(m -> other.getSku().equals(m.get("sku")) && ("ALL".equals(where) || where.equals(String.valueOf(m.get("id")))));
            if (!present) {
                other.setAppliedModule(null);
            }
        }
    }
}
