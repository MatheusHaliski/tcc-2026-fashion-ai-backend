package br.com.fashionai.application.service;

import java.util.List;

import org.junit.jupiter.api.Test;

import br.com.fashionai.application.copilot.CopilotScope;

import static org.assertj.core.api.Assertions.assertThat;

class CopilotScopeTest {
    @Test
    void perguntaDeOutroAssuntoNaoContaComoPerguntaDeGuardaRoupa() {
        // "capital" começa com "cap" (boné em inglês): era tratada como busca de peça e respondia "Não encontrei essa peça"
        assertThat(CopilotService.hasPieceConstraints("Qual é a capital da França?")).isTrue();
        assertThat(CopilotScope.aboutWardrobe("Qual é a capital da França?")).isFalse();
        assertThat(CopilotScope.aboutWardrobe("Quanto é 2 + 2?")).isFalse();
    }

    @Test
    void perguntaComPecaCorOuVerboDeModaContinuaSendoDeGuardaRoupa() {
        assertThat(CopilotScope.aboutWardrobe("Tem jaqueta vermelha?")).isTrue();
        assertThat(CopilotScope.aboutWardrobe("Quero algo com tênis brancos")).isTrue();
        assertThat(CopilotScope.aboutWardrobe("O que visto para trabalhar amanhã?")).isTrue();
        assertThat(CopilotScope.aboutWardrobe("Monte um look para a festa")).isTrue();
        assertThat(CopilotScope.aboutWardrobe("Do I have a black cap?")).isTrue();
    }

    @Test
    void trabalharEOcasiaoTrabalho() {
        assertThat(CopilotService.lookPrompt("O que visto para trabalhar amanhã?", List.of(), null).occasions()).containsExactly("work");
    }
}
