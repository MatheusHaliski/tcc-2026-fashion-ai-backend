package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.MirrorState;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.TipoLook;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import static br.com.fashionai.application.service.MirrorSlots.slotOf;
import static br.com.fashionai.application.service.MirrorSlots.schemeSlot;
import static br.com.fashionai.application.service.MirrorSlots.accessories;
import static br.com.fashionai.application.service.MirrorSlots.single;
import static br.com.fashionai.application.service.MirrorSlots.allIds;
import static br.com.fashionai.application.service.MirrorSlots.complete;
import static br.com.fashionai.application.service.MirrorSlots.key;
import static br.com.fashionai.application.service.MirrorService.DAY;

/**
 * Usar, salvar e entregar ao RF5: materializa o Esquema do espelho (§2.3, reaproveitando a mesma
 * combinação e tipo), registra o Look do Dia e monta o RoomLookDraft (§2.4).
 */
final class MirrorHandoff {
    private final MirrorStore store;
    private final SchemeService schemeService;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final DailyLookService dailyLooks;
    private final ApplicationEventPublisher events;

    MirrorHandoff(MirrorStore store, SchemeService schemeService, SchemeRepository schemes, SchemeItemRepository schemeItems,
                  DailyLookService dailyLooks, ApplicationEventPublisher events) {
        this.store = store;
        this.schemeService = schemeService;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dailyLooks = dailyLooks;
        this.events = events;
    }

