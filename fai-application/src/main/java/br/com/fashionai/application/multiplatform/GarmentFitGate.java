package br.com.fashionai.application.multiplatform;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * MP-2 — Gate de vestir de um asset 3D de roupa. Um asset só pode ir para revisão humana (e depois ser aprovado) se as
 * métricas medidas no corpo de referência, em todas as poses de teste, ficarem dentro dos limites. As métricas são
 * produzidas pela ferramenta de importação (Unreal/DCC) e enviadas em {@code metrics_json}:
 * <pre>
 * { "poses": [ { "name": "A_POSE", "penetrationP99Mm": 0.8, "coverage": 0.995, "minEaseMm": 2.0,
 *                "maxStretch": 1.03, "maxCompression": 0.97 }, ... ],
 *   "colorDeltaE": 1.6, "patternSsim": 0.93, "logoPresent": true, "logoSsim": 0.95 }
 * </pre>
 * Os limites são a proposta inicial do plano (docs/multiplataforma/03-avatar-e-provador.md) e devem ser calibrados com
 * assets reais antes de serem tratados como critério final.
 */
public final class GarmentFitGate {
    /** Poses mínimas: parado, andando, sentado, braços para cima, girando o tronco. */
    public static final Set<String> REQUIRED_POSES = Set.of("A_POSE", "WALK", "SIT", "ARMS_UP", "TWIST");
    public static final double MAX_PENETRATION_P99_MM = 1.5;
    public static final double MIN_COVERAGE = 0.98;
    public static final double MIN_EASE_MM = 0.0;
    public static final double MAX_STRETCH = 1.10;
    public static final double MIN_COMPRESSION = 0.90;
    public static final double MAX_COLOR_DELTA_E = 3.0;
    public static final double MIN_PATTERN_SSIM = 0.85;
    public static final double MIN_LOGO_SSIM = 0.90;

    private GarmentFitGate() {
    }

    public record Result(boolean passed, List<String> failures) {
        public Map<String, Object> view() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("passed", passed);
            m.put("failures", failures);
            return m;
        }
    }

    public static Result evaluate(Map<String, Object> metrics, String logoAuthorization) {
        List<String> fail = new ArrayList<>();
        if (metrics == null || metrics.isEmpty()) {
            return new Result(false, List.of("SEM_METRICAS"));
        }
        List<String> seen = new ArrayList<>();
        if (metrics.get("poses") instanceof List<?> poses) {
            for (Object o : poses) {
                if (!(o instanceof Map<?, ?> p)) {
                    continue;
                }
                String name = String.valueOf(p.get("name"));
                seen.add(name);
                check(fail, name, "penetrationP99Mm", p.get("penetrationP99Mm"), v -> v <= MAX_PENETRATION_P99_MM);
                check(fail, name, "coverage", p.get("coverage"), v -> v >= MIN_COVERAGE);
                check(fail, name, "minEaseMm", p.get("minEaseMm"), v -> v >= MIN_EASE_MM);
                check(fail, name, "maxStretch", p.get("maxStretch"), v -> v <= MAX_STRETCH);
                check(fail, name, "maxCompression", p.get("maxCompression"), v -> v >= MIN_COMPRESSION);
            }
        }
        for (String required : REQUIRED_POSES.stream().sorted().toList()) {
            if (!seen.contains(required)) {
                fail.add("POSE_AUSENTE:" + required);
            }
        }
        check(fail, "material", "colorDeltaE", metrics.get("colorDeltaE"), v -> v <= MAX_COLOR_DELTA_E);
        check(fail, "material", "patternSsim", metrics.get("patternSsim"), v -> v >= MIN_PATTERN_SSIM);
        if (Boolean.TRUE.equals(metrics.get("logoPresent"))) {
            if (!"AUTHORIZED".equals(logoAuthorization)) {
                fail.add("LOGO_SEM_AUTORIZACAO");
            }
            check(fail, "material", "logoSsim", metrics.get("logoSsim"), v -> v >= MIN_LOGO_SSIM);
        }
        return new Result(fail.isEmpty(), fail);
    }

    private static void check(List<String> fail, String where, String metric, Object value, java.util.function.DoublePredicate ok) {
        if (!(value instanceof Number n)) {
            fail.add("METRICA_AUSENTE:" + where + "." + metric);
        } else if (!ok.test(n.doubleValue())) {
            fail.add("FORA_DO_LIMITE:" + where + "." + metric);
        }
    }
}
