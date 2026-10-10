package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.util.Set;
import static org.assertj.core.api.Assertions.assertThat;

class GarmentCropTest {
    @Test
    void holesAndTranslucentEdgesNeverEnterTheFabricFrame() {
        BufferedImage garment = new BufferedImage(500, 600, BufferedImage.TYPE_INT_ARGB);
        var g = garment.createGraphics();
        g.setColor(new Color(0x38577a)); g.fillRect(50, 30, 400, 540);
        g.setColor(new Color(0x38577a, true)); // fully transparent pixels, same RGB as fabric
        g.fillRect(190, 30, 120, 110); g.dispose();
        garment.setRGB(200, 300, 0x8038577a);
        var box = GarmentCrop.find(garment, 4, 5, 250, 200).orElseThrow();
        assertThat(box.w() * 5).isEqualTo(box.h() * 4);
        assertOpaque(garment, box);
        BufferedImage rendered = GarmentCrop.render(garment, box, 400, 500);
        assertOpaque(rendered, new ImageOps.Box(0, 0, 400, 500));
        assertThat(rendered.getRGB(10, 10) & 0xffffff).isEqualTo(0x38577a);
    }

    @Test
    void pantsUseBothHipsInsteadOfTheLargestSingleLeg() {
        BufferedImage pants = FeedFramingTest.pants(1, 400, 250, 900, 170, false);
        var feed = FeedFraming.frame(pants, FeedFraming.Template.PANTS, Set.of());
        assertThat(feed.fabricCrop()).isNotNull();
        var box = feed.fabricCrop();
        assertThat(box.w()).isGreaterThan((int) (pants.getWidth() * 0.75));
        assertThat(box.y() + box.h()).isLessThan(260);
        assertThat(feed.toMap()).containsEntry("aspect", "2:1").containsEntry("foregroundCoverage", 1.0);
        assertThat(feed.frame().width()).isEqualTo(2 * feed.frame().height());
        assertOpaque(pants, box);
    }

    @Test
    void shirtFrameContainsNoNecklineOrSleeveBackgroundAndKeepsTheSource() {
        BufferedImage shirt = FeedFramingTest.tee(1, 420, 600, 180, 0.45, 0, new Color(0x38577a));
        int[] before = shirt.getRGB(0, 0, shirt.getWidth(), shirt.getHeight(), null, 0, shirt.getWidth());
        var feed = FeedFraming.frame(shirt, FeedFraming.Template.TOP, Set.of());
        assertThat(feed.toMap()).containsEntry("mode", "GARMENT_COVER").containsEntry("aspect", "4:5");
        assertOpaque(shirt, feed.fabricCrop());
        assertThat(shirt.getRGB(0, 0, shirt.getWidth(), shirt.getHeight(), null, 0, shirt.getWidth())).containsExactly(before);
    }

    @Test
    void tinyOrEmptyFabricIsNotPresentedAsACompleteFrame() {
        BufferedImage empty = new BufferedImage(200, 200, BufferedImage.TYPE_INT_ARGB);
        assertThat(GarmentCrop.find(empty, 4, 5, 100, 100)).isEmpty();
        var g = empty.createGraphics(); g.setColor(Color.BLUE); g.fillRect(90, 80, 10, 15); g.dispose();
        assertThat(GarmentCrop.find(empty, 4, 5, 100, 100)).isEmpty();
    }

    private static void assertOpaque(BufferedImage image, ImageOps.Box box) {
        for (int y = box.y(); y < box.y() + box.h(); y++) {
            for (int x = box.x(); x < box.x() + box.w(); x++) {
                if ((image.getRGB(x, y) >>> 24) < 250) throw new AssertionError("background at " + x + "," + y);
            }
        }
    }
}
