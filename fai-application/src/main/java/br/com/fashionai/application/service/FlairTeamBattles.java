package br.com.fashionai.application.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.AtelierGrants;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.repository.*;

import static br.com.fashionai.application.service.FlairService.today;

/**
 * Duelo de equipes 3×3 (extraído do {@link FlairService}): os 3 melhores decks de cada equipe duelam em pares; vitória
 * vale 3 pontos na liga semanal, coins, FAI Points e um fragmento da obra coletiva do Atelier para quem venceu.
 *
 * <p>Com o código {@link #HOUSE} é o <b>treino contra a equipe da Casa</b> (jogo solo): três decks públicos da comunidade,
 * sorteados por dia e por equipe, sem ninguém da própria equipe nem quem tem bloqueio. O treino conta FAI Points de
 * partida, mas não mexe na liga, não paga coins nem fragmentos do Atelier (não dá para subir na liga jogando contra a Casa).</p>
 */
final class FlairTeamBattles {
    static final String HOUSE = "CASA";
    static final String HOUSE_COLOR = "#7B4FD6";
    private final FlairService flair;
    private final FlairTeamRepository teams;
    private final FlairTeamMemberRepository members;
    private final FlairMatchRepository matches;
    private final UserRepository users;
    private final WardrobeItemRepository pieces;
    private final FaiPointsService faiPoints;
    private final AtelierRewardSystem atelier;
    private final Guard guard;

    FlairTeamBattles(FlairService flair, FlairTeamRepository teams, FlairTeamMemberRepository members, FlairMatchRepository matches,
                     UserRepository users, WardrobeItemRepository pieces, FaiPointsService faiPoints, AtelierRewardSystem atelier, Guard guard) {
        this.flair = flair;
        this.teams = teams;
        this.members = members;
        this.matches = matches;
        this.users = users;
        this.pieces = pieces;
        this.faiPoints = faiPoints;
        this.atelier = atelier;
        this.guard = guard;
    }

    private record Pairs(List<Map<String, Object>> duels, int winsA, int winsB) {
        String winner() {
            return winsA == winsB ? "DRAW" : winsA > winsB ? "A" : "B";
        }
    }

