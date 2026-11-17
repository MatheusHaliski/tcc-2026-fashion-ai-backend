package br.com.fashionai.application.ai;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Era de celebridade é atmosfera, nunca retrato: nome de pessoa cadastrada ou pedido de rosto/corpo é rejeitado. */
class CelebrityPromptValidatorTest {

    private static final List<String> NOMES = List.of("Anitta", "Lu", " ");

    @Test
    void promptDeAtmosferaPassa() {
        CelebrityPromptValidator.Verdict v = CelebrityPromptValidator.validate("palco com luz neon, glitter e tons de rosa", NOMES);
        assertThat(v.accepted()).isTrue();
        assertThat(v.violations()).isEmpty();
    }

    @Test
    void pedidoDeRetratoERejeitadoMesmoComAcentoOuMaiuscula() {
        assertThat(CelebrityPromptValidator.validate("Um RETRATO em estúdio", NOMES).accepted()).isFalse();
        assertThat(CelebrityPromptValidator.validate("selfie no camarim", NOMES).accepted()).isFalse();
        assertThat(CelebrityPromptValidator.validate("close-up of the singer", NOMES).accepted()).isFalse();
    }

    @Test
    void nomeCadastradoSoContaComoPalavraInteira() {
        assertThat(CelebrityPromptValidator.validate("show da ANITTA no rio", NOMES).accepted()).isFalse();
        assertThat(CelebrityPromptValidator.validate("estilo anittaverso", NOMES).accepted()).isTrue();
    }

    @Test
    void nomesCurtosOuVaziosSaoIgnorados() {
        assertThat(CelebrityPromptValidator.validate("lua cheia sobre o lu", NOMES).accepted()).isTrue();
        assertThat(CelebrityPromptValidator.validate("palco", null).accepted()).isTrue();
    }

    @Test
    void cadaProblemaViraUmaViolacao() {
        CelebrityPromptValidator.Verdict v = CelebrityPromptValidator.validate("retrato da Anitta", NOMES);
        assertThat(v.accepted()).isFalse();
        assertThat(v.violations()).hasSize(2);
    }

    @Test
    void normalizacaoTiraAcentosEEspacosRepetidos() {
        assertThat(CelebrityPromptValidator.normalize("  Ação   CÉU ")).isEqualTo("acao ceu");
        assertThat(CelebrityPromptValidator.normalize(null)).isEmpty();
    }
}
