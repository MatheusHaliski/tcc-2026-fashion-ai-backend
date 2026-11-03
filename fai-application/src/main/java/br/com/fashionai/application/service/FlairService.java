package br.com.fashionai.application.service;

import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.FlairCombination;
import br.com.fashionai.domain.model.FlairProfile;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * FLAIR (card Trello · jogo de cartas): as cartas são as peças e os decks são os esquemas do usuário. Jogos:
 * <ol>
 *   <li><b>Combinação da loja</b> — a loja participante define, no perfil (aba "Minhas combinações FLAIR"), o que o deck
 *   precisa ter (categorias, estilos, ocasiões, peças da marca, poder mínimo, raridade); quem completa ganha o cupom.
 *   Variações: COMBINACAO (um deck), COLECAO (o guarda-roupa inteiro) e DUELO_PATROCINADO (vitórias com peças da marca).</li>
 *   <li><b>Duelo de estilo 1×1</b> — 5 rodadas (EDGE, RANGE, CLOUT, GLOW, ART) contra o melhor deck público de outra
 *   pessoa ou contra "a Casa" (deck do dia montado com peças públicas).</li>
 *   <li><b>Batalha de ocasião do dia</b> — tema igual para todos (ocasião sorteada pela data), um deck por pessoa, placar do dia.</li>
 *   <li><b>Duelo de equipes 3×3 e Liga semanal</b> — equipes de até 5; os 3 melhores decks de cada lado se enfrentam.</li>
 *   <li><b>Quests</b> diárias e semanais, <b>álbum</b> de raridades por categoria e <b>rank</b> (Rookie → Legend).</li>
 * </ol>
 * Limites éticos: não há aposta de coins (o público começa aos 13 anos); a recompensa de duelo vem do sistema, com teto
 * diário; coins só compram itens cosméticos (skins de carta); nenhum aviso de "você vai perder".
 *
 * <p>HypeScore v2 (RF53 · Lote 8): a raridade das cartas e o atributo HYPE dos looks leem o estado v2 gravado pelo job
 * ({@code hype_scores}, nunca recalculado aqui), e só o Hype PÚBLICO ({@code publicEligible}) entra no jogo: a mesma
 * carta vale o mesmo para qualquer jogador e nenhum Hype pessoal de item privado aparece para o adversário. O preço da
 * peça não dá poder (sem pay-to-win).</p>
 */
@Service
public class FlairService {
    private final FlairServiceParts parts;

    public FlairService(FlairProfileRepository profiles, FlairCoinEntryRepository coins, FlairCombinationRepository combinations,
                        FlairRedemptionRepository redemptions, FlairTeamRepository teams, FlairTeamMemberRepository members,
                        FlairMatchRepository matches, FlairMatchEntryRepository entries, UserRepository users,
                        WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                        BrandProfileRepository brands, ReactionRepository reactions, SchemeService schemeService,
                        InstitutionalService institutional, Guard guard, org.springframework.context.ApplicationEventPublisher events,
                        FaiPointsService faiPoints, HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig,
                        AtelierRewardSystem atelier) {
        this.parts = FlairServiceParts.of(profiles, coins, combinations, redemptions, teams, members, matches, entries, users, pieces,
                schemes, schemeItems, brands, reactions, schemeService, institutional, guard, events, faiPoints, hypeScores, hypeConfig, atelier);
    }

    static LocalDate today() {
        return LocalDate.now(FaiPointsService.ZONE);
    }

    static String season() {
        return FlairEngine.season(today());
    }

    /** HypeScore v2 PÚBLICO de looks (atributo HYPE do FLAIR): ausente no mapa = sem Hype público (neutro no jogo). */
    public Map<UUID, Double> publicLookHype(Collection<UUID> schemeIds) {
        return parts.decks().publicLookHype(schemeIds);
    }

    public Double publicLookHype(UUID schemeId) {
        return parts.decks().publicLookHype(schemeId);
    }

    /** Cartas de várias peças com o Hype v2 em lote (uma consulta para todas). */
    public List<Card> cardsOf(List<WardrobeItem> ws) {
        return parts.decks().cardsOf(ws);
    }

