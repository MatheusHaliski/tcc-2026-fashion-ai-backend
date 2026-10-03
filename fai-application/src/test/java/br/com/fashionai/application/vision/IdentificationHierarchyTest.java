package br.com.fashionai.application.vision;

import br.com.fashionai.application.vision.ensemble.IdentificationHierarchy;
import br.com.fashionai.domain.model.enums.IdentificationLevel;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IdentificationHierarchyTest {
    @Test
    void marcaCertaNaoTornaOModeloCerto() {
        IdentificationHierarchy h = new IdentificationHierarchy()
                .put(IdentificationLevel.BRAND, "Nike", 0.95, List.of(), "ensemble")
                .put(IdentificationLevel.MODEL, "Air Max 90", 0.62, List.of(), "ocr").reconcile();
        assertThat(h.get(IdentificationLevel.BRAND).display()).isEqualTo(IdentificationHierarchy.Display.IDENTIFIED);
        assertThat(h.get(IdentificationLevel.MODEL).display()).isEqualTo(IdentificationHierarchy.Display.LIKELY);
        assertThat(h.get(IdentificationLevel.MODEL).needsReview()).isTrue();
        assertThat(h.get(IdentificationLevel.VARIANT).display()).isEqualTo(IdentificationHierarchy.Display.UNKNOWN);
    }

    @Test
    void modeloCertoSobeAMarcaPorConsistencia() {
        IdentificationHierarchy h = new IdentificationHierarchy()
                .put(IdentificationLevel.BRAND, "Tissot", 0.71, List.of(), "ensemble")
                .put(IdentificationLevel.MODEL, "PRX", 0.95, List.of(), "ocr").reconcile();
        assertThat(h.get(IdentificationLevel.BRAND).confidence()).isGreaterThanOrEqualTo(0.93);
    }
}
