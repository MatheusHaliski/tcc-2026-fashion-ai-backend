package br.com.fashionai.application.catalog.image;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

import static br.com.fashionai.application.catalog.image.CatalogPhotos.*;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização do lote R94 (ProductRuleFrame, FabricFrame, SemanticCropper, ProductSegmenter): imagens sintéticas em
 * memória passam pela segmentação, pela máscara do tecido, pelo quadro de tecido, pela regra do produto (3:4 e 4:5) e pelo
 * recorte semântico, e cada resultado vira um SHA-256 do texto canônico (mapas com chaves ordenadas: {@code Map.of} e
 * {@code Set.of} mudam a ordem de iteração por JVM). Os valores foram capturados no código antes da extração.
 * Rode com {@code -Dcharacterization.print=true} para listar os digests.
 */
class CatalogImageFramesCharacterizationTest {
    private static final SemanticRegionRegistry REGISTRY = SemanticRegionRegistry.get();

    static String sha(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d).substring(0, 16);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Texto canônico: mapas por chave ordenada, conjuntos ordenados, vetores por elemento. */
    static String canon(Object o) {
        if (o == null) return "null";
        if (o instanceof Map<?, ?> m) {
            Map<String, String> t = new TreeMap<>();
            m.forEach((k, v) -> t.put(String.valueOf(k), canon(v)));
            return t.toString();
        }
        if (o instanceof Set<?> s) {
            Set<String> t = new TreeSet<>();
            s.forEach(v -> t.add(canon(v)));
            return t.toString();
        }
        if (o instanceof Collection<?> c) {
            List<String> t = new ArrayList<>();
            c.forEach(v -> t.add(canon(v)));
            return t.toString();
        }
        if (o instanceof boolean[] b) {
            StringBuilder sb = new StringBuilder(b.length);
            for (boolean v : b) sb.append(v ? '1' : '0');
            return b.length + "#" + sha(sb.toString());
        }
        if (o instanceof int[] a) return a.length + "#" + sha(java.util.Arrays.toString(a));
        if (o instanceof double[] a) return java.util.Arrays.toString(a);
        if (o instanceof int[][] a) return java.util.Arrays.deepToString(a);
        return String.valueOf(o);
    }

    private static String segmentation(ProductSegmenter.Segmentation s) {
        int[] px = s.cutout().getRGB(0, 0, s.width(), s.height(), null, 0, s.width());
        return canon(List.of(s.width(), s.height(), canon(px), canon(s.mask()), s.productBox(), s.distractors(), s.distractorShare(),
                s.coverage(), s.confidence(), s.backgroundRgb(), canon(s.truncatedSides()), s.edgeQuality(), s.hangerTrimmed(),
                s.foreignSkin(), String.valueOf(s.warning())));
    }

    private static String mask(FabricFrame.Mask m) {
        List<String> parts = new ArrayList<>();
        for (Object o : new Object[]{m.w(), m.h(), m.fabric(), m.box(), m.skinShare(), m.reason(), m.fg(), m.hole(), m.skin(), m.bg()}) {
            parts.add(canon(o));
        }
        return parts.toString();
    }

    private static String cropper(SemanticCropper.Result r) {
        List<Object> c = new ArrayList<>();
        r.candidates().forEach(k -> c.add(k.toMap()));
        return canon(List.of(r.best().toMap(), String.valueOf(r.detail()), r.analysis(), c, canon(r.rule() == null ? null : r.rule().toMap()),
                canon(r.compliance())));
    }

    /** Modelo de camisa vermelha sobre calça jeans (cós por troca de cor, barra da camisa por cima). */
    static BufferedImage outfitOnModel() {
        BufferedImage img = studio(800, 1200, 242);
        Graphics2D g = pen(img, SKIN);
        g.fillOval(340, 20, 120, 160);
        g.fillRect(370, 170, 60, 60);
        g.fillRect(190, 260, 50, 360);
        g.fillRect(560, 260, 50, 360);
        g.setColor(RED);
        g.fillRect(240, 230, 320, 360);
        g.setColor(DENIM);
        g.fillRect(250, 590, 300, 200);
        g.fillRect(250, 790, 140, 400);
        g.fillRect(410, 790, 140, 400);
        g.dispose();
        return img;
    }