    Map<String, Object> battle(CurrentUser user, String opponentCode) {
        guard.requireCanCreate(user);
        FlairTeam mine = members.findByUserId(user.id()).map(FlairTeamMember::getTeam).orElseThrow(() -> new ApiException(409, "SEM_EQUIPE", Msg.t("flair.entre_numa_equipe_para_desafiar")));
        String code = opponentCode == null ? "" : opponentCode.trim().toUpperCase(Locale.ROOT);
        boolean house = HOUSE.equals(code);
        FlairTeam rival = house ? null : teams.findByCode(code).orElseThrow(() -> ApiException.notFound(Msg.t("flair.equipe_adversaria")));
        if (rival != null && rival.getId().equals(mine.getId())) {
            throw ApiException.badRequest("MESMA_EQUIPE", Msg.t("flair.escolha_outra_equipe"));
        }
        if (rival != null && playedToday(mine, rival)) {
            throw ApiException.conflict("JA_DUELARAM_HOJE", Msg.t("flair.suas_equipes_ja_se_enfrentaram"));
        }
        List<Map.Entry<Scheme, Deck>> a = flair.teamDecks(mine, user), b = house ? houseDecks(user, mine) : flair.teamDecks(rival, user);
        if (a.isEmpty() || b.isEmpty()) {
            throw new ApiException(409, "SEM_DECKS", Msg.t("flair.cada_equipe_precisa_de_ao"));
        }
        Pairs pairs = pairs(a, b);
        String winner = pairs.winner();
        String houseName = Msg.t("flair.equipe_da_casa");
        FlairMatch m = new FlairMatch();
        m.setMode("TEAM");
        m.setStatus("FINISHED");
        m.setPlayDate(today());
        m.setTheme(mine.getName() + " × " + (house ? houseName : rival.getName()));
        m.setCreatedByUser(users.findById(user.id()).orElseThrow());
        m.setTeamAId(mine.getId());
        m.setTeamBId(house ? null : rival.getId());
        m.setWinnerSide(winner);
        m.setResultJson(Json.write(Map.of("duels", pairs.duels(), "winsA", pairs.winsA(), "winsB", pairs.winsB())));
        matches.save(m);
        a.forEach(e -> flair.entry(m, e.getKey().getUser(), e.getKey(), "A", e.getValue(), null));
        b.forEach(e -> flair.entry(m, e.getKey().getUser(), e.getKey(), "B", e.getValue(), null));
        // RF41: quem dispara a partida joga (e vence, se o time dele vencer); antes do laço para contar os dois lançamentos
        int teamFai = faiPoints.game(user.id(), "FLAIR_TEAM", m.getId().toString(), "A".equals(winner) ? "WIN" : "PLAYED");
        if (!house) {
            league(mine, rival, winner, m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("matchId", m.getId());
        out.put("teamA", flair.teamView(mine, user));
        out.put("teamB", house ? houseView(houseName, b) : flair.teamView(rival, user));
        out.put("duels", pairs.duels());
        out.put("score", Map.of("a", pairs.winsA(), "b", pairs.winsB()));
        out.put("winner", winner);
        out.put("faiPoints", teamFai);
        out.put("practice", house);
        members.findByTeamIdOrderByCreatedAtAsc(mine.getId()).forEach(x -> flair.rightsCheck(x.getUser().getId()));
        return out;
    }

    private boolean playedToday(FlairTeam mine, FlairTeam rival) {
        return matches.findTop20ByTeamAIdOrTeamBIdOrderByCreatedAtDesc(mine.getId(), mine.getId()).stream()
                .anyMatch(x -> today().equals(x.getPlayDate()) && (rival.getId().equals(x.getTeamAId()) || rival.getId().equals(x.getTeamBId())));
    }

    private static Pairs pairs(List<Map.Entry<Scheme, Deck>> a, List<Map.Entry<Scheme, Deck>> b) {
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
        return new Pairs(duels, wa, wb);
    }

    /** Liga semanal (só contra outra equipe): 3 pontos à vencedora (1 a cada no empate), coins, FAI Points e Atelier. */
    private void league(FlairTeam mine, FlairTeam rival, String winner, FlairMatch m) {
        if ("DRAW".equals(winner)) {
            mine.setPoints(mine.getPoints() + 1);
            rival.setPoints(rival.getPoints() + 1);
            return;
        }
        FlairTeam w = "A".equals(winner) ? mine : rival;
        w.setPoints(w.getPoints() + 3);
        members.findByTeamIdOrderByCreatedAtAsc(w.getId()).forEach(x -> flair.award(x.getUser().getId(), 30, 20, "TEAM_WIN", m.getId().toString()));
        // RF41: a vitória vale FAI Points para cada integrante do time vencedor (idempotente para quem disparou)
        members.findByTeamIdOrderByCreatedAtAsc(w.getId()).forEach(x ->
                faiPoints.award(x.getUser().getId(), "GAME_WON", "GAME", "FLAIR_TEAM:" + m.getId(), null));
        // Atelier: cada integrante do time vencedor ganha um fragmento da obra coletiva (idempotente por partida)
        FlairTeam lost = w == mine ? rival : mine;
        members.findByTeamIdOrderByCreatedAtAsc(w.getId()).forEach(x ->
                atelier.grant(AtelierGrants.teamWin(x.getUser().getId(), m.getId(), w.getId(), w.getName(), lost.getName())));
    }

    /** Até 3 decks públicos da comunidade para a equipe da Casa: fora a própria equipe e quem tem bloqueio com quem joga. */
    List<Map.Entry<Scheme, Deck>> houseDecks(CurrentUser user, FlairTeam mine) {
        List<UUID> mates = members.findByTeamIdOrderByCreatedAtAsc(mine.getId()).stream().map(x -> x.getUser().getId()).toList();
        Map<UUID, User> owners = new LinkedHashMap<>();
        for (WardrobeItem w : pieces.findAllPublic(PageRequest.of(0, 400))) {
            User u = w.getUser();
            if (u != null && !mates.contains(u.getId()) && !u.getId().equals(user.id()) && !guard.blocked(user.id(), u.getId())) {
                owners.putIfAbsent(u.getId(), u);
            }
        }
        List<User> pool = new ArrayList<>(owners.values());
        Collections.shuffle(pool, new Random(Objects.hash(mine.getId(), today())));
        return pool.stream().limit(30).map(u -> flair.bestPublicDeck(user, u).orElse(null)).filter(Objects::nonNull).limit(3).toList();
    }

    private static Map<String, Object> houseView(String name, List<Map.Entry<Scheme, Deck>> decks) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", null);
        m.put("name", name);
        m.put("code", HOUSE);
        m.put("color", HOUSE_COLOR);
        m.put("points", 0);
        m.put("owner", null);
        m.put("members", decks.stream().map(e -> Map.of("user", Views.user(e.getKey().getUser()), "role", "MEMBRO")).toList());
        m.put("mine", false);
        return m;
    }
}
