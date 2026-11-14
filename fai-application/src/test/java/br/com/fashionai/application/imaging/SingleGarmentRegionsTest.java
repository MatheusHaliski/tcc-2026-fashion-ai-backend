package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Regressão da reauditoria de 14/11/2026 ("Adicionar peça por foto" e FashionAI Lens, motor local): a foto de UMA peça
 * devolvia de 2 a 5 regiões (pernas, cós, barra) e o PNG de fundo transparente era lido sobre preto. Usa as artes reais
 * da raiz do repositório (fundo transparente), também achatadas sobre branco e sobre um fundo de estúdio, como um JPEG.
 */
class SingleGarmentRegionsTest {
    static final File ROOT = new File("..");

    @BeforeAll
    static void fotosDaRaiz() {
        assumeTrue(new File(ROOT, "01_jeans.png").isFile(), "artes de teste na raiz do repositório");
    }

    static BufferedImage art(String name) throws IOException {
        return ImageOps.toArgb(ImageIO.read(new File(ROOT, name)));
    }

    /** A arte sobre um fundo liso, opaca: o que chega quando a pessoa manda um JPEG. */
    static BufferedImage over(BufferedImage art, Color background) {
        BufferedImage out = new BufferedImage(art.getWidth(), art.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setColor(background);
        g.fillRect(0, 0, out.getWidth(), out.getHeight());
        g.drawImage(art, 0, 0, null);
        g.dispose();
        return out;
    }

    @ParameterizedTest
    @ValueSource(strings = {"01_jeans.png", "12_saia.png", "08_legging.png"})
    void umaPecaNaFotoDevolveUmaRegiaoSoEmQualquerFundo(String name) throws IOException {
        BufferedImage art = art(name);
        List<LocalPieceRegions.Region> transparent = LocalPieceRegions.detect(art);
        List<LocalPieceRegions.Region> white = LocalPieceRegions.detect(over(art, Color.WHITE));
        List<LocalPieceRegions.Region> studio = LocalPieceRegions.detect(over(art, new Color(236, 236, 232)));
        assertThat(transparent).as(name + " com fundo transparente").hasSize(1);
        assertThat(white).as(name + " sobre branco").hasSize(1);
        assertThat(studio).as(name + " sobre fundo de estúdio").hasSize(1);
        // a região é a peça inteira (cós, barra e etiqueta dentro), não um pedaço dela
        assertThat(white.get(0).height()).as("altura da peça em % da foto").isGreaterThan(60);
        assertThat(white.get(0).width()).as("largura da peça em % da foto").isGreaterThan(35);
    }

    @Test
    void fundoTransparenteELidoSobreBrancoNaoSobrePreto() throws IOException {
        BufferedImage art = art("01_jeans.png");
        assertThat(art.getRGB(0, 0) >>> 24).as("canto transparente da arte").isZero();
        BufferedImage flat = Transparency.onWhite(art);
        assertThat(flat.getRGB(0, 0)).isEqualTo(0xFFFFFFFF);
        assertThat(Transparency.hasTransparentPixel(flat)).isFalse();
        LocalPieceRegions.Region jeans = LocalPieceRegions.detect(art).get(0);
        int r = (jeans.rgb() >> 16) & 255, b = jeans.rgb() & 255;
        assertThat(b).as("o jeans é azul, não preto").isGreaterThan(r + 40).isGreaterThan(100);
        // foto sem transparência volta a mesma, sem cópia
        BufferedImage opaque = over(art, Color.WHITE);
        assertThat(Transparency.onWhite(opaque)).isSameAs(opaque);
    }

    @Test
    void duasPecasSeparadasPeloFundoContinuamDuas() throws IOException {
        BufferedImage jeans = art("01_jeans.png"), skirt = art("12_saia.png");
        BufferedImage photo = new BufferedImage(1600, 900, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = photo.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, 1600, 900);
        g.drawImage(jeans, 60, 60, 640, 700, null);
        g.drawImage(skirt, 860, 150, 680, 566, null);
        g.dispose();
        List<LocalPieceRegions.Region> regions = LocalPieceRegions.detect(photo);
        assertThat(regions).hasSize(2);
        assertThat(regions.get(0).x()).isLessThan(regions.get(1).x());
    }

    @Test
    void familiaDeCorJuntaSombraDoMesmoMatizESeparaCoresDiferentes() {
        assertThat(SingleGarmentRegions.sameFamily(0x2566AA, 0x0C3765)).as("jeans na luz e na sombra").isTrue();
        assertThat(SingleGarmentRegions.sameFamily(0x2566AA, 0xFA7A23)).as("azul e laranja").isFalse();
        assertThat(SingleGarmentRegions.sameFamily(0xF4F4F4, 0x1B2A4A)).as("branco e marinho").isFalse();
        assertThat(SingleGarmentRegions.sameFamily(0x141414, 0x1B2A4A)).as("preto e marinho").isFalse();
    }
}
