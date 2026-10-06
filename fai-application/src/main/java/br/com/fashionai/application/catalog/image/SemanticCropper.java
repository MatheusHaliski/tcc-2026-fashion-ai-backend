package br.com.fashionai.application.catalog.image;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * SEMANTIC REFRAMING: gera recortes 4:5 candidatos (escala × posição) e escolhe o de maior CropScore. Nunca estica: o
 * recorte tem a proporção exata do quadro em pixels e a peça é só escalada por igual. Quando o recorte passa da borda
 * da foto, o excesso vira smartPadding (preenchido com a cor do fundo), exceto no lado em que a peça já vem cortada.
 *
 * <p>CropScore = 0,30 peça inteira + 0,15 regiões críticas + 0,15 foco na âncora + 0,15 ocupação + 0,10 margem +
 * 0,05 padding + 0,10 sem distrator. Pesos e alvos vêm do perfil da categoria (Category Scale Profile), então peças do
 * mesmo tipo saem na mesma escala em todos os cards.
 */
public final class SemanticCropper {
    static final double FILL_STEP = 0.02;
    static final double MIN_DETAIL_PX = 240;

    public record Candidate(NRect crop, double score, double fill, double padding, Map<String, Double> parts) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("crop", crop.toMap());
            m.put("score", NRect.r4(score));
            m.put("fill", NRect.r4(fill));
            m.put("padding", NRect.r4(padding));
            Map<String, Object> p = new LinkedHashMap<>();
            parts.forEach((k, v) -> p.put(k, NRect.r4(v)));
            m.put("parts", p);
            return m;
        }
    }

    /**
     * @param best       semanticCrop escolhido (catalogMasterImage / card)
     * @param detail     recorte do foco para catalogDetailImage (null quando a foto não tem resolução para isso)
     * @param analysis   caixa da peça com 4% de folga, sem proporção fixa: entrada do analisador de IA
     * @param candidates os 5 melhores candidatos (modo de depuração visual)
     */
    public record Result(Candidate best, NRect detail, NRect analysis, List<Candidate> candidates) {
    }

    public Result crop(int imgW, int imgH, double aspect, NRect product, NRect visualCenter, FramingStrategy.Focus focus,
                       SemanticRegionRegistry.Profile profile, List<NRect> distractors, Set<String> truncated) {
        double pw = product.w() * imgW, ph = product.h() * imgH;
        double[] occ = profile.occupancy();
        double[] anchor = profile.anchor();
        List<Candidate> all = new ArrayList<>();
        for (double f = occ[0]; f <= occ[2] + 1e-9; f += FILL_STEP) {
            double ch = Math.max(ph / f, pw / (f * aspect)), cw = ch * aspect;
            double nw = cw / imgW, nh = ch / imgH;
            double[] xs = {product.cx() - nw / 2, visualCenter.cx() - nw / 2, focus.rect().cx() - anchor[0] * nw};
            double[] ys = {product.cy() - nh / 2, focus.rect().cy() - anchor[1] * nh, product.y() - profile.margin()[1] * nh,
                    product.y2() + profile.margin()[1] * nh - nh};
            for (double x : xs) {
                for (double y : ys) {
                    NRect c = snapTruncated(new NRect(x, y, nw, nh), truncated);
                    all.add(score(c, f, product, focus, profile, distractors, truncated));
                }
            }
        }
        all.sort(Comparator.comparingDouble(Candidate::score).reversed());
        Candidate best = all.get(0);
        return new Result(best, detail(imgW, imgH, aspect, focus.rect()), product.expand(product.w() * 0.04, product.h() * 0.04)
                .clampTo(new NRect(0, 0, 1, 1)), List.copyOf(all.subList(0, Math.min(5, all.size()))));
    }

    /** No lado em que a peça já vem cortada na foto, o recorte encosta na borda (padding ali mostraria o corte). */
    static NRect snapTruncated(NRect c, Set<String> truncated) {
        double x = c.x(), y = c.y();
        if (truncated.contains("top")) {
            y = 0;
        } else if (truncated.contains("bottom")) {
            y = 1 - c.h();
        }
        if (truncated.contains("left")) {
            x = 0;
        } else if (truncated.contains("right")) {
            x = 1 - c.w();
        }
        return new NRect(x, y, c.w(), c.h());
    }

    static Candidate score(NRect c, double fill, NRect product, FramingStrategy.Focus focus, SemanticRegionRegistry.Profile p,
                           List<NRect> distractors, Set<String> truncated) {
        Map<String, Double> parts = new LinkedHashMap<>();
        double complete = product.insideOf(c);
        parts.put("completeness", complete);
        double critical = focus.critical().stream().mapToDouble(r -> r.rect().insideOf(c)).min().orElse(1);
        parts.put("critical", critical);
        double ax = c.x() + p.anchor()[0] * c.w(), ay = c.y() + p.anchor()[1] * c.h();
        double dist = Math.hypot((focus.rect().cx() - ax) / c.w(), (focus.rect().cy() - ay) / c.h());
        parts.put("focus", focus.rect().insideOf(c) * Math.max(0, 1 - dist * 2));
        double[] occ = p.occupancy();
        parts.put("occupancy", Math.max(0, 1 - Math.abs(fill - occ[1]) / Math.max(1e-6, occ[2] - occ[0])));
        double minMargin = Double.MAX_VALUE;
        if (!truncated.contains("left")) {
            minMargin = Math.min(minMargin, (product.x() - c.x()) / c.w());
        }
        if (!truncated.contains("right")) {
            minMargin = Math.min(minMargin, (c.x2() - product.x2()) / c.w());
        }
        if (!truncated.contains("top")) {
            minMargin = Math.min(minMargin, (product.y() - c.y()) / c.h());
        }
        if (!truncated.contains("bottom")) {
            minMargin = Math.min(minMargin, (c.y2() - product.y2()) / c.h());
        }
        parts.put("margin", minMargin == Double.MAX_VALUE ? 1 : Math.max(0, Math.min(1, minMargin / p.margin()[0])));
        double padding = 1 - c.insideOf(new NRect(0, 0, 1, 1));
        parts.put("padding", Math.max(0, 1 - padding * 2));
        double distractor = distractors.stream().mapToDouble(d -> d.insideOf(c)).max().orElse(0);
        parts.put("distractor", 1 - distractor);
        double score = 0.30 * complete + 0.15 * critical + 0.15 * parts.get("focus") + 0.15 * parts.get("occupancy")
                + 0.10 * parts.get("margin") + 0.05 * parts.get("padding") + 0.10 * parts.get("distractor");
        if (complete < 0.999 && truncated.isEmpty()) {
            score *= 0.5;                              // cortar uma peça que veio inteira é o pior erro de enquadramento
        }
        return new Candidate(c, score, fill, padding, parts);
    }

    /** Foco ampliado 15% e levado a 4:5 dentro da foto; null se a região não tem pixels para um detalhe nítido. */
    static NRect detail(int imgW, int imgH, double aspect, NRect focus) {
        double fw = focus.w() * imgW * 1.15, fh = focus.h() * imgH * 1.15;
        if (Math.min(fw, fh) < MIN_DETAIL_PX) {
            return null;
        }
        double ch = Math.max(fh, fw / aspect), cw = ch * aspect;
        if (cw > imgW || ch > imgH) {
            return null;
        }
        double nw = cw / imgW, nh = ch / imgH;
        double x = Math.max(0, Math.min(1 - nw, focus.cx() - nw / 2)), y = Math.max(0, Math.min(1 - nh, focus.cy() - nh / 2));
        return new NRect(x, y, nw, nh);
    }
}
