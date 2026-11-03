package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairLooks.Clash;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.SchemeRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairModeValues.num;
import static br.com.fashionai.application.service.FlairModeViews.lookView;
import static br.com.fashionai.application.service.FlairModeViews.overall;

/** FLAIR Ultimate Team: sete looks titulares com funções, sugestão automática, química do time e partida por função. */
final class FlairUltimateTeam {
    private final FlairModeLooks modeLooks;
    private final FlairMatchRecorder recorder;
    private final SchemeRepository schemes;
    private final Guard guard;

    FlairUltimateTeam(FlairModeLooks modeLooks, FlairMatchRecorder recorder, SchemeRepository schemes, Guard guard) {
        this.modeLooks = modeLooks;
        this.recorder = recorder;
        this.schemes = schemes;
        this.guard = guard;
    }

    Map<String, Look> autoUltimate(List<Look> looks) {
        Map<String, Look> out = new LinkedHashMap<>();
        List<Look> left = new ArrayList<>(looks);
        for (String role : FlairLooks.ROLES.keySet()) {
            Optional<Look> best = left.stream().max(Comparator.comparingInt(l -> FlairLooks.roleValue(l, role)));
            best.ifPresent(l -> {
                out.put(role, l);
                left.remove(l);
            });
            if (best.isEmpty()) {
                out.put(role, null);
            }
        }
        return out;
    }

    Map<String, Object> ultimate(CurrentUser user) {
        Map<String, Object> st = Json.map(recorder.state(user.id(), "ULTIMATE", "ALL").getStateJson());
        Map<String, Look> roster = new LinkedHashMap<>();
        Object roles = st.get("roles");
        for (String role : FlairLooks.ROLES.keySet()) {
            Object id = roles instanceof Map<?, ?> rm ? rm.get(role) : null;
            roster.put(role, id == null ? null : schemes.findById(UUID.fromString(String.valueOf(id))).filter(s -> s.getStatus() != SchemeStatus.ARCHIVED).map(modeLooks::look).orElse(null));
        }
        Map<String, Look> suggestion = autoUltimate(modeLooks.ownSchemes(user.id()).stream().map(modeLooks::look).toList());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("roles", FlairLooks.ROLES.keySet());
        out.put("roster", roster.entrySet().stream().collect(LinkedHashMap::new, (m, e) -> m.put(e.getKey(), e.getValue() == null ? null : Map.of("look", lookView(e.getValue()),
                "value", FlairLooks.roleValue(e.getValue(), e.getKey()))), LinkedHashMap::putAll));
        out.put("team", FlairLooks.teamRating(roster));
        out.put("suggestion", suggestion.entrySet().stream().collect(LinkedHashMap::new, (m, e) -> m.put(e.getKey(), e.getValue() == null ? null : e.getValue().schemeId()), LinkedHashMap::putAll));
        out.put("roleHelp", Map.of("ICON", Msg.t("flairModes.look_principal_rating_geral"), "TREND", Msg.t("flairModes.foco_em_tendencias"), "SOCIAL", Msg.t("flairModes.maior_community_score"), "CREATIVE", "alta originalidade",
                "CLASSIC", Msg.t("flairModes.alta_consistencia_style_ai"), "WILD_CARD", Msg.t("flairModes.imprevisivel_o_maior_atributo_decide"), "SPECIAL", Msg.t("flairModes.look_para_eventos_raridade")));
        return out;
    }

    Map<String, Object> saveUltimate(CurrentUser user, Map<String, UUID> roles) {
        Map<String, String> clean = new LinkedHashMap<>();
        Set<UUID> used = new HashSet<>();
        for (String role : FlairLooks.ROLES.keySet()) {
            UUID id = roles == null ? null : roles.get(role);
            if (id == null) {
                continue;
            }
            if (!used.add(id)) {
                throw ApiException.badRequest("LOOK_REPETIDO", Msg.t("flairModes.cada_look_ocupa_uma_funcao"));
            }
            modeLooks.ownScheme(user, id);
            clean.put(role, id.toString());
        }
        recorder.state(user.id(), "ULTIMATE", "ALL").setStateJson(Json.write(Map.of("roles", clean)));
        return ultimate(user);
    }

    Map<String, Object> playUltimate(CurrentUser user, String opponent) {
        guard.requireCanCreate(user);
        Map<String, Object> view = ultimate(user);
        Map<String, Look> mine = new LinkedHashMap<>();
        Map<String, Object> st = Json.map(recorder.state(user.id(), "ULTIMATE", "ALL").getStateJson());
        Object roles = st.get("roles");
        for (String role : FlairLooks.ROLES.keySet()) {
            Object id = roles instanceof Map<?, ?> rm ? rm.get(role) : null;
            mine.put(role, id == null ? null : schemes.findById(UUID.fromString(String.valueOf(id))).map(modeLooks::look).orElse(null));
        }
        if (mine.values().stream().allMatch(Objects::isNull)) {
            mine = autoUltimate(modeLooks.ownSchemes(user.id()).stream().map(modeLooks::look).toList());
        }
        User rival = FlairModeLooks.house(opponent) ? null : modeLooks.opponentUser(user, opponent);
        Map<String, Look> theirs = autoUltimate(rival == null ? modeLooks.houseLooks(user.id(), 14, modeLooks.seed("ut-house")) : modeLooks.publicLooksOf(user, rival));
        List<Clash> rounds = new ArrayList<>();
        for (String role : FlairLooks.ROLES.keySet()) {
            Look a = mine.get(role), b = theirs.get(role);
            double va = a == null ? 0 : FlairLooks.roleValue(a, role), vb = b == null ? 0 : FlairLooks.roleValue(b, role);
            rounds.add(new Clash(role.replace('_', ' '), a == null ? "—" : a.title(), b == null ? "—" : b.title(), va, vb, FlairLooks.winner(va, vb), List.of(), List.of()));
        }
        Map<String, Object> ta = FlairLooks.teamRating(mine), tb = FlairLooks.teamRating(theirs);
        String w = overall(rounds);
        long wa = rounds.stream().filter(x -> "A".equals(x.winner())).count(), wb = rounds.stream().filter(x -> "B".equals(x.winner())).count();
        if (wa == wb) {
            w = FlairLooks.winner(num(ta.get("chemistry")), num(tb.get("chemistry")));
        }
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("teamA", ta);
        r.put("teamB", tb);
        r.put("opponent", Map.of("label", rival == null ? Msg.t("flairModes.ultimate_team_da_casa") : "@" + rival.getUsername()));
        r.put("rounds", rounds.stream().map(FlairModeViews::clashView).toList());
        r.put("scoreA", wa);
        r.put("scoreB", wb);
        r.put("tiebreak", wa == wb ? Msg.t("flairModes.empate_nas_funcoes_decide_a") : null);
        r.put("roster", view.get("roster"));
        return recorder.finish(user, "ULTIMATE", Msg.t("flairModes.flair_team"), w, r, mine.values().stream().filter(Objects::nonNull).toList(), rival,
                theirs.values().stream().filter(Objects::nonNull).toList());
    }
}
