package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.moments.MomentViews;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.FlairGameReward;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomInventoryItem;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairGameRewardRepository;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Glass Empire — recompensas extras de um jogo entregue ({@code rewards_json}): um Item do quarto (inventário, origem
 * GLASS_EMPIRE) ou uma carta Especial (R1: origem PROGRAM apontando para a linha de {@code flair_game_rewards}). Cada
 * (pessoa, jogo, código) é concedida UMA vez: a linha gravada é a idempotência; repetir devolve o estado atual.
 * Roda dentro da transação do submit ({@link FlairGameService#submit}).
 */
@Component
public class GlassRewards {
    public static final String SOURCE = "GLASS_EMPIRE";
    public static final String DELIVERED = "DELIVERED";
    public static final String PENDING = "PENDING";
    public static final String ITEM = "ITEM";
    public static final String SPECIAL_CARD = "SPECIAL_CARD";
    public static final int SPECIAL_OVR = 85;

    private final FlairGameRewardRepository rewards;
    private final RoomCatalogItemRepository catalog;
    private final RoomInventoryItemRepository inventory;
    private final FlairCardInstanceRepository cards;
    private Clock clock = Clock.systemUTC();

    public GlassRewards(FlairGameRewardRepository rewards, RoomCatalogItemRepository catalog, RoomInventoryItemRepository inventory,
                        FlairCardInstanceRepository cards) {
        this.rewards = rewards;
        this.catalog = catalog;
        this.inventory = inventory;
        this.cards = cards;
    }

    public void useClock(Clock clock) {
        this.clock = clock;
    }

    /** Concede o que o jogo promete (a condição {@code perfect} só com sintonia máxima); devolve [{type, code, name, state}]. */
    public List<Map<String, Object>> grant(UUID userId, FlairChallenge game, UUID submissionId, boolean perfect) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : Json.list(game.getRewardsJson())) {
            String code = r.get("code") == null ? null : String.valueOf(r.get("code")).trim();
            if (code == null || code.isEmpty()) {
                continue;
            }
            if ("perfect".equalsIgnoreCase(String.valueOf(r.get("condition"))) && !perfect) {
                continue;
            }
            String type = String.valueOf(r.getOrDefault("type", ITEM)).toUpperCase(Locale.ROOT);
            Optional<FlairGameReward> done = rewards.findByUserIdAndChallengeIdAndCode(userId, game.getId(), code);
            FlairGameReward row = done.orElseGet(() -> deliver(userId, game, submissionId, type, code, r));
            out.add(view(r, type, code, row.getState()));
        }
        return out;
    }

    FlairGameReward deliver(UUID userId, FlairChallenge game, UUID submissionId, String type, String code, Map<String, Object> r) {
        FlairGameReward row = new FlairGameReward();
        row.setId(UUID.randomUUID());
        row.setUserId(userId);
        row.setChallengeId(game.getId());
        row.setSubmissionId(submissionId);
        row.setType(type);
        row.setCode(code);
        row.setCreatedAt(Instant.now(clock));
        if (SPECIAL_CARD.equals(type)) {
            row.setState(DELIVERED);
            row.setRefId(specialCard(userId, game, row, r).getId());
        } else {
            RoomInventoryItem item = item(userId, code);
            row.setState(item == null ? PENDING : DELIVERED);
            row.setRefId(item == null ? null : item.getId());
        }
        return rewards.save(row);
    }

    /** Item do quarto: como a compra na loja, mas sem pontos; sem sku no catálogo fica PENDING (o jogo nunca falha por isso). */
    RoomInventoryItem item(UUID userId, String sku) {
        RoomCatalogItem c = catalog.findById(sku).orElse(null);
        if (c == null) {
            return null;
        }
        c.setSoldCount(c.getSoldCount() + 1);
        catalog.save(c);
        RoomInventoryItem item = new RoomInventoryItem();
        item.setId(UUID.randomUUID());
        item.setUserId(userId);
        item.setSku(sku);
        item.setSerial(c.getStockLimit() == null ? null : c.getSoldCount());
        item.setSource(SOURCE);
        item.setAcquiredAt(Instant.now(clock));
        return inventory.save(item);
    }

    /** R1 — carta Especial do jogo: origem PROGRAM, {@code originId} = linha da recompensa (única por pessoa, jogo e código). */
    FlairCardInstance specialCard(UUID userId, FlairChallenge game, FlairGameReward row, Map<String, Object> r) {
        FlairCardInstance c = new FlairCardInstance();
        c.setOwnerId(userId);
        c.setCreatorId(userId);
        c.setOriginType("PROGRAM");
        c.setOriginId(row.getId());
        c.setSeason(FlairService.season());
        c.setTier("ESPECIAL");
        c.setOvr(SPECIAL_OVR);
        c.setRare(false);
        c.setPosition("VES");
        c.setName(name(r, row.getCode()));
        c.setImageUrl(game.getThumbnail());
        c.setBasisJson(Json.write(Map.of("challengeId", game.getId().toString(), "code", row.getCode())));
        c.setPriceVerified(false);
        c.setState("AVAILABLE");
        c.setTradeable(false);
        c.setAcquiredVia(SOURCE);
        c.setTagsJson("{}");
        return cards.save(c);
    }

    static String name(Map<String, Object> r, String code) {
        String n = MomentViews.label(r.get("names"));
        return n == null || n.isBlank() ? code : n;
    }

    static Map<String, Object> view(Map<String, Object> r, String type, String code, String state) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("type", type);
        v.put("code", code);
        v.put("name", name(r, code));
        v.put("state", state);
        return v;
    }

    /** Resumo das recompensas de um jogo para o catálogo: [{type, code, name}] (sem estado). */
    public static List<Map<String, Object>> promised(FlairChallenge game) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : Json.list(game.getRewardsJson())) {
            String code = r.get("code") == null ? "" : String.valueOf(r.get("code"));
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("type", String.valueOf(r.getOrDefault("type", ITEM)).toUpperCase(Locale.ROOT));
            v.put("code", code);
            v.put("name", name(r, code));
            v.put("condition", r.get("condition"));
            out.add(v);
        }
        return out;
    }
}
