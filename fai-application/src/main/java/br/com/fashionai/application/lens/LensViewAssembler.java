package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.hype.StyleCompatibility;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.LensDetectionStatus;

import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Visões do Lens com a camada viva calculada na leitura: scan, peça detectada (com a melhor correspondência) e a
 * leitura do look (estilo, paleta, DNA, Hype do grupo e impacto no guarda-roupa). Nada disso é gravado.
 */
final class LensViewAssembler {
    private final LensMatcher matcher;
    private final HypeScoreConfig hypeConfig;

    LensViewAssembler(LensMatcher matcher, HypeScoreConfig hypeConfig) {
        this.matcher = matcher;
        this.hypeConfig = hypeConfig;
    }

    LensViews.ScanView view(LensRequestContext ctx, LensScan scan, List<LensDetection> all) {
        List<LensDetection> active = all.stream().filter(d -> d.getDismissedAt() == null)
                .sorted(Comparator.comparingInt(LensDetection::getOrdinal)).toList();
        List<LensViews.DetectionView> ds = active.stream().map(d -> detectionView(ctx, d)).toList();
        return new LensViews.ScanView(scan.getId(), scan.getStatus().name(), scan.getErrorCode(), scan.getSource().name(),
                scan.getIntent().name(), scan.getCreatedAt(), scan.getSavedAt() == null ? scan.getExpiresAt() : null,
                scan.getSavedAt(), scan.getWidth(), scan.getHeight(), scan.getFacesRedacted(), scan.getAiSource(),
                scan.getAlgorithmVersion(), scan.getModelVersion(), ds, reading(ctx, active));
    }

    LensViews.DetectionView detectionView(LensRequestContext ctx, LensDetection d) {
        double conf = d.getConfidence() == null ? 0 : d.getConfidence().doubleValue();
        LensViews.TopMatch top = null;
        if (d.getDismissedAt() == null) {
            List<LensSimilarity.Ranked<WardrobeItem>> m = matcher.closetMatches(ctx, d);
            top = m.isEmpty() ? null : new LensViews.TopMatch(m.get(0).target().getId(), m.get(0).score().similarity());
        }
        String status = d.getDismissedAt() != null ? LensDetectionStatus.DISMISSED.name() : d.getStatus().name();
        return new LensViews.DetectionView(d.getId(), d.getOrdinal(), LensDetectionFields.box(d), d.getLabel() == null
                ? LensDetectionFields.defaultLabel(d.getCategory(), d.getSubcategory()) : d.getLabel(), d.getCategory(),
                d.getSubcategory(), LensDetectionFields.colors(d), d.getMaterial(), d.getPattern(),
                Json.csv(d.getStyleTags()), Json.csv(d.getOccasionTags()), Math.round(conf * 100) / 100.0,
                LensConfig.confidenceBand(conf), status, d.getWantedAt() != null, d.getOwnedItemId(), top);
    }

    LensViews.ReadingView reading(LensRequestContext ctx, List<LensDetection> ds) {
        List<LensReading.Piece> ps = ds.stream().map(LensDetectionFields::readingPiece).toList();
        LensViews.Fit fit = null;
        StyleCompatibility.Profile dna = ctx.dna();
        if (dna != null && !ps.isEmpty()) {
            Set<String> styles = new LinkedHashSet<>(), occasions = new LinkedHashSet<>();
            ps.forEach(p -> {
                styles.addAll(p.styles());
                occasions.addAll(p.occasions());
            });
            Map<String, Object> c = StyleCompatibility.score(dna,
                    StyleCompatibility.profile(styles, LensReading.colorsWithFamily(ps), occasions));
            if (c != null) {
                @SuppressWarnings("unchecked") Map<String, Object> parts = (Map<String, Object>) c.get("parts");
                fit = new LensViews.Fit((Number) c.get("score"), parts);
            }
        }
        // Hype do grupo: a peça maior com grupo disponível; sem nenhuma, "dados insuficientes" com o maior grupo visto
        LensViews.Trend trend = new LensViews.Trend("INSUFFICIENT_DATA", null, null, null, null, null, 0);
        List<LensReading.Piece> byArea = ps.stream().sorted(Comparator.comparingDouble(LensReading.Piece::area).reversed()).toList();
        for (LensReading.Piece p : byArea) {
            LensViews.Trend t = groupTrend(ctx, p);
            if ("AVAILABLE".equals(t.status())) {
                trend = t;
                break;
            }
            if (t.items() > trend.items()) {
                trend = t;
            }
        }
        Set<UUID> owned = new HashSet<>(), redundant = new HashSet<>();
        int gaps = 0;
        for (LensDetection d : ds) {
            List<LensSimilarity.Ranked<WardrobeItem>> m = matcher.closetMatches(ctx, d);
            if (m.isEmpty()) {
                gaps++;
            }
            m.forEach(r -> {
                owned.add(r.target().getId());
                if (r.score().similarity() >= LensConfig.REDUNDANT_AT) {
                    redundant.add(r.target().getId());
                }
            });
        }
        return new LensViews.ReadingView(LensReading.styles(ps), LensReading.palette(ps), LensReading.occasions(ps),
                LensReading.season(ps), fit, trend, new LensViews.Impact(owned.size(), gaps, redundant.size()));
    }

    /** Hype do grupo de peças públicas e elegíveis com o mesmo par de atributos (≥ 5 itens), como no §10.1. */
    private LensViews.Trend groupTrend(LensRequestContext ctx, LensReading.Piece p) {
        List<String> keys = LensReading.groupKeys(p.category(), p.mainColor(), p.material(), p.styles());
        if (keys.isEmpty()) {
            return new LensViews.Trend("INSUFFICIENT_DATA", null, null, null, null, null, 0);
        }
        return LensReading.trend(keys, ctx.publicGroup(p.category()), score -> hypeConfig.level(score).name(),
                hypeConfig.stablePoints());
    }
}
