package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.FlairCoinEntryRepository;
import br.com.fashionai.domain.repository.FlairCombinationRepository;
import br.com.fashionai.domain.repository.FlairMatchEntryRepository;
import br.com.fashionai.domain.repository.FlairMatchRepository;
import br.com.fashionai.domain.repository.FlairProfileRepository;
import br.com.fashionai.domain.repository.FlairRedemptionRepository;
import br.com.fashionai.domain.repository.FlairTeamMemberRepository;
import br.com.fashionai.domain.repository.FlairTeamRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.context.ApplicationEventPublisher;

/**
 * Colaboradores do {@link FlairService}, montados uma vez a partir das dependências do bean: cartas/decks, histórico
 * das partidas, equipes, carteira e as regras das combinações são compartilhados; cada jogo recebe só o que usa.
 */
record FlairServiceParts(FlairDecks decks, FlairWallet wallet, FlairQuests quests, FlairDuelGame duels, FlairArena arena,
                         FlairTeams teams, FlairTeamBattle teamBattle, FlairCombinationRules combinationRules,
                         FlairCombinationAdmin combinationAdmin, FlairRedemptions redemptions) {

    static FlairServiceParts of(FlairProfileRepository profiles, FlairCoinEntryRepository coins, FlairCombinationRepository combinations,
                                FlairRedemptionRepository redemptions, FlairTeamRepository teams, FlairTeamMemberRepository members,
                                FlairMatchRepository matches, FlairMatchEntryRepository entries, UserRepository users,
                                WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                                BrandProfileRepository brands, ReactionRepository reactions, SchemeService schemeService,
                                InstitutionalService institutional, Guard guard, ApplicationEventPublisher events,
                                FaiPointsService faiPoints, HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig,
                                AtelierRewardSystem atelier) {
        FlairDecks decks = new FlairDecks(pieces, schemes, schemeItems, schemeService, hypeScores, hypeConfig);
        FlairMatchLog matchLog = new FlairMatchLog(entries);
        FlairTeams teamsMode = new FlairTeams(teams, members, profiles, matches, users, guard);
        FlairWallet wallet = new FlairWallet(profiles, coins, users, members, entries, events, teamsMode, matchLog);
        FlairCombinationRules rules = new FlairCombinationRules(brands, entries, redemptions);
        return new FlairServiceParts(decks, wallet,
                new FlairQuests(decks, reactions, pieces, entries, coins, wallet, faiPoints, atelier),
                new FlairDuelGame(guard, decks, users, matches, matchLog, wallet, coins, faiPoints),
                new FlairArena(entries, matches, users, guard, decks, matchLog, wallet, faiPoints),
                teamsMode,
                new FlairTeamBattle(teams, members, matches, users, guard, decks, teamsMode, matchLog, wallet, faiPoints, atelier),
                rules,
                new FlairCombinationAdmin(guard, users, combinations, redemptions, institutional, rules),
                new FlairRedemptions(guard, combinations, redemptions, pieces, users, schemeService, decks, rules, wallet, atelier));
    }
}
