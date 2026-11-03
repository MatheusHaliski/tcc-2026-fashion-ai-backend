package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.catalog.image.CoverSearch.Window;
import br.com.fashionai.application.catalog.image.ProductRuleFrame.Context;
import br.com.fashionai.application.catalog.image.ProductRuleFrame.Result;

import java.util.ArrayList;
import java.util.List;

import static br.com.fashionai.application.catalog.image.CoverSearch.cover;
import static br.com.fashionai.application.catalog.image.CoverSearch.inset;
import static br.com.fashionai.application.catalog.image.CoverSearch.medianRowWidth;
import static br.com.fashionai.application.catalog.image.CoverSearch.rowsBox;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.LONG_UPPER;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.MIN_UPPER_FRACTION;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.MIN_WIDTH_PX;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.erosion;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.garmentMask;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.garmentResult;
import static br.com.fashionai.application.catalog.image.ProductRuleFrame.norm;

/**
 * Regra do produto COVER/TOP para parte de cima e peça inteira: o maior quadro com o topo na gola/decote (com modelo,
 * nos ombros, sem rosto nem pescoço), centrado no eixo da peça e todo em peça; em foto com modelo a barra para na
 * primeira troca de cor e na proporção do corpo.
 */
final class UpperCoverFrame {
    private UpperCoverFrame() {
    }

    static Result upper(Context c, FabricFrame.Mask m) {
        int w = m.w(), h = m.h();
        boolean person = m.person();
        boolean[] g = garmentMask(m);
        ImageOps.Box b = m.box();
        // linha dos ombros: a primeira linha larga da peça (rosto, pescoço e alças são estreitos ou pele)
        int shoulders = FabricMasks.firstWideRow(g, w, b, 0.5);
        if (person && shoulders - b.y() > b.h() * 0.45) return c.refuse("GARMENT_NOT_ISOLATED", m);
        // topo da peça: com modelo, os ombros; no packshot, a gola (a primeira linha com um quarto da largura: o gancho do
        // cabide e a etiqueta são estreitos)
        int top = person ? shoulders : FabricMasks.firstWideRow(g, w, b, 0.25);
        int hem = b.y() + b.h();
        int head = shoulders - b.y();
        double cx = FabricMasks.centerX(g, w, new ImageOps.Box(b.x(), top, b.w(), Math.max(1, hem - top)));
        List<String> obs = new ArrayList<>();
        if (person) {
            obs.add("MODEL_PHOTO");
            // a calça (ou a barriga) abaixo da barra não é esta peça: corta na primeira mudança forte de cor a partir do peito
            int half = (int) Math.round(b.w() * 0.22);
            int ref = Math.min(hem - 14, shoulders + (int) Math.round(Math.max(head * 0.5, b.h() * 0.06)));
            if (ref > top) {
                int edge = FabricColors.colorEdge(m.px(), g, w, (int) Math.round(cx), Math.max(4, half / 2), ref, hem, 1);
                // e a primeira troca brusca (polo preta para dentro da calça marinho: perto demais para a comparação com o peito)
                int abrupt = GarmentColorEdges.abruptEdgeDown(m.px(), g, w, (int) Math.round(cx), Math.max(4, half / 2), ref, hem);
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
        boolean[] ge = FabricMasks.erode(g, w, h, erosion);
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
        // largura da peça na faixa do topo do quadro: a mediana da largura da peça nas linhas do quadro
        int garmentWidth = medianRowWidth(g, w, b, win.y(), win.y() + win.h());
        return garmentResult(c, m, g, win, product, win.y() + win.h(), "FRAME", obs, null, garmentWidth);
    }
}
