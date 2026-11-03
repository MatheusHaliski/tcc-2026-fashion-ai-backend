package br.com.fashionai.application.service;

import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.repository.FlairCoinEntryRepository;
import br.com.fashionai.domain.repository.FlairMatchEntryRepository;
import br.com.fashionai.domain.repository.FlairMatchRepository;
import br.com.fashionai.domain.repository.FlairModeStateRepository;
import br.com.fashionai.domain.repository.FlairTerritoryRepository;
import br.com.fashionai.domain.repository.FlairTrophyRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

/**
 * Colaboradores do {@link FlairModesService}, montados uma vez a partir das dependências do bean: os looks/cartas e o
 * registro das partidas são compartilhados; cada modo recebe só os repositórios que usa.
 */
record FlairModeParts(FlairModeLooks modeLooks, FlairMatchRecorder recorder, FlairLookDuels duels, FlairLeagueMode leagueMode,
                      FlairRunwayMode runwayMode, FlairWorldTour worldTour, FlairTerritoryModes territoryModes, FlairDraftMode draftMode,
                      FlairDeckMode deckMode, FlairBossMode bossMode, FlairWardrobeWars wardrobeMode, FlairChessMode chessMode,
                      FlairUltimateTeam ultimateTeam) {

    static FlairModeParts of(FlairService flair, SchemeService schemeService, SchemeRepository schemes, SchemeItemRepository schemeItems,
                             WardrobeItemRepository pieces, UserRepository users, FlairMatchRepository matches, FlairMatchEntryRepository entries,
                             FlairModeStateRepository states, FlairTerritoryRepository territories, FlairTrophyRepository trophies,
                             FlairCoinEntryRepository coins, NotificationService notifications, Guard guard, FaiPointsService faiPoints,
                             AtelierRewardSystem atelier) {
        FlairModeLooks modeLooks = new FlairModeLooks(flair, schemeService, schemes, schemeItems, pieces, users, guard);
        FlairMatchRecorder recorder = new FlairMatchRecorder(flair, users, schemes, matches, entries, states, trophies, coins, notifications,
                faiPoints, atelier);
        return new FlairModeParts(modeLooks, recorder,
                new FlairLookDuels(modeLooks, recorder, guard),
                new FlairLeagueMode(modeLooks, recorder, states, entries, pieces, guard),
                new FlairRunwayMode(modeLooks, recorder, states, guard),
                new FlairWorldTour(modeLooks, recorder, guard),
                new FlairTerritoryModes(modeLooks, recorder, territories, entries, users, notifications, guard),
                new FlairDraftMode(modeLooks, recorder, matches, users, guard),
                new FlairDeckMode(modeLooks, recorder, flair, pieces, matches, users, guard),
                new FlairBossMode(modeLooks, recorder, guard),
                new FlairWardrobeWars(modeLooks, recorder, flair, pieces, schemes, schemeItems, users, guard),
                new FlairChessMode(modeLooks, recorder, flair, pieces, guard),
                new FlairUltimateTeam(modeLooks, recorder, schemes, guard));
    }
}
