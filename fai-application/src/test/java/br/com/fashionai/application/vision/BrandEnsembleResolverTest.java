package br.com.fashionai.application.vision;

import br.com.fashionai.application.vision.ensemble.BrandEnsembleResolver;
import br.com.fashionai.application.vision.ensemble.BrandEnsembleResolver.Evidence;
import br.com.fashionai.application.vision.ensemble.BrandEnsembleResolver.Resolution;
import br.com.fashionai.application.vision.ensemble.BrandEnsembleResolver.Signal;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BrandEnsembleResolverTest {
    private final BrandEnsembleResolver resolver = new BrandEnsembleResolver();

    private static Evidence ev(Signal s, String brand, double c, String detail) {
        return new Evidence(s, brand, c, detail, "FRONT_VIEW", "test@1");
    }

    @Test
    void lacosteComVariosSinaisFicaConfiavelEComEvidencias() {
        Resolution r = resolver.resolve(List.of(
                ev(Signal.LOGO_DETECTION, "Lacoste", 0.95, "crocodilo no peito esquerdo"),
                ev(Signal.SIGNATURE_PATTERN, "Lacoste", 1.0, "posição do logo consistente"),
                ev(Signal.VISUAL_EMBEDDING, "Lacoste", 0.7, "3 de 5 vizinhos"),
                ev(Signal.OCR_PARTIAL, "LACOSTE", 1.0, "leitura parcial \"LACOS\"")));
        assertThat(r.brand()).isEqualTo("Lacoste");
        assertThat(r.confidence()).isGreaterThan(0.9);
        assertThat(r.alternatives()).isEmpty();
        assertThat(r.toMap().get("evidence")).asList().hasSize(4);
    }

    @Test
    void duasMarcasProximasViramAlternativasSemEsconderIncerteza() {
        Resolution r = resolver.resolve(List.of(
                ev(Signal.VISION_MODEL, "Lacoste", 0.85, "crocodilo"),
                ev(Signal.VISION_MODEL, "Izod", 0.45, "crocodilo semelhante")));
        assertThat(r.brand()).isEqualTo("Lacoste");
        assertThat(r.confidence()).isBetween(0.4, 0.7);
        assertThat(r.alternatives()).extracting(BrandEnsembleResolver.Candidate::brand).containsExactly("Izod");
        assertThat(r.otherMass()).isGreaterThan(0.1);
    }

    @Test
    void etiquetaLidaVenceVizinhoVisual() {
        Resolution r = resolver.resolve(List.of(
                ev(Signal.VISUAL_EMBEDDING, "Wrangler", 0.9, "vizinho"),
                ev(Signal.LABEL_RECOGNITION, "Levi's", 0.95, "etiqueta interna")));
        assertThat(r.brand()).isEqualTo("Levi's");
    }

    @Test
    void grafiasDiferentesSaoAMesmaMarca() {
        assertThat(BrandEnsembleResolver.canonical("Levi’s")).isEqualTo(BrandEnsembleResolver.canonical("LEVIS"));
        Resolution r = resolver.resolve(List.of(ev(Signal.OCR_CONFIRMED, "LEVIS", 1, "ocr"), ev(Signal.VISION_MODEL, "Levi's", 0.8, "ia")));
        assertThat(r.alternatives()).isEmpty();
    }

    @Test
    void semEvidenciaNaoInventaMarca() {
        assertThat(resolver.resolve(List.of()).brand()).isNull();
    }
}
