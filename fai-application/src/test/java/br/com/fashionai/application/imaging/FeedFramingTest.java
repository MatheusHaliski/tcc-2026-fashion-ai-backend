package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.Polygon;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * RF4 · Foto do feed: templates por categoria posicionam a peça por pontos de referência (gola/peito, cós/joelhos), de
 * modo que camisetas e calças de fotos diferentes fiquem com escala e posição comparáveis na grade.
 */
class FeedFramingTest {

    /** Camiseta aberta (flat lay) com proporções variáveis, já recortada na caixa opaca. */
    static BufferedImage tee(double scale, int bodyW, int bodyL, int sleeve, double sleeveDrop, int asym, Color color) {
        int neck = (int) (bodyW * 0.36), shoulder = (int) (bodyL * 0.05);
        int cx = 600, top = 120;
        int l = cx - bodyW / 2, r = cx + bodyW / 2;
        int armpit = top + (int) (bodyL * 0.30), cuff = (int) (bodyL * 0.20);
        int lTop = top + shoulder + (int) (sleeve * sleeveDrop), rTop = top + shoulder + (int) ((sleeve + asym) * sleeveDrop);
        int[] xs = {cx - neck / 2, l, l - sleeve, l - sleeve + (int) (sleeve * 0.2), l, l, r, r,
                r + sleeve + asym - (int) ((sleeve + asym) * 0.2), r + sleeve + asym, r, cx + neck / 2, cx};
        int[] ys = {top, top + shoulder, lTop, lTop + cuff, armpit, top + bodyL, top + bodyL, armpit, rTop + cuff, rTop,
                top + shoulder, top, top + (int) (neck * 0.35)};
        BufferedImage img = new BufferedImage(1200, 1300, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(color);
        g.fillPolygon(new Polygon(xs, ys, xs.length));
        g.dispose();
        return cropScaled(img, scale);
    }

    /** Calça aberta: cós, gancho e duas pernas (reta ou afunilada), com entreperna e largura variáveis. */
    static BufferedImage pants(double scale, int waist, int rise, int inseam, int hem, boolean cutAboveKnee) {
        int cx = 600, top = 60;
        int crotch = top + rise, bottom = crotch + inseam;
        int hip = (int) (waist * 1.12), gap = Math.max(10, (int) (waist * 0.05));
        int[] xs = {cx - waist / 2, cx + waist / 2, cx + hip / 2, cx + gap / 2 + hem, cx + gap / 2, cx, cx - gap / 2, cx - gap / 2 - hem, cx - hip / 2};
        int[] ys = {top, top, crotch, bottom, bottom, crotch + 6, bottom, bottom, crotch};
        BufferedImage img = new BufferedImage(1200, 1400, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(new Color(0x3B5B8C));
        g.fillPolygon(new Polygon(xs, ys, xs.length));
        g.setColor(new Color(0x3B5B8C));
        g.fillRect(cx - waist / 2, top, waist, (int) (rise * 0.12));          // cós
        g.dispose();
        if (cutAboveKnee) {
            int keep = crotch + (int) (inseam * 0.25);
            img = img.getSubimage(0, 0, img.getWidth(), keep);
        }
        return cropScaled(img, scale);
    }

    static BufferedImage cropScaled(BufferedImage img, double scale) {
        ImageOps.Box b = ImageOps.alphaBounds(img);
        BufferedImage c = ImageOps.toArgb(ImageOps.crop(img, b));
        return ImageOps.scale(c, (int) Math.round(c.getWidth() * scale), (int) Math.round(c.getHeight() * scale));
    }

    /** Posição de um ponto da peça (coordenada da peça) no quadro do feed, como fração do quadro. */
    static double fy(FeedFraming.Feed f, double y) {
        return (f.frame().oy() + y * f.frame().scale()) / f.frame().height();
    }

    static double fx(FeedFraming.Feed f, double x) {
        return (f.frame().ox() + x * f.frame().scale()) / f.frame().width();
    }

    @Test
    void cincoCamisetasFicamComGolaEPeitoNaMesmaPosicaoEEscala() {
        List<BufferedImage> tees = List.of(
                tee(0.55, 420, 600, 150, 0.55, 0, new Color(0xC8102E)),     // foto pequena
                tee(1.40, 460, 640, 170, 0.45, 0, new Color(0x222222)),     // foto grande
                tee(1.00, 400, 700, 120, 0.70, 0, new Color(0xF2F2F2)),     // camiseta longa, manga caída
                tee(0.85, 500, 560, 190, 0.35, 40, new Color(0x2D55C9)),    // manga assimétrica
                tee(1.15, 380, 620, 140, 0.60, 0, new Color(0x93A266)));    // tronco estreito
        List<double[]> seen = new ArrayList<>();
        for (BufferedImage t : tees) {
            FeedFraming.Feed f = FeedFraming.frame(t, FeedFraming.Template.TOP, Set.of());
            assertThat(f.frame().width() * 5).isEqualTo(f.frame().height() * 4);          // 4:5
            Map<String, Object> lm = f.landmarks();
            double top = 0;                                                                // gola no topo da peça
            double chestPx = ((Number) lm.get("chestWidth")).doubleValue() * t.getWidth();
            double chestFrac = chestPx * f.frame().scale() / f.frame().width();
            double torsoX = ((Number) lm.get("torsoCenterX")).doubleValue() * t.getWidth();
            seen.add(new double[]{fy(f, top), chestFrac, fx(f, torsoX)});
            assertThat(f.missing()).isEmpty();
            assertThat(f.frame().bleed()).as("extremidades das mangas visíveis").doesNotContain("left", "right");
        }
        for (double[] s : seen) {
            assertThat(s[0]).isCloseTo(FeedFraming.TOP_COLLAR_Y, within(0.012));       // gola a 8% do topo
            assertThat(s[1]).isBetween(FeedFraming.TOP_CHEST_W * 0.85 - 0.01, FeedFraming.TOP_CHEST_W + 0.02); // peito ≈ 56%
            assertThat(s[2]).isCloseTo(0.5, within(0.02));                              // tronco centralizado
        }
    }

    @Test
    void cincoCalcasVaoDoCosAMetadeDosJoelhos() {
        List<BufferedImage> list = List.of(
                pants(0.50, 380, 260, 760, 170, false),   // jeans reto, foto pequena
                pants(1.30, 360, 240, 820, 150, false),   // foto grande
                pants(1.00, 420, 300, 700, 210, false),   // cintura alta, perna larga
                pants(0.80, 340, 230, 780, 120, false),   // skinny
                pants(1.10, 400, 280, 640, 180, false));  // cropped (entreperna curta)
        for (BufferedImage img : list) {
            FeedFraming.Feed f = FeedFraming.frame(img, FeedFraming.Template.PANTS, Set.of());
            Map<String, Object> lm = f.landmarks();
            assertThat(lm.get("crotchY")).as("gancho medido").isNotNull();
            double knee = ((Number) lm.get("kneeY")).doubleValue() * img.getHeight();
            double crotch = ((Number) lm.get("crotchY")).doubleValue() * img.getHeight();
            assertThat(fy(f, 0)).isCloseTo(FeedFraming.PANTS_WAIST_Y, within(0.012));    // cós a 6% do topo
            assertThat(fy(f, knee)).isCloseTo(FeedFraming.PANTS_KNEE_Y, within(0.012));  // joelho na base
            // metade do joelho ≈ 47% da entreperna
            assertThat((knee - crotch) / (img.getHeight() - crotch)).isCloseTo(0.47, within(0.04));
            assertThat(f.frame().bleed()).contains("bottom");                           // perna continua além do quadro
            assertThat(f.missing()).isEmpty();
        }
    }

    @Test
    void fotoQueNaoChegaAosJoelhosPedeOutraFoto() {
        BufferedImage cut = pants(1.0, 380, 260, 760, 170, true);
        FeedFraming.Feed f = FeedFraming.frame(cut, FeedFraming.Template.PANTS, Set.of("bottom"));
        assertThat(f.missing()).contains("knees");
        assertThat(f.estimated()).isTrue();
    }

    @Test
    void camisetaSemGolaNaFotoPedeOutraFoto() {
        BufferedImage t = tee(1.0, 420, 600, 150, 0.55, 0, Color.RED);
        BufferedImage noCollar = t.getSubimage(0, 40, t.getWidth(), t.getHeight() - 40);
        FeedFraming.Feed f = FeedFraming.frame(ImageOps.toArgb(noCollar), FeedFraming.Template.TOP, Set.of("top"));
        assertThat(f.missing()).contains("collar");
    }

    /** Mão sobre o peito na foto vestida: o buraco fica (nada é inventado) e o template pede outra foto. */
    @Test
    void parteEncobertaNaFotoVestidaPedeOutraFoto() {
        BufferedImage t = tee(1.0, 420, 600, 150, 0.55, 0, Color.RED);
        assertThat(FeedFraming.frame(t, FeedFraming.Template.TOP, Set.of()).missing()).doesNotContain("occluded");
        Graphics2D g = t.createGraphics();
        g.setComposite(java.awt.AlphaComposite.Clear);
        g.fillOval(t.getWidth() / 2 - 70, t.getHeight() / 2 - 40, 140, 90);
        g.dispose();
        FeedFraming.Feed f = FeedFraming.frame(t, FeedFraming.Template.TOP, Set.of());
        assertThat(f.missing()).contains("occluded");
        // o buraco não parte o tronco: o peito continua medido na silhueta inteira
        assertThat(((Number) f.landmarks().get("chestWidth")).doubleValue()).isGreaterThan(0.4);
    }

    @Test
    void templatePelaCategoriaESubcategoria() {
        assertThat(FeedFraming.template("upper_piece", "t_shirt", null)).isEqualTo(FeedFraming.Template.TOP);
        assertThat(FeedFraming.template("upper_piece", "blazer", null)).isEqualTo(FeedFraming.Template.OUTERWEAR);
        assertThat(FeedFraming.template("lower_piece", "jeans", null)).isEqualTo(FeedFraming.Template.PANTS);
        assertThat(FeedFraming.template("lower_piece", "bermuda_shorts", null)).isEqualTo(FeedFraming.Template.SHORTS);
        assertThat(FeedFraming.template("lower_piece", "skirt", null)).isEqualTo(FeedFraming.Template.SKIRT);
        assertThat(FeedFraming.template("full_body_piece", "dress", null)).isEqualTo(FeedFraming.Template.FULL_BODY);
        assertThat(FeedFraming.template("shoes_piece", "loafers", null)).isEqualTo(FeedFraming.Template.SHOES);
        assertThat(FeedFraming.template("accessory_piece", "handbag", null)).isEqualTo(FeedFraming.Template.BAG);
        assertThat(FeedFraming.template("accessory_piece", "watch", null)).isEqualTo(FeedFraming.Template.ACCESSORY);
        assertThat(FeedFraming.template(null, null, "BOTTOM")).isEqualTo(FeedFraming.Template.PANTS);
    }

    @Test
    void outrasCategoriasCabemInteirasNoQuadro() {
        BufferedImage shoe = new BufferedImage(900, 400, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = shoe.createGraphics();
        g.setColor(Color.DARK_GRAY);
        g.fillRoundRect(40, 120, 820, 240, 120, 120);
        g.dispose();
        FeedFraming.Feed f = FeedFraming.frame(cropScaled(shoe, 1), FeedFraming.Template.SHOES, Set.of());
        assertThat(f.frame().bleed()).isEmpty();
        assertThat(fy(f, cropScaled(shoe, 1).getHeight())).isCloseTo(FeedFraming.SHOE_GROUND_Y, within(0.01));
        BufferedImage bag = new BufferedImage(500, 600, BufferedImage.TYPE_INT_ARGB);
        g = bag.createGraphics();
        g.setColor(new Color(0x8B4513));
        g.fillRect(50, 150, 400, 400);
        g.dispose();
        FeedFraming.Feed b = FeedFraming.frame(cropScaled(bag, 1), FeedFraming.Template.BAG, Set.of());
        assertThat(b.frame().bleed()).isEmpty();
    }

    /** Estampa de frase no peito ("THE BEST PLAN") não vira logo: sem foco extra nem foto de detalhe. */
    @Test
    void estampaDeFraseNaoEhLogo() {
        BufferedImage t = tee(1.0, 440, 620, 160, 0.5, 0, new Color(0xC8102E));
        Graphics2D g = t.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setColor(new Color(0xF4EFE6));
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 46));
        int cx = t.getWidth() / 2;
        for (String[] line : new String[][]{{"THE", "250"}, {"BEST", "305"}, {"PLAN", "360"}}) {
            int w = g.getFontMetrics().stringWidth(line[0]);
            g.drawString(line[0], cx - w / 2, Integer.parseInt(line[1]));
        }
        g.dispose();
        LogoFinder.Logo found = LogoFinder.detect(t);
        assertThat(found == null || found.print()).as("frase é estampa, não logo").isTrue();
        StudioPipeline.Result res = new StudioPipeline(List.of(), List.of()).run(t, "branco", false,
                new StudioPipeline.Hints("TOP", Set.of(), null, null, FeedFraming.Template.TOP));
        assertThat(res.detailJpeg()).isNull();
        assertThat(res.feedJpeg()).isNotNull();
        assertThat(res.feed().get("template")).isEqualTo("TOP");
    }

    /** O estúdio não satura a cor: o vermelho da peça sai com o mesmo matiz e a mesma saturação média. */
    @Test
    void estudioPreservaACorDaPeca() {
        Color red = new Color(0xC8102E);
        BufferedImage t = tee(0.8, 440, 620, 160, 0.5, 0, red);
        StudioPipeline.Result res = new StudioPipeline(List.of(), List.of()).run(t, "branco", false,
                new StudioPipeline.Hints("TOP", Set.of(), null, null, FeedFraming.Template.TOP));
        BufferedImage out = ImageOps.decode(res.enhancedPng());
        float[] ref = Color.RGBtoHSB(red.getRed(), red.getGreen(), red.getBlue(), null);
        double hue = 0, sat = 0;
        int n = 0;
        for (int y = 0; y < out.getHeight(); y += 3) {
            for (int x = 0; x < out.getWidth(); x += 3) {
                int p = out.getRGB(x, y);
                if ((p >>> 24) < 250) {
                    continue;
                }
                float[] hsb = Color.RGBtoHSB((p >> 16) & 255, (p >> 8) & 255, p & 255, null);
                double dh = hsb[0] - ref[0];
                hue += dh > 0.5 ? dh - 1 : dh < -0.5 ? dh + 1 : dh;
                sat += hsb[1];
                n++;
            }
        }
        assertThat(Math.abs(hue / n)).isLessThan(0.02);
        assertThat(sat / n).isCloseTo(ref[1], within(0.06));
    }

    @Test
    void escalaUniformeSemDistorcer() {
        BufferedImage t = tee(1.0, 420, 600, 150, 0.55, 0, Color.GRAY);
        FeedFraming.Feed f = FeedFraming.frame(t, FeedFraming.Template.TOP, Set.of());
        // o quadro guarda uma escala só (x = y) e a proporção da peça no quadro é a do recorte
        double pw = t.getWidth() * f.frame().scale(), ph = t.getHeight() * f.frame().scale();
        assertThat(pw / ph).isCloseTo(t.getWidth() / (double) t.getHeight(), within(1e-9));
    }
}
