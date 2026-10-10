package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regiões de peças sobre uma superfície, sem IA: grade de catálogo (mais de 12 peças → ficam as maiores, em ordem de
 * leitura), roupas sobre uma cama com textura (fundo adaptativo) e a cor dominante de cada região (não a média).
 */
class LocalPieceRegionsTest {
    static final Color[] PALETTE = {new Color(20, 20, 20), new Color(250, 250, 250), new Color(30, 40, 90), new Color(120, 20, 40),
            new Color(70, 85, 40), new Color(230, 120, 40), new Color(200, 200, 60), new Color(40, 120, 200)};
    /** grade sobre fundo branco: nenhuma peça branca (branco sobre branco não tem contorno — nem para uma pessoa) */
    static final Color[] GRID = {new Color(20, 20, 20), new Color(150, 150, 150), new Color(30, 40, 90), new Color(120, 20, 40),
            new Color(70, 85, 40), new Color(230, 120, 40), new Color(200, 200, 60), new Color(40, 120, 200)};

    @Test
    void gradeDeCatalogoComCatorzePecasFicaComAsDozeMaioresEmOrdemDeLeitura() {
        BufferedImage img = new BufferedImage(640, 500, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, 640, 500);
        int k = 0;
        for (int row = 0; row < 3; row++) {
            for (int col = 0; col < 5; col++) {
                if (k == 14) break;
                g.setColor(GRID[k % GRID.length]);
                int size = k < 2 ? 40 : 90;                            // as duas primeiras são pequenas: ficam de fora
                g.fillRect(30 + col * 120, 20 + row * 160, size, size + 20);
                k++;
            }
        }
        g.dispose();
        List<LocalPieceRegions.Region> regions = LocalPieceRegions.detect(img);
        assertThat(regions).hasSize(12);
        for (int i = 1; i < regions.size(); i++) {
            LocalPieceRegions.Region a = regions.get(i - 1), b = regions.get(i);
            assertThat(b.y() > a.y() + 10 || b.x() > a.x()).as("ordem de leitura").isTrue();
        }
        assertThat(regions).allSatisfy(r -> { assertThat(r.width()).isBetween(12.0, 16.0); assertThat(r.height()).isBetween(20.0, 24.0); });
    }

    @Test
    void roupasSobreUmaCamaComTexturaViramCincoRegioesComASuaCor() {
        BufferedImage img = new BufferedImage(600, 450, BufferedImage.TYPE_INT_RGB);
        Random rnd = new Random(7);
        for (int y = 0; y < 450; y++) {
            for (int x = 0; x < 600; x++) {
                int n = rnd.nextInt(25) - 12, shade = (int) (10 * Math.sin(x / 40.0));
                img.setRGB(x, y, new Color(clamp(205 + n + shade), clamp(198 + n + shade), clamp(186 + n + shade)).getRGB());
            }
        }
        Graphics2D g = img.createGraphics();
        int[][] at = {{40, 40}, {230, 40}, {420, 40}, {130, 240}, {330, 240}};
        for (int i = 0; i < 5; i++) {
            g.setColor(PALETTE[i]);
            g.fillRect(at[i][0], at[i][1], 150, 170);
        }
        g.dispose();
        List<LocalPieceRegions.Region> regions = LocalPieceRegions.detect(img);
        assertThat(regions).hasSize(5);
        for (int i = 0; i < 5; i++) {
            LocalPieceRegions.Region r = regions.get(i);
            assertThat(PixelStats.distance(r.rgb(), PALETTE[i].getRGB() & 0xFFFFFF)).as("cor da peça " + i).isLessThan(10);
            assertThat(r.width()).isBetween(23.0, 27.5);
            assertThat(r.height()).isBetween(36.0, 40.5);
        }
    }

    @Test
    void corDominanteEAMaisFrequenteNaoAMediaEntreDuas() {
        int[] px = new int[100];
        int[] idx = new int[100];
        for (int i = 0; i < 100; i++) { px[i] = i < 70 ? 0xF0F0F0 : 0x101010; idx[i] = i; }
        assertThat(PixelStats.distance(PixelStats.dominant(px, idx, 100), 0xF0F0F0)).isLessThan(2);
    }

    private static int clamp(int v) {
        return Math.max(0, Math.min(255, v));
    }
}
