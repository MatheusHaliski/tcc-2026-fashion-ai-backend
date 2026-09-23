package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;

import static org.assertj.core.api.Assertions.assertThat;

class ImageFiltersTest {
    /** RF4 — uma peça lisa já recortada (fundo transparente) precisa manter a cor: nada de gray-world nem stretch. */
    @Test
    void plainGarmentWithoutBackgroundKeepsItsColor() {
        BufferedImage img = new BufferedImage(300, 300, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(0xEF, 0xE3, 0xC8)); // creme
        g.fillRect(60, 40, 180, 220);
        g.dispose();
        BufferedImage out = ImageFilters.normalize(img).image();
        int p = out.getRGB(150, 150);
        assertThat((p >> 16) & 0xFF).isBetween(0xEF - 8, 0xEF + 8);
        assertThat((p >> 8) & 0xFF).isBetween(0xE3 - 8, 0xE3 + 8);
        assertThat(p & 0xFF).isBetween(0xC8 - 8, 0xC8 + 8);
        assertThat((out.getRGB(5, 5) >>> 24) & 0xFF).isZero();
    }

    /** Foto lavada com fundo neutro presente: o stretch recupera contraste, sem inverter nem saturar. */
    @Test
    void washedOutPhotoWithBackgroundGetsContrast() {
        BufferedImage img = new BufferedImage(300, 300, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(170, 170, 170));
        g.fillRect(0, 0, 300, 300);
        g.setColor(new Color(100, 100, 100));
        g.fillRect(80, 80, 140, 140);
        g.dispose();
        BufferedImage out = ImageFilters.normalize(img).image();
        int garment = out.getRGB(150, 150) & 0xFF;
        int bg = out.getRGB(10, 10) & 0xFF;
        assertThat(bg - garment).isGreaterThan(40);
    }
}
