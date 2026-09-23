package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.enums.HypeScoreBand;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ScoreBandsTest {
    @Test
    void hypeScoreHasSevenContiguousBands() {
        assertThat(HypeScoreService.BANDS).hasSize(7);
        for (int i = 1; i < HypeScoreService.BANDS.size(); i++) {
            assertThat(HypeScoreService.BANDS.get(i).min()).isEqualTo(HypeScoreService.BANDS.get(i - 1).max() + 1);
        }
        assertThat(HypeScoreService.band(0).code()).isEqualTo(HypeScoreBand.DESPRETENSIOSO);
        assertThat(HypeScoreService.band(14.4).code()).isEqualTo(HypeScoreBand.DESPRETENSIOSO);
        assertThat(HypeScoreService.band(14.6).code()).isEqualTo(HypeScoreBand.EM_CONSTRUCAO);
        assertThat(HypeScoreService.band(72).code()).isEqualTo(HypeScoreBand.MUITO_ESTILOSO);
        assertThat(HypeScoreService.band(100).code()).isEqualTo(HypeScoreBand.ICONE_DE_ESTILO);
    }

    @Test
    void inventoryScoreBandsCoverZeroToOneThousand() {
        assertThat(InventoryScoreService.BANDS).hasSize(7);
        assertThat(InventoryScoreService.BANDS.get(0).min()).isZero();
        assertThat(InventoryScoreService.BANDS.get(6).max()).isEqualTo(1000);
        for (int i = 1; i < InventoryScoreService.BANDS.size(); i++) {
            assertThat(InventoryScoreService.BANDS.get(i).min()).isEqualTo(InventoryScoreService.BANDS.get(i - 1).max() + 1);
        }
        assertThat(InventoryScoreService.band(0)).isEqualTo("Em Montagem");
        assertThat(InventoryScoreService.band(650)).isEqualTo("Bem Curado");
        assertThat(InventoryScoreService.band(1000)).isEqualTo("Maison Closet");
    }

    @Test
    void colorFamiliesResolveTaxonomyKeysAndHexes() {
        assertThat(InventoryScoreService.family("navy")).isNotNull();
        assertThat(InventoryScoreService.family("#000000")).isNotNull();
        assertThat(InventoryScoreService.family(null)).isNull();
        assertThat(InventoryScoreService.family("cor-inexistente")).isNull();
    }
}
