package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.FlairMatch;
import br.com.fashionai.domain.model.FlairMatchEntry;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.repository.FlairMatchEntryRepository;
import br.com.fashionai.domain.repository.FlairMatchRepository;
import br.com.fashionai.domain.repository.UserRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairService.today;

/**
 * Batalha de ocasião do dia do {@link FlairService}: tema igual para todos (ocasião sorteada pela data), um deck por
 * pessoa e o placar do dia.
 */
final class FlairArena {
    private final FlairMatchEntryRepository entries;
    private final FlairMatchRepository matches;
    private final UserRepository users;
    private final Guard guard;
    private final FlairDecks decks;
    private final FlairMatchLog matchLog;
    private final FlairWallet wallet;
    private final FaiPointsService faiPoints;

    FlairArena(FlairMatchEntryRepository entries, FlairMatchRepository matches, UserRepository users, Guard guard, FlairDecks decks,
               FlairMatchLog matchLog, FlairWallet wallet, FaiPointsService faiPoints) {
        this.entries = entries;
        this.matches = matches;
        this.users = users;
        this.guard = guard;
        this.decks = decks;
        this.matchLog = matchLog;
        this.wallet = wallet;
        this.faiPoints = faiPoints;
    }

    static final List<String> ARENA_OCCASIONS = List.of("casual", "work", "party", "date", "travel", "festival", "formal", "beach", "sport", "night_out");

    static String arenaTheme(LocalDate d) {
        return ARENA_OCCASIONS.get((int) Math.floorMod(d.toEpochDay(), ARENA_OCCASIONS.size()));
    }

    FlairMatch arenaMatch(LocalDate d, UUID creator) {
        return entries.findByMatchModeAndMatchPlayDateOrderByScoreDesc("ARENA", d).stream().map(FlairMatchEntry::getMatch).findFirst().orElseGet(() -> {
            FlairMatch m = new FlairMatch();
            m.setMode("ARENA");
            m.setStatus("OPEN");
            m.setPlayDate(d);
            m.setTheme(arenaTheme(d));
            m.setCreatedByUser(users.findById(creator).orElseThrow());
            return matches.save(m);
        });
    }

    public Map<String, Object> arena(CurrentUser viewer) {
        LocalDate d = today();
        List<FlairMatchEntry> es = entries.findByMatchModeAndMatchPlayDateOrderByScoreDesc("ARENA", d);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", d);
        out.put("theme", arenaTheme(d));
        out.put("rule", Msg.t("flair.tema_do_dia_igual_para"));
        List<Map<String, Object>> board = new ArrayList<>();
        for (int i = 0; i < es.size(); i++) {
            FlairMatchEntry e = es.get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("position", i + 1);
            m.put("user", Views.user(e.getUser()));
            m.put("deck", e.getScheme() == null ? null : e.getScheme().getTitle());
            m.put("score", e.getScore());
            m.put("power", e.getDeckPower());
            m.put("you", viewer != null && e.getUser() != null && e.getUser().getId().equals(viewer.id()));
            board.add(m);
        }
        out.put("leaderboard", board);
        return out;
    }

    public Map<String, Object> joinArena(CurrentUser user, UUID schemeId) {
        guard.requireCanCreate(user);
        LocalDate d = today();
        if (entries.findFirstByUserIdAndMatchModeAndMatchPlayDate(user.id(), "ARENA", d).isPresent()) {
            throw ApiException.conflict("JA_NA_ARENA", Msg.t("flair.voce_ja_inscreveu_um_deck"));
        }
        Scheme s = decks.ownDeckScheme(user, schemeId);
        Deck deck = decks.deck(s);
        double score = FlairEngine.occasionScore(deck, arenaTheme(d));
        FlairMatch m = arenaMatch(d, user.id());
        matchLog.entry(m, users.findById(user.id()).orElseThrow(), s, "SOLO", deck, score);
        wallet.award(user.id(), 10 + (int) Math.round(score / 5), 5, "ARENA", d.toString());
        faiPoints.game(user.id(), "FLAIR_ARENA", d.toString(), null);   // RF41: inscrever o deck do dia é jogar
        wallet.rightsCheck(user.id());
        return arena(user);
    }

}
