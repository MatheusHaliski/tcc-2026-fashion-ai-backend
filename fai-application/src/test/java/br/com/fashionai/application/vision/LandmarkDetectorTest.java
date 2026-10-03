package br.com.fashionai.application.vision;

import br.com.fashionai.application.vision.landmarks.LandmarkDetector;
import org.junit.jupiter.api.Test;

import java.awt.Color;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class LandmarkDetectorTest {
    private final LandmarkDetector detector = new LandmarkDetector();

    @Test
    void calcaTemCinturaGanchoEDuasBarras() {
        LandmarkDetector.Result r = detector.detect(Shapes.pants(Color.BLUE), "PANTS");
        assertThat(r.has("crotch")).isTrue();
        assertThat(r.get("crotch").y()).isCloseTo(300 / 800.0, within(0.04));
        assertThat(r.get("crotch").x()).isCloseTo(200 / 400.0, within(0.04));
        assertThat(r.get("left_hem").x()).isLessThan(0.5);
        assertThat(r.get("right_hem").x()).isGreaterThan(0.5);
        assertThat(r.get("left_hem").y()).isCloseTo(760 / 800.0, within(0.03));
        assertThat(r.get("waistband_center").y()).isCloseTo(40 / 800.0, within(0.03));
        assertThat(r.model().name()).isEqualTo("pants-landmarks");
    }

    @Test
    void camisetaTemDecoteOmbrosAxilasEBarra() {
        LandmarkDetector.Result r = detector.detect(Shapes.tshirt(Color.RED), "UPPER");
        assertThat(r.get("neckline_center").x()).isCloseTo(0.5, within(0.05));
        assertThat(r.get("neckline_center").y()).isGreaterThan(80 / 600.0);
        assertThat(r.has("left_armpit")).isTrue();
        assertThat(r.get("left_armpit").y()).isCloseTo(240 / 600.0, within(0.04));
        assertThat(r.get("left_shoulder").x()).isCloseTo(150 / 600.0, within(0.04));
        assertThat(r.get("hem_center").y()).isCloseTo(560 / 600.0, within(0.03));
        assertThat(r.has("left_sleeve_end")).isTrue();
    }

    @Test
    void tenisDescobreOLadoDoBico() {
        LandmarkDetector.Result r = detector.detect(Shapes.sneakerToeLeft(Color.WHITE), "FOOTWEAR");
        assertThat(r.get("toe").x()).isLessThan(0.2);
        assertThat(r.get("heel").x()).isGreaterThan(0.8);
        assertThat(r.meta()).containsEntry("toeDirection", "left");
    }

    @Test
    void recorteVazioNaoInventaPontos() {
        assertThat(detector.detect(Shapes.canvas(50, 50), "PANTS").landmarks()).isEmpty();
    }
}
