package br.com.fashionai.application.service;

import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.FlairGameReward;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomInventoryItem;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairGameRewardRepository;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Glass Empire — recompensas extras: idempotência por (pessoa, jogo, código), carta Especial própria para cada pessoa
 * (R1: origem PROGRAM apontando para a linha da recompensa), Item sem sku no catálogo fica PENDING sem falhar e a
 * condição "perfect" só com sintonia máxima.
 */
class GlassRewardsTest {
    static final Instant NOW = Instant.parse("2026-11-05T12:00:00Z");
    static final String REWARDS = "[{\"type\":\"ITEM\",\"code\":\"GE-A01-MOLDURA\",\"names\":{\"pt-BR\":\"Moldura Prisma\",\"en\":\"Prism Frame\",\"es\":\"Marco Prisma\"}},"
            + "{\"type\":\"SPECIAL_CARD\",\"code\":\"GE-A01-ESPELHO\",\"names\":{\"pt-BR\":\"Espelho Inteiro\",\"en\":\"Whole Mirror\",\"es\":\"Espejo Entero\"},\"condition\":\"perfect\"}]";

    private Kit kit;
    private GlassRewards rewards;
    private FlairChallenge game;
    private final UUID ana = UUID.randomUUID();
    private final UUID bia = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        kit = new Kit();
        rewards = kit.build(GlassRewards.class);
        rewards.useClock(Clock.fixed(NOW, ZoneOffset.UTC));
        game = new FlairChallenge();
        game.assignId(UUID.randomUUID());
        game.setSlug("a01-espelho-partido");
        game.setSeries("A");
        game.setThumbnail("/flair/games/a01-espelho-partido.webp");
        game.setRewardsJson(REWARDS);
    }

    RoomCatalogItem sku(String sku, Integer stock) {
        RoomCatalogItem c = new RoomCatalogItem();
        c.setSku(sku);
        c.setName("Moldura Prisma");
        c.setMoldId("GLASS-DECOR");
        c.setSlotType("DECOR");
        c.setRarity("COMMON");
        c.setRequiredLevel("ESTREIA");
        c.setStockLimit(stock);
        c.setActive(false);
        return kit.save(RoomCatalogItemRepository.class, c);
    }

    List<FlairGameReward> rows() {
        return MemoryRepository.rows(kit.dep(FlairGameRewardRepository.class));
    }

    List<FlairCardInstance> cards() {
        return MemoryRepository.rows(kit.dep(FlairCardInstanceRepository.class));
    }

    List<RoomInventoryItem> inventory() {
        return MemoryRepository.rows(kit.dep(RoomInventoryItemRepository.class));
    }

    @Test
    void entregaItemECartaEspecialUmaVezSoPorPessoaJogoECodigo() {
        sku("GE-A01-MOLDURA", null);
        UUID submission = UUID.randomUUID();

        List<Map<String, Object>> first = rewards.grant(ana, game, submission, true);
        List<Map<String, Object>> again = rewards.grant(ana, game, UUID.randomUUID(), true);

        assertThat(first).extracting(m -> m.get("code")).containsExactly("GE-A01-MOLDURA", "GE-A01-ESPELHO");
        assertThat(first).extracting(m -> m.get("state")).containsOnly("DELIVERED");
        assertThat(first.get(0)).containsEntry("type", "ITEM").containsEntry("name", "Moldura Prisma");
        assertThat(first.get(1)).containsEntry("type", "SPECIAL_CARD").containsEntry("name", "Espelho Inteiro");
        assertThat(again).isEqualTo(first);
        assertThat(rows()).hasSize(2);
        assertThat(inventory()).hasSize(1);
        assertThat(cards()).hasSize(1);
        RoomInventoryItem item = inventory().get(0);
        assertThat(item.getUserId()).isEqualTo(ana);
        assertThat(item.getSku()).isEqualTo("GE-A01-MOLDURA");
        assertThat(item.getSource()).isEqualTo("GLASS_EMPIRE");
        assertThat(item.getAcquiredAt()).isEqualTo(NOW);
        assertThat(item.getSerial()).isNull();
        FlairGameReward row = rows().get(0);
        assertThat(row.getUserId()).isEqualTo(ana);
        assertThat(row.getChallengeId()).isEqualTo(game.getId());
        assertThat(row.getSubmissionId()).isEqualTo(submission);
        assertThat(row.getRefId()).isEqualTo(item.getId());
        assertThat(row.getCreatedAt()).isEqualTo(NOW);
    }

    @Test
    void cartaEspecialSegueR1EDuasPessoasGanhamCadaUmaASua() {
        rewards.grant(ana, game, UUID.randomUUID(), true);
        rewards.grant(bia, game, UUID.randomUUID(), true);

        assertThat(cards()).hasSize(2);
        FlairCardInstance mine = cards().stream().filter(c -> c.getOwnerId().equals(ana)).findFirst().orElseThrow();
        FlairCardInstance hers = cards().stream().filter(c -> c.getOwnerId().equals(bia)).findFirst().orElseThrow();
        FlairGameReward row = rows().stream().filter(r -> r.getUserId().equals(ana) && "GE-A01-ESPELHO".equals(r.getCode())).findFirst().orElseThrow();
        assertThat(mine.getOriginType()).isEqualTo("PROGRAM");
        assertThat(mine.getOriginId()).isEqualTo(row.getId());
        assertThat(hers.getOriginId()).isNotEqualTo(mine.getOriginId());
        assertThat(mine.getTier()).isEqualTo("ESPECIAL");
        assertThat(mine.getOvr()).isEqualTo(85);
        assertThat(mine.getPosition()).isEqualTo("VES");
        assertThat(mine.getName()).isEqualTo("Espelho Inteiro");
        assertThat(mine.getImageUrl()).isEqualTo("/flair/games/a01-espelho-partido.webp");
        assertThat(mine.getAcquiredVia()).isEqualTo("GLASS_EMPIRE");
        assertThat(mine.isTradeable()).isFalse();
        assertThat(mine.getState()).isEqualTo("AVAILABLE");
        assertThat(mine.getSeason()).isEqualTo(FlairService.season());
        assertThat(mine.getTagsJson()).isEqualTo("{}");
        assertThat(mine.getBasisJson()).contains(game.getId().toString(), "GE-A01-ESPELHO");
        assertThat(row.getRefId()).isEqualTo(mine.getId());
        assertThat(rows()).hasSize(4);
    }

    @Test
    void itemSemSkuNoCatalogoFicaPendenteSemFalhar() {
        List<Map<String, Object>> out = rewards.grant(ana, game, UUID.randomUUID(), false);

        assertThat(out).hasSize(1);
        assertThat(out.get(0)).containsEntry("code", "GE-A01-MOLDURA").containsEntry("state", "PENDING");
        assertThat(inventory()).isEmpty();
        assertThat(rows()).hasSize(1);
        assertThat(rows().get(0).getState()).isEqualTo("PENDING");
        assertThat(rows().get(0).getRefId()).isNull();
        // repetir não cria segunda linha nem muda o estado
        assertThat(rewards.grant(ana, game, UUID.randomUUID(), false)).isEqualTo(out);
        assertThat(rows()).hasSize(1);
    }

    @Test
    void condicaoPerfectSoComSintoniaMaximaEEdicaoLimitadaNumeraOSerial() {
        sku("GE-A01-MOLDURA", 50);
        List<Map<String, Object>> out = rewards.grant(ana, game, UUID.randomUUID(), false);

        assertThat(out).extracting(m -> m.get("code")).containsExactly("GE-A01-MOLDURA");
        assertThat(cards()).isEmpty();
        assertThat(inventory().get(0).getSerial()).isEqualTo(1);
        assertThat(kit.dep(RoomCatalogItemRepository.class).findById("GE-A01-MOLDURA").orElseThrow().getSoldCount()).isEqualTo(1);
        // sem recompensas ou sem código: nada a fazer
        game.setRewardsJson("[{\"type\":\"ITEM\"}]");
        assertThat(rewards.grant(ana, game, UUID.randomUUID(), true)).isEmpty();
        game.setRewardsJson(null);
        assertThat(rewards.grant(ana, game, UUID.randomUUID(), true)).isEmpty();
    }

    @Test
    void promisedResumeAsRecompensasDoJogoParaOCatalogo() {
        List<Map<String, Object>> p = GlassRewards.promised(game);
        assertThat(p).hasSize(2);
        assertThat(p.get(0)).containsEntry("type", "ITEM").containsEntry("code", "GE-A01-MOLDURA").containsEntry("name", "Moldura Prisma")
                .containsEntry("condition", null);
        assertThat(p.get(1)).containsEntry("type", "SPECIAL_CARD").containsEntry("condition", "perfect");
    }
}
