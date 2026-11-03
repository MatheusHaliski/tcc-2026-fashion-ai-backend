package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.FlairMatch;
import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.FlairTeamMember;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.repository.FlairMatchRepository;
import br.com.fashionai.domain.repository.FlairTeamMemberRepository;
import br.com.fashionai.domain.repository.FlairTeamRepository;
import br.com.fashionai.domain.repository.UserRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import static br.com.fashionai.application.service.FlairService.today;

/**
 * Duelo de equipes 3×3 do {@link FlairService}: os 3 melhores decks públicos de cada lado, pontos na liga, coins, FAI
 * Points e o fragmento do Atelier para o time vencedor; um confronto por dia entre as mesmas equipes.
 */
final class FlairTeamBattle {
    private final FlairTeamRepository teams;
    private final FlairTeamMemberRepository members;
    private final FlairMatchRepository matches;
    private final UserRepository users;
    private final Guard guard;
    private final FlairDecks decks;
    private final FlairTeams teamsMode;
    private final FlairMatchLog matchLog;
    private final FlairWallet wallet;
    private final FaiPointsService faiPoints;
    private final AtelierRewardSystem atelier;

    FlairTeamBattle(FlairTeamRepository teams, FlairTeamMemberRepository members, FlairMatchRepository matches, UserRepository users,
                    Guard guard, FlairDecks decks, FlairTeams teamsMode, FlairMatchLog matchLog, FlairWallet wallet,
                    FaiPointsService faiPoints, AtelierRewardSystem atelier) {
        this.teams = teams;
        this.members = members;
        this.matches = matches;
        this.users = users;
        this.guard = guard;
        this.decks = decks;
        this.teamsMode = teamsMode;
        this.matchLog = matchLog;
        this.wallet = wallet;
        this.faiPoints = faiPoints;
        this.atelier = atelier;
    }

    /** Os 3 melhores decks de uma equipe (o melhor deck de cada integrante, os 3 mais fortes). */
    List<Map.Entry<Scheme, Deck>> teamDecks(FlairTeam t, CurrentUser viewer) {
        return members.findByTeamIdOrderByCreatedAtAsc(t.getId()).stream()
                .map(m -> decks.bestPublicDeck(viewer, m.getUser()).orElse(null)).filter(Objects::nonNull)
                .sorted(Comparator.comparingInt((Map.Entry<Scheme, Deck> e) -> e.getValue().power()).reversed()).limit(3).toList();
    }

