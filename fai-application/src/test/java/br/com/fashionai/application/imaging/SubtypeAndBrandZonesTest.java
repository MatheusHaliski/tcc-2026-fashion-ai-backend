package br.com.fashionai.application.imaging;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * RF4 — subtipo por similaridade com as referências da categoria escolhida (e a folha de contato que vai para a IA) e as
 * zonas onde a marca é procurada (fundo da gola, peito esquerdo, peito direito, centro do peito).
 */
class SubtypeAndBrandZonesTest {
    static SubtypeReferences refs;

    @BeforeAll
    @SuppressWarnings("unchecked")
    static void load() throws Exception {
        File manifest = new File("../fai-web/src/main/resources/catalog/asset-manifest.json");
        assumeTrue(PieceTestPhotos.available() && manifest.isFile(), "assets de peças fora do checkout");
        Map<String, Object> m = new ObjectMapper().readValue(manifest, Map.class);
        Map<String, Map<String, String>> bySub = (Map<String, Map<String, String>>) ((Map<String, Object>) m.get("defaultPieceImages")).get("bySubcategory");
        List<SubtypeReferences.Reference> out = new ArrayList<>();
        for (var e : bySub.entrySet()) {
            BufferedImage img = ImageOps.toArgb(ImageIO.read(new File("../public" + e.getValue().get("url"))));
            out.add(SubtypeReferences.reference(e.getKey(), e.getValue().get("category"), img));
        }
        refs = new SubtypeReferences(out);
    }

    /** A peça como sai do pipeline: foto montada → recorte endireitado e justo (a fonte do estúdio). */
    static BufferedImage piece(String art, int w, int h, double fill) throws Exception {
        return PieceTestPhotos.pipeline(PieceTestPhotos.canvas(PieceTestPhotos.art(art), w, h, fill, 0.5, 0.5, null)).studioSource();
    }

    @Test
    void comparaSoComOsSubtiposDaCategoriaEscolhida() throws Exception {
        List<SubtypeReferences.Match> skirt = refs.rank("lower_piece", piece("02_Parte_inferior/12_saia.png", 1600, 1400, 0.8));
        assertThat(skirt).hasSize(br.com.fashionai.application.taxonomy.Taxonomy.SUBCATEGORIES.get("lower_piece").size());   // legado conta para o novo
        assertThat(skirt.get(0).subcategory()).isEqualTo("skirt");
        assertThat(skirt).allMatch(m -> br.com.fashionai.application.taxonomy.Taxonomy.SUBCATEGORIES.get("lower_piece").contains(m.subcategory()));
        List<SubtypeReferences.Match> jeans = refs.rank("lower_piece", piece("02_Parte_inferior/01_jeans.png", 1200, 1600, 0.85));
        assertThat(jeans.get(0).subcategory()).isEqualTo("jeans");
        // calça comprida: saia e shorts ficam atrás das calças
        double pants = jeans.stream().filter(x -> x.subcategory().equals("jeans")).findFirst().orElseThrow().score();
        double skirtScore = jeans.stream().filter(x -> x.subcategory().equals("skirt")).findFirst().orElseThrow().score();
        assertThat(pants).isGreaterThan(skirtScore);
        assertThat(refs.rank("full_body_piece", piece("05_Corpo_inteiro/01_vestido.png", 1200, 1600, 0.85)).get(0).subcategory()).isEqualTo("dress");
    }

    @Test
    void folhaDeContatoNumeradaNaOrdemDaLegenda() throws Exception {
        byte[] sheet = refs.contactSheet("lower_piece");
        assertThat(sheet).isNotNull();
        BufferedImage img = ImageIO.read(new ByteArrayInputStream(sheet));
        assertThat(img.getWidth()).isGreaterThan(600);
        List<String> legend = refs.sheetLegend("lower_piece");
        assertThat(legend).hasSize(14);
        assertThat(legend.get(0)).isEqualTo("1 = jeans");
        assertThat(refs.contactSheet("lower_piece")).isSameAs(sheet);         // a mesma folha para todos os pedidos
    }

    @Test
    void camisetaEmFormaDeCalcaNaoEhParteInferior() throws Exception {
        Silhouette.Descriptor tee = Silhouette.of(piece("01_Parte_superior/01_camiseta_referencia.png", 1600, 1600, 0.7));
        Map<String, Double> best = refs.bestByCategory(tee);
        assertThat(best.get("upper_piece")).isGreaterThan(best.get("lower_piece"));
        assertThat(PhotoAcceptance.shapeCheck("Parte inferior", null, 0, "Parte superior", best.get("lower_piece"), best.get("upper_piece")).ok()).isFalse();
    }

    @Test
    void zonasDaMarcaNaPecaDeCima() throws Exception {
        BufferedImage tee = piece("01_Parte_superior/01_camiseta_referencia.png", 1600, 1600, 0.7);
        List<BrandRegions.Zone> zones = BrandRegions.zones(tee, "upper_piece");
        assertThat(zones).extracting(BrandRegions.Zone::id).containsExactlyElementsOf(BrandRegions.TOP_ZONES);
        for (BrandRegions.Zone z : zones) {
            double[] b = z.box();
            assertThat(b[0]).isBetween(0.0, 1.0);
            assertThat(b[2]).isGreaterThan(b[0]).isLessThanOrEqualTo(1.0);
            assertThat(b[3]).isGreaterThan(b[1]).isLessThanOrEqualTo(1.0);
        }
        BrandRegions.Zone collar = zones.get(0), left = zones.get(1), right = zones.get(2), center = zones.get(3);
        // lados de quem veste: o peito esquerdo fica à direita da foto
        assertThat((left.box()[0] + left.box()[2]) / 2).isGreaterThan(0.5);
        assertThat((right.box()[0] + right.box()[2]) / 2).isLessThan(0.5);
        assertThat(collar.box()[1]).isLessThan(center.box()[1]);
        assertThat(collar.box()[3]).isLessThan(0.35);
        // logo no meio de cada zona cai nela (zonas se sobrepõem nas bordas: vale a de centro mais próximo)
        for (BrandRegions.Zone z : zones) {
            double mx = (z.box()[0] + z.box()[2]) / 2, my = (z.box()[1] + z.box()[3]) / 2;
            assertThat(BrandRegions.zoneOf(zones, new double[]{mx - 0.03, my - 0.03, mx + 0.03, my + 0.03})).isEqualTo(z.id());
        }
        assertThat(BrandRegions.zoneOf(zones, new double[]{0.0, 0.95, 0.02, 1.0})).isNull();
        BufferedImage zoom = BrandRegions.crop(tee, left);
        assertThat(Math.max(zoom.getWidth(), zoom.getHeight())).isEqualTo(512);
    }

    @Test
    void zonasEquivalentesNasOutrasCategorias() throws Exception {
        BufferedImage jeans = piece("02_Parte_inferior/01_jeans.png", 1200, 1600, 0.85);
        assertThat(BrandRegions.zones(jeans, "lower_piece")).extracting(BrandRegions.Zone::id)
                .containsExactly("cos", "quadril_esquerdo", "quadril_direito", "centro_frente");
        assertThat(BrandRegions.zones(jeans, "shoes_piece")).hasSize(4);
        assertThat(BrandRegions.zones(jeans, "accessory_piece")).hasSize(4);
    }
}
