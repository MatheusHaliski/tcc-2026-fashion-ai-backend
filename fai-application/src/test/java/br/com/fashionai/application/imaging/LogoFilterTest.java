package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.awt.image.ConvolveOp;
import java.awt.image.Kernel;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

/** RF4 · buscador de marcas — filtro de logo: fundo branco, letras pretas nítidas; borrado/baixa resolução é recusado. */
class LogoFilterTest {

    /** Logo vetorial da Adidas como publicado no catálogo aberto Simple Icons (CC0). */
    static final String ADIDAS = "<svg role=\"img\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><title>Adidas</title>"
            + "<path d=\"m24 19.535-8.697-15.07-4.659 2.687 7.145 12.383Zm-8.287 0L9.969 9.59 5.31 12.277l4.192 7.258ZM4.658 14.723l2.776 4.812H1.223L0 17.41Z\"/></svg>";
    /** Arcos com flags colados ("a1 1 0 01"), comuns em SVG minificado. */
    static final String RING = "<svg viewBox=\"0 0 24 24\"><path d=\"M12 2a10 10 0 110 20 10 10 0 010-20zm0 3a7 7 0 100 14 7 7 0 000-14z\"/></svg>";

    @Test
    void vetorSaiPretoNoBrancoENitido() {
        LogoFilter.Result r = LogoFilter.fromVector(SvgPathRenderer.parse(ADIDAS));
        assertThat(r.accepted()).as(String.valueOf(r.metrics())).isTrue();
        assertThat(r.square().getWidth()).isEqualTo(LogoFilter.SQUARE);
        assertThat(r.wide().getHeight()).isEqualTo(LogoFilter.WIDE_H);
        assertThat(gray(r.square(), 0, 0)).isEqualTo(255);                 // fundo branco puro
        assertThat(darkest(r.square())).isLessThan(10);                     // desenho preto
        assertThat((double) r.metrics().get("larguraDaBordaFinalPx")).isLessThan(1.6);
        assertThat(r.steps().get(0)).contains("SVG vetorial");
    }

    @Test
    void arcoComFlagsColadosViraAnel() {
        SvgPathRenderer.Vector v = SvgPathRenderer.parse(RING);
        assertThat(v.shape().getBounds2D().getWidth()).isBetween(19.5, 20.5);
        BufferedImage img = SvgPathRenderer.render(v, 200, 0.0);
        assertThat(gray(img, 100, 100)).isEqualTo(255);                     // miolo vazado (regra nonzero com sentido inverso)
        assertThat(gray(img, 100, 8)).isLessThan(40);                       // anel preto
    }

    @Test
    void logoRasterNitidoEmFundoEscuroEhInvertido() {
        BufferedImage img = wordmark(640, 220, new Color(0x14, 0x21, 0x4D), Color.WHITE);
        LogoFilter.Result r = LogoFilter.fromRaster(img);
        assertThat(r.accepted()).as(String.valueOf(r.metrics())).isTrue();
        assertThat(r.metrics().get("invertido")).isEqualTo(true);
        assertThat(gray(r.wide(), 1, 1)).isEqualTo(255);
        assertThat(darkest(r.wide())).isLessThan(10);
    }

    @Test
    void logoColoridoEmFundoBrancoViraPreto() {
        LogoFilter.Result r = LogoFilter.fromRaster(wordmark(600, 200, Color.WHITE, new Color(0xE5, 0x00, 0x10)));
        assertThat(r.accepted()).as(String.valueOf(r.metrics())).isTrue();
        assertThat(r.metrics().get("invertido")).isEqualTo(false);
        assertThat(darkest(r.square())).isLessThan(10);
    }

    @Test
    void logoBorradoEhRecusado() {
        BufferedImage sharp = wordmark(600, 200, Color.WHITE, Color.BLACK);
        BufferedImage blurred = blur(blur(blur(sharp, 9), 9), 9);
        LogoFilter.Result r = LogoFilter.fromRaster(blurred);
        assertThat(r.accepted()).as(String.valueOf(r.metrics())).isFalse();
        assertThat(r.reason()).isEqualTo("SEM_NITIDEZ");
    }

    @Test
    void logoMinusculoEhRecusadoPorResolucao() {
        LogoFilter.Result r = LogoFilter.fromRaster(wordmark(64, 32, Color.WHITE, Color.BLACK));
        assertThat(r.accepted()).isFalse();
        assertThat(r.reason()).isEqualTo("RESOLUCAO_BAIXA");
    }

    @Test
    void fotoComFundoVariadoEhRecusada() {
        BufferedImage photo = new BufferedImage(400, 300, BufferedImage.TYPE_INT_RGB);
        Random rnd = new Random(7);
        for (int y = 0; y < 300; y++) {
            for (int x = 0; x < 400; x++) {
                int v = Math.min(255, Math.max(0, (int) (x * 0.5 + rnd.nextGaussian() * 60)));
                photo.setRGB(x, y, new Color(v, (v + 40) % 256, 255 - v).getRGB());
            }
        }
        LogoFilter.Result r = LogoFilter.fromRaster(photo);
        assertThat(r.accepted()).isFalse();
        assertThat(r.reason()).isIn("FUNDO_NAO_UNIFORME", "SEM_NITIDEZ", "CONTRASTE_BAIXO");
    }

    // ------------------------------------------------------------------ apoio

    static BufferedImage wordmark(int w, int h, Color bg, Color fg) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(bg);
        g.fillRect(0, 0, w, h);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setColor(fg);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, (int) (h * 0.55)));
        g.drawString("MODA", w * 0.08f, h * 0.72f);
        g.dispose();
        return img;
    }

    static BufferedImage blur(BufferedImage src, int k) {
        float[] data = new float[k * k];
        java.util.Arrays.fill(data, 1f / (k * k));
        BufferedImage padded = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        new ConvolveOp(new Kernel(k, k, data), ConvolveOp.EDGE_NO_OP, null).filter(src, padded);
        return padded;
    }

    static int gray(BufferedImage img, int x, int y) {
        return img.getRGB(x, y) & 0xFF;
    }

    static int darkest(BufferedImage img) {
        int min = 255;
        for (int y = 0; y < img.getHeight(); y++) {
            for (int x = 0; x < img.getWidth(); x++) {
                min = Math.min(min, img.getRGB(x, y) & 0xFF);
            }
        }
        return min;
    }
}
