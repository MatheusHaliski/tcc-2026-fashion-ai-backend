package br.com.fashionai.application.vision;

import br.com.fashionai.application.vision.capture.AdaptiveCaptureEngine;
import br.com.fashionai.application.vision.capture.AdaptiveCaptureEngine.Context;
import br.com.fashionai.application.vision.capture.AdaptiveCaptureEngine.Decision;
import br.com.fashionai.application.vision.capture.AdaptiveCaptureEngine.QualitySummary;
import br.com.fashionai.application.vision.capture.CaptureProfiles;
import br.com.fashionai.domain.model.enums.CaptureNeed;
import br.com.fashionai.domain.model.enums.CapturePurpose;
import br.com.fashionai.domain.model.enums.CaptureView;
import org.junit.jupiter.api.Test;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class AdaptiveCaptureEngineTest {
    private final AdaptiveCaptureEngine engine = new AdaptiveCaptureEngine();

    private static Map<VisionSignal, Double> conf(Object... kv) {
        Map<VisionSignal, Double> m = new EnumMap<>(VisionSignal.class);
        for (int i = 0; i < kv.length; i += 2) {
            m.put((VisionSignal) kv[i], (Double) kv[i + 1]);
        }
        return m;
    }

    private Decision decide(String sub, CaptureView primary, Map<VisionSignal, Double> c, Set<CaptureView> captured,
                            Set<CaptureView> skipped, boolean logo, boolean model) {
        return engine.decide(new Context(CaptureProfiles.resolve(null, sub), primary, c, captured, skipped, logo, model,
                QualitySummary.GOOD, captured.size() - 1, 0));
    }

    @Test
    void jeansComMarcaIncertaPedeATraseiraComForte() {
        Decision d = decide("jeans", CaptureView.FRONT_VIEW, conf(VisionSignal.BRAND, 0.31, VisionSignal.SUBCATEGORY, 0.9,
                VisionSignal.MATERIAL, 0.8), Set.of(CaptureView.FRONT_VIEW), Set.of(), false, false);
        assertThat(d.done()).isFalse();
        assertThat(d.next().view()).isEqualTo(CaptureView.BACK_VIEW);
        assertThat(d.next().purpose()).isEqualTo(CapturePurpose.BRAND_DISAMBIGUATION);
        assertThat(d.next().need()).isEqualTo(CaptureNeed.STRONGLY_RECOMMENDED);
        assertThat(d.next().reasonCode()).isEqualTo("logo_not_visible");
    }

    @Test
    void jeansAindaIncertoDepoisDaTraseiraPedeEtiqueta() {
        Decision d = decide("jeans", CaptureView.FRONT_VIEW, conf(VisionSignal.BRAND, 0.55, VisionSignal.SUBCATEGORY, 0.9,
                VisionSignal.MATERIAL, 0.8), Set.of(CaptureView.FRONT_VIEW, CaptureView.BACK_VIEW), Set.of(), true, false);
        assertThat(d.next().view()).isEqualTo(CaptureView.LABEL_DETAIL);
    }

    @Test
    void jeansIdentificadoTerminaSemPedido() {
        Decision d = decide("jeans", CaptureView.FRONT_VIEW, conf(VisionSignal.BRAND, 0.94, VisionSignal.SUBCATEGORY, 0.9,
                VisionSignal.MATERIAL, 0.8, VisionSignal.PATTERN, 0.7), Set.of(CaptureView.FRONT_VIEW, CaptureView.BACK_VIEW), Set.of(), true, false);
        assertThat(d.done()).isTrue();
        assertThat(d.doneReason()).isEqualTo(AdaptiveCaptureEngine.DoneReason.CONFIDENT);
    }

    @Test
    void tenisComMarcaCertaNaoPedeFotoParaModeloQueNinguemPediu() {
        Decision d = decide("casual_sneakers", CaptureView.THREE_QUARTER, conf(VisionSignal.BRAND, 0.98, VisionSignal.MODEL, 0.44,
                VisionSignal.SUBCATEGORY, 0.9, VisionSignal.MATERIAL, 0.7, VisionSignal.PATTERN, 0.6), Set.of(CaptureView.THREE_QUARTER), Set.of(), true, false);
        assertThat(d.done()).isTrue();
    }

    @Test
    void tenisComModeloDesejadoPedeEtiquetaDaLingua() {
        Decision d = decide("casual_sneakers", CaptureView.THREE_QUARTER, conf(VisionSignal.BRAND, 0.98, VisionSignal.MODEL, 0.44,
                VisionSignal.PRODUCT_LINE, 0.6, VisionSignal.SUBCATEGORY, 0.9, VisionSignal.MATERIAL, 0.7, VisionSignal.PATTERN, 0.6),
                Set.of(CaptureView.THREE_QUARTER), Set.of(), true, true);
        assertThat(d.next().view()).isEqualTo(CaptureView.TONGUE_LABEL);
        assertThat(d.next().purpose()).isEqualTo(CapturePurpose.MODEL_IDENTIFICATION);
    }

    @Test
    void tenisComLogoLateralPoucoVisivelPedeOOutroLado() {
        Decision d = decide("running_shoes", CaptureView.LEFT_SIDE, conf(VisionSignal.BRAND, 0.5, VisionSignal.SUBCATEGORY, 0.9,
                VisionSignal.MATERIAL, 0.7, VisionSignal.PATTERN, 0.6), Set.of(CaptureView.LEFT_SIDE), Set.of(), false, false);
        assertThat(d.next().view()).isEqualTo(CaptureView.RIGHT_SIDE);
        assertThat(d.next().reasonCode()).isEqualTo("other_side_branding");
    }

    @Test
    void relogioComMarcaProvavelPedeOVerso() {
        Decision d = decide("watch", CaptureView.WATCH_FACE, conf(VisionSignal.BRAND, 0.71, VisionSignal.SUBCATEGORY, 0.95,
                VisionSignal.MATERIAL, 0.7, VisionSignal.PATTERN, 0.6), Set.of(CaptureView.WATCH_FACE), Set.of(), true, false);
        assertThat(d.next().view()).isEqualTo(CaptureView.WATCH_BACK);
        assertThat(d.next().need()).isIn(CaptureNeed.RECOMMENDED, CaptureNeed.STRONGLY_RECOMMENDED);
    }

    @Test
    void oculosComMarcaIncertaPedeAHaste() {
        Decision d = decide("sunglasses", CaptureView.FRONT_VIEW, conf(VisionSignal.BRAND, 0.4, VisionSignal.SUBCATEGORY, 0.9,
                VisionSignal.MATERIAL, 0.7, VisionSignal.PATTERN, 0.6), Set.of(CaptureView.FRONT_VIEW), Set.of(), false, false);
        assertThat(d.next().view()).isEqualTo(CaptureView.TEMPLE_DETAIL);
    }

    @Test
    void camisetaConfiavelNaoPedeNada() {
        Decision d = decide("t_shirt", CaptureView.FRONT_VIEW, conf(VisionSignal.BRAND, 0.93, VisionSignal.SUBCATEGORY, 0.9,
                VisionSignal.MATERIAL, 0.8, VisionSignal.PATTERN, 0.7), Set.of(CaptureView.FRONT_VIEW), Set.of(), true, false);
        assertThat(d.done()).isTrue();
    }

    @Test
    void materialIncertoComMarcaCertaPedeTextura() {
        Decision d = decide("t_shirt", CaptureView.FRONT_VIEW, conf(VisionSignal.BRAND, 0.95, VisionSignal.SUBCATEGORY, 0.9,
                VisionSignal.MATERIAL, 0.41, VisionSignal.PATTERN, 0.7), Set.of(CaptureView.FRONT_VIEW), Set.of(), true, false);
        assertThat(d.next().view()).isEqualTo(CaptureView.TEXTURE_DETAIL);
        assertThat(d.next().purpose()).isEqualTo(CapturePurpose.MATERIAL_IDENTIFICATION);
    }

    @Test
    void fotoTremidaPedePrimeiroParaRefazerAPrincipal() {
        Decision d = engine.decide(new Context(CaptureProfiles.resolve(null, "jeans"), CaptureView.FRONT_VIEW,
                conf(VisionSignal.BRAND, 0.3), Set.of(CaptureView.FRONT_VIEW), Set.of(), false, false,
                new QualitySummary(38, false, List.of("blur")), 0, 0));
        assertThat(d.next().purpose()).isEqualTo(CapturePurpose.QUALITY_RETAKE);
        assertThat(d.next().view()).isEqualTo(CaptureView.FRONT_VIEW);
        assertThat(d.next().reasonCode()).isEqualTo("quality_retake:blur");
    }

    @Test
    void pularNaoRepeteAVistaEDoisPulosEncerram() {
        Decision d = decide("jeans", CaptureView.FRONT_VIEW, conf(VisionSignal.BRAND, 0.31), Set.of(CaptureView.FRONT_VIEW),
                Set.of(CaptureView.BACK_VIEW), false, false);
        assertThat(d.next().view()).isNotEqualTo(CaptureView.BACK_VIEW);
        Decision stop = engine.decide(new Context(CaptureProfiles.resolve(null, "jeans"), CaptureView.FRONT_VIEW,
                conf(VisionSignal.BRAND, 0.31), Set.of(CaptureView.FRONT_VIEW), Set.of(CaptureView.BACK_VIEW, CaptureView.LABEL_DETAIL),
                false, false, QualitySummary.GOOD, 0, 2));
        assertThat(stop.done()).isTrue();
        assertThat(stop.doneReason()).isEqualTo(AdaptiveCaptureEngine.DoneReason.USER_DECLINED);
    }

    @Test
    void limiteDeComplementaresEncerra() {
        Decision d = engine.decide(new Context(CaptureProfiles.resolve(null, "jeans"), CaptureView.FRONT_VIEW,
                conf(VisionSignal.BRAND, 0.2), Set.of(CaptureView.FRONT_VIEW), Set.of(), false, false, QualitySummary.GOOD, 3, 0));
        assertThat(d.doneReason()).isEqualTo(AdaptiveCaptureEngine.DoneReason.LIMIT_REACHED);
    }
}
