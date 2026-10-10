package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Faixas do Inventory Score (RF29). As 7 faixas de juízo do HypeScore v1 saíram na limpeza do v1 (P3-16). */
class ScoreBandsTest {
    @Test
    void inventoryScoreBandsCoverZeroToOneThousand() {
        assertThat(InventoryScoreService.BANDS).hasSize(7);
        assertThat(InventoryScoreService.BANDS.get(0).min()).isZero();
        assertThat(InventoryScoreService.BANDS.get(6).max()).isEqualTo(1000);
        for (int i = 1; i < InventoryScoreService.BANDS.size(); i++) {
            assertThat(InventoryScoreService.BANDS.get(i).min()).isEqualTo(InventoryScoreService.BANDS.get(i - 1).max() + 1);
        }
        assertThat(Msg.resolve(InventoryScoreService.band(0))).isEqualTo("Em Montagem");
        assertThat(Msg.resolve(InventoryScoreService.band(650))).isEqualTo("Bem Curado");
        assertThat(Msg.resolve(InventoryScoreService.band(1000))).isEqualTo("Maison Closet");
    }

    @Test
    void colorFamiliesResolveTaxonomyKeysAndHexes() {
        assertThat(InventoryScoreService.family("navy")).isNotNull();
        assertThat(InventoryScoreService.family("#000000")).isNotNull();
        assertThat(InventoryScoreService.family(null)).isNull();
        assertThat(InventoryScoreService.family("cor-inexistente")).isNull();
    }
}
