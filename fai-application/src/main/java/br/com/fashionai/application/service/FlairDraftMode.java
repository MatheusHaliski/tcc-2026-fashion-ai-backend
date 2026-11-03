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
import br.com.fashionai.domain.repository.FlairMatchRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.FlairModeValues.ids;
import static br.com.fashionai.application.service.FlairModeValues.num;
import static br.com.fashionai.application.service.FlairModeValues.today;
import static br.com.fashionai.application.service.FlairModeViews.overall;

/** FLAIR Draft: 20 peças da comunidade, escolha alternada com a IA e três looks montados contra os da IA. */
final class FlairDraftMode {
    private final FlairModeLooks modeLooks;
    private final FlairMatchRecorder recorder;
    private final FlairMatchRepository matches;
    private final UserRepository users;
    private final Guard guard;

    FlairDraftMode(FlairModeLooks modeLooks, FlairMatchRecorder recorder, FlairMatchRepository matches, UserRepository users, Guard guard) {
        this.modeLooks = modeLooks;
        this.recorder = recorder;
        this.matches = matches;
        this.users = users;
        this.guard = guard;
    }

    Map<String, Object> draftStart(CurrentUser user) {
        guard.requireCanCreate(user);
        List<Card> pool = modeLooks.houseCards(user.id(), 20, modeLooks.seed("draft", user.id(), System.nanoTime()));
        if (pool.size() < 12) {
            throw new ApiException(409, "POUCAS_PECAS", Msg.t("flairModes.a_comunidade_ainda_nao_tem"));
        }
        FlairMatch m = new FlairMatch();
        m.setMode("DRAFT");
        m.setStatus("OPEN");
        m.setPlayDate(today());
        m.setCreatedByUser(users.findById(user.id()).orElseThrow());
        List<String> themes = new ArrayList<>(FlairLooks.THEMES.keySet());
        java.util.Collections.shuffle(themes, new Random(modeLooks.seed("draft-themes", user.id())));
        m.setResultJson(Json.write(Map.of("pool", pool.stream().map(Card::id).toList(), "A", List.of(), "B", List.of(), "pick", 0, "themes", themes.subList(0, 3))));
        matches.save(m);
        return draftView(m);
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> draftView(FlairMatch m) {
        Map<String, Object> st = Json.map(m.getResultJson());
        List<UUID> pool = ids(st.get("pool"));
        Map<String, Card> cards = modeLooks.cardsById(pool).stream().collect(Collectors.toMap(Card::id, c -> c, (a, b) -> a, LinkedHashMap::new));
        List<String> a = Json.strings(Json.write(st.get("A"))), b = Json.strings(Json.write(st.get("B")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", m.getId());
        out.put("status", m.getStatus());
        out.put("pool", cards.values().stream().filter(c -> !a.contains(c.id()) && !b.contains(c.id())).toList());
        out.put("mine", a.stream().map(cards::get).filter(Objects::nonNull).toList());
        out.put("theirs", b.stream().map(cards::get).filter(Objects::nonNull).toList());
        out.put("pick", num(st.get("pick")));
        out.put("turn", num(st.get("pick")) >= pool.size() ? "COMPOSE" : FlairLooks.draftTurn(num(st.get("pick"))));
        out.put("order", Msg.t("flairModes.a_b_b_a_a"));
        out.put("themes", Json.strings(Json.write(st.get("themes"))).stream().map(FlairLooks::theme).toList());
        if (st.get("result") != null) {
            out.put("result", st.get("result"));
        }
        return out;
    }

    Map<String, Object> draftPick(CurrentUser user, UUID id, UUID pieceId) {
        FlairMatch m = recorder.ownDraft(user, id, "DRAFT");
        if (!"OPEN".equals(m.getStatus())) {
            throw ApiException.conflict("DRAFT_FECHADO", Msg.t("flairModes.o_draft_ja_terminou"));
        }
        Map<String, Object> st = Json.map(m.getResultJson());
        List<String> pool = Json.strings(Json.write(st.get("pool")));
        List<String> a = new ArrayList<>(Json.strings(Json.write(st.get("A")))), b = new ArrayList<>(Json.strings(Json.write(st.get("B"))));
        int pick = num(st.get("pick"));
        if (!"A".equals(FlairLooks.draftTurn(pick))) {
            throw ApiException.conflict("VEZ_DO_OPONENTE", Msg.t("flairModes.aguarde_a_escolha_do_oponente"));
        }
        String pid = pieceId.toString();
        if (!pool.contains(pid) || a.contains(pid) || b.contains(pid)) {
            throw ApiException.badRequest("PECA_INDISPONIVEL", Msg.t("flairModes.essa_peca_nao_esta_mais"));
        }
        a.add(pid);
        pick++;
        Map<String, Card> cards = modeLooks.cardsById(ids(st.get("pool"))).stream().collect(Collectors.toMap(Card::id, c -> c, (x, y) -> x));
        // a IA escolhe na vez dela: equilibra categorias (3 partes de cima, 3 de baixo, 3 calçados, 1 acessório) e depois poder
        while (pick < pool.size() && "B".equals(FlairLooks.draftTurn(pick))) {
            Map<String, Long> have = b.stream().map(cards::get).filter(Objects::nonNull).collect(Collectors.groupingBy(c -> "full_body_piece".equals(c.category()) ? "upper_piece" : c.category(), Collectors.counting()));
            Map<String, Integer> want = Map.of("upper_piece", 3, "lower_piece", 3, "shoes_piece", 3, "accessory_piece", 1);
            List<Card> left = pool.stream().filter(x -> !a.contains(x) && !b.contains(x)).map(cards::get).filter(Objects::nonNull).toList();
            Card best = left.stream().max(Comparator.comparingDouble(c -> {
                String cat = "full_body_piece".equals(c.category()) ? "upper_piece" : c.category();
                return (have.getOrDefault(cat, 0L) < want.getOrDefault(cat, 1) ? 1000 : 0) + c.power();
            })).orElse(null);
            if (best == null) {
                break;
            }
            b.add(best.id());
            pick++;
        }
        st.put("A", a);
        st.put("B", b);
        st.put("pick", pick);
        m.setResultJson(Json.write(st));
        return draftView(m);
    }

    Map<String, Object> draftFinish(CurrentUser user, UUID id, List<List<UUID>> looks) {
        FlairMatch m = recorder.ownDraft(user, id, "DRAFT");
        if (!"OPEN".equals(m.getStatus())) {
            throw ApiException.conflict("DRAFT_FECHADO", Msg.t("flairModes.o_draft_ja_terminou"));
        }
        Map<String, Object> st = Json.map(m.getResultJson());
        List<String> pool = Json.strings(Json.write(st.get("pool")));
        if (num(st.get("pick")) < pool.size()) {
            throw ApiException.conflict("DRAFT_EM_ANDAMENTO", Msg.t("flairModes.termine_as_escolhas_antes_de"));
        }
        Set<String> a = new HashSet<>(Json.strings(Json.write(st.get("A"))));
        List<String> b = Json.strings(Json.write(st.get("B")));
        if (looks == null || looks.size() != 3) {
            throw ApiException.badRequest("LOOKS_INVALIDOS", Msg.t("flairModes.monte_exatamente_3_looks"));
        }
        Set<String> used = new HashSet<>();
        for (List<UUID> l : looks) {
            if (l == null || l.size() < 2) {
                throw ApiException.badRequest("LOOKS_INVALIDOS", Msg.t("flairModes.cada_look_precisa_de_ao"));
            }
            for (UUID p : l) {
                if (!a.contains(p.toString()) || !used.add(p.toString())) {
                    throw ApiException.badRequest("LOOKS_INVALIDOS", Msg.t("flairModes.use_so_as_suas_escolhas"));
                }
            }
        }
        Map<String, Card> cards = modeLooks.cardsById(ids(st.get("pool"))).stream().collect(Collectors.toMap(Card::id, c -> c, (x, y) -> x));
        List<Theme> themes = Json.strings(Json.write(st.get("themes"))).stream().map(FlairLooks::theme).toList();
        List<Card> aiLeft = new ArrayList<>(b.stream().map(cards::get).filter(Objects::nonNull).toList());
        List<Clash> rounds = new ArrayList<>();
        List<Look> mineLooks = new ArrayList<>(), theirLooks = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            Theme t = themes.get(i);
            List<Card> mc = looks.get(i).stream().map(x -> cards.get(x.toString())).toList();
            Look ml = modeLooks.lookOfCards(mc, "Look " + (i + 1), user.username());
            List<Card> ac = FlairLooks.bestLook(aiLeft, t, cs -> modeLooks.lookOfCards(cs, "IA", "CASA"));
            aiLeft.removeAll(ac);
            Look al = modeLooks.lookOfCards(ac, Msg.t("flairModes.look_ia", (i + 1)), "CASA");
            mineLooks.add(ml);
            theirLooks.add(al);
            rounds.add(FlairLooks.battle(ml, al, t));
        }
        String w = overall(rounds);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("rounds", rounds.stream().map(FlairModeViews::clashView).toList());
        r.put("me", mineLooks.stream().map(FlairModeViews::lookView).toList());
        r.put("opponent", Map.of("label", Msg.t("flairModes.ia_do_draft"), "looks", theirLooks.stream().map(FlairModeViews::lookView).toList()));
        r.put("scoreA", rounds.stream().filter(x -> "A".equals(x.winner())).count());
        r.put("scoreB", rounds.stream().filter(x -> "B".equals(x.winner())).count());
        st.put("result", r);
        m.setResultJson(Json.write(st));
        m.setStatus("FINISHED");
        m.setWinnerSide(w);
        Map<String, Object> out = recorder.finish(user, "DRAFT_RESULT", "Draft", w, r, List.of(), null, List.of());
        return out;
    }
}
