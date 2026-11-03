package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.RoomLayout;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.service.RoomModules.capacity;
import static br.com.fashionai.application.service.RoomModules.labelSources;
import static br.com.fashionai.application.service.RoomModules.modules;

/** Meu Quarto — visão dos módulos do móvel na cena do quarto (conteúdo, cabides, rótulos acessíveis). Regras puras. */
final class RoomModuleViews {
    private RoomModuleViews() {
    }

    /** Visão de cada módulo na cena (CA01/CA10): gavetas com rótulo e charme de vazia, portas com cabides, rótulo acessível. */
    static List<Map<String, Object>> moduleViews(RoomLayout layout, Map<String, String> labels,
                                                 Map<String, List<Map<String, Object>>> byModule) {
        List<Map<String, Object>> modules = new ArrayList<>();
        for (Map<String, Object> m : modules(layout)) {
            String id = String.valueOf(m.get("id"));
            Map<String, Object> view = new LinkedHashMap<>(m);
            List<Map<String, Object>> content = byModule.getOrDefault(id, List.of());
            String slot = String.valueOf(m.get("slotType"));
            if (slot.equals("DRAWER")) {
                String idx = id.substring("drawer:".length());
                String label = labels.get(idx);
                view.put("label", label == null ? "Gaveta " + idx : label);
                view.put("category", label);
                view.put("labelSource", labelSources(layout).getOrDefault(idx, label == null ? null : "DEFAULT"));
                view.put("accessibleLabel", "Gaveta " + idx + (label == null ? "" : ", " + label) + ", " + content.size()
                        + (content.size() == 1 ? Msg.t("room.peca") : Msg.t("room.pecas")));
                view.put("empty", content.isEmpty());
                view.put("emptyCharm", content.isEmpty() ? Map.of("props", List.of("sache_lavanda", "meia_sem_par"),
                        "action", Msg.t("room.adicionar_peca_a_esta_gaveta")) : null);
            } else if (slot.equals("DOOR")) {
                int cap = capacity(m);
                List<Map<String, Object>> hangers = new ArrayList<>();
                for (int k = 1; k <= cap; k++) {
                    String hangerAddr = id + "/hanger:" + k;
                    Map<String, Object> piece = content.stream().filter(p -> hangerAddr.equals(p.get("address"))).findFirst().orElse(null);
                    hangers.add(Map.of("k", k, "address", hangerAddr, "pieceId", piece == null ? "" : String.valueOf(piece.get("id"))));
                }
                view.put("hangers", hangers);
                view.put("accessibleLabel", Msg.t("room.pecas_2", (m.get("label")), content.size()));
            } else {
                view.put("accessibleLabel", m.get("label") + ", " + content.size() + (content.size() == 1 ? Msg.t("room.peca") : Msg.t("room.pecas")));
            }
            view.put("pieces", content);
            view.put("count", content.size());
            modules.add(view);
        }
        return modules;
    }
}
