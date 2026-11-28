package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.GarmentCrop;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.catalog.image.CoverSearch.Window;
import br.com.fashionai.application.catalog.image.ProductRuleFrame.Context;
import br.com.fashionai.application.catalog.image.ProductRuleFrame.Result;

import java.util.ArrayList;
import java.util.List;

import static br.com.fashionai.application.catalog.image.CoverSearch.cover;
import static br.com.fashionai.application.catalog.image.CoverSearch.halfSpans;
import static br.com.fashionai.application.catalog.image.CoverSearch.rowsBox;
import static br.com.fashionai.application.catalog.image.GarmentColorEdges.lowerColors;
import static br.com.fashionai.application.catalog.image.GarmentColorEdges.waistEdge;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.MIN_LOWER_FRACTION;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.MIN_WIDTH_PX;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.WHOLE_LOWER;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.erosion;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.garmentMask;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.garmentResult;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.norm;

/**
 * Regra do produto COVER/TOP para parte de baixo: cós no topo do quadro (pela troca brusca de cor em foto com modelo),
 * do cós até perto do gancho tudo é peça e as pernas seguem além da base; inclui a geometria das pernas (vão, gancho
 * no eixo, barra).
 */
final class LowerCoverFrame {
    private LowerCoverFrame() {
    }

    static Result lower(Context c, FabricFrame.Mask m) {
        int w = m.w(), h = m.h();
        boolean person = m.person();
        boolean[] g = garmentMask(m);
        ImageOps.Box b = m.box();
        boolean whole = WHOLE_LOWER.contains(c.sub());
        GarmentCrop.LowerRegion lr = GarmentCrop.lowerRegion(FabricMasks.alphaOf(g, w, h), person);
        ImageOps.Box region = lr.box().w() > 0 ? lr.box() : b;
        int crotch = region.y() + region.h();
        // eixo do corpo: o meio do vão entre as pernas logo abaixo do gancho (a caixa da peça inclui braços, mangas e bolsa,
        // que puxariam o centro); sem vão (saia), o centro da peça
        int gap = legGapCenter(g, w, h, region, crotch);
        double cx = gap > 0 ? gap : FabricMasks.centerX(g, w, region);
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
                waist = FabricMasks.firstWideRow(g, w, b, 0.25);
                obs.add("WAISTBAND_AT_PHOTO_TOP");
            } else {
                // a peça de cima cobre o cós (mesma cor, casaco por cima): o quadro não teria o cós no topo
                return c.refuse("WAISTBAND_NOT_FOUND", m);
            }
        } else {
            // packshot: o cós é o topo da peça (passadores e etiqueta são estreitos)
            waist = FabricMasks.firstWideRow(g, w, b, 0.25);
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
        if (gap <= 0) cx = FabricMasks.centerX(g, w, new ImageOps.Box(hips.x(), waist, hips.w(), Math.max(1, bandEnd - waist)));
        // largura do quadril: a mediana da largura centrada da peça na faixa (braços, mangas, mãos e bolsa ficam de fora); a
        // caixa a que a regra se aplica é o quadril do cós à barra
        int[] spans = halfSpans(g, w, (int) Math.round(cx), waist, bandEnd);
        int[] sorted = java.util.Arrays.stream(spans).sorted().toArray();
        int hipHalf = sorted.length == 0 ? hips.w() / 2 : sorted[sorted.length / 2];
        if (hipHalf < 4) return c.refuse("GARMENT_NOT_ISOLATED", m);
        int hx0 = Math.max(0, (int) Math.round(cx) - hipHalf), hx1 = Math.min(w, (int) Math.round(cx) + hipHalf);
        NRect product = norm(new ImageOps.Box(hx0, waist, hx1 - hx0, hem - waist), w, h);
        NRect rule = SemanticCropper.registryRuleCrop(w, h, c.aspect(), product, c.profile(), 0);
        boolean[] ge = FabricMasks.erode(g, w, h, erosion);
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
        // largura da peça na faixa do cós: o quadril (mediana centrada do cós a 80% do gancho)
        return garmentResult(c, m, g, win, product, bandEnd, bandEnd < hem ? "WAIST_TO_CROTCH" : "FRAME", obs, focus, 2 * hipHalf);
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
}
