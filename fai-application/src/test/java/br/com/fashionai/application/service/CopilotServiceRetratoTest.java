package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;
import tools.jackson.databind.ObjectMapper;

import java.io.File;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização do R86: frases de entrada fixas passam pelo roteador de intenções, pelo interpretador de prompt e de
 * fundo, por todas as respostas do {@code ask} (onde está, Hype, esquecidas, Inventory Score, diferente, diagnóstico,
 * looks com Momento e conversa livre), pelo painel ({@code context}/{@code suggestions}) e pelo {@code accept}; o retrato
 * textual (com as chamadas à IA, ao Autopiloto e à auditoria) é comparado com o gravado no código original
 * (src/test/resources/copilot/copilot-service-retrato.txt).
 */
class CopilotServiceRetratoTest {
    private static final Path GOLDEN = Path.of("src/test/resources/copilot/copilot-service-retrato.txt");

    static final List<String> FRASES = List.of(
            "Onde está meu tênis branco?", "Cadê a minha bolsa vermelha?", "Where is my black jacket?", "¿Dónde está mi camisa azul?",
            "Qual peça está em alta?", "Tenho alguma peça rara?", "Qual peça minha está voltando a ser tendência?",
            "Quais peças estão crescendo?", "Qual look meu tem mais potencial de trend?", "Monte um look em alta",
            "Quais roupas eu não uso há muito tempo?", "Como melhorar meu inventory score?", "Quero algo diferente hoje",
            "O que falta no meu guarda-roupa?", "Sugira 3 looks para o trabalho", "Monte um look para o Halloween",
            "Look com camiseta branca de algodão", "Quero uma saia de seda verde", "Está 8 graus e chovendo",
            "Fundo geométrico com aura elétrica ciano", "Qual é o seu nome?", "Me conte uma curiosidade sobre moda",
            "camisa de lã para o escritório", "Algo para o happy hour de sexta", "Look boho para festival no verão");

    @AfterEach
    void resetLocale() {
        LocaleContextHolder.resetLocaleContext();
    }

    @Test
    @SuppressWarnings("unchecked")
    void roteiroCompletoIgualAoRetratoDoCodigoOriginal() throws Exception {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("pt-BR"));
        CopilotRetratoFixture f = new CopilotRetratoFixture();
        f.catalog(new ObjectMapper().readValue(new File("../fai-web/src/main/resources/catalog/asset-manifest.json"), Map.class));
        CopilotService svc = f.svc;
        CopilotRetrato r = new CopilotRetrato();

        for (String frase : FRASES) {
            r.step("intent[" + frase + "]", () -> CopilotService.intent(frase));
            r.step("lookPrompt[" + frase + "]", () -> CopilotService.lookPrompt(frase, List.of("casual"), "ELEGANT"));
            r.step("lookPrompt.livre[" + frase + "]", () -> CopilotService.lookPrompt(frase, null, null));
            r.step("hasPieceConstraints[" + frase + "]", () -> CopilotService.hasPieceConstraints(frase));
            r.step("backgroundPrompt[" + frase + "]", () -> svc.backgroundPrompt(frase, List.of("classic"), List.of("work")));
            r.step("orientation[" + frase + "]", () -> svc.orientation(frase, List.of("classic"), List.of("work")));
            r.step("searchPieces[" + frase + "]", () -> svc.searchPieces(f.uid, frase).stream().map(w -> w.getName()).toList());
        }
        r.step("normalized", () -> CopilotService.normalized("  Calça_Jeans-Azul   Clara "));
        r.step("mentions", () -> List.of(CopilotService.mentions("Uma calça jeans", "calca"), CopilotService.mentions("calçada", "calca")));
        r.step("startsWithWord", () -> List.of(CopilotService.startsWithWord("camisetas brancas", "branc"), CopilotService.startsWithWord("x", "y z")));
        r.step("promptsFor", () -> List.of(CopilotService.promptsFor("grade"), CopilotService.promptsFor("QUARTO"), CopilotService.promptsFor("DESTAQUES"),
                CopilotService.promptsFor(null)));
        r.step("backgroundPrompt.hex", () -> svc.backgroundPrompt("fundo #12ab9F com container", List.of(), List.of()));
        r.step("backgroundPrompt.container", () -> svc.backgroundPrompt("background container #00FF00", List.of(), List.of()));
        r.step("backgroundPrompt.aura.gif", () -> svc.backgroundPrompt("aura animada gif com material veludo", List.of("glam"), List.of("party")));
        r.step("backgroundPrompt.aura.desconhecida", () -> svc.backgroundPrompt("aura geometria eletro", List.of(), List.of()));
        r.step("backgroundPrompt.aura.recomendada", () -> svc.backgroundPrompt("quero uma aura bonita e material", List.of(), List.of()));
        r.step("backgroundPrompt.sazonal", () -> svc.backgroundPrompt("fundo com cartela sazonal de inverno", List.of(), List.of()));
        r.step("orientation.vazia", () -> svc.orientation(" ", List.of(), List.of()));
        r.step("plainAnswer", () -> List.of(CopilotService.plainAnswer("{\"texto\":\"Oi [[p1]]\",\"pieces\":[\"p2\",\"q\"]}"),
                CopilotService.plainAnswer("```json\n{\"x\":1}\n```"), CopilotService.plainAnswer(" ok ")));
        r.step("lookSummary", () -> List.of(CopilotService.lookSummary(1, null), CopilotService.lookSummary(2, List.of("work", "party"))));
        r.step("purchaseSuggestions", () -> CopilotService.purchaseSuggestions(f.closet));
        r.step("draft", () -> CopilotService.draft(f.closet.subList(0, 3), "copilot", "p"));

