package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairLooks.Clash;
import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.FlairModeViews.clashView;

/** FLAIR Chess: tabuleiro 3×3 de cartas com influência entre vizinhas, sugestão automática e partida contra a IA. */
final class FlairChessMode {
    private final FlairModeLooks modeLooks;
    private final FlairMatchRecorder recorder;
    private final FlairService flair;
    private final WardrobeItemRepository pieces;
    private final Guard guard;

    FlairChessMode(FlairModeLooks modeLooks, FlairMatchRecorder recorder, FlairService flair, WardrobeItemRepository pieces, Guard guard) {
        this.modeLooks = modeLooks;
        this.recorder = recorder;
        this.flair = flair;
        this.pieces = pieces;
        this.guard = guard;
    }

    Map<String, Object> chessSuggest(CurrentUser user) {
        List<Card> mine = flair.cardsOf(pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList());
        Map<String, Card> board = FlairLooks.autoBoard(mine);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("slots", FlairLooks.BOARD);
        out.put("cards", mine);
        out.put("suggestion", board.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().id(), (a, b) -> a, LinkedHashMap::new)));
        out.put("preview", FlairLooks.chess(board));
        out.put("rules", List.of(Msg.t("flairModes.cada_carta_vale_poder_10"), Msg.t("flairModes.hero_centro_vale_1_25"),
                Msg.t("flairModes.peca_clara_em_cima_calca"), Msg.t("flairModes.tenis_ao_lado_de_cargo"),
                Msg.t("flairModes.mesma_familia_de_cor_3")));
        return out;
    }

    Map<String, Object> chess(CurrentUser user, Map<String, UUID> placement) {
        guard.requireCanCreate(user);
        if (placement == null || placement.isEmpty()) {
            throw ApiException.badRequest("TABULEIRO_VAZIO", Msg.t("flairModes.coloque_cartas_no_tabuleiro"));
        }
        Map<String, Card> board = new LinkedHashMap<>();
        Set<UUID> used = new HashSet<>();
        for (Map.Entry<String, UUID> e : placement.entrySet()) {
            if (!FlairLooks.BOARD.contains(e.getKey()) || e.getValue() == null) {
                continue;
            }
            if (!used.add(e.getValue())) {
                throw ApiException.badRequest("CARTA_REPETIDA", Msg.t("flairModes.cada_carta_ocupa_uma_posicao"));
            }
            WardrobeItem w = pieces.findById(e.getValue()).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            guard.requireOwner(user, w.getUser().getId(), "piece:" + e.getValue());
            board.put(e.getKey(), flair.card(w));
        }
        Map<String, Card> ai = FlairLooks.autoBoard(modeLooks.houseCards(user.id(), 12, modeLooks.seed("chess", user.id())));
        Map<String, Object> ea = FlairLooks.chess(board), eb = FlairLooks.chess(ai);
        double sa = ((Number) ea.get("total")).doubleValue(), sb = ((Number) eb.get("total")).doubleValue();
        String w = FlairLooks.winner(sa, sb);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("me", ea);
        r.put("opponent", Map.of("label", Msg.t("flairModes.ia_estrategista"), "board", eb, "cards", ai.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().name(), (x, y) -> x, LinkedHashMap::new))));
        r.put("rounds", List.of(clashView(new Clash(Msg.t("flairModes.tabuleiro_3_3"), "seu tabuleiro", "IA", sa, sb, w, List.of(), List.of()))));
        r.put("scoreA", sa);
        r.put("scoreB", sb);
        return recorder.finish(user, "CHESS", Msg.t("flairModes.fashion_strategy"), w, r, List.of(), null, List.of());
    }
}
