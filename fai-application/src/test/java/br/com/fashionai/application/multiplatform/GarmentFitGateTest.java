package br.com.fashionai.application.multiplatform;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** MP-2 — Gate de vestir: interseção, cobertura, folga, deformação em todas as poses; cor, estampa e logo autorizado. */
class GarmentFitGateTest {
    static Map<String, Object> good() {
        List<Map<String, Object>> poses = new ArrayList<>();
        for (String p : GarmentFitGate.REQUIRED_POSES) {
            poses.add(new HashMap<>(Map.of("name", p, "penetrationP99Mm", 0.6, "coverage", 0.995, "minEaseMm", 1.5,
                    "maxStretch", 1.04, "maxCompression", 0.97)));
        }
        Map<String, Object> m = new HashMap<>();
        m.put("poses", poses);
        m.put("colorDeltaE", 1.2);
        m.put("patternSsim", 0.93);
        return m;
    }

    @Test
    void passaComTodasAsPosesDentroDosLimites() {
        assertThat(GarmentFitGate.evaluate(good(), "NONE").passed()).isTrue();
    }

    @Test
    void reprovaInterpenetracaoPoseFaltandoECorDiferente() {
        Map<String, Object> m = good();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> poses = (List<Map<String, Object>>) m.get("poses");
        poses.get(0).put("penetrationP99Mm", 4.0);
        poses.remove(1);
        m.put("colorDeltaE", 6.0);
        GarmentFitGate.Result r = GarmentFitGate.evaluate(m, "NONE");
        assertThat(r.passed()).isFalse();
        assertThat(r.failures()).anyMatch(f -> f.endsWith("penetrationP99Mm"))
                .anyMatch(f -> f.startsWith("POSE_AUSENTE:"))
                .contains("FORA_DO_LIMITE:material.colorDeltaE");
    }

    @Test
    void logoSoComAutorizacao() {
        Map<String, Object> m = good();
        m.put("logoPresent", true);
        m.put("logoSsim", 0.97);
        assertThat(GarmentFitGate.evaluate(m, "PENDING").failures()).contains("LOGO_SEM_AUTORIZACAO");
        assertThat(GarmentFitGate.evaluate(m, "AUTHORIZED").passed()).isTrue();
    }

    @Test
    void semMetricasNuncaPassa() {
        assertThat(GarmentFitGate.evaluate(null, "NONE").failures()).containsExactly("SEM_METRICAS");
    }
}