        r.step("context", () -> svc.context(f.me, "quarto", null, "SP", null, null));
        r.step("suggestions", () -> svc.suggestions(f.me, "SP", null, null));
        r.calls("suggestions.schemeService", f.schemeService);
        for (String frase : FRASES) {
            r.step("ask[" + frase + "]", () -> svc.ask(f.me, request(frase, "QUARTO", null)));
            r.calls("ask.autopilot[" + frase + "]", f.autopilot);
            r.calls("ask.ai[" + frase + "]", f.ai);
            r.calls("ask.audit[" + frase + "]", f.audit);
        }
        r.step("ask.repetida", () -> svc.ask(f.me, request("Sugira 3 looks para o trabalho", "GRADE", "SAFE")));
        r.calls("ask.repetida.autopilot", f.autopilot);
        r.step("ask.vazia", () -> svc.ask(f.me, request("   ", null, null)));
        r.step("ask.semPecaFiltrada", () -> svc.ask(f.me, request("Look com bota roxa", null, null)));

        f.closet.forEach(w -> w.setAvailabilityStatus(AvailabilityStatus.ARCHIVED));
        r.step("ask.semAcervo.hype", () -> svc.ask(f.me, request("Qual peça está em alta?", null, null)));
        r.step("ask.semAcervo.esquecidas", () -> svc.ask(f.me, request("Quais roupas eu não uso há muito tempo?", null, null)));
        r.step("ask.semAcervo.onde", () -> svc.ask(f.me, request("Onde está meu tênis branco?", null, null)));
        f.closet.forEach(w -> w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE));
        f.closet.subList(3, f.closet.size()).clear();
        r.step("ask.poucasPecas.diferente", () -> svc.ask(f.me, request("Quero algo diferente", null, null)));
        r.step("ask.poucasPecas.looks", () -> svc.ask(f.me, request("Sugira 3 looks", null, null)));
        r.step("context.poucasPecas", () -> svc.context(f.me, null, List.of(f.uid), null, null, null));

        r.step("accept", () -> svc.accept(f.me, List.of(f.closet.get(0).getId()), null, List.of("work"), List.of("classic"), "ELEGANT",
                "WINTER", "desc", Map.of()));
        r.calls("accept.autopilot", f.autopilot);
        r.calls("accept.dailyLook", f.dailyLookService);

        assertThat(r.text()).isEqualTo(CopilotRetrato.golden(r.text(), GOLDEN));
    }

    static CopilotService.AskRequest request(String message, String view, String mode) {
        return new CopilotService.AskRequest(message, view, null, null, null, "SP", null, null, List.of("antiga"), mode);
    }
}
