package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairLooks.Clash;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.Theme;
import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairModeValues.seasonKey;
import static br.com.fashionai.application.service.FlairModeViews.overall;

/** Fashion Boss: até 3 looks contra o look de um chefe controlado pelo sistema, com troféu ao vencer. */
final class FlairBossMode {
    private final FlairModeLooks modeLooks;
    private final FlairMatchRecorder recorder;
    private final Guard guard;

    FlairBossMode(FlairModeLooks modeLooks, FlairMatchRecorder recorder, Guard guard) {
        this.modeLooks = modeLooks;
        this.recorder = recorder;
        this.guard = guard;
    }

    Map<String, Object> fightBoss(CurrentUser user, String code, List<UUID> schemeIds) {
        guard.requireCanCreate(user);
        FlairLooks.Boss boss = FlairLooks.BOSSES.get(code == null ? "" : code.toUpperCase(Locale.ROOT));
        if (boss == null) {
            throw ApiException.notFound("Boss");
        }
        if (schemeIds == null || schemeIds.isEmpty() || schemeIds.size() > 3) {
            throw ApiException.badRequest("LOOKS_INVALIDOS", Msg.t("flairModes.enfrente_o_boss_com_1"));
        }
        Theme t = FlairLooks.theme(boss.theme());
        Look bl = FlairLooks.bossLook(boss);
        double bs = FlairLooks.bossScore(bl, t);
        List<Look> mine = schemeIds.stream().map(id -> modeLooks.look(modeLooks.ownScheme(user, id))).toList();
        List<Clash> rounds = new ArrayList<>();
        for (Look l : mine) {
            FlairLooks.Score sc = FlairLooks.score(l, t);
            List<Map<String, Object>> bd = new ArrayList<>();
            for (String k : FlairLooks.STATS) {
                bd.add(Map.of("stat", k, "label", FlairLooks.LABELS.get(k), "weight", FlairLooks.weight(t, k), "a", l.stats().get(k), "b", bl.stats().get(k)));
            }
            rounds.add(new Clash(t.emoji() + " " + t.label(), l.title(), bl.title(), sc.total(), bs, FlairLooks.winner(sc.total(), bs), sc.notes(), bd));
        }
        String w = overall(rounds);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("boss", boss);
        r.put("theme", t);
        r.put("bossScore", bs);
        r.put("rounds", rounds.stream().map(FlairModeViews::clashView).toList());
        r.put("lesson", boss.lesson());
        r.put("scoreA", rounds.stream().filter(x -> "A".equals(x.winner())).count());
        r.put("scoreB", rounds.stream().filter(x -> "B".equals(x.winner())).count());
        if ("A".equals(w)) {
            recorder.trophy(user.id(), "BOSS", Msg.t("flairModes.boss_derrotado", boss.name()), seasonKey(), Map.of("boss", boss.code()));
        }
        return recorder.finish(user, "BOSS", boss.name(), w, r, mine, null, List.of());
    }
}
