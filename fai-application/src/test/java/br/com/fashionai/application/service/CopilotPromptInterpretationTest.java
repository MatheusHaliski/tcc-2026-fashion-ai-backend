package br.com.fashionai.application.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CopilotPromptInterpretationTest {
    @Test
    void extractsLookContextFromPortuguesePrompt() {
        CopilotService.LookPrompt prompt = CopilotService.lookPrompt(
                "Monte um look minimalista e confortável para trabalho no inverno.", List.of(), null);

        assertThat(prompt.occasions()).contains("work");
        assertThat(prompt.styles()).contains("minimalist");
        assertThat(prompt.mood()).isEqualTo("COMFORTABLE");
        assertThat(prompt.season()).isEqualTo("WINTER");
    }

    @Test
    void keepsOnlySupportedOccasionsAndMoods() {
        CopilotService.LookPrompt prompt = CopilotService.lookPrompt(
                "Um look para praia e algo sofisticado.", List.of("beach", "not-a-taxonomy-value"), "UNKNOWN");

        assertThat(prompt.occasions()).containsExactly("beach");
        assertThat(prompt.mood()).isEqualTo("SOPHISTICATED");
    }

    @Test
    void routesFashionAndPieceSearchRequestsToLookIntent() {
        assertThat(CopilotService.intent("Quero um look com blazer de lã para o trabalho")).isEqualTo(CopilotService.Intent.LOOKS);
        assertThat(CopilotService.intent("Quero Aura e linho no fundo do conjunto")).isEqualTo(CopilotService.Intent.LOOKS);
    }

    @Test
    void detectsPieceColorTypeAndMaterialConstraints() {
        assertThat(CopilotService.hasPieceConstraints("camiseta branca de algodão")).isTrue();
        assertThat(CopilotService.hasPieceConstraints("look em tons neutros")).isFalse();
    }
}
