package br.com.fashionai.infrastructure.ai.ocr;

import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.List;

/**
 * Decodificação CTC gulosa do reconhecedor CRNN do PP-OCRv4, pura (sem ONNX Runtime): dicionário a partir do metadado
 * {@code character} do modelo e saída {@code [passos × classes]} → texto e confiança média dos caracteres mantidos.
 */
final class CtcGreedyDecoder {
    private CtcGreedyDecoder() {
    }

    /** Texto (já sem espaços nas pontas) e confiança média; o texto pode ficar em branco. */
    record Decoded(String text, double confidence) {
    }

    /**
     * Dicionário do CTC: índice 0 = branco, depois cada linha de {@code chars} na ordem (mesma lista do RapidOCR,
     * splitlines: nenhuma linha é descartada, senão os índices se deslocam) e, no fim, o espaço (use_space_char).
     */
    static List<String> dictionary(String chars) {
        if (chars == null || chars.isEmpty()) {
            throw new IllegalStateException("dicionário ausente no modelo de reconhecimento");
        }
        List<String> dct = new ArrayList<>();
        dct.add("");
        List<String> lines = new ArrayList<>(List.of(chars.split("\n", -1)));
        if (chars.endsWith("\n")) {
            lines.remove(lines.size() - 1);
        }
        dct.addAll(lines);
        dct.add(" ");
        return dct;
    }

    /**
     * Melhor classe por passo; descarta o branco, repetições consecutivas e índices fora do dicionário. Nulo quando
     * nenhum caractere foi mantido.
     */
    static Decoded decode(FloatBuffer scores, int steps, int classes, List<String> dict) {
        StringBuilder sb = new StringBuilder();
        double conf = 0;
        int kept = 0, prev = 0;
        for (int s = 0; s < steps; s++) {
            int best = 0;
            float bp = -1;
            for (int c = 0; c < classes; c++) {
                float v = scores.get(s * classes + c);
                if (v > bp) {
                    bp = v;
                    best = c;
                }
            }
            if (best != 0 && best != prev && best < dict.size()) {
                sb.append(dict.get(best));
                conf += bp;
                kept++;
            }
            prev = best;
        }
        return kept == 0 ? null : new Decoded(sb.toString().trim(), conf / kept);
    }
}
