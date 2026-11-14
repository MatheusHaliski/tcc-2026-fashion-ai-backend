package br.com.fashionai.application.lens;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Reauditoria de 14/11/2026 (FashionAI Lens): um PNG de fundo transparente era lido sobre preto — a peça saía "Preto".
 * A leitura do recorte achata a transparência sobre branco antes de medir a cor.
 */
class LensTransparentPhotoTest {
    @Test
    void recorteComFundoTransparenteNaoELidoComoPreto() {
        BufferedImage photo = new BufferedImage(400, 400, BufferedImage.TYPE_INT_ARGB);   // tudo transparente (RGB 0,0,0)
        Graphics2D g = photo.createGraphics();
        g.setColor(new Color(0x2A5FA8));
        g.fillRect(170, 60, 60, 280);                                                     // peça estreita: sobra muito fundo
        g.dispose();
        LensImageAnalysis.Reading read = LensImageAnalysis.read(photo, new LensViews.Box(0, 0, 100, 100), null);
        assertThat(read.colors()).isNotEmpty();
        assertThat(read.colors()).extracting(LensViews.ColorShare::name).doesNotContain("black");
        assertThat(read.colors()).extracting(LensViews.ColorShare::name).contains("blue");
    }
}
