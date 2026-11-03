package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.RoomPlacement.Occupancy;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.model.RoomStorageEntry;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.RoomLayoutRepository;
import br.com.fashionai.domain.repository.RoomStorageEntryRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.context.ApplicationEventPublisher;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.RoomService.HANGERS_PER_DOOR;
import static br.com.fashionai.application.service.RoomService.coherent;
import static br.com.fashionai.application.service.RoomService.drawerCapacity;
import static br.com.fashionai.application.service.RoomModules.labelSources;
import static br.com.fashionai.application.service.RoomModules.labels;
import static br.com.fashionai.application.service.RoomModules.module;
import static br.com.fashionai.application.service.RoomModules.saveLabels;
import static br.com.fashionai.application.service.RoomPlacement.place;

/** Meu Quarto — organizar com IA (CA05): prévia de rótulos e movimentos (motor local ou IA), aplicação e desfazer. */
final class RoomOrganizer {
    private final WardrobeItemRepository pieces;
    private final RoomStorageEntryRepository storage;
    private final RoomLayoutRepository layouts;
    private final AiEngine ai;
    private final ApplicationEventPublisher events;
    private final RoomFurniture furniture;
    private final RoomAddressing addressing;

    RoomOrganizer(RoomContext ctx) {
        this.pieces = ctx.pieces;
        this.storage = ctx.storage;
        this.layouts = ctx.layouts;
        this.ai = ctx.ai;
        this.events = ctx.events;
        this.furniture = ctx.furniture;
        this.addressing = ctx.addressing;
    }

