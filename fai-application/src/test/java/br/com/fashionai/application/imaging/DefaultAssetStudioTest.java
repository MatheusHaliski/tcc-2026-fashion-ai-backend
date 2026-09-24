package br.com.fashionai.application.imaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * RF4 · Estúdio da imagem padrão: as artes de /public/assets_pecas (com o logo FAI) saem de estúdio como as fotos
 * enviadas — peça ocupando o quadro e foco no logo — nos quatro tipos de peça (superior, inferior, calçado, acessório)
 * e no corpo inteiro. A caixa do selo FAI vem do catálogo conferido ({@code catalog/default-piece-logos.json}).
 */
class DefaultAssetStudioTest {
    static final String[][] ASSETS = {
            {"01_Parte_superior/01_camiseta_referencia.png", "TOP"},
            {"02_Parte_inferior/01_jeans.png", "BOTTOM"},
            {"03_Calcados/01_tenis_casual.png", "SHOES"},
            {"04_Acessorios/02_bolsa_mao.png", "ACCESSORY"},
            {"05_Corpo_inteiro/01_vestido.png", "FULL_BODY"},
            {"01_Parte_superior/14_jacket_jaqueta.png", "OUTERWEAR"},
    };

    @Test
    @SuppressWarnings("unchecked")
    void defaultArtFillsTheFrameAndFocusesTheFaiLogo() throws Exception {
        File dir = new File("../public/assets_pecas");
        assumeTrue(dir.isDirectory() && DefaultPieceLogoCatalogTest.CATALOG.isFile(), "assets de peças fora do checkout");
        Map<String, Object> catalog = new ObjectMapper().readValue(DefaultPieceLogoCatalogTest.CATALOG, Map.class);
        StudioPipeline studio = new StudioPipeline(List.of(), List.of());
        boolean dump = System.getProperty("studio.dump") != null;
        for (String[] a : ASSETS) {
            BufferedImage art = ImageOps.toArgb(ImageIO.read(new File(dir, a[0])));
            List<Number> box = (List<Number>) ((Map<String, Object>) catalog.get("/assets_pecas/" + a[0])).get("box");
            double[] logo = box.stream().mapToDouble(Number::doubleValue).toArray();
            StudioPipeline.Result r = studio.run(art, "auto", false, new StudioPipeline.Hints(a[1], null, logo, "catalogo"));
            double fill = ((Number) r.framing().get("fill")).doubleValue();
            assertThat(fill).as("preenchimento do quadro em %s", a[0]).isGreaterThanOrEqualTo(0.55);
            assertThat(r.logo()).as("logo FAI em %s", a[0]).isNotNull().containsEntry("source", "catalogo");
            assertThat(r.detailJpeg()).as("foto de detalhe do logo em %s", a[0]).isNotNull();
            if (dump) {
                String base = "target/default-" + new File(a[0]).getName().replace(".png", "");
                Files.write(new File(base + "-studio.jpg").toPath(), r.studioJpeg());
                Files.write(new File(base + "-detail.jpg").toPath(), r.detailJpeg());
                System.out.printf("%s: %s · logo %s%n", a[0], r.framing(), r.logo());
            }
        }
    }
}
