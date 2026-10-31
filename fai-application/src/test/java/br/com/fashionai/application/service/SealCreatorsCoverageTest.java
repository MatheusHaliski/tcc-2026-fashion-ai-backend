package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.seal.SealDesigns;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.SealTier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Prova de que os criadores de selo (manual e com IA) aceitam textos/prompts variados e rejeitam o que está fora da taxonomia. */
class SealCreatorsCoverageTest extends SealCreatorsCoverageFixture {
    // ------------------------------------------------------------------ criador manual: textos variados

    @ParameterizedTest
    @CsvSource({
            "Azul,navy,Zara,ZARA",
            "Azul,denim,Zara,zara",
            "' Azul ',cobalt,' Zara ',Zara",
            "Vermelho,burgundy,Nike,NIKE",
            "Preto,black,Adidas,adidas",
            "blue,blue,Zara,Zara",
    })
    void criadorManualAceitaVariacoesDeTextoDeCorEMarca(String color, String pieceColor, String brandText, String pieceBrand) {
        Map<String, Object> raw = Map.of("rules", List.of(Map.of("quantifier", "AT_LEAST", "count", 1, "color", color, "brand", brandText)));
        assertThat(SealPolicies.normalize(raw)).isNotNull();
        assertThat(matches(raw, SealTier.PECA, piece(pieceBrand, pieceColor))).isTrue();
        assertThat(matches(raw, SealTier.PECA, piece("Marca Desconhecida", pieceColor))).isFalse();
        assertThat(matches(raw, SealTier.PECA, piece(pieceBrand, "white"))).isFalse();
    }

    @ParameterizedTest
    @CsvSource({
            "'Camiseta azul da Nike'",
            "'Seleção de verão — coleção 2026'",
            "'Édredon São João & Cia'",
            "'Look \"premium\" de inverno'",
            "'AB'",
    })
    void criadorManualAceitaTitulosEDescricoesVariadosNoModeloDeReferencia(String title) {
        Map<String, Object> normalized = SealPolicies.normalize(referencePolicy(SealTier.LOOK, title, 2, "Nike", "blue"));
        assertThat(normalized).isNotNull();
        Map<?, ?> model = (Map<?, ?>) normalized.get("referenceModel");
        assertThat(model.get("title")).asString().isNotBlank().contains(title.strip().substring(0, 2));
        assertThat(matches(referencePolicy(SealTier.LOOK, title, 2, "Nike", "blue"), SealTier.LOOK,
                piece("Nike", "blue"), piece("Nike", "blue"))).isTrue();
        assertThat(matches(referencePolicy(SealTier.LOOK, title, 2, "Nike", "blue"), SealTier.LOOK, piece("Nike", "blue"))).isFalse();
    }

    @Test
    void criadorManualRejeitaTextosForaDaTaxonomiaSemDescartarCriteriosEmSilencio() {
        assertThatThrownBy(() -> SealPolicies.normalize(Map.of("rules", List.of(Map.of("color", "fúcsia"))))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> SealPolicies.normalize(Map.of("occasions", List.of("baile")))).isInstanceOf(ApiException.class);
        Map<String, Object> unknown = referenceModel(SealTier.LOOK, "Azul", 1, "Nike", "blue");
        unknown.put("pieces", List.of(Map.of("nonexistent", "x")));
        assertThatThrownBy(() -> SealPolicies.normalize(Map.of("referenceModel", unknown))).isInstanceOf(ApiException.class);
    }

    // ------------------------------------------------------------------ criador com IA: prompts variados

