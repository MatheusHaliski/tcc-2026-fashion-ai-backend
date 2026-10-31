package br.com.fashionai.infrastructure.ai.ocr;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Pós-processamento DBNet puro: mapas de probabilidade sintéticos, sem ONNX. */
class DbNetBoxesTest {
    private static float[] map(int rw, int rh) {
        return new float[rw * rh];
    }

    private static void fill(float[] prob, int rw, int x0, int y0, int x1, int y1, float v) {
        for (int y = y0; y <= y1; y++) {
            for (int x = x0; x <= x1; x++) {
                prob[y * rw + x] = v;
            }
        }
    }

    @Test
    void entradaAmpliaLadoMenorAte736EmMultiplosDe32() {
        assertArrayEquals(new int[]{896, 992}, DbNetBoxes.inputSize(900, 1000));
        assertArrayEquals(new int[]{1600, 1248}, DbNetBoxes.inputSize(1600, 1250));
        // lado maior limitado a 2000 depois da ampliação
        assertArrayEquals(new int[]{2016, 32}, DbNetBoxes.inputSize(4000, 10));
        assertArrayEquals(new int[]{32, 2016}, DbNetBoxes.inputSize(1, 736));
    }

    @Test
    void componenteViraCaixaExpandidaNaEscalaDaImagem() {
        int rw = 64, rh = 32;
        float[] prob = map(rw, rh);
        fill(prob, rw, 10, 10, 29, 14, 0.9f);                   // 20 × 5 px, média alta
        List<int[]> boxes = DbNetBoxes.boxes(prob, rw, rh, 128, 64);
        assertEquals(1, boxes.size());
        // dilatação 2x2 → 21 × 6; unclip d = 21·6·1,6 / (2·27) = 3,733; escala 2×
        assertArrayEquals(new int[]{12, 12, 70, 40, 126}, boxes.get(0));
    }

    @Test
    void descartaComponenteFracoOuFino() {
        int rw = 64, rh = 32;
        float[] prob = map(rw, rh);
        fill(prob, rw, 5, 5, 25, 9, 0.35f);                      // acima do limiar 0,3, média abaixo de 0,5
        fill(prob, rw, 40, 2, 40, 28, 0.95f);                    // 1 px de largura → 2 após dilatação: < 3
        assertTrue(DbNetBoxes.boxes(prob, rw, rh, 64, 32).isEmpty());
    }

    @Test
    void saiDeCimaParaBaixoEDaEsquerdaParaADireita() {
        int rw = 96, rh = 64;
        float[] prob = map(rw, rh);
        fill(prob, rw, 60, 40, 75, 45, 0.9f);                   // mesma altura e tamanho da caixa à esquerda
        fill(prob, rw, 5, 5, 20, 9, 0.9f);
        fill(prob, rw, 5, 40, 20, 45, 0.9f);
        List<int[]> boxes = DbNetBoxes.boxes(prob, rw, rh, 96, 64);
        assertEquals(3, boxes.size());
        assertTrue(boxes.get(0)[1] < boxes.get(1)[1]);
        assertTrue(boxes.get(1)[1] == boxes.get(2)[1] && boxes.get(1)[0] < boxes.get(2)[0]);
    }

    @Test
    void juntaLetraSoltaDaMesmaLinhaENaoJuntaLinhasDiferentes() {
        List<int[]> out = DbNetBoxes.mergeLine(List.of(new int[]{100, 200, 150, 290, 10}, new int[]{160, 205, 600, 292, 90},
                new int[]{120, 500, 400, 540, 30}));
        assertEquals(2, out.size());
        assertArrayEquals(new int[]{100, 200, 600, 292, 100}, out.get(0));
        assertArrayEquals(new int[]{120, 500, 400, 540, 30}, out.get(1));
    }

    @Test
    void naoJuntaAlturasMuitoDiferentesNemVaoGrande() {
        List<int[]> altura = DbNetBoxes.mergeLine(List.of(new int[]{0, 0, 50, 100, 1}, new int[]{55, 10, 200, 60, 1}));
        assertEquals(2, altura.size());
        List<int[]> vao = DbNetBoxes.mergeLine(List.of(new int[]{0, 0, 50, 50, 1}, new int[]{81, 0, 200, 50, 1}));
        assertEquals(2, vao.size());
    }
}
