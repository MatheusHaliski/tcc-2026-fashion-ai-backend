package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.BrandRegions;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonParts;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonSegmentationPort;
import br.com.fashionai.application.vision.landmarks.LandmarkDetector;

import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Pipeline de imagens da Busca Catalogada (CATALOG_IMAGE_PIPELINE_V2), puro (sem rede, banco ou disco):
 * SOURCE → VALIDATION → PRODUCT DETECTION → SEGMENTATION → DISTRACTOR REMOVAL → CATEGORY-AWARE ROI → SEMANTIC REFRAMING
 * → BACKGROUND NORMALIZATION → DETAIL PRESERVATION → QUALITY CHECK → CATALOG MASTER IMAGE.
 *
 * <p>Dois níveis (RN47.03): fonte sem permissão de persistência gera só metadados (recorte semântico, foco, métricas,
 * veredito) e o card mostra a URL original com esse recorte; fonte com {@code allows_image_persistence} também gera o
 * master (PNG transparente + variantes branco/neutro/card/thumb) para o storage do FashionAI.
 */
public final class CatalogImagePipeline {
    public static final String VERSION = "CATALOG_IMAGE_PIPELINE_V2";
    public static final Set<String> ACCEPTED_MIME = Set.of("image/jpeg", "image/png", "image/webp");

    public record Request(byte[] bytes, String category, String subcategory, String imageType, boolean persist) {
    }

    public record Stage(String name, long ms, String note) {
        public Map<String, Object> toMap() {
            return Map.of("stage", name, "ms", ms, "note", note == null ? "" : note);
        }
    }

    /**
     * Resultado completo; {@code rendered} só existe no nível B. {@code detailView}: foto de detalhe (vira
     * catalogDetailImage, nunca master). {@code background}: cor do fundo da foto (preenche o smartPadding no card).
     */
    public record Analysis(CatalogImageValidator.Outcome outcome, List<String> reasons, boolean manualReview, double confidence,
                           String mime, int width, int height, String sha256, String phash, PieceType pieceType,
                           NRect productBox, FramingStrategy.Focus focus, SemanticCropper.Result crop,
                           Map<String, Double> metrics, double qualityScore, String background, boolean detailView,
                           BackgroundNormalizer.Rendered rendered, List<Stage> stages, Map<String, Object> debug) {
        public static Analysis rejected(String reason, String mime, int w, int h, String sha, List<Stage> stages) {
            return new Analysis(CatalogImageValidator.Outcome.REJECTED, List.of(reason), false, 0, mime, w, h, sha, null, null,
                    null, null, null, Map.of(), 0, null, false, null, stages, Map.of());
        }

        /** Metadados do recorte gravados em crop_json e lidos pelo card (coordenadas normalizadas da foto original). */
        public Map<String, Object> cropJson() {
            Map<String, Object> m = new LinkedHashMap<>();
            if (crop == null) {
                return m;
            }
            m.put("aspect", "4:5");
            m.put("crop", crop.best().crop().toMap());
            m.put("focus", Map.of("name", focus.name(), "rect", focus.rect().toMap(), "source", focus.source()));
            m.put("product", productBox.toMap());
            m.put("analysis", crop.analysis().toMap());
            if (crop.detail() != null) {
                m.put("detail", crop.detail().toMap());
            }
            m.put("background", background);
            m.put("padding", NRect.r4(crop.best().padding()));
            return m;
        }
    }

    private final ProductSegmenter segmenter = new ProductSegmenter();
    private final LandmarkDetector landmarks = new LandmarkDetector();
    private final SemanticCropper cropper = new SemanticCropper();
    private final BackgroundNormalizer normalizer = new BackgroundNormalizer();
    private final ImageQualityAnalyzer analyzer = new ImageQualityAnalyzer();
    private final CatalogImageValidator validator = new CatalogImageValidator();
    private final SemanticRegionRegistry registry;
    private final PersonSegmentationPort persons;

    public CatalogImagePipeline(SemanticRegionRegistry registry, PersonSegmentationPort persons) {
        this.registry = registry;
        this.persons = persons;
    }

