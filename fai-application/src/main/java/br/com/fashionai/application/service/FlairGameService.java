package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.CbcCardMapper;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.moments.MomentViews;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AuraPermissionsService.AuraType;
import br.com.fashionai.application.service.FaiPointsService.Level;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.FlairChallengeSubmission;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.FlairChallengeStatus;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * FLAIR 3D MAKE UP — os 100 jogos FLAIR: linhas de {@code flair_challenges} com {@code series} que o motor dos Desafios de
 * Montagem avalia. Este serviço aplica o bloqueio por nível ({@link Flair3dAccess}: PRIMEIRA instrução de check/submit),
 * reaproveita janela, limite, avaliação, história e pontos do {@link FlairChallengeService}, e acrescenta o resultado
 * "flair3d" (Hype de partida e efeitos, {@link FlairGame3dScore}), o bônus FLAIR_3D_PERFECT e as recompensas extras
 * ({@link Flair3dRewards}). Catálogo e detalhe só informam o acesso; nunca bloqueiam a leitura.
 */
@Service
public class FlairGameService {
    public static final int PERFECT_BONUS = 10;
    public static final String PERFECT_ACTION = "FLAIR_3D_PERFECT";

    public record Filters(String level, String wardrobe, String difficulty, String rarity, String series, String district, String q) {
    }

    private final FlairChallengeRepository challenges;
    private final FlairChallengeService cbc;
    private final Flair3dAccess access;
    private final Flair3dRewards rewards;
    private final FlairCardInstanceRepository cards;
    private final WardrobeItemRepository pieces;
    private final AuraPermissionsService auras;
    private final FaiPointsService points;

    public FlairGameService(FlairChallengeRepository challenges, FlairChallengeService cbc, Flair3dAccess access, Flair3dRewards rewards,
                            FlairCardInstanceRepository cards, WardrobeItemRepository pieces, AuraPermissionsService auras,
                            FaiPointsService points) {
        this.challenges = challenges;
        this.cbc = cbc;
        this.access = access;
        this.rewards = rewards;
        this.cards = cards;
        this.pieces = pieces;
        this.auras = auras;
        this.points = points;
    }

