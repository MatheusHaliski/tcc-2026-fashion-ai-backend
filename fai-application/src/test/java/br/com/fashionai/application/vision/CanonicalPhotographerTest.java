package br.com.fashionai.application.vision;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.vision.canonical.CanonicalPhotographer;
import br.com.fashionai.application.vision.landmarks.LandmarkDetector;
import br.com.fashionai.application.vision.spec.PhotographySpec;
import br.com.fashionai.application.vision.spec.PhotographySpecs;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class CanonicalPhotographerTest {
    private final CanonicalPhotographer photographer = new CanonicalPhotographer();
    private final LandmarkDetector detector = new LandmarkDetector();

    @Test
    void calcaFrontalOcupaACoberturaAlvoCentralizadaEMantemProporcao() {
        BufferedImage pants = ImageOps.scale(Shapes.pants(new Color(30, 60, 160)), 800, 1600);
        PhotographySpec spec = PhotographySpecs.get("PANTS_FRONT_V1");
        CanonicalPhotographer.Result r = photographer.render(pants, spec, detector.detect(pants, "PANTS"), List.of());
        assertThat(r.image().getWidth()).isEqualTo(1600);
        assertThat(r.image().getHeight()).isEqualTo(2000);
        ImageOps.Box b = ImageOps.alphaBounds(r.image());
        assertThat(b.h() / 2000.0).isCloseTo(0.9, within(0.02));
        assertThat(b.x() + b.w() / 2.0).isCloseTo(800, within(4.0));
        assertThat(b.y() + b.h() / 2.0).isCloseTo(1000, within(4.0));
        assertThat(b.w() / (double) b.h()).isCloseTo(240 / 720.0, within(0.01));
        assertThat(r.report().compliant()).isTrue();
        assertThat(r.report().toMap()).containsEntry("generative", false);
    }

    @Test
    void naoInventaCoresNemTexturas() {
        Color c = new Color(200, 40, 70);
        BufferedImage pants = Shapes.pants(c);
        CanonicalPhotographer.Result r = photographer.render(pants, PhotographySpecs.get("PANTS_FRONT_V1"), null, List.of());
        BufferedImage img = r.image();
        int opaque = 0;
        for (int y = 0; y < img.getHeight(); y += 7) {
            for (int x = 0; x < img.getWidth(); x += 7) {
                int p = img.getRGB(x, y);
                if ((p >>> 24) == 255) {
                    opaque++;
                    assertThat(Math.abs((p >> 16 & 0xFF) - c.getRed())).isLessThanOrEqualTo(2);
                    assertThat(Math.abs((p >> 8 & 0xFF) - c.getGreen())).isLessThanOrEqualTo(2);
                    assertThat(Math.abs((p & 0xFF) - c.getBlue())).isLessThanOrEqualTo(2);
                }
            }
        }
        assertThat(opaque).isGreaterThan(1000);
    }

    @Test
    void endireitaPequenaInclinacaoPelaCintura() {
        BufferedImage tilted = ImageOps.rotate(ImageOps.scale(Shapes.pants(Color.BLUE), 800, 1600), 5);
        LandmarkDetector.Result lm = detector.detect(tilted, "PANTS");
        CanonicalPhotographer.Result r = photographer.render(tilted, PhotographySpecs.get("PANTS_FRONT_V1"), lm, List.of());
        assertThat(Math.abs(r.report().rotationDeg())).isBetween(2.0, 8.0);
    }

    @Test
    void calcadoAlinhaPelaSolaEFaltandoLandmarkFicaNaoConforme() {
        BufferedImage shoe = Shapes.sneakerToeLeft(Color.WHITE);
        PhotographySpec spec = PhotographySpecs.get("SNEAKER_SIDE_V1");
        CanonicalPhotographer.Result r = photographer.render(shoe, spec, null, List.of("sole"));
        ImageOps.Box b = ImageOps.alphaBounds(r.image());
        double baseline = spec.canvasHeight() * (1 - spec.padding() - 0.06);
        assertThat(b.y() + b.h()).isCloseTo((int) baseline, within(3));
        assertThat(r.report().compliant()).isFalse();
        assertThat(r.report().missingLandmarks()).contains("toe", "heel");
        assertThat(r.report().clippedRegions()).containsExactly("sole");
    }

    @Test
    void naoAmpliaAlemDoLimite() {
        BufferedImage tiny = Shapes.canvas(60, 60);
        Graphics2D g = tiny.createGraphics();
        g.setColor(Color.BLACK);
        g.fillRect(10, 10, 40, 40);
        g.dispose();
        CanonicalPhotographer.Result r = photographer.render(tiny, PhotographySpecs.get(PhotographySpecs.GENERIC_FRONT), null, List.of());
        assertThat(r.report().upscaleLimited()).isTrue();
        assertThat(ImageOps.alphaBounds(r.image()).w()).isEqualTo(80);
    }

    @Test
    void detalheDeLogoETexturaSaoRecortesDaPropriaPeca() {
        BufferedImage shirt = Shapes.tshirt(Color.GREEN);
        CanonicalPhotographer.Result logo = photographer.detail(shirt, PhotographySpecs.get(PhotographySpecs.LOGO_DETAIL),
                new double[]{0.30, 0.30, 0.40, 0.36});
        assertThat(logo).isNotNull();
        assertThat(logo.image().getWidth()).isEqualTo(1200);
        CanonicalPhotographer.Result texture = photographer.detail(shirt, PhotographySpecs.get(PhotographySpecs.TEXTURE_DETAIL), null);
        assertThat(texture).isNotNull();
        int center = texture.image().getRGB(512, 512);
        assertThat(center & 0xFFFFFF).isEqualTo(Color.GREEN.getRGB() & 0xFFFFFF);
        assertThat(photographer.detail(shirt, PhotographySpecs.get(PhotographySpecs.LOGO_DETAIL), null)).isNull();
    }
}