    Card card(WardrobeItem w) {
        return parts.decks().card(w);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> cards(CurrentUser user) {
        return parts.decks().cards(user);
    }

    @Transactional(readOnly = true)
    public List<Deck> decks(CurrentUser user) {
        return parts.decks().decks(user);
    }

    @Transactional(readOnly = true)
    public Deck deckOf(CurrentUser viewer, UUID schemeId) {
        return parts.decks().deckOf(viewer, schemeId);
    }

    FlairProfile profile(UUID userId) {
        return parts.wallet().profile(userId);
    }

    /** Recompensa idempotente: (motivo, referência) paga uma vez só. */
    boolean award(UUID userId, int delta, int rankPoints, String reason, String ref) {
        return parts.wallet().award(userId, delta, rankPoints, reason, ref);
    }

    @Transactional
    public Map<String, Object> me(CurrentUser user) {
        return parts.wallet().me(user);
    }

    @Transactional
    public Map<String, Object> buySkin(CurrentUser user, String skin, boolean activate) {
        return parts.wallet().buySkin(user, skin, activate);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> quests(CurrentUser user) {
        return parts.quests().quests(user);
    }

    @Transactional
    public Map<String, Object> claimQuest(CurrentUser user, String code) {
        return parts.quests().claimQuest(user, code);
    }

    @Transactional
    public Map<String, Object> duel(CurrentUser user, UUID schemeId, String opponent) {
        return parts.duels().duel(user, schemeId, opponent);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> arena(CurrentUser viewer) {
        return parts.arena().arena(viewer);
    }

    @Transactional
    public Map<String, Object> joinArena(CurrentUser user, UUID schemeId) {
        return parts.arena().joinArena(user, schemeId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> league(CurrentUser viewer) {
        return parts.teams().league(viewer);
    }

    @Transactional
    public Map<String, Object> createTeam(CurrentUser user, String name, String color) {
        return parts.teams().createTeam(user, name, color);
    }

    @Transactional
    public Map<String, Object> joinTeam(CurrentUser user, String code) {
        return parts.teams().joinTeam(user, code);
    }

    @Transactional
    public Map<String, Object> leaveTeam(CurrentUser user) {
        return parts.teams().leaveTeam(user);
    }

    @Transactional
    public Map<String, Object> teamBattle(CurrentUser user, String opponentCode) {
        return parts.teamBattle().teamBattle(user, opponentCode);
    }

    /** Card RF38 — uma vitória pode completar uma combinação: reavalia os direitos a cupom depois do commit. */
    public void rightsCheck(UUID userId) {
        parts.wallet().rightsCheck(userId);
    }

    /** Loja apta a oferecer cupom: perfil de marca/celebridade aprovado e conta ativa (pendente, suspensa ou excluída não). */
    static boolean sellerActive(User owner) {
        return FlairCombinationRules.sellerActive(owner);
    }

    public record CombinationForm(String name, String description, String gameType, List<String> requiredCategories,
                                  List<String> requiredStyles, List<String> requiredOccasions, Integer minBrandPieces,
                                  Integer minDeckPower, String minRarity, Integer minWins, String couponTitle,
                                  Integer discountPercent, BigDecimal discountAmount, BigDecimal minPurchase, Integer validDays,
                                  Integer stock, Boolean active, Instant startsAt, Instant endsAt, String accentColor, String storeUrl) {
    }

    @Transactional
    public Map<String, Object> saveCombination(CurrentUser user, UUID id, CombinationForm f) {
        return parts.combinationAdmin().saveCombination(user, id, f);
    }

    @Transactional
    public void deleteCombination(CurrentUser user, UUID id) {
        parts.combinationAdmin().deleteCombination(user, id);
    }

    boolean available(FlairCombination c) {
        return parts.combinationRules().available(c);
    }

    /** Combinações ativas de todas as lojas, cada uma com o melhor deck do jogador e o checklist dos requisitos. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> combinationsFor(CurrentUser user) {
        return parts.redemptions().combinationsFor(user);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> checkCombination(CurrentUser user, UUID id, UUID schemeId) {
        return parts.redemptions().checkCombination(user, id, schemeId);
    }

    /** Troca o deck pelo cupom da loja: um por pessoa e combinação, com estoque e validade. */
    @Transactional
    public Map<String, Object> redeem(CurrentUser user, UUID id, UUID schemeId) {
        return parts.redemptions().redeem(user, id, schemeId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> vouchers(CurrentUser user) {
        return parts.redemptions().vouchers(user);
    }

    /** Aba "Minhas combinações FLAIR" (dono) / "Combinações FLAIR" (visitante) do perfil da loja. */
    @Transactional(readOnly = true)
    public Map<String, Object> brandTab(CurrentUser viewer, String slug) {
        return parts.combinationAdmin().brandTab(viewer, slug);
    }

    /** No caixa: a loja confere o código e marca o cupom como usado. */
    @Transactional
    public Map<String, Object> validateCode(CurrentUser user, String code) {
        return parts.combinationAdmin().validateCode(user, code);
    }
}
