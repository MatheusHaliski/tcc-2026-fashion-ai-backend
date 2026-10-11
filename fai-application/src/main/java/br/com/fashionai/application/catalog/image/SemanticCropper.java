package br.com.fashionai.application.catalog.image;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.DoubleStream;

/**
 * SEMANTIC REFRAMING: gera recortes 4:5 candidatos (escala × posição) e escolhe o de maior CropScore. Nunca estica: o
 * recorte tem a proporção exata do quadro em pixels e a peça é só escalada por igual. Quando o recorte passa da borda
 * da foto, o excesso vira smartPadding (preenchido com a cor do fundo), exceto no lado em que a peça já vem cortada.
 *
 * <p>CropScore = 0,30 peça inteira + 0,15 regiões críticas + 0,15 foco na âncora + 0,15 ocupação + 0,10 margem +
 * 0,05 padding + 0,10 sem distrator. Pesos e alvos vêm do perfil da categoria (Category Scale Profile), então peças do
 * mesmo tipo saem na mesma escala em todos os cards.
 *
 * <p>Com Regra de Enquadramento no perfil (registro 2.x, §9.1), o recorte é calculado pela regra da categoria — COVER
 * (a peça preenche o quadro), WIDTH (a peça ocupa toda a largura) ou CONTAIN (a peça inteira dentro), alinhado pelo
 * topo, pelo centro ou pelo foco — e o CropScore passa a medir a conformidade com a regra. Os candidatos do modo antigo
 * continuam no resultado para a depuração visual.
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
    public record Result(Candidate best, NRect detail, NRect analysis, List<Candidate> candidates,
                         SemanticRegionRegistry.FramingRule rule, Map<String, Object> compliance) {
        public Result(Candidate best, NRect detail, NRect analysis, List<Candidate> candidates) {
            this(best, detail, analysis, candidates, null, Map.of());
        }
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
        NRect detail = detail(imgW, imgH, aspect, focus.rect());
        NRect analysis = product.expand(product.w() * 0.04, product.h() * 0.04).clampTo(new NRect(0, 0, 1, 1));
        List<Candidate> top = List.copyOf(all.subList(0, Math.min(5, all.size())));
        SemanticRegionRegistry.FramingRule rule = profile.rule();
        if (rule == null) {
            return new Result(best, detail, analysis, top);
        }
        NRect c = keepCutSideInside(ruleCrop(imgW, imgH, aspect, product, focus, rule, profile.margin()[0]), truncated);
        Map<String, Object> compliance = new LinkedHashMap<>();
        Candidate ruled = ruleScore(c, imgW, imgH, product, focus, rule, profile.margin()[0], distractors, compliance);
        return new Result(ruled, detail, analysis, top, rule, compliance);
    }

    /**
     * Regra de Enquadramento do Produto do registro aplicada à caixa da peça, na proporção pedida: o mesmo cálculo para o
     * card do feed ({@code FeedFraming}, 4:5) e para o lote de enquadramento do acervo ({@link ProductRuleFrame}, 3:4) —
     * os dois nunca divergem na regra. O foco é a região do perfil levada para a caixa da peça; a folga é a mínima do perfil,
     * nunca abaixo de {@code marginFloor} (o lote pede 2% em WIDTH/CONTAIN para o arredondamento nunca cortar o objeto).
     * Perfil sem regra (registro 1.x): null.
     */
    public static NRect registryRuleCrop(int imgW, int imgH, double aspect, NRect product, SemanticRegionRegistry.Profile profile,
                                         double marginFloor) {
        if (profile.rule() == null) {
            return null;
        }
        return ruleCrop(imgW, imgH, aspect, product, registryFocus(product, profile), profile.rule(), Math.max(profile.margin()[0], marginFloor));
    }

    /** Região de foco do perfil (relativa à caixa da peça) em coordenadas da foto, sem regiões críticas. */
    public static FramingStrategy.Focus registryFocus(NRect product, SemanticRegionRegistry.Profile profile) {
        return new FramingStrategy.Focus(profile.focus().name(), product.sub(profile.focus().rect()), List.of(), "REGISTRY");
    }

    /**
     * Recorte 4:5 pela regra: COVER usa o menor lado da peça (a peça preenche o quadro e o excedente fica de fora),
     * WIDTH a largura da peça, CONTAIN o necessário para a peça inteira caber a partir do ponto de alinhamento.
     * {@code margin} é a folga de cada lado (fração do quadro).
     */
    public static NRect ruleCrop(int imgW, int imgH, double aspect, NRect product, FramingStrategy.Focus focus,
                          SemanticRegionRegistry.FramingRule rule, double margin) {
        double px = product.x() * imgW, py = product.y() * imgH, pw = product.w() * imgW, ph = product.h() * imgH;
        double cx = product.cx() * imgW, cy = product.cy() * imgH;
        if (rule.align() == SemanticRegionRegistry.FramingRule.Align.FOCUS) {
            cx = focus.rect().cx() * imgW;
            cy = focus.rect().cy() * imgH;
        }
        double k = 1 - 2 * margin, cw, ch;
        switch (rule.fit()) {
            case COVER -> {
                ch = Math.min(ph, pw / aspect);           // preenche o quadro: a folga não se aplica (100% de peça)
                cw = ch * aspect;
            }
            case WIDTH -> {
                cw = pw / k;
                ch = cw / aspect;
            }
            default -> {
                double halfW = Math.max(cx - px, px + pw - cx), halfH = rule.align() == SemanticRegionRegistry.FramingRule.Align.TOP
                        ? ph / 2 : Math.max(cy - py, py + ph - cy);
                ch = Math.max(2 * halfH, 2 * halfW / aspect) / k;
                cw = ch * aspect;
            }
        }
        double x = cx - cw / 2, y;
        if (rule.align() == SemanticRegionRegistry.FramingRule.Align.TOP) {
            y = py - margin * ch;
        } else {
            y = cy - ch / 2;
        }
        return new NRect(x / imgW, y / imgH, cw / imgW, ch / imgH);
    }

    /**
     * Conformidade com a regra: preenchimento (COVER: o quadro todo é peça; WIDTH: a largura toda; CONTAIN: a peça
     * inteira dentro), regiões críticas, foco no lugar (metade superior ou centro do quadro), sem distrator e sem padding.
     */
    static Candidate ruleScore(NRect c, int imgW, int imgH, NRect product, FramingStrategy.Focus focus,
                               SemanticRegionRegistry.FramingRule rule, double margin, List<NRect> distractors,
                               Map<String, Object> compliance) {
        Map<String, Double> parts = new LinkedHashMap<>();
        double frameFilled = c.intersect(product).area() / c.area();
        double widthFilled = Math.max(0, Math.min(c.x2(), product.x2()) - Math.max(c.x(), product.x())) / c.w();
        double inside = product.insideOf(c);
        double fill = switch (rule.fit()) {
            case COVER -> frameFilled;
            case WIDTH -> widthFilled;
            case CONTAIN -> inside;
        };
        // peça de cima/baixo: basta uma das áreas analisadas inteira (gola ou peito; cós, patch ou um dos bolsos)
        DoubleStream criticalInside = focus.critical().stream().mapToDouble(r -> r.rect().insideOf(c));
        double critical = (rule.focusTopHalf() ? criticalInside.max() : criticalInside.min()).orElse(1);
        double fy = (focus.rect().cy() - c.y()) / c.h(), fx = (focus.rect().cx() - c.x()) / c.w();
        boolean centerInside = fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1;
        double placement;
        if (rule.focusTopHalf()) {
            // o centro da região de foco (gola; cós/patch/bolsos) cai na metade de cima do quadro (1º e 2º quadrantes)
            placement = !centerInside ? 0 : fy <= 0.5 ? 1 : Math.max(0, 1 - (fy - 0.5) * 4);
        } else if (rule.align() == SemanticRegionRegistry.FramingRule.Align.FOCUS) {
            placement = focus.rect().insideOf(c) * Math.max(0, 1 - Math.hypot(fx - 0.5, fy - 0.5) * 4);
        } else {
            placement = focus.rect().insideOf(c);
        }
        double padding = 1 - c.insideOf(new NRect(0, 0, 1, 1));
        double distractor = distractors.stream().mapToDouble(d -> d.insideOf(c)).max().orElse(0);
        parts.put("completeness", rule.fit() == SemanticRegionRegistry.FramingRule.Fit.CONTAIN ? inside : critical);
        parts.put("critical", critical);
        parts.put("focus", placement);
        parts.put("occupancy", Math.min(1, fill / Math.max(0.5, 1 - 2 * margin - 0.02)));
        parts.put("margin", 1.0);
        parts.put("padding", Math.max(0, 1 - padding * 2));
        parts.put("distractor", 1 - distractor);
        double score = 0.30 * parts.get("occupancy") + 0.25 * critical + 0.25 * placement + 0.10 * (1 - distractor)
                + 0.10 * parts.get("padding");
        compliance.put("fit", rule.fit().name());
        compliance.put("align", rule.align().name());
        compliance.put("view", rule.view());
        compliance.put("frameFilledByProduct", NRect.r4(frameFilled));
        compliance.put("widthFilledByProduct", NRect.r4(widthFilled));
        compliance.put("productInsideFrame", NRect.r4(inside));
        compliance.put("focusCenter", Map.of("x", NRect.r4(fx), "y", NRect.r4(fy)));
        compliance.put("focusInTopHalf", centerInside && fy <= 0.5);
        // preenchimento exigido: a peça encosta no quadro descontada a folga; com o foco no centro (relógio, cinto) o que
        // manda é a posição do foco, então só a regra CONTAIN cobra a peça inteira
        boolean filled = rule.align() == SemanticRegionRegistry.FramingRule.Align.FOCUS
                ? rule.fit() != SemanticRegionRegistry.FramingRule.Fit.CONTAIN || inside >= 0.99
                : fill >= (rule.fit() == SemanticRegionRegistry.FramingRule.Fit.CONTAIN ? 0.99 : 1 - 2 * margin - 0.02);
        compliance.put("ok", filled && critical >= 0.99 && placement >= 0.9);
        return new Candidate(c, score, Math.max(product.w() * imgW / (c.w() * imgW), product.h() * imgH / (c.h() * imgH)), padding, parts);
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

    /**
     * Versão da regra para o lado em que a peça vem cortada: em vez de encostar sempre na borda (o que tiraria a gola do
     * quadro numa foto de modelo cortada embaixo), o recorte só volta para dentro da foto quando passaria dela.
     */
    static NRect keepCutSideInside(NRect c, Set<String> truncated) {
        double x = c.x(), y = c.y();
        if (truncated.contains("bottom") && c.y2() > 1) {
            y = 1 - c.h();
        }
        if (truncated.contains("top") && y < 0) {
            y = 0;
        }
        if (truncated.contains("right") && c.x2() > 1) {
            x = 1 - c.w();
        }
        if (truncated.contains("left") && x < 0) {
            x = 0;
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
