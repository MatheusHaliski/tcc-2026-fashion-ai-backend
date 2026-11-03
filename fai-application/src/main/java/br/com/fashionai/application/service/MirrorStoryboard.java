package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.MirrorState;
import br.com.fashionai.domain.model.WardrobeItem;
import org.springframework.context.ApplicationEventPublisher;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.MirrorSlots.allIds;

/**
 * DET-K02 — roteiro do "Arrume-se Comigo" a partir do look no espelho.
 */
final class MirrorStoryboard {
    private final MirrorStore store;
    private final RoomService room;
    private final ApplicationEventPublisher events;

    MirrorStoryboard(MirrorStore store, RoomService room, ApplicationEventPublisher events) {
        this.store = store;
        this.room = room;
        this.events = events;
    }

    /** DET-K02 — "Arrume-se Comigo": storyboard (≤ 15 s) das portas acendendo, peças indo ao espelho e o look pronto. */
    Map<String, Object> grwmStoryboard(CurrentUser user) {
        MirrorState s = store.stateEntity(user.id());
        Map<String, Object> slots = store.slots(s);
        List<UUID> ids = allIds(slots);
        if (ids.isEmpty()) {
            throw new ApiException(409, "ESPELHO_VAZIO", Msg.t("mirror.monte_um_look_no_espelho"));
        }
        Map<UUID, WardrobeItem> loaded = store.load(user.id(), ids);
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        int per = Math.min(2500, 12000 / Math.max(1, ids.size()));
        List<Map<String, Object>> steps = new ArrayList<>();
        int t = 0;
        for (UUID id : ids) {
            WardrobeItem w = loaded.get(id);
            if (w == null) {
                continue;
            }
            RoomService.Location loc = where.get(id);
            steps.add(Map.of("at", t, "durationMs", per, "moduleId", loc == null ? "" : loc.moduleId(), "address", loc == null ? "" : loc.address().toString(),
                    "pieceId", id, "imageUrl", String.valueOf(w.getImageUrl()), "caption", w.getName() + (loc == null ? "" : " — " + loc.label())));
            t += per;
        }
        steps.add(Map.of("at", t, "durationMs", 3000, "moduleId", "mirror", "caption", Msg.t("mirror.look_pronto")));
        events.publishEvent(new DomainEvents.MirrorAction(user.id(), "GRWM_VIDEO"));
        return Map.of("format", "9:16", "maxSeconds", 15, "totalMs", t + 3000, "steps", steps, "music", Msg.t("mirror.sem_trilha_com_direitos_autorais"),
                "watermark", "FAI", "excludes", List.of(Msg.t("common.preco"), "marca (ETI-04)"));
    }
}
