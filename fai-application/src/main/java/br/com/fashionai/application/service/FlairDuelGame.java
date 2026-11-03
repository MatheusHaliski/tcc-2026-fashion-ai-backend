package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.FlairMatch;
import br.com.fashionai.domain.model.FlairProfile;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.FlairCoinEntryRepository;
import br.com.fashionai.domain.repository.FlairMatchRepository;
import br.com.fashionai.domain.repository.UserRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairService.today;

/**
 * Duelo de estilo 1×1 do {@link FlairService} contra o melhor deck público de outra pessoa ou o treino contra a Casa:
 * partida gravada, V/E/D no perfil e recompensa do sistema com teto diário (nada sai do oponente).
 */
final class FlairDuelGame {
    private final Guard guard;
    private final FlairDecks decks;
    private final UserRepository users;
    private final FlairMatchRepository matches;
    private final FlairMatchLog matchLog;
    private final FlairWallet wallet;
    private final FlairCoinEntryRepository coins;
    private final FaiPointsService faiPoints;

    FlairDuelGame(Guard guard, FlairDecks decks, UserRepository users, FlairMatchRepository matches, FlairMatchLog matchLog,
                  FlairWallet wallet, FlairCoinEntryRepository coins, FaiPointsService faiPoints) {
        this.guard = guard;
        this.decks = decks;
        this.users = users;
        this.matches = matches;
        this.matchLog = matchLog;
        this.wallet = wallet;
        this.coins = coins;
        this.faiPoints = faiPoints;
    }

    static final String CASA = "CASA";
    static final int DUEL_REWARDS_PER_DAY = 5;

    public Map<String, Object> duel(CurrentUser user, UUID schemeId, String opponent) {
        guard.requireCanCreate(user);
        Scheme mine = decks.ownDeckScheme(user, schemeId);
        Deck a = decks.deck(mine);
        if (a.cards().isEmpty()) {
            throw ApiException.badRequest("DECK_VAZIO", Msg.t("flair.esse_esquema_nao_tem_pecas"));
        }
        boolean house = opponent == null || opponent.isBlank() || CASA.equalsIgnoreCase(opponent);
        User rival = null;
        Scheme rivalScheme = null;
        Deck b;
        if (house) {
            b = decks.houseDeck();
        } else {
            rival = users.findByUsernameIgnoreCase(opponent.replaceFirst("^@", "")).orElseThrow(() -> ApiException.notFound("Oponente"));
            if (rival.getId().equals(user.id())) {
                throw ApiException.badRequest("DUELO_CONSIGO", Msg.t("common.escolha_outra_pessoa_ou_a"));
            }
            var best = decks.bestPublicDeck(user, rival).orElseThrow(() -> new ApiException(409, "SEM_DECK_PUBLICO", Msg.t("flair.ainda_nao_tem_um_look", opponent)));
            rivalScheme = best.getKey();
            b = best.getValue();
        }
        FlairEngine.DuelResult r = FlairEngine.duel(a, b);
        FlairMatch m = new FlairMatch();
        m.setMode(house ? "TREINO" : "DUEL");
        m.setStatus("FINISHED");
        m.setPlayDate(today());
        m.setCreatedByUser(users.findById(user.id()).orElseThrow());
        m.setWinnerSide(r.winner());
        m.setTheme(house ? CASA : "@" + rival.getUsername());
        m.setResultJson(Json.write(Map.of("rounds", r.rounds(), "winsA", r.winsA(), "winsB", r.winsB())));
        matches.save(m);
        matchLog.entry(m, users.findById(user.id()).orElseThrow(), mine, "A", a, null);
        matchLog.entry(m, rival, rivalScheme, "B", b, null);
        FlairProfile p = wallet.profile(user.id());
        String outcome = "DRAW".equals(r.winner()) ? "DRAW" : "A".equals(r.winner()) ? "WIN" : "LOSS";
        switch (outcome) {
            case "WIN" -> p.setWins(p.getWins() + 1);
            case "LOSS" -> p.setLosses(p.getLosses() + 1);
            default -> p.setDraws(p.getDraws() + 1);
        }
        // recompensa do sistema (nada sai do oponente), com teto diário de duelos premiados
        Instant dayStart = today().atStartOfDay(FaiPointsService.ZONE).toInstant();
        boolean rewarded = coins.countByUserIdAndReasonAndCreatedAtAfter(user.id(), "DUEL", dayStart) < DUEL_REWARDS_PER_DAY;
        int coinsWon = !rewarded ? 0 : "WIN".equals(outcome) ? (house ? 20 : 40) : "DRAW".equals(outcome) ? 15 : 5;
        if (coinsWon > 0) {
            wallet.award(user.id(), coinsWon, "WIN".equals(outcome) ? 25 : "DRAW".equals(outcome) ? 8 : 2, "DUEL", m.getId().toString());
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("matchId", m.getId());
        out.put("mode", m.getMode());
        out.put("me", a);
        out.put("opponent", Map.of("label", house ? Msg.t("common.a_casa") : "@" + rival.getUsername(), "deck", b));
        out.put("rounds", r.rounds());
        out.put("score", Map.of("me", r.winsA(), "opponent", r.winsB()));
        out.put("outcome", outcome);
        out.put("coins", coinsWon);
        out.put("rewardCapReached", !rewarded);
        out.put("faiPoints", faiPoints.game(user.id(), "FLAIR_DUEL", m.getId().toString(), outcome));   // RF41
        out.put("profile", wallet.me(user));
        wallet.rightsCheck(user.id());
        return out;
    }

}
