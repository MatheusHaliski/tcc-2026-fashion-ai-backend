package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A miniatura (a imagem do card fechado) acompanha a imagem que o cadastro guarda: com o recorte reprovado, o cadastro
 * usa a foto original — e a miniatura também. Antes ela saía do recorte que falhou e o card ficava quase todo branco.
 */
class FlatLayThumbnailTest {
    private final FlatLayPipeline flat = new FlatLayPipeline(List.of(), List.of());

    /** Parte da miniatura que não é fundo branco (0–1). */
    static double content(byte[] png) throws Exception {
        BufferedImage img = ImageIO.read(new ByteArrayInputStream(png));
        int hit = 0;
        for (int y = 0; y < img.getHeight(); y++) {
            for (int x = 0; x < img.getWidth(); x++) {
                int p = img.getRGB(x, y);
                int r = (p >> 16) & 0xFF, g = (p >> 8) & 0xFF, b = p & 0xFF;
                if (r < 235 || g < 235 || b < 235) {
                    hit++;
                }
            }
        }
        return hit / (double) (img.getWidth() * img.getHeight());
    }

    @Test
    void recorteReprovadoUsaAFotoOriginalNaMiniatura() throws Exception {
        // peça da mesma cor do fundo (a calça bege no lençol bege): o recorte local não separa nada
        BufferedImage photo = new BufferedImage(600, 800, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = photo.createGraphics();
        g.setColor(new Color(196, 170, 130));
        g.fillRect(0, 0, 600, 800);
        g.dispose();
        FlatLayPipeline.Result r = flat.run(ImageOps.jpeg(photo, 0.95f), false);

        assertThat(r.backgroundRemoved()).isFalse();
        assertThat(content(r.thumbnailPng())).isGreaterThan(0.5);
    }

    @Test
    void recorteBomContinuaNaMiniatura() throws Exception {
        // peça escura bem destacada no fundo claro: o recorte vale e a miniatura sai dele
        BufferedImage photo = new BufferedImage(600, 800, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = photo.createGraphics();
        g.setColor(new Color(245, 245, 245));
        g.fillRect(0, 0, 600, 800);
        g.setColor(new Color(30, 40, 90));
        g.fillRoundRect(150, 150, 300, 500, 60, 60);
        g.dispose();
        FlatLayPipeline.Result r = flat.run(ImageOps.jpeg(photo, 0.95f), false);

        assertThat(r.backgroundRemoved()).isTrue();
        assertThat(content(r.thumbnailPng())).isGreaterThan(0.2);
    }
}
