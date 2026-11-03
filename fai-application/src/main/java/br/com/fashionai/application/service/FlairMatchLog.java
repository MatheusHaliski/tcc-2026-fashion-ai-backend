package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import br.com.fashionai.domain.model.FlairMatch;
import br.com.fashionai.domain.model.FlairMatchEntry;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.FlairMatchEntryRepository;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Histórico das partidas do {@link FlairService}: o lado de cada pessoa numa partida (deck, nota e as marcas das peças,
 * que contam para o duelo patrocinado) e a linha do histórico no perfil.
 */
final class FlairMatchLog {
    private final FlairMatchEntryRepository entries;

    FlairMatchLog(FlairMatchEntryRepository entries) {
        this.entries = entries;
    }

    void entry(FlairMatch m, User u, Scheme s, String side, Deck d, Double score) {
        FlairMatchEntry e = new FlairMatchEntry();
        e.setMatch(m);
        e.setUser(u);
        e.setScheme(s);
        e.setSide(side);
        e.setDeckPower(d.power());
        e.setScore(score == null ? null : BigDecimal.valueOf(score));
        e.setBrandPiecesJson(Json.write(d.cards().stream().map(Card::brandName).filter(Objects::nonNull).map(x -> x.toLowerCase(Locale.ROOT)).toList()));
        entries.save(e);
    }

    Map<String, Object> entryView(FlairMatchEntry e) {
        FlairMatch m = e.getMatch();
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("matchId", m.getId());
        v.put("mode", m.getMode());
        v.put("theme", m.getTheme());
        v.put("date", m.getPlayDate());
        v.put("deck", e.getScheme() == null ? null : e.getScheme().getTitle());
        v.put("power", e.getDeckPower());
        v.put("score", e.getScore());
        v.put("outcome", m.getWinnerSide() == null ? null : m.getWinnerSide().equals("DRAW") ? "DRAW" : m.getWinnerSide().equals(e.getSide()) ? "WIN" : "LOSS");
        return v;
    }

}
