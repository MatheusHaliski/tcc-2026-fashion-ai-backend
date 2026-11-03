package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.MirrorService.Interpretation;
import br.com.fashionai.domain.model.MirrorState;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.MirrorStateRepository;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.MirrorSlots.slotOf;
import static br.com.fashionai.application.service.MirrorSlots.rack;
import static br.com.fashionai.application.service.MirrorSlots.putRack;
import static br.com.fashionai.application.service.MirrorSlots.addToRack;
import static br.com.fashionai.application.service.MirrorSlots.allIds;
import static br.com.fashionai.application.service.MirrorSlots.key;
import static br.com.fashionai.application.service.MirrorService.MAX_ACCESSORIES;
import static br.com.fashionai.application.service.MirrorService.MAX_SHOWN;

/**
 * Vista-me (CA08–CA15): elegibilidade, âncoras, interpretação, composição, gravação do look sugerido e
 * a sequência de localização no quarto (CA10).
 */
final class MirrorVistaMe {
    private final MirrorStore store;
    private final MirrorStateView view;
    private final MirrorInterpretation interpretation;
    private final MirrorComposer composer;
    private final MirrorStateRepository mirrors;
    private final RoomService room;
    private final ApplicationEventPublisher events;

    MirrorVistaMe(MirrorStore store, MirrorStateView view, MirrorInterpretation interpretation, MirrorComposer composer,
                  MirrorStateRepository mirrors, RoomService room, ApplicationEventPublisher events) {
        this.store = store;
        this.view = view;
        this.interpretation = interpretation;
        this.composer = composer;
        this.mirrors = mirrors;
        this.room = room;
        this.events = events;
    }