    public Analysis run(Request req) {
        List<Stage> stages = new ArrayList<>();
        long t = System.nanoTime();
        // VALIDATION — pelo conteúdo (magic bytes), não pelo Content-Type do servidor
        String mime = ImageOps.detectMime(req.bytes());
        String sha = sha256(req.bytes());
        if (mime == null || !ACCEPTED_MIME.contains(mime)) {
            return Analysis.rejected("UNSUPPORTED_MIME", mime, 0, 0, sha, List.of(stage("VALIDATION", t, "mime")));
        }
        if (req.bytes().length > ImageOps.MAX_UPLOAD_BYTES) {
            return Analysis.rejected("IMAGE_TOO_LARGE", mime, 0, 0, sha, List.of(stage("VALIDATION", t, "bytes")));
        }
        Optional<ImageOps.Dimensions> dims = ImageOps.dimensions(req.bytes());
        if (dims.isPresent() && ((long) dims.get().width() * dims.get().height() > ImageOps.maxPixels()
                || Math.max(dims.get().width(), dims.get().height()) > ImageOps.maxSide())) {
            return Analysis.rejected("IMAGE_TOO_LARGE", mime, dims.get().width(), dims.get().height(), sha, List.of(stage("VALIDATION", t, "pixels")));
        }
        BufferedImage src;
        try {
            src = ImageOps.decode(req.bytes());
        } catch (RuntimeException e) {
            return Analysis.rejected("UNREADABLE_IMAGE", mime, 0, 0, sha, List.of(stage("VALIDATION", t, "decode")));
        }
        int w = src.getWidth(), h = src.getHeight();
        if (Math.min(w, h) < ImageQualityAnalyzer.MIN_SOURCE_SIDE) {
            return Analysis.rejected("IMAGE_TOO_SMALL", mime, w, h, sha, List.of(stage("VALIDATION", t, w + "x" + h)));
        }
        String phash = PerceptualHash.dHash(src);
        stages.add(stage("VALIDATION", t, mime + " " + w + "x" + h));

        // PRODUCT DETECTION + SEGMENTATION + DISTRACTOR REMOVAL (máscara sem distratores e sem cabide)
        t = System.nanoTime();
        PieceType type = PieceType.of(req.category());
        ProductSegmenter.Segmentation seg = segmenter.segment(src, type);
        stages.add(stage("SEGMENTATION", t, "coverage=" + NRect.r4(seg.coverage()) + " conf=" + NRect.r4(seg.confidence())));
        if (seg.empty()) {
            return Analysis.rejected("NO_PRODUCT", mime, w, h, sha, stages);
        }
        double productPx = Math.min(seg.productBox().w() * w, seg.productBox().h() * h);
        if (productPx < ImageQualityAnalyzer.MIN_PRODUCT_PX) {
            return Analysis.rejected("IMAGE_TOO_SMALL", mime, w, h, sha, stages);
        }
        t = System.nanoTime();
        double human = humanEvidence(src, seg);
        stages.add(stage("DISTRACTOR_REMOVAL", t, "distractors=" + seg.distractors().size() + " hanger=" + seg.hangerTrimmed()
                + " human=" + NRect.r4(human)));

        // CATEGORY-AWARE ROI
        t = System.nanoTime();
        SemanticRegionRegistry.Profile profile = registry.profile(type, req.subcategory());
        BufferedImage product = seg.productOnly();
        LandmarkDetector.Result lm = landmarks.detect(product, type.landmarkFamily(req.subcategory()));
        FramingStrategy.Focus focus = FramingStrategy.forType(type).focus(seg.productBox(), profile, lm);
        stages.add(stage("ROI", t, focus.name() + " via " + focus.source()));

        // SEMANTIC REFRAMING
        t = System.nanoTime();
        SemanticCropper.Result crop = cropper.crop(w, h, registry.aspectRatio(), seg.productBox(), centroid(seg), focus, profile,
                seg.distractors(), seg.truncatedSides());
        stages.add(stage("REFRAMING", t, "cropScore=" + NRect.r4(crop.best().score()) + " fill=" + NRect.r4(crop.best().fill())));

        // BACKGROUND NORMALIZATION + DETAIL PRESERVATION (só nível B)
        BackgroundNormalizer.Rendered rendered = null;
        double color = 1, reconstruction = 1;
        List<String> extra = new ArrayList<>();
        if (req.persist()) {
            t = System.nanoTime();
            rendered = normalizer.render(seg, crop.best().crop(), registry.aspectRatio());
            if (rendered == null) {
                extra.add("IMAGE_TOO_SMALL_FOR_MASTER");
            } else {
                color = rendered.colorPreservation();
            }
            reconstruction = human >= 0.06 ? 0 : 1;   // pessoa sobre a peça exigiria reconstruir pixels: não fazemos
            stages.add(stage("BACKGROUND_NORMALIZATION", t, rendered == null ? "too small" : rendered.width() + "x" + rendered.height()
                    + " color=" + NRect.r4(color)));
        }

        // QUALITY CHECK
        t = System.nanoTime();
        Boolean logoInside = logoInside(product, crop.best().crop());
        ImageQualityAnalyzer.Report report = analyzer.analyze(src, seg, crop, human, color, logoInside, reconstruction);
        CatalogImageValidator.Verdict verdict = validator.validate(report.metrics(), report.overall(), human, req.persist(), seg);
        List<String> reasons = new ArrayList<>(verdict.reasons());
        reasons.addAll(extra);
        CatalogImageValidator.Outcome outcome = verdict.outcome();
        if (!extra.isEmpty() && outcome == CatalogImageValidator.Outcome.APPROVED) {
            outcome = CatalogImageValidator.Outcome.NEEDS_REPROCESSING;
        }
        stages.add(stage("VALIDATING", t, outcome + " overall=" + report.overall()));
        boolean detailView = "DETAIL".equalsIgnoreCase(req.imageType()) || seg.truncatedSides().size() >= 3;
        Map<String, Object> debug = new LinkedHashMap<>();
        debug.put("bbox", seg.productBox().toMap());
        debug.put("distractors", seg.distractors().stream().map(NRect::toMap).toList());
        debug.put("focus", focus.rect().toMap());
        debug.put("critical", focus.critical().stream().map(r -> Map.of("name", r.name(), "rect", r.rect().toMap())).toList());
        debug.put("landmarks", lm.landmarks().stream().filter(LandmarkDetector.Landmark::visible).map(LandmarkDetector.Landmark::toMap).toList());
        debug.put("candidates", crop.candidates().stream().map(SemanticCropper.Candidate::toMap).toList());
        debug.put("finalCrop", crop.best().crop().toMap());
        debug.put("truncated", seg.truncatedSides());
        debug.put("hangerTrimmed", seg.hangerTrimmed());
        debug.put("registryVersion", registry.version());
        return new Analysis(outcome, List.copyOf(reasons), verdict.manualReview() || outcome == CatalogImageValidator.Outcome.NEEDS_REPROCESSING,
                verdict.confidence(), mime, w, h, sha, phash, type, seg.productBox(), focus, crop, report.metrics(), report.overall(),
                String.format("#%06x", seg.backgroundRgb() & 0xFFFFFF), detailView, rendered, List.copyOf(stages), debug);
    }

