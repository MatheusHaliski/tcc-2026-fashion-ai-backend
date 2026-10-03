package br.com.fashionai.application.vision.capture;

import br.com.fashionai.application.vision.ModelRef;
import br.com.fashionai.application.vision.VisionSignal;
import br.com.fashionai.application.vision.capture.CaptureProfile.Condition;
import br.com.fashionai.application.vision.capture.CaptureProfile.SecondaryView;
import br.com.fashionai.domain.model.enums.CaptureNeed;
import br.com.fashionai.domain.model.enums.CapturePurpose;
import br.com.fashionai.domain.model.enums.CaptureView;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * RF4 · Adaptive Capture Engine — decide se outra foto deve ser pedida e qual seria a mais informativa.
 * <p>
 * Para cada vista complementar útil do perfil, ainda não capturada nem pulada:
 * <pre>
 *   gain(v)  = Σ importância(s) × incerteza(s) × informs(v, s) × modificadorDeVisibilidade(v)
 *   incerteza(s) = max(0, alvo(s) − confiança(s)) / alvo(s)        (marca ≥ 0,90 → incerteza zero)
 *   score(v) = gain(v) / esforço(v)
 * </pre>
 * Pede a de maior score acima de {@link Thresholds#minScore()}. Foto principal com qualidade ruim gera antes um
 * QUALITY_RETAKE (uma principal melhor melhora todos os sinais). Nenhum pedido bloqueia: todos têm "Pular".
 * Função pura e determinística (testável); a política tem nome e versão no Model Registry.
 */
public final class AdaptiveCaptureEngine {
    public static final ModelRef MODEL = ModelRef.CAPTURE_POLICY;

    /** Limiares da política (padrões da v1; sobrescrevíveis por {@code fashionai.capture.*}). */
    public record Thresholds(double brandTarget, double brandRequestBelow, double subcategoryTarget, double materialTarget,
                             double patternTarget, double modelTarget, double minScore, double recommendScore,
                             int maxComplementary, int maxConsecutiveSkips, int retakeQualityBelow) {
        public static final Thresholds DEFAULTS = new Thresholds(0.90, 0.60, 0.75, 0.60, 0.50, 0.80, 0.08, 0.15, 3, 2, 50);
    }

    /** Qualidade da foto principal resumida pelo {@code PhotographyQualityGate}. */
    public record QualitySummary(int score, boolean mandatoryRegionClipped, List<String> failing) {
        public static final QualitySummary GOOD = new QualitySummary(100, false, List.of());
    }

    /**
     * @param confidence         confiança atual por sinal (ausente = 0, desconhecido)
     * @param captured           vistas já fotografadas (inclui a vista real da principal)
     * @param skipped            vistas que a pessoa pulou (não pedimos de novo)
     * @param logoVisible        algum logo/texto de marca visível nas fotos atuais
     * @param identifyModel      a pessoa (ou o produto) quer identificar o modelo exato
     * @param complementaryCount fotos complementares já recebidas (retakes não contam)
     * @param consecutiveSkips   pulos seguidos — dois seguidos = a pessoa não quer mais fotos
     */
    public record Context(CaptureProfile profile, CaptureView primaryView, Map<VisionSignal, Double> confidence,
                          Set<CaptureView> captured, Set<CaptureView> skipped, boolean logoVisible, boolean identifyModel,
                          QualitySummary quality, int complementaryCount, int consecutiveSkips) {
        double conf(VisionSignal s) {
            Double c = confidence.get(s);
            return c == null ? 0 : c;
        }
    }

    /** Uma foto sugerida, com o porquê (explicável na tela e auditável). */
    public record Recommendation(CaptureView view, CapturePurpose purpose, CaptureNeed need, String reasonCode,
                                 double expectedGain, double score, VisionSignal dominantSignal,
                                 Map<VisionSignal, Double> gainBySignal, List<String> tips) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("view", view.name());
            m.put("purpose", purpose.name());
            m.put("need", need.name());
            m.put("reasonCode", reasonCode);
            m.put("expectedGain", round(expectedGain));
            m.put("score", round(score));
            m.put("dominantSignal", dominantSignal == null ? null : dominantSignal.name());
            Map<String, Double> g = new LinkedHashMap<>();
            gainBySignal.forEach((k, v) -> g.put(k.name(), round(v)));
            m.put("gainBySignal", g);
            m.put("tips", tips);
            m.put("skippable", true);
            return m;
        }
    }

    public enum DoneReason { CONFIDENT, LIMIT_REACHED, USER_DECLINED, NO_USEFUL_VIEW }

    public record Decision(Recommendation next, List<Recommendation> alternatives, boolean done, DoneReason doneReason,
                           String policy) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("next", next == null ? null : next.toMap());
            m.put("alternatives", alternatives.stream().map(Recommendation::toMap).toList());
            m.put("done", done);
            m.put("doneReason", doneReason == null ? null : doneReason.name());
            m.put("policy", policy);
            return m;
        }
    }

    private final Thresholds t;

    public AdaptiveCaptureEngine() {
        this(Thresholds.DEFAULTS);
    }

    public AdaptiveCaptureEngine(Thresholds thresholds) {
        this.t = thresholds;
    }

    public Thresholds thresholds() {
        return t;
    }

    public Decision decide(Context c) {
        String policy = MODEL.key() + "/" + CaptureProfiles.VERSION;
        // 1. principal ruim: refazer antes de qualquer complementar (se a pessoa já não pulou o refazer)
        boolean retakeSkipped = c.skipped().contains(c.primaryView());
        if (!retakeSkipped && (c.quality().score() < t.retakeQualityBelow() || c.quality().mandatoryRegionClipped())) {
            String criterion = c.quality().failing().isEmpty() ? "quality" : c.quality().failing().get(0);
            Recommendation retake = new Recommendation(c.primaryView(), CapturePurpose.QUALITY_RETAKE, CaptureNeed.RECOMMENDED,
                    "quality_retake:" + criterion, 1 - c.quality().score() / 100.0, 1 - c.quality().score() / 100.0, null,
                    Map.of(), c.quality().failing());
            return new Decision(retake, List.of(), false, null, policy);
        }
        if (c.consecutiveSkips() >= t.maxConsecutiveSkips()) {
            return new Decision(null, List.of(), true, DoneReason.USER_DECLINED, policy);
        }
        if (c.complementaryCount() >= t.maxComplementary()) {
            return new Decision(null, List.of(), true, DoneReason.LIMIT_REACHED, policy);
        }
        List<Recommendation> ranked = new ArrayList<>();
        boolean anyUncertain = false;
        for (VisionSignal s : VisionSignal.values()) {
            if (importance(c, s) > 0 && uncertainty(c, s) > 0) {
                anyUncertain = true;
            }
        }
        for (SecondaryView sv : c.profile().secondaryViews()) {
            if (c.captured().contains(sv.view()) || c.skipped().contains(sv.view()) || !conditionHolds(c, sv)) {
                continue;
            }
            Map<VisionSignal, Double> bySignal = new EnumMap<>(VisionSignal.class);
            double modifier = visibilityModifier(c, sv);
            double gain = 0;
            for (Map.Entry<VisionSignal, Double> e : sv.informs().entrySet()) {
                double g = importance(c, e.getKey()) * uncertainty(c, e.getKey()) * Math.min(1, e.getValue() * modifier);
                if (g > 0) {
                    bySignal.put(e.getKey(), g);
                    gain += g;
                }
            }
            double score = gain / Math.max(0.5, sv.effort());
            if (score < t.minScore()) {
                continue;
            }
            VisionSignal dominant = bySignal.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(null);
            ranked.add(new Recommendation(sv.view(), purposeOf(dominant), needOf(c, sv, dominant, score),
                    reasonOf(c, sv, dominant), gain, score, dominant, bySignal, List.of()));
        }
        ranked.sort(Comparator.comparingDouble(Recommendation::score).reversed());
        if (ranked.isEmpty()) {
            return new Decision(null, List.of(), true, anyUncertain ? DoneReason.NO_USEFUL_VIEW : DoneReason.CONFIDENT, policy);
        }
        return new Decision(ranked.get(0), List.copyOf(ranked.subList(1, Math.min(ranked.size(), 4))), false, null, policy);
    }

    double importance(Context c, VisionSignal s) {
        return switch (s) {
            case BRAND -> 1.0;
            case SUBCATEGORY -> 0.7;
            case MATERIAL -> 0.6;
            case PATTERN -> 0.25;
            case MODEL, PRODUCT_LINE -> c.identifyModel() ? Math.max(0.8, c.profile().modelImportance()) : c.profile().modelImportance();
            case CATEGORY, COLOR -> 0;
        };
    }

    double uncertainty(Context c, VisionSignal s) {
        double target = switch (s) {
            case BRAND -> t.brandTarget();
            case SUBCATEGORY -> t.subcategoryTarget();
            case MATERIAL -> t.materialTarget();
            case PATTERN -> t.patternTarget();
            case MODEL, PRODUCT_LINE -> t.modelTarget();
            case CATEGORY, COLOR -> 0.5;
        };
        return Math.max(0, target - c.conf(s)) / target;
    }

    private static boolean conditionHolds(Context c, SecondaryView sv) {
        if (sv.condition() == Condition.MODEL_WANTED) {
            return c.identifyModel() || c.profile().modelImportance() >= 0.5;
        }
        if (sv.condition() == Condition.OTHER_SIDE) {
            // lado já visto: o da foto lateral; de 3/4 a convenção da orientação é o lado esquerdo (bico para a esquerda)
            CaptureView seen = switch (c.primaryView()) {
                case RIGHT_SIDE -> CaptureView.RIGHT_SIDE;
                case LEFT_SIDE, THREE_QUARTER -> CaptureView.LEFT_SIDE;
                default -> null;
            };
            return seen != null && sv.view() != seen;
        }
        return true;
    }

    private static double visibilityModifier(Context c, SecondaryView sv) {
        return switch (sv.reveal()) {
            case NEW_REGION -> c.logoVisible() ? 0.8 : 1.0;
            case ZOOM_VISIBLE_LOGO -> c.logoVisible() ? 1.2 : 0.4;
            case NEUTRAL -> 1.0;
        };
    }

    private CaptureNeed needOf(Context c, SecondaryView sv, VisionSignal dominant, double score) {
        if (dominant == VisionSignal.BRAND && c.conf(VisionSignal.BRAND) < t.brandRequestBelow() && sv.informs(VisionSignal.BRAND) >= 0.6) {
            return CaptureNeed.STRONGLY_RECOMMENDED;
        }
        return score >= t.recommendScore() ? CaptureNeed.RECOMMENDED : CaptureNeed.OPTIONAL;
    }

    private static CapturePurpose purposeOf(VisionSignal dominant) {
        if (dominant == null) {
            return CapturePurpose.DETAIL_RECORD;
        }
        return switch (dominant) {
            case BRAND -> CapturePurpose.BRAND_DISAMBIGUATION;
            case MODEL, PRODUCT_LINE -> CapturePurpose.MODEL_IDENTIFICATION;
            case MATERIAL -> CapturePurpose.MATERIAL_IDENTIFICATION;
            case PATTERN -> CapturePurpose.PATTERN_IDENTIFICATION;
            default -> CapturePurpose.COVERAGE_COMPLETION;
        };
    }

    private static String reasonOf(Context c, SecondaryView sv, VisionSignal dominant) {
        if (dominant == VisionSignal.BRAND) {
            if (sv.condition() == Condition.OTHER_SIDE) {
                return "other_side_branding";
            }
            return c.logoVisible() ? "brand_disambiguation" : "logo_not_visible";
        }
        if (dominant == VisionSignal.MODEL || dominant == VisionSignal.PRODUCT_LINE) {
            return "model_identification";
        }
        return dominant == null ? "detail" : dominant.name().toLowerCase() + "_identification";
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
