package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;

import static org.assertj.core.api.Assertions.assertThat;

/** RF4 · selo "gerada por IA": vai no canto inferior direito, não mexe no resto da foto e preserva a transparência. */
class AiSealTest {
    @Test
    void seloNoCantoInferiorDireitoSemTocarNoResto() {
        BufferedImage src = new BufferedImage(400, 300, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < 300; y++) {
            for (int x = 0; x < 400; x++) {
                src.setRGB(x, y, 0xFFFFFF);
            }
        }
        BufferedImage out = AiSeal.stamp(src, "IA · imagem gerada por IA");
        assertThat(out.getWidth()).isEqualTo(400);
        assertThat(out.getHeight()).isEqualTo(300);
        // canto superior esquerdo intacto; perto do canto inferior direito, o fundo escuro do selo
        assertThat(out.getRGB(5, 5) & 0xFFFFFF).isEqualTo(0xFFFFFF);
        int badge = out.getRGB(400 - 14, 300 - 14) & 0xFFFFFF;
        assertThat(badge).isNotEqualTo(0xFFFFFF);
        // a original não é alterada
        assertThat(src.getRGB(400 - 14, 300 - 14) & 0xFFFFFF).isEqualTo(0xFFFFFF);
    }

    @Test
    void preservaTransparenciaDoRecorte() {
        BufferedImage src = new BufferedImage(200, 200, BufferedImage.TYPE_INT_ARGB);
        BufferedImage out = AiSeal.stamp(src, "IA");
        assertThat(out.getColorModel().hasAlpha()).isTrue();
        assertThat(out.getRGB(3, 3) >>> 24).isZero();
    }

    @Test
    void cabeEmMiniaturaPequena() {
        BufferedImage out = AiSeal.stamp(new BufferedImage(64, 64, BufferedImage.TYPE_INT_RGB), "IA · imagem gerada por IA");
        assertThat(out.getWidth()).isEqualTo(64);
    }
}
