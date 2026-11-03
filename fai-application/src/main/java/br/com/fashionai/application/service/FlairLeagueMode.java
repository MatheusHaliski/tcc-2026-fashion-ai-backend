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
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.FlairModeState;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.FlairMatchEntryRepository;
import br.com.fashionai.domain.repository.FlairModeStateRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.Instant;
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

import static br.com.fashionai.application.service.FlairModeValues.ids;
import static br.com.fashionai.application.service.FlairModeValues.num;
import static br.com.fashionai.application.service.FlairModeValues.seasonKey;
import static br.com.fashionai.application.service.FlairModeValues.today;
import static br.com.fashionai.application.service.FlairModeViews.overall;

/** Fashion League: elenco da temporada, tabela com pontos e pontos de estilo, rodadas contra elencos ou bots da Casa. */
final class FlairLeagueMode {
    private final FlairModeLooks modeLooks;
    private final FlairMatchRecorder recorder;
    private final FlairModeStateRepository states;
    private final FlairMatchEntryRepository entries;
    private final WardrobeItemRepository pieces;
    private final Guard guard;

    FlairLeagueMode(FlairModeLooks modeLooks, FlairMatchRecorder recorder, FlairModeStateRepository states,
                    FlairMatchEntryRepository entries, WardrobeItemRepository pieces, Guard guard) {
        this.modeLooks = modeLooks;
        this.recorder = recorder;
        this.states = states;
        this.entries = entries;
        this.pieces = pieces;
        this.guard = guard;
    }

    Map<String, Object> saveRoster(CurrentUser user, List<UUID> starters, List<UUID> reserves, List<UUID> specials) {
        guard.requireCanCreate(user);
        if (starters == null || starters.isEmpty() || starters.size() > 5) {
            throw ApiException.badRequest("ELENCO_INVALIDO", Msg.t("flairModes.escolha_de_1_a_5"));
        }
        if (reserves != null && reserves.size() > 3 || specials != null && specials.size() > 5) {
            throw ApiException.badRequest("ELENCO_INVALIDO", Msg.t("flairModes.ate_3_reservas_e_5"));
        }
        Set<UUID> all = new HashSet<>(starters);
        if (reserves != null) {
            for (UUID r : reserves) {
                if (!all.add(r)) {
                    throw ApiException.badRequest("ELENCO_INVALIDO", Msg.t("flairModes.um_look_nao_pode_ser"));
                }
            }
        }
        all.forEach(id -> modeLooks.ownScheme(user, id));
        if (specials != null) {
            for (UUID p : specials) {
                WardrobeItem w = pieces.findById(p).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
                guard.requireOwner(user, w.getUser().getId(), "piece:" + p);
            }
        }
        FlairModeState s = recorder.state(user.id(), "LEAGUE", seasonKey());
        Map<String, Object> st = Json.map(s.getStateJson());
        st.put("starters", starters.stream().map(UUID::toString).toList());
        st.put("reserves", reserves == null ? List.of() : reserves.stream().map(UUID::toString).toList());
        st.put("specials", specials == null ? List.of() : specials.stream().map(UUID::toString).toList());
        st.putIfAbsent("played", 0);
        st.putIfAbsent("wins", 0);
        st.putIfAbsent("draws", 0);
        st.putIfAbsent("losses", 0);
        st.putIfAbsent("points", 0);
        st.putIfAbsent("stylePoints", stylePoints(st));
        st.remove("hype");   // nome antigo (homônimo do HypeScore): migra para stylePoints na primeira escrita
        s.setStateJson(Json.write(st));
        return league(user);
    }

    /** Pontos de estilo da liga (soma das notas das rodadas). Estados gravados antes da troca de nome guardam em "hype". */
    static int stylePoints(Map<String, Object> st) {
        return st.containsKey("stylePoints") ? num(st.get("stylePoints")) : num(st.get("hype"));
    }

    Map<String, Object> league(CurrentUser user) {
        String season = seasonKey();
        List<Map<String, Object>> table = new ArrayList<>();
        for (FlairModeState s : states.findByModeAndSeasonKey("LEAGUE", season)) {
            Map<String, Object> st = Json.map(s.getStateJson());
            if (ids(st.get("starters")).isEmpty()) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("user", Views.user(s.getUser()));
            row.put("played", num(st.get("played")));
            row.put("wins", num(st.get("wins")));
            row.put("draws", num(st.get("draws")));
            row.put("losses", num(st.get("losses")));
            row.put("points", num(st.get("points")));
            row.put("stylePoints", stylePoints(st));
            row.put("hype", stylePoints(st));   // deprecado: alias de stylePoints (não é HypeScore); sai em P3-16
            row.put("division", FlairLooks.division(num(st.get("points"))));
            row.put("you", s.getUser().getId().equals(user.id()));
            table.add(row);
        }
        table.sort(Comparator.comparingInt((Map<String, Object> m) -> num(m.get("points"))).reversed().thenComparing(m -> -num(m.get("stylePoints"))));
        for (int i = 0; i < table.size(); i++) {
            table.get(i).put("position", i + 1);
        }
        Map<String, Object> mine = states.findByUserIdAndModeAndSeasonKey(user.id(), "LEAGUE", season).map(s -> Json.map(s.getStateJson())).orElse(Map.of());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("season", season);
        out.put("table", table);
        out.put("roster", mine);
        out.put("division", FlairLooks.division(num(mine.get("points"))));
        out.put("rule", Msg.t("flairModes.temporada_de_4_semanas_5"));
        return out;
    }

