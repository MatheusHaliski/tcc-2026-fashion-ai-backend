package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.IntensidadeTermica;
import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Nível térmico do look contra a intensidade declarada das peças: compatível, divergente ou sem dado (nunca contra). */
class MirrorThermalFitTest {
    private static WardrobeItem peca(String intensidade) {
        WardrobeItem w = new WardrobeItem();
        if (intensidade != null) {
            IntensidadeTermica i = new IntensidadeTermica();
            i.setCodigo(intensidade);
            w.setIntensidadeTermica(i);
        }
        return w;
    }

    @Test
    void intensoCombinaComPecaDeIntensidadeAlta() {
        MirrorThermalFit.Fit fit = MirrorThermalFit.of("INTENSO", List.of(peca("ALTA"), peca("LEVE"), peca(null)));
        assertThat(fit.compativeis()).isEqualTo(1);
        assertThat(fit.divergentes()).isEqualTo(1);
        assertThat(fit.semDado()).isEqualTo(1);
        assertThat(fit.score()).isZero();
    }

    @Test
    void cadaNivelTemSuaIntensidadeEPecaSemDadoNaoPesa() {
        assertThat(MirrorThermalFit.of("LEVE", List.of(peca("LEVE"))).score()).isEqualTo(1);
        assertThat(MirrorThermalFit.of("MODERADO", List.of(peca("MODERADA"))).score()).isEqualTo(1);
        assertThat(MirrorThermalFit.of("LEVE", List.of(peca(null), peca(null))).score()).isZero();
        assertThat(MirrorThermalFit.of("LEVE", List.of(peca("ALTA"))).paraTela()).containsEntry("base", "INTENSIDADE_DECLARADA_DA_PECA");
    }
}
