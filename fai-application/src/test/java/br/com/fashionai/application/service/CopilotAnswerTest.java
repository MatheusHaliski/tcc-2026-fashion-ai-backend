package br.com.fashionai.application.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;

import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Copilot: resposta da IA em JSON (às vezes dentro de ```json) vira o texto da resposta, com as refs da lista "pecas";
 * a frase dos looks traz a ocasião traduzida, no idioma da pessoa (antes: "… para work" em qualquer idioma).
 */
class CopilotAnswerTest {
    @AfterEach
    void resetLocale() {
        LocaleContextHolder.resetLocaleContext();
    }

    @Test
    void respostaEmJsonViraTextoComAsRefs() {
        CopilotService.Answer a = CopilotService.plainAnswer(
                "{\"resposta\":\"Você tem 1 peça azul: a **Camisa azul**.\",\"pecas\":[\"p1\",\"p3\",\"x9\"],\"observacao\":\"...\"}");
        assertThat(a.text()).isEqualTo("Você tem 1 peça azul: a **Camisa azul**.");
        assertThat(a.refs()).containsExactly("p1", "p3");
    }

    @Test
    void jsonDentroDeBlocoDeCodigo() {
        CopilotService.Answer a = CopilotService.plainAnswer("```json\n{\"answer\": \"Use a [[p2]] com a [[p4]].\"}\n```");
        assertThat(a.text()).isEqualTo("Use a [[p2]] com a [[p4]].");
    }

    @Test
    void textoComumPassaComoVeio() {
        assertThat(CopilotService.plainAnswer("  Combine a [[p1]] com a [[p2]].  ").text()).isEqualTo("Combine a [[p1]] com a [[p2]].");
        // começa com chave mas não traz campo de resposta: mostra como veio em vez de apagar
        assertThat(CopilotService.plainAnswer("{sem json válido").text()).isEqualTo("{sem json válido");
        assertThat(CopilotService.plainAnswer(null).text()).isEmpty();
    }

    @Test
    void ocasiaoTraduzidaNaFraseDosLooks() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("pt-BR"));
        assertThat(CopilotService.lookSummary(2, List.of("work"))).isEqualTo("Separei 2 looks com peças do seu acervo para trabalho.");
        assertThat(CopilotService.lookSummary(3, List.of())).isEqualTo("Separei 3 looks com peças do seu acervo.");
        LocaleContextHolder.setLocale(Locale.ENGLISH);
        assertThat(CopilotService.lookSummary(2, List.of("work", "night_out"))).isEqualTo("I picked 2 looks with pieces from your closet for work/night out.");
    }
}
