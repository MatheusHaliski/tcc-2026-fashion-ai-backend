package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.FlairModesService.Mode;
import br.com.fashionai.domain.model.FlairMatch;
import br.com.fashionai.domain.model.FlairMatchEntry;
import br.com.fashionai.domain.model.FlairModeState;
import br.com.fashionai.domain.model.FlairProfile;
import br.com.fashionai.domain.model.FlairTrophy;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.FlairCoinEntryRepository;
import br.com.fashionai.domain.repository.FlairMatchEntryRepository;
import br.com.fashionai.domain.repository.FlairMatchRepository;
import br.com.fashionai.domain.repository.FlairModeStateRepository;
import br.com.fashionai.domain.repository.FlairTrophyRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairModeCatalog.MODES;
import static br.com.fashionai.application.service.FlairModeValues.today;
import static br.com.fashionai.application.service.FlairModesService.COMPETITIVE;
import static br.com.fashionai.application.service.FlairModesService.REWARDED_PER_MODE_DAY;

/**
 * Registro das partidas dos modos: grava partida e lados, atualiza V/E/D do perfil, paga a recompensa do sistema com
 * teto diário por modo, troféus e Assinaturas de Aura do Atelier, estado por modo/temporada e partida aberta do dono.
 */
final class FlairMatchRecorder {
    private final FlairService flair;
    private final UserRepository users;
    private final SchemeRepository schemes;
    private final FlairMatchRepository matches;
    private final FlairMatchEntryRepository entries;
    private final FlairModeStateRepository states;
    private final FlairTrophyRepository trophies;
    private final FlairCoinEntryRepository coins;
    private final NotificationService notifications;
    private final FaiPointsService faiPoints;
    private final AtelierRewardSystem atelier;

    FlairMatchRecorder(FlairService flair, UserRepository users, SchemeRepository schemes, FlairMatchRepository matches,
                       FlairMatchEntryRepository entries, FlairModeStateRepository states, FlairTrophyRepository trophies,
                       FlairCoinEntryRepository coins, NotificationService notifications, FaiPointsService faiPoints,
                       AtelierRewardSystem atelier) {
        this.flair = flair;
        this.users = users;
        this.schemes = schemes;
        this.matches = matches;
        this.entries = entries;
        this.states = states;
        this.trophies = trophies;
        this.coins = coins;
        this.notifications = notifications;
        this.faiPoints = faiPoints;
        this.atelier = atelier;
    }

    String outcome(String winner) {
        return "DRAW".equals(winner) ? "DRAW" : "A".equals(winner) ? "WIN" : "LOSS";
    }

    /** Grava a partida (histórico e vitórias com peça de marca para o Duelo patrocinado) e paga a recompensa do sistema. */
    Map<String, Object> finish(CurrentUser user, String mode, String theme, String winner, Map<String, Object> result, List<Look> mine, User rival, List<Look> theirs) {
        FlairMatch m = new FlairMatch();
        m.setMode(mode);
        m.setStatus("FINISHED");
        m.setPlayDate(today());
        m.setTheme(theme == null ? null : theme.length() > 80 ? theme.substring(0, 80) : theme);
        m.setCreatedByUser(users.findById(user.id()).orElseThrow());
        m.setWinnerSide(winner);
        m.setResultJson(Json.write(result));
        matches.save(m);
        entry(m, users.findById(user.id()).orElseThrow(), mine, "A", result.get("scoreA"));
        if (rival != null) {
            entry(m, rival, theirs, "B", result.get("scoreB"));
        }
        String outcome = outcome(winner);
        FlairProfile p = flair.profile(user.id());
        switch (outcome) {
            case "WIN" -> p.setWins(p.getWins() + 1);
            case "LOSS" -> p.setLosses(p.getLosses() + 1);
            default -> p.setDraws(p.getDraws() + 1);
        }
        Instant dayStart = today().atStartOfDay(FaiPointsService.ZONE).toInstant();
        boolean rewarded = coins.countByUserIdAndReasonAndCreatedAtAfter(user.id(), "MODE_" + mode, dayStart) < REWARDED_PER_MODE_DAY;
        int coinsWon = !rewarded ? 0 : "WIN".equals(outcome) ? 20 : "DRAW".equals(outcome) ? 8 : 3;
        if (coinsWon > 0) {
            flair.award(user.id(), coinsWon, "WIN".equals(outcome) ? 20 : 5, "MODE_" + mode, m.getId().toString());
        }
        if (COMPETITIVE.contains(mode)) {
            flair.rightsCheck(user.id());
        }
        Map<String, Object> out = new LinkedHashMap<>(result);
        out.put("matchId", m.getId());
        out.put("mode", mode);
        out.put("outcome", outcome);
        out.put("coins", coinsWon);
        out.put("rewardCapReached", !rewarded);
        out.put("faiPoints", faiPoints.game(user.id(), "FLAIR_" + mode, m.getId().toString(), outcome));   // RF41
        discoverSynergies(user, mode, mine, m);
        return out;
    }

