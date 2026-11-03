package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.RoomLayoutRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.RoomService.DEFAULT_DRAWER_LABELS;
import static br.com.fashionai.application.service.RoomModules.capacity;
import static br.com.fashionai.application.service.RoomModules.defaultModules;
import static br.com.fashionai.application.service.RoomModules.modules;

/** Meu Quarto — o móvel da pessoa: nível, layout com os módulos liberados (RF35 §5.3) e acabamentos da loja do quarto. */
final class RoomFurniture {
    private final RoomLayoutRepository layouts;
    private final UserRepository users;
    private final FaiPointsLedgerEntryRepository ledger;

    RoomFurniture(RoomContext ctx) {
        this.layouts = ctx.layouts;
        this.users = ctx.users;
        this.ledger = ctx.ledger;
    }

    FaiPointsService.Level levelOf(UUID userId) {
        return FaiPointsService.Level.of(ledger.lifetime(userId));
    }

    RoomLayout layout(UUID userId) {
        RoomLayout layout = layouts.findByUserId(userId).orElseGet(() -> {
            RoomLayout l = new RoomLayout();
            l.setUser(users.findById(userId).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario"))));
            l.setLevel(levelOf(userId).name());
            Map<String, Object> labels = new LinkedHashMap<>();
            Map<String, String> values = new LinkedHashMap<>();
            Map<String, String> sources = new LinkedHashMap<>();
            for (int i = 0; i < DEFAULT_DRAWER_LABELS.size(); i++) {
                values.put(String.valueOf(i + 1), DEFAULT_DRAWER_LABELS.get(i));
                sources.put(String.valueOf(i + 1), "DEFAULT");
            }
            labels.put("labels", values);
            labels.put("sources", sources);
            l.setDrawerLabelsJson(Json.write(labels));
            return l;
        });
        FaiPointsService.Level level = FaiPointsService.Level.parse(layout.getLevel());
        List<Map<String, Object>> existing = Json.list(layout.getModulesJson());
        Set<String> ids = existing.stream().map(m -> String.valueOf(m.get("id"))).collect(Collectors.toSet());
        boolean changed = false;
        for (Map<String, Object> m : existing) {
            if (Set.of("DOOR", "DRAWER").contains(String.valueOf(m.get("slotType"))) && capacity(m) != 4) {
                m.put("capacity", 4); changed = true;
            }
        }
        for (Map<String, Object> m : defaultModules(level)) {
            if (!ids.contains(String.valueOf(m.get("id")))) {
                existing.add(m);
                changed = true;
            }
        }
        if (changed || layout.getModulesJson() == null) {
            layout.setModulesJson(Json.write(existing));
        }
        return layouts.save(layout);
    }

    // ------------------------------------------------------------------ RoomLayoutAccess (RF35)
    void setLevel(UUID userId, String level) {
        RoomLayout l = layout(userId);
        l.setLevel(FaiPointsService.Level.parse(level).name());   // nomes antigos (Closet…Maison) viram Loft
        layouts.save(l);
        layout(userId); // mescla os módulos liberados pelo nível
    }

    List<String> compatibleModules(UUID userId, RoomCatalogItem item) {
        if ("WARDROBE".equals(item.getKind())) {
            return List.of("ALL");                               // guarda-roupa inteiro: cada bloco vai para todos os módulos do tipo
        }
        return modules(layout(userId)).stream()
                .filter(m -> item.getSlotType().equals(String.valueOf(m.get("slotType"))))
                .filter(m -> item.getWidthCm() == 0 || (m.get("widthCm") instanceof Number n && n.intValue() == item.getWidthCm()))
                .map(m -> String.valueOf(m.get("id")))
                .toList();
    }

    void applyFinish(UUID userId, String moduleId, RoomCatalogItem item) {
        RoomLayout l = layout(userId);
        List<Map<String, Object>> mods = modules(l);
        if ("WARDROBE".equals(item.getKind())) {
            for (Map<String, Object> part : Json.list(item.getBundleJson())) {
                String slot = String.valueOf(part.get("slotType"));
                for (Map<String, Object> m : mods) {
                    if (slot.equals(String.valueOf(m.get("slotType")))) {
                        m.put("sku", item.getSku());
                        m.put("finish", part.get("finish"));
                        m.put("mold", part.get("moldId"));
                        m.put("rarity", item.getRarity());
                    }
                }
            }
            l.setModulesJson(Json.write(mods));
            layouts.save(l);
            return;
        }
        for (Map<String, Object> m : mods) {
            if (moduleId.equals(String.valueOf(m.get("id")))) {
                m.put("sku", item.getSku());
                m.put("finish", Json.map(item.getFinishJson()));
                m.put("mold", item.getMoldId());
                m.put("rarity", item.getRarity());
            }
        }
        l.setModulesJson(Json.write(mods));
        layouts.save(l);
    }

    void resetFinish(UUID userId, String moduleId, RoomCatalogItem item) {
        RoomLayout l = layout(userId);
        Map<String, Map<String, Object>> factory = defaultModules(FaiPointsService.Level.LOFT).stream()
                .collect(Collectors.toMap(m -> String.valueOf(m.get("id")), m -> m, (a, b) -> a));
        List<Map<String, Object>> mods = modules(l);
        for (Map<String, Object> m : mods) {
            String id = String.valueOf(m.get("id"));
            if (!item.getSku().equals(m.get("sku")) || !("ALL".equals(moduleId) || moduleId.equals(id))) {
                continue;
            }
            Map<String, Object> original = factory.getOrDefault(id, Map.of());
            m.put("sku", null);
            m.remove("rarity");
            m.put("finish", original.get("finish"));
            m.put("mold", original.get("mold"));
        }
        l.setModulesJson(Json.write(mods));
        layouts.save(l);
    }
}