    // ================================================================== organizar com IA (CA05)
    Map<String, Object> organizePreview(CurrentUser user, boolean useAi) {
        RoomLayout layout = furniture.layout(user.id());
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(user.id());
        Map<UUID, WardrobeItem> byId = all.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        List<RoomStorageEntry> entries = addressing.entries(user.id(), all);
        Map<String, String> labels = labels(layout);
        Map<String, List<WardrobeItem>> drawerContent = new HashMap<>();
        for (RoomStorageEntry e : entries) {
            RoomAddress.parse(e.getAddress()).filter(a -> a.zone().equals("drawer")).ifPresent(a ->
                    drawerContent.computeIfAbsent(String.valueOf(a.index()), k -> new ArrayList<>()).add(byId.get(e.getWardrobeItemId())));
        }
        Map<String, String> proposed = new TreeMap<>((a, b) -> Integer.compare(Integer.parseInt(a), Integer.parseInt(b)));
        proposed.putAll(labels);
        drawerContent.forEach((idx, content) -> {
            String s = RoomPlacementRules.suggestLabel(content.stream().filter(Objects::nonNull).toList(), labels.get(idx));
            if (s != null) {
                proposed.put(idx, s);
            }
        });
        AiOutcome<Map<String, String>> outcome = null;
        if (useAi) {
            List<Map<String, Object>> summary = drawerContent.entrySet().stream().map(en -> Map.<String, Object>of("drawer", en.getKey(),
                    "label", String.valueOf(labels.get(en.getKey())), "subcategories", en.getValue().stream().filter(Objects::nonNull)
                            .map(WardrobeItem::getSubcategory).toList())).toList();
            Map<String, String> local = new LinkedHashMap<>(proposed);
            outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.COPILOT,
                    "Você organiza o closet digital do Fashion AI. Responda em " + Msg.languageName() + ". Proponha rótulos curtos (até 24 caracteres, nesse idioma) para as gavetas "
                            + "com base no conteúdo. Categorias padrão: Jeans, Academia, Praia, Acessórios, Íntimas, Favoritas. "
                            + "Responda SOMENTE com JSON {\"labels\":{\"<gaveta>\":\"<rótulo>\"}}.",
                    "Gavetas: " + Json.write(summary), List.of(), 600, List.of(Msg.t("room.subcategorias_das_pecas_por_gaveta")),
                    text -> {
                        Map<String, Object> m = WardrobeService.extractJson(text);
                        if (!(m.get("labels") instanceof Map<?, ?> lm)) {
                            return null;
                        }
                        Map<String, String> out = new LinkedHashMap<>(local);
                        lm.forEach((k, v) -> {
                            String idx = String.valueOf(k);
                            if (drawerContent.containsKey(idx) && v != null) {
                                out.put(idx, InputSanitizer.clean(String.valueOf(v), 24));
                            }
                        });
                        return out;
                    }, () -> local, null));
            if (outcome.value() != null) {
                proposed.clear();
                proposed.putAll(outcome.value());
            }
        }
        // redistribuição: mantém quem já está coerente e cabe; reposiciona o resto
        Occupancy occ = new Occupancy(new HashSet<>(), new HashMap<>(), new HashMap<>());
        List<Map<String, Object>> moves = new ArrayList<>();
        List<RoomStorageEntry> pending = new ArrayList<>();
        for (RoomStorageEntry e : entries) {
            WardrobeItem w = byId.get(e.getWardrobeItemId());
            RoomAddress a = RoomAddress.parse(e.getAddress()).orElse(null);
            boolean keep = w != null && a != null && !a.zone().equals("chair") && coherent(w, a, proposed)
                    && (!a.zone().equals("door") || a.sub() <= HANGERS_PER_DOOR && !occ.taken().contains(a.toString()))
                    && (!a.zone().equals("drawer") || occ.drawerCount().getOrDefault(String.valueOf(a.index()), 0) < drawerCapacity(w.getCategory())
                        && (occ.drawerCategory().get(String.valueOf(a.index())) == null || w.getCategory().equals(occ.drawerCategory().get(String.valueOf(a.index())))));
            if (keep) {
                occ.add(a, w.getCategory());
            } else {
                pending.add(e);
            }
        }
        for (RoomStorageEntry e : pending) {
            WardrobeItem w = byId.get(e.getWardrobeItemId());
            if (w == null) {
                continue;
            }
            RoomAddress target = place(w, layout, proposed, occ);
            if (!target.toString().equals(e.getAddress())) {
                Map<String, Object> mv = new LinkedHashMap<>();
                mv.put("pieceId", w.getId());
                mv.put("name", w.getName());
                mv.put("from", e.getAddress());
                mv.put("fromLabel", RoomAddress.parse(e.getAddress()).map(x -> x.label(labels)).orElse(""));
                mv.put("to", target.toString());
                mv.put("toLabel", target.label(proposed));
                mv.put("reason", target.zone().equals("drawer") ? Msg.t("room.categoria_da_gaveta") : target.zone().equals("door") ? Msg.t("room.peca_superior_vai_ao_cabideiro")
                        : target.zone().equals("chair") ? Msg.t("room.sem_posicao_livre") : Msg.t("room.posicao_do_tipo"));
                moves.add(mv);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("labels", proposed);
        out.put("changedLabels", proposed.entrySet().stream().filter(en -> !en.getValue().equals(labels.get(en.getKey())))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new)));
        out.put("moves", moves);
        out.put("summary", Msg.t("room.peca_s_reposicionada_s_gaveta", (moves.size()), ((Map<?, ?>) out.get("changedLabels")).size()));
        out.put("fallbackUsed", outcome != null && outcome.fallbackUsed());
        out.put("explanation", outcome == null ? null : outcome.explanation());
        out.put("canUndo", true);
        return out;
    }

    Map<String, Object> applyOrganization(CurrentUser user, Map<String, String> labels, List<Map<String, Object>> moves) {
        RoomLayout layout = furniture.layout(user.id());
        List<RoomStorageEntry> entries = storage.findByUserId(user.id());
        Map<String, Object> previous = new LinkedHashMap<>();
        previous.put("labels", labels(layout));
        previous.put("sources", labelSources(layout));
        previous.put("entries", entries.stream().collect(Collectors.toMap(e -> e.getWardrobeItemId().toString(), RoomStorageEntry::getAddress)));
        layout.setPreviousMapJson(Json.write(previous));
        Map<String, String> current = labels(layout);
        Map<String, String> sources = labelSources(layout);
        if (labels != null) {
            labels.forEach((k, v) -> {
                if (module(layout, "drawer:" + k).isPresent()) {
                    String clean = InputSanitizer.clean(v == null ? "" : v, 24);
                    if (clean.isBlank()) {
                        current.remove(k);
                        sources.remove(k);
                    } else if (!clean.equals(current.get(k))) {
                        current.put(k, clean);
                        sources.put(k, "AI");
                    }
                }
            });
        }
        saveLabels(layout, current, sources);
        layouts.save(layout);
        int applied = 0;
        if (moves != null) {
            for (Map<String, Object> mv : moves) {
                UUID pieceId = UUID.fromString(String.valueOf(mv.get("pieceId")));
                Optional<RoomAddress> to = RoomAddress.parse(String.valueOf(mv.get("to")));
                RoomStorageEntry e = entries.stream().filter(x -> x.getWardrobeItemId().equals(pieceId)).findFirst().orElse(null);
                if (e != null && to.isPresent()) {
                    e.setAddress(to.get().toString());
                    e.setAssignedBy("AI");
                    storage.save(e);
                    applied++;
                }
            }
        }
        events.publishEvent(new DomainEvents.RoomOrganized(user.id()));
        return Map.of("applied", applied, "labels", current, "canUndo", true);
    }

    Map<String, Object> undoOrganization(CurrentUser user) {
        RoomLayout layout = furniture.layout(user.id());
        Map<String, Object> previous = Json.map(layout.getPreviousMapJson());
        if (previous.isEmpty()) {
            throw new ApiException(409, "NADA_A_DESFAZER", Msg.t("room.nao_ha_organizacao_anterior_para"));
        }
        @SuppressWarnings("unchecked") Map<String, Object> labels = previous.get("labels") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
        @SuppressWarnings("unchecked") Map<String, Object> sources = previous.get("sources") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
        @SuppressWarnings("unchecked") Map<String, Object> entries = previous.get("entries") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
        Map<String, String> l = new LinkedHashMap<>();
        labels.forEach((k, v) -> l.put(k, String.valueOf(v)));
        Map<String, String> s = new LinkedHashMap<>();
        sources.forEach((k, v) -> s.put(k, String.valueOf(v)));
        saveLabels(layout, l, s);
        layout.setPreviousMapJson(null);
        layouts.save(layout);
        int restored = 0;
        for (RoomStorageEntry e : storage.findByUserId(user.id())) {
            Object addr = entries.get(e.getWardrobeItemId().toString());
            if (addr != null && !String.valueOf(addr).equals(e.getAddress())) {
                e.setAddress(String.valueOf(addr));
                e.setAssignedBy("USER");
                storage.save(e);
                restored++;
            }
        }
        return Map.of("restored", restored, "labels", l);
    }
}
