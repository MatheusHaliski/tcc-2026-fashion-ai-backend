package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;

import java.util.LinkedHashMap;
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
 * Quadro de cobertura estreito demais para a peça (menos de 55% da largura da peça na faixa do topo do quadro — tronco na
 * faixa do decote, quadril na faixa do cós) é um zoom de tecido, não a peça: recusado ({@code COVER_FRAME_TOO_NARROW}).
 * Sem quadro possível (peça não isolada, fundo sem cor de estúdio, nenhum quadro de cobertura no topo, quadro pequeno
 * ou estreito demais) devolve {@code ok=false} com o motivo: a foto não é reenquadrada.
 */
public final class ProductRuleFrame {
    /** V2: quadro de cobertura estreito demais para a peça é recusado (COVER_FRAME_TOO_NARROW); análises guardadas da V1 são refeitas */
    public static final String VERSION = "PRODUCT_RULE_FRAME_V2";
    /** proporção do quadro do editor (o lote grava 900×1200) */
    public static final int ASPECT_W = 3, ASPECT_H = 4;
    /** largura mínima do quadro em pixels da foto analisada (a saída de 900 px amplia no máximo 10×; a ampliação fica no relatório) */
    static final int MIN_WIDTH_PX = 90;
    /** parte de cima / peça inteira: largura mínima do quadro em relação à largura da peça */
    static final double MIN_UPPER_FRACTION = 0.22;
    /** parte de baixo: largura mínima em relação ao quadril (mãos nos bolsos estreitam; menos que isso não é a peça) */
    static final double MIN_LOWER_FRACTION = 0.4;
    /**
     * quadro de cobertura (parte de cima, peça inteira, parte de baixo): largura mínima em relação à largura da peça na faixa
     * do topo do quadro. Parte de cima/peça inteira: a mediana, nas linhas do quadro (do decote para baixo), da largura da
     * peça na linha (da primeira à última coluna da peça: o tronco com as mangas; uma listra da cor do fundo não a encurta).
     * Parte de baixo: a largura do quadril na faixa do cós ao gancho (a mesma mediana que dá a caixa da regra). Menos que
     * isso o quadro é um zoom borrado de tecido (polo de listras claras, jaqueta/mãos estreitando o cós), não a peça
     */
    static final double MIN_COVER_WIDTH_SHARE = 0.55;
    /** folga mínima de cada lado em WIDTH/CONTAIN: o arredondamento para pixels nunca corta o objeto */
    static final double OBJECT_MARGIN_FLOOR = 0.02;
    /** componente separado com ao menos esta fração do maior faz parte do objeto (o outro pé do par, o brinco do par) */
    static final double PART_SHARE = 0.15;
    /** objeto com ao menos esta fração de pele estranha a ele é carregado/vestido por alguém (rosto e braços passam de 5%;
     *  reflexo quente no aço do relógio ou couro caramelo ficam em ~1%) */
    static final double OBJECT_PERSON_SKIN = 0.04;
    /** mancha de pele com ao menos esta fração da foto é pessoa (rosto, braço, mão); menor é sombra/estampa da peça */
    static final double MIN_PERSON_SKIN = 0.0015;
    /** saia e saia-short: uma peça só do cós à barra, o quadro todo tem de ser peça */
    static final Set<String> WHOLE_LOWER = Set.of("skirt", "skort");
    /** agasalho aberto/comprido: a barra pode passar da cintura (sem o teto pela proporção do corpo) */
    static final Set<String> LONG_UPPER = Set.of("jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono", "vest");

    /**
     * @param crop            quadro normalizado na foto (pode passar de 0–1 só em WIDTH/CONTAIN, onde vira fundo de estúdio)
     * @param product         caixa de referência a que a regra foi aplicada (peça isolada: gola→barra, cós→barra, objeto)
     * @param garmentCoverage fração do quadro que é peça, medida em {@code coverageScope} (FRAME ou WAIST_TO_CROTCH)
     * @param objectInside    fração da caixa do objeto dentro do quadro (1 = inteiro)
     * @param padding         fração do quadro fora da foto (preenchida com {@code background})
     */
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

