package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.GarmentCrop;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.catalog.image.FabricFrame.Plan;

import java.util.Locale;

import static br.com.fashionai.application.catalog.image.FabricColors.colorEdge;
import static br.com.fashionai.application.catalog.image.FabricColors.openByColor;
import static br.com.fashionai.application.catalog.image.FabricFrame.NO_FLY;
import static br.com.fashionai.application.catalog.image.FabricFrame.OPEN_FRONT;
import static br.com.fashionai.application.catalog.image.FabricMasks.alphaOf;
import static br.com.fashionai.application.catalog.image.FabricMasks.centerX;
import static br.com.fashionai.application.catalog.image.FabricMasks.firstWideRow;

/**
 * Plano do quadro de tecido por categoria/subcategoria: região (em pixels da máscara) e ponto de ancoragem — gola,
 * braguilha ou painel da frente, logo do calçado, centro do acessório.
 */
final class FabricPlanner {
    private FabricPlanner() {
    }

    /** Região (em pixels da máscara) e ponto de ancoragem de cada categoria/subcategoria. */
    static Plan plan(PieceType type, String sub, boolean[] fabric, int[] px, int w, int h, ImageOps.Box b, FramingStrategy.Focus focus,
                             boolean person) {
        double cx = centerX(fabric, w, b);
        switch (type) {
            case UPPER_PIECE, FULL_BODY_PIECE -> {
                // linha dos ombros: a primeira linha larga da peça (rosto, pescoço e alças são estreitos ou pele)
                int shoulders = firstWideRow(fabric, w, b, 0.5);
                // com modelo, a peça de cima começa no alto da pessoa; tecido largo só embaixo é a calça/short — a peça de
                // cima sumiu da máscara (da cor do fundo) e o quadro cairia na peça errada
                if (person && shoulders - b.y() > b.h() * 0.45) return Plan.refuse("GARMENT_NOT_ISOLATED");
                double torsoH = b.y() + b.h() - shoulders;
                int top = (int) Math.round(shoulders + (person ? b.h() * 0.035 : torsoH * 0.06));
                int bottom = (int) Math.round(b.y() + b.h() - (person ? 0 : torsoH * 0.03));
                int half = (int) Math.round(b.w() * (person ? 0.22 : 0.32));
                if (person) {
                    // a calça (ou a pele da barriga) abaixo da barra não é esta peça: corta na primeira mudança forte de cor
                    bottom = Math.min(bottom, colorEdge(px, fabric, w, (int) Math.round(cx), Math.max(4, half / 2), top, bottom, 1));
                    // e pela proporção do corpo, para escuro sobre escuro (polo preta com calça marinho): o tronco, dos ombros à
                    // cintura natural, mede ~1× a altura da cabeça com o pescoço (e o cabelo); 0,8× deixa o quadro no peito
                    int head = shoulders - b.y();
                    if (head > b.h() * 0.05) bottom = Math.min(bottom, shoulders + (int) Math.round(head * 0.8));
                }
                if (type == PieceType.FULL_BODY_PIECE) bottom = (int) Math.round(Math.min(bottom, top + (bottom - top) * 0.6));
                // sem as mangas: o miolo da largura da peça; aberta na frente, só um painel (a abertura central mostra o que
                // está por baixo — outra peça ou o fundo —, que não é o tecido desta peça)
                boolean open = OPEN_FRONT.contains(sub) || openByColor(px, fabric, w, (int) Math.round(cx), half,
                        top + (bottom - top) / 6, top + (bottom - top) / 2);
                int left = (int) Math.round(cx) - half, width = open ? (int) Math.round(half - b.w() * 0.04) : half * 2;
                ImageOps.Box region = clip(new ImageOps.Box(left, top, width, Math.max(1, bottom - top)), w, h);
                double ax = open ? left + width * 0.5 : cx;   // painel da frente, fora da abertura central
                double ay = top + (bottom - top) * (type == PieceType.UPPER_PIECE ? 0.12 : 0.3);
                return new Plan(region, ax, ay, type == PieceType.UPPER_PIECE ? "ESTIMATED_COLLAR" : "ESTIMATED_BODICE");
            }
            case LOWER_PIECE -> {
                if (NO_FLY.contains(sub)) {
                    int top = (int) Math.round(b.y() + b.h() * 0.08);                 // abaixo do cós
                    int bottom = (int) Math.round(b.y() + b.h() * (sub.equals("leggings") ? 0.45 : 0.75));
                    int half = (int) Math.round(b.w() * 0.4);
                    ImageOps.Box region = clip(new ImageOps.Box((int) Math.round(cx) - half, top, half * 2, Math.max(1, bottom - top)), w, h);
                    return new Plan(region, cx, top + (bottom - top) * 0.3, "ESTIMATED_FRONT_PANEL");
                }
                GarmentCrop.LowerRegion lower = GarmentCrop.lowerRegion(alphaOf(fabric, w, h), person);
                ImageOps.Box region = lower.box().w() > 0 ? lower.box() : b;
                int crotch = region.y() + region.h();
                if (lower.estimatedPerson()) {
                    // com modelo, cintura → gancho fica na faixa logo acima do gancho (acima dela é a camisa/jaqueta)
                    int top = Math.max(region.y(), (int) Math.round(crotch - b.h() * 0.14));
                    region = new ImageOps.Box(region.x(), top, region.w(), Math.max(1, crotch - top));
                }
                // o cós: subindo a partir de logo acima do gancho (sempre a calça), a primeira mudança forte de cor — acima dela é
                // a camisa/jaqueta por cima (ou um cós de outra cor); a região começa ali
                // shorts/bermuda: a barra (com pesponto) fica no fim da região — a referência sobe para longe dela
                boolean shorts = sub.contains("shorts");
                int refY = (int) Math.round(crotch - Math.max(6, region.h() * (shorts ? 0.3 : 0.1)));
                int waist = colorEdge(px, fabric, w, (int) Math.round(cx), Math.max(4, (int) (region.w() * 0.15)), refY, region.y(), -1);
                if (waist > region.y()) region = new ImageOps.Box(region.x(), waist, region.w(), Math.max(1, crotch - waist));
                // só o miolo do quadril: jaqueta aberta caindo nas laterais e as mãos nos bolsos ficam de fora
                int halfHip = (int) Math.round(region.w() * 0.27);
                region = clip(new ImageOps.Box((int) Math.round(cx) - halfHip, region.y(), halfHip * 2, region.h()), w, h);
                // braguilha: no miolo, na metade de baixo do caminho cós → gancho
                double ay = region.y() + region.h() * (shorts ? 0.45 : 0.55);
                if (focus != null && focus.name() != null && focus.name().toLowerCase(Locale.ROOT).matches(".*(zipper|fastening|fly).*") && "LANDMARKS".equals(focus.source())) {
                    NRect r = focus.rect();
                    return new Plan(region, r.cx() * w, r.cy() * h, "PIPELINE_LANDMARK");
                }
                return new Plan(region, cx, ay, "ESTIMATED_FLY");
            }
            case SHOES_PIECE -> {
                // cabedal: sem a sola (faixa de baixo) e sem a ponta do cano
                int top = (int) Math.round(b.y() + b.h() * 0.05), bottom = (int) Math.round(b.y() + b.h() * 0.80);
                ImageOps.Box region = clip(new ImageOps.Box(b.x(), top, b.w(), Math.max(1, bottom - top)), w, h);
                if (focus != null && focus.name() != null && focus.name().toLowerCase(Locale.ROOT).contains("logo") && "LANDMARKS".equals(focus.source())) {
                    NRect r = focus.rect();
                    return new Plan(region, r.cx() * w, r.cy() * h, "PIPELINE_LANDMARK");
                }
                return new Plan(region, cx, b.y() + b.h() * 0.42, "ESTIMATED_LOGO");
            }
            default -> {
                int inset = (int) Math.round(Math.min(b.w(), b.h()) * 0.04);
                ImageOps.Box region = clip(new ImageOps.Box(b.x() + inset, b.y() + inset, b.w() - 2 * inset, b.h() - 2 * inset), w, h);
                return new Plan(region, cx, b.y() + b.h() * 0.5, "ESTIMATED_BODY");
            }
        }
    }

    private static ImageOps.Box clip(ImageOps.Box b, int w, int h) {
        int x0 = Math.max(0, b.x()), y0 = Math.max(0, b.y()), x1 = Math.min(w, b.x() + b.w()), y1 = Math.min(h, b.y() + b.h());
        return new ImageOps.Box(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
    }
}
