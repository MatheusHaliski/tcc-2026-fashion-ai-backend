package br.com.fashionai.application.vision.capture;

import br.com.fashionai.application.vision.VisionSignal;
import br.com.fashionai.domain.model.enums.CaptureView;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * RF4 · Perfil de captura de um grupo de subcategorias (calças, tênis, relógios…): a vista principal preferida, as
 * regiões que precisam aparecer, onde a marca costuma estar e quais vistas complementares podem esclarecer cada sinal.
 * É dado, não código: o {@link AdaptiveCaptureEngine} decide a próxima foto a partir destes pesos.
 *
 * @param family                 LOWER, UPPER, FULL_BODY, FOOTWEAR ou ACCESSORY
 * @param landmarkFamily         geometria usada pelo detector de landmarks (PANTS, SKIRT, UPPER, DRESS, FOOTWEAR, BAG…)
 * @param edgeRegions            lado do quadro (top/bottom/left/right) → região que fica cortada ali (feedback e corte)
 * @param requiredVisibleRegions regiões que não podem estar cortadas (barra da calça, calcanhar, alças…)
 * @param brandRegions           onde a marca costuma estar nessa peça (zonas para OCR e para a orientação)
 * @param specs                  vista → id da {@link br.com.fashionai.application.vision.spec.PhotographySpec}
 * @param modelImportance        quanto identificar o modelo exato importa por padrão (relógio sim; camiseta não)
 * @param appearanceLimited      a aparência externa não basta para identificar (joias): a tela avisa e não promete
 */
public record CaptureProfile(String id, String family, List<String> subcategories, CaptureView primaryView,
                             List<CaptureView> alternativePrimaryViews, String landmarkFamily,
                             Map<String, String> edgeRegions, List<String> requiredVisibleRegions,
                             List<String> brandRegions, List<SecondaryView> secondaryViews, Map<CaptureView, String> specs,
                             double modelImportance, boolean appearanceLimited, Guidance guidance) {

    /** Quando a vista complementar faz sentido. */
    public enum Condition {
        /** sempre que o ganho esperado justificar */
        ALWAYS,
        /** o outro lado do calçado: só se a foto principal foi de um lado (ou 3/4) e esse lado ainda não foi fotografado */
        OTHER_SIDE,
        /** só quando identificar o modelo foi pedido ou o perfil dá importância ao modelo */
        MODEL_WANTED
    }

    /** O que a vista revela em relação ao que já está visível — modula o ganho pela visibilidade do logo. */
    public enum Reveal {
        /** mostra uma região nova (traseira, outro lado, etiqueta interna, língua, verso, haste) */
        NEW_REGION,
        /** amplia o logo/texto que já aparece (só ajuda se há logo visível) */
        ZOOM_VISIBLE_LOGO,
        /** textura e material: independe do logo */
        NEUTRAL
    }

    /**
     * @param informs quanto essa vista resolve cada sinal para esse perfil (0–1)
     * @param effort  esforço relativo para a pessoa (achar a etiqueta interna custa mais que aproximar a câmera)
     */
    public record SecondaryView(CaptureView view, Map<VisionSignal, Double> informs, Condition condition, double effort,
                                Reveal reveal) {
        public double informs(VisionSignal s) {
            return informs.getOrDefault(s, 0.0);
        }
    }

    /**
     * Orientação física da captura (a animação e o overlay do frontend usam o {@code overlay}).
     *
     * @param orientation PORTRAIT ou LANDSCAPE
     */
    public record Guidance(String overlay, String orientation, int distanceMinCm, int distanceMaxCm, String background,
                           String lighting) {
    }

    public Optional<SecondaryView> secondary(CaptureView view) {
        return secondaryViews.stream().filter(s -> s.view() == view).findFirst();
    }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("family", family);
        m.put("subcategories", subcategories);
        m.put("primaryView", primaryView.name());
        m.put("alternativePrimaryViews", alternativePrimaryViews.stream().map(Enum::name).toList());
        m.put("landmarkFamily", landmarkFamily);
        m.put("edgeRegions", edgeRegions);
        m.put("requiredVisibleRegions", requiredVisibleRegions);
        m.put("brandDetectionRegions", brandRegions);
        m.put("usefulSecondaryViews", secondaryViews.stream().map(s -> {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("view", s.view().name());
            v.put("condition", s.condition().name());
            Map<String, Double> informs = new LinkedHashMap<>();
            s.informs().forEach((k, val) -> informs.put(k.name(), val));
            v.put("informs", informs);
            return v;
        }).toList());
        Map<String, String> sp = new LinkedHashMap<>();
        specs.forEach((k, v) -> sp.put(k.name(), v));
        m.put("specs", sp);
        m.put("modelImportance", modelImportance);
        m.put("appearanceLimited", appearanceLimited);
        Map<String, Object> g = new LinkedHashMap<>();
        g.put("overlay", guidance.overlay());
        g.put("orientation", guidance.orientation());
        g.put("distanceMinCm", guidance.distanceMinCm());
        g.put("distanceMaxCm", guidance.distanceMaxCm());
        g.put("background", guidance.background());
        g.put("lighting", guidance.lighting());
        m.put("guidance", g);
        return m;
    }
}
