package br.com.fashionai.infrastructure.ai.image;

import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Resposta do Gemini com imagem: acha a primeira parte inlineData (ou inline_data) mesmo depois de uma parte de texto. */
class GeminiImageEditAdapterTest {
    @Test
    void primeiraImagemDaResposta() {
        String data = Base64.getEncoder().encodeToString(new byte[]{1, 2, 3});
        Map<String, Object> res = Map.of("candidates", List.of(Map.of("content", Map.of("parts", List.of(
                Map.of("text", "Aqui está a peça"),
                Map.of("inlineData", Map.of("mimeType", "image/png", "data", data)))))));
        GeminiImageEditAdapter.Inline img = GeminiImageEditAdapter.firstImage(res).orElseThrow();
        assertThat(img.bytes()).containsExactly(1, 2, 3);
        assertThat(img.mimeType()).isEqualTo("image/png");
    }

    @Test
    void aceitaSnakeCaseESemImagemEVazio() {
        String data = Base64.getEncoder().encodeToString(new byte[]{9});
        Map<String, Object> snake = Map.of("candidates", List.of(Map.of("content", Map.of("parts", List.of(
                Map.of("inline_data", Map.of("mime_type", "image/jpeg", "data", data)))))));
        assertThat(GeminiImageEditAdapter.firstImage(snake).orElseThrow().mimeType()).isEqualTo("image/jpeg");
        assertThat(GeminiImageEditAdapter.firstImage(Map.of("candidates", List.of()))).isEmpty();
        assertThat(GeminiImageEditAdapter.firstImage(null)).isEmpty();
    }

    @Test
    void semChaveNaoFicaDisponivel() {
        assertThat(new GeminiImageEditAdapter("", "gemini-2.5-flash-image").available()).isFalse();
    }
}
