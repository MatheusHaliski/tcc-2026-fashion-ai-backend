package br.com.fashionai.application.vision;

/**
 * RF4 · Referência ao modelo que produziu um resultado de visão (Model Registry): nome estável + versão semântica +
 * provedor de execução. Toda inferência de visão grava a referência, inclusive as heurísticas locais.
 */
public record ModelRef(String name, String version, String provider) {
    public String key() {
        return name + "@" + version;
    }

    // Componentes da v1 (registrados na semente da V29). Trocar a implementação = registrar nova versão.
    public static final ModelRef GARMENT_SEGMENTER = new ModelRef("garment-segmenter", "1.0.0", "rembg|removebg|local-floodfill");
    public static final ModelRef GARMENT_DETECTOR = new ModelRef("garment-detector", "1.0.0", "local-alpha-components");
    public static final ModelRef GARMENT_CLASSIFIER = new ModelRef("garment-classifier", "1.0.0", "piece-analyzer-llm+silhouette");
    public static final ModelRef PANTS_LANDMARKS = new ModelRef("pants-landmarks", "1.0.0", "local-geometric");
    public static final ModelRef UPPER_LANDMARKS = new ModelRef("upper-landmarks", "1.0.0", "local-geometric");
    public static final ModelRef FOOTWEAR_LANDMARKS = new ModelRef("footwear-landmarks", "1.0.0", "local-geometric");
    public static final ModelRef ACCESSORY_LANDMARKS = new ModelRef("accessory-landmarks", "1.0.0", "local-geometric");
    public static final ModelRef LOGO_DETECTOR = new ModelRef("logo-detector", "1.0.0", "vision-llm|local-logofinder");
    public static final ModelRef OCR = new ModelRef("ocr-ppocrv4", "4.0.0", "onnx-local");
    public static final ModelRef LABEL_PARSER = new ModelRef("label-parser", "1.0.0", "local-rules");
    public static final ModelRef BRAND_ENSEMBLE = new ModelRef("brand-ensemble", "1.0.0", "local-noisy-or");
    public static final ModelRef MATERIAL_CLASSIFIER = new ModelRef("material-classifier", "1.0.0", "piece-analyzer-llm+label");
    public static final ModelRef PATTERN_CLASSIFIER = new ModelRef("pattern-classifier", "1.0.0", "local-autocorrelation");
    public static final ModelRef GARMENT_EMBEDDING = new ModelRef("garment-embedding", "1.0.0", "local-descriptor");
    public static final ModelRef QUALITY_GATE = new ModelRef("photography-quality-gate", "1.0.0", "local-rules");
    public static final ModelRef CAPTURE_POLICY = new ModelRef("adaptive-capture", "1.0.0", "local-expected-gain");
    public static final ModelRef CANONICAL = new ModelRef("canonical-photographer", "1.0.0", "local-deterministic");
}
