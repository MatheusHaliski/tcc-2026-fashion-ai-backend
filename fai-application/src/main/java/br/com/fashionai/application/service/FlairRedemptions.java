package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.FlairCombination;
import br.com.fashionai.domain.model.FlairRedemption;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.repository.FlairCombinationRepository;
import br.com.fashionai.domain.repository.FlairRedemptionRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairCombinationRules.sellerActive;

/**
 * Lado do jogador nas combinações do {@link FlairService}: a vitrine com o melhor deck e o checklist de cada
 * combinação, a conferência de um deck, a troca pelo cupom (um por pessoa e combinação) e a carteira de cupons.
 */
final class FlairRedemptions {
    private final Guard guard;
    private final FlairCombinationRepository combinations;
    private final FlairRedemptionRepository redemptions;
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final SchemeService schemeService;
    private final FlairDecks decks;
    private final FlairCombinationRules rules;
    private final FlairWallet wallet;
    private final AtelierRewardSystem atelier;

    FlairRedemptions(Guard guard, FlairCombinationRepository combinations, FlairRedemptionRepository redemptions,
                     WardrobeItemRepository pieces, UserRepository users, SchemeService schemeService, FlairDecks decks,
                     FlairCombinationRules rules, FlairWallet wallet, AtelierRewardSystem atelier) {
        this.guard = guard;
        this.combinations = combinations;
        this.redemptions = redemptions;
        this.pieces = pieces;
        this.users = users;
        this.schemeService = schemeService;
        this.decks = decks;
        this.rules = rules;
        this.wallet = wallet;
        this.atelier = atelier;
    }

    private static final SecureRandom RANDOM = new SecureRandom();

    /** Combinações ativas de todas as lojas, cada uma com o melhor deck do jogador e o checklist dos requisitos. */
    public List<Map<String, Object>> combinationsFor(CurrentUser user) {
        List<Deck> ds = user == null ? List.of() : decks.decks(user);
        List<Card> wardrobe = user == null ? List.of() : decks.cardsOf(pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList());
        List<Map<String, Object>> out = new ArrayList<>();
        for (FlairCombination c : combinations.findByActiveTrueOrderByCreatedAtDesc()) {
            if (!sellerActive(c.getBrand())) {
                continue;                                  // loja aguardando aprovação (ou suspensa) não aparece na vitrine
            }
            Map<String, Object> v = rules.combinationView(c, user, null);
            if (user != null) {
                Deck best = null;
                List<Map<String, Object>> bestChecks = rules.check(c, null, wardrobe, user);
                long bestOk = bestChecks.stream().filter(x -> Boolean.TRUE.equals(x.get("ok"))).count();
                if (!"COLECAO".equals(c.getGameType())) {
                    for (Deck d : ds) {
                        List<Map<String, Object>> ch = rules.check(c, d, wardrobe, user);
                        long ok = ch.stream().filter(x -> Boolean.TRUE.equals(x.get("ok"))).count();
                        if (best == null || ok > bestOk || ok == bestOk && d.power() > best.power()) {
                            best = d;
                            bestChecks = ch;
                            bestOk = ok;
                        }
                    }
                }
                v.put("bestDeck", best == null ? null : Map.of("schemeId", best.schemeId(), "title", best.title(), "power", best.power()));
                v.put("checks", bestChecks);
                v.put("complete", !bestChecks.isEmpty() && bestChecks.stream().allMatch(x -> Boolean.TRUE.equals(x.get("ok"))));
            }
            out.add(v);
        }
        return out;
    }

    public Map<String, Object> checkCombination(CurrentUser user, UUID id, UUID schemeId) {
        FlairCombination c = combinations.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("flair.combinacao")));
        Deck d = schemeId == null ? null : decks.deck(schemeService.owned(user, schemeId));
        List<Card> wardrobe = decks.cardsOf(pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList());
        List<Map<String, Object>> checks = rules.check(c, d, wardrobe, user);
        return Map.of("combination", rules.combinationView(c, user, d), "deck", d == null ? Map.of() : d, "checks", checks,
                "complete", !checks.isEmpty() && checks.stream().allMatch(x -> Boolean.TRUE.equals(x.get("ok"))));
    }

    /** Troca o deck pelo cupom da loja: um por pessoa e combinação, com estoque e validade. */
    public Map<String, Object> redeem(CurrentUser user, UUID id, UUID schemeId) {
        guard.requireCanCreate(user);
        FlairCombination c = combinations.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("flair.combinacao")));
        if (!rules.available(c)) {
            throw new ApiException(409, "COMBINACAO_INDISPONIVEL", Msg.t("flair.esta_combinacao_nao_esta_mais"));
        }
        if (redemptions.findByCombinationIdAndUserId(c.getId(), user.id()).isPresent()) {
            throw ApiException.conflict("CUPOM_JA_EMITIDO", Msg.t("flair.voce_ja_completou_esta_combinacao"));
        }
        Scheme s = "COLECAO".equals(c.getGameType()) || schemeId == null ? null : decks.ownDeckScheme(user, schemeId);
        Deck d = s == null ? null : decks.deck(s);
        List<Card> wardrobe = decks.cardsOf(pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList());
        List<Map<String, Object>> checks = rules.check(c, d, wardrobe, user);
        if (checks.isEmpty() || !checks.stream().allMatch(x -> Boolean.TRUE.equals(x.get("ok")))) {
            throw new ApiException(422, "COMBINACAO_INCOMPLETA", Msg.t("flair.o_deck_ainda_nao_completa"), Map.of("checks", checks));
        }
        FlairRedemption r = new FlairRedemption();
        r.setCombination(c);
        r.setUser(users.findById(user.id()).orElseThrow());
        r.setScheme(s);
        String code;
        do {
            code = "FLR-" + token(4) + "-" + token(4);
        } while (redemptions.existsByCode(code));
        r.setCode(code);
        r.setStatus("EMITIDO");
        r.setDeckPower(d == null ? null : d.power());
        r.setExpiresAt(Instant.now().plus(c.getValidDays(), ChronoUnit.DAYS));
        redemptions.save(r);
        c.setRedeemed(c.getRedeemed() + 1);
        wallet.award(user.id(), 0, 50, "REDEMPTION", c.getId().toString());
        // Atelier: concluir a jornada da marca/celebridade vale um convite de temporada daquele perfil
        atelier.grant(AtelierGrants.brandJourney(user.id(), c.getId(), c.getName(), c.getBrand().getId(), rules.brandNameOf(c.getBrand()), Instant.now()));
        return rules.redemptionView(r);
    }

    private static String token(int n) {
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < n; i++) {
            b.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
        }
        return b.toString();
    }

    public List<Map<String, Object>> vouchers(CurrentUser user) {
        return redemptions.findByUserIdOrderByCreatedAtDesc(user.id()).stream().map(rules::redemptionView).toList();
    }

}
