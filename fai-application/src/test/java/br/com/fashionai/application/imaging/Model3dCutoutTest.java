package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * RF16 — a entrada do 3D é o recorte da peça, não a foto com fundo: sem isso o relevo local fazia da foto inteira a
 * silhueta e o modelo saía um bloco retangular com a foto na frente e no verso (Atelier e Acervo).
 */
class Model3dCutoutTest {

    /** Jaqueta clara sobre fundo liso, foto opaca (JPEG sem canal alfa), como quando o recorte do envio falhou. */
    private static byte[] jacketOnWall(int wall) {
        BufferedImage img = new BufferedImage(240, 300, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(wall));
        g.fillRect(0, 0, 240, 300);
        g.setColor(new Color(0x2F4A78));
        g.fillRoundRect(60, 30, 120, 240, 30, 30);               // tronco
        g.fillRect(20, 40, 40, 150);                               // mangas
        g.fillRect(180, 40, 40, 150);
        g.dispose();
        return ImageOps.jpeg(img, 0.92f);
    }

    @Test
    void fotoComFundoViraRecorteEORelevoTemAFormaDaPecaNaoORetangulo() {
        Model3dCutout.Prepared cut = Model3dCutout.prepare(jacketOnWall(0xF2F0EB));
        assertThat(cut.removedHere()).isTrue();
        assertThat(Model3dCutout.transparentShare(cut.cutout())).isGreaterThan(0.2);   // o fundo saiu
        ImageOps.Box box = ImageOps.alphaBounds(cut.cutout());
        assertThat(box.empty()).isFalse();
        // o relevo sai: a máscara já não é o retângulo da foto
        ReliefModelGenerator.Model m = ReliefModelGenerator.generate(cut.cutout(), 0.7);
        assertThat(m.triangles()).isPositive();
    }

    @Test
    void recorteQueJaTemTransparenciaPassaComoEsta() {
        BufferedImage img = new BufferedImage(100, 120, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(0xE8DFCF));
        g.fillRoundRect(20, 10, 60, 100, 20, 20);
        g.dispose();
        byte[] png = ImageOps.png(img);
        Model3dCutout.Prepared cut = Model3dCutout.prepare(png);
        assertThat(cut.removedHere()).isFalse();
        assertThat(cut.png()).isSameAs(png);
    }

    @Test
    void fotoSemFundoSeparavelParaComMotivoEmVezDeVirarBloco() {
        BufferedImage noise = new BufferedImage(200, 200, BufferedImage.TYPE_INT_RGB);
        Random r = new Random(7);
        for (int y = 0; y < 200; y++) {
            for (int x = 0; x < 200; x++) {
                noise.setRGB(x, y, r.nextInt(0xFFFFFF));             // estampa até a borda: não há fundo para tirar
            }
        }
        assertThatThrownBy(() -> Model3dCutout.prepare(ImageOps.jpeg(noise, 0.9f)))
                .isInstanceOf(Model3dCutout.NoCutoutException.class);
    }

    @Test
    void relevoRecusaSilhuetaQueOcupaOFotoInteira() {
        BufferedImage opaque = new BufferedImage(120, 160, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = opaque.createGraphics();
        g.setColor(new Color(0x7F9BB8));
        g.fillRect(0, 0, 120, 160);
        g.dispose();
        assertThatThrownBy(() -> ReliefModelGenerator.generate(opaque, 0.7))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("retangular");
    }
}
