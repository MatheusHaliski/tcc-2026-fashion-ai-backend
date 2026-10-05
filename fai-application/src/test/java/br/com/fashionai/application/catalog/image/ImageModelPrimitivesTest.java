package br.com.fashionai.application.catalog.image;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** Primitivas do pipeline de imagens oficiais: região normalizada, máscara por pixel e cor. */
class ImageModelPrimitivesTest {

    private static PixelMask rect(int w, int h, int x0, int y0, int x1, int y1) {
        PixelMask m = new PixelMask(w, h);
        for (int y = y0; y < y1; y++) {
            for (int x = x0; x < x1; x++) {
                m.set(x, y, 255);
            }
        }
        return m;
    }

    @Test
    void regiaoIntersecaoUniaoEFracao() {
        Region a = new Region(0.1, 0.1, 0.5, 0.5);
        Region b = new Region(0.3, 0.3, 0.9, 0.9);
        assertThat(a.intersect(b).area()).isCloseTo(0.04, within(1e-9));
        assertThat(a.union(b)).isEqualTo(new Region(0.1, 0.1, 0.9, 0.9));
        assertThat(a.fractionInside(b)).isCloseTo(0.25, within(1e-9));
        assertThat(new Region(0.5, 0.5, 0.1, 0.1)).isEqualTo(new Region(0.1, 0.1, 0.5, 0.5));   // cantos invertidos
        assertThat(Region.fromMap(a.toMap())).isEqualTo(a);
        Region q = a.sub(0, 0, 0.5, 0.5);
        assertThat(q.x1()).isCloseTo(0.3, within(1e-9));
        assertThat(q.y1()).isCloseTo(0.3, within(1e-9));
    }

    @Test
    void mascaraCaixaComponentesEDilatacao() {
        PixelMask m = rect(100, 80, 10, 10, 30, 40).or(rect(100, 80, 60, 50, 70, 60));
        assertThat(m.count()).isEqualTo(20 * 30 + 10 * 10);
        Region box = m.bounds();
        assertThat(box.x0()).isCloseTo(0.10, within(1e-9));
        assertThat(box.y1()).isCloseTo(0.75, within(1e-9));
        List<PixelMask> comps = m.components();
        assertThat(comps).hasSize(2);
        assertThat(comps.get(0).count()).isEqualTo(600);
        PixelMask d = rect(50, 50, 20, 20, 21, 21).dilate(2);
        assertThat(d.count()).isEqualTo(25);
        assertThat(m.minus(rect(100, 80, 0, 0, 100, 25)).count()).isEqualTo(20 * 15 + 100);   // buraco, nunca preenchido
        assertThat(rect(10, 10, 0, 0, 10, 5).resized(20, 20).count()).isEqualTo(200);
        assertThat(rect(10, 10, 0, 0, 5, 10).overlap(rect(10, 10, 0, 0, 10, 5))).isCloseTo(0.5, within(1e-9));
    }

    @Test
    void corLabDeltaEDominante() {
        assertThat(ColorMath.lab(0xFFFFFF)[0]).isCloseTo(100, within(0.01));
        assertThat(ColorMath.deltaE(0x000000, 0xFFFFFF)).isCloseTo(100, within(0.01));
        assertThat(ColorMath.deltaE(0x336699, 0x336699)).isZero();
        assertThat(ColorMath.parseHex("#1A2B3C")).isEqualTo(0x1A2B3C);
        assertThat(ColorMath.parseHex("xyz")).isEqualTo(-1);
        java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(40, 40, java.awt.image.BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < 40; y++) {
            for (int x = 0; x < 40; x++) {
                img.setRGB(x, y, x < 30 ? 0xFF2244CC : 0xFFFFFFFF);
            }
        }
        int dom = ColorMath.dominant(img, rect(40, 40, 0, 0, 40, 40));
        assertThat(ColorMath.deltaE(dom, 0x2244CC)).isLessThan(6);
    }
}