    /** Bolsa carregada (alça, pele do braço encostando) e bolsa sozinha num canto da foto. */
    static BufferedImage bag(boolean carried) {
        BufferedImage img = studio(900, 900, 245);
        Graphics2D g = pen(img, new Color(0x6B, 0x3A, 0x1F));
        g.fillRect(carried ? 300 : 20, 420, 360, 300);
        g.setStroke(new java.awt.BasicStroke(18));
        g.drawArc(carried ? 360 : 80, 300, 240, 260, 0, 180);
        if (carried) {
            g.setColor(SKIN);
            g.fillRect(450, 0, 70, 430);
        }
        g.dispose();
        return img;
    }

    private static void frames(Map<String, String> r, String name, BufferedImage img, String category, List<String> subs) {
        PieceType type = PieceType.of(category);
        ProductSegmenter.Segmentation seg = new ProductSegmenter().segment(img, type);
        r.put(name + ".seg", segmentation(seg));
        FabricFrame.Mask m = FabricFrame.mask(seg, type);
        r.put(name + ".mask", mask(m));
        NRect fr = seg.empty() ? new NRect(0.4, 0.4, 0.1, 0.1) : seg.productBox().sub(new NRect(0.4, 0.5, 0.2, 0.1));
        List<FramingStrategy.Focus> foci = List.of(new FramingStrategy.Focus("fly_zipper", fr, List.of(), "LANDMARKS"),
                new FramingStrategy.Focus("logo", fr, List.of(), "LANDMARKS"), new FramingStrategy.Focus("dial", fr, List.of(), "LANDMARKS"));
        for (String sub : subs) {
            String k = name + "." + sub;
            r.put(k + ".fabric", canon(FabricFrame.find(m, type, sub, null).toMap()));
            List<String> withFocus = new ArrayList<>();
            for (FramingStrategy.Focus f : foci) withFocus.add(canon(FabricFrame.find(m, type, sub, f).toMap()));
            r.put(k + ".fabricFocus", withFocus.toString());
            r.put(k + ".rule34", canon(ProductRuleFrame.find(seg, type, sub, REGISTRY).toMap()));
            List<String> other = new ArrayList<>();
            for (FramingStrategy.Focus f : foci) other.add(canon(ProductRuleFrame.find(m, seg, type, sub, REGISTRY, 4, 5, f).toMap()));
            r.put(k + ".rule45", other.toString());
            if (seg.empty()) continue;
            SemanticRegionRegistry.Profile p = REGISTRY.profile(type, sub);
            FramingStrategy.Focus focus = FramingStrategy.fromRegistry(seg.productBox(), p);
            SemanticCropper.Result cr = new SemanticCropper().crop(seg.width(), seg.height(), REGISTRY.aspectRatio(), seg.productBox(),
                    seg.productBox(), focus, p, seg.distractors(), seg.truncatedSides());
            r.put(k + ".cropper", cropper(cr));
        }
    }

