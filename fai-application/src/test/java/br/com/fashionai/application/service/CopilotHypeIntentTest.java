package br.com.fashionai.application.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Perguntas sobre Hype viram a intenção HYPE; pedidos para montar look continuam LOOKS (Hype é contexto). */
class CopilotHypeIntentTest {
    @Test
    void hypeQuestionsAreRecognized() {
        assertThat(CopilotService.intent("Qual é a peça mais relevante do meu guarda-roupa?")).isEqualTo(CopilotService.Intent.HYPE);
        assertThat(CopilotService.intent("Qual item está crescendo em hype?")).isEqualTo(CopilotService.Intent.HYPE);
        assertThat(CopilotService.intent("Qual peça que eu tenho está voltando a ser tendência?")).isEqualTo(CopilotService.Intent.HYPE);
        assertThat(CopilotService.intent("Tenho alguma peça rara?")).isEqualTo(CopilotService.Intent.HYPE);
        assertThat(CopilotService.intent("Qual look possui maior potencial de trend?")).isEqualTo(CopilotService.Intent.HYPE);
        assertThat(CopilotService.intent("Which of my pieces is trending?")).isEqualTo(CopilotService.Intent.HYPE);
    }

    @Test
    void buildingRequestsStayLooksAndOtherIntentsAreUntouched() {
        assertThat(CopilotService.intent("Monte um look em alta para o trabalho")).isEqualTo(CopilotService.Intent.LOOKS);
        assertThat(CopilotService.intent("Sugira 3 looks para hoje")).isEqualTo(CopilotService.Intent.LOOKS);
        assertThat(CopilotService.intent("Quais peças eu não uso há muito tempo?")).isEqualTo(CopilotService.Intent.FORGOTTEN);
        assertThat(CopilotService.intent("Onde está meu tênis branco?")).isEqualTo(CopilotService.Intent.WHERE_IS);
    }
}