    Map<String, Object> vistaMe(CurrentUser user, String rawPrompt, List<UUID> anchorIds, UUID focusPieceId, boolean keepMirror) {
        String prompt = InputSanitizer.clean(rawPrompt == null ? "" : rawPrompt, 300);
        MirrorState s = store.stateEntity(user.id());
        Map<String, Object> slots = store.slots(s);
        List<WardrobeItem> eligible = store.eligible(user.id());
        boolean hasTop = eligible.stream().anyMatch(w -> slotOf(w).equals("upper") || slotOf(w).equals("dress"));
        if (!hasTop) {
            throw new ApiException(422, "ACERVO_SEM_SUPERIOR", Msg.t("mirror.voce_ainda_nao_tem_peca"), Map.of("href", "/pieces/new", "rf", "RF33.CA14"));
        }
        Set<UUID> eligibleIds = eligible.stream().map(WardrobeItem::getId).collect(Collectors.toSet());
        LinkedHashSet<UUID> anchors = new LinkedHashSet<>();
        if (anchorIds != null) {
            anchorIds.stream().filter(eligibleIds::contains).forEach(anchors::add);
        }
        String low = prompt.toLowerCase(Locale.ROOT);
        if (focusPieceId != null && eligibleIds.contains(focusPieceId) && (low.contains("esta ") || low.contains("essa ") || low.contains("este ")
                || low.contains("esse ") || low.contains("usar"))) {
            anchors.add(focusPieceId);
        }
        List<WardrobeItem> mirrorContext = keepMirror ? store.load(user.id(), allIds(slots)).values().stream().filter(w -> eligibleIds.contains(w.getId())).toList() : List.of();
        AiOutcome<?>[] holder = new AiOutcome<?>[1];
        Interpretation it = interpretation.interpret(user, prompt, new ArrayList<>(anchors), eligible, holder);
        AiOutcome<?> interpretOutcome = holder[0];
        Set<String> shown = new LinkedHashSet<>(Json.strings(s.getShownCombinationsJson()));
        Optional<List<WardrobeItem>> composed = composer.compose(user, it, eligible, shown, mirrorContext, holder);
        AiOutcome<?> composeOutcome = holder[0];
        if (composed.isEmpty()) {
            throw new ApiException(422, "SEM_COMBINACAO_NOVA", Msg.t("mirror.nao_encontrei_uma_combinacao_nova"),
                    Map.of("href", "/pieces/new"));
        }
        List<WardrobeItem> look = composed.get();
        Map<String, Object> newSlots = new LinkedHashMap<>();
        List<String> acc = new ArrayList<>();
        for (WardrobeItem w : look) {
            String slot = slotOf(w);
            if (slot.equals("accessory")) {
                if (acc.size() < MAX_ACCESSORIES) {
                    acc.add(w.getId().toString());
                }
            } else {
                newSlots.put(slot, w.getId().toString());
            }
        }
        newSlots.put("accessory", acc);
        newSlots.put("origin", "vista_me");
        newSlots.put("prompt", prompt);
        newSlots.put("interpretation", Map.of("occasion", it.occasion(), "mood", String.valueOf(it.mood()), "anchors", it.anchors().stream().map(UUID::toString).toList(),
                "constraints", it.constraints(), "season", String.valueOf(it.season())));
        newSlots.put("updatedAt", Instant.now().toString());
        // a lista do espelho continua: o look sugerido entra nela, as peças que a pessoa trouxe ficam
        putRack(newSlots, rack(store.slots(s)));
        look.forEach(w -> addToRack(newSlots, w.getId()));
        shown.add(key(look.stream().map(WardrobeItem::getId).toList()));
        List<String> shownList = new ArrayList<>(shown);
        if (shownList.size() > MAX_SHOWN) {
            shownList = shownList.subList(shownList.size() - MAX_SHOWN, shownList.size());
        }
        s.setSlotsJson(Json.write(newSlots));
        s.setShownCombinationsJson(Json.write(shownList));
        s.setLastPrompt(prompt);
        mirrors.save(s);
        int hour = LocalDateTime.now(FaiPointsService.ZONE).getHour();
        events.publishEvent(new DomainEvents.MirrorAction(user.id(), hour < 5 ? "VISTA_ME_MADRUGADA" : "VISTA_ME"));

        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        List<Map<String, Object>> sequence = new ArrayList<>();
        for (WardrobeItem w : look) {
            RoomService.Location loc = where.get(w.getId());
            sequence.add(Map.of("pieceId", w.getId(), "name", String.valueOf(w.getName()), "address", loc == null ? "" : loc.address().toString(),
                    "label", loc == null ? "" : loc.label(), "moduleId", loc == null ? "" : loc.moduleId(),
                    "legend", w.getName() + " — " + (loc == null ? Msg.t("common.posicao_desconhecida") : loc.label())));
        }
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("sequence", sequence);
        extra.put("legend", sequence.stream().map(m -> String.valueOf(m.get("legend"))).toList());
        extra.put("fallbackUsed", (composeOutcome != null && composeOutcome.fallbackUsed()) || (interpretOutcome != null && interpretOutcome.fallbackUsed()));
        extra.put("fallbackMessage", composeOutcome != null && composeOutcome.fallbackUsed()
                ? Msg.t("mirror.sugestao_montada_por_regras_locais") : null);
        extra.put("explanation", composeOutcome == null ? null : composeOutcome.explanation());
        extra.put("quota", composeOutcome == null ? null : composeOutcome.quota());
        extra.put("message", composeOutcome == null ? null : composeOutcome.userMessage());
        extra.put("actions", List.of("USAR_ESTE_LOOK", "TROCAR_UMA_PECA", "REMIXAR", "SALVAR", "OUTRA_SUGESTAO", "CRIAR_LOOK_COM_ESTAS_PECAS"));
        store.restriction(user.id()).ifPresent(r -> extra.put("challengeNotice", Msg.t("mirror.respeitando_o_desafio_so_as", r.challengeName())));
        return view.render(user, s, newSlots, extra);
    }

    /** RF33.CA13 — outra sugestão para o mesmo pedido, sem repetir as já mostradas na sessão. */
    Map<String, Object> another(CurrentUser user) {
        MirrorState s = store.stateEntity(user.id());
        Map<String, Object> slots = store.slots(s);
        List<UUID> anchors = new ArrayList<>();
        if (slots.get("interpretation") instanceof Map<?, ?> m && m.get("anchors") instanceof List<?> l) {
            l.forEach(o -> anchors.add(UUID.fromString(String.valueOf(o))));
        }
        return vistaMe(user, s.getLastPrompt() == null ? "" : s.getLastPrompt(), anchors, null, false);
    }
}