    public Map<String, Object> teamBattle(CurrentUser user, String opponentCode) {
        guard.requireCanCreate(user);
        FlairTeam mine = members.findByUserId(user.id()).map(FlairTeamMember::getTeam).orElseThrow(() -> new ApiException(409, "SEM_EQUIPE", Msg.t("flair.entre_numa_equipe_para_desafiar")));
        FlairTeam rival = teams.findByCode(opponentCode == null ? "" : opponentCode.trim().toUpperCase(Locale.ROOT)).orElseThrow(() -> ApiException.notFound(Msg.t("flair.equipe_adversaria")));
        if (rival.getId().equals(mine.getId())) {
            throw ApiException.badRequest("MESMA_EQUIPE", Msg.t("flair.escolha_outra_equipe"));
        }
        boolean playedToday = matches.findTop20ByTeamAIdOrTeamBIdOrderByCreatedAtDesc(mine.getId(), mine.getId()).stream()
                .anyMatch(x -> today().equals(x.getPlayDate()) && (rival.getId().equals(x.getTeamAId()) || rival.getId().equals(x.getTeamBId())));
        if (playedToday) {
            throw ApiException.conflict("JA_DUELARAM_HOJE", Msg.t("flair.suas_equipes_ja_se_enfrentaram"));
        }
        List<Map.Entry<Scheme, Deck>> a = teamDecks(mine, user), b = teamDecks(rival, user);
        if (a.isEmpty() || b.isEmpty()) {
            throw new ApiException(409, "SEM_DECKS", Msg.t("flair.cada_equipe_precisa_de_ao"));
        }
        List<Map<String, Object>> duels = new ArrayList<>();
        int wa = 0, wb = 0;
        for (int i = 0; i < Math.max(a.size(), b.size()); i++) {
            Map.Entry<Scheme, Deck> x = i < a.size() ? a.get(i) : null, y = i < b.size() ? b.get(i) : null;
            String w;
            List<FlairEngine.Round> rounds = List.of();
            if (x == null) {
                w = "B";
            } else if (y == null) {
                w = "A";
            } else {
                FlairEngine.DuelResult r = FlairEngine.duel(x.getValue(), y.getValue());
                w = r.winner();
                rounds = r.rounds();
            }
            wa += "A".equals(w) ? 1 : 0;
            wb += "B".equals(w) ? 1 : 0;
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("slot", i + 1);
            d.put("a", x == null ? null : Map.of("user", Views.user(x.getKey().getUser()), "deck", x.getKey().getTitle(), "power", x.getValue().power()));
            d.put("b", y == null ? null : Map.of("user", Views.user(y.getKey().getUser()), "deck", y.getKey().getTitle(), "power", y.getValue().power()));
            d.put("winner", w);
            d.put("rounds", rounds);
            duels.add(d);
        }
        String winner = wa == wb ? "DRAW" : wa > wb ? "A" : "B";
        FlairMatch m = new FlairMatch();
        m.setMode("TEAM");
        m.setStatus("FINISHED");
        m.setPlayDate(today());
        m.setTheme(mine.getName() + " × " + rival.getName());
        m.setCreatedByUser(users.findById(user.id()).orElseThrow());
        m.setTeamAId(mine.getId());
        m.setTeamBId(rival.getId());
        m.setWinnerSide(winner);
        m.setResultJson(Json.write(Map.of("duels", duels, "winsA", wa, "winsB", wb)));
        matches.save(m);
        a.forEach(e -> matchLog.entry(m, e.getKey().getUser(), e.getKey(), "A", e.getValue(), null));
        b.forEach(e -> matchLog.entry(m, e.getKey().getUser(), e.getKey(), "B", e.getValue(), null));
        // RF41: quem dispara a partida joga (e vence, se o time dele vencer); antes do laço para contar os dois lançamentos
        int teamFai = faiPoints.game(user.id(), "FLAIR_TEAM", m.getId().toString(), "A".equals(winner) ? "WIN" : "PLAYED");
        if ("DRAW".equals(winner)) {
            mine.setPoints(mine.getPoints() + 1);
            rival.setPoints(rival.getPoints() + 1);
        } else {
            FlairTeam w = "A".equals(winner) ? mine : rival;
            w.setPoints(w.getPoints() + 3);
            members.findByTeamIdOrderByCreatedAtAsc(w.getId()).forEach(x -> wallet.award(x.getUser().getId(), 30, 20, "TEAM_WIN", m.getId().toString()));
            // RF41: a vitória vale FAI Points para cada integrante do time vencedor (idempotente para quem disparou)
            members.findByTeamIdOrderByCreatedAtAsc(w.getId()).forEach(x ->
                    faiPoints.award(x.getUser().getId(), "GAME_WON", "GAME", "FLAIR_TEAM:" + m.getId(), null));
            // Atelier: cada integrante do time vencedor ganha um fragmento da obra coletiva (idempotente por partida)
            FlairTeam lost = w == mine ? rival : mine;
            members.findByTeamIdOrderByCreatedAtAsc(w.getId()).forEach(x ->
                    atelier.grant(AtelierGrants.teamWin(x.getUser().getId(), m.getId(), w.getId(), w.getName(), lost.getName())));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("matchId", m.getId());
        out.put("teamA", teamsMode.teamView(mine, user));
        out.put("teamB", teamsMode.teamView(rival, user));
        out.put("duels", duels);
        out.put("score", Map.of("a", wa, "b", wb));
        out.put("winner", winner);
        out.put("faiPoints", teamFai);
        members.findByTeamIdOrderByCreatedAtAsc(mine.getId()).forEach(x -> wallet.rightsCheck(x.getUser().getId()));
        return out;
    }

}
