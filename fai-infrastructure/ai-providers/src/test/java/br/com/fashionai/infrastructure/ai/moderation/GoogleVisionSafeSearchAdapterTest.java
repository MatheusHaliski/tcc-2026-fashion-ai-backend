package br.com.fashionai.infrastructure.ai.moderation;

import br.com.fashionai.application.moderation.ImageSafetyPorts.Likelihoods;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Leitura da resposta do SafeSearch (sem rede): a escala textual vira 0–5. */
class GoogleVisionSafeSearchAdapterTest {

    @Test
    void escalaDoSafeSearch() {
        Optional<Likelihoods> l = GoogleVisionSafeSearchAdapter.parse(Map.of("safeSearchAnnotation",
                Map.of("adult", "LIKELY", "racy", "VERY_LIKELY", "violence", "VERY_UNLIKELY", "spoof", "UNLIKELY", "medical", "POSSIBLE")));
        assertEquals(new Likelihoods(4, 5, 1), l.orElseThrow());
        assertEquals(0, GoogleVisionSafeSearchAdapter.level("OUTRA_COISA"));
        assertEquals(0, GoogleVisionSafeSearchAdapter.level(null));
    }

    @Test
    void respostaSemAnotacaoNaoDecide() {
        assertTrue(GoogleVisionSafeSearchAdapter.parse(Map.of("error", Map.of("code", 403))).isEmpty());
    }

    @Test
    void semChaveNaoEChamado() {
        assertFalse(new GoogleVisionSafeSearchAdapter("", 30).available());
        assertFalse(new GoogleVisionSafeSearchAdapter("placeholder-key", 30).available());
    }
}
