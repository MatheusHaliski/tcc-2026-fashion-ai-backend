package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;
import java.awt.Color;
import java.awt.Polygon;
import java.awt.image.BufferedImage;
import static org.assertj.core.api.Assertions.assertThat;

class LocalPieceRegionsTest {
    @Test
    void fiveSeparatedShirtsHaveSeparateBoxesIncludingLightFabric() {
        var photo = new BufferedImage(1000, 800, BufferedImage.TYPE_INT_RGB);
        var g = photo.createGraphics();
        g.setColor(new Color(190, 180, 165)); g.fillRect(0, 0, 1000, 800);
        Color[] colors = { Color.BLACK, Color.WHITE, new Color(20, 40, 80), new Color(125, 20, 30), new Color(55, 70, 25) };
        int[] left = { 50, 370, 690, 200, 550 }, top = { 50, 50, 50, 450, 450 };
        for (int i = 0; i < 5; i++) {
            int x = left[i], y = top[i];
            g.setColor(colors[i]);
            g.fillPolygon(new Polygon(new int[]{x, x + 65, x + 100, x + 135, x + 200, x + 240, x + 190, x + 190, x + 50, x + 50},
                    new int[]{y + 50, y, y + 20, y, y + 50, y + 100, y + 130, y + 270, y + 270, y + 130}, 10));
        }
        g.dispose();
        var regions = LocalPieceRegions.detect(photo);
        assertThat(regions).hasSize(5);
        for (int i = 0; i < 5; i++) {
            assertThat(regions.get(i).x()).isCloseTo(left[i] / 10.0, org.assertj.core.data.Offset.offset(1.0));
            assertThat(regions.get(i).y()).isCloseTo(top[i] / 8.0, org.assertj.core.data.Offset.offset(1.0));
            assertThat(regions.get(i).width()).isBetween(22.0, 26.0);
            assertThat(regions.get(i).height()).isBetween(31.0, 36.0);
        }
    }

    @Test
    void transparentBackgroundAndSpecklesDoNotProduceExtraGarments() {
        var photo = new BufferedImage(400, 400, BufferedImage.TYPE_INT_ARGB);
        var g = photo.createGraphics();
        g.setColor(Color.WHITE); g.fillRect(30, 40, 120, 160);
        g.setColor(Color.BLACK); g.fillRect(220, 180, 120, 160); g.fillRect(170, 50, 2, 2);
        g.dispose();
        assertThat(LocalPieceRegions.detect(photo)).hasSize(2);
    }

    @Test
    void texturedSceneAndBlankPhotoHaveNoConfidentLocalProposals() {
        var photo = new BufferedImage(400, 400, BufferedImage.TYPE_INT_RGB);
        assertThat(LocalPieceRegions.detect(photo)).isEmpty();
        for (int y = 0; y < 400; y++) for (int x = 0; x < 400; x++) {
            photo.setRGB(x, y, ((x / 10 + y / 10) % 2 == 0 ? Color.WHITE : Color.BLACK).getRGB());
        }
        assertThat(LocalPieceRegions.detect(photo)).isEmpty();
    }
}
