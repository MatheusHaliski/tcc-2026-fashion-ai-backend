package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.repository.RoomLayoutRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.RoomModules.keys;
import static br.com.fashionai.application.service.RoomModules.module;
import static br.com.fashionai.application.service.RoomModules.modules;

/** Meu Quarto — Chave do Quarto (DET-K05): dar a chave, conferir quem a tem e ler os ids das chaves de layouts antigos. */
final class RoomKeys {
    private static final Logger log = LoggerFactory.getLogger(RoomService.class);
    private final RoomLayoutRepository layouts;
    private final UserRepository users;
    private final RoomFurniture furniture;

    RoomKeys(RoomContext ctx) {
        this.layouts = ctx.layouts;
        this.users = ctx.users;
        this.furniture = ctx.furniture;
    }

    Map<String, Object> giveKey(CurrentUser user, UUID guestId) {
        if (guestId.equals(user.id())) {
            throw ApiException.badRequest("CHAVE_INVALIDA", Msg.t("room.a_chave_e_para_outra"));
        }
        users.findById(guestId).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        RoomLayout l = furniture.layout(user.id());
        List<Map<String, Object>> mods = modules(l);
        Map<String, Object> keysModule = mods.stream().filter(m -> "keys".equals(m.get("id"))).findFirst().orElseGet(() -> {
            Map<String, Object> m = module("keys", "KEYS", null, 0, 0, Msg.t("room.chaves_do_quarto"), null, null);
            mods.add(m);
            return m;
        });
        Set<String> set = new java.util.LinkedHashSet<>(keysModule.get("users") instanceof List<?> lst ? lst.stream().map(String::valueOf).toList() : List.of());
        set.add(guestId.toString());
        keysModule.put("users", new ArrayList<>(set));
        l.setModulesJson(Json.write(mods));
        layouts.save(l);
        return Map.of("keys", set);
    }

    /** Quem me deu a chave (convites para desafios, RF36.CA04). */
    boolean hasKey(UUID ownerId, UUID guestId) {
        return keys(furniture.layout(ownerId)).contains(guestId.toString());
    }

    /** Um layout antigo não pode impedir o carregamento do quarto inteiro por uma chave já removida ou corrompida. */
    List<UUID> keyUserIds(RoomLayout layout) {
        List<UUID> ids = new ArrayList<>();
        for (String key : keys(layout)) {
            try {
                ids.add(UUID.fromString(key));
            } catch (IllegalArgumentException e) {
                log.warn("event=room_key_ignored reason=invalid_user_id key={}", key);
            }
        }
        return ids;
    }
}
