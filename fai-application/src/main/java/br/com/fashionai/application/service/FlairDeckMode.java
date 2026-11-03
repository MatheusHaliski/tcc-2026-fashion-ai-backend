package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairLooks.Clash;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.Theme;
import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.FlairMatch;
import br.com.fashionai.domain.model.FlairModeState;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.repository.FlairMatchRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.FlairModeValues.ids;
import static br.com.fashionai.application.service.FlairModeValues.today;
import static br.com.fashionai.application.service.FlairModeViews.clashView;
import static br.com.fashionai.application.service.FlairModeViews.lookView;

/** Deck Battle (TCG): deck de 12 cartas com composição fixa, mão sorteada e o melhor look contra a mão da Casa. */
final class FlairDeckMode {
    private final FlairModeLooks modeLooks;
    private final FlairMatchRecorder recorder;
    private final FlairService flair;
    private final WardrobeItemRepository pieces;
    private final FlairMatchRepository matches;
    private final UserRepository users;
    private final Guard guard;

    FlairDeckMode(FlairModeLooks modeLooks, FlairMatchRecorder recorder, FlairService flair, WardrobeItemRepository pieces,
                  FlairMatchRepository matches, UserRepository users, Guard guard) {
        this.modeLooks = modeLooks;
        this.recorder = recorder;
        this.flair = flair;
        this.pieces = pieces;
        this.matches = matches;
        this.users = users;
        this.guard = guard;
    }

    static final Map<String, Integer> DECK_RULE = Map.of("upper_piece", 4, "lower_piece", 3, "shoes_piece", 2, "accessory_piece", 2, "wildcard", 1);

