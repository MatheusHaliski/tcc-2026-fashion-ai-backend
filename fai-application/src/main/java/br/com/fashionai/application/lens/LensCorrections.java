package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.vision.analysis.GarmentEmbedder;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.model.enums.LensDetectionStatus;
import br.com.fashionai.domain.model.enums.LensFeedbackKind;
import br.com.fashionai.domain.model.enums.LensScanStatus;
import br.com.fashionai.domain.repository.LensDetectionRepository;
import br.com.fashionai.domain.repository.LensScanRepository;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.lens.LensDetectionFields.colors;
import static br.com.fashionai.application.lens.LensDetectionFields.defaultLabel;
import static br.com.fashionai.application.lens.LensDetectionFields.round4;
import static br.com.fashionai.application.lens.LensDetectionFields.withMainColor;
import static br.com.fashionai.application.lens.LensFeedbackLog.snapshot;
import static br.com.fashionai.application.lens.LensInputs.blankToNull;
import static br.com.fashionai.application.lens.LensInputs.eq;
import static br.com.fashionai.application.lens.LensInputs.invalid;

/**
 * Correções da pessoa sobre a leitura: atributos (chips), "não é roupa" e a peça que o detector não viu. Cada mudança
 * vira uma linha em {@code lens_feedback} ({@link LensFeedbackLog}) e a peça volta com a correspondência recalculada.
 */
final class LensCorrections {
    static final Set<String> PATTERNS = Set.of("solid", "striped", "checked", "printed");

    private final LensScanRepository scans;
    private final LensDetectionRepository detections;
    private final MediaStoragePort storage;
    private final LensFeedbackLog feedbackLog;
    private final LensViewAssembler views;
    private final LensRequestContext.Sources live;

    LensCorrections(LensScanRepository scans, LensDetectionRepository detections, MediaStoragePort storage,
                    LensFeedbackLog feedbackLog, LensViewAssembler views, LensRequestContext.Sources live) {
        this.scans = scans;
        this.detections = detections;
        this.storage = storage;
        this.feedbackLog = feedbackLog;
        this.views = views;
        this.live = live;
    }

    LensViews.DetectionView correct(CurrentUser user, LensScan scan, LensDetection d, LensService.CorrectionCommand cmd) {
        if (cmd == null) {
            return views.detectionView(live.open(user), d);
        }
        Map<String, Object> before = snapshot(d);
        Set<LensFeedbackKind> kinds = new LinkedHashSet<>();

        String category = d.getCategory(), subcategory = d.getSubcategory();
        if (cmd.subcategory() != null) {
            String sub = blankToNull(cmd.subcategory());
            if (sub != null && Taxonomy.categoryOf(sub) == null) {
                throw invalid("subcategory");
            }
            subcategory = sub;
            if (sub != null) {
                category = Taxonomy.categoryOf(sub);
            }
        }
        if (cmd.category() != null && cmd.subcategory() == null) {
            String cat = blankToNull(cmd.category());
            if (cat != null && !Taxonomy.isValidCategory(cat)) {
                throw invalid("category");
            }
            category = cat;
            if (subcategory != null && (cat == null || !cat.equals(Taxonomy.categoryOf(subcategory)))) {
                subcategory = null;
            }
        }
        if (!eq(category, d.getCategory()) || !eq(subcategory, d.getSubcategory())) {
            d.setCategory(category);
            d.setSubcategory(subcategory);
            d.setLabel(defaultLabel(category, subcategory));
            d.setOccasionTags(Json.csv(Taxonomy.keepAllowed(Json.csv(d.getOccasionTags()), Taxonomy.allowedOccasions(category),
                    Taxonomy.MAX_PIECE_TAGS)));
            kinds.add(LensFeedbackKind.WRONG_CATEGORY);
        }
        if (cmd.color() != null) {
            String color = blankToNull(cmd.color());
            if (color != null && !Taxonomy.COLORS.containsKey(color)) {
                throw invalid("color");
            }
            List<LensViews.ColorShare> colors = colors(d);
            String main = colors.isEmpty() ? null : colors.get(0).name();
            if (!eq(color, main)) {
                d.setColorsJson(Json.write(withMainColor(colors, color)));
                kinds.add(LensFeedbackKind.WRONG_COLOR);
            }
        }
        if (cmd.material() != null) {
            String material = blankToNull(cmd.material());
            material = material == null ? null : material.toUpperCase(Locale.ROOT);
            if (material != null && !Taxonomy.MATERIALS.contains(material)) {
                throw invalid("material");
            }
            if (!eq(material, d.getMaterial())) {
                d.setMaterial(material);
                kinds.add(LensFeedbackKind.WRONG_ATTRIBUTE);
            }
        }
        if (cmd.pattern() != null) {
            String pattern = blankToNull(cmd.pattern());
            pattern = pattern == null ? null : pattern.toLowerCase(Locale.ROOT);
            if (pattern != null && !PATTERNS.contains(pattern)) {
                throw invalid("pattern");
            }
            if (!eq(pattern, d.getPattern())) {
                d.setPattern(pattern);
                kinds.add(LensFeedbackKind.WRONG_ATTRIBUTE);
            }
        }
        if (cmd.styles() != null) {
            List<String> styles = Taxonomy.canonicalTags(cmd.styles());
            if (styles.size() > Taxonomy.MAX_PIECE_TAGS || !Taxonomy.STYLES.containsAll(styles)) {
                throw invalid("styles");
            }
            if (!new HashSet<>(styles).equals(new HashSet<>(Json.csv(d.getStyleTags())))) {
                d.setStyleTags(Json.csv(styles));
                kinds.add(LensFeedbackKind.WRONG_ATTRIBUTE);
            }
        }
        if (!kinds.isEmpty() && d.getStatus() == LensDetectionStatus.DETECTED) {
            d.setStatus(LensDetectionStatus.CORRECTED);
        }
        if (Boolean.TRUE.equals(cmd.dismissed()) && d.getDismissedAt() == null) {
            d.setDismissedAt(Instant.now());
            kinds.add(LensFeedbackKind.NOT_CLOTHING);
        } else if (Boolean.FALSE.equals(cmd.dismissed())) {
            d.setDismissedAt(null);
        }
        detections.save(d);
        if (!kinds.isEmpty()) {
            boolean consent = feedbackLog.trainingConsent(user.id());
            Map<String, Object> after = snapshot(d);
            for (LensFeedbackKind k : kinds) {
                feedbackLog.recordFeedback(scan, d, user.id(), k, before, after, consent);
            }
        }
        return views.detectionView(live.open(user), d);
    }

