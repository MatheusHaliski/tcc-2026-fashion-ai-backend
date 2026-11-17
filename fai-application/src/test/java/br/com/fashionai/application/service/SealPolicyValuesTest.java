package br.com.fashionai.application.service;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Leitura tolerante dos valores do JSON da política de selos (RF25). */
class SealPolicyValuesTest {

    @Test
    void listaDeTextosIgnoraNulosEBrancosEAparaEspacos() {
        assertThat(SealPolicyValues.strings(Arrays.asList(" casual ", null, "", "  ", 42))).containsExactly("casual", "42");
        assertThat(SealPolicyValues.strings(Set.of("a"))).containsExactly("a");
    }

    @Test
    void valorQueNaoELista() {
        assertThat(SealPolicyValues.strings("casual")).isEmpty();
        assertThat(SealPolicyValues.strings(null)).isEmpty();
    }

    @Test
    void textoVazioOuNullEscritoViraNulo() {
        assertThat(SealPolicyValues.text(null)).isNull();
        assertThat(SealPolicyValues.text("   ")).isNull();
        assertThat(SealPolicyValues.text("null")).isNull();
        assertThat(SealPolicyValues.text("  Nike ")).isEqualTo("Nike");
        assertThat(SealPolicyValues.text(7)).isEqualTo("7");
    }

    @Test
    void maiusculasComPadraoQuandoFaltaValor() {
        assertThat(SealPolicyValues.upper("peca", "LOOK")).isEqualTo("PECA");
        assertThat(SealPolicyValues.upper(" ", "LOOK")).isEqualTo("LOOK");
        assertThat(SealPolicyValues.upper(null, null)).isNull();
        assertThat(SealPolicyValues.upper(List.of(), "X")).isEqualTo("[]");
    }
}
