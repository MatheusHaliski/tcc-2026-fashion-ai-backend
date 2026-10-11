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
 * Sem quadro possível (peça não isolada, fundo sem cor de estúdio, nenhum quadro de cobertura no topo, quadro pequeno
 * demais) devolve {@code ok=false} com o motivo: a foto não é reenquadrada.
 */
public final class ProductRuleFrame {
    public static final String VERSION = "PRODUCT_RULE_FRAME_V1";
    /** proporção do quadro do editor (o lote grava 900×1200) */
    public static final int ASPECT_W = 3, ASPECT_H = 4;
    /** largura mínima do quadro em pixels da foto analisada (a saída de 900 px amplia no máximo 10×; a ampliação fica no relatório) */
    static final int MIN_WIDTH_PX = 90;
    /** parte de cima / peça inteira: largura mínima do quadro em relação à largura da peça */
    static final double MIN_UPPER_FRACTION = 0.22;
    /** parte de baixo: largura mínima em relação ao quadril (mãos nos bolsos estreitam; menos que isso não é a peça) */
    static final double MIN_LOWER_FRACTION = 0.4;
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
            return type == PieceType.LOWER_PIECE ? lower(c, m) : upper(c, m);
        }
        return object(c, m, seg, focus);
    }

    // ------------------------------------------------------------------ COVER/TOP: parte de cima e peça inteira

    /** Máscara da peça: primeiro plano sem buracos da cor do fundo; em foto com modelo, sem a pele (rosto, pescoço, braços). */
    static boolean[] garmentMask(FabricFrame.Mask m) {
        boolean person = m.person();
        // só manchas de pele de tamanho de corpo (rosto e pescoço, braço, mão, perna): sombra de cáqui/bege na própria peça
        // vira pontinhos "de pele" pequenos e continua peça
        boolean[] skin = person ? FabricFrame.keepLarge(m.skin(), m.w(), m.h(), (int) Math.round(m.w() * m.h() * MIN_PERSON_SKIN)) : null;
        boolean[] g = new boolean[m.w() * m.h()];
        for (int i = 0; i < g.length; i++) g[i] = m.fg()[i] && !m.hole()[i] && !(person && skin[i]);
        return g;
    }

    private static Result upper(Context c, FabricFrame.Mask m) {
        int w = m.w(), h = m.h();
        boolean person = m.person();
        boolean[] g = garmentMask(m);
        ImageOps.Box b = m.box();
        // linha dos ombros: a primeira linha larga da peça (rosto, pescoço e alças são estreitos ou pele)
        int shoulders = FabricFrame.firstWideRow(g, w, b, 0.5);
        if (person && shoulders - b.y() > b.h() * 0.45) return c.refuse("GARMENT_NOT_ISOLATED", m);
        // topo da peça: com modelo, os ombros; no packshot, a gola (a primeira linha com um quarto da largura: o gancho do
        // cabide e a etiqueta são estreitos)
        int top = person ? shoulders : FabricFrame.firstWideRow(g, w, b, 0.25);
        int hem = b.y() + b.h();
        int head = shoulders - b.y();
        double cx = FabricFrame.centerX(g, w, new ImageOps.Box(b.x(), top, b.w(), Math.max(1, hem - top)));
        List<String> obs = new ArrayList<>();
        if (person) {
            obs.add("MODEL_PHOTO");
            // a calça (ou a barriga) abaixo da barra não é esta peça: corta na primeira mudança forte de cor a partir do peito
            int half = (int) Math.round(b.w() * 0.22);
            int ref = Math.min(hem - 14, shoulders + (int) Math.round(Math.max(head * 0.5, b.h() * 0.06)));
            if (ref > top) {
                int edge = FabricFrame.colorEdge(m.px(), g, w, (int) Math.round(cx), Math.max(4, half / 2), ref, hem, 1);
                // e a primeira troca brusca (polo preta para dentro da calça marinho: perto demais para a comparação com o peito)
                int abrupt = abruptEdgeDown(m.px(), g, w, (int) Math.round(cx), Math.max(4, half / 2), ref, hem);
                if (abrupt > 0) edge = Math.min(edge, abrupt);
                // a peça de cima chega ao menos à cintura natural (~0,9× a cabeça com o pescoço abaixo dos ombros): uma troca de
                // cor antes disso é estampa ou bloco de cor da própria peça, não a calça
                if (head > b.h() * 0.05) edge = Math.max(edge, Math.min(hem, shoulders + (int) Math.round(head * 0.9)));
                hem = Math.min(hem, edge);
            }
            // e pela proporção do corpo (escuro sobre escuro): ombro → gancho mede ~1,7× a cabeça com o pescoço
            if (head > b.h() * 0.05 && c.type() == PieceType.UPPER_PIECE && !LONG_UPPER.contains(c.sub())) {
                hem = Math.min(hem, shoulders + (int) Math.round(head * 1.7));
            }
        }
        if (hem - top < 8) return c.refuse("GARMENT_NOT_ISOLATED", m);
        ImageOps.Box pieceBox = rowsBox(g, w, b, top, hem);
        if (pieceBox == null) return c.refuse("GARMENT_NOT_ISOLATED", m);
        NRect product = norm(pieceBox, w, h);
        // teto da regra do card: COVER pela caixa da peça, topo da peça no topo do quadro
        NRect rule = SemanticCropper.registryRuleCrop(w, h, c.aspect(), product, c.profile(), 0);
        int erosion = erosion(w, h);
        boolean[] ge = FabricFrame.erode(g, w, h, erosion);
        int aMax = (int) Math.floor(rule.w() * w / 2);
        int step = Math.max(1, (int) Math.round(pieceBox.w() * 0.02));
        // o topo do quadro fica na faixa da gola/decote: no packshot até 20% da peça; com modelo, 30% (decote abaixo dos ombros)
        Window win = cover(ge, w, cx, step, top, top + (int) Math.round((hem - top) * (person ? 0.30 : 0.20)), hem, hem,
                MIN_WIDTH_PX / 2, aMax, c.aw(), c.ah());
        if (win == null) {
            // decote em V fundo, ombro caído: a faixa do topo se alarga, e isso fica registrado
            win = cover(ge, w, cx, step, top, top + (int) Math.round((hem - top) * (person ? 0.45 : 0.35)), hem, hem,
                    MIN_WIDTH_PX / 2, aMax, c.aw(), c.ah());
            if (win != null) obs.add("TOP_BELOW_NECKLINE_ZONE");
        }
        if (win == null) return c.refuse("NO_COVER_WINDOW_AT_TOP", m);
        if (person) win = inset(win, 0.025, c.aw(), c.ah());     // folga do vão braço–tronco (sombra fina que a máscara não separa)
        if (win.w() < MIN_WIDTH_PX || win.w() < pieceBox.w() * MIN_UPPER_FRACTION) return c.refuse("FRAME_TOO_SMALL", m);
        return garmentResult(c, m, g, win, product, win.y() + win.h(), "FRAME", obs, null);
    }

    // ------------------------------------------------------------------ COVER/TOP: parte de baixo

    private static Result lower(Context c, FabricFrame.Mask m) {
        int w = m.w(), h = m.h();
        boolean person = m.person();
        boolean[] g = garmentMask(m);
        ImageOps.Box b = m.box();
        boolean whole = WHOLE_LOWER.contains(c.sub());
        GarmentCrop.LowerRegion lr = GarmentCrop.lowerRegion(FabricFrame.alphaOf(g, w, h), person);
        ImageOps.Box region = lr.box().w() > 0 ? lr.box() : b;
        int crotch = region.y() + region.h();
        // eixo do corpo: o meio do vão entre as pernas logo abaixo do gancho (a caixa da peça inclui braços, mangas e bolsa,
        // que puxariam o centro); sem vão (saia), o centro da peça
        int gap = legGapCenter(g, w, h, region, crotch);
        double cx = gap > 0 ? gap : FabricFrame.centerX(g, w, region);
        List<String> obs = new ArrayList<>();
        int waist;
        if (person) {
            obs.add("MODEL_PHOTO");
            // com modelo, subindo a partir de logo acima do gancho (sempre a calça), a primeira mudança brusca de cor é o cós:
            // acima dela é a camisa/jaqueta por cima (ou a barriga). Corpo inteiro na foto: o cós fica no máximo a ~24% da altura
            // da pessoa acima do gancho
            int from = Math.max(b.y(), region.y());
            if (lr.estimatedPerson()) from = Math.max(b.y(), (int) Math.round(crotch - b.h() * 0.24));
            boolean shorts = c.sub().contains("shorts");
            int refY = (int) Math.round(crotch - Math.max(6, (crotch - from) * (shorts ? 0.18 : 0.06)));
            int edge = waistEdge(m.px(), g, w, (int) Math.round(cx), Math.max(4, (int) (region.w() * 0.12)), refY, from);
            if (edge > 0) {
                waist = edge;
            } else if (!lr.estimatedPerson() && b.y() <= 1) {
                // foto cortada na cintura: a calça começa no alto da foto
                waist = FabricFrame.firstWideRow(g, w, b, 0.25);
                obs.add("WAISTBAND_AT_PHOTO_TOP");
            } else {
                // a peça de cima cobre o cós (mesma cor, casaco por cima): o quadro não teria o cós no topo
                return c.refuse("WAISTBAND_NOT_FOUND", m);
            }
        } else {
            // packshot: o cós é o topo da peça (passadores e etiqueta são estreitos)
            waist = FabricFrame.firstWideRow(g, w, b, 0.25);
        }
        // o gancho no eixo, abaixo do cós (o recorte da peça pode achar o vão mais embaixo, numa perna aberta)
        int axisCrotch = crotchAlong(g, w, h, (int) Math.round(cx), waist + Math.max(8, (crotch - waist) / 4), crotch + 1);
        if (axisCrotch > 0) crotch = axisCrotch;
        int hem = b.y() + b.h();
        if (person) {
            // só a peça de baixo: no miolo, as cores da calça entre o cós e o gancho; jaqueta/camisa caindo sobre o quadril e
            // cinto de outra cor ficam de fora da máscara (o quadro não os mostra)
            g = lowerColors(m.px(), g, w, h, (int) Math.round(cx), Math.max(8, region.w() / 4), waist, Math.max(waist + 8, crotch));
            hem = hemBelow(g, w, (int) Math.round(cx), Math.max(crotch, waist + 1), hem);
        }
        if (hem - waist < 8) return c.refuse("GARMENT_NOT_ISOLATED", m);
        int erosion = erosion(w, h);
        // do cós até perto do gancho tudo é peça (cós, bolsos e braguilha); abaixo, as pernas seguem e o vão entre elas aparece
        // (saia: o quadro todo). A faixa cobre 80% do caminho cós → gancho: o fim, em V, já é o começo do vão. Gancho colado no
        // cós (vão não achado): sem faixa, o quadro todo tem de ser peça
        boolean rise = crotch - waist >= Math.max(8, (hem - waist) * 0.06);
        int bandEnd = whole || !rise ? hem : Math.min(hem, waist + Math.max(8, (int) Math.round((crotch - waist) * 0.8)));
        ImageOps.Box hips = rowsBox(g, w, b, waist, bandEnd);
        if (hips == null) return c.refuse("GARMENT_NOT_ISOLATED", m);
        if (gap <= 0) cx = FabricFrame.centerX(g, w, new ImageOps.Box(hips.x(), waist, hips.w(), Math.max(1, bandEnd - waist)));
        // largura do quadril: a mediana da largura centrada da peça na faixa (braços, mangas, mãos e bolsa ficam de fora); a
        // caixa a que a regra se aplica é o quadril do cós à barra
        int[] spans = halfSpans(g, w, (int) Math.round(cx), waist, bandEnd);
        int[] sorted = java.util.Arrays.stream(spans).sorted().toArray();
        int hipHalf = sorted.length == 0 ? hips.w() / 2 : sorted[sorted.length / 2];
        if (hipHalf < 4) return c.refuse("GARMENT_NOT_ISOLATED", m);
        int hx0 = Math.max(0, (int) Math.round(cx) - hipHalf), hx1 = Math.min(w, (int) Math.round(cx) + hipHalf);
        NRect product = norm(new ImageOps.Box(hx0, waist, hx1 - hx0, hem - waist), w, h);
        NRect rule = SemanticCropper.registryRuleCrop(w, h, c.aspect(), product, c.profile(), 0);
        boolean[] ge = FabricFrame.erode(g, w, h, erosion);
        int aMax = (int) Math.floor(rule.w() * w / 2);
        int step = Math.max(1, (int) Math.round(hipHalf * 0.04));
        int yLimit = waist + Math.max(erosion + 2, (int) Math.round((hem - waist) * 0.04));
        Window win = cover(ge, w, cx, step, waist, yLimit, hem, bandEnd, MIN_WIDTH_PX / 2, aMax, c.aw(), c.ah());
        if (win == null) return c.refuse("NO_COVER_WINDOW_AT_TOP", m);
        if (win.w() < MIN_WIDTH_PX || win.w() < 2 * hipHalf * MIN_LOWER_FRACTION) return c.refuse("FRAME_TOO_SMALL", m);
        if (bandEnd < win.y() + win.h()) obs.add("LEGS_CONTINUE_PAST_FRAME");
        // foco da parte de baixo como no pipeline do card: a metade de cima do caminho cós → gancho (cós, bolsos e braguilha)
        FramingStrategy.Focus focus = !rise ? null : new FramingStrategy.Focus(c.profile().focus().name(),
                norm(new ImageOps.Box(hx0, waist, hx1 - hx0, Math.max(1, (crotch - waist) / 2)), w, h), List.of(), "WAIST_TO_CROTCH_MASK");
        return garmentResult(c, m, g, win, product, bandEnd, bandEnd < hem ? "WAIST_TO_CROTCH" : "FRAME", obs, focus);
    }

    /** Meio do vão entre as pernas logo abaixo do gancho, a partir do centro da caixa; −1 sem vão. */
    static int legGapCenter(boolean[] g, int w, int h, ImageOps.Box region, int crotch) {
        int y = Math.min(h - 1, crotch + 3), x = region.x() + region.w() / 2;
        if (x < 0 || x >= w || g[y * w + x]) return -1;
        int l = x, r = x;
        while (l > region.x() && !g[y * w + l - 1]) l--;
        while (r < region.x() + region.w() - 1 && !g[y * w + r + 1]) r++;
        return l <= region.x() || r >= region.x() + region.w() - 1 ? -1 : (l + r) / 2;
    }

    /**
     * Gancho na coluna {@code x}: a primeira linha (de {@code from} a {@code to}) em que a coluna sai da peça por algumas linhas
     * seguidas com peça dos dois lados da linha (o vão entre as pernas). −1 sem vão.
     */
    static int crotchAlong(boolean[] g, int w, int h, int x, int from, int to) {
        if (x < 1 || x >= w - 1) return -1;
        int need = Math.max(3, h / 200), streak = 0;
        for (int y = Math.max(0, from); y < Math.min(h, to); y++) {
            boolean gap = !g[y * w + x], left = false, right = false;
            if (gap) {
                for (int k = x - 1; k >= 0 && !left; k--) left = g[y * w + k];
                for (int k = x + 1; k < w && !right; k++) right = g[y * w + k];
            }
            streak = gap && left && right ? streak + 1 : 0;
            if (streak >= need) return y - streak + 1;
        }
        return -1;
    }

    /**
     * Cós numa foto com modelo: subindo de {@code refY} até {@code top}, a primeira mudança <b>brusca</b> de cor no miolo — a
     * média das 4 linhas de cima contra a das 6 de baixo (o desbotado gradual do jeans não conta; a barra da camisa, a
     * barriga ou o cinto contam). Devolve a primeira linha da calça, ou −1 sem mudança.
     */
    static int waistEdge(int[] px, boolean[] g, int w, int cx, int half, int refY, int top) {
        int x0 = Math.max(0, cx - half), x1 = Math.min(w, cx + half);
        int found = -1;
        double best = 0;
        for (int y = refY - 6; y >= top + 4; y--) {
            double[] below = meanColor(px, g, w, x0, x1, y, y + 6);
            if (below == null) continue;
            double[] above = meanColor(px, g, w, x0, x1, y - 4, y);
            double d = above == null ? 999 : Math.sqrt(Math.pow(above[0] - below[0], 2) + Math.pow(above[1] - below[1], 2) + Math.pow(above[2] - below[2], 2));
            if (d > 45 && d > best) { best = d; found = y; }
            else if (found > 0 && y < found - 8) break;            // a mudança mais forte da primeira faixa que mudou
        }
        return found;
    }

    /**
     * Barra da peça de cima numa foto com modelo: descendo de {@code from}, a primeira mudança brusca de cor no miolo (6 linhas
     * de cima contra 4 de baixo; a peça acabando — pele, fundo — também conta). Devolve a primeira linha depois da peça, ou −1.
     */
    static int abruptEdgeDown(int[] px, boolean[] g, int w, int cx, int half, int from, int to) {
        int x0 = Math.max(0, cx - half), x1 = Math.min(w, cx + half);
        int found = -1;
        double best = 0;
        for (int y = from + 6; y <= to - 4; y++) {
            double[] above = meanColor(px, g, w, x0, x1, y - 6, y);
            if (above == null) continue;
            double[] below = meanColor(px, g, w, x0, x1, y, y + 4);
            double d = below == null ? 999 : Math.sqrt(Math.pow(above[0] - below[0], 2) + Math.pow(above[1] - below[1], 2) + Math.pow(above[2] - below[2], 2));
            if (d > 45 && d > best) { best = d; found = y; }
            else if (found > 0 && y > found + 8) break;
        }
        return found;
    }

    private static double[] meanColor(int[] px, boolean[] g, int w, int x0, int x1, int y0, int y1) {
        double r = 0, gg = 0, b = 0;
        int n = 0, all = 0;
        for (int y = y0; y < y1; y++) {
            for (int x = x0; x < x1; x++) {
                all++;
                int i = y * w + x;
                if (!g[i]) continue;
                r += (px[i] >> 16) & 0xFF; gg += (px[i] >> 8) & 0xFF; b += px[i] & 0xFF; n++;
            }
        }
        return n < Math.max(4, all * 0.3) ? null : new double[]{r / n, gg / n, b / n};
    }

    /**
     * Barra da parte de baixo em foto com modelo: a largura da peça logo acima do gancho é a referência; descendo, a primeira
     * faixa em que a peça cai abaixo de 60% dela (a perna de pele do short, a canela de fora) é a barra.
     */
    static int hemBelow(boolean[] g, int w, int cx, int from, int end) {
        int y0 = Math.max(0, from - 3);
        if (cx < 0 || cx >= w || !g[y0 * w + cx]) return end;
        int l = cx, r = cx;
        while (l > 0 && g[y0 * w + l - 1]) l--;
        while (r < w - 1 && g[y0 * w + r + 1]) r++;
        int ref = r - l + 1, streak = 0;
        for (int y = from + 2; y < end; y++) {
            int n = 0;
            for (int x = l; x <= r; x++) n += g[y * w + x] ? 1 : 0;
            streak = n < ref * 0.6 ? streak + 1 : 0;
            if (streak >= 3) return y - 2;
        }
        return end;
    }

    /**
     * Máscara sem o que desce de cima do cós: as cores da peça de cima (medidas nas linhas logo acima do cós) que aparecem
     * entre o cós e a barra, longe das cores da calça (medidas no miolo do quadril) e ligadas à linha do cós — aba de jaqueta,
     * barra de camisa por fora. Desbotado, sombra e costura da própria calça não têm a cor da peça de cima e ficam.
     */
    static boolean[] lowerColors(int[] px, boolean[] g, int w, int h, int cx, int halfW, int waist, int crotch) {
        int[][] pants = FabricFrame.garmentColors(px, g, w, new ImageOps.Box(cx - halfW, waist, 2 * halfW, Math.max(1, crotch - waist)), PieceType.LOWER_PIECE);
        int[][] upper = dominant(px, g, w, Math.max(0, waist - Math.max(10, h / 25)), waist);
        if (upper.length == 0) return g;
        boolean[] other = new boolean[g.length];
        for (int y = Math.max(0, waist); y < h; y++) {
            for (int x = 0; x < w; x++) {
                int i = y * w + x;
                other[i] = g[i] && near(px[i], upper, 45) && !near(px[i], pants, 60);
            }
        }
        int[] labels = new int[other.length];
        List<int[]> comps = ProductSegmenter.components(other, w, h, labels);   // {label, tamanho, x0, y0, x1, y1}
        Set<Integer> drop = new java.util.HashSet<>();
        for (int[] k : comps) if (k[3] <= waist + 2 && k[1] >= w * h * 0.0005) drop.add(k[0]);
        boolean[] out = g.clone();
        for (int i = 0; i < out.length; i++) if (other[i] && drop.contains(labels[i])) out[i] = false;
        return out;
    }

    /** Até 4 cores dominantes (≥ 5%) da máscara nas linhas [y0, y1), na largura toda. */
    static int[][] dominant(int[] px, boolean[] g, int w, int y0, int y1) {
        Map<Integer, long[]> bins = new java.util.HashMap<>();
        for (int y = y0; y < y1; y++) {
            for (int x = 0; x < w; x++) {
                int i = y * w + x;
                if (!g[i]) continue;
                int p = px[i], key = (((p >> 16) & 0xFF) >> 5) << 6 | (((p >> 8) & 0xFF) >> 5) << 3 | ((p & 0xFF) >> 5);
                long[] e = bins.computeIfAbsent(key, k -> new long[4]);
                e[0]++; e[1] += (p >> 16) & 0xFF; e[2] += (p >> 8) & 0xFF; e[3] += p & 0xFF;
            }
        }
        long total = bins.values().stream().mapToLong(e -> e[0]).sum();
        return bins.values().stream().sorted((a, b) -> Long.compare(b[0], a[0])).limit(4).filter(e -> e[0] >= total * 0.05)
                .map(e -> new int[]{(int) (e[1] / e[0]), (int) (e[2] / e[0]), (int) (e[3] / e[0])}).toArray(int[][]::new);
    }

    private static boolean near(int p, int[][] colors, int dist) {
        for (int[] c : colors) {
            int dr = ((p >> 16) & 0xFF) - c[0], dg = ((p >> 8) & 0xFF) - c[1], db = (p & 0xFF) - c[2];
            if (dr * dr + dg * dg + db * db <= dist * dist) return true;
        }
        return false;
    }

    private static Result garmentResult(Context c, FabricFrame.Mask m, boolean[] g, Window win, NRect product, int bandEnd,
                                        String scope, List<String> obs, FramingStrategy.Focus focusOverride) {
        int w = m.w(), h = m.h();
        NRect crop = new NRect(win.x() / (double) w, win.y() / (double) h, win.w() / (double) w, win.h() / (double) h);
        long on = 0, all = 0;
        int end = Math.min(win.y() + win.h(), bandEnd);
        for (int y = win.y(); y < end; y++) {
            for (int x = win.x(); x < win.x() + win.w(); x++) { all++; on += g[y * w + x] ? 1 : 0; }
        }
        if (all == 0) return garmentResult(c, m, g, win, product, win.y() + win.h(), "FRAME", obs, focusOverride);
        double coverage = (double) on / all;
        FramingStrategy.Focus focus = focusOverride != null ? focusOverride : SemanticCropper.registryFocus(product, c.profile());
        Map<String, Object> compliance = new LinkedHashMap<>();
        SemanticCropper.ruleScore(crop, w, h, product, focus, c.profile().rule(), 0, List.of(), compliance);
        compliance.put("garmentCoverage", NRect.r4(coverage));
        compliance.put("coverageScope", scope);
        if (Boolean.FALSE.equals(compliance.get("focusInTopHalf")) && c.profile().rule().focusTopHalf()) obs.add("FOCUS_NOT_IN_TOP_HALF");
        if (coverage < 1) {
            return new Result(false, "COVERAGE_BELOW_100", crop, c.aw(), c.ah(), c.profile().rule(), c.origin(), c.registryVersion(),
                    c.type(), c.sub(), c.target(), focus.name(), focus.rect(), product, m.person(), m.skinShare(), coverage, scope,
                    product.insideOf(crop), 0, hex(m), List.of(), null, compliance, win.w(), List.copyOf(obs));
        }
        return new Result(true, null, crop, c.aw(), c.ah(), c.profile().rule(), c.origin(), c.registryVersion(), c.type(), c.sub(),
                c.target(), focus.name(), focus.rect(), product, m.person(), m.skinShare(), coverage, scope, product.insideOf(crop), 0,
                hex(m), List.of(), null, compliance, win.w(), List.copyOf(obs));
    }

    // ------------------------------------------------------------------ WIDTH / CONTAIN / COVER-FOCUS: objeto inteiro

    private static Result object(Context c, FabricFrame.Mask m, ProductSegmenter.Segmentation seg, FramingStrategy.Focus detected) {
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
            raw = FabricFrame.studioForeground(m.px(), w, h, m.bg());
        } else {
            raw = new boolean[w * h];
            for (int i = 0; i < raw.length; i++) raw[i] = seg.mask()[i] && (m.px()[i] >>> 24) >= 160;
        }
        int[] labels = new int[raw.length];
        List<int[]> comps = ProductSegmenter.components(raw, w, h, labels);   // {label, tamanho, x0, y0, x1, y1}
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

    // ------------------------------------------------------------------ busca do quadro de cobertura

    /** Quadro em pixels da máscara: colunas [x, x+w), linhas [y, y+h). */
    record Window(int x, int y, int w, int h) { }

    /**
     * Maior quadro aw:ah com o topo entre {@code yTop} e {@code yLimit}, a base até {@code yBottom}, centrado no eixo
     * {@code cx} (ou até 3 passos para os lados) e com toda linha acima de {@code bandEnd} inteiramente dentro de {@code g}.
     * Entre quadros da mesma largura, o de topo mais alto; entre posições, a mais central.
     */
    static Window cover(boolean[] g, int w, double cx, int step, int yTop, int yLimit, int yBottom, int bandEnd,
                        int aMin, int aMax, int aw, int ah) {
        if (yBottom <= yTop || aMax < aMin) return null;
        Window best = null;
        for (int k = 0; k <= 3; k++) {
            for (int sign : k == 0 ? new int[]{0} : new int[]{-1, 1}) {
                int x = (int) Math.round(cx) + sign * k * step;
                if (x < 1 || x >= w - 1) continue;
                int[] s = halfSpans(g, w, x, yTop, yBottom);
                Window win = largest(s, x, yTop, yLimit, yBottom, bandEnd, aMin, aMax, aw, ah);
                if (win != null && (best == null || win.w() > best.w() || (win.w() == best.w() && win.y() < best.y()))) best = win;
            }
        }
        return best;
    }

    /** Recolhe as laterais em {@code share} da largura de cada lado, mantendo o topo e a proporção (a base sobe junto). */
    static Window inset(Window win, double share, int aw, int ah) {
        int dx = (int) Math.round(win.w() * share);
        int width = win.w() - 2 * dx;
        width -= width % aw;
        int x = win.x() + (win.w() - width) / 2;
        return new Window(x, win.y(), width, width / aw * ah);
    }

    /** Por linha, a maior meia-largura {@code a} com as colunas [x−a, x+a) todas na máscara. */
    static int[] halfSpans(boolean[] g, int w, int x, int y0, int y1) {
        int[] s = new int[y1 - y0];
        for (int y = y0; y < y1; y++) {
            int row = y * w;
            if (!g[row + x]) continue;
            int left = 0, right = 0;
            while (x - left - 1 >= 0 && g[row + x - left - 1]) left++;
            while (x + right < w && g[row + x + right]) right++;
            s[y - y0] = Math.min(left, right);
        }
        return s;
    }

    /** Busca binária na meia-largura (se uma cabe, uma menor também cabe); para cada uma, o primeiro topo que serve. */
    static Window largest(int[] s, int x, int yTop, int yLimit, int yBottom, int bandEnd, int aMin, int aMax, int aw, int ah) {
        int lo = aMin, hi = aMax;
        Window found = null;
        while (lo <= hi) {
            int a = (lo + hi) >>> 1;
            Window win = firstFit(s, x, a, yTop, yLimit, yBottom, bandEnd, aw, ah);
            if (win != null) { found = win; lo = a + 1; } else hi = a - 1;
        }
        return found;
    }

    static Window firstFit(int[] s, int x, int a, int yTop, int yLimit, int yBottom, int bandEnd, int aw, int ah) {
        int width = 2 * a, height = (int) Math.round(width * ah / (double) aw);
        int n = s.length;
        int[] bad = new int[n + 1];                     // linhas da faixa (acima de bandEnd) estreitas demais, acumuladas
        for (int i = 0; i < n; i++) bad[i + 1] = bad[i] + (yTop + i < bandEnd && s[i] < a ? 1 : 0);
        int last = Math.min(yLimit, yBottom - height);
        for (int y = yTop; y <= last; y++) {
            int end = Math.min(y + height, bandEnd);
            if (end <= y || bad[end - yTop] - bad[y - yTop] == 0) return new Window(x - a, y, width, height);
        }
        return null;
    }

    // ------------------------------------------------------------------ utilitários

    /** Caixa das colunas da máscara nas linhas [y0, y1), dentro de {@code b}; null sem pixel. */
    static ImageOps.Box rowsBox(boolean[] g, int w, ImageOps.Box b, int y0, int y1) {
        int x0 = Integer.MAX_VALUE, x1 = -1;
        for (int y = Math.max(b.y(), y0); y < Math.min(b.y() + b.h(), y1); y++) {
            for (int x = b.x(); x < b.x() + b.w(); x++) {
                if (g[y * w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
            }
        }
        return x1 < 0 ? null : new ImageOps.Box(x0, y0, x1 - x0 + 1, Math.max(1, y1 - y0));
    }

    private static NRect norm(ImageOps.Box b, int w, int h) {
        return new NRect(b.x() / (double) w, b.y() / (double) h, b.w() / (double) w, b.h() / (double) h);
    }

    /** Folga até a borda da peça: 0,3% do menor lado, mínimo 2 px (a interpolação e o JPEG não trazem fundo para dentro). */
    static int erosion(int w, int h) {
        return Math.max(2, (int) Math.round(Math.min(w, h) * 0.003));
    }

    private static String hex(FabricFrame.Mask m) {
        if (m.bg() == null) return null;
        return String.format("#%02x%02x%02x", m.bg()[0], m.bg()[1], m.bg()[2]);
    }
}
