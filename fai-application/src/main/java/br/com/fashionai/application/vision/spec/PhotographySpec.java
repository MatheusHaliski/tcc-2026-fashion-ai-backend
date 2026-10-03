package br.com.fashionai.application.vision.spec;

import br.com.fashionai.domain.model.enums.CaptureView;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * RF4 · Especificação fotográfica determinística e versionada de um asset canônico (ex.: {@code PANTS_FRONT_V1}).
 * O {@link br.com.fashionai.application.vision.canonical.CanonicalPhotographer} só aplica operações que preservam a
 * peça real (rotação limitada, recorte, escala uniforme, padding, centralização); nunca gera conteúdo.
 *
 * @param coverageTarget        fração do lado limitante do quadro ocupada pela peça (maximiza a ocupação útil)
 * @param anchorLandmarks       landmarks usados para endireitar/enquadrar (a linha da cintura, a sola…)
 * @param mandatoryLandmarks    sem eles o asset sai marcado "precisa de revisão" — nunca inventados
 * @param requiredVisibleRegions regiões que não podem estar cortadas na foto
 * @param allowedRotationDeg    correção máxima de rotação ("pequenas rotações")
 * @param allowedPerspectiveDeg correção de perspectiva moderada permitida (só com referência de 4 pontos)
 * @param maxUpscale            ampliação máxima: acima disso a peça fica menor no quadro em vez de "inventar" detalhe
 * @param detailRegion          para specs de detalhe: qual região recortar
 */
public record PhotographySpec(String id, int version, CaptureView view, String aspectRatio, int canvasWidth,
                              int canvasHeight, double coverageTarget, List<String> anchorLandmarks,
                              List<String> mandatoryLandmarks, List<String> requiredVisibleRegions,
                              double allowedRotationDeg, double allowedPerspectiveDeg, double padding,
                              BackgroundMode backgroundMode, Alignment alignment, Composition composition,
                              double maxUpscale, DetailRegion detailRegion) {

    public enum BackgroundMode { TRANSPARENT, WHITE, NEUTRAL }

    /** CENTER = centro da caixa da peça no centro do quadro; BASELINE = base (sola) numa linha fixa. */
    public enum Alignment { CENTER, BASELINE }

    /** Calçados: o canônico principal é um pé (SINGLE) ou o par lado a lado (PAIR). ANY = não se aplica. */
    public enum Composition { SINGLE, PAIR, ANY }

    public enum DetailRegion { NONE, LOGO, TEXTURE, TOP_BAND, WHOLE }

    public boolean isDetail() {
        return detailRegion != DetailRegion.NONE;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("version", version);
        m.put("view", view.name());
        m.put("preferredAspectRatio", aspectRatio);
        m.put("canvasWidth", canvasWidth);
        m.put("canvasHeight", canvasHeight);
        m.put("garmentCoverageTarget", coverageTarget);
        m.put("anchorLandmarks", anchorLandmarks);
        m.put("mandatoryLandmarks", mandatoryLandmarks);
        m.put("requiredVisibleRegions", requiredVisibleRegions);
        m.put("allowedRotation", allowedRotationDeg);
        m.put("allowedPerspectiveCorrection", allowedPerspectiveDeg);
        m.put("padding", padding);
        m.put("backgroundMode", backgroundMode.name());
        m.put("alignment", alignment.name());
        m.put("composition", composition.name());
        m.put("maxUpscale", maxUpscale);
        m.put("detailRegion", detailRegion.name());
        return m;
    }
}
