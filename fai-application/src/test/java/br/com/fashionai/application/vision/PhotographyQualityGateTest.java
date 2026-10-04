package br.com.fashionai.application.vision;

import br.com.fashionai.application.vision.capture.CaptureProfiles;
import br.com.fashionai.application.vision.quality.PhotographyQualityGate;
import br.com.fashionai.application.vision.quality.PhotographyQualityGate.Signals;
import br.com.fashionai.domain.model.enums.CaptureView;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class PhotographyQualityGateTest {
    private final PhotographyQualityGate gate = new PhotographyQualityGate();

    @Test
    void fotoBoaPassa() {
        PhotographyQualityGate.Report r = gate.evaluate(CaptureProfiles.get("PANTS"), CaptureView.FRONT_VIEW,
                new Signals(3000, 4000, 0.9, 0.9, 0.55, Set.of(), 1.0, 0.9, true, 0.0, 0.9, true));
        assertThat(r.score()).isGreaterThanOrEqualTo(90);
        assertThat(r.decision()).isEqualTo(PhotographyQualityGate.Decision.ACCEPT);
    }

    @Test
    void barraCortadaNaCalcaOrientaSemRecusar() {
        PhotographyQualityGate.Report r = gate.evaluate(CaptureProfiles.get("PANTS"), CaptureView.FRONT_VIEW,
                new Signals(3000, 4000, 0.9, 0.9, 0.7, Set.of("bottom"), 1.0, 0.9, true, 0.0, 0.9, true));
        assertThat(r.mandatoryRegionClipped()).isTrue();
        assertThat(r.clippedRegions()).containsExactly("hems");
        assertThat(r.decision()).isNotEqualTo(PhotographyQualityGate.Decision.ACCEPT);
        assertThat(r.failing()).contains("clipping");
    }

    @Test
    void fotoEscuraETremidaSugereRefazer() {
        PhotographyQualityGate.Report r = gate.evaluate(CaptureProfiles.get("TSHIRT"), CaptureView.FRONT_VIEW,
                new Signals(640, 480, 0.05, 0.1, 0.5, Set.of(), 2.0, 0.9, false, 40.0, 0.3, false));
        assertThat(r.decision()).isEqualTo(PhotographyQualityGate.Decision.RETAKE_SUGGESTED);
        assertThat(r.failing()).contains("blur", "lighting");
    }

    @Test
    void etiquetaEncostandoNaBordaNaoEPunida() {
        PhotographyQualityGate.Report r = gate.evaluate(CaptureProfiles.get("PANTS"), CaptureView.LABEL_DETAIL,
                new Signals(2000, 2000, 0.8, 0.8, 1.0, Set.of("top", "bottom", "left", "right"), null, null, null, null, null, null));
        assertThat(r.mandatoryRegionClipped()).isFalse();
        assertThat(r.decision()).isEqualTo(PhotographyQualityGate.Decision.ACCEPT);
    }
}
