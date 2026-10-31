package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.RoomStorageEntry;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Caracterização das regras de posicionamento do Meu Quarto (RF32.CA02 / RF34 §3.5): coerência endereço × tipo,
 * capacidade de gaveta por categoria, gaveta preferida, sugestão de rótulo e porta preferida do cabide.
 * Escrita contra o código original de {@link RoomService} antes da extração das regras puras.
 */
class RoomPlacementCharacterizationTest {
    private static final Map<String, String> LABELS = Map.of("1", "Jeans", "2", "Academia", "3", "Praia",
            "4", "Acessórios", "5", "Íntimas", "6", "Favoritas", "7", "Outra", "8", "ACESSORIOS", "9", "intimas");
    private Kit kit;
    private World world;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        when(kit.dep(Guard.class).deny(any(), any(), any())).thenAnswer(i -> new ApiException(403, "NEGADO", "negado"));
    }

    private WardrobeItem piece(String category, String sub, String occasions) {
        WardrobeItem w = Kit.piece(world.me, "peca", category, sub, "black");
        w.setOccasionTags(occasions);
        return w;
    }

    private boolean at(WardrobeItem w, String zone, int index) {
        return RoomService.coherent(w, RoomAddress.of(zone, index), LABELS);
    }

    @Test
    void portasAceitamSoPartesDeCimaEPecasInteiras() {
        assertThat(at(piece("upper_piece", "t_shirt", "casual"), "door", 1)).isTrue();
        assertThat(at(piece("full_body_piece", "dress", "casual"), "door", 4)).isTrue();
        assertThat(at(piece("lower_piece", "jeans", "casual"), "door", 1)).isFalse();
        assertThat(at(piece("shoes_piece", "casual_sneakers", "casual"), "door", 1)).isFalse();
    }

    @Test
    void gavetasRotuladasFiltramPorConteudoESemRotuloAceitamTudoQueCabe() {
        WardrobeItem jeans = piece("lower_piece", "jeans", "casual");
        WardrobeItem leggings = piece("lower_piece", "leggings", "casual");
        WardrobeItem sportShorts = piece("lower_piece", "shorts", "sport");
        WardrobeItem beach = piece("lower_piece", "shorts", "beach");
        WardrobeItem socks = piece("accessory_piece", "socks", "casual");
        WardrobeItem belt = piece("accessory_piece", "belt", "casual");
        WardrobeItem fav = piece("lower_piece", "skirt", "casual");
        fav.setFavorite(true);
        assertThat(at(jeans, "drawer", 1)).isTrue();
        assertThat(at(leggings, "drawer", 1)).isFalse();
        assertThat(at(leggings, "drawer", 2)).isTrue();
        assertThat(at(sportShorts, "drawer", 2)).isTrue();
        assertThat(at(beach, "drawer", 3)).isTrue();
        assertThat(at(jeans, "drawer", 3)).isFalse();
        assertThat(at(belt, "drawer", 4)).isTrue();
        assertThat(at(belt, "drawer", 8)).isTrue();
        assertThat(at(jeans, "drawer", 4)).isFalse();
        assertThat(at(socks, "drawer", 5)).isTrue();
        assertThat(at(socks, "drawer", 9)).isTrue();
        assertThat(at(belt, "drawer", 5)).isFalse();
        assertThat(at(fav, "drawer", 6)).isTrue();
        assertThat(at(jeans, "drawer", 6)).isFalse();
        assertThat(at(jeans, "drawer", 7)).isTrue();
        assertThat(at(jeans, "drawer", 42)).isTrue();
        assertThat(at(piece("upper_piece", "t_shirt", "casual"), "drawer", 42)).isFalse();
        assertThat(at(piece("shoes_piece", "casual_sneakers", "casual"), "drawer", 42)).isTrue();
    }

    @Test
    void zonasEspeciaisSapatosBolsasJoiasECadeira() {
        WardrobeItem shoe = piece("shoes_piece", "casual_sneakers", "casual");
        WardrobeItem bag = piece("accessory_piece", "backpack", "casual");
        WardrobeItem watch = piece("accessory_piece", "watch", "casual");
        assertThat(at(shoe, "base", 1)).isTrue();
        assertThat(at(shoe, "shoe", 1)).isTrue();
        assertThat(at(bag, "shoe", 1)).isFalse();
        assertThat(at(bag, "bags", 1)).isTrue();
        assertThat(at(watch, "bags", 1)).isFalse();
        assertThat(at(watch, "jewelry", 1)).isTrue();
        assertThat(at(bag, "jewelry", 1)).isFalse();
        assertThat(at(bag, "chair", 3)).isTrue();
        assertThat(at(shoe, "season", 1)).isTrue();
        WardrobeItem blank = piece(null, null, "");
        assertThat(at(blank, "door", 1)).isFalse();
        assertThat(at(blank, "chair", 1)).isTrue();
    }

    @Test
    void capacidadeDaGavetaPorCategoria() {
        assertThat(RoomService.drawerCapacity("shoes_piece")).isEqualTo(1);
        assertThat(RoomService.drawerCapacity("lower_piece")).isEqualTo(2);
        assertThat(RoomService.drawerCapacity("accessory_piece")).isEqualTo(4);
        assertThat(RoomService.drawerCapacity(null)).isEqualTo(4);
    }

    @Test
    void gavetaPreferidaESugestaoDeRotulo() {
        assertThat(RoomPlacementRules.preferredDrawerLabel(piece("lower_piece", "denim_shorts", "beach"))).isEqualTo("Jeans");
        assertThat(RoomPlacementRules.preferredDrawerLabel(piece("lower_piece", "skirt", "gym"))).isEqualTo("Academia");
        assertThat(RoomPlacementRules.preferredDrawerLabel(piece("lower_piece", "skirt", "casual,beach"))).isEqualTo("Praia");
        assertThat(RoomPlacementRules.preferredDrawerLabel(piece("lower_piece", "skirt", "casual"))).isNull();
        assertThat(RoomPlacementRules.preferredDrawerLabel(piece("accessory_piece", "socks", "casual")))
                .isNotEqualTo(RoomPlacementRules.preferredDrawerLabel(piece("accessory_piece", "belt", "casual")));
        WardrobeItem wide = piece("lower_piece", "wide_leg", "casual");
        WardrobeItem cargo = piece("lower_piece", "cargo_pants", "casual");
        assertThat(RoomPlacementRules.suggestLabel(List.of(wide, wide, cargo), "x")).isEqualTo("Wide leg");
        assertThat(RoomPlacementRules.suggestLabel(List.of(wide, cargo), "x")).isIn("Wide leg", "Cargo");
        assertThat(RoomPlacementRules.suggestLabel(List.of(wide, cargo, piece("lower_piece", "skirt", "casual")), "Atual")).isEqualTo("Atual");
        assertThat(RoomPlacementRules.suggestLabel(List.of(piece("lower_piece", "", "casual")), "Atual")).isEqualTo("");
        assertThat(RoomPlacementRules.titleCase("")).isEmpty();
        assertThat(RoomPlacementRules.titleCase("abc")).isEqualTo("Abc");
    }

    @Test
    void portaPreferidaDoCabideSegueOTipoDaPeca() {
        when(kit.dep(FaiPointsLedgerEntryRepository.class).lifetime(any())).thenReturn(20_000L);
        RoomService room = kit.build(RoomService.class);
        WardrobeItemRepository repo = kit.dep(WardrobeItemRepository.class);
        WardrobeItem jacket = repo.save(piece("upper_piece", "jacket", "casual"));
        WardrobeItem sweater = repo.save(piece("upper_piece", "sweater", "casual"));
        List<WardrobeItem> all = world.piecesOf(world.me);
        assertThat(all).contains(jacket, sweater);
        Map<java.util.UUID, String> byId = new HashMap<>();
        for (RoomStorageEntry e : room.entries(world.me.getId(), all)) {
            byId.put(e.getWardrobeItemId(), e.getAddress());
        }
        assertThat(byId.get(jacket.getId())).startsWith("door:3/hanger:");
        assertThat(byId.get(sweater.getId())).startsWith("door:2/hanger:");
        assertThat(byId.get(world.piece(world.me, "t_shirt").getId())).startsWith("door:1/hanger:");
        assertThat(byId.get(world.piece(world.me, "dress").getId())).startsWith("door:4/hanger:");
    }
}
