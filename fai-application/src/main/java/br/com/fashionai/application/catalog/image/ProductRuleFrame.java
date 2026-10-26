package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.FeedFraming;
import br.com.fashionai.application.imaging.GarmentCrop;
import br.com.fashionai.application.imaging.ImageOps;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Quadro do lote de enquadramento do acervo pela <b>Regra de Enquadramento do Produto</b> — a mesma do card
 * (catalog/semantic-regions.json, {@link SemanticCropper#registryRuleCrop}, docs/catalogo/PIPELINE_IMAGENS_CATALOGO.md §9.1),
 * na proporção 3:4 do quadro do editor (scripts/catalog/category_frame.py, CATALOG_FRAME_34_PRODUCT_RULE_V3):
 * <ul>
 *   <li><b>COVER/TOP</b> (parte de cima, peça inteira; parte de baixo): a peça preenche o quadro a partir do topo. O cálculo
 *       da regra sobre a caixa da peça dá o teto (largura e topo); a máscara da peça diz até onde dá sem mostrar fundo: o
 *       maior quadro com o topo na gola/decote (parte de cima — sem rosto nem pescoço em foto com modelo) ou no cós (parte
 *       de baixo — a camisa/jaqueta acima fica de fora), centrado no eixo da peça. Parte de cima e peça inteira: o quadro
 *       todo é peça. Parte de baixo: do cós até perto do gancho (80% do caminho) tudo é peça — cós, bolsos e braguilha na
 *       metade de cima — e as pernas seguem além da base, com o vão entre elas; saia e saia-short, o quadro todo.</li>
 *   <li><b>WIDTH</b> (calçado, óculos), <b>CONTAIN</b> (bolsa, mochila, joias, gorro, cachecol, cinto…), <b>COVER/FOCUS</b>
 *       (relógio pelo mostrador): o próprio cálculo da regra sobre a caixa do objeto inteiro (pares e partes soltas
 *       incluídos), com folga mínima de 2% em WIDTH/CONTAIN para nada ser cortado; o que passar da foto é completado com a
 *       cor do fundo de estúdio (como o smartPadding do card). Objeto sobre pessoa não é isolado: sem quadro.</li>
 * </ul>
 * Quadro de cobertura estreito demais para a peça (menos de 30% da largura da peça na faixa do topo do quadro) é recusado.
 */
public final class ProductRuleFrame {
    /** V2: quadro de cobertura ajustado para tolerar enquadramentos mais amplos e modelos diversos */
    public static final String VERSION = "PRODUCT_RULE_FRAME_V2";
    /** proporção do quadro do editor (o lote grava 900×1200) */
    public static final int ASPECT_W = 3, ASPECT_H = 4;
    /** largura mínima do quadro em pixels da foto analisada */
    static final int MIN_WIDTH_PX = 90;
    /** parte de cima / peça inteira: largura mínima do quadro em relação à largura da peça (ajustado para 0.15) */
    static final double MIN_UPPER_FRACTION = 0.15;
    /** parte de baixo: largura mínima em relação ao quadril (ajustado para 0.25) */
    static final double MIN_LOWER_FRACTION = 0.25;
    /**
     * quadro de cobertura: largura mínima em relação à largura da peça na faixa do topo do quadro.
     * Ajustado de 0.55 para 0.30 para permitir croppeds, regatas, vestidos e fotos com enquadramento mais amplo.
     */
    static final double MIN_COVER_WIDTH_SHARE = 0.30;
    /** folga mínima de cada lado em WIDTH/CONTAIN: o arredondamento para pixels nunca corta o objeto */
    static final double OBJECT_MARGIN_FLOOR = 0.02;
    /** componente separado com ao menos esta fração do maior faz parte do objeto */
    static final double PART_SHARE = 0.15;
    /** pele estranha flexibilizada de 0.04 para 0.08 */
    static final double OBJECT_PERSON_SKIN = 0.08;
    /** mancha de pele flexibilizada de 0.0015 para 0.015 para evitar falsos positivos com fundos quentes e tecidos bege */
    static final double MIN_PERSON_SKIN = 0.015;
    /** saia e saia-short: uma peça só do cós à barra, o quadro todo tem de ser peça */
    static final Set<String> WHOLE_LOWER = Set.of("skirt", "skort");
    /** agasalho aberto/comprido: a barra pode passar da cintura */
    static final Set<String> LONG_UPPER = Set.of("jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono", "vest");

    public record Result(boolean ok, String reason, NRect crop, int aspectW, int aspectH, SemanticRegionRegistry.FramingRule rule,
                         String ruleOrigin, String registryVersion, PieceType pieceType, String subcategory, String target,
                         String focusName, NRect focus, NRect product, boolean model, double skinShare, double garmentCoverage,
                         String coverageScope, double objectInside, double padding, String background, List<String> truncated,
                         Boolean sideView, Map<String, Object> compliance, int cropWidthPx, List<String> observations) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("version", VERSION);
            m.put("ok", ok);
            m.put("reason", reason);
            m.put("crop", crop == null ? null : crop.toMap());
            m.put("aspect", aspectW + ":" + aspectH);
            m.put("rule", rule == null ? null : rule.toMap());
            Map<String, Object> source = new LinkedHashMap<>();
            source.put("registry", SemanticRegionRegistry.RESOURCE.substring(1));
            source.put("registryVersion", registryVersion);
            source.put("pieceType", pieceType == null ? null : pieceType.name());
            source.put("subcategory", subcategory == null || subcategory.isEmpty() ? null : subcategory);
            source.put("origin", ruleOrigin);
            m.put("ruleSource", source);
            m.put("target", target);
            Map<String, Object> f = new LinkedHashMap<>();
            f.put("name", focusName);
            f.put("x", focus == null ? null : NRect.r4(focus.cx()));
            f.put("y", focus == null ? null : NRect.r4(focus.cy()));
            m.put("focus", f);
            m.put("product", product == null ? null : product.toMap());
            m.put("model", model);
            m.put("skinExcluded", NRect.r4(skinShare));
            m.put("garmentCoverage", NRect.r4(garmentCoverage));
            m.put("coverageScope", coverageScope);
            m.put("objectInside", NRect.r4(objectInside));
            m.put("padding", NRect.r4(padding));
            m.put("background", background);
            m.put("truncated", truncated);
            m.put("sideView", sideView);
            m.put("compliance", compliance);
            m.put("cropWidthPx", cropWidthPx);
            m.put("observations", observations);
            return m;
        }
    }

    private ProductRuleFrame() { }

    private record Context(PieceType type, String sub, SemanticRegionRegistry.Profile profile, String origin, String registryVersion,
                           int aw, int ah) {
        double aspect() { return aw / (double) ah; }

        String target() {
            SemanticRegionRegistry.FramingRule r = profile.rule();
            if (r == null) return null;
            return switch (type) {
                case UPPER_PIECE, FULL_BODY_PIECE -> r.fit() == SemanticRegionRegistry.FramingRule.Fit.COVER ? "neckline_top" : "whole_piece";
                case LOWER_PIECE -> r.fit() == SemanticRegionRegistry.FramingRule.Fit.COVER ? "waistband_top" : "whole_piece";
                case SHOES_PIECE -> "whole_shoe";
                case ACCESSORY_PIECE -> r.align() == SemanticRegionRegistry.FramingRule.Align.FOCUS ? profile.focus().name() : "whole_object";
            };
        }

        Result refuse(String reason, FabricFrame.Mask m) {
            boolean model = m != null && m.reason() == null && m.person();
            return new Result(false, reason, null, aw, ah, profile.rule(), origin, registryVersion, type, sub, target(),
                    profile.focus().name(), null, null, model, m == null ? 0 : m.skinShare(), 0, null, 0, 0, null, List.of(), null,
                    Map.of(), 0, List.of());
        }
    }

    public static Result find(ProductSegmenter.Segmentation seg, PieceType type, String subcategory, SemanticRegionRegistry registry) {
        return find(FabricFrame.mask(seg, type), seg, type, subcategory, registry, ASPECT_W, ASPECT_H, null);
    }

    static Result find(FabricFrame.Mask m, ProductSegmenter.Segmentation seg, PieceType type, String subcategory,
                       SemanticRegionRegistry registry, int aspectW, int aspectH, FramingStrategy.Focus focus) {
        String sub = subcategory == null ? "" : subcategory.trim().toLowerCase(Locale.ROOT);
        String key = sub.isEmpty() ? null : sub;
        SemanticRegionRegistry.Profile profile = registry.profile(type, key);
        Context c = new Context(type, sub, profile, registry.ruleOrigin(type, key), registry.version(), aspectW, aspectH);
        SemanticRegionRegistry.FramingRule rule = profile.rule();
        if (rule == null) return c.refuse("NO_FRAMING_RULE", m);
        if (m == null) return c.refuse("NO_PRODUCT", m);
        if (m.reason() != null) return c.refuse(m.reason(), m);
        boolean garment = type == PieceType.UPPER_PIECE || type == PieceType.LOWER_PIECE || type == PieceType.FULL_BODY_PIECE;
        if (garment && rule.fit() == SemanticRegionRegistry.FramingRule.Fit.COVER && rule.align() == SemanticRegionRegistry.FramingRule.Align.TOP) {
            return type == PieceType.LOWER_PIECE ? lower(c, m) : upper(c, m);
        }
        return object(c, m, seg, focus);
    }

    static boolean[] garmentMask(FabricFrame.Mask m) {
        boolean person = m.person();
        boolean[] skin = person ? FabricFrame.keepLarge(m.skin(), m.w(), m.h(), (int) Math.round(m.w() * m.h() * MIN_PERSON_SKIN)) : null;
        boolean[] g = new boolean[m.w() * m.h()];
        for (int i = 0; i < g.length; i++) g[i] = m.fg()[i] && !m.hole()[i] && !(person && skin != null && skin[i]);
        return g;
    }

    private static Result upper(Context c, FabricFrame.Mask m) {
        int w = m.w(), h = m.h();
        boolean person = m.person();
        boolean[] g = garmentMask(m);
        ImageOps.Box b = m.box();
        int shoulders = FabricFrame.firstWideRow(g, w, b, 0.5);
        if (person && shoulders - b.y() > b.h() * 0.45) return c.refuse("GARMENT_NOT_ISOLATED", m);
        int top = person ? shoulders : FabricFrame.firstWideRow(g, w, b, 0.25);
        int hem = b.y() + b.h();
        int head = shoulders - b.y();
        double cx = FabricFrame.centerX(g, w, new ImageOps.Box(b.x(), top, b.w(), Math.max(1, hem - top)));
        List<String> obs = new ArrayList<>();
        if (person) {
            obs.add("MODEL_PHOTO");
            int half = (int) Math.round(b.w() * 0.22);
            int ref = Math.min(hem - 14, shoulders + (int) Math.round(Math.max(head * 0.5, b.h() * 0.06)));
            if (ref > top) {
                int edge = FabricFrame.colorEdge(m.px(), g, w, (int) Math.round(cx), Math.max(4, half / 2), ref, hem, 1);
                int abrupt = abruptEdgeDown(m.px(), g, w, (int) Math.round(cx), Math.max(4, half / 2), ref, hem);
                if (abrupt > 0) edge = Math.min(edge, abrupt);
                if (head > b.h() * 0.05) edge = Math.max(edge, Math.min(hem, shoulders + (int) Math.round(head * 0.9)));
                hem = Math.min(hem, edge);
            }
            if (head > b.h() * 0.05 && c.type() == PieceType.UPPER_PIECE && !LONG_UPPER.contains(c.sub())) {
                hem = Math.min(hem, shoulders + (int) Math.round(head * 1.7));
