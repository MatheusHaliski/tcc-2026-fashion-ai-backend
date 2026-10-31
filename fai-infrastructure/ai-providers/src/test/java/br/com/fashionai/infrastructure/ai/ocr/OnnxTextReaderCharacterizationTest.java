package br.com.fashionai.infrastructure.ai.ocr;

import br.com.fashionai.application.imaging.TextReaderPort.Line;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Caracterização do adaptador de OCR local (PP-OCRv4 em ONNX, modelos no classpath, sem rede): contrato da porta
 * {@code TextReaderPort} que o lote 19 preserva ao separar o pós-processamento puro (DBNet e CTC) do ONNX Runtime.
 */
class OnnxTextReaderCharacterizationTest {
    private static final OnnxTextReader OCR = new OnnxTextReader();

    /** Fundo branco com uma palavra por linha, em alturas diferentes (a de cima primeiro na saída). */
    static BufferedImage page(int width, int height, int fontPx, String... rows) {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, width, height);
        g.setColor(Color.BLACK);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, fontPx));
        for (int i = 0; i < rows.length; i++) {
            g.drawString(rows[i], 60, (i + 1) * height / (rows.length + 1));
        }
        g.dispose();
        return img;
    }

    @Test
    void duasLinhasSaemDeCimaParaBaixoComCaixaRelativa() {
        List<Line> lines = OCR.read(page(900, 700, 80, "PUMA", "ADIDAS"));
        assertTrue(lines.size() >= 2, "leu: " + lines);
        for (int i = 0; i < lines.size(); i++) {
            double[] b = lines.get(i).box();
            assertEquals(4, b.length);
            assertTrue(b[0] >= 0 && b[1] >= 0 && b[2] <= 1 && b[3] <= 1 && b[0] < b[2] && b[1] < b[3], "caixa " + i);
            assertTrue(lines.get(i).confidence() > 0 && lines.get(i).confidence() <= 1);
            if (i > 0) {
                assertTrue(lines.get(i - 1).box()[1] <= b[1], "ordem vertical");
            }
        }
        assertTrue(lines.get(0).text().replace(" ", "").equalsIgnoreCase("PUMA"), "leu: " + lines);
        assertTrue(lines.stream().anyMatch(l -> l.text().replace(" ", "").equalsIgnoreCase("ADIDAS")), "leu: " + lines);
    }

    @Test
    void reconhecimentoSemDetectorDevolveCaixaNula() {
        Optional<Line> line = OCR.recognize(page(520, 120, 72, "NIKE"));
        assertTrue(line.isPresent());
        assertEquals("NIKE", line.get().text().replace(" ", "").toUpperCase());
        assertNull(line.get().box());
        assertTrue(line.get().confidence() > 0.5);
    }

    @Test
    void recorteMinusculoOuEmBrancoNaoTemTexto() {
        assertTrue(OCR.recognize(new BufferedImage(3, 40, BufferedImage.TYPE_INT_RGB)).isEmpty());
        assertTrue(OCR.read(page(400, 400, 10)).isEmpty());
        assertTrue(OCR.available());
    }

    @Test
    void imagemTransparenteViraBrancaELadoMaiorLimitado() {
        BufferedImage alpha = new BufferedImage(3200, 800, BufferedImage.TYPE_INT_ARGB);
        BufferedImage out = OnnxTextReader.onWhite(alpha, 1600);
        assertEquals(1600, out.getWidth());
        assertEquals(400, out.getHeight());
        assertEquals(0xFFFFFF, out.getRGB(10, 10) & 0xFFFFFF);
        assertEquals(40, OnnxTextReader.onWhite(new BufferedImage(40, 20, BufferedImage.TYPE_INT_RGB), 1600).getWidth());
    }
}
