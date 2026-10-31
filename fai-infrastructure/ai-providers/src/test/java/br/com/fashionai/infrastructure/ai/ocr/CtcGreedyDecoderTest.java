package br.com.fashionai.infrastructure.ai.ocr;

import org.junit.jupiter.api.Test;

import java.nio.FloatBuffer;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Decodificação CTC gulosa pura, com saídas sintéticas do CRNN. */
class CtcGreedyDecoderTest {
    /** Uma linha por passo: a classe indicada recebe {@code p}, as demais 0,01. */
    private static FloatBuffer steps(int classes, int[] best, float[] p) {
        float[] data = new float[best.length * classes];
        for (int s = 0; s < best.length; s++) {
            for (int c = 0; c < classes; c++) {
                data[s * classes + c] = c == best[s] ? p[s] : 0.01f;
            }
        }
        return FloatBuffer.wrap(data);
    }

    @Test
    void dicionarioTemBrancoNoInicioEEspacoNoFim() {
        assertEquals(List.of("", "a", "b", " "), CtcGreedyDecoder.dictionary("a\nb\n"));
        // linha vazia no meio é mantida: senão os índices se deslocam
        assertEquals(List.of("", "a", "", "b", " "), CtcGreedyDecoder.dictionary("a\n\nb"));
    }

    @Test
    void dicionarioAusenteFalha() {
        assertThrows(IllegalStateException.class, () -> CtcGreedyDecoder.dictionary(null));
        assertThrows(IllegalStateException.class, () -> CtcGreedyDecoder.dictionary(""));
    }

    @Test
    void colapsaRepeticoesSeparaPorBrancoEMediaAConfianca() {
        List<String> dict = CtcGreedyDecoder.dictionary("N\nI\nK\nE");
        // N N _ I K K _ K E: repetição seguida colapsa; K depois do branco é outra letra
        int[] best = {1, 1, 0, 2, 3, 3, 0, 3, 4};
        float[] p = {0.9f, 0.8f, 0.7f, 0.6f, 1f, 0.5f, 0.9f, 0.8f, 0.7f};
        CtcGreedyDecoder.Decoded d = CtcGreedyDecoder.decode(steps(6, best, p), best.length, 6, dict);
        assertEquals("NIKKE", d.text());
        assertEquals((0.9 + 0.6 + 1.0 + 0.8 + 0.7) / 5, d.confidence(), 1e-6);
    }

    @Test
    void espacosNasPontasSaemEIndiceForaDoDicionarioEIgnorado() {
        List<String> dict = CtcGreedyDecoder.dictionary("A");                // "", "A", " "
        int[] best = {2, 1, 7, 2};
        float[] p = {0.5f, 0.9f, 0.99f, 0.5f};
        CtcGreedyDecoder.Decoded d = CtcGreedyDecoder.decode(steps(8, best, p), best.length, 8, dict);
        assertEquals("A", d.text());
        assertEquals((0.5 + 0.9 + 0.5) / 3, d.confidence(), 1e-6);
    }

    @Test
    void soBrancoNaoTemLinha() {
        int[] best = {0, 0, 0};
        assertNull(CtcGreedyDecoder.decode(steps(3, best, new float[]{1, 1, 1}), 3, 3, CtcGreedyDecoder.dictionary("x")));
    }
}
