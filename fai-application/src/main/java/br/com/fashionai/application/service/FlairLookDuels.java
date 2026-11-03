package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairLooks.Clash;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.Theme;
import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.User;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairModeViews.clashView;
import static br.com.fashionai.application.service.FlairModeViews.lookView;
import static br.com.fashionai.application.service.FlairModeViews.overall;

/** Duelos de um look ou de um time contra a Casa ou outra pessoa: Battle of Looks, FLAIR Squad, Combo Battle e Tag Team. */
final class FlairLookDuels {
    private final FlairModeLooks modeLooks;
    private final FlairMatchRecorder recorder;
    private final Guard guard;

    FlairLookDuels(FlairModeLooks modeLooks, FlairMatchRecorder recorder, Guard guard) {
        this.modeLooks = modeLooks;
        this.recorder = recorder;
        this.guard = guard;
    }

    Map<String, Object> battle(CurrentUser user, UUID schemeId, String opponent, String themeCode) {
        guard.requireCanCreate(user);
        Look mine = modeLooks.look(modeLooks.ownScheme(user, schemeId));
        Theme t = themeCode == null || themeCode.isBlank() ? FlairLooks.drawTheme(modeLooks.seed(schemeId, opponent, "battle", System.nanoTime() / 60_000_000_000L)) : FlairLooks.theme(themeCode);
        User rival = FlairModeLooks.house(opponent) ? null : modeLooks.opponentUser(user, opponent);
        List<Look> pool = rival == null ? modeLooks.houseLooks(user.id(), 6, modeLooks.seed(schemeId, "house")) : modeLooks.publicLooksOf(user, rival);
        if (pool.isEmpty()) {
            throw new ApiException(409, "SEM_LOOK_PUBLICO", Msg.t("flairModes.ainda_nao_tem_look_publico", ((rival == null ? Msg.t("flairModes.a_comunidade") : "@" + rival.getUsername()))));
        }
        Look theirs = pool.stream().max(Comparator.comparingDouble(l -> FlairLooks.score(l, t).total())).get();
        Clash c = FlairLooks.battle(mine, theirs, t);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("theme", t);
        r.put("me", lookView(mine));
        r.put("opponent", Map.of("label", rival == null ? Msg.t("flairModes.a_casa", theirs.owner()) : "@" + rival.getUsername(), "look", lookView(theirs)));
        r.put("rounds", List.of(clashView(c)));
        r.put("scoreA", c.scoreA());
        r.put("scoreB", c.scoreB());
        return recorder.finish(user, "BATTLE", t.label(), c.winner(), r, List.of(mine), rival, List.of(theirs));
    }

    Map<String, Object> squad(CurrentUser user, List<UUID> schemeIds, String opponent) {
        guard.requireCanCreate(user);
        List<Look> mine = schemeIds == null || schemeIds.isEmpty() ? modeLooks.pickSquad(modeLooks.ownSchemes(user.id()).stream().map(modeLooks::look).toList(), 5)
                : schemeIds.stream().limit(5).map(id -> modeLooks.look(modeLooks.ownScheme(user, id))).toList();
        if (mine.isEmpty()) {
            throw ApiException.badRequest("SEM_LOOKS", Msg.t("flairModes.monte_ao_menos_um_look"));
        }
        User rival = FlairModeLooks.house(opponent) ? null : modeLooks.opponentUser(user, opponent);
        List<Look> theirs = modeLooks.pickSquad(rival == null ? modeLooks.houseLooks(user.id(), 12, modeLooks.seed("squad")) : modeLooks.publicLooksOf(user, rival), 5);
        if (theirs.isEmpty()) {
            throw new ApiException(409, "SEM_LOOK_PUBLICO", Msg.t("flairModes.o_oponente_ainda_nao_tem"));
        }
        List<Theme> sits = FlairLooks.SQUAD_SITUATIONS.stream().map(FlairLooks::theme).toList();
        List<Clash> rounds = FlairLooks.squad(mine, theirs, sits);
        String w = overall(rounds);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("situations", sits);
        r.put("me", mine.stream().map(FlairModeViews::lookView).toList());
        r.put("opponent", Map.of("label", rival == null ? Msg.t("flairModes.squad_da_casa") : "@" + rival.getUsername(), "looks", theirs.stream().map(FlairModeViews::lookView).toList()));
        r.put("rounds", rounds.stream().map(FlairModeViews::clashView).toList());
        r.put("scoreA", rounds.stream().filter(x -> "A".equals(x.winner())).count());
        r.put("scoreB", rounds.stream().filter(x -> "B".equals(x.winner())).count());
        return recorder.finish(user, "SQUAD", Msg.t("flairModes.n5_situacoes"), w, r, mine, rival, theirs);
    }