    private static Map<String, String> pure() {
        Map<String, String> r = new LinkedHashMap<>();
        Random rnd = new Random(7);
        int w = 64, h = 48;
        boolean[] blob = new boolean[w * h];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) blob[y * w + x] = (x - 30) * (x - 30) / 400.0 + (y - 22) * (y - 22) / 300.0 < 1 || rnd.nextInt(40) == 0;
        }
        int[] labels = new int[blob.length];
        List<String> comps = new ArrayList<>();
        ConnectedComponents.components(blob, w, h, labels).forEach(c -> comps.add(java.util.Arrays.toString(c)));
        r.put("pure.components", comps + canon(labels));
        r.put("pure.erode", canon(FabricFrame.erode(blob, w, h, 2)));
        r.put("pure.halfSpans", canon(CoverSearch.halfSpans(blob, w, 30, 0, h)));
        r.put("pure.cover", String.valueOf(CoverSearch.cover(blob, w, 30, 2, 3, 12, h, h, 2, 30, 3, 4)));
        r.put("pure.medianRow", CoverSearch.medianRowWidth(blob, w, new br.com.fashionai.application.imaging.ImageOps.Box(0, 0, w, h), 5, 40)
                + "/" + CoverSearch.rowsBox(blob, w, new br.com.fashionai.application.imaging.ImageOps.Box(2, 2, 50, 40), 10, 30));
        NRect product = new NRect(0.2, 0.15, 0.5, 0.6);
        FramingStrategy.Focus focus = new FramingStrategy.Focus("f", new NRect(0.3, 0.2, 0.1, 0.1),
                List.of(new SemanticRegionRegistry.Region("c", new NRect(0.3, 0.25, 0.1, 0.1))), "REGISTRY");
        List<String> rules = new ArrayList<>();
        for (SemanticRegionRegistry.FramingRule.Fit fit : SemanticRegionRegistry.FramingRule.Fit.values()) {
            for (SemanticRegionRegistry.FramingRule.Align al : SemanticRegionRegistry.FramingRule.Align.values()) {
                for (boolean top : new boolean[]{false, true}) {
                    var rule = new SemanticRegionRegistry.FramingRule(fit, al, "ANY", top);
                    NRect c = SemanticCropper.ruleCrop(800, 1000, 0.8, product, focus, rule, 0.03);
                    Map<String, Object> comp = new LinkedHashMap<>();
                    SemanticCropper.Candidate k = SemanticCropper.ruleScore(c, 800, 1000, product, focus, rule, 0.03,
                            List.of(new NRect(0.8, 0.8, 0.1, 0.1)), comp);
                    rules.add(c + canon(k.toMap()) + canon(comp));
                }
            }
        }
        r.put("pure.rules", rules.toString());
        Set<String> cut = new java.util.LinkedHashSet<>(List.of("bottom", "left"));
        NRect out = new NRect(-0.1, 0.3, 0.6, 0.9);
        r.put("pure.truncated", SemanticCropper.snapTruncated(out, cut) + "/" + SemanticCropper.keepCutSideInside(out, cut)
                + "/" + SemanticCropper.detail(2000, 2500, 0.8, new NRect(0.3, 0.3, 0.2, 0.2)));
        return r;
    }

    private static Map<String, String> all() {
        Map<String, String> r = new LinkedHashMap<>(pure());
        frames(r, "tee", tee(200, 200, 1.0), "upper_piece", List.of("t_shirt", "polo_shirt", "jacket"));
        frames(r, "teeFull", tee(200, 200, 1.0), "full_body_piece", List.of("dress"));
        frames(r, "hanger", teeOnHanger(), "upper_piece", List.of("t_shirt"));
        frames(r, "prop", teeWithProp(), "upper_piece", List.of("t_shirt"));
        frames(r, "person", teeOnPerson(), "upper_piece", List.of("t_shirt", "coat"));
        frames(r, "cut", teeCutAtBottom(), "upper_piece", List.of("t_shirt"));
        frames(r, "jeans", jeans(), "lower_piece", List.of("jeans", "skirt", "shorts", "leggings"));
        frames(r, "pantsModel", pantsOnModel(false), "lower_piece", List.of("jeans", "chino_pants"));
        frames(r, "pantsHand", pantsOnModel(true), "lower_piece", List.of("jeans"));
        frames(r, "outfit", outfitOnModel(), "lower_piece", List.of("jeans", "shorts"));
        frames(r, "outfitTop", outfitOnModel(), "upper_piece", List.of("t_shirt", "polo_shirt"));
        frames(r, "sneakers", sneakers(), "shoes_piece", List.of("running_shoes", "casual_sneakers"));
        frames(r, "watch", watch(), "accessory_piece", List.of("watch", "belt", "sunglasses"));
        frames(r, "bag", bag(false), "accessory_piece", List.of("handbag", "tote_bag"));
        frames(r, "carried", bag(true), "accessory_piece", List.of("handbag"));
        return r;
    }

    private static final Map<String, String> EXPECTED = new LinkedHashMap<>();

    static {
        CatalogImageFramesExpected.fill(EXPECTED);
    }

    @Test
    void lotePreservaQuadrosRecortesESegmentacao() {
        Map<String, String> digests = new LinkedHashMap<>();
        all().forEach((k, v) -> digests.put(k, sha(v)));
        if (Boolean.getBoolean("characterization.print")) {
            digests.forEach((k, v) -> System.out.println("DIGEST\t" + k + "\t" + v));
        }
        assertThat(digests).containsExactlyEntriesOf(EXPECTED);
    }
}
