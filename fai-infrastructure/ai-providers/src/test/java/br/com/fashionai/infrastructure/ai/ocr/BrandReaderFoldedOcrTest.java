package br.com.fashionai.infrastructure.ai.ocr;

import br.com.fashionai.application.imaging.BrandReader;
import br.com.fashionai.application.imaging.BrandRegions;
import br.com.fashionai.application.imaging.TextReaderPort;
import br.com.fashionai.domain.repository.BrandRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * RF4 · marca em tecido dobrado, com o OCR local de verdade (PP-OCRv4 em ONNX): um logo de duas linhas com polaridades
 * opostas ("UNDER" escuro sobre claro, "ARMOUR" claro sobre faixa escura), ondulado pela dobra e inclinado, numa
 * "camiseta" na resolução de uma foto de celular. A leitura normal não confirma; a robusta confirma pelo catálogo. Uma
 * camiseta lisa não ganha marca.
 */
class BrandReaderFoldedOcrTest {
    private static final OnnxTextReader OCR = new OnnxTextReader();

    static BrandReader reader() {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("ocr", (TextReaderPort) OCR);
        BrandReader r = new BrandReader(beans.getBeanProvider(TextReaderPort.class), beans.getBeanProvider(BrandRepository.class));
        r.useCatalog(Map.of("underarmour", "Under Armour", "umbro", "Umbro", "puma", "Puma", "nike", "Nike", "adidas", "Adidas",
                "lacoste", "Lacoste", "newbalance", "New Balance", "mormaii", "Mormaii", "tommyhilfiger", "Tommy Hilfiger", "hering", "Hering"));
        return r;
    }

    /**
     * Camiseta clara (1000×1200) com o logo em duas linhas no peito: {@code top} escuro sobre o tecido, {@code bottom}
     * claro sobre uma faixa escura; a dobra desloca cada coluna verticalmente (seno) e a camiseta fica inclinada.
     */
    static BufferedImage foldedShirt(String top, String bottom, int fontPx, double foldPx, double tiltDeg) {
        BufferedImage flat = new BufferedImage(1000, 1200, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = flat.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setColor(new Color(0xE9E5E8));
        g.fillRoundRect(170, 90, 660, 1060, 60, 60);
        g.fillRoundRect(20, 90, 960, 300, 60, 60);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, fontPx));
        int tw = g.getFontMetrics().stringWidth(top), bw = g.getFontMetrics().stringWidth(bottom);
        int baseline = 430;
        g.setColor(new Color(0x2B2B2B));
        if (!top.isEmpty()) {
            g.drawString(top, 500 - tw / 2, baseline);
        }
        if (!bottom.isEmpty()) {
            g.setColor(new Color(0x3A3A3A));
            g.fillRect(500 - bw / 2 - 24, baseline + 18, bw + 48, fontPx + 20);
            g.setColor(Color.WHITE);
            g.drawString(bottom, 500 - bw / 2, baseline + fontPx + 12);
        }
        g.dispose();
        // dobra: cada coluna desliza verticalmente seguindo um seno (amplitude foldPx), como o tecido amassado
        BufferedImage folded = new BufferedImage(1000, 1200, BufferedImage.TYPE_INT_ARGB);
        for (int x = 0; x < 1000; x++) {
            int dy = (int) Math.round(foldPx * Math.sin(x / 55.0));
            for (int y = 0; y < 1200; y++) {
                int sy = y - dy;
                folded.setRGB(x, y, sy >= 0 && sy < 1200 ? flat.getRGB(x, sy) : 0);
            }
        }
        if (tiltDeg == 0) {
            return folded;
        }
        BufferedImage out = new BufferedImage(1000, 1200, BufferedImage.TYPE_INT_ARGB);
        Graphics2D t = out.createGraphics();
        t.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        AffineTransform at = new AffineTransform();
        at.rotate(Math.toRadians(tiltDeg), 500, 600);
        t.drawImage(folded, at, null);
        t.dispose();
        return out;
    }

    @Test
    void logoDeDuasLinhasComPolaridadesOpostasEDobraForte() {
        // dobra de 20 px com letras de 32 px: a leitura normal não casa nada; a robusta lê as duas linhas em separado
        BufferedImage shirt = foldedShirt("UNDER", "ARMOUR", 32, 20, 0);
        BrandReader r = reader();
        List<BrandRegions.Zone> zones = BrandRegions.zones(shirt, "upper_piece");
        Optional<BrandReader.Found> plain = r.find(shirt, zones);
        assertTrue(plain.isEmpty() || !plain.get().confirmed(), "a leitura normal já confirma, o caso não exercita a robusta: " + plain);
        long t0 = System.nanoTime();
        Optional<BrandReader.Found> robust = r.findRobust(shirt, zones);
        long ms = (System.nanoTime() - t0) / 1_000_000;
        assertTrue(robust.isPresent(), "leitura robusta sem resultado");
        assertEquals("Under Armour", robust.get().brand(), "lido: " + robust.get());
        assertTrue(robust.get().confirmed(), "duas palavras do logo lidas em separado confirmam a marca: " + robust.get());
        assertTrue(ms < 20_000, "leitura robusta em " + ms + " ms");
    }

    @Test
    void logoInclinadoEDobradoNaResolucaoDeCelularEhLido() {
        BufferedImage shirt = foldedShirt("UNDER", "ARMOUR", 64, 9, 5);
        Optional<BrandReader.Found> f = reader().findRobust(shirt, BrandRegions.zones(shirt, "upper_piece"));
        assertTrue(f.isPresent() && f.get().confirmed() && "Under Armour".equals(f.get().brand()), "lido: " + f);
    }

    @Test
    void soALinhaDeCimaVisivelViraSugestaoNaoPreenchimento() {
        // a dobra esconde a segunda linha: "UNDER" sozinho é possível (a pessoa confirma), nunca confirmado
        BufferedImage shirt = foldedShirt("UNDER", "", 64, 9, 0);
        Optional<BrandReader.Found> f = reader().findRobust(shirt, BrandRegions.zones(shirt, "upper_piece"));
        assertTrue(f.isPresent(), "nada lido");
        assertEquals("Under Armour", f.get().brand(), "lido: " + f.get());
        assertFalse(f.get().confirmed(), "uma palavra só não confirma: " + f.get());
    }

    @Test
    void camisetaLisaNaoGanhaMarca() {
        BufferedImage shirt = foldedShirt("", "", 64, 9, 0);
        Optional<BrandReader.Found> f = reader().findRobust(shirt, BrandRegions.zones(shirt, "upper_piece"));
        assertTrue(f.isEmpty() || f.get().brand() == null, "camiseta lisa com marca: " + f);
    }
}