    /** A pessoa marca uma peça que o detector não viu: caixa em % + categoria (status ADDED_BY_USER). */
    LensViews.DetectionView add(CurrentUser user, LensScan scan, LensService.AddDetectionCommand cmd) {
        LensViews.Box box = LensDetectionFields.box(cmd == null ? null : cmd.box());
        String sub = blankToNull(cmd.subcategory());
        String category = blankToNull(cmd.category());
        if (sub != null) {
            if (Taxonomy.categoryOf(sub) == null) {
                throw invalid("subcategory");
            }
            category = Taxonomy.categoryOf(sub);
        }
        if (!Taxonomy.isValidCategory(category)) {
            throw invalid("category");
        }
        String color = blankToNull(cmd.color());
        if (color != null && !Taxonomy.COLORS.containsKey(color)) {
            throw invalid("color");
        }
        List<LensDetection> all = detections.findByScanIdOrderByOrdinalAsc(scan.getId());
        LensDetection d = new LensDetection();
        d.setScanId(scan.getId());
        d.setOrdinal(all.stream().mapToInt(LensDetection::getOrdinal).max().orElse(-1) + 1);
        d.setBoxJson(Json.write(box));
        d.setCategory(category);
        d.setSubcategory(sub);
        d.setLabel(defaultLabel(category, sub));
        d.setConfidence(BigDecimal.ONE.setScale(3, RoundingMode.HALF_UP));
        d.setStatus(LensDetectionStatus.ADDED_BY_USER);
        BufferedImage photo = storedImage(scan);
        if (photo != null) {
            LensImageAnalysis.Reading read = LensImageAnalysis.read(photo, box, color);
            d.setColorsJson(Json.write(read.colors()));
            d.setPattern(read.pattern());
            d.setEmbeddingJson(Json.write(round4(read.embedding())));
            d.setEmbeddingModel(GarmentEmbedder.MODEL.key());
        } else if (color != null) {
            d.setColorsJson(Json.write(List.of(new LensViews.ColorShare(color, Taxonomy.hex(color), 1.0))));
        }
        detections.save(d);
        if (scan.getStatus() == LensScanStatus.NO_FASHION_FOUND) {
            scan.setStatus(LensScanStatus.READY);
            scan.setErrorCode(null);
            scans.save(scan);
        }
        feedbackLog.recordFeedback(scan, d, user.id(), LensFeedbackKind.MISSING_PIECE, null, snapshot(d),
                feedbackLog.trainingConsent(user.id()));
        return views.detectionView(live.open(user), d);
    }

    private BufferedImage storedImage(LensScan scan) {
        if (scan.getImageKey() == null) {
            return null;
        }
        try {
            byte[] bytes = storage.get(scan.getImageKey());
            return bytes == null ? null : ImageOps.decode(bytes);
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