    Map<String, Object> playLeague(CurrentUser user) {
        guard.requireCanCreate(user);
        String season = seasonKey();
        FlairModeState mineState = states.findByUserIdAndModeAndSeasonKey(user.id(), "LEAGUE", season)
                .orElseThrow(() -> new ApiException(409, "SEM_ELENCO", Msg.t("flairModes.monte_o_elenco_da_temporada")));
        Map<String, Object> a = Json.map(mineState.getStateJson());
        Instant dayStart = today().atStartOfDay(FaiPointsService.ZONE).toInstant();
        long playedToday = entries.findByUserIdAndCreatedAtAfter(user.id(), dayStart).stream().filter(e -> "LEAGUE".equals(e.getMatch().getMode()) && "A".equals(e.getSide())).count();
        if (playedToday >= 3) {
            throw ApiException.conflict("LIMITE_LIGA", Msg.t("flairModes.voce_ja_jogou_3_rodadas"));
        }
        List<FlairModeState> others = states.findByModeAndSeasonKey("LEAGUE", season).stream()
                .filter(s -> !s.getUser().getId().equals(user.id()) && !ids(Json.map(s.getStateJson()).get("starters")).isEmpty()).toList();
        FlairModeState opp = others.stream().min(Comparator.comparingInt((FlairModeState s) -> num(Json.map(s.getStateJson()).get("played")))
                .thenComparing(s -> Math.floorMod(Objects.hash(s.getUser().getId(), today()), 97))).orElse(null);
        int matchday = num(a.get("played")) + 1;
        List<Theme> sits = new ArrayList<>();
        Random rnd = new Random(Objects.hash(season, matchday));
        List<Theme> pool = new ArrayList<>(FlairLooks.THEMES.values());
        java.util.Collections.shuffle(pool, rnd);
        sits.addAll(pool.subList(0, 5));
        List<Look> sa = modeLooks.looksById(ids(a.get("starters"))), ra = modeLooks.looksById(ids(a.get("reserves")));
        List<Card> ca = modeLooks.cardsById(ids(a.get("specials")));
        List<Look> sb, rb;
        List<Card> cb;
        User rival = null;
        Map<String, Object> b = null;
        if (opp != null) {
            rival = opp.getUser();
            b = Json.map(opp.getStateJson());
            sb = modeLooks.looksById(ids(b.get("starters")));
            rb = modeLooks.looksById(ids(b.get("reserves")));
            cb = modeLooks.cardsById(ids(b.get("specials")));
        } else {
            sb = modeLooks.pickSquad(modeLooks.houseLooks(user.id(), 10, modeLooks.seed("league", matchday)), 5);
            rb = List.of();
            cb = List.of();
        }
        List<Clash> rounds = FlairLooks.leagueMatch(sa, ra, ca, sb, rb, cb, sits);
        String w = overall(rounds);
        int styleA = (int) Math.round(rounds.stream().mapToDouble(Clash::scoreA).sum()), styleB = (int) Math.round(rounds.stream().mapToDouble(Clash::scoreB).sum());
        table(a, w, "A", styleA);
        mineState.setStateJson(Json.write(a));
        if (opp != null) {
            table(b, w, "B", styleB);
            opp.setStateJson(Json.write(b));
        }
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("season", season);
        r.put("matchday", matchday);
        r.put("situations", sits);
        r.put("opponent", Map.of("label", rival == null ? Msg.t("flairModes.flair_bots_amistoso_da_casa") : "@" + rival.getUsername()));
        r.put("rounds", rounds.stream().map(FlairModeViews::clashView).toList());
        r.put("scoreA", rounds.stream().filter(x -> "A".equals(x.winner())).count());
        r.put("scoreB", rounds.stream().filter(x -> "B".equals(x.winner())).count());
        r.put("division", FlairLooks.division(num(a.get("points"))));
        Map<String, Object> div = FlairLooks.division(num(a.get("points")));
        if (!"BRONZE".equals(div.get("code"))) {
            recorder.trophy(user.id(), "LEAGUE", Msg.t("flairModes.fashion_league_divisao", div.get("label")), season, Map.of("points", a.get("points")));
        }
        return recorder.finish(user, "LEAGUE", "Rodada " + matchday, w, r, sa, rival, sb);
    }

    /** Atualiza a tabela da liga; {@code stylePoints} = soma das notas da rodada (não é HypeScore). */
    static void table(Map<String, Object> st, String winner, String side, int stylePoints) {
        st.put("played", num(st.get("played")) + 1);
        st.put("stylePoints", stylePoints(st) + stylePoints);
        st.remove("hype");
        if ("DRAW".equals(winner)) {
            st.put("draws", num(st.get("draws")) + 1);
            st.put("points", num(st.get("points")) + 1);
        } else if (side.equals(winner)) {
            st.put("wins", num(st.get("wins")) + 1);
            st.put("points", num(st.get("points")) + 3);
        } else {
            st.put("losses", num(st.get("losses")) + 1);
        }
    }
}
