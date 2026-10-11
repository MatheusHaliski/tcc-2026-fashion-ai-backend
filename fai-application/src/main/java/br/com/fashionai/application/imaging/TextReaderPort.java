package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;
import java.util.List;

/**
 * Leitura de texto na imagem, no próprio servidor (OCR local): usada para ler a marca escrita na peça quando a IA de
 * visão remota não está disponível ou não leu (RF4 — marca pelo logo).
 */
public interface TextReaderPort {
    boolean available();

    /** Linhas de texto achadas, com a confiança da leitura (0–1) e a caixa relativa à imagem (x0, y0, x1, y1 em 0–1). */
    List<Line> read(BufferedImage image);

    /**
     * Só o reconhecimento (sem detector) de um recorte que já contém uma linha de texto — barato, para reler a mesma
     * caixa em variações (invertida, inclinada, metade). Vazio sem texto. A caixa da linha devolvida é nula.
     */
    default java.util.Optional<Line> recognize(BufferedImage lineCrop) {
        Line best = null;
        for (Line l : read(lineCrop)) {
            if (best == null || l.confidence() > best.confidence()) {
                best = l;
            }
        }
        return best == null ? java.util.Optional.empty() : java.util.Optional.of(new Line(best.text(), best.confidence(), null));
    }

    record Line(String text, double confidence, double[] box) {
    }
}
