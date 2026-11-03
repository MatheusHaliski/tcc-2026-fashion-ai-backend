package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.RecommendationScoring;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.CopilotService.AskRequest;
import br.com.fashionai.application.service.CopilotService.BackgroundPrompt;
import br.com.fashionai.application.service.CopilotService.LookPrompt;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SchemeStatus;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.CopilotIntents.hasPieceConstraints;
import static br.com.fashionai.application.service.CopilotLookPrompt.lookPrompt;
import static br.com.fashionai.application.service.CopilotMoments.strings;
import static br.com.fashionai.application.service.CopilotService.MIN_PIECES;

/** Looks do Copilot: três sugestões distintas com justificativa (CA02/CA03/CA05) e o look fora do habitual (CA12). */
final class CopilotLooks extends CopilotTools {
    CopilotLooks(CopilotContext ctx) {
        super(ctx);
    }

    /** CA12 — maximiza a distância das combinações mais frequentes do histórico, só com peças disponíveis. */
    Map<String, Object> different(CurrentUser user, AskRequest req) {
        List<WardrobeItem> eligible = mirror.eligible(user.id());
        if (eligible.size() < MIN_PIECES) {
            throw new ApiException(422, "ACERVO_INSUFICIENTE", Msg.t("copilot.cadastre_ao_menos_3_pecas"), Map.of("href", "/pieces/new"));
        }
        Map<UUID, Long> freq = new HashMap<>();
        for (Scheme s : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED)) {
            schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).forEach(si -> freq.merge(si.getWardrobeItem().getId(), 1L, Long::sum));
        }
        Map<String, Long> styleFreq = new HashMap<>();
        eligible.stream().filter(w -> freq.containsKey(w.getId())).forEach(w -> Json.csv(w.getStyleTags()).forEach(s -> styleFreq.merge(s, freq.get(w.getId()), Long::sum)));
        Set<String> usual = styleFreq.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(2).map(Map.Entry::getKey).collect(Collectors.toSet());
        List<WardrobeItem> ranked = eligible.stream().sorted(Comparator.comparingLong((WardrobeItem w) -> freq.getOrDefault(w.getId(), 0L))
                .thenComparingLong(w -> Json.csv(w.getStyleTags()).stream().filter(usual::contains).count())).toList();
        List<WardrobeItem> look = new ArrayList<>();
        for (String slot : List.of("upper", "lower", "shoes")) {
            ranked.stream().filter(w -> MirrorService.slotOf(w).equals(slot)).findFirst().ifPresent(look::add);
        }
        if (look.stream().noneMatch(w -> MirrorService.slotOf(w).equals("upper")) || look.stream().noneMatch(w -> MirrorService.slotOf(w).equals("lower"))) {
            look.removeIf(w -> !MirrorService.slotOf(w).equals("shoes"));
            ranked.stream().filter(w -> MirrorService.slotOf(w).equals("dress")).findFirst().ifPresent(look::add);
        }
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("text", look.isEmpty() ? Msg.t("copilot.nao_consegui_montar_algo_diferente") : Msg.t("copilot.fugindo_do_seu_habitual_que", String.join(", ", usual), look.stream().map(WardrobeItem::getName).collect(Collectors.joining(" + "))));
        out.put("chips", look.stream().map(w -> chip(w, where)).toList());
        out.put("actions", look.isEmpty() ? List.of() : List.of(Map.of("type", "MOUNT_MIRROR", "pieceIds", look.stream().map(WardrobeItem::getId).toList()),
                Map.of("type", "OPEN_CREATE_LOOK", "draft", draft(look, "copilot", req.message()))));
        out.put("tools", List.of("historico_uso", "buscar_pecas"));
        return out;
    }

    static Map<String, Object> draft(List<WardrobeItem> look, String origin, String prompt) {
        Map<String, String> slots = new LinkedHashMap<>();
        List<String> acc = new ArrayList<>();
        for (WardrobeItem w : look) {
            String s = MirrorService.slotOf(w);
            if (s.equals("accessory")) {
                acc.add(w.getId().toString());
            } else {
                slots.put(s, w.getId().toString());
            }
        }
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("origin", origin);
        d.put("slots", slots);
        d.put("accessories", acc);
        d.put("prompt", prompt);
        d.put("created_at", java.time.Instant.now().toString());
        d.put("sessionStorageKey", "sai_room_look_draft");
        return d;
    }

    /** CA02/CA03/CA05 — 3 looks distintos com justificativa; sem repetir a rodada anterior; fallback local. */
    Map<String, Object> looks(CurrentUser user, AskRequest req, String message) {
        if (wardrobe.eligible(user.id()).size() < MIN_PIECES) {
            throw new ApiException(422, "ACERVO_INSUFICIENTE", Msg.t("copilot.o_copilot_precisa_de_ao_2"), Map.of("href", "/pieces/new"));
        }
        LookPrompt interpreted = lookPrompt(message, req.occasion(), req.mood());
        List<String> occasions = new ArrayList<>(interpreted.occasions());
        if (occasions.isEmpty()) {
            MirrorService.localInterpretation(message, List.of()).occasion().stream().filter(Taxonomy.OCCASIONS::contains).limit(3).forEach(occasions::add);
        }
        // Momentos §17: "monte um look para o Halloween…" — o Momento ativo mencionado empresta ocasiões e tema
        CopilotMoments momentContext = new CopilotMoments(ctx);
        Map<String, Object> moment = momentContext.detectMoment(user.id(), message);
        if (moment != null && occasions.isEmpty()) {
            strings(moment.get("occasionTags")).stream().filter(Taxonomy.OCCASIONS::contains).limit(2).forEach(occasions::add);
        }
        Set<UUID> requiredPieceIds = Set.of();
        if (hasPieceConstraints(message)) {
            requiredPieceIds = searchPieces(user.id(), message, true).stream().map(WardrobeItem::getId).collect(Collectors.toSet());
            if (requiredPieceIds.isEmpty()) {
                Map<String, Object> noMatch = new LinkedHashMap<>();
                noMatch.put("text", Msg.t("copilot.nao_encontrei_essa_peca_no"));
                noMatch.put("looks", List.of());
                noMatch.put("suggestions", List.of());
                noMatch.put("requestedFilters", Map.of("message", InputSanitizer.clean(message, 200)));
                return noMatch;
            }
        }
        BackgroundPrompt backgroundRequest = backgroundPrompt(message, interpreted.styles(), occasions);
        Deque<String> prev = shown.computeIfAbsent(user.id(), k -> new ArrayDeque<>());
        Set<String> exclude = new HashSet<>(prev);
        if (req.excludeKeys() != null) {
            exclude.addAll(req.excludeKeys());
        }
        Map<String, Object> result = autopilot.daily(user, new AutopilotService.DailyRequest(occasions, interpreted.mood(), req.city(), req.latitude(), req.longitude(),
                new ArrayList<>(exclude)), requiredPieceIds, interpreted.weather());
        @SuppressWarnings("unchecked") List<Map<String, Object>> suggestions = (List<Map<String, Object>>) result.getOrDefault("suggestions", List.of());
        suggestions.forEach(s -> {
            prev.addLast(String.valueOf(s.get("key")));
            while (prev.size() > 60) {
                prev.removeFirst();
            }
        });
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        for (Map<String, Object> s : suggestions) {
            @SuppressWarnings("unchecked") List<UUID> ids = (List<UUID>) s.get("pieceIds");
            List<WardrobeItem> look = pieces.findByIdIn(ids);
            s.put("chips", look.stream().map(w -> chip(w, where)).toList());
            s.put("actions", List.of(Map.of("type", "ACCEPT_DAILY_LOOK", "label", Msg.t("copilot.usar_como_look_do_dia")), Map.of("type", "MOUNT_MIRROR", "pieceIds", ids),
                    Map.of("type", "OPEN_CREATE_LOOK", "draft", draft(look, "copilot", message))));
            s.put("occasion", occasions);
            s.put("style", interpreted.styles());
            s.put("mood", interpreted.mood());
            s.put("season", interpreted.season());
            s.put("weather", interpreted.weather());
            s.put("background", backgroundRequest.configuration());
            s.put("description", message);
        }
        Map<String, Object> out = new LinkedHashMap<>(result);
        out.put("text", suggestions.isEmpty() ? String.valueOf(result.getOrDefault("message", "Sem combinações novas.")) : lookSummary(suggestions.size(), occasions));
        if (!backgroundRequest.unresolved().isEmpty()) out.put("backgroundNotice", backgroundRequest.unresolved());
        List<Map<String, Object>> lookCards = suggestions.stream().map(s -> {
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("title", s.get("title"));
            card.put("pieceIds", s.get("pieceIds"));
            card.put("pieces", s.getOrDefault("chips", List.of()));
            card.put("why", s.get("rationale"));
            card.put("occasion", occasions);
            card.put("style", interpreted.styles());
            card.put("mood", interpreted.mood());
            card.put("season", interpreted.season());
            card.put("weather", interpreted.weather());
            card.put("background", backgroundRequest.configuration());
            card.put("description", InputSanitizer.clean(message, 2048));
            return card;
        }).toList();
        RecommendationScoring.Mode mode = RecommendationScoring.Mode.parse(req.mode());
        List<Map<String, Object>> scored = scoreLooks(user, lookCards, mode);
        if (moment != null) {
            scored = momentContext.withMomentMatch(scored, moment, occasions);
            out.put("momentNotice", momentContext.momentNotice(moment, scored));
            out.put("moment", Map.of("id", moment.get("id"), "slug", moment.get("slug"), "name", moment.get("name")));
        }
        out.put("looks", scored);
        out.put("mode", mode == null ? null : mode.name());
        if (hasPieceConstraints(message)) out.put("requestedFilters", Map.of("pieceIds", requiredPieceIds));
        out.put("tools", List.of("buscar_pecas", "listar_looks", "montar_no_espelho", "abrir_criar_look"));
        return out;
    }

    /** "Separei 2 looks … para trabalho/festa": ocasiões pelo rótulo da taxonomia, a frase inteira no idioma da pessoa. */
    static String lookSummary(int count, List<String> occasions) {
        if (occasions == null || occasions.isEmpty()) {
            return Msg.t("copilot.separei_looks_com_pecas_do", count, "");
        }
        String labels = String.join("/", occasions.stream().map(o -> WardrobeService.label(o).toLowerCase(Msg.locale())).toList());
        return Msg.t("copilot.separei_looks_para", count, labels);
    }
}