    /** Pele estranha à peça (segmentador próprio) combinada com o segmentador de pessoa, quando disponível. */
    double humanEvidence(BufferedImage src, ProductSegmenter.Segmentation seg) {
        double evidence = seg.foreignSkin();
        if (persons != null && persons.available()) {
            try {
                Optional<PersonParts> parts = persons.segment(src);
                if (parts.isPresent()) {
                    double skin = parts.get().person() * (parts.get().bodySkin() + parts.get().faceSkin());
                    evidence = Math.max(evidence, skin / Math.max(0.05, seg.coverage()));
                }
            } catch (RuntimeException ignored) {
                // segmentador indisponível não derruba o pipeline: fica a evidência local
            }
        }
        return Math.min(1, evidence);
    }

    static Boolean logoInside(BufferedImage product, NRect crop) {
        try {
            double[] box = BrandRegions.detectLogo(product);
            return box == null ? null : NRect.of(box).insideOf(crop) >= 0.9;
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** visualCenter: centróide da máscara (peso real da peça, não o meio da caixa — manga aberta não puxa o centro). */
    static NRect centroid(ProductSegmenter.Segmentation seg) {
        double sx = 0, sy = 0;
        long n = 0;
        boolean[] m = seg.mask();
        for (int i = 0; i < m.length; i += 2) {
            if (m[i]) {
                sx += i % seg.width();
                sy += i / seg.width();
                n++;
            }
        }
        return n == 0 ? seg.productBox() : new NRect(sx / n / seg.width(), sy / n / seg.height(), 0, 0);
    }

    static Stage stage(String name, long startNanos, String note) {
        return new Stage(name, (System.nanoTime() - startNanos) / 1_000_000, note);
    }

    public static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String sha256(String s) {
        return sha256(s.getBytes(StandardCharsets.UTF_8));
    }
}