    /** Contexto comum: perfil do registro já resolvido para piece_type + subcategoria e a proporção do quadro. */
    record Context(PieceType type, String sub, SemanticRegionRegistry.Profile profile, String origin, String registryVersion,
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

    /** Quadro 3:4 da regra do produto para a foto já segmentada. */
    public static Result find(ProductSegmenter.Segmentation seg, PieceType type, String subcategory, SemanticRegionRegistry registry) {
        return find(FabricFrame.mask(seg, type), seg, type, subcategory, registry, ASPECT_W, ASPECT_H, null);
    }

    /**
     * O mesmo com a máscara já calculada ({@link FabricFrame#mask}), uma proporção qualquer e o foco do pipeline
     * ({@code focus}: o mostrador do relógio / a ponte dos óculos achados pelos landmarks valem no lugar da região padrão).
     */
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
            return type == PieceType.LOWER_PIECE ? LowerCoverFrame.lower(c, m) : UpperCoverFrame.upper(c, m);
        }
        return ObjectRuleFrame.object(c, m, seg, focus);
    }

    /** Máscara da peça: primeiro plano sem buracos da cor do fundo; em foto com modelo, sem a pele (rosto, pescoço, braços). */
    static boolean[] garmentMask(FabricFrame.Mask m) {
        boolean person = m.person();
        // só manchas de pele de tamanho de corpo (rosto e pescoço, braço, mão, perna): sombra de cáqui/bege na própria peça
        // vira pontinhos "de pele" pequenos e continua peça
        boolean[] skin = person ? FabricMasks.keepLarge(m.skin(), m.w(), m.h(), (int) Math.round(m.w() * m.h() * MIN_PERSON_SKIN)) : null;
        boolean[] g = new boolean[m.w() * m.h()];
        for (int i = 0; i < g.length; i++) g[i] = m.fg()[i] && !m.hole()[i] && !(person && skin[i]);
        return g;
    }

    static Result garmentResult(Context c, FabricFrame.Mask m, boolean[] g, CoverSearch.Window win, NRect product, int bandEnd,
                                String scope, List<String> obs, FramingStrategy.Focus focusOverride, int garmentWidth) {
        int w = m.w(), h = m.h();
        NRect crop = new NRect(win.x() / (double) w, win.y() / (double) h, win.w() / (double) w, win.h() / (double) h);
        long on = 0, all = 0;
        int end = Math.min(win.y() + win.h(), bandEnd);
        for (int y = win.y(); y < end; y++) {
            for (int x = win.x(); x < win.x() + win.w(); x++) { all++; on += g[y * w + x] ? 1 : 0; }
        }
        if (all == 0) return garmentResult(c, m, g, win, product, win.y() + win.h(), "FRAME", obs, focusOverride, garmentWidth);
        double coverage = (double) on / all;
        FramingStrategy.Focus focus = focusOverride != null ? focusOverride : SemanticCropper.registryFocus(product, c.profile());
        Map<String, Object> compliance = new LinkedHashMap<>();
        SemanticCropper.ruleScore(crop, w, h, product, focus, c.profile().rule(), 0, List.of(), compliance);
        compliance.put("garmentCoverage", NRect.r4(coverage));
        compliance.put("coverageScope", scope);
        // quadro ÷ largura da peça na faixa do topo do quadro (tronco na faixa do decote, quadril na faixa do cós)
        double widthShare = garmentWidth > 0 ? win.w() / (double) garmentWidth : 1;
        compliance.put("garmentWidthPx", garmentWidth);
        compliance.put("frameWidthShare", NRect.r4(widthShare));
        if (Boolean.FALSE.equals(compliance.get("focusInTopHalf")) && c.profile().rule().focusTopHalf()) obs.add("FOCUS_NOT_IN_TOP_HALF");
        String refusal = coverage < 1 ? "COVERAGE_BELOW_100" : widthShare < MIN_COVER_WIDTH_SHARE ? "COVER_FRAME_TOO_NARROW" : null;
        if (refusal != null) {
            return new Result(false, refusal, crop, c.aw(), c.ah(), c.profile().rule(), c.origin(), c.registryVersion(),
                    c.type(), c.sub(), c.target(), focus.name(), focus.rect(), product, m.person(), m.skinShare(), coverage, scope,
                    product.insideOf(crop), 0, hex(m), List.of(), null, compliance, win.w(), List.copyOf(obs));
        }
        return new Result(true, null, crop, c.aw(), c.ah(), c.profile().rule(), c.origin(), c.registryVersion(), c.type(), c.sub(),
                c.target(), focus.name(), focus.rect(), product, m.person(), m.skinShare(), coverage, scope, product.insideOf(crop), 0,
                hex(m), List.of(), null, compliance, win.w(), List.copyOf(obs));
    }

    static NRect norm(ImageOps.Box b, int w, int h) {
        return new NRect(b.x() / (double) w, b.y() / (double) h, b.w() / (double) w, b.h() / (double) h);
    }

    /** Folga até a borda da peça: 0,3% do menor lado, mínimo 2 px (a interpolação e o JPEG não trazem fundo para dentro). */
    static int erosion(int w, int h) {
        return Math.max(2, (int) Math.round(Math.min(w, h) * 0.003));
    }

    static String hex(FabricFrame.Mask m) {
        if (m.bg() == null) return null;
        return String.format("#%02x%02x%02x", m.bg()[0], m.bg()[1], m.bg()[2]);
    }
}
