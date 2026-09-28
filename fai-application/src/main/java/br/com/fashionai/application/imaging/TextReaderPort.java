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

    record Line(String text, double confidence, double[] box) {
    }
}