    /** Os jogos ativos, por número. */
    List<FlairChallenge> games() {
        return challenges.findAllByOrderBySortOrderAsc().stream()
                .filter(c -> c.getSeries() != null && c.getStatus() == FlairChallengeStatus.ACTIVE)
                .sorted(Comparator.comparing(FlairChallenge::getGameNumber, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    /** R13: só linhas com série são jogos; o resto (e o inexistente) é 404. */
    FlairChallenge game(String slug) {
        return challenges.findBySlug(slug == null ? "" : slug.toLowerCase(Locale.ROOT)).filter(c -> c.getSeries() != null)
                .orElseThrow(() -> new ApiException(404, "DESAFIO_NAO_ENCONTRADO", Msg.t("apiException.nao_encontrado_a", Msg.t("cbc.desafio"))));
    }

    // ================================================================== catálogo
    /** Hub (R11): {total, playable, byTier}; visitante → playable 0. */
    @Transactional(readOnly = true)
    public Map<String, Object> summary(CurrentUser viewer) {
        List<FlairChallenge> all = games();
        Flair3dAccess.Me me = access.me(viewer == null ? null : viewer.id());
        Map<String, Integer> byTier = new LinkedHashMap<>();
        for (Level l : Level.values()) {
            byTier.put(l.name(), 0);
        }
        int playable = 0;
        for (FlairChallenge c : all) {
            byTier.merge(String.valueOf(c.getRequiredLevel()), 1, Integer::sum);
            playable += access.check(c, me, viewer != null).allowed() ? 1 : 0;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", all.size());
        out.put("playable", playable);
        out.put("byTier", byTier);
        return out;
    }

    /** Catálogo filtrado, ordenado por número; uma leitura de nível e de guarda-roupa por requisição (R10). */
    @Transactional(readOnly = true)
    public Map<String, Object> list(CurrentUser viewer, Filters f) {
        List<FlairChallenge> all = games().stream().filter(c -> matches(c, f)).toList();
        Flair3dAccess.Me me = access.me(viewer == null ? null : viewer.id());
        Map<UUID, List<FlairChallengeSubmission>> mine = cbc.mineBy(viewer, all);
        Instant now = cbc.now();
        List<Map<String, Object>> games = new ArrayList<>();
        for (FlairChallenge c : all) {
            Map<String, Object> v = cbc.summary(c, null, cbc.window(c, null, now), viewer, mine.getOrDefault(c.getId(), List.of()));
            games.add(FlairGameViews.summary(v, c, access.check(c, me, viewer != null)));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("games", games);
        out.put("me", viewer == null ? null : me.toMap());
        out.put("season", FlairService.season());
        out.put("counts", FlairGameViews.counts(all));
        return out;
    }

    static boolean matches(FlairChallenge c, Filters f) {
        if (f == null) {
            return true;
        }
        return same(f.level(), c.getRequiredLevel()) && same(f.wardrobe(), c.getRequiredWardrobeLevel())
                && same(f.difficulty(), c.getDifficulty().name()) && same(f.rarity(), c.getRarity())
                && same(f.series(), c.getSeries()) && same(f.district(), c.getDistrict()) && mentions(c, f.q());
    }

    static boolean same(String wanted, String actual) {
        return wanted == null || wanted.isBlank() || wanted.trim().equalsIgnoreCase(actual);
    }

    static boolean mentions(FlairChallenge c, String q) {
        if (q == null || q.isBlank()) {
            return true;
        }
        String hay = (c.getSlug() + " " + MomentViews.localized(c.getName(), c.getNamesJson()) + " "
                + MomentViews.localized(c.getDescription(), c.getDescriptionsJson())).toLowerCase(Locale.ROOT);
        return hay.contains(q.trim().toLowerCase(Locale.ROOT));
    }

    /** Detalhe do CBC + campos FLAIR 3D MAKE UP; o acesso é informado, nunca bloqueia a leitura. */
    @Transactional(readOnly = true)
    public Map<String, Object> detail(CurrentUser viewer, String slug) {
        FlairChallenge g = game(slug);
        Map<String, Object> out = cbc.detail(viewer, g.getSlug());
        FlairGameViews.summary(out, g, access.check(g, access.me(viewer == null ? null : viewer.id()), viewer != null));
        return FlairGameViews.detail(out, g);
    }

    // ================================================================== conferir e entregar
    @Transactional(readOnly = true)
    public Map<String, Object> check(CurrentUser user, String slug, FlairChallengeService.BuildRequest req) {
        FlairChallenge g = game(slug);
        access.require(g, access.me(user.id()));
        Map<String, Object> out = cbc.check(user, g.getSlug(), req);
        if (flair3d(user, g, out).perfect()) {
            FlairGameViews.perfectLine(out, g, null);
        }
        return out;
    }

    /** R7: uma transação para a entrega do CBC, o bônus de perfeição e as recompensas extras. */
    @Transactional
    public Map<String, Object> submit(CurrentUser user, String slug, FlairChallengeService.BuildRequest req) {
        FlairChallenge g = game(slug);
        access.require(g, access.me(user.id()));
        Map<String, Object> out = cbc.submit(user, g.getSlug(), req);
        boolean perfect = flair3d(user, g, out).perfect();
        if (perfect) {
            FlairGameViews.perfectLine(out, g, points.award(user.id(), PERFECT_ACTION, "FLAIR_CHALLENGE", g.getId().toString(), PERFECT_BONUS));
        }
        out.put("rewards", rewards.grant(user.id(), g, FlairGameViews.uuid(out, "submission"), perfect));
        return out;
    }

    /** Anexa {@code flair3d} e troca a abertura da história pelo cenário da ficha (R8). */
    @SuppressWarnings("unchecked")
    FlairGame3dScore.Score flair3d(CurrentUser user, FlairChallenge g, Map<String, Object> out) {
        Map<String, Object> evaluation = out.get("evaluation") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
        List<CbcRules.SlotResult> results = FlairGameViews.slotResults(evaluation);
        List<FlairCardInstance> placed = cards.findAllById(results.stream().map(CbcRules.SlotResult::cardId).filter(Objects::nonNull).toList());
        Map<UUID, WardrobeItem> byPiece = CbcCardMapper.pieces(placed, pieces);
        Map<UUID, CbcRules.Card> models = CbcCardMapper.models(placed, byPiece, FlairCollectionService::tagsOf);
        FlairGame3dScore.Score flair3d = FlairGame3dScore.of(g, evaluation, results, models, player(user, placed, byPiece));
        out.put("flair3d", flair3d.toMap());
        out.put("story", FlairGameViews.story(out.get("story"), g));
        return flair3d;
    }

    /** R21: Metamorfose e Impersonation exigem a aura (nível Loft); Impersonation ainda exige a peça pronta. */
    FlairGame3dScore.Player player(CurrentUser user, List<FlairCardInstance> placed, Map<UUID, WardrobeItem> byPiece) {
        boolean metamorfose = auras.canUserEquipAura(user.id(), AuraType.AURA_METAMORPHOSE);
        Set<UUID> ready = new HashSet<>();
        if (auras.canUserEquipAura(user.id(), AuraType.AURA_IMPERSONATION)) {
            for (FlairCardInstance c : placed) {
                WardrobeItem w = "PIECE".equals(c.getOriginType()) ? byPiece.get(c.getOriginId()) : null;
                if (w != null && FlairGame3dScore.impersonationReady(w.getBackgroundConfigJson())) {
                    ready.add(c.getId());
                }
            }
        }
        return new FlairGame3dScore.Player(metamorfose, ready);
    }
}
