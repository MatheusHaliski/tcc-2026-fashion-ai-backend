package br.com.fashionai.infrastructure.ai.ocr;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.TextReaderPort.Line;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** OCR local (PP-OCRv4 em ONNX): lê a palavra de um logo desenhado numa "camiseta" lisa. */
class OnnxTextReaderTest {
    private final OnnxTextReader ocr = new OnnxTextReader();

    /** Camiseta azul-marinho com a palavra no peito, como o LACOSTE grande da captura do usuário. */
    static BufferedImage shirt(String word, int fontPx) {
        BufferedImage img = new BufferedImage(900, 1000, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setColor(new Color(0x1B2A4A));
        g.fillRoundRect(150, 80, 600, 880, 60, 60);
        g.fillRoundRect(20, 80, 860, 260, 60, 60);
        g.setColor(Color.WHITE);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, fontPx));
        int tw = g.getFontMetrics().stringWidth(word);
        g.drawString(word, 450 - tw / 2, 330);
        g.dispose();
        return img;
    }

    @Test
    void leOLogoGrandeNoPeito() {
        long t0 = System.nanoTime();
        List<Line> lines = ocr.read(shirt("LACOSTE", 96));
        long ms = (System.nanoTime() - t0) / 1_000_000;
        assertTrue(ocr.available());
        assertTrue(lines.stream().anyMatch(l -> l.text().replace(" ", "").equalsIgnoreCase("LACOSTE")), "leu: " + lines);
        assertTrue(ms < 30_000, "carregar + ler em " + ms + " ms");
    }

    @Test
    void leTextoPequenoTambem() {
        List<Line> lines = ocr.read(shirt("NIKE", 48));
        assertTrue(lines.stream().anyMatch(l -> l.text().replace(" ", "").equalsIgnoreCase("NIKE")), "leu: " + lines);
    }

    @Test
    void pecaLisaNaoTemTexto() {
        BufferedImage img = shirt("", 10);
        assertTrue(ocr.read(img).stream().noneMatch(l -> l.confidence() > 0.8 && l.text().length() >= 3));
    }

    /** Fotos reais de peças fora do repositório: FAI_OCR_DIR=/pasta imprime o que foi lido (comparação com o RapidOCR). */
    @Test
    void fotosDePecas() throws IOException {
        String dir = System.getenv("FAI_OCR_DIR");
        assumeTrue(dir != null && !dir.isBlank(), "FAI_OCR_DIR não definida");
        try (Stream<Path> s = Files.walk(Path.of(dir))) {
            for (Path f : s.filter(p -> p.getFileName().toString().equals("processed.png")).sorted().limit(40).toList()) {
                List<Line> lines = ocr.read(ImageOps.decode(Files.readAllBytes(f)));
                System.out.println("OCR " + f.getParent().getFileName() + " " + lines.stream().filter(l -> l.confidence() > 0.5)
                        .map(l -> l.text() + String.format("(%.2f)", l.confidence())).toList());
            }
        }
    }
}
