package br.com.fashionai.application.vision.ensemble;

import br.com.fashionai.application.vision.ModelRef;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * RF4 · Ensemble de reconhecimento de marca. Nenhum sinal decide sozinho: logo, OCR, etiqueta, IA de visão, vizinhos
 * visuais, assinatura da marca, contexto da categoria e ferragens viram evidências com força {@code reliability ×
 * confiança}. Por marca candidata: {@code score(b) = 1 − Π(1 − sᵢ)} (noisy-OR). A massa é repartida entre as
 * candidatas e "outra" ({@code other = Π(1 − score(c))}), então duas candidatas próximas aparecem como alternativas
 * — nunca um valor único sem evidência.
 */
public final class BrandEnsembleResolver {
    public static final ModelRef MODEL = ModelRef.BRAND_ENSEMBLE;

    /** Sinais e a confiabilidade-base de cada um (v1, calibráveis com as decisões da revisão de IA). */
    public enum Signal {
        LOGO_DETECTION(0.85),
        OCR_CONFIRMED(0.80),
        OCR_PARTIAL(0.45),
        LABEL_RECOGNITION(0.85),
        VISION_MODEL(0.70),
        VISUAL_EMBEDDING(0.30),
        SIGNATURE_PATTERN(0.20),
        CATEGORY_CONTEXT(0.05),
        HARDWARE_RECOGNITION(0.60);

        public final double reliability;

        Signal(double reliability) {
            this.reliability = reliability;
        }
    }

    /**
     * Uma evidência a favor de uma marca.
     *
     * @param confidence confiança do próprio sinal (0–1); a força é {@code reliability × confidence}
     * @param detail     texto curto e legível ("crocodilo no peito esquerdo", "leitura parcial \"LACOS\"")
     * @param view       de qual foto veio (FRONT_VIEW, LABEL_DETAIL…)
     * @param model      modelo/versão que produziu o sinal
     */
    public record Evidence(Signal signal, String brand, double confidence, String detail, String view, String model) {
        public double strength() {
            return Math.max(0, Math.min(1, signal.reliability * confidence));
        }
    }

    public record Candidate(String brand, double confidence) {
    }

    public record Resolution(String brand, double confidence, List<Evidence> evidence, List<Candidate> alternatives,
                             double otherMass, String resolver) {
        public static Resolution none() {
            return new Resolution(null, 0, List.of(), List.of(), 1, MODEL.key());
        }

        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("brand", brand);
            m.put("confidence", round(confidence));
            m.put("evidence", evidence.stream().filter(e -> brand != null && canonical(e.brand()).equals(canonical(brand))).map(e -> {
                Map<String, Object> x = new LinkedHashMap<>();
                x.put("signal", e.signal().name());
                x.put("detail", e.detail());
                x.put("view", e.view());
                x.put("strength", round(e.strength()));
                x.put("model", e.model());
                return x;
            }).toList());
            m.put("alternatives", alternatives.stream().map(a -> Map.<String, Object>of("brand", a.brand(), "confidence", round(a.confidence()))).toList());
            m.put("otherMass", round(otherMass));
            m.put("resolver", resolver);
            return m;
        }
    }

    public Resolution resolve(List<Evidence> evidence) {
        Map<String, String> display = new LinkedHashMap<>();
        Map<String, Double> notSupported = new LinkedHashMap<>();
        for (Evidence e : evidence) {
            if (e.brand() == null || e.brand().isBlank() || e.strength() <= 0) {
                continue;
            }
            String key = canonical(e.brand());
            display.putIfAbsent(key, e.brand().trim());
            notSupported.merge(key, 1 - e.strength(), (a, b) -> a * b);
        }
        if (notSupported.isEmpty()) {
            return Resolution.none();
        }
        Map<String, Double> score = new LinkedHashMap<>();
        double other = 1;
        double total = 0;
        for (Map.Entry<String, Double> e : notSupported.entrySet()) {
            double s = 1 - e.getValue();
            score.put(e.getKey(), s);
            other *= 1 - s;
            total += s;
        }
        double denom = total + other;
        List<Candidate> ranked = new ArrayList<>();
        for (Map.Entry<String, Double> e : score.entrySet()) {
            ranked.add(new Candidate(display.get(e.getKey()), e.getValue() / denom));
        }
        ranked.sort(Comparator.comparingDouble(Candidate::confidence).reversed());
        Candidate top = ranked.get(0);
        List<Candidate> alternatives = ranked.subList(1, Math.min(ranked.size(), 6)).stream()
                .filter(c -> c.confidence() >= 0.02).toList();
        return new Resolution(top.brand(), top.confidence(), List.copyOf(evidence), alternatives, other / denom, MODEL.key());
    }

    /** "Levi's", "LEVIS", "levi’s" → mesma chave. */
    public static String canonical(String brand) {
        if (brand == null) {
            return "";
        }
        return java.text.Normalizer.normalize(brand, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