    Map<String, Object> combo(CurrentUser user, UUID schemeId, String opponent) {
        guard.requireCanCreate(user);
        Look mine = modeLooks.look(modeLooks.ownScheme(user, schemeId));
        User rival = FlairModeLooks.house(opponent) ? null : modeLooks.opponentUser(user, opponent);
        Theme t = FlairLooks.drawTheme(modeLooks.seed("combo", schemeId));
        List<Look> pool = rival == null ? modeLooks.houseLooks(user.id(), 10, modeLooks.seed("combo-house")) : modeLooks.publicLooksOf(user, rival);
        if (pool.isEmpty()) {
            throw new ApiException(409, "SEM_LOOK_PUBLICO", Msg.t("flairModes.o_oponente_ainda_nao_tem"));
        }
        Look theirs = pool.stream().max(Comparator.comparingDouble(l -> FlairLooks.comboScore(l, t))).get();
        double sa = FlairLooks.comboScore(mine, t), sb = FlairLooks.comboScore(theirs, t);
        List<String> notes = new ArrayList<>();
        FlairLooks.synergies(mine.cards(), t).forEach(x -> notes.add("A: " + x.emoji() + " " + x.label() + " +" + x.bonus() + " " + FlairLooks.LABELS.get(x.stat())));
        FlairLooks.synergies(theirs.cards(), t).forEach(x -> notes.add("B: " + x.emoji() + " " + x.label() + " +" + x.bonus() + " " + FlairLooks.LABELS.get(x.stat())));
        if (notes.isEmpty()) {
            notes.add(Msg.t("flairModes.nenhum_combo_ativado_tente_tenis"));
        }
        Clash c = new Clash(Msg.t("flairModes.combo_battle_2", t.label()), mine.title(), theirs.title(), sa, sb, FlairLooks.winner(sa, sb), notes, List.of());
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("theme", t);
        r.put("me", lookView(mine));
        r.put("opponent", Map.of("label", rival == null ? Msg.t("flairModes.a_casa", theirs.owner()) : "@" + rival.getUsername(), "look", lookView(theirs)));
        r.put("rounds", List.of(clashView(c)));
        r.put("scoreA", sa);
        r.put("scoreB", sb);
        r.put("comboBook", List.of(Msg.t("flairModes.streetwear_combo_tenis_cargo_jeans"), Msg.t("flairModes.classic_formal_blazer_camisa_sapato"),
                Msg.t("flairModes.monochrome_3_pecas_da_mesma"), Msg.t("flairModes.brand_loyalty_3_pecas_da"),
                Msg.t("flairModes.mix_match_3_marcas_diferentes"), Msg.t("flairModes.vintage_revival_2_pecas_vintage")));
        return recorder.finish(user, "COMBO", t.label(), c.winner(), r, List.of(mine), rival, List.of(theirs));
    }

    Map<String, Object> tagTeam(CurrentUser user, UUID schemeId, String partner, List<String> opponents) {
        guard.requireCanCreate(user);
        Look mine = modeLooks.look(modeLooks.ownScheme(user, schemeId));
        Theme t = FlairLooks.drawTheme(modeLooks.seed("tag", schemeId, partner));
        User p = modeLooks.opponentUser(user, partner);
        Look pl = modeLooks.publicLooksOf(user, p).stream().max(Comparator.comparingDouble(l -> FlairLooks.harmony(mine, l) * 0.4 + FlairLooks.score(l, t).total() * 0.6))
                .orElseThrow(() -> new ApiException(409, "SEM_LOOK_PUBLICO", Msg.t("flairModes.ainda_nao_tem_look_publico_2", p.getUsername())));
        List<Look> opp = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<String> names = opponents == null ? List.of() : opponents.stream().filter(x -> x != null && !x.isBlank()).limit(2).toList();
        if (names.size() == 2) {
            for (String n : names) {
                User u = modeLooks.opponentUser(user, n);
                if (u.getId().equals(p.getId())) {
                    throw ApiException.badRequest("DUPLA_INVALIDA", Msg.t("flairModes.a_parceria_nao_pode_estar"));
                }
                opp.add(modeLooks.publicLooksOf(user, u).stream().max(Comparator.comparingDouble(l -> FlairLooks.score(l, t).total()))
                        .orElseThrow(() -> new ApiException(409, "SEM_LOOK_PUBLICO", Msg.t("flairModes.ainda_nao_tem_look_publico_2", u.getUsername()))));
                labels.add("@" + u.getUsername());
            }
        } else {
            modeLooks.houseLooks(user.id(), 20, modeLooks.seed("tag-house")).stream().filter(l -> !l.owner().equals(p.getUsername())).limit(2).forEach(l -> {
                opp.add(l);
                labels.add("@" + l.owner());
            });
        }
        if (opp.size() < 2) {
            throw new ApiException(409, "SEM_ADVERSARIOS", Msg.t("flairModes.nao_ha_looks_publicos_suficientes"));
        }
        double sa = FlairLooks.tagScore(mine, pl, t), sb = FlairLooks.tagScore(opp.get(0), opp.get(1), t);
        int ha = FlairLooks.harmony(mine, pl), hb = FlairLooks.harmony(opp.get(0), opp.get(1));
        Clash c = new Clash("🤝 " + t.emoji() + " " + t.label(), "@" + user.username() + " + @" + p.getUsername(), String.join(" + ", labels), sa, sb, FlairLooks.winner(sa, sb),
                List.of(Msg.t("flairModes.a_team_harmony", ha), Msg.t("flairModes.b_team_harmony", hb), Msg.t("flairModes.nota_da_dupla_80_media")), List.of());
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("theme", t);
        r.put("teamA", Map.of("looks", List.of(lookView(mine), lookView(pl)), "harmony", ha));
        r.put("teamB", Map.of("labels", labels, "looks", opp.stream().map(FlairModeViews::lookView).toList(), "harmony", hb));
        r.put("rounds", List.of(clashView(c)));
        r.put("scoreA", sa);
        r.put("scoreB", sb);
        return recorder.finish(user, "TAG_TEAM", t.label(), c.winner(), r, List.of(mine, pl), null, opp);
    }
}
