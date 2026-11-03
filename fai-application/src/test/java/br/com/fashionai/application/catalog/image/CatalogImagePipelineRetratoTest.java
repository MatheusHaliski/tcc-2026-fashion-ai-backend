package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonParts;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonSegmentationPort;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static br.com.fashionai.application.catalog.image.CatalogPhotos.*;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização do {@link CatalogImagePipeline} (lote R93): as mesmas fotos sintéticas passam por todos os estágios,
 * sem e com segmentador de pessoa (fake determinístico pela fração de pele), e o retrato — veredito, recorte, métricas,
 * estágios, depuração e SHA-256 dos pixels do master e dos quadros de preview — tem de continuar idêntico ao gravado no
 * código original em {@code catalog/image/pipeline-retrato.txt}.
 */
class CatalogImagePipelineRetratoTest {

    /** Pessoa = fração de pixels com o tom de pele das fotos sintéticas; quebra quando a imagem é minúscula. */
    static final class SkinPersons implements PersonSegmentationPort {
        private final boolean failing;

        SkinPersons(boolean failing) {
            this.failing = failing;
        }

        @Override
        public boolean available() {
            return true;
        }

        @Override
        public Optional<PersonParts> segment(BufferedImage image) {
            if (failing) {
                throw new IllegalStateException("segmentador fora do ar");
            }
            long skin = 0;
            for (int y = 0; y < image.getHeight(); y++) {
                for (int x = 0; x < image.getWidth(); x++) {
                    Color c = new Color(image.getRGB(x, y), true);
                    if (c.getAlpha() > 0 && Math.abs(c.getRed() - SKIN.getRed()) < 12 && Math.abs(c.getGreen() - SKIN.getGreen()) < 12
                            && Math.abs(c.getBlue() - SKIN.getBlue()) < 12) {
                        skin++;
                    }
                }
            }
            double share = skin / (double) Math.max(1, image.getWidth() * image.getHeight());
            return share == 0 ? Optional.empty() : Optional.of(new PersonParts(Math.min(1, share * 3), .25, .1, .6));
        }
    }

    private static Map<String, Object[]> inputs() {
        BufferedImage fragment = studio(900, 900, 246);
        pen(fragment, NAVY).fillRect(430, 430, 60, 60);
        Map<String, Object[]> in = new LinkedHashMap<>();
        in.put("tee-packshot", new Object[]{jpeg(tee(200, 200, 1.0)), "upper_piece", "t_shirt", "PACKSHOT"});
        in.put("tee-small-corner", new Object[]{jpeg(tee(40, 40, 0.6)), "upper_piece", "t_shirt", "PACKSHOT"});
        in.put("tee-back-declared", new Object[]{jpeg(tee(200, 200, 1.0)), "upper_piece", "t_shirt", "BACK"});
        in.put("jeans", new Object[]{jpeg(jeans()), "lower_piece", "jeans", "PACKSHOT"});
        in.put("pants-model", new Object[]{png(pantsOnModel(false)), "lower_piece", "jeans", "FRONT"});
        in.put("pants-model-hand", new Object[]{png(pantsOnModel(true)), "lower_piece", "jeans", "FRONT"});
        in.put("sneakers", new Object[]{jpeg(sneakers()), "shoes_piece", "casual_sneakers", "PACKSHOT"});
        in.put("loafers", new Object[]{jpeg(sneakers()), "shoes_piece", "loafers", "SIDE"});
        in.put("watch", new Object[]{jpeg(watch()), "accessory_piece", "watch", "PACKSHOT"});
        in.put("beanie-fragment", new Object[]{jpeg(fragment), "accessory_piece", "beanie", "PACKSHOT"});
        in.put("beanie-detail", new Object[]{jpeg(fragment), "accessory_piece", "beanie", "DETAIL"});
        in.put("tee-hanger", new Object[]{jpeg(teeOnHanger()), "upper_piece", "t_shirt", "PACKSHOT"});
        in.put("tee-prop", new Object[]{jpeg(teeWithProp()), "upper_piece", "t_shirt", "PACKSHOT"});
        in.put("tee-person", new Object[]{jpeg(teeOnPerson()), "upper_piece", "t_shirt", "FRONT"});
        in.put("tee-cut", new Object[]{jpeg(teeCutAtBottom()), "upper_piece", "t_shirt", "PACKSHOT"});
        in.put("dress", new Object[]{jpeg(tee(200, 200, 1.0)), "full_body_piece", "dress", null});
        in.put("tiny", new Object[]{jpeg(studio(200, 260, 245)), "upper_piece", "t_shirt", "PACKSHOT"});
        in.put("empty-studio", new Object[]{jpeg(studio(900, 900, 246)), "upper_piece", "t_shirt", "PACKSHOT"});
        in.put("gif", new Object[]{gif(), "upper_piece", "t_shirt", "FRONT"});
        in.put("garbage", new Object[]{new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 1, 2, 3}, "upper_piece", "t_shirt", "FRONT"});
        in.put("cutout-png", new Object[]{png(ImageOps.scale(tee(200, 200, 1.0), 900, 900)), "upper_piece", "t_shirt", "PACKSHOT"});
        return in;
    }

    private static byte[] gif() {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            javax.imageio.ImageIO.write(studio(400, 400, 240), "gif", out);
            return out.toByteArray();
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void retratoDoPipelineSemEComSegmentadorDePessoa() throws Exception {
        CatalogImageRetrato r = CatalogImageRetrato.start();
        Map<String, PersonSegmentationPort> persons = new LinkedHashMap<>();
        persons.put("sem-segmentador", null);
        persons.put("segmentador-pele", new SkinPersons(false));
        persons.put("segmentador-falha", new SkinPersons(true));
        for (var p : persons.entrySet()) {
            CatalogImagePipeline pipeline = new CatalogImagePipeline(SemanticRegionRegistry.get(), p.getValue());
            for (var in : inputs().entrySet()) {
                Object[] v = in.getValue();
                for (boolean persist : new boolean[]{false, true}) {
                    if (persist && p.getValue() instanceof SkinPersons s && s.failing) {
                        continue;
                    }
                    CatalogImagePipeline.Analysis a = pipeline.run(new CatalogImagePipeline.Request((byte[]) v[0], (String) v[1],
                            (String) v[2], (String) v[3], persist));
                    String label = p.getKey() + " " + in.getKey() + (persist ? " B" : " A");
                    r.line(label, CatalogImageRetrato.analysis(a));
                    r.line(label + " colunas", CatalogImageBatchCli.columns(a));
                }
            }
        }
        r.line("sha256(texto)", CatalogImagePipeline.sha256("FashionAI"));
        assertThat(r.text()).isEqualTo(CatalogImageRetrato.golden(r.text(), "pipeline-retrato.txt"));
    }
}
