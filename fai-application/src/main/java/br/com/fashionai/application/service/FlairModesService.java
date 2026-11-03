package br.com.fashionai.application.service;

import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Scheme;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * FLAIR como conjunto de modos sobre as mesmas peças, looks, HypeScore e estatísticas do Fashion AI:
 * <b>PEÇA → CARD → LOOK → TEAM/DECK → COMPETIÇÃO</b>. Núcleo: Battle of Looks, FLAIR Squad, Fashion League, Fashion
 * World Tour, FLAIR Conquest e Deck Battle. Eventos especiais: Wardrobe Wars, Runway, Draft, Tag Team, Fashion Boss,
 * Combo Battle, Fashion Monopoly, FLAIR Chess e Ultimate Team. Todos usam o motor {@link FlairLooks}; recompensas vêm
 * do sistema (sem aposta), com teto diário por modo.
 *
 * <p>HypeScore v2 (RF53 · P2-17): o atributo HYPE de cada look é o Hype v2 PÚBLICO ({@link FlairService#publicLookHype});
 * sem ele, 50 neutro. A coluna da liga que somava os pontos das rodadas deixou de se chamar "hype" (era só homônima):
 * agora é {@code stylePoints} ("Pontos de estilo"); {@code hype} segue no payload como alias deprecado.</p>
 */
@Service
public class FlairModesService {
    static final int REWARDED_PER_MODE_DAY = 3;
    static final Set<String> COMPETITIVE = Set.of("DUEL", "TEAM", "BATTLE", "SQUAD", "LEAGUE", "TAG_TEAM", "CONQUEST", "MONOPOLY", "COMBO", "ULTIMATE");

    private final FlairModeParts parts;

    public FlairModesService(FlairService flair, SchemeService schemeService, SchemeRepository schemes, SchemeItemRepository schemeItems,
                             WardrobeItemRepository pieces, UserRepository users, FlairMatchRepository matches, FlairMatchEntryRepository entries,
                             FlairModeStateRepository states, FlairTerritoryRepository territories, FlairTrophyRepository trophies,
                             FlairCoinEntryRepository coins, NotificationService notifications, Guard guard, FaiPointsService faiPoints,
                             AtelierRewardSystem atelier) {
        this.parts = FlairModeParts.of(flair, schemeService, schemes, schemeItems, pieces, users, matches, entries, states, territories,
                trophies, coins, notifications, guard, faiPoints, atelier);
    }

    // ================================================================== catálogo

    public record Mode(String code, String name, String emoji, String group, String summary, String how) {
    }

    public static final List<Mode> MODES = FlairModeCatalog.MODES;

    public record Square(int index, String city, String title, String emoji, String type, String theme, int target, int reward, String rule) {
    }

    public static final List<String> CITIES = FlairModeCatalog.CITIES;
    public static final List<Square> BOARD = FlairModeCatalog.BOARD;

    public record Territory(String map, String code, String name, String emoji, String style, String theme, String bonus) {
    }

    public static final List<Territory> TERRITORIES = FlairModeCatalog.TERRITORIES;

    public Map<String, Object> catalog() {
        return FlairModeCatalog.catalog();
    }

    // ================================================================== looks, histórico e troféus

    /** Look do FLAIR: HYPE = HypeScore v2 público do look (nulo → neutro em FlairLooks), nunca o v1 de schemes.hype_score. */
    Look look(Scheme s) {
        return parts.modeLooks().look(s);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> myLooks(CurrentUser user) {
        return parts.modeLooks().myLooks(user);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> trophiesOf(UUID userId) {
        return parts.recorder().trophiesOf(userId);
    }

    // ================================================================== duelos: Battle of Looks, Squad, Combo e Tag Team

    @Transactional
    public Map<String, Object> battle(CurrentUser user, UUID schemeId, String opponent, String themeCode) {
        return parts.duels().battle(user, schemeId, opponent, themeCode);
    }

    @Transactional
    public Map<String, Object> squad(CurrentUser user, List<UUID> schemeIds, String opponent) {
        return parts.duels().squad(user, schemeIds, opponent);
    }

    @Transactional
    public Map<String, Object> combo(CurrentUser user, UUID schemeId, String opponent) {
        return parts.duels().combo(user, schemeId, opponent);
    }

    @Transactional
    public Map<String, Object> tagTeam(CurrentUser user, UUID schemeId, String partner, List<String> opponents) {
        return parts.duels().tagTeam(user, schemeId, partner, opponents);
    }

    // ================================================================== Fashion League e FLAIR Runway

    @Transactional
    public Map<String, Object> saveRoster(CurrentUser user, List<UUID> starters, List<UUID> reserves, List<UUID> specials) {
        return parts.leagueMode().saveRoster(user, starters, reserves, specials);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> league(CurrentUser user) {
        return parts.leagueMode().league(user);
    }

    @Transactional
    public Map<String, Object> playLeague(CurrentUser user) {
        return parts.leagueMode().playLeague(user);
    }

    /** Atualiza a tabela da liga; {@code stylePoints} = soma das notas da rodada (não é HypeScore). */
    static void table(Map<String, Object> st, String winner, String side, int stylePoints) {
        FlairLeagueMode.table(st, winner, side, stylePoints);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> runway(CurrentUser user) {
        return parts.runwayMode().runway(user);
    }

    @Transactional
    public Map<String, Object> enterRunway(CurrentUser user, UUID schemeId) {
        return parts.runwayMode().enterRunway(user, schemeId);
    }

    // ================================================================== tabuleiros: World Tour, Monopoly e Conquest

    @Transactional
    public Map<String, Object> tour(CurrentUser user) {
        return parts.worldTour().tour(user);
    }

    @Transactional
    public Map<String, Object> roll(CurrentUser user) {
        return parts.worldTour().roll(user);
    }

    @Transactional
    public Map<String, Object> resolveTour(CurrentUser user, UUID schemeId) {
        return parts.worldTour().resolveTour(user, schemeId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> territories(CurrentUser user, String map) {
        return parts.territoryModes().territories(user, map);
    }

    @Transactional
    public Map<String, Object> attack(CurrentUser user, String map, String code, List<UUID> schemeIds) {
        return parts.territoryModes().attack(user, map, code, schemeIds);
    }

    // ================================================================== cartas: FLAIR Draft e Deck Battle (TCG)

    @Transactional
    public Map<String, Object> draftStart(CurrentUser user) {
        return parts.draftMode().draftStart(user);
    }

    @Transactional
    public Map<String, Object> draftPick(CurrentUser user, UUID id, UUID pieceId) {
        return parts.draftMode().draftPick(user, id, pieceId);
    }

    @Transactional
    public Map<String, Object> draftFinish(CurrentUser user, UUID id, List<List<UUID>> looks) {
        return parts.draftMode().draftFinish(user, id, looks);
    }

    @Transactional
    public Map<String, Object> deck(CurrentUser user) {
        return parts.deckMode().deck(user);
    }

    @Transactional
    public Map<String, Object> saveDeck(CurrentUser user, List<UUID> pieceIds) {
        return parts.deckMode().saveDeck(user, pieceIds);
    }

    @Transactional
    public Map<String, Object> deckStart(CurrentUser user) {
        return parts.deckMode().deckStart(user);
    }

    @Transactional
    public Map<String, Object> deckPlay(CurrentUser user, UUID id, List<UUID> pieceIds) {
        return parts.deckMode().deckPlay(user, id, pieceIds);
    }

    // ================================================================== Fashion Boss, Wardrobe Wars e FLAIR Chess

    @Transactional
    public Map<String, Object> fightBoss(CurrentUser user, String code, List<UUID> schemeIds) {
        return parts.bossMode().fightBoss(user, code, schemeIds);
    }

    @Transactional
    public Map<String, Object> wardrobeWars(CurrentUser user, String opponent) {
        return parts.wardrobeMode().wardrobeWars(user, opponent);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> chessSuggest(CurrentUser user) {
        return parts.chessMode().chessSuggest(user);
    }

    @Transactional
    public Map<String, Object> chess(CurrentUser user, Map<String, UUID> placement) {
        return parts.chessMode().chess(user, placement);
    }

    // ================================================================== FLAIR Ultimate Team

    @Transactional
    public Map<String, Object> ultimate(CurrentUser user) {
        return parts.ultimateTeam().ultimate(user);
    }

    @Transactional
    public Map<String, Object> saveUltimate(CurrentUser user, Map<String, UUID> roles) {
        return parts.ultimateTeam().saveUltimate(user, roles);
    }

    @Transactional
    public Map<String, Object> playUltimate(CurrentUser user, String opponent) {
        return parts.ultimateTeam().playUltimate(user, opponent);
    }
}