    Map<String, Object> deck(CurrentUser user) {
        Map<String, Object> st = Json.map(recorder.state(user.id(), "DECK", "ALL").getStateJson());
        List<Card> cards = modeLooks.cardsById(ids(st.get("cards")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("cards", cards);
        out.put("rule", Map.of("upper_piece", 4, "lower_piece", 3, "shoes_piece", 2, "accessory_piece", 2, "wildcard", 1, "total", 12));
        out.put("valid", cards.size() == 12);
        out.put("suggestion", suggestDeck(user.id()).stream().map(Card::id).toList());
        return out;
    }

    List<Card> suggestDeck(UUID userId) {
        List<Card> mine = flair.cardsOf(pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList())
                .stream().sorted(Comparator.comparingInt(Card::power).reversed()).toList();
        List<Card> out = new ArrayList<>();
        for (Map.Entry<String, Integer> e : Map.of("upper_piece", 4, "lower_piece", 3, "shoes_piece", 2, "accessory_piece", 2).entrySet()) {
            mine.stream().filter(c -> e.getKey().equals(c.category()) || "upper_piece".equals(e.getKey()) && "full_body_piece".equals(c.category()))
                    .filter(c -> !out.contains(c)).limit(e.getValue()).forEach(out::add);
        }
        mine.stream().filter(c -> !out.contains(c)).findFirst().ifPresent(out::add);
        return out;
    }

    Map<String, Object> saveDeck(CurrentUser user, List<UUID> pieceIds) {
        if (pieceIds == null || pieceIds.size() != 12 || new HashSet<>(pieceIds).size() != 12) {
            throw ApiException.badRequest("DECK_INVALIDO", Msg.t("flairModes.o_deck_tem_12_cartas"));
        }
        List<Card> cards = new ArrayList<>();
        for (UUID p : pieceIds) {
            WardrobeItem w = pieces.findById(p).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            guard.requireOwner(user, w.getUser().getId(), "piece:" + p);
            cards.add(flair.card(w));
        }
        Map<String, Long> have = cards.stream().collect(Collectors.groupingBy(c -> "full_body_piece".equals(c.category()) ? "upper_piece" : c.category(), Collectors.counting()));
        int spare = 0;
        for (String cat : List.of("upper_piece", "lower_piece", "shoes_piece", "accessory_piece")) {
            long n = have.getOrDefault(cat, 0L);
            if (n < DECK_RULE.get(cat)) {
                throw ApiException.badRequest("DECK_INVALIDO", Msg.t("flairModes.faltam_cartas_de", FlairService.CATEGORY_LABELS.getOrDefault(cat, cat), n, DECK_RULE.get(cat)));
            }
            spare += n - DECK_RULE.get(cat);
        }
        if (spare != 1) {
            throw ApiException.badRequest("DECK_INVALIDO", Msg.t("flairModes.composicao_4_superiores_3_inferiores"));
        }
        FlairModeState s = recorder.state(user.id(), "DECK", "ALL");
        s.setStateJson(Json.write(Map.of("cards", pieceIds.stream().map(UUID::toString).toList())));
        return deck(user);
    }

    Map<String, Object> deckStart(CurrentUser user) {
        guard.requireCanCreate(user);
        List<Card> deck = modeLooks.cardsById(ids(Json.map(recorder.state(user.id(), "DECK", "ALL").getStateJson()).get("cards")));
        if (deck.size() < 12) {
            throw new ApiException(409, "SEM_DECK", Msg.t("flairModes.monte_o_deck_de_12"));
        }
        long seed = modeLooks.seed("deck", user.id(), System.nanoTime());
        Theme t = FlairLooks.drawTheme(seed);
        List<Card> shuffled = new ArrayList<>(deck);
        java.util.Collections.shuffle(shuffled, new Random(seed));
        List<Card> hand = new ArrayList<>();
        for (String cat : List.of("upper_piece", "lower_piece", "shoes_piece")) {
            shuffled.stream().filter(c -> cat.equals(c.category()) || "upper_piece".equals(cat) && "full_body_piece".equals(c.category())).findFirst().ifPresent(c -> {
                hand.add(c);
                shuffled.remove(c);
            });
        }
        shuffled.stream().limit(7 - hand.size()).forEach(hand::add);
        List<Card> houseHand = modeLooks.houseCards(user.id(), 7, seed + 1);
        FlairMatch m = new FlairMatch();
        m.setMode("DECK");
        m.setStatus("OPEN");
        m.setPlayDate(today());
        m.setTheme(t.label());
        m.setCreatedByUser(users.findById(user.id()).orElseThrow());
        m.setResultJson(Json.write(Map.of("theme", t.code(), "hand", hand.stream().map(Card::id).toList(), "house", houseHand.stream().map(Card::id).toList())));
        matches.save(m);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", m.getId());
        out.put("challenge", t);
        out.put("hand", hand);
        out.put("hint", FlairLooks.bestLook(hand, t, cs -> modeLooks.lookOfCards(cs, "dica", user.username())).stream().map(Card::id).toList());
        out.put("rule", Msg.t("flairModes.monte_o_melhor_look_com"));
        return out;
    }

    Map<String, Object> deckPlay(CurrentUser user, UUID id, List<UUID> pieceIds) {
        FlairMatch m = recorder.ownDraft(user, id, "DECK");
        if (!"OPEN".equals(m.getStatus())) {
            throw ApiException.conflict("PARTIDA_FECHADA", Msg.t("flairModes.essa_partida_ja_terminou"));
        }
        Map<String, Object> st = Json.map(m.getResultJson());
        Set<String> hand = new HashSet<>(Json.strings(Json.write(st.get("hand"))));
        if (pieceIds == null || pieceIds.size() < 2 || pieceIds.size() > 5 || !pieceIds.stream().allMatch(p -> hand.contains(p.toString()))) {
            throw ApiException.badRequest("JOGADA_INVALIDA", Msg.t("flairModes.escolha_de_2_a_5"));
        }
        Theme t = FlairLooks.theme(String.valueOf(st.get("theme")));
        Look mine = modeLooks.lookOfCards(modeLooks.cardsById(pieceIds), Msg.t("flairModes.meu_look"), user.username());
        List<Card> house = modeLooks.cardsById(ids(st.get("house")));
        Look theirs = modeLooks.lookOfCards(FlairLooks.bestLook(house, t, cs -> modeLooks.lookOfCards(cs, "Casa", "CASA")), Msg.t("flairModes.look_da_casa"), "CASA");
        Clash c = FlairLooks.battle(mine, theirs, t);
        m.setStatus("FINISHED");
        m.setWinnerSide(c.winner());
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("challenge", t);
        r.put("me", lookView(mine));
        r.put("opponent", Map.of("label", Msg.t("common.a_casa"), "look", lookView(theirs)));
        r.put("rounds", List.of(clashView(c)));
        r.put("scoreA", c.scoreA());
        r.put("scoreB", c.scoreB());
        return recorder.finish(user, "DECK_RESULT", t.label(), c.winner(), r, List.of(mine), null, List.of());
    }
}
