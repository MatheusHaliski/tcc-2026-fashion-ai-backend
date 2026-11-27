package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.FeedFraming;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.catalog.image.ProductRuleFrame.Context;
import br.com.fashionai.application.catalog.image.ProductRuleFrame.Result;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.catalog.image.ProductRuleFrame.MIN_WIDTH_PX;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.OBJECT_MARGIN_FLOOR;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.OBJECT_PERSON_SKIN;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.PART_SHARE;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.hex;

/**
 * Regra do produto WIDTH / CONTAIN / COVER-FOCUS para o objeto inteiro (calçado, óculos, bolsa, relógio…): caixa do
 * objeto com as partes soltas, foco dos landmarks ou do registro, lado já cortado na foto, padding com o fundo de
 * estúdio e vista lateral do calçado. Objeto sobre pessoa não é isolado.
 */
final class ObjectRuleFrame {
    private ObjectRuleFrame() {
    }

    static Result object(Context c, FabricFrame.Mask m, ProductSegmenter.Segmentation seg, FramingStrategy.Focus detected) {
        int w = m.w(), h = m.h();
        // objeto sobre pessoa (tênis no pé, bolsa no ombro, relógio no pulso): a caixa seria a pessoa — não é o objeto isolado.
        // Calçado que encosta no alto da foto tem perna (ou calça) em cima; pele estranha ao objeto só conta como pessoa quando é
        // bastante (≥ 4%) e o conjunto ocupa a altura da foto ou encosta em duas bordas (couro caramelo, contas bege, reflexo no
        // aço: material, não pessoa)
        ImageOps.Box fb = m.box();
        int borders = (fb.x() <= 1 ? 1 : 0) + (fb.y() <= 1 ? 1 : 0) + (fb.x() + fb.w() >= w - 1 ? 1 : 0) + (fb.y() + fb.h() >= h - 1 ? 1 : 0);
        // pele longe da cor mediana do conjunto (a do segmentador): numa pessoa com bolsa a mediana é a roupa e a pele destoa; numa
        // bolsa caramelo a mediana é o próprio couro
        double personSkin = Math.max(m.skinShare(), ProductSegmenter.foreignSkin(m.px(), m.fg()));
        if ((c.type() == PieceType.SHOES_PIECE && fb.y() <= 1) || (personSkin >= OBJECT_PERSON_SKIN && (fb.h() >= h * 0.8 || borders >= 2))) {
            return c.refuse("PIECE_NOT_ISOLATED", m);
        }
        boolean[] raw;
        if (m.bg() != null) {
            raw = FabricMasks.studioForeground(m.px(), w, h, m.bg());
        } else {
            raw = new boolean[w * h];
            for (int i = 0; i < raw.length; i++) raw[i] = seg.mask()[i] && (m.px()[i] >>> 24) >= 160;
        }
        int[] labels = new int[raw.length];
        List<int[]> comps = ConnectedComponents.components(raw, w, h, labels);   // {label, tamanho, x0, y0, x1, y1}
        if (comps.isEmpty()) return c.refuse("NO_PRODUCT", m);
        int x0 = w, y0 = h, x1 = -1, y1 = -1;
        Set<Integer> keep = new java.util.HashSet<>();
        for (int[] k : comps) {
            if (k[1] < comps.get(0)[1] * PART_SHARE) continue;
            keep.add(k[0]);
            x0 = Math.min(x0, k[2]); y0 = Math.min(y0, k[3]); x1 = Math.max(x1, k[4]); y1 = Math.max(y1, k[5]);
        }
        // o que o segmentador do pipeline considera a peça também entra (nunca cortar o que o card mostraria)
        NRect segBox = seg == null || seg.empty() ? null : seg.productBox();
        if (segBox != null) {
            NRect studio = new NRect(x0 / (double) w, y0 / (double) h, (x1 - x0 + 1) / (double) w, (y1 - y0 + 1) / (double) h);
            if (segBox.intersect(studio).area() > 0 && segBox.insideOf(studio) < 0.999 && segBox.area() <= studio.area() * 1.5) {
                x0 = Math.min(x0, (int) Math.floor(segBox.x() * w)); y0 = Math.min(y0, (int) Math.floor(segBox.y() * h));
                x1 = Math.max(x1, (int) Math.ceil(segBox.x2() * w) - 1); y1 = Math.max(y1, (int) Math.ceil(segBox.y2() * h) - 1);
            }
        }
        x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w - 1, x1); y1 = Math.min(h - 1, y1);
        NRect product = new NRect(x0 / (double) w, y0 / (double) h, (x1 - x0 + 1) / (double) w, (y1 - y0 + 1) / (double) h);
        if ((double) (x1 - x0 + 1) * (y1 - y0 + 1) < (double) w * h * 0.005) return c.refuse("SEGMENTATION_FRAGMENT", m);
        SemanticRegionRegistry.FramingRule rule = c.profile().rule();
        boolean cover = rule.fit() == SemanticRegionRegistry.FramingRule.Fit.COVER;
        double margin = cover ? c.profile().margin()[0] : Math.max(c.profile().margin()[0], OBJECT_MARGIN_FLOOR);
        List<String> obs = new ArrayList<>();
        // foco: o que os landmarks do pipeline acharam (mostrador, ponte dos óculos) ou a região padrão do registro
        FramingStrategy.Focus focus = SemanticCropper.registryFocus(product, c.profile());
        if (detected != null && detected.source() != null && !"REGISTRY".equals(detected.source()) && focus.name().equals(detected.name())) {
            focus = new FramingStrategy.Focus(focus.name(), detected.rect(), List.of(), detected.source());
        }
        SemanticRegionRegistry.FramingRule applied = rule;
        if (rule.align() == SemanticRegionRegistry.FramingRule.Align.FOCUS && !cover && "REGISTRY".equals(focus.source())) {
            // objeto inteiro com o foco no centro (cinto pela fivela), mas o foco não foi achado — só a posição padrão do registro
            // (fivela na ponta esquerda): centrar nela deixaria o objeto num canto com meio quadro de fundo; centra o objeto
            applied = new SemanticRegionRegistry.FramingRule(rule.fit(), SemanticRegionRegistry.FramingRule.Align.CENTER, rule.view(), rule.focusTopHalf());
            obs.add("FOCUS_NOT_DETECTED_CENTERED");
        }
        NRect crop = SemanticCropper.ruleCrop(w, h, c.aspect(), product, focus, applied, margin);
        Set<String> truncated = new LinkedHashSet<>();
        if (x0 <= 1) truncated.add("left");
        if (y0 <= 1) truncated.add("top");
        if (x1 >= w - 2) truncated.add("right");
        if (y1 >= h - 2) truncated.add("bottom");
        if (!truncated.isEmpty()) {
            // a foto já cortou o objeto: o quadro encosta nesse lado (fundo inventado ali mostraria o corte)
            crop = SemanticCropper.keepCutSideInside(crop, truncated);
            obs.add("OBJECT_TRUNCATED_IN_SOURCE:" + String.join("+", truncated));
        }
        NRect photo = new NRect(0, 0, 1, 1);
        double padding = 1 - crop.insideOf(photo);
        if (padding > 1e-4 && m.bg() == null) {
            // sem fundo de estúdio não há cor para completar o quadro: desloca para dentro, sem tirar o objeto do quadro
            crop = shiftInside(crop, product);
            padding = 1 - crop.insideOf(photo);
            if (padding > 1e-4) return c.refuse("PADDING_NEEDS_STUDIO_BACKGROUND", m);
        }
        if (padding > 1e-4) obs.add("PADDED_WITH_STUDIO_BACKGROUND");
        Boolean side = null;
        if (c.type() == PieceType.SHOES_PIECE || "SIDE".equals(rule.view())) {
            boolean[] kept = new boolean[raw.length];
            for (int i = 0; i < raw.length; i++) kept[i] = raw[i] && keep.contains(labels[i]);
            side = FeedFraming.looksSideView(kept, w, x0, y0, x1, y1);
        }
        Map<String, Object> compliance = new LinkedHashMap<>();
        SemanticCropper.ruleScore(crop, w, h, product, focus, applied, margin, List.of(), compliance);
        compliance.put("focusSource", focus.source());
        if ("SIDE".equals(rule.view()) && Boolean.FALSE.equals(side)) {
            // regra 4 (calçado de lado): par de frente/de trás não vira lateral no recorte — fica registrado
            compliance.put("ok", false);
            compliance.put("sideView", false);
            obs.add("SHOE_NOT_SIDE_VIEW");
        }
        double inside = product.insideOf(crop);
        int cropPx = (int) Math.round(crop.w() * w);
        if (cropPx < MIN_WIDTH_PX) return c.refuse("FRAME_TOO_SMALL", m);
        if (!cover && inside < 0.999) {
            return new Result(false, "OBJECT_CUT", crop, c.aw(), c.ah(), rule, c.origin(), c.registryVersion(), c.type(), c.sub(),
                    c.target(), focus.name(), focus.rect(), product, false, m.skinShare(), 0, null, inside, padding, hex(m),
                    List.copyOf(truncated), side, compliance, cropPx, List.copyOf(obs));
        }
        return new Result(true, null, crop, c.aw(), c.ah(), rule, c.origin(), c.registryVersion(), c.type(), c.sub(), c.target(),
                focus.name(), focus.rect(), product, false, m.skinShare(), 0, null, inside, padding, hex(m), List.copyOf(truncated),
                side, compliance, cropPx, List.copyOf(obs));
    }

    /** Desloca o quadro para dentro da foto em cada eixo em que cabe, sem deixar o objeto sair dele. */
    static NRect shiftInside(NRect c, NRect product) {
        double x = c.x(), y = c.y();
        if (c.w() <= 1) {
            double lo = Math.max(0, product.x2() - c.w()), hi = Math.min(1 - c.w(), product.x());
            if (lo <= hi) x = Math.max(lo, Math.min(hi, x));
        }
        if (c.h() <= 1) {
            double lo = Math.max(0, product.y2() - c.h()), hi = Math.min(1 - c.h(), product.y());
            if (lo <= hi) y = Math.max(lo, Math.min(hi, y));
        }
        return new NRect(x, y, c.w(), c.h());
    }
}
