package br.com.fashionai.application.imaging;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * RF4 · Estúdio da imagem padrão: as artes de /public/assets_pecas (com o logo FAI) saem de estúdio como as fotos
 * enviadas — quadro quadrado, peça ocupando o quadro pelo lado maior e foco no logo — nos quatro tipos de peça (superior, inferior, calçado, acessório)
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
            {"01_Parte_superior/02_shirt_camisa.png", "TOP"},
            {"01_Parte_superior/13_blazer.png", "OUTERWEAR"},
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
            StudioPipeline.Result r = studio.run(art, "auto", false, new StudioPipeline.Hints(a[1], Set.of(), logo, "catalogo"));
            double fill = ((Number) r.framing().get("fill")).doubleValue();
            // padrão quadrado (o do card): a peça ocupa o quadro pelo lado maior — calça alta ocupa menos ÁREA que a
            // camiseta, mas encosta nas margens de cima e de baixo. fill = (lado maior)² × (lado menor ÷ lado maior)
            ImageOps.Box b = ImageOps.alphaBounds(art);
            double shape = Math.min(b.w(), b.h()) / (double) Math.max(b.w(), b.h());
            assertThat(r.framing().get("aspect")).as("quadro de %s", a[0]).isEqualTo("1:1");
            assertThat(Math.sqrt(fill / shape)).as("lado maior da peça no quadro em %s", a[0]).isGreaterThanOrEqualTo(0.85);
            assertThat((List<?>) r.framing().get("bleed")).as("arte inteira não sangra em %s", a[0]).isEmpty();
            assertThat(r.logo()).as("logo FAI em %s", a[0]).isNotNull().containsEntry("source", "catalogo");
            assertThat(r.detailJpeg()).as("foto de detalhe do logo em %s", a[0]).isNotNull();
            if (Set.of("TOP", "OUTERWEAR", "BOTTOM", "FULL_BODY").contains(a[1])) {
                assertThat(r.feed()).as("recorte de tecido em %s", a[0]).containsEntry("mode", "GARMENT_COVER");
                String aspect = "BOTTOM".equals(a[1]) ? "2:1" : "4:5";
                BufferedImage feed = ImageIO.read(new java.io.ByteArrayInputStream(r.feedJpeg()));
                assertThat(r.feed()).containsEntry("aspect", aspect);
                assertThat(feed.getWidth()).isEqualTo(800);
                assertThat(feed.getHeight()).isEqualTo("BOTTOM".equals(a[1]) ? 400 : 1000);
            }
            if (dump) {
                String base = "target/default-" + new File(a[0]).getName().replace(".png", "");
                Files.write(new File(base + "-studio.jpg").toPath(), r.studioJpeg());
                Files.write(new File(base + "-feed.jpg").toPath(), r.feedJpeg());
                Files.write(new File(base + "-detail.jpg").toPath(), r.detailJpeg());
                System.out.printf("%s: %s · logo %s%n", a[0], r.framing(), r.logo());
            }
        }
    }
}
