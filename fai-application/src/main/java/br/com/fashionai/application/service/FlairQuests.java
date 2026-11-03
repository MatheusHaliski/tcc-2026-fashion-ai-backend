package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.repository.FlairCoinEntryRepository;
import br.com.fashionai.domain.repository.FlairMatchEntryRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static br.com.fashionai.application.service.FlairService.today;

/**
 * Quests diárias e semanais do {@link FlairService}: o progresso de cada uma a partir dos decks, curtidas, peças novas
 * e duelos vencidos, e o resgate uma vez por período (coins, FAI Points e Poder de direção do Atelier).
 */
final class FlairQuests {
    private final FlairDecks decks;
    private final ReactionRepository reactions;
    private final WardrobeItemRepository pieces;
    private final FlairMatchEntryRepository entries;
    private final FlairCoinEntryRepository coins;
    private final FlairWallet wallet;
    private final FaiPointsService faiPoints;
    private final AtelierRewardSystem atelier;

    FlairQuests(FlairDecks decks, ReactionRepository reactions, WardrobeItemRepository pieces, FlairMatchEntryRepository entries,
                FlairCoinEntryRepository coins, FlairWallet wallet, FaiPointsService faiPoints, AtelierRewardSystem atelier) {
        this.decks = decks;
        this.reactions = reactions;
        this.pieces = pieces;
        this.entries = entries;
        this.coins = coins;
        this.wallet = wallet;
        this.faiPoints = faiPoints;
        this.atelier = atelier;
    }

    record Quest(String code, String label, String period, int coins, String rule) {
    }

    static final List<Quest> QUESTS = List.of(
            new Quest("SEASONAL_LOOK", Msg.k("flair.look_da_estacao"), "DAY", 50, Msg.k("flair.um_deck_com_3_cartas")),
            new Quest("BRAND_COLLECTOR", Msg.k("flair.colecionador_de_marca"), "DAY", 30, Msg.k("flair.um_deck_com_3_pecas")),
            new Quest("VERSATILE_MASTER", Msg.k("flair.mestre_da_versatilidade"), "DAY", 40, Msg.k("flair.um_deck_com_range_medio")),
            new Quest("GLOW_UP", Msg.k("flair.glow_up"), "DAY", 45, Msg.k("flair.um_deck_com_glow_medio")),
            new Quest("STYLE_CURATOR", Msg.k("flair.curadoria_de_estilo"), "WEEK", 200, Msg.k("flair.curtir_10_looks_da_comunidade")),
            new Quest("WARDROBE_MAVEN", Msg.k("flair.guarda_roupa_em_dia"), "WEEK", 150, Msg.k("flair.cadastrar_3_pecas_novas_nesta")),
            new Quest("DUEL_CHAMPION", Msg.k("flair.campeao_de_duelos"), "WEEK", 200, Msg.k("flair.vencer_5_duelos_nesta_semana")),
            new Quest("POWER_DECK", Msg.k("flair.deck_poderoso"), "WEEK", 300, Msg.k("flair.montar_um_deck_com_poder")));

    public List<Map<String, Object>> quests(CurrentUser user) {
        List<Deck> ds = decks.decks(user);
        LocalDate day = today(), weekStart = day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        Instant since = weekStart.atStartOfDay(FaiPointsService.ZONE).toInstant();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Quest q : QUESTS) {
            double progress, target;
            switch (q.code()) {
                case "SEASONAL_LOOK" -> { progress = ds.stream().mapToLong(d -> d.cards().stream().filter(c -> c.stats().get("SYNC") == 100).count()).max().orElse(0); target = 3; }
                case "BRAND_COLLECTOR" -> { progress = ds.stream().mapToDouble(d -> d.brandMultiplier() >= 1.2 ? 3 : d.brandMultiplier() >= 1.1 ? 2 : d.topBrand() == null ? 0 : 1).max().orElse(0); target = 3; }
                case "VERSATILE_MASTER" -> { progress = ds.stream().mapToInt(d -> d.avg().get("RANGE")).max().orElse(0); target = 71; }
                case "GLOW_UP" -> { progress = ds.stream().mapToInt(d -> d.avg().get("GLOW")).max().orElse(0); target = 66; }
                case "STYLE_CURATOR" -> { progress = reactions.countByActorIdAndCreatedAtAfter(user.id(), since); target = 10; }
                case "WARDROBE_MAVEN" -> { progress = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getCreatedAt() != null && w.getCreatedAt().isAfter(since)).count(); target = 3; }
                case "DUEL_CHAMPION" -> { progress = entries.findByUserIdAndCreatedAtAfter(user.id(), since).stream().filter(e -> "DUEL".equals(e.getMatch().getMode()) && Objects.equals(e.getSide(), e.getMatch().getWinnerSide())).count(); target = 5; }
                default -> { progress = ds.stream().mapToInt(Deck::power).max().orElse(0); target = 351; }
            }
            String ref = "DAY".equals(q.period()) ? day.toString() : weekStart.toString();
            boolean claimed = coins.existsByUserIdAndReasonAndRef(user.id(), "QUEST_" + q.code(), ref);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", q.code());
            m.put("label", q.label());
            m.put("period", q.period());
            m.put("rule", q.rule());
            m.put("coins", q.coins());
            m.put("progress", Math.min(progress, target));
            m.put("target", target);
            m.put("done", progress >= target);
            m.put("claimed", claimed);
            out.add(m);
        }
        return out;
    }

    public Map<String, Object> claimQuest(CurrentUser user, String code) {
        Map<String, Object> q = quests(user).stream().filter(x -> x.get("code").equals(code)).findFirst().orElseThrow(() -> ApiException.notFound("Quest"));
        if (!Boolean.TRUE.equals(q.get("done"))) {
            throw new ApiException(409, "QUEST_INCOMPLETA", Msg.t("flair.esta_quest_ainda_nao_foi"));
        }
        LocalDate day = today();
        String ref = "DAY".equals(q.get("period")) ? day.toString() : day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString();
        if (!wallet.award(user.id(), (Integer) q.get("coins"), 10, "QUEST_" + code, ref)) {
            throw ApiException.conflict("QUEST_JA_RESGATADA", Msg.t("flair.recompensa_ja_resgatada_neste_periodo"));
        }
        faiPoints.award(user.id(), "FLAIR_QUEST", "QUEST", "QUEST_" + code + ":" + ref, null);   // RF41
        atelier.grant(AtelierGrants.quest(user.id(), code, (String) q.get("label"), (String) q.get("period"), ref, Instant.now()));
        return wallet.me(user);
    }

}