    // ================================================================== usar / salvar / entregar ao RF5
    private Scheme findExistingScheme(UUID userId, List<UUID> ids, TipoLook tipo) {
        String key = key(ids);
        for (Scheme s : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(userId, SchemeStatus.ARCHIVED)) {
            List<UUID> sIds = schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).stream().map(si -> si.getWardrobeItem().getId()).toList();
            if (sIds.size() == ids.size() && key(sIds).equals(key)
                    && Objects.equals(s.getTipoLook() == null ? null : s.getTipoLook().getId(), tipo == null ? null : tipo.getId())) {
                return s;
            }
        }
        return null;
    }

    private Scheme materialize(CurrentUser user, MirrorState mirror, Map<String, Object> slots, String title, boolean publish) {
        List<UUID> ids = allIds(slots);
        if (ids.size() < 2) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("mirror.leve_ao_menos_2_pecas"));
        }
        Scheme existing = findExistingScheme(user.id(), ids, mirror.getTipoLook());
        if (existing != null) {
            return existing;
        }
        Map<UUID, WardrobeItem> loaded = store.load(user.id(), ids);
        SchemeOrigin origin = "vista_me".equals(slots.get("origin")) ? SchemeOrigin.VISTA_ME : SchemeOrigin.SMART_MIRROR;
        List<SchemeService.ItemForm> items = new ArrayList<>();
        int order = 0;
        for (UUID id : ids) {
            WardrobeItem w = loaded.get(id);
            if (w != null) {
                items.add(new SchemeService.ItemForm(id, schemeSlot(slotOf(w)), order, order, null, null, null, null, null, null));
                order++;
            }
        }
        List<WardrobeItem> look = ids.stream().map(loaded::get).filter(Objects::nonNull).toList();
        List<String> occasions = new ArrayList<>();
        if (slots.get("interpretation") instanceof Map<?, ?> m && m.get("occasion") instanceof List<?> l) {
            l.stream().map(String::valueOf).filter(Taxonomy.OCCASIONS::contains).limit(3).forEach(occasions::add);
        }
        LocalSchemeComposer.Composition base = LocalSchemeComposer.toComposition(look, occasions, List.of(), null, 0);
        String finalTitle = title != null && !title.isBlank() ? InputSanitizer.clean(title, 120)
                : (origin == SchemeOrigin.VISTA_ME ? Msg.t("mirror.vista_me") : Msg.t("mirror.espelho")) + LocalDate.now(FaiPointsService.ZONE).format(DAY);
        SchemeService.SchemeForm form = new SchemeService.SchemeForm(finalTitle, slots.get("prompt") == null ? null : "Pedido: " + slots.get("prompt"),
                base.occasions(), base.styles(), null, null, null, null, items, origin == SchemeOrigin.VISTA_ME ? CreationMode.AI_ASSISTED : CreationMode.MANUAL, origin, null, null, Boolean.TRUE,
                null, null, null, null, publish, null);
        Map<String, Object> created = schemeService.create(user, form);
        Views.SchemeView view = (Views.SchemeView) created.get("scheme");
        Scheme scheme = schemes.findById(view.id()).orElseThrow();
        scheme.setTipoLook(mirror.getTipoLook());
        return schemes.save(scheme);
    }

    /** RF33.CA11 / §2.3 — "Usar este look": cria o esquema se necessário e registra o Look do Dia. */
    Map<String, Object> useLook(CurrentUser user) {
        MirrorState s = store.stateEntity(user.id());
        Map<String, Object> slots = store.slots(s);
        if (!complete(slots)) {
            throw new ApiException(409, "LOOK_INCOMPLETO", Msg.t("mirror.o_look_do_dia_precisa"));
        }
        Scheme scheme = materialize(user, s, slots, null, false);
        DailyLookSource source = scheme.getOrigin() == SchemeOrigin.VISTA_ME ? DailyLookSource.VISTA_ME : DailyLookSource.SMART_MIRROR;
        var dl = dailyLooks.register(user, scheme, source, LocalDate.now(FaiPointsService.ZONE));
        events.publishEvent(new DomainEvents.MirrorAction(user.id(), "USE_LOOK"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("schemeId", scheme.getId());
        out.put("dailyLook", dailyLooks.view(dl));
        out.put("source", source.name());
        out.put("closing", Map.of("animation", "fecho_vista_me", "steps", List.of("porta_fecha", "luz_sobe", "foto_do_look"), "respectsReduceMotion", true));
        out.put("message", Msg.t("mirror.look_do_dia_registrado", (source == DailyLookSource.VISTA_ME ? Msg.t("mirror.fai_pts_pelo_vista_me") : "")));
        return out;
    }

    Map<String, Object> save(CurrentUser user, String title, boolean publish) {
        MirrorState s = store.stateEntity(user.id());
        Scheme scheme = materialize(user, s, store.slots(s), title, publish);
        return Map.of("schemeId", scheme.getId(), "title", String.valueOf(scheme.getTitle()), "origin", scheme.getOrigin().name());
    }

    /** RF33.CA07 / §2.4 — payload RoomLookDraft para o Criar Look (sessionStorage 'sai_room_look_draft'). */
    Map<String, Object> draft(CurrentUser user, String originOverride) {
        MirrorState s = store.stateEntity(user.id());
        Map<String, Object> slots = store.slots(s);
        Map<String, Object> d = new LinkedHashMap<>();
        String origin = originOverride != null ? originOverride : String.valueOf(slots.getOrDefault("origin", "smart_mirror"));
        d.put("origin", origin.equals("manual") ? "smart_mirror" : origin);
        Map<String, String> ss = new LinkedHashMap<>();
        for (String slot : List.of("upper", "lower", "dress", "shoes", "outer_layer")) {
            UUID id = single(slots, slot);
            if (id != null) {
                ss.put(slot, id.toString());
            }
        }
        d.put("slots", ss);
        d.put("tipoLook", Views.tipoLook(s.getTipoLook()));
        d.put("accessories", accessories(slots).stream().map(UUID::toString).toList());
        if (slots.get("interpretation") instanceof Map<?, ?> m && m.get("occasion") instanceof List<?> l && !l.isEmpty()) {
            d.put("occasion", String.valueOf(l.get(0)));
        }
        d.put("prompt", slots.get("prompt"));
        d.put("created_at", Instant.now().toString());
        d.put("sessionStorageKey", "sai_room_look_draft");
        return d;
    }
}
