package br.com.fashionai.application.vision.quality;

import br.com.fashionai.application.vision.ModelRef;
import br.com.fashionai.application.vision.capture.CaptureProfile;
import br.com.fashionai.domain.model.enums.CaptureView;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * RF4 · Photography Quality Gate — PhotographyQualityScore de 0 a 100 antes do asset canônico. Não recusa: abaixo de
 * {@link #ACCEPT} a pessoa recebe orientação (e o motor de captura sugere refazer), e o cadastro segue se ela quiser.
 * Fotos de detalhe (etiqueta, logo, textura) só são julgadas por resolução, nitidez e luz — encostar na borda é normal.
 */
public final class PhotographyQualityGate {
    public static final ModelRef MODEL = ModelRef.QUALITY_GATE;
    public static final int ACCEPT = 75;
    public static final int GUIDE = 50;

    public enum Decision { ACCEPT, ACCEPT_WITH_GUIDANCE, RETAKE_SUGGESTED }

    public enum Status { OK, WARN, FAIL }

    /**
     * Medidas da foto. Campos {@code null} = não medido (o critério sai da conta, sem punir).
     *
     * @param coverage         fração do quadro ocupada pela caixa da peça
     * @param truncatedSides   lados onde a peça encosta na borda (top/bottom/left/right)
     * @param rotationDeg      inclinação estimada da peça
     * @param symmetry         simetria da silhueta (câmera a 90°), 0–1
     * @param singlePiece      uma peça só, sem objetos sobre ela
     * @param personRemovedPct % da foto removida como corpo humano no navegador
     * @param backgroundConfidence confiança do recorte (fundo complexo → baixa)
     */
    public record Signals(int width, int height, Double sharpness, Double exposure, Double coverage,
                          Set<String> truncatedSides, Double rotationDeg, Double symmetry, Boolean singlePiece,
                          Double personRemovedPct, Double backgroundConfidence, Boolean logoVisible) {
    }

    public record Criterion(String id, double score, int weight, Status status, String tip) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("score", Math.round(score * 100) / 100.0);
            m.put("weight", weight);
            m.put("status", status.name());
            m.put("tip", tip);
            return m;
        }
    }

    public record Report(int score, Decision decision, List<Criterion> criteria, List<String> clippedRegions,
                         boolean mandatoryRegionClipped, String model) {
        /** Critérios reprovados, do mais pesado ao mais leve — viram as dicas do pedido de refazer. */
        public List<String> failing() {
            return criteria.stream().filter(c -> c.status() == Status.FAIL)
                    .sorted((a, b) -> Integer.compare(b.weight(), a.weight())).map(Criterion::id).toList();
        }

        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("photographyQualityScore", score);
            m.put("decision", decision.name());
            m.put("criteria", criteria.stream().map(Criterion::toMap).toList());
            m.put("clippedRegions", clippedRegions);
            m.put("mandatoryRegionClipped", mandatoryRegionClipped);
            m.put("failing", failing());
            m.put("model", model);
            return m;
        }
    }

    public Report evaluate(CaptureProfile profile, CaptureView view, Signals s) {
        List<Criterion> out = new ArrayList<>();
        int minSide = Math.min(s.width(), s.height());
        add(out, "resolution", Math.min(1, minSide / 1200.0), 10, "resolution");
        if (s.sharpness() != null) {
            add(out, "blur", s.sharpness() / 0.6, 15, "blur");
        }
        if (s.exposure() != null) {
            add(out, "lighting", s.exposure(), 12, "lighting");
        }
        List<String> clipped = new ArrayList<>();
        boolean mandatoryClipped = false;
        if (view.wholeProduct()) {
            if (s.coverage() != null) {
                double c = s.coverage();
                double score = c < 0.2 ? c / 0.2 * 0.6 : c > 0.92 ? Math.max(0, 1 - (c - 0.92) * 6) : c < 0.3 ? 0.6 + (c - 0.2) * 4 : 1;
                add(out, "garmentCoverage", score, 12, c < 0.3 ? "closer" : "farther");
            }
            Set<String> sides = s.truncatedSides() == null ? Set.of() : s.truncatedSides();
            for (String side : sides) {
                String region = profile.edgeRegions().getOrDefault(side, side);
                if (!clipped.contains(region)) {
                    clipped.add(region);
                }
                if (profile.requiredVisibleRegions().contains(region)) {
                    mandatoryClipped = true;
                }
            }
            add(out, "clipping", mandatoryClipped ? 0.1 : sides.isEmpty() ? 1 : 0.7, 15,
                    clipped.isEmpty() ? "clipping" : "clipping:" + clipped.get(0));
            if (s.rotationDeg() != null) {
                double r = Math.abs(s.rotationDeg());
                add(out, "rotation", r <= 5 ? 1 : Math.max(0, 1 - (r - 5) / 20), 6, "rotation");
            }
            if (s.symmetry() != null) {
                add(out, "perspective", Math.min(1, s.symmetry() / 0.85), 4, "perspective");
            }
            if (s.singlePiece() != null) {
                add(out, "foreignObjects", s.singlePiece() ? 1 : 0.2, 8, "foreignObjects");
            }
            if (s.personRemovedPct() != null) {
                add(out, "personPresence", s.personRemovedPct() <= 0 ? 1 : s.personRemovedPct() < 30 ? 0.7 : 0.45, 7, "personPresence");
            }
            if (s.backgroundConfidence() != null) {
                add(out, "backgroundComplexity", Math.min(1, s.backgroundConfidence() / 0.75), 7, "background");
            }
            if (s.logoVisible() != null) {
                add(out, "logoVisibility", s.logoVisible() ? 1 : 0.6, 4, "logoVisibility");
            }
        }
        double weighted = 0;
        int weights = 0;
        for (Criterion c : out) {
            weighted += c.score() * c.weight();
            weights += c.weight();
        }
        int score = weights == 0 ? 0 : (int) Math.round(weighted / weights * 100);
        if (mandatoryClipped) {
            score = Math.min(score, GUIDE + 15);
        }
        // tremida demais ou escura demais: nenhuma soma de outros critérios compensa — sugere refazer
        boolean severe = out.stream().anyMatch(c -> (c.id().equals("blur") || c.id().equals("lighting")) && c.score() < 0.25);
        Decision d = severe ? Decision.RETAKE_SUGGESTED : score >= ACCEPT && !mandatoryClipped ? Decision.ACCEPT
                : score >= GUIDE ? Decision.ACCEPT_WITH_GUIDANCE : Decision.RETAKE_SUGGESTED;
        if (severe) {
            score = Math.min(score, GUIDE - 1);
        }
        return new Report(score, d, out, clipped, mandatoryClipped, MODEL.key());
    }

    private static void add(List<Criterion> out, String id, double score, int weight, String tip) {
        double v = Double.isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
        Status st = v >= 0.7 ? Status.OK : v >= 0.45 ? Status.WARN : Status.FAIL;
        out.add(new Criterion(id, v, weight, st, st == Status.OK ? null : tip));
    }
}
