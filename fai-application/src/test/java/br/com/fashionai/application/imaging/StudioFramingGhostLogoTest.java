package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.Polygon;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** RF4 · Estúdio: enquadramento (preenche o quadro, sangra no corte), manequim invisível e foco no logo. */
class StudioFramingGhostLogoTest {

    /** Camiseta já recortada (fundo transparente), com decote aberto, estampa opcional e extras no topo. */
    static BufferedImage tee(boolean logo, String top) {
        BufferedImage img = new BufferedImage(700, 800, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        int[] xs = {280, 200, 115, 20, 105, 160, 165, 535, 540, 595, 680, 585, 500, 420, 405, 385, 350, 315, 295};
        int[] ys = {160, 183, 217, 385, 433, 335, 760, 760, 335, 433, 385, 217, 183, 160, 193, 215, 223, 215, 193};
        java.util.Random rnd = new java.util.Random(4);
        g.setColor(new Color(0xB9BCC2));
        g.fillPolygon(new Polygon(xs, ys, xs.length));
        for (int i = 0; i < 9000; i++) {                                        // trama do tecido
            int x = 170 + rnd.nextInt(360), y = 240 + rnd.nextInt(500);
            g.setColor(new Color(0xB9BCC2 + (rnd.nextBoolean() ? 0x060606 : -0x060606)));
            g.fillRect(x, y, 2, 2);
        }
        if (logo) {
            g.setColor(new Color(0x1C285C));
            g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 54));
            g.drawString("FAI", 390, 330);
        }
        if ("gancho".equals(top)) {
            g.setColor(new Color(0x2A2A2E));
            g.fillRect(346, 40, 7, 185);
        } else if ("manequim".equals(top)) {
            g.setColor(new Color(0x2C2C30));                                    // pescoço de manequim preto, liso
            g.fillRoundRect(305, 10, 90, 230, 60, 60);
        } else if ("gola-alta".equals(top)) {
            g.setColor(new Color(0xB9BCC2));                                    // gola alta da mesma malha
            g.fillRect(300, 60, 100, 170);
            for (int i = 0; i < 800; i++) {
                int x = 300 + rnd.nextInt(100), y = 60 + rnd.nextInt(170);
                g.setColor(new Color(0xB9BCC2 + (rnd.nextBoolean() ? 0x060606 : -0x060606)));
                g.fillRect(x, y, 2, 2);
            }
        }
        g.dispose();
        return img;
    }

    private static int alpha(BufferedImage img, int x, int y) {
        return img.getRGB(x, y) >>> 24;
    }

    private static double lum(int p) {
        return 0.299 * ((p >> 16) & 255) + 0.587 * ((p >> 8) & 255) + 0.114 * (p & 255);
    }

    @Test
    void theNeckOpeningIsFilledWithTheInsideOfTheGarment() {
        BufferedImage cut = tee(false, null);
        GhostMannequin.Result r = GhostMannequin.fill(cut, "TOP");
        assertThat(r.neck()).isTrue();
        // no meio do decote (antes vazio) agora há tecido, mais escuro que o corpo (interior das costas)
        int inside = r.image().getRGB(350, 195);
        assertThat(inside >>> 24).isEqualTo(255);
        assertThat(lum(inside)).isLessThan(lum(cut.getRGB(350, 500)));
        // o espaço entre manga e corpo continua vazio (fundo legítimo)
        assertThat(alpha(r.image(), 130, 440)).isZero();
        // bolsa e calçado nunca ganham "interior"
        assertThat(GhostMannequin.fill(cut, "ACCESSORY").changed()).isFalse();
    }

    @Test
    void hangerHookAndMannequinNeckGoAwayButAHighCollarStays() {
        GhostMannequin.Result hook = GhostMannequin.cleanup(tee(false, "gancho"), "TOP");
        assertThat(hook.hanger()).isTrue();
        assertThat(hook.image().getHeight()).isLessThan(800 - 100);            // o topo agora é a gola, não o gancho
        GhostMannequin.Result dummy = GhostMannequin.cleanup(tee(false, "manequim"), "TOP");
        assertThat(dummy.mannequin()).isTrue();
        GhostMannequin.Result collar = GhostMannequin.cleanup(tee(false, "gola-alta"), "TOP");
        assertThat(collar.mannequin()).isFalse();                               // mesma malha e trama: é roupa
        assertThat(collar.changed()).isFalse();
    }

    @Test
    void framingFillsTheFrameAndBleedsTheSideTheCameraCut() {
        // peça cortada pela foto na base: a base encosta (e passa) da borda do quadro, sem sombra no chão
        StudioFraming.Frame cutFrame = StudioFraming.frame(1000, 800, Set.of("bottom"), 1600, true);
        assertThat(cutFrame.oy() + 800 * cutFrame.scale()).isGreaterThan(cutFrame.height());
        assertThat(cutFrame.fill()).isGreaterThan(0.75);
        // barra reta que a foto NÃO cortou (só a forma sugere): rente à borda, sem perder nenhum pixel da peça
        StudioFraming.Frame flush = StudioFraming.frame(1000, 800, Set.of("bottom"), Set.of("bottom"), 1600, true);
        assertThat(flush.oy() + 800 * flush.scale()).isCloseTo(flush.height(), org.assertj.core.data.Offset.offset(1.0));
        // peça inteira e alta (vestido): quadro retrato, margens mínimas
        StudioFraming.Frame tall = StudioFraming.frame(500, 1100, Set.of(), 1600, true);
        assertThat(tall.aspect()).isIn("9:16", "2:3");
        assertThat(tall.oy()).isGreaterThan(0);
        assertThat(tall.fill()).isGreaterThan(0.6);
        // miniatura sempre quadrada
        assertThat(StudioFraming.frame(500, 1100, Set.of(), 640, false).aspect()).isEqualTo("1:1");
    }

    @Test
    void aTiltedStraightCutIsFoundAndReportsItsAngle() {
        BufferedImage img = new BufferedImage(600, 600, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(0xE8DFCF));
        java.awt.geom.Path2D body = new java.awt.geom.Path2D.Double();         // laterais curvas, base cortada reta
        body.moveTo(160, 40);
        body.lineTo(440, 40);
        body.quadTo(560, 300, 500, 550);
        body.lineTo(100, 550);
        body.quadTo(40, 300, 160, 40);
        g.fill(body);
        g.dispose();
        BufferedImage rotated = ImageOps.rotate(img, 3);
        BufferedImage piece = ImageOps.crop(rotated, ImageOps.alphaBounds(rotated));
        Map<String, Double> cuts = StudioFraming.cuts(piece);
        assertThat(cuts).containsKey("bottom");
        assertThat(Math.abs(cuts.get("bottom"))).isBetween(2.0, 4.0);
        assertThat(cuts).doesNotContainKeys("left", "right");                   // laterais do corpo não são corte de foto
    }

    @Test
    void aPrintedLogoIsFoundAndGetsADetailShot() throws Exception {
        LogoFinder.Logo logo = LogoFinder.detect(tee(true, null));
        assertThat(logo).isNotNull();
        double cx = (logo.box()[0] + logo.box()[2]) / 2 * 660 + 20, cy = (logo.box()[1] + logo.box()[3]) / 2 * 600 + 160;
        assertThat(cx).isBetween(390.0, 500.0);                                 // no "FAI" do peito
        assertThat(cy).isBetween(270.0, 340.0);
        assertThat(LogoFinder.detect(tee(false, null))).isNull();               // camiseta lisa: nada de logo inventado
        StudioPipeline.Result r = new StudioPipeline(java.util.List.of(), java.util.List.of())
                .run(tee(true, null), "auto", false, new StudioPipeline.Hints("TOP", Set.of(), null, null));
        assertThat(r.detailJpeg()).isNotNull();
        BufferedImage detail = ImageIO.read(new ByteArrayInputStream(r.detailJpeg()));
        assertThat(detail.getWidth()).isEqualTo(1200);
        assertThat(detail.getHeight()).isEqualTo(1500);
        assertThat(r.logo()).containsEntry("source", "local");
        assertThat(r.ghost()).anyMatch(n -> n.contains("decote"));
    }
}
