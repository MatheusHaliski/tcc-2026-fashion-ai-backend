package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.repository.RoomLayoutRepository;
import org.springframework.beans.factory.ObjectProvider;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.RoomModules.module;
import static br.com.fashionai.application.service.RoomModules.modules;

/** Meu Quarto — ambiente: luzes do closet pela FAI Inventory Score (RF29), iluminação (temperatura, intensidade, liga/desliga) e monograma. */
final class RoomAmbience {
    private final RoomLayoutRepository layouts;
    private final ObjectProvider<InventoryScoreService> inventoryScore;
    private final RoomFurniture furniture;

    RoomAmbience(RoomContext ctx) {
        this.layouts = ctx.layouts;
        this.inventoryScore = ctx.inventoryScore;
        this.furniture = ctx.furniture;
    }

    /**
     * Luzes do closet (RF29): uma fileira de luzes por marco de faixa do FAI Inventory Score (Organizado → Maison Closet).
     * Cada faixa alcançada acende uma luz; a última acesa ganha a animação de conquista no espelho.
     */
    Map<String, Object> closetLights(UUID userId) {
        InventoryScoreService iss = inventoryScore.getIfAvailable();
        Integer score = null;
        String band = null;
        boolean eligible = false;
        if (iss != null) {
            try {
                InventoryScoreService.Result r = iss.compute(userId, true);
                score = r.score();
                band = r.band();
                eligible = r.eligible();
            } catch (RuntimeException e) {
                // a cena do quarto nunca quebra por causa da nota: sem nota, as luzes ficam apagadas
            }
        }
        int value = score == null ? 0 : score;
        List<Map<String, Object>> milestones = InventoryScoreService.BANDS.stream().skip(1)
                .map(b -> Map.<String, Object>of("at", b.min(), "label", b.label(), "lit", value >= b.min())).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("score", score);
        out.put("band", band);
        out.put("eligible", eligible);
        out.put("milestones", milestones);
        out.put("lit", milestones.stream().filter(m -> Boolean.TRUE.equals(m.get("lit"))).count());
        return out;
    }

    Map<String, Object> setLight(CurrentUser user, Integer kelvin, Double intensity, Boolean on) {
        if (kelvin != null && !furniture.levelOf(user.id()).atLeast(FaiPointsService.Level.STUDIO)) {
            throw new ApiException(409, "NIVEL_INSUFICIENTE", Msg.t("room.a_iluminacao_guiada_e_liberada"));
        }
        if (intensity != null && (!Double.isFinite(intensity) || intensity < 0 || intensity > 1)) {
            throw new ApiException(400, "INVALID_LIGHT_INTENSITY", Msg.t("room.invalid_intensity"));
        }
        RoomLayout l = furniture.layout(user.id());
        List<Map<String, Object>> mods = modules(l);
        Map<String, Object> finish = new LinkedHashMap<>(module(l, "light").map(m -> Json.map(Json.write(m.get("finish")))).orElse(Map.of()));
        finish.putIfAbsent("kelvin", 4000); finish.putIfAbsent("guided", false); finish.putIfAbsent("intensity", 0.75);
        if (kelvin != null) { finish.put("kelvin", Math.max(2700, Math.min(6500, kelvin))); finish.put("guided", true); }
        if (intensity != null) finish.put("intensity", intensity);
        if (on != null) finish.put("on", on);
        Map<String, Object> lightModule = mods.stream().filter(m -> "light".equals(m.get("id"))).findFirst().orElse(null);
        if (lightModule == null) { lightModule = new LinkedHashMap<>(); lightModule.put("id", "light"); mods.add(lightModule); }
        lightModule.put("finish", finish);
        l.setModulesJson(Json.write(mods)); layouts.save(l);
        return finish;
    }

    /** DET-K03 — monograma nas portas a partir do Studio (até 3 iniciais em baixo-relevo). */
    Map<String, Object> setMonogram(CurrentUser user, String initials) {
        if (!furniture.levelOf(user.id()).atLeast(FaiPointsService.Level.STUDIO)) {
            throw new ApiException(409, "NIVEL_INSUFICIENTE", Msg.t("room.o_monograma_e_liberado_no"));
        }
        String clean = InputSanitizer.clean(initials == null ? "" : initials, 3).toUpperCase(Locale.ROOT).replaceAll("[^A-Z]", "");
        RoomLayout l = furniture.layout(user.id());
        List<Map<String, Object>> mods = modules(l).stream().filter(m -> !"monogram".equals(m.get("id"))).collect(Collectors.toCollection(ArrayList::new));
        if (!clean.isEmpty()) {
            Map<String, Object> m = module("monogram", "MONOGRAM", null, 0, 0, "Monograma", null, null);
            m.put("initials", clean);
            mods.add(m);
        }
        l.setModulesJson(Json.write(mods));
        layouts.save(l);
        return Map.of("initials", clean);
    }
}
