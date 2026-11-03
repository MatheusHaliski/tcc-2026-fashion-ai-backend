package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.catalog.image.SemanticCropper.Candidate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.DoubleStream;

/**
 * Regra de Enquadramento do Produto (registro 2.x, §9.1): o recorte calculado pela regra da categoria (COVER, WIDTH ou
 * CONTAIN, alinhado pelo topo, pelo centro ou pelo foco) e a conformidade do recorte com ela. {@link SemanticCropper}
 * delega para cá; o card do feed e o lote de enquadramento do acervo usam o mesmo cálculo.
 */
final class ProductRuleCrop {
    private ProductRuleCrop() {
    }

    /**
     * Recorte 4:5 pela regra: COVER usa o menor lado da peça (a peça preenche o quadro e o excedente fica de fora),
     * WIDTH a largura da peça, CONTAIN o necessário para a peça inteira caber a partir do ponto de alinhamento.
     * {@code margin} é a folga de cada lado (fração do quadro).
     */
    static NRect ruleCrop(int imgW, int imgH, double aspect, NRect product, FramingStrategy.Focus focus,
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
}
