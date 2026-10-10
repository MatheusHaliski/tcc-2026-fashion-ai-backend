package br.com.fashionai.application.imaging;

import br.com.fashionai.application.testkit.MultiPiecePhotoFixtures;
import org.junit.jupiter.api.Test;
import java.awt.Color;
import java.awt.Polygon;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import static org.assertj.core.api.Assertions.assertThat;

class LocalPieceRegionsTest {
    private static void drawShirt(Graphics2D g, int x, int y, Color color, double scale) {
        int[] xs = { 0, 65, 100, 135, 200, 240, 190, 190, 50, 50 };
        int[] ys = { 50, 0, 20, 0, 50, 100, 130, 270, 270, 130 };
        for (int i = 0; i < xs.length; i++) { xs[i] = x + (int) (xs[i] * scale); ys[i] = y + (int) (ys[i] * scale); }
        g.setColor(color); g.fillPolygon(new Polygon(xs, ys, xs.length));
    }

    @Test
    void unevenBeddingAndFurnitureDoNotCollapseFiveShirtsIntoTheEntirePhoto() {
        var regions = LocalPieceRegions.detect(MultiPiecePhotoFixtures.beddingWithFiveShirts());
        assertThat(regions).hasSize(5);
        assertThat(regions).allSatisfy(region -> {
            assertThat(region.width()).isBetween(24.0, 30.0);
            assertThat(region.height()).isBetween(36.0, 42.0);
            assertThat(region.x()).isGreaterThan(3.0);
            assertThat(region.x() + region.width()).isLessThan(94.5);
        });
        // Light fabric remains a separate region rather than becoming part of the sheet.
        assertThat(regions).anySatisfy(region -> assertThat((region.rgb() >> 16) & 255).isGreaterThan(230));
    }

    @Test
    void jpegCompressionDoesNotCollapseOrMultiplyTheFabricRegions() {
        var compressed = ImageOps.decode(ImageOps.jpeg(MultiPiecePhotoFixtures.beddingWithFiveShirts(), .82f));
        assertThat(LocalPieceRegions.detect(compressed)).hasSize(5);
    }

    @Test
    void sleevesTouchingAcrossDifferentFabricColorsRemainSeparateRegions() {
        var photo = new BufferedImage(500, 400, BufferedImage.TYPE_INT_RGB);
        var g = photo.createGraphics();
        g.setColor(new Color(215, 210, 200)); g.fillRect(0, 0, 500, 400);
        drawShirt(g, 25, 50, new Color(107, 18, 32), 1.0);
        drawShirt(g, 225, 50, new Color(27, 42, 74), 1.0);
        g.dispose();
        var regions = LocalPieceRegions.detect(photo);
        assertThat(regions).hasSize(2);
        assertThat(regions.get(0).width()).isLessThan(55.0);
        assertThat(regions.get(1).width()).isLessThan(55.0);
    }

    @Test
    void onePrintedShirtDoesNotBecomeSeveralGarments() {
        var photo = new BufferedImage(500, 400, BufferedImage.TYPE_INT_RGB);
        var g = photo.createGraphics();
        g.setColor(new Color(215, 210, 200)); g.fillRect(0, 0, 500, 400);
        var shirt = new Polygon(new int[]{125,190,225,260,325,365,315,315,175,175},
                new int[]{100,50,70,50,100,150,180,320,320,180}, 10);
        g.setColor(new Color(107, 18, 32)); g.fillPolygon(shirt);
        g.setClip(shirt);
        g.setColor(new Color(27, 42, 74)); g.fillRect(240, 45, 140, 280);
        g.setColor(new Color(242, 242, 242)); g.fillRect(190, 140, 100, 100);
        g.dispose();
        assertThat(LocalPieceRegions.detect(photo)).hasSize(1);
    }

    @Test
    void lowContrastFabricDoesNotInventInvisibleObjectBoundaries() {
        var photo = new BufferedImage(500, 400, BufferedImage.TYPE_INT_RGB);
        var g = photo.createGraphics();
        g.setColor(Color.WHITE); g.fillRect(0, 0, 500, 400);
        drawShirt(g, 125, 50, Color.WHITE, 1.0);
        g.dispose();
        assertThat(LocalPieceRegions.detect(photo)).isEmpty();
    }

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
