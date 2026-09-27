package br.com.fashionai.application.imaging;

import br.com.fashionai.domain.model.enums.BodyBuild;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.geom.GeneralPath;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Digital double — o manequim 2D derivado do Avatar 3D tem as mesmas larguras, alturas e caixas de peça do corpo 3D
 * (lib/avatar3d/body-spec.ts / photoBox). Grava as linhas de base do provador 2D em target/digital-double/ para o
 * relatório (manequim genérico × manequim do avatar, com a mesma camisa sintética).
 */
class TryOnDigitalDoubleTest {
    private static final MannequinGeometry.Params F = new MannequinGeometry.Params(1.63, 0.19, 0.175, 0.15, 0.205, 0.53, 0.333, 0.13, 0);
    private static final MannequinGeometry.Params MEDIDO = new MannequinGeometry.Params(1.72, 0.21, 0.19, 0.16, 0.22, 0.53, 0.333, 0.13, 0.4);

    @Test
    void niveisEmOrdemEDentroDoCanvas() {
        MannequinGeometry.Body b = MannequinGeometry.fromParams(MannequinSex.FEMININO, F);
        List<String> order = List.of("headTop", "chin", "neck", "shoulder", "chest", "waist", "hip", "crotch", "knee", "ankle");
        double prev = -1;
        for (String k : order) {
            double v = b.levels().get(k);
            assertTrue(v > prev && v >= 0 && v <= 1, k + "=" + v);
            prev = v;
        }
        b.anchors().forEach((k, box) -> assertTrue(box.x() >= -0.05 && box.x() + box.w() <= 1.05 && box.y() >= -0.05 && box.y() + box.h() <= 1.05, k + " " + box));
    }

    @Test
    void mesmasLargurasDoCorpo3d() {
        MannequinGeometry.Body b = MannequinGeometry.fromParams(MannequinSex.FEMININO, F);
        double k = MannequinGeometry.pxPerMeter(F.stature());
        // cintura e quadril: larguras do corte do body-spec (waistW·H, hipW·H) em fração da largura do canvas
        assertEquals(F.waistW() * F.stature() * k / MannequinGeometry.WIDTH, b.waistW(), 1e-9);
        assertEquals(F.hipW() * F.stature() * k / MannequinGeometry.WIDTH, b.hipW(), 1e-9);
        // caixa da parte de cima = photoBox("upper"): largura 3,4 × meia-distância entre ombros
        MannequinGeometry.Box top = b.anchors().get("TOP");
        assertEquals(3.4 * (F.shoulderW() * F.stature() / 2) * k / MannequinGeometry.WIDTH, top.w(), 1e-9);
        // ombro do manequim genérico feminino (0,32) e do avatar de referência batem em ±3 % — a projeção preserva a escala
        MannequinGeometry.Body generic = MannequinGeometry.body(MannequinSex.FEMININO, BodyBuild.MEDIUM);
        assertEquals(generic.shoulderW(), b.shoulderW(), 0.03);
        // ombro no mesmo lugar em y (0,205 genérico × derivado do corpo 3D)
        assertEquals(0.205, b.levels().get("shoulder"), 0.01);
    }

    @Test
    void linhaDeBase2dGenericoVersusAvatar() throws IOException {
        TryOnCompositor c = new TryOnCompositor(List.of(), List.of());
        BufferedImage shirt = syntheticShirt();
        File dir = new File("target/digital-double");
        dir.mkdirs();
        MannequinGeometry.Body generic = MannequinGeometry.body(MannequinSex.FEMININO, BodyBuild.MEDIUM);
        TryOnCompositor.Result rg = c.render(generic, MannequinGeometry.SKIN_TONES.get("media"), List.of(garment(shirt)), false);
        ImageIO.write(ImageOps.decode(rg.png()), "png", new File(dir, "2d-generico.png"));
        MannequinGeometry.Body avatar = MannequinGeometry.fromParams(MannequinSex.FEMININO, MEDIDO);
        TryOnCompositor.Result ra = c.render(avatar, "#B7825E", List.of(garment(shirt)), false);
        ImageIO.write(ImageOps.decode(ra.png()), "png", new File(dir, "2d-avatar.png"));
        ImageIO.write(c.drawMannequin(avatar, new Color(0xB7825E)), "png", new File(dir, "2d-avatar-corpo.png"));
        TryOnCompositor.Placement pg = rg.placements().get(0);
        TryOnCompositor.Placement pa = ra.placements().get(0);
        // a camisa fica dentro da caixa do TOP nos dois casos e escala com os ombros do corpo
        MannequinGeometry.Box box = avatar.anchors().get("TOP");
        assertTrue(pa.x() >= box.x() - 0.01 && pa.x() + pa.w() <= box.x() + box.w() + 0.01, "camisa dentro da caixa TOP");
        // a caixa do corpo maior é mais larga (geometria correta)...
        assertTrue(box.w() > generic.anchors().get("TOP").w() * 0.95, "caixa TOP acompanha os ombros");
        // ...mas o compositor encaixa a foto por "contain" na caixa: com a caixa mais baixa, a camisa pode sair MAIS
        // ESTREITA num corpo mais largo. É o defeito D2D-3 da linha de base (a foto não acompanha o corpo) — registrado,
        // não escondido: o teste só garante que ele é medido.
        System.out.println("D2D-3 camisa generico=" + pg.w() + " avatar=" + pa.w() + " caixaTOP generico=" + generic.anchors().get("TOP").w() + " avatar=" + box.w());
        System.out.println("BASELINE_2D " + Map.of("generic", Map.of("shoulderW", generic.shoulderW(), "waistW", generic.waistW(), "hipW", generic.hipW(), "levels", generic.levels(), "shirt", pg),
                "avatar", Map.of("shoulderW", avatar.shoulderW(), "waistW", avatar.waistW(), "hipW", avatar.hipW(), "levels", avatar.levels(), "shirt", pa)));
    }

    private static TryOnCompositor.Garment garment(BufferedImage shirt) {
        return new TryOnCompositor.Garment(UUID.randomUUID(), SchemeSlot.TOP, "t_shirt", shirt, ImageOps.png(shirt), true, "blue");
    }

    /** Camiseta sintética com listras (para ver estiramento e posição), fundo transparente. */
    static BufferedImage syntheticShirt() {
        int w = 600, h = 640;
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        ImageOps.quality(g);
        GeneralPath p = new GeneralPath();
        p.moveTo(220, 30);
        p.curveTo(260, 70, 340, 70, 380, 30);
        p.lineTo(560, 110);
        p.lineTo(520, 250);
        p.lineTo(450, 225);
        p.lineTo(455, 610);
        p.lineTo(145, 610);
        p.lineTo(150, 225);
        p.lineTo(80, 250);
        p.lineTo(40, 110);
        p.closePath();
        g.setColor(new Color(0x2B4C8C));
        g.fill(p);
        g.setClip(p);
        g.setColor(new Color(0xE8EEF7));
        g.setStroke(new BasicStroke(14));
        for (int y = 120; y < h; y += 60) {
            g.drawLine(0, y, w, y);
        }
        g.setClip(null);
        g.setColor(new Color(0x14264A));
        g.setStroke(new BasicStroke(6));
        g.draw(p);
        g.dispose();
        return img;
    }
}
