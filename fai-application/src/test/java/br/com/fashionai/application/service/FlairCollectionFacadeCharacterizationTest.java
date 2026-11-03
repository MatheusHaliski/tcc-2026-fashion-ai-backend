package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Caracterização do {@link FlairCollectionService} antes da extração: ordem das chaves da carta, da coleção e da prévia,
 * o que fica gravado na carta (tags, retrato do Hype, verso) e a ordem da coleção por nível e nota.
 */
class FlairCollectionFacadeCharacterizationTest {
    private Kit kit;
    private World world;
    private FlairCollectionService service;
    private CurrentUser ana;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        kit = new Kit();
        kit.with(Kit.mock(HypeScoreCurrentRepository.class));
        world = new World(kit);
        ana = Kit.as(world.me);
        for (WardrobeItem w : world.piecesOf(world.me)) {
            w.setModerationStatus(ModerationStatus.APPROVED);
            when(kit.dep(WardrobeService.class).owned(any(), eq(w.getId()))).thenReturn(w);
        }
        when(kit.dep(FlairService.class).cardsOf(any())).thenAnswer(a -> ((List<WardrobeItem>) a.getArgument(0)).stream()
                .map(w -> FlairEngine.card(new FlairEngine.PieceInput(w.getId().toString(), w.getName(), w.getCategory(), w.getSubcategory(),
                        "/media/p.png", "#000000", w.getBrandName(), false, null, List.of("casual"), List.of("work"), "COTTON", 0.7,
                        false, false, false, false, false, FlairEngine.Hype.NONE, 0), "SPRING")).toList());
        service = kit.build(FlairCollectionService.class);
    }

    @Test
    void chavesDaCartaDaColecaoEDaPrevia() {
        List<WardrobeItem> ws = world.piecesOf(world.me);
        ws.get(0).setPrice(new BigDecimal("120"));
        ws.get(0).setMaterial("SILK");
        ws.get(0).setOccasionTags("work,party");
        HypeScoreCurrent h = new HypeScoreCurrent();
        h.setEntityType(HypeEntityType.PIECE);
        h.setEntityId(ws.get(0).getId());
        h.setScore(new BigDecimal("61.04"));
        h.setPublicEligible(true);
        h.getDimensions().setRarity(new BigDecimal("33.33"));
        when(kit.dep(HypeScoreCurrentRepository.class).findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.PIECE),
                eq(List.of(ws.get(0).getId())), any())).thenReturn(List.of(h));

        Map<String, Object> card = service.convertPiece(ana, ws.get(0).getId());
        assertThat(card.keySet()).containsExactly("id", "originType", "originId", "season", "tier", "ovr", "rare", "position", "name", "brandName",
                "imageUrl", "category", "subcategory", "hype", "stats", "rarity", "ability", "priceVerified", "state", "tradeable", "acquiredVia",
                "createdAt", "basis", "tags", "lockedIn");
        FlairCardInstance saved = kit.dep(FlairCardInstanceRepository.class).findAll().get(0);
        assertThat(saved.getHypeJson()).isEqualTo("{\"POP\":null,\"ENG\":null,\"TRD\":null,\"ORI\":null,\"RAR\":33.3,\"LON\":null,\"NOV\":null,\"HYP\":61.0}");
        assertThat(saved.getTagsJson()).isEqualTo(Json.write(FlairCollectionService.tagsOf(ws.get(0))));
        assertThat(Json.map(saved.getTagsJson()).keySet()).containsExactly("styles", "occasions", "colors", "materials");
        assertThat(Json.map(saved.getTagsJson()).get("materials")).isEqualTo(List.of("silk"));
        assertThat(Json.map(saved.getStatsJson()).keySet()).containsExactly("stats", "rarity", "power", "ability");
        assertThat(saved.getPosition()).isNotNull();

        for (int i = 1; i < 6; i++) {
            service.convertPiece(ana, ws.get(i).getId());
        }
        Map<String, Object> mine = service.mine(ana, null);
        assertThat(mine.keySet()).containsExactly("season", "counts", "total", "cards");
        assertThat(World.map(mine.get("counts")).keySet()).containsExactly("ESPECIAL", "OURO", "PRATA", "BRONZE");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cards = (List<Map<String, Object>>) mine.get("cards");
        for (int i = 1; i < cards.size(); i++) {
            int a = FlairCollectionService.TIERS.indexOf(cards.get(i - 1).get("tier")), b = FlairCollectionService.TIERS.indexOf(cards.get(i).get("tier"));
            assertThat(a < b || a == b && (int) cards.get(i - 1).get("ovr") >= (int) cards.get(i).get("ovr")).isTrue();
        }
        assertThat(service.ofUser(Kit.as(world.rival), world.me.getId()).keySet()).containsExactly("season", "counts", "total", "cards");
        assertThat(service.ofUser(ana, world.me.getId())).isEqualTo(mine);

        Map<String, Object> preview = service.previewPiece(ana, ws.get(0).getId());
        assertThat(preview.keySet()).containsExactly("ovr", "tier", "position", "priceVerified", "cappedByUnverifiedPrice", "basis", "season", "existing");
        Map<String, Object> draft = service.previewDraft(new FlairCollectionService.Draft("shoes_piece", "sneakers", null, " ", null, null,
                null, List.of(), null, "LEATHER"));
        assertThat(draft.keySet()).containsExactly("ovr", "tier", "position", "priceVerified", "cappedByUnverifiedPrice", "basis", "season");
        assertThat(draft).containsEntry("position", "CAL").containsEntry("priceVerified", false);
        assertThat(service.tierOf(ws.get(0))).isEqualTo(service.tierOf(ws.get(0)));
        assertThat(service.visible(ana, saved)).isFalse();
    }
}
