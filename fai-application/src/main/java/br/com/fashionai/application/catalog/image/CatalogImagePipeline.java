package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.GarmentCrop;
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
import java.util.Set;

/**
 * Pipeline de imagens da Busca Catalogada (CATALOG_IMAGE_PIPELINE_V4), puro (sem rede, banco ou disco):
 * SOURCE → VALIDATION → PRODUCT DETECTION → SEGMENTATION → DISTRACTOR REMOVAL → CATEGORY-AWARE ROI → SEMANTIC REFRAMING
 * → BACKGROUND NORMALIZATION → DETAIL PRESERVATION → QUALITY CHECK → CATALOG MASTER IMAGE.
 *
 * <p>Dois níveis (RN47.03): fonte sem permissão de persistência gera só metadados (recorte semântico, foco, métricas,
 * veredito) e o card mostra a URL original com esse recorte; fonte com {@code allows_image_persistence} também gera o
 * master (PNG transparente + variantes branco/neutro/card/thumb) para o storage do FashionAI.
 */
public final class CatalogImagePipeline {
    public static final String VERSION = "CATALOG_IMAGE_PIPELINE_V4";
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
                           BackgroundNormalizer.Rendered rendered, List<Stage> stages, Map<String, Object> debug,
                           CatalogPreviewRenderer.Frames previewFrames) {
        public static Analysis rejected(String reason, String mime, int w, int h, String sha, List<Stage> stages) {
            return rejected(reason, mime, w, h, sha, stages, Map.of());
        }

        public static Analysis rejected(String reason, String mime, int w, int h, String sha, List<Stage> stages, Map<String, Object> debug) {
            return new Analysis(CatalogImageValidator.Outcome.REJECTED, List.of(reason), false, 0, mime, w, h, sha, null, null,
                    null, null, null, Map.of(), 0, null, false, null, stages, debug, null);
        }

        /** Metadados do recorte gravados em crop_json e lidos pelo card (coordenadas normalizadas da foto original). */
        public Map<String, Object> cropJson() {
            Map<String, Object> m = new LinkedHashMap<>();
            if (crop == null) {
                return m;
            }
            m.put("aspect", crop.compliance().getOrDefault("aspect", "4:5"));
            m.put("crop", crop.best().crop().toMap());
            m.put("focus", Map.of("name", focus.name(), "rect", focus.rect().toMap(), "source", focus.source()));
            m.put("product", productBox.toMap());
            m.put("analysis", crop.analysis().toMap());
            if (crop.detail() != null) {
                m.put("detail", crop.detail().toMap());
            }
            m.put("background", background);
            m.put("padding", NRect.r4(crop.best().padding()));
            if (crop.rule() != null) {
                m.put("rule", crop.rule().toMap());
                m.put("ruleCompliant", crop.compliance().get("ok"));
            }
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
    private final CatalogPersonEvidence people;

    public CatalogImagePipeline(SemanticRegionRegistry registry, PersonSegmentationPort persons) {
        this.registry = registry;
        this.people = new CatalogPersonEvidence(persons);
    }

    public Analysis run(Request req) {
        List<Stage> stages = new ArrayList<>();
        long t = System.nanoTime();
        // VALIDATION — pelo conteúdo (magic bytes), não pelo Content-Type do servidor
        CatalogSourceIntake.Decoded source = CatalogSourceIntake.decode(req.bytes(), t);
        if (source.rejected() != null) {
            return source.rejected();
        }
        String mime = source.mime(), sha = source.sha();
        BufferedImage src = source.image();
        int w = src.getWidth(), h = src.getHeight();
        String phash = PerceptualHash.dHash(src);
        stages.add(stage("VALIDATION", t, mime + " " + w + "x" + h));

        // PRODUCT DETECTION + SEGMENTATION + DISTRACTOR REMOVAL (máscara sem distratores e sem cabide)
        t = System.nanoTime();
        PieceType type = PieceType.of(req.category());
        ProductSegmenter.Segmentation seg = segmenter.segment(src, type);
        stages.add(stage("SEGMENTATION", t, "coverage=" + NRect.r4(seg.coverage()) + " conf=" + NRect.r4(seg.confidence())));
        double productPx = Math.min(seg.productBox().w() * w, seg.productBox().h() * h);
        if (seg.empty() || productPx < ImageQualityAnalyzer.MIN_PRODUCT_PX) {
            // o recorte local perdeu a peça (escura/clara demais para ele): o quadro só de tecido e o da regra do produto têm
            // máscara própria (fundo de estúdio)
            FabricFrame.Mask mask = FabricFrame.mask(seg, type);
            FabricFrame.Result fabric = FabricFrame.find(mask, type, req.subcategory(), null);
            ProductRuleFrame.Result productFrame = people.checkPerson(src,
                    ProductRuleFrame.find(mask, seg, type, req.subcategory(), registry, ProductRuleFrame.ASPECT_W, ProductRuleFrame.ASPECT_H, null));
            Map<String, Object> early = new LinkedHashMap<>();
            early.put("fabricFrame", fabric.toMap());
            early.put("productFrame", productFrame.toMap());
            return Analysis.rejected(seg.empty() ? "NO_PRODUCT" : "IMAGE_TOO_SMALL", mime, w, h, sha, stages, early);
        }
        t = System.nanoTime();
        double human = people.humanEvidence(src, seg);
        stages.add(stage("DISTRACTOR_REMOVAL", t, "distractors=" + seg.distractors().size() + " hanger=" + seg.hangerTrimmed()
                + " human=" + NRect.r4(human)));

        // CATEGORY-AWARE ROI
        t = System.nanoTime();
        SemanticRegionRegistry.Profile profile = registry.profile(type, req.subcategory());
        BufferedImage product = seg.productOnly();
        LandmarkDetector.Result lm = landmarks.detect(product, type.landmarkFamily(req.subcategory()));
        FramingStrategy.Focus focus = FramingStrategy.forType(type).focus(seg.productBox(), profile, lm);
        GarmentCrop.LowerRegion lower = type == PieceType.LOWER_PIECE ? GarmentCrop.lowerRegion(product, human >= 0.06) : null;
        if (lower != null) {
            focus = CatalogCropGeometry.waistFocus(seg, profile, lower);
        }
        stages.add(stage("ROI", t, focus.name() + " via " + focus.source()));

        // QUADRO SÓ DE TECIDO (lote de enquadramento por categoria): maior 3:4 dentro da máscara do tecido, sem fundo,
        // cabide nem pessoa; o segmentador de pessoa, quando existe, confere o quadro escolhido
        t = System.nanoTime();
        FabricFrame.Mask mask = FabricFrame.mask(seg, type);
        FabricFrame.Result fabric = people.checkFabric(seg, FabricFrame.find(mask, type, req.subcategory(), focus));
        stages.add(stage("FABRIC_FRAME", t, fabric.ok() ? "ok " + fabric.target() : String.valueOf(fabric.reason())));

        // REGRA DO PRODUTO no quadro do editor (lote de enquadramento do acervo, V3): a mesma regra do card, 3:4, sobre a
        // mesma máscara; o segmentador de pessoa, quando existe, confere o quadro escolhido
        t = System.nanoTime();
        ProductRuleFrame.Result productFrame = people.checkPerson(src,
                ProductRuleFrame.find(mask, seg, type, req.subcategory(), registry, ProductRuleFrame.ASPECT_W, ProductRuleFrame.ASPECT_H, focus));
        stages.add(stage("PRODUCT_RULE_FRAME", t, productFrame.ok() ? "ok " + productFrame.target() : String.valueOf(productFrame.reason())));

        // SEMANTIC REFRAMING
        t = System.nanoTime();
        SemanticCropper.Result crop = cropper.crop(w, h, registry.aspectRatio(), seg.productBox(), CatalogCropGeometry.centroid(seg), focus, profile,
                seg.distractors(), seg.truncatedSides());
        if (type == PieceType.UPPER_PIECE || type == PieceType.LOWER_PIECE || type == PieceType.FULL_BODY_PIECE) {
            crop = CatalogCropGeometry.fabricCover(seg, product, crop, focus, lower == null ? ImageOps.alphaBounds(product) : lower.box(), type == PieceType.LOWER_PIECE);
        }
        stages.add(stage("REFRAMING", t, "cropScore=" + NRect.r4(crop.best().score()) + " fill=" + NRect.r4(crop.best().fill())));

        double sourceHuman = human;
        if (lower != null && lower.estimatedPerson() && Boolean.TRUE.equals(crop.compliance().get("foregroundOnly"))) {
            NRect c = crop.best().crop();
            BufferedImage selected = ImageOps.crop(product, new ImageOps.Box((int) Math.round(c.x() * seg.width()), (int) Math.round(c.y() * seg.height()),
                    (int) Math.round(c.w() * seg.width()), (int) Math.round(c.h() * seg.height())));
            human = people.cropHumanEvidence(selected);
        }

        // BACKGROUND NORMALIZATION + DETAIL PRESERVATION (só nível B)
        BackgroundNormalizer.Rendered rendered = null;
        double color = 1, reconstruction = 1;
        List<String> extra = new ArrayList<>();
        if (Boolean.FALSE.equals(crop.compliance().get("foregroundOnly"))) extra.add("FULL_FRAME_UNAVAILABLE");
        if (req.persist()) {
            t = System.nanoTime();
            rendered = normalizer.render(seg, crop.best().crop(), Boolean.TRUE.equals(crop.compliance().get("foregroundOnly")) && type == PieceType.LOWER_PIECE ? 2.0 : registry.aspectRatio());
            if (rendered == null) {
                extra.add("IMAGE_TOO_SMALL_FOR_MASTER");
            } else {
                color = rendered.colorPreservation();
            }
            reconstruction = human >= 0.06 ? 0 : 1;   // pessoa sobre a peça exigiria reconstruir pixels: não fazemos
            stages.add(stage("BACKGROUND_NORMALIZATION", t, rendered == null ? "too small" : rendered.width() + "x" + rendered.height()
                    + " color=" + NRect.r4(color)));
        }

        // REGRA DE ENQUADRAMENTO (§9.1), fragmento da segmentação e vista declarada diferente da exigida: revisão
        CatalogAnalysisReport.reviewReasons(extra, crop, seg, req.imageType());

        // QUALITY CHECK
        t = System.nanoTime();
        Boolean logoInside = CatalogCropGeometry.logoInside(product, crop.best().crop());
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
        Map<String, Object> debug = CatalogAnalysisReport.debug(seg, focus, lm, crop, registry.version(), sourceHuman, human, fabric, productFrame);
        return new Analysis(outcome, List.copyOf(reasons), verdict.manualReview() || outcome == CatalogImageValidator.Outcome.NEEDS_REPROCESSING,
                verdict.confidence(), mime, w, h, sha, phash, type, seg.productBox(), focus, crop, report.metrics(), report.overall(),
                String.format("#%06x", seg.backgroundRgb() & 0xFFFFFF), detailView, rendered, List.copyOf(stages), debug,
                req.persist() ? CatalogPreviewRenderer.render(src, seg, product, productFrame, sourceHuman, detailView) : null);
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
