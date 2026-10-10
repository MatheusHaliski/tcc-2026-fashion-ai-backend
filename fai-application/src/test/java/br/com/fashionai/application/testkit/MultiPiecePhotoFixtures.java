package br.com.fashionai.application.testkit;

import java.awt.Color;
import java.awt.Polygon;
import java.awt.image.BufferedImage;

/** Synthetic flat-lay reproduction, not the user's original photograph. */
public final class MultiPiecePhotoFixtures {
    private MultiPiecePhotoFixtures() { }

    public static BufferedImage beddingWithFiveShirts() {
        var photo = new BufferedImage(1000, 800, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < photo.getHeight(); y++) for (int x = 0; x < photo.getWidth(); x++) {
            int light = (int) (203 + 12 * Math.sin(x / 90.0) + 9 * Math.sin((x + y) / 47.0)
                    + 5 * Math.sin((x - 2 * y) / 11.0));
            photo.setRGB(x, y, new Color(light, light - 2, light - 7).getRGB());
        }
        var g = photo.createGraphics();
        // Furniture and a shadow at the edges invalidate a uniform-border assumption.
        g.setColor(new Color(63, 47, 29)); g.fillRect(0, 0, 35, 800);
        g.setColor(new Color(132, 116, 97)); g.fillRect(945, 0, 55, 800);
        g.setColor(new Color(110, 106, 97)); g.fillRect(35, 0, 910, 24);
        Color[] colors = { new Color(20, 20, 20), new Color(242, 242, 242), new Color(27, 42, 74),
                new Color(107, 18, 32), new Color(110, 122, 60) };
        int[] left = { 45, 335, 625, 150, 540 }, top = { 90, 90, 90, 435, 435 };
        for (int i = 0; i < colors.length; i++) {
            int[] xs = { 0, 65, 100, 135, 200, 240, 190, 190, 50, 50 };
            int[] ys = { 50, 0, 20, 0, 50, 100, 130, 270, 270, 130 };
            for (int j = 0; j < xs.length; j++) {
                xs[j] = left[i] + (int) (xs[j] * 1.15); ys[j] = top[i] + (int) (ys[j] * 1.15);
            }
            g.setColor(colors[i]); g.fillPolygon(new Polygon(xs, ys, xs.length));
        }
        g.dispose();
        return photo;
    }
}
