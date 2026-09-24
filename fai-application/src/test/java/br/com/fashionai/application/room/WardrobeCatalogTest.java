package br.com.fashionai.application.room;

import br.com.fashionai.application.service.WardrobeCreatorService;
import br.com.fashionai.domain.model.RoomCatalogItem;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** RF39 — catálogo de blocos/materiais/cores da loja do quarto e estados de disponibilidade dos itens de marca. */
class WardrobeCatalogTest {

    @Test
    void everyBlockMaterialAndColorIsDefined() {
        for (WardrobeCreatorService.Block b : WardrobeCreatorService.BLOCKS) {
            assertThat(b.materials()).isNotEmpty();
            for (String m : b.materials()) {
                assertThat(WardrobeCreatorService.MATERIALS).as(b.moldId() + " → " + m).containsKey(m);
                for (String c : WardrobeCreatorService.MATERIALS.get(m).colors()) {
                    assertThat(WardrobeCreatorService.COLORS).as(m + " → " + c).containsKey(c);
                    assertThat(WardrobeCreatorService.COLORS.get(c)).matches("#[0-9A-F]{6}");
                }
            }
            assertThat(WardrobeCreatorService.LEVELS).contains(b.minLevel());
        }
    }

    @Test
    void requestedMaterialsExist() {
        // vidro, madeira, mármore, granito, prata, ouro, bronze e afins
        assertThat(WardrobeCreatorService.MATERIALS.keySet())
                .contains("VIDRO", "MADEIRA", "MARMORE", "GRANITO", "PRATA", "OURO", "BRONZE", "COBRE", "ESPELHO", "CONCRETO", "RATTAN", "ACO");
        assertThat(WardrobeCreatorService.MATERIALS.get("OURO").metalness()).isGreaterThan(0.9);
        assertThat(WardrobeCreatorService.MATERIALS.get("OURO").minLevel()).isEqualTo("PENTHOUSE");
        Set<String> slots = new java.util.HashSet<>();
        WardrobeCreatorService.BLOCKS.forEach(b -> slots.add(b.slotType()));
        assertThat(slots).contains("DOOR", "DRAWER", "HANDLE", "TOP", "BASE", "HANGER", "LOGO", "LIGHT", "RUG", "SHOE_RACK", "BAG_DISPLAY", "JEWELRY", "ISLAND");
    }

    @Test
    void availabilityFollowsWindowStockAndActiveFlag() {
        Instant now = Instant.now();
        RoomCatalogItem c = new RoomCatalogItem();
        c.setActive(true);
        assertThat(WardrobeCreatorService.availability(c, now)).isEqualTo("DISPONIVEL");
        c.setAvailableFrom(now.plus(2, ChronoUnit.DAYS));
        assertThat(WardrobeCreatorService.availability(c, now)).isEqualTo("EM_BREVE");
        c.setAvailableFrom(now.minus(10, ChronoUnit.DAYS));
        c.setAvailableUntil(now.minus(1, ChronoUnit.DAYS));
        assertThat(WardrobeCreatorService.availability(c, now)).isEqualTo("EXPIRADO");
        c.setAvailableUntil(null);
        c.setStockLimit(3);
        c.setSoldCount(3);
        assertThat(WardrobeCreatorService.availability(c, now)).isEqualTo("ESGOTADO");
        c.setActive(false);
        assertThat(WardrobeCreatorService.availability(c, now)).isEqualTo("INATIVO");
    }
}