    /** Atelier: cada sinergia que a pessoa ativa com os PRÓPRIOS looks numa partida vira uma Assinatura de Aura (uma por sinergia). */
    void discoverSynergies(CurrentUser user, String mode, List<Look> mine, FlairMatch m) {
        String modeLabel = MODES.stream().filter(x -> x.code().equals(mode)).map(Mode::name).findFirst().orElse(mode);
        Set<String> seen = new HashSet<>();
        for (Look l : mine == null ? List.<Look>of() : mine) {
            if (l == null || l.synergies() == null || !Objects.equals(user.username(), l.owner())) {
                continue;
            }
            for (FlairLooks.Synergy x : l.synergies()) {
                if (seen.add(x.code())) {
                    atelier.grant(AtelierGrants.synergy(user.id(), x.code(), x.label(), modeLabel, m.getId()));
                }
            }
        }
    }

    private void entry(FlairMatch m, User u, List<Look> looks, String side, Object score) {
        FlairMatchEntry e = new FlairMatchEntry();
        e.setMatch(m);
        e.setUser(u);
        Look first = looks == null || looks.isEmpty() ? null : looks.get(0);
        e.setScheme(first == null || first.schemeId() == null ? null : schemes.findById(UUID.fromString(first.schemeId())).orElse(null));
        e.setSide(side);
        e.setDeckPower(first == null ? 0 : first.rating());
        e.setScore(score instanceof Number n ? BigDecimal.valueOf(n.doubleValue()) : null);
        e.setBrandPiecesJson(Json.write(looks == null ? List.of() : looks.stream().flatMap(l -> l.cards().stream()).map(Card::brandName)
                .filter(Objects::nonNull).map(x -> x.toLowerCase(Locale.ROOT)).distinct().toList()));
        entries.save(e);
    }

    void trophy(UUID userId, String mode, String title, String season, Map<String, Object> detail) {
        if (trophies.existsByUserIdAndModeAndTitleAndSeasonKey(userId, mode, title, season)) {
            return;
        }
        FlairTrophy t = new FlairTrophy();
        t.setUser(users.findById(userId).orElseThrow());
        t.setMode(mode);
        t.setTitle(title);
        t.setSeasonKey(season);
        t.setDetailJson(Json.write(detail));
        trophies.save(t);
        atelier.grant(AtelierGrants.trophy(userId, t.getId(), mode, title, season));
        notifications.notify(userId, null, NotificationType.ACHIEVEMENT_UNLOCKED, "FLAIR_TROPHY", t.getId(), "🏆 " + title, Msg.k("flairModes.novo_trofeu_flair_no_seu"), Map.of("href", "/flair?tab=modos"));
    }

    List<Map<String, Object>> trophiesOf(UUID userId) {
        return trophies.findByUserIdOrderByCreatedAtDesc(userId).stream().map(t -> Map.<String, Object>of("id", t.getId(), "mode", t.getMode(), "title", t.getTitle(),
                "season", t.getSeasonKey(), "at", t.getCreatedAt())).toList();
    }

    FlairModeState state(UUID userId, String mode, String season) {
        return states.findByUserIdAndModeAndSeasonKey(userId, mode, season).orElseGet(() -> {
            FlairModeState s = new FlairModeState();
            s.setUser(users.findById(userId).orElseThrow());
            s.setMode(mode);
            s.setSeasonKey(season);
            s.setStateJson("{}");
            return states.save(s);
        });
    }

    FlairMatch ownDraft(CurrentUser user, UUID id, String mode) {
        FlairMatch m = matches.findById(id).orElseThrow(() -> ApiException.notFound("Partida"));
        if (!mode.equals(m.getMode()) || !m.getCreatedByUser().getId().equals(user.id())) {
            throw ApiException.notFound("Partida");
        }
        return m;
    }
}
