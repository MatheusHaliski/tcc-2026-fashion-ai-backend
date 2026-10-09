package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.model.RoomStorageEntry;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.RoomLayoutRepository;
import br.com.fashionai.domain.repository.RoomStorageEntryRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Meu Quarto (RF32–RF35): cada peça ganha um endereço coerente com o tipo (cabide, gaveta com categoria, sapateira,
 * vitrine), o móvel cresce com o nível de FAI Points, e a pessoa move, renomeia gavetas, organiza com IA (e desfaz),
 * registra usos no diário da peça e compara looks na ilha.
 */
class RoomServiceTest {
    private Kit kit;
    private World world;
    private RoomService room;
    private CurrentUser ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        when(kit.dep(Guard.class).deny(any(), any(), any())).thenAnswer(i -> new ApiException(403, "NEGADO", "negado"));
        room = kit.build(RoomService.class);
        ana = Kit.as(world.me);
    }

    private void level(long lifetime) {
        when(kit.dep(FaiPointsLedgerEntryRepository.class).lifetime(any())).thenReturn(lifetime);
    }

    private List<RoomStorageEntry> storage() {
        return MemoryRepository.rows(kit.dep(RoomStorageEntryRepository.class));
    }

    @Test
    void layoutInicialDoNivelEstreiaEModulosPorNivel() {
        RoomLayout l = room.layout(world.me.getId());
        assertThat(l.getLevel()).isEqualTo("ESTREIA");
        assertThat(RoomService.defaultModules(FaiPointsService.Level.ESTREIA)).noneMatch(m -> "shoe".equals(m.get("id")));
        assertThat(RoomService.defaultModules(FaiPointsService.Level.MAISON)).anyMatch(m -> "signature".equals(m.get("id")));
        room.setLevel(world.me.getId(), "CLOSET");
        assertThat(room.layout(world.me.getId()).getModulesJson()).contains("\"shoe\"");
        assertThatThrownBy(() -> room.layout(UUID.randomUUID())).isInstanceOf(ApiException.class);
    }

    @Test
    void cadaPecaGanhaEnderecoCoerenteComOTipo() {
        level(20_000);
        List<RoomStorageEntry> entries = room.entries(world.me.getId(), world.piecesOf(world.me));
        assertThat(entries).hasSize(12);
        Map<String, String> byName = new HashMap<>();
        for (RoomStorageEntry e : entries) {
            byName.put(kit.dep(WardrobeItemRepository.class).findById(e.getWardrobeItemId()).orElseThrow().getSubcategory(), e.getAddress());
        }
        assertThat(byName.get("t_shirt")).startsWith("door:");
        assertThat(byName.get("casual_sneakers")).startsWith("shoe:");
        assertThat(byName.get("handbag")).startsWith("bags:");
        assertThat(byName.get("jeans")).startsWith("drawer:");
        assertThat(byName.get("dress")).startsWith("door:4");
        // a peça apagada sai do quarto na próxima leitura
        WardrobeItem gone = world.piece(world.me, "cap");
        List<WardrobeItem> alive = new ArrayList<>(world.piecesOf(world.me));
        alive.remove(gone);
        assertThat(room.entries(world.me.getId(), alive)).hasSize(11);
    }

    @Test
    void quartoCheioMandaParaACadeira() {
        for (int i = 0; i < 200; i++) {
            kit.dep(WardrobeItemRepository.class).save(Kit.piece(world.me, "camiseta " + i, "upper_piece", "t_shirt", "white"));
        }
        room.entries(world.me.getId(), world.piecesOf(world.me));
        assertThat(storage()).anyMatch(e -> e.getAddress().startsWith("chair:"));
        Map<String, Object> r = room.room(ana);
        assertThat(String.valueOf(r.get("chair"))).contains("chair:");
    }

    @Test
    void cenaDoQuartoComEstadosDasPecas() {
        level(20_000);
        List<WardrobeItem> mine = world.piecesOf(world.me);
        mine.get(0).setFavorite(true);
        mine.get(1).setForSale(true);
        mine.get(2).setAvailabilityStatus(AvailabilityStatus.UNAVAILABLE);
        mine.get(3).markCreatedAt(Instant.now().minusSeconds(200L * 86_400));
        mine.get(4).setWearCount(31);
        mine.get(4).setPieceOrigin("GARIMPADA");
        mine.get(5).setImageUrl(null);
        StyleDna dna = new StyleDna();
        dna.setUser(world.me);
        dna.setIconPieceName(mine.get(6).getName());
        kit.dep(StyleDnaRepository.class).save(dna);
        DailyLook dl = new DailyLook();
        dl.setUser(world.me);
        dl.setScheme(world.looksOf(world.me).get(0));
        dl.setLookDate(LocalDate.now(RoomService.ZONE));
        kit.dep(DailyLookRepository.class).save(dl);

        Map<String, Object> r = room.room(ana);
        assertThat(r).containsKeys("modules", "pieces", "level", "closetLights", "drawerLabels");
        assertThat((List<Map<String, Object>>) r.get("modules")).allSatisfy(module ->
                assertThat(module).doesNotContainKeys("lookBoxes", "totalLooks"));
        assertThat(String.valueOf(r.get("saleRack"))).contains(mine.get(1).getId().toString());
        assertThat(String.valueOf(r.get("basket"))).contains(mine.get(2).getId().toString());
        assertThat(String.valueOf(r.get("showcase"))).contains(mine.get(6).getId().toString());
        assertThat(r.get("forgottenCount")).isEqualTo(1);
        assertThat(room.listView(ana)).isNotEmpty();
        assertThat(room.open(ana, "door:1")).containsKey("pieces");
        assertThatThrownBy(() -> room.open(ana, "nada")).isInstanceOf(ApiException.class);
    }

    @Test
    void roomTourSoComAChaveDoQuarto() {
        CurrentUser bia = Kit.as(world.rival);
        assertThatThrownBy(() -> room.tour(bia, world.me.getId())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> room.giveKey(ana, world.me.getId())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> room.giveKey(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);
        assertThat(String.valueOf(room.giveKey(ana, world.rival.getId()).get("keys"))).contains(world.rival.getId().toString());
        assertThat(room.hasKey(world.me.getId(), world.rival.getId())).isTrue();
        Map<String, Object> visit = room.tour(bia, world.me.getId());
        assertThat(visit).containsKey("pieces");
        assertThat(room.tour(ana, world.me.getId())).containsKey("pieces");
    }

    @Test
    void moverPecaRespeitaCapacidadeEPosicao() {
        room.entries(world.me.getId(), world.piecesOf(world.me));
        WardrobeItem tee = world.piece(world.me, "t_shirt");
        WardrobeItem jeans = world.piece(world.me, "jeans");
        assertThatThrownBy(() -> room.move(ana, tee.getId(), "qualquer coisa")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> room.move(ana, tee.getId(), "shoe:1")).isInstanceOf(ApiException.class);   // sem sapateira no Estreia
        assertThatThrownBy(() -> room.move(ana, tee.getId(), "door:1:99")).isInstanceOf(ApiException.class);
        String jeansAt = storage().stream().filter(e -> e.getWardrobeItemId().equals(jeans.getId())).findFirst().orElseThrow().getAddress();
        Map<String, Object> moved = room.move(ana, tee.getId(), "drawer:10");
        assertThat(moved).containsEntry("coherent", false);
        assertThat(room.move(ana, tee.getId(), "chair:1")).containsEntry("address", "chair:1");
        String doorOfShirt = storage().stream().filter(e -> e.getWardrobeItemId().equals(world.piece(world.me, "shirt").getId())).findFirst().orElseThrow().getAddress();
        assertThatThrownBy(() -> room.move(ana, tee.getId(), doorOfShirt)).isInstanceOf(ApiException.class);
        assertThat(jeansAt).startsWith("drawer:");
        for (int i = 0; i < 6; i++) {
            WardrobeItem extra = kit.dep(WardrobeItemRepository.class).save(Kit.piece(world.me, "short " + i, "lower_piece", "shorts", "blue"));
            room.autoAssign(world.me.getId(), extra.getId());
            room.move(ana, extra.getId(), "drawer:12");
        }
        assertThatThrownBy(() -> room.move(ana, jeans.getId(), "drawer:12")).isInstanceOf(ApiException.class);
        assertThat(room.showInRoom(ana, tee.getId())).containsKeys("camera", "label");
        assertThat(room.locateAll(world.me.getId())).hasSize(storage().size());
    }

    @Test
    void cadastroEExclusaoDePecaAtualizamOQuarto() {
        WardrobeItem nova = kit.dep(WardrobeItemRepository.class).save(Kit.piece(world.me, "bota nova", "shoes_piece", "boots", "black"));
        room.onPieceCreated(new DomainEvents.PieceCreated(world.me.getId(), nova.getId(), true));
        assertThat(room.locate(world.me.getId(), nova.getId())).isPresent();
        assertThat(room.autoAssign(world.me.getId(), nova.getId()).zone()).isEqualTo("base");
        room.onPieceDeleted(new DomainEvents.PieceDeleted(world.me.getId(), nova.getId()));
        assertThat(room.locate(world.rival.getId(), nova.getId())).isEmpty();
        assertThatThrownBy(() -> room.autoAssign(world.me.getId(), UUID.randomUUID())).isInstanceOf(ApiException.class);
    }

    @Test
    void gavetasRenomeadasEOrganizacaoComIaQueSeDesfaz() {
        room.entries(world.me.getId(), world.piecesOf(world.me));
        assertThat(room.renameDrawer(ana, 7, "Shorts de praia")).containsEntry("7", "Shorts de praia");
        assertThat(room.renameDrawer(ana, 7, " ")).doesNotContainKey("7");
        assertThatThrownBy(() -> room.renameDrawer(ana, 99, "x")).isInstanceOf(ApiException.class);

        Map<String, Object> preview = room.organizePreview(ana, true);
        assertThat(preview).containsKeys("labels", "moves", "summary", "explanation");
        assertThat(room.organizePreview(ana, false).get("fallbackUsed")).isEqualTo(false);
        @SuppressWarnings("unchecked")
        Map<String, String> labels = new HashMap<>((Map<String, String>) preview.get("labels"));
        labels.put("8", "Saias");
        labels.put("9", "");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> moves = (List<Map<String, Object>>) preview.get("moves");
        Map<String, Object> applied = room.applyOrganization(ana, labels, moves);
        assertThat(applied).isNotEmpty();
        assertThat(room.undoOrganization(ana)).containsKey("restored");
        assertThatThrownBy(() -> room.undoOrganization(ana)).isInstanceOf(ApiException.class);
    }

    @Test
    void sugestaoDeRotuloPeloConteudoDaGaveta() {
        WardrobeItem jeans = world.piece(world.me, "jeans");
        WardrobeItem skirt = Kit.piece(world.me, "saia", "lower_piece", "skirt", "black");
        assertThat(RoomService.suggestLabel(List.of(jeans, jeans), "x")).isEqualTo("Jeans");
        assertThat(RoomService.suggestLabel(List.of(skirt, skirt, jeans), null)).isEqualTo("Saias");
        assertThat(RoomService.suggestLabel(List.of(), "Atual")).isEqualTo("Atual");
        WardrobeItem gym = Kit.piece(world.me, "legging", "lower_piece", "leggings", "black");
        WardrobeItem beach = Kit.piece(world.me, "saída", "lower_piece", "shorts", "white");
        beach.setOccasionTags("beach");
        WardrobeItem socks = Kit.piece(world.me, "meia", "accessory_piece", "socks", "white");
        assertThat(RoomService.preferredDrawerLabel(gym)).isEqualTo("Academia");
        assertThat(RoomService.preferredDrawerLabel(beach)).isEqualTo("Praia");
        assertThat(RoomService.preferredDrawerLabel(socks)).isNotNull();
        Map<String, String> labels = Map.of("1", "Jeans", "2", "Academia", "3", "Praia", "4", "Acessórios", "5", "Íntimas", "6", "Favoritas", "7", "Outra");
        for (int d = 1; d <= 8; d++) {
            RoomService.coherent(gym, RoomAddress.of("drawer", d), labels);
        }
        assertThat(RoomService.coherent(world.piece(world.me, "casual_sneakers"), RoomAddress.of("base", 1), labels)).isTrue();
        assertThat(RoomService.coherent(world.piece(world.me, "handbag"), RoomAddress.of("bags", 1), labels)).isTrue();
        assertThat(RoomService.coherent(world.piece(world.me, "handbag"), RoomAddress.of("jewelry", 1), labels)).isFalse();
        assertThat(RoomService.coherent(world.piece(world.me, "t_shirt"), RoomAddress.of("chair", 1), labels)).isTrue();
    }

    @Test
    void recursosDeNivelLuzMonogramaMaleiroEIlha() {
        assertThatThrownBy(() -> room.setLight(ana, 3000)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> room.setMonogram(ana, "ab")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> room.seasonStorage(ana, List.of(), true)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> room.island(ana, world.lookIds(world.me).subList(0, 2))).isInstanceOf(ApiException.class);
        level(20_000);
        room.setLevel(world.me.getId(), "MAISON");
        assertThat(room.setLight(ana, 9000)).containsEntry("kelvin", 6500);
        assertThat(room.setMonogram(ana, "abc")).containsEntry("initials", "ABC");
        assertThat(room.setMonogram(ana, "a.b")).containsEntry("initials", "AB");
        assertThat(room.setMonogram(ana, "")).containsEntry("initials", "");
        room.entries(world.me.getId(), world.piecesOf(world.me));
        List<UUID> two = world.piecesOf(world.me).subList(0, 2).stream().map(WardrobeItem::getId).toList();
        assertThat(room.seasonStorage(ana, two, true)).containsEntry("moved", 2);
        assertThat(room.outOfSeason(world.me.getId())).hasSize(2);
        assertThat(room.seasonStorage(ana, two, false)).containsEntry("moved", 2);
        assertThat(room.island(ana, world.lookIds(world.me).subList(0, 3)).get("looks")).asList().hasSize(3);
        assertThatThrownBy(() -> room.island(ana, world.lookIds(world.me).subList(0, 1))).isInstanceOf(ApiException.class);
    }

    @Test
    void acabamentosDaLojaDoQuarto() {
        level(20_000);
        room.setLevel(world.me.getId(), "MAISON");
        RoomCatalogItem door = new RoomCatalogItem();
        door.setSku("FAI-PRT-AB60-NOZ");
        door.setKind("MODULE");
        door.setSlotType("DOOR");
        door.setWidthCm(60);
        door.setMoldId("PRT-AB60");
        door.setFinishJson("{\"color\":\"#5a3a22\",\"texture\":\"nogueira\"}");
        door.setRarity("RARE");
        assertThat(room.compatibleModules(world.me.getId(), door)).contains("door:1");
        room.applyFinish(world.me.getId(), "door:1", door);
        assertThat(room.layout(world.me.getId()).getModulesJson()).contains("FAI-PRT-AB60-NOZ");
        RoomCatalogItem wardrobe = new RoomCatalogItem();
        wardrobe.setSku("FAI-WARD-MAISON");
        wardrobe.setKind("WARDROBE");
        wardrobe.setBundleJson("[{\"slotType\":\"DOOR\",\"moldId\":\"PRT-X\",\"finish\":{\"color\":\"#000\"}},{\"slotType\":\"DRAWER\",\"moldId\":\"GAV-X\",\"finish\":{}}]");
        assertThat(room.compatibleModules(world.me.getId(), wardrobe)).containsExactly("ALL");
        room.applyFinish(world.me.getId(), null, wardrobe);
        assertThat(room.layout(world.me.getId()).getModulesJson()).contains("FAI-WARD-MAISON");
    }

    @Test
    void diarioDaPecaRegistraUsoEContaCustoPorUso() {
        WardrobeItem tee = world.piece(world.me, "t_shirt");
        tee.setPrice(new BigDecimal("90.00"));
        assertThatThrownBy(() -> room.diaryEntry(ana, tee.getId(), LocalDate.now(RoomService.ZONE).plusDays(2), null, null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> room.diaryEntry(ana, tee.getId(), null, "inventada", null)).isInstanceOf(ApiException.class);
        int before = tee.getWearCount();
        Map<String, Object> tag = room.diaryEntry(ana, tee.getId(), LocalDate.now(RoomService.ZONE).minusDays(1), "casual", "Almoço com a família");
        assertThat(tee.getWearCount()).isEqualTo(before + 1);
        assertThat((List<?>) tag.get("diary")).hasSize(1);
        room.diaryEntry(ana, tee.getId(), LocalDate.now(RoomService.ZONE).minusDays(1), "casual", "de novo");   // mesmo dia não duplica
        assertThat(MemoryRepository.<PieceUsageDiaryEntry>rows(kit.dep(PieceUsageDiaryEntryRepository.class))).hasSize(1);
        assertThat(room.pieceTag(ana, tee.getId())).containsKeys("costPerUse", "location", "beforeAfter");
        assertThat(room.usedRecently(world.me.getId(), LocalDate.now().minusDays(10))).contains(tee.getId());
        assertThat(room.lastDiaryDates(world.me.getId(), LocalDate.now().minusDays(10))).containsKey(tee.getId());
        assertThat(RoomService.lastUse(tee, Map.of())).isEqualTo(tee.getLastWornDate());
    }

    @Test
    void layoutSalvoDuasVezesNaoDuplicaModulos() {
        RoomLayout a = room.layout(world.me.getId());
        RoomLayout b = room.layout(world.me.getId());
        assertThat(a.getModulesJson()).isEqualTo(b.getModulesJson());
        assertThat(MemoryRepository.<RoomLayout>rows(kit.dep(RoomLayoutRepository.class))).hasSize(1);
    }
}
