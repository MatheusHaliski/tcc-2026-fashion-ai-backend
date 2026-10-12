package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.BrandRegions;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.GarmentCrop;
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
    /** vistas que a origem declara de fato (PACKSHOT, OTHER e DETAIL não dizem qual lado da peça aparece) */
    static final Set<String> VIEWS = Set.of("FRONT", "BACK", "SIDE", "TOP");
    /** Área mínima da peça num packshot (fração da foto): no acervo o menor acessório aprovado ocupa 13%; abaixo de 8% é fragmento. */
    static final double MIN_PRODUCT_AREA = 0.08;
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
            return rejected(reason, mime, w, h, sha, stages, Map.of());
        }

        public static Analysis rejected(String reason, String mime, int w, int h, String sha, List<Stage> stages, Map<String, Object> debug) {
            return new Analysis(CatalogImageValidator.Outcome.REJECTED, List.of(reason), false, 0, mime, w, h, sha, null, null,
                    null, null, null, Map.of(), 0, null, false, null, stages, debug);
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
        double productPx = Math.min(seg.productBox().w() * w, seg.productBox().h() * h);
        if (seg.empty() || productPx < ImageQualityAnalyzer.MIN_PRODUCT_PX) {
            // o recorte local perdeu a peça (escura/clara demais para ele): o quadro só de tecido e o da regra do produto têm
            // máscara própria (fundo de estúdio)
            FabricFrame.Mask mask = FabricFrame.mask(seg, type);
            FabricFrame.Result fabric = FabricFrame.find(mask, type, req.subcategory(), null);
            ProductRuleFrame.Result productFrame = checkPerson(src,
                    ProductRuleFrame.find(mask, seg, type, req.subcategory(), registry, ProductRuleFrame.ASPECT_W, ProductRuleFrame.ASPECT_H, null));
            Map<String, Object> early = new LinkedHashMap<>();
            early.put("fabricFrame", fabric.toMap());
            early.put("productFrame", productFrame.toMap());
            return Analysis.rejected(seg.empty() ? "NO_PRODUCT" : "IMAGE_TOO_SMALL", mime, w, h, sha, stages, early);
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
        GarmentCrop.LowerRegion lower = type == PieceType.LOWER_PIECE ? GarmentCrop.lowerRegion(product, human >= 0.06) : null;
        if (lower != null) {
            ImageOps.Box region = lower.box();
            NRect waist = new NRect(region.x() / (double) seg.width(), region.y() / (double) seg.height(),
                    region.w() / (double) seg.width(), region.h() / (double) seg.height());
            focus = new FramingStrategy.Focus(profile.focus().name(), waist.sub(new NRect(0, 0, 1, 0.50)),
                    List.of(new SemanticRegionRegistry.Region("waistband", waist.sub(new NRect(0.05, 0, 0.9, 0.12)))),
                    lower.estimatedPerson() ? "ESTIMATED_PERSON_WAIST" : "WAIST_TO_CROTCH_MASK");
        }
        stages.add(stage("ROI", t, focus.name() + " via " + focus.source()));

        // QUADRO SÓ DE TECIDO (lote de enquadramento por categoria): maior 3:4 dentro da máscara do tecido, sem fundo,
        // cabide nem pessoa; o segmentador de pessoa, quando existe, confere o quadro escolhido
        t = System.nanoTime();
        FabricFrame.Mask mask = FabricFrame.mask(seg, type);
        FabricFrame.Result fabric = FabricFrame.find(mask, type, req.subcategory(), focus);
        if (fabric.ok()) {
            NRect fc = fabric.crop();
            BufferedImage selected = ImageOps.crop(seg.cutout(), new ImageOps.Box((int) Math.round(fc.x() * seg.width()), (int) Math.round(fc.y() * seg.height()),
                    (int) Math.round(fc.w() * seg.width()), (int) Math.round(fc.h() * seg.height())));
            if (fabricHumanEvidence(selected)) {
                fabric = new FabricFrame.Result(false, "HUMAN_IN_FABRIC_FRAME", fc, fabric.target(), fabric.anchorSource(), fabric.anchorX(),
                        fabric.anchorY(), fabric.region(), fabric.fabricCoverage(), fabric.skinExcluded(), fabric.cropWidthPx(), fabric.erosionPx());
            }
        }
        stages.add(stage("FABRIC_FRAME", t, fabric.ok() ? "ok " + fabric.target() : String.valueOf(fabric.reason())));

        // REGRA DO PRODUTO no quadro do editor (lote de enquadramento do acervo, V3): a mesma regra do card, 3:4, sobre a
        // mesma máscara; o segmentador de pessoa, quando existe, confere o quadro escolhido
        t = System.nanoTime();
        ProductRuleFrame.Result productFrame = checkPerson(src,
                ProductRuleFrame.find(mask, seg, type, req.subcategory(), registry, ProductRuleFrame.ASPECT_W, ProductRuleFrame.ASPECT_H, focus));
        stages.add(stage("PRODUCT_RULE_FRAME", t, productFrame.ok() ? "ok " + productFrame.target() : String.valueOf(productFrame.reason())));

        // SEMANTIC REFRAMING
        t = System.nanoTime();
        SemanticCropper.Result crop = cropper.crop(w, h, registry.aspectRatio(), seg.productBox(), centroid(seg), focus, profile,
                seg.distractors(), seg.truncatedSides());
        if (type == PieceType.UPPER_PIECE || type == PieceType.LOWER_PIECE || type == PieceType.FULL_BODY_PIECE) {
            crop = fabricCover(seg, product, crop, focus, lower == null ? ImageOps.alphaBounds(product) : lower.box(), type == PieceType.LOWER_PIECE);
        }
        stages.add(stage("REFRAMING", t, "cropScore=" + NRect.r4(crop.best().score()) + " fill=" + NRect.r4(crop.best().fill())));

        double sourceHuman = human;
        if (lower != null && lower.estimatedPerson() && Boolean.TRUE.equals(crop.compliance().get("foregroundOnly"))) {
            NRect c = crop.best().crop();
            BufferedImage selected = ImageOps.crop(product, new ImageOps.Box((int) Math.round(c.x() * seg.width()), (int) Math.round(c.y() * seg.height()),
                    (int) Math.round(c.w() * seg.width()), (int) Math.round(c.h() * seg.height())));
            human = cropHumanEvidence(selected);
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

        // REGRA DE ENQUADRAMENTO (§9.1): recorte fora da regra ou vista declarada diferente da exigida vão para revisão
        if (crop.rule() != null && Boolean.FALSE.equals(crop.compliance().get("ok"))) {
            extra.add("FRAMING_RULE_NOT_MET");
        }
        // fragmento: num packshot a peça nunca ocupa só uma lasca da foto — peça clara sobre fundo claro faz a segmentação
        // pegar só o detalhe escuro (patch, logo) e o recorte vira um close do detalhe. Foto de detalhe declarada fica de fora.
        NRect box = seg.productBox();
        if (!"DETAIL".equalsIgnoreCase(req.imageType()) && box.w() * box.h() < MIN_PRODUCT_AREA) {
            extra.add("SEGMENTATION_FRAGMENT");
        }
        String required = crop.rule() == null ? "ANY" : crop.rule().view();
        String declared = req.imageType() == null ? null : req.imageType().toUpperCase(java.util.Locale.ROOT);
        if (!"ANY".equals(required) && declared != null && VIEWS.contains(declared) && !declared.equals(required)) {
            extra.add("VIEW_MISMATCH_" + required);
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
        debug.put("sourceHumanEvidence", NRect.r4(sourceHuman));
        debug.put("cropHumanEvidence", NRect.r4(human));
        debug.put("fabricFrame", fabric.toMap());
        debug.put("productFrame", productFrame.toMap());
        if (crop.rule() != null) {
            debug.put("framingRule", crop.rule().toMap());
            debug.put("ruleCompliance", crop.compliance());
        }
        return new Analysis(outcome, List.copyOf(reasons), verdict.manualReview() || outcome == CatalogImageValidator.Outcome.NEEDS_REPROCESSING,
                verdict.confidence(), mime, w, h, sha, phash, type, seg.productBox(), focus, crop, report.metrics(), report.overall(),
                String.format("#%06x", seg.backgroundRgb() & 0xFFFFFF), detailView, rendered, List.copyOf(stages), debug);
    }

    private static SemanticCropper.Result fabricCover(ProductSegmenter.Segmentation seg, BufferedImage product,
                                                       SemanticCropper.Result prior, FramingStrategy.Focus focus, ImageOps.Box region, boolean lower) {
        var found = GarmentCrop.find(product, lower ? 2 : 4, lower ? 1 : 5, focus.rect().cx() * seg.width(), lower ? region.y() + Math.min(region.h(), region.w() / 2.0) * 0.32 : focus.rect().cy() * seg.height(), region);
        Map<String, Object> compliance = new LinkedHashMap<>(prior.compliance());
        compliance.put("mode", "GARMENT_COVER");
        compliance.put("pipelineVersion", GarmentCrop.VERSION);
        if (found.isEmpty()) {
            compliance.put("foregroundOnly", false);
            compliance.put("ok", false);
            return new SemanticCropper.Result(prior.best(), prior.detail(), prior.analysis(), prior.candidates(), prior.rule(), compliance);
        }
        ImageOps.Box box = found.get();
        NRect crop = new NRect(box.x() / (double) seg.width(), box.y() / (double) seg.height(),
                box.w() / (double) seg.width(), box.h() / (double) seg.height());
        double fx = (focus.rect().cx() - crop.x()) / crop.w(), fy = (focus.rect().cy() - crop.y()) / crop.h();
        boolean focused = fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1;
        double critical = focus.critical().stream().mapToDouble(r -> r.rect().insideOf(crop)).max().orElse(1);
        Map<String, Double> parts = new LinkedHashMap<>(prior.best().parts());
        parts.put("completeness", 1.0); // the whole-piece analysis ROI and source are retained separately
        parts.put("critical", critical);
        parts.put("focus", focused ? 1.0 : focus.rect().insideOf(crop));
        parts.put("occupancy", 1.0);
        parts.put("margin", 1.0);
        parts.put("padding", 1.0);
        parts.put("foregroundCoverage", 1.0);
        compliance.put("aspect", lower ? "2:1" : "4:5");
        compliance.put("foregroundOnly", true);
        compliance.put("foregroundCoverage", 1.0);
        compliance.put("frameFilledByProduct", 1.0);
        compliance.put("widthFilledByProduct", 1.0);
        compliance.put("productInsideFrame", NRect.r4(seg.productBox().insideOf(crop)));
        compliance.put("focusCenter", Map.of("x", NRect.r4(fx), "y", NRect.r4(fy)));
        compliance.put("focusInTopHalf", focused && fy <= 0.5);
        compliance.put("ok", focused && (prior.rule() == null || !prior.rule().focusTopHalf() || fy <= 0.5));
        double score = 0.7 + 0.2 * parts.get("focus") + 0.1 * parts.get("distractor");
        var candidate = new SemanticCropper.Candidate(crop, score, 1, 0, parts);
        List<SemanticCropper.Candidate> candidates = new ArrayList<>();
        candidates.add(candidate); candidates.addAll(prior.candidates());
        return new SemanticCropper.Result(candidate, prior.detail(), prior.analysis(), List.copyOf(candidates), prior.rule(), compliance);
    }

    private double cropHumanEvidence(BufferedImage selected) {
        int[] pixels = selected.getRGB(0, 0, selected.getWidth(), selected.getHeight(), null, 0, selected.getWidth());
        boolean[] opaque = new boolean[pixels.length];
        java.util.Arrays.fill(opaque, true);
        double skin = ProductSegmenter.foreignSkin(pixels, opaque);
        if (persons != null && persons.available()) {
            try {
                Optional<PersonParts> parts = persons.segment(selected);
                if (parts.isPresent()) skin = Math.max(skin, parts.get().person() * (parts.get().bodySkin() + parts.get().faceSkin()));
            } catch (RuntimeException ignored) { /* local evidence remains available */ }
        }
        // This crop promises fabric only: residual hands/skin require review even when they occupy a small region.
        return skin > 0.005 ? Math.max(0.06, skin) : 0;
    }

    /**
     * Segunda opinião sobre o quadro da regra do produto: com o segmentador de pessoa, pele/rosto no quadro (parte da foto)
     * recusa — numa parte de cima/baixo, o quadro mostraria a pessoa; num objeto, ele não está isolado.
     */
    private ProductRuleFrame.Result checkPerson(BufferedImage src, ProductRuleFrame.Result r) {
        if (!r.ok() || persons == null || !persons.available()) return r;
        NRect c = r.crop().clampTo(new NRect(0, 0, 1, 1));
        int x = (int) Math.round(c.x() * src.getWidth()), y = (int) Math.round(c.y() * src.getHeight());
        int cw = Math.min(src.getWidth() - x, (int) Math.round(c.w() * src.getWidth())), ch = Math.min(src.getHeight() - y, (int) Math.round(c.h() * src.getHeight()));
        if (cw < 8 || ch < 8 || !fabricHumanEvidence(ImageOps.crop(src, new ImageOps.Box(x, y, cw, ch)))) return r;
        boolean garment = r.rule() != null && r.rule().fit() == SemanticRegionRegistry.FramingRule.Fit.COVER
                && r.rule().align() == SemanticRegionRegistry.FramingRule.Align.TOP;
        return new ProductRuleFrame.Result(false, garment ? "HUMAN_IN_FRAME" : "PIECE_NOT_ISOLATED", r.crop(), r.aspectW(), r.aspectH(),
                r.rule(), r.ruleOrigin(), r.registryVersion(), r.pieceType(), r.subcategory(), r.target(), r.focusName(), r.focus(),
                r.product(), true, r.skinShare(), r.garmentCoverage(), r.coverageScope(), r.objectInside(), r.padding(), r.background(),
                r.truncated(), r.sideView(), r.compliance(), r.cropWidthPx(), r.observations());
    }

    /**
     * Segunda opinião sobre o quadro só de tecido: o segmentador de pessoa, quando existe, não pode ver pele/rosto no quadro.
     * Sem ele vale a máscara do tecido (que já tirou as manchas de pele); a heurística local de pele daria falso positivo em
     * estampas bege/rosadas.
     */
    private boolean fabricHumanEvidence(BufferedImage selected) {
        if (persons == null || !persons.available()) return false;
        try {
            Optional<PersonParts> parts = persons.segment(selected);
            return parts.isPresent() && parts.get().person() * (parts.get().bodySkin() + parts.get().faceSkin()) > 0.02;
        } catch (RuntimeException e) {
            return false;
        }
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