    @ParameterizedTest
    @ValueSource(strings = {
            "#createsealpolicy Duas camisetas azuis da Nike",
            "  #createsealpolicy   uma peça vermelha da Nike  ",
            "#CREATESEALPOLICY Look com três peças pretas",
            "#createsealpolicy two blue Nike t-shirts, please",
            "#createsealpolicy\nCamiseta azul\nda Nike\npara o verão",
            "#createsealpolicy Seleção de verão — coleção 2026 «Nike» & cia.",
    })
    @SuppressWarnings("unchecked")
    void copilotAceitaPromptsVariadosEReenviaOPedidoSemPublicarOSelo(String prompt) {
        assertThat(SealPolicyCopilot.tagged(prompt)).isTrue();
        UUID inference = UUID.randomUUID();
        when(ai.text(any())).thenAnswer(inv -> {
            AiEngine.TextCall<Map<String, Object>> call = inv.getArgument(0);
            Map<String, Object> sent = Json.map(call.prompt());
            assertThat(sent.get("request")).isEqualTo(prompt.strip().replaceAll(" +", " "));
            Map<String, Object> parsed = call.parser().apply(Json.write(Map.of("status", "VALID", "name", "Azul Nike", "tier", "PECA",
                    "text", "Ana, rascunho pronto para revisão.", "policy", referencePolicy(SealTier.PECA, "Azul Nike", 1, "Nike", "blue"),
                    "design", SealDesigns.defaultDesign(false, SealTier.PECA))));
            return new AiOutcome<>(parsed, inference, AiCallResult.SUCCESS, false, "remote", "test", 0, BigDecimal.ZERO, null, null, null);
        });
        Map<String, Object> out = seals.draft(brandSession, SealTier.PECA, prompt, null, null);
        assertThat(out.get("status")).isEqualTo("VALID");
        assertThat(out.get("intent")).isEqualTo("SEAL_POLICY");
        assertThat(out.get("inferenceId")).isEqualTo(inference);
        assertThat((Map<String, Object>) out.get("policy")).containsEntry("aiInferenceId", inference.toString());
        verify(sealRepo, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Nike", "nike", "NIKE"})
    @SuppressWarnings("unchecked")
    void copilotAceitaMarcaEmQualquerCaixaEPoliticaGeradaDetectaPecasECompativeis(String brandText) {
        when(ai.text(any())).thenAnswer(inv -> {
            AiEngine.TextCall<Map<String, Object>> call = inv.getArgument(0);
            Map<String, Object> parsed = call.parser().apply(Json.write(Map.of("status", "VALID", "name", "Look azul", "tier", "LOOK",
                    "policy", referencePolicy(SealTier.LOOK, "Look azul", 2, brandText, "blue"),
                    "design", SealDesigns.defaultDesign(false, SealTier.LOOK))));
            return new AiOutcome<>(parsed, UUID.randomUUID(), AiCallResult.SUCCESS, false, "remote", "test", 0, BigDecimal.ZERO, null, null, null);
        });
        Map<String, Object> out = seals.draft(brandSession, SealTier.LOOK, "#createsealpolicy Duas peças azuis da " + brandText, null, null);
        Map<String, Object> policy = (Map<String, Object>) out.get("policy");
        assertThat(matches(policy, SealTier.LOOK, piece("Nike", "blue"), piece("Nike", "blue"))).isTrue();
        assertThat(matches(policy, SealTier.LOOK, piece("Nike", "blue"), piece("Nike", "red"))).isFalse();
        assertThat(matches(policy, SealTier.LOOK, piece("Zara", "blue"), piece("Zara", "blue"))).isFalse();
    }

    @Test
    void copilotPerguntaQuandoOPedidoCitaMarcaDesconhecidaEAceitaRespostaEmBlocoDeCodigo() {
        when(ai.text(any())).thenAnswer(inv -> {
            AiEngine.TextCall<Map<String, Object>> call = inv.getArgument(0);
            String fenced = "```json\n" + Json.write(Map.of("status", "VALID", "name", "Azul Gucci", "tier", "PECA",
                    "policy", referencePolicy(SealTier.PECA, "Azul Gucci", 1, "Gucci", "blue"),
                    "design", SealDesigns.defaultDesign(false, SealTier.PECA))) + "\n```";
            return new AiOutcome<>(call.parser().apply(fenced), UUID.randomUUID(), AiCallResult.SUCCESS, false, "remote", "test", 0, BigDecimal.ZERO, null, null, null);
        });
        Map<String, Object> out = seals.draft(brandSession, SealTier.PECA, "#createsealpolicy Peça azul da Gucci", null, null);
        assertThat(out.get("status")).isEqualTo("INCOMPLETE");
        assertThat(out).doesNotContainKey("policy");
        assertThat((List<?>) out.get("questions")).isNotEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Peça azul da Nike", "#createsealpolicyextra azul", "#createsealpolicy", "   #createsealpolicy   "})
    void copilotRejeitaPromptsSemATagOuSoComATagAntesDeChamarAIA(String prompt) {
        assertThatThrownBy(() -> seals.draft(brandSession, SealTier.PECA, prompt, null, null)).isInstanceOf(ApiException.class);
        verifyNoInteractions(ai);
    }

    @Test
    void copilotRespeitaONivelPedidoEDescartaModeloDeOutroNivel() {
        when(ai.text(any())).thenAnswer(inv -> {
            AiEngine.TextCall<Map<String, Object>> call = inv.getArgument(0);
            Map<String, Object> parsed = call.parser().apply(Json.write(Map.of("status", "VALID", "name", "Azul Nike", "tier", "LOOK",
                    "policy", referencePolicy(SealTier.LOOK, "Azul Nike", 1, "Nike", "blue"),
                    "design", SealDesigns.defaultDesign(false, SealTier.LOOK))));
            return new AiOutcome<>(parsed, UUID.randomUUID(), AiCallResult.SUCCESS, true, "remote", "test", 0, BigDecimal.ZERO, null, null, null);
        });
        assertThatThrownBy(() -> seals.draft(brandSession, SealTier.PECA, "#createsealpolicy Peça azul da Nike", null, null))
                .isInstanceOf(ApiException.class);
    }
}
