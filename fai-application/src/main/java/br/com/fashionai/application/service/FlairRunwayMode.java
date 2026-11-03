package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.Theme;
import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.FlairModeState;
import br.com.fashionai.domain.repository.FlairModeStateRepository;

import java.time.temporal.IsoFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairModeValues.today;
import static br.com.fashionai.application.service.FlairModeValues.weekKey;

/** FLAIR Runway: desfile semanal com tema rotativo, qualificação, semifinal e final contra convidados da comunidade. */
final class FlairRunwayMode {
    private final FlairModeLooks modeLooks;
    private final FlairMatchRecorder recorder;
    private final FlairModeStateRepository states;
    private final Guard guard;

    FlairRunwayMode(FlairModeLooks modeLooks, FlairMatchRecorder recorder, FlairModeStateRepository states, Guard guard) {
        this.modeLooks = modeLooks;
        this.recorder = recorder;
        this.states = states;
        this.guard = guard;
    }

    static final List<String> RUNWAY_THEMES = List.of("CYBERPUNK_FORMAL", "RED_CARPET", "PARIS_COUTURE", "FESTIVAL_NOITE", "SEOUL_KFASHION", "LONDON_VINTAGE");

    static Theme runwayTheme() {
        return FlairLooks.theme(RUNWAY_THEMES.get(Math.floorMod(today().get(IsoFields.WEEK_OF_WEEK_BASED_YEAR), RUNWAY_THEMES.size())));
    }

    static String runwaySeason() {
        return String.format("%02d", (today().getDayOfYear() - 1) / 28 + 1);
    }

    Map<String, Object> runway(CurrentUser user) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("theme", runwayTheme());
        out.put("week", weekKey());
        out.put("season", runwaySeason());
        out.put("rule", Msg.t("flairModes.n8_looks_qualificacao_8_4"));
        out.put("entry", states.findByUserIdAndModeAndSeasonKey(user.id(), "RUNWAY", weekKey()).map(s -> Json.map(s.getStateJson())).orElse(null));
        return out;
    }

    Map<String, Object> enterRunway(CurrentUser user, UUID schemeId) {
        guard.requireCanCreate(user);
        if (states.findByUserIdAndModeAndSeasonKey(user.id(), "RUNWAY", weekKey()).isPresent()) {
            throw ApiException.conflict("JA_NA_RUNWAY", Msg.t("flairModes.voce_ja_desfilou_nesta_semana"));
        }
        Theme t = runwayTheme();
        Look mine = modeLooks.look(modeLooks.ownScheme(user, schemeId));
        long seed = modeLooks.seed("runway", weekKey());
        // 7 looks convidados da comunidade (um por pessoa), os mais compatíveis com o tema
        Map<String, Look> byOwner = new LinkedHashMap<>();
        modeLooks.houseLooks(user.id(), 40, seed).stream().sorted(Comparator.comparingDouble((Look l) -> FlairLooks.score(l, t).total()).reversed())
                .forEach(l -> byOwner.putIfAbsent(l.owner(), l));
        List<Look> field = new ArrayList<>();
        field.add(mine);
        byOwner.values().stream().limit(7).forEach(field::add);
        List<Map<String, Object>> stages = new ArrayList<>();
        List<Look> alive = new ArrayList<>(field);
        // qualificação
        Map<Look, Double> q = new LinkedHashMap<>();
        alive.forEach(l -> q.put(l, FlairLooks.runwayScore(l, t, 1, seed)));
        List<Look> top4 = q.entrySet().stream().sorted(Map.Entry.<Look, Double>comparingByValue().reversed()).limit(4).map(Map.Entry::getKey).toList();
        stages.add(Map.of("stage", Msg.t("flairModes.qualificacao"), "results", q.entrySet().stream().sorted(Map.Entry.<Look, Double>comparingByValue().reversed())
                .map(e -> Map.of("title", e.getKey().title(), "owner", e.getKey().owner(), "score", e.getValue(), "you", e.getKey() == mine, "advanced", top4.contains(e.getKey()))).toList()));
        // semifinal
        List<Look> finalists = new ArrayList<>();
        List<Map<String, Object>> semis = new ArrayList<>();
        for (int[] pair : new int[][]{{0, 3}, {1, 2}}) {
            if (top4.size() <= pair[1]) {
                continue;
            }
            Look x = top4.get(pair[0]), y = top4.get(pair[1]);
            double sx = FlairLooks.runwayScore(x, t, 2, seed), sy = FlairLooks.runwayScore(y, t, 2, seed);
            Look win = sx >= sy ? x : y;
            finalists.add(win);
            semis.add(Map.of("a", x.title() + " (@" + x.owner() + ")", "b", y.title() + " (@" + y.owner() + ")", "scoreA", sx, "scoreB", sy, "winner", sx >= sy ? "A" : "B",
                    "you", x == mine || y == mine));
        }
        stages.add(Map.of("stage", "Semifinal", "results", semis));
        Look champion = null;
        if (finalists.size() == 2) {
            double sx = FlairLooks.runwayScore(finalists.get(0), t, 3, seed), sy = FlairLooks.runwayScore(finalists.get(1), t, 3, seed);
            champion = sx >= sy ? finalists.get(0) : finalists.get(1);
            stages.add(Map.of("stage", "Final", "results", List.of(Map.of("a", finalists.get(0).title() + " (@" + finalists.get(0).owner() + ")",
                    "b", finalists.get(1).title() + " (@" + finalists.get(1).owner() + ")", "scoreA", sx, "scoreB", sy, "winner", sx >= sy ? "A" : "B",
                    "you", finalists.contains(mine)))));
        }
        String place = champion == mine ? Msg.t("flairModes.campea_o") : finalists.contains(mine) ? "FINALISTA" : top4.contains(mine) ? "SEMIFINALISTA" : Msg.t("flairModes.qualificacao_2");
        String winner = champion == mine ? "A" : finalists.contains(mine) ? "DRAW" : "B";
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("theme", t);
        r.put("field", field.stream().map(FlairModeViews::lookView).toList());
        r.put("stages", stages);
        r.put("champion", champion == null ? null : Map.of("title", champion.title(), "owner", champion.owner()));
        r.put("place", place);
        r.put("scoreA", q.get(mine));
        r.put("scoreB", champion == null ? 0 : q.get(champion));
        String title = Msg.t("flairModes.flair_runway_season", (champion == mine ? "Winner" : "Finalist"), t.label(), runwaySeason());
        if (champion == mine || finalists.contains(mine)) {
            recorder.trophy(user.id(), "RUNWAY", title, weekKey(), Map.of("theme", t.label(), "look", mine.title()));
            r.put("card", title);
        }
        FlairModeState s = recorder.state(user.id(), "RUNWAY", weekKey());
        s.setStateJson(Json.write(Map.of("schemeId", schemeId.toString(), "place", place, "stages", stages, "theme", t.label(), "card", String.valueOf(r.get("card")))));
        return recorder.finish(user, "RUNWAY", t.label(), winner, r, List.of(mine), null, List.of());
    }
}
