package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.Theme;
import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.FlairModesService.Square;
import br.com.fashionai.domain.model.FlairModeState;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairModeCatalog.BOARD;
import static br.com.fashionai.application.service.FlairModeCatalog.CITIES;
import static br.com.fashionai.application.service.FlairModeValues.num;
import static br.com.fashionai.application.service.FlairModeValues.seasonKey;
import static br.com.fashionai.application.service.FlairModeValues.today;
import static br.com.fashionai.application.service.FlairModeViews.lookView;

/** Fashion World Tour: tabuleiro de cidades, dado com limite diário, casas de bônus/aeroporto e desafios com alvo. */
final class FlairWorldTour {
    private static final SecureRandom DICE = new SecureRandom();

    private final FlairModeLooks modeLooks;
    private final FlairMatchRecorder recorder;
    private final Guard guard;

    FlairWorldTour(FlairModeLooks modeLooks, FlairMatchRecorder recorder, Guard guard) {
        this.modeLooks = modeLooks;
        this.recorder = recorder;
        this.guard = guard;
    }

    Map<String, Object> tour(CurrentUser user) {
        FlairModeState s = recorder.state(user.id(), "TOUR", seasonKey());
        return tourView(s);
    }

    Map<String, Object> tourView(FlairModeState s) {
        Map<String, Object> st = Json.map(s.getStateJson());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("season", s.getSeasonKey());
        out.put("board", BOARD);
        out.put("cities", CITIES);
        out.put("position", num(st.get("position")));
        out.put("lap", num(st.get("lap")));
        out.put("points", num(st.get("points")));
        out.put("pending", st.get("pending"));
        out.put("lastRoll", st.get("lastRoll"));
        out.put("log", st.getOrDefault("log", List.of()));
        out.put("rollsLeft", Math.max(0, 6 - num(st.get("rolls_" + today()))));
        out.put("rule", Msg.t("flairModes.role_o_dado_6_por"));
        return out;
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> roll(CurrentUser user) {
        guard.requireCanCreate(user);
        FlairModeState s = recorder.state(user.id(), "TOUR", seasonKey());
        Map<String, Object> st = Json.map(s.getStateJson());
        if (st.get("pending") != null) {
            throw ApiException.conflict("CASA_PENDENTE", Msg.t("flairModes.resolva_o_desafio_da_casa"));
        }
        String rk = "rolls_" + today();
        if (num(st.get(rk)) >= 6) {
            throw ApiException.conflict("SEM_DADOS", Msg.t("flairModes.voce_ja_rolou_6_vezes"));
        }
        st.put(rk, num(st.get(rk)) + 1);
        int dice = DICE.nextInt(6) + 1;
        int pos = num(st.get("position")) + dice;
        List<Map<String, Object>> log = new ArrayList<>((List<Map<String, Object>>) st.getOrDefault("log", new ArrayList<>()));
        if (pos >= BOARD.size()) {
            pos -= BOARD.size();
            st.put("lap", num(st.get("lap")) + 1);
            st.put("points", num(st.get("points")) + 25);
            log.add(0, Map.of("text", Msg.k("flairModes.volta_completa_25"), "at", Instant.now().toString()));
            recorder.trophy(user.id(), "TOUR", Msg.t("flairModes.fashion_world_tour_volta", num(st.get("lap"))), seasonKey(), Map.of("points", st.get("points")));
        }
        Square sq = BOARD.get(pos);
        String text;
        switch (sq.type()) {
            case "BONUS", "START" -> {
                st.put("points", num(st.get("points")) + sq.reward());
                text = sq.emoji() + " " + sq.title() + ": +" + sq.reward();
            }
            case "AIRPORT" -> {
                int next = pos + 1;
                while (next < BOARD.size() && !BOARD.get(next).city().equals(BOARD.get(Math.min(BOARD.size() - 1, pos + 1)).city())) {
                    next++;
                }
                pos = Math.min(BOARD.size() - 1, pos + 1);
                sq = BOARD.get(pos);
                text = Msg.t("flairModes.voo_para", sq.city(), sq.emoji(), sq.title());
                if ("CHALLENGE".equals(sq.type())) {
                    st.put("pending", pos);
                }
            }
            default -> {
                st.put("pending", pos);
                text = sq.emoji() + " " + sq.title() + ": " + sq.rule();
            }
        }
        st.put("position", pos);
        st.put("lastRoll", dice);
        log.add(0, Map.of("text", "🎲 " + dice + " · " + text, "at", Instant.now().toString()));
        st.put("log", log.stream().limit(20).toList());
        s.setStateJson(Json.write(st));
        Map<String, Object> out = tourView(s);
        out.put("dice", dice);
        out.put("square", sq);
        return out;
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> resolveTour(CurrentUser user, UUID schemeId) {
        FlairModeState s = recorder.state(user.id(), "TOUR", seasonKey());
        Map<String, Object> st = Json.map(s.getStateJson());
        if (st.get("pending") == null) {
            throw ApiException.conflict("SEM_DESAFIO", Msg.t("flairModes.nao_ha_desafio_pendente_role"));
        }
        Square sq = BOARD.get(num(st.get("pending")));
        Theme t = FlairLooks.theme(sq.theme());
        Look mine = modeLooks.look(modeLooks.ownScheme(user, schemeId));
        FlairLooks.Score sc = FlairLooks.score(mine, t);
        boolean pass = sc.total() >= sq.target();
        List<Map<String, Object>> log = new ArrayList<>((List<Map<String, Object>>) st.getOrDefault("log", new ArrayList<>()));
        int gained = pass ? sq.reward() : 5;
        st.put("points", num(st.get("points")) + gained);
        st.remove("pending");
        log.add(0, Map.of("text", (pass ? "✅ " : "➖ ") + sq.title() + " com \"" + mine.title() + "\": " + sc.total() + " / alvo " + sq.target() + " → +" + gained, "at", Instant.now().toString()));
        st.put("log", log.stream().limit(20).toList());
        s.setStateJson(Json.write(st));
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("square", sq);
        r.put("theme", t);
        r.put("look", lookView(mine));
        r.put("score", sc);
        r.put("pass", pass);
        r.put("gained", gained);
        r.put("scoreA", sc.total());
        r.put("scoreB", sq.target());
        Map<String, Object> out = recorder.finish(user, "TOUR", sq.title(), pass ? "A" : "B", r, List.of(mine), null, List.of());
        out.put("tour", tourView(s));
        return out;
    }
}
