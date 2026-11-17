package br.com.fashionai.application.common;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** RN11 — texto de formulário sem HTML nem controles, com limite de tamanho e bloqueio de termos ofensivos. */
class InputSanitizerTest {

    @Test
    void limpaHtmlControlesEEspacosRepetidos() {
        assertThat(InputSanitizer.clean("  <b>Look</b>\u0007   de   <script>x</script>verão  ", 100)).isEqualTo("Look de xverão");
        assertThat(InputSanitizer.clean("linha 1\nlinha\t2", 100)).isEqualTo("linha 1\nlinha 2");
        assertThat(InputSanitizer.clean(null, 10)).isNull();
    }

    @Test
    void cortaNoTamanhoMaximo() {
        assertThat(InputSanitizer.clean("abcdefgh", 3)).isEqualTo("abc");
    }

    @Test
    void campoObrigatorioRespeitaMinimoEMaximo() {
        assertThat(InputSanitizer.required("title", "  Look  ", 2, 10)).isEqualTo("Look");
        assertThatThrownBy(() -> InputSanitizer.required("title", " a ", 2, 10))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(400);
                    assertThat(e.code()).isEqualTo("CAMPO_INVALIDO");
                    assertThat(e.details()).containsKey("title");
                });
        assertThatThrownBy(() -> InputSanitizer.required("title", null, 1, 10)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> InputSanitizer.required("title", "x".repeat(11), 1, 10))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("CAMPO_INVALIDO"));
    }

    @Test
    void detectaTermoOfensivoSemDiferenciarAcentoOuMaiuscula() {
        assertThat(InputSanitizer.offensive("Saudação NAZISTA")).isTrue();
        assertThat(InputSanitizer.offensive("look casual de verão")).isFalse();
        assertThat(InputSanitizer.offensive(null)).isFalse();
    }

    @Test
    void textoModeradoBloqueiaOfensivoELimpaORestante() {
        assertThat(InputSanitizer.moderated("bio", "<i>Amo moda</i>", 50)).isEqualTo("Amo moda");
        assertThatThrownBy(() -> InputSanitizer.moderated("bio", "hitler", 50))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("CONTEUDO_BLOQUEADO"));
    }
}
