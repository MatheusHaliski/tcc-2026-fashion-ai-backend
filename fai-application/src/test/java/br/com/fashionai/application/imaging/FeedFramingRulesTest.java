package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.imaging.FeedFramingTest.asset;
import static br.com.fashionai.application.imaging.FeedFramingTest.pants;
import static br.com.fashionai.application.imaging.FeedFramingTest.tee;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Foto enviada pela pessoa segue a mesma Regra de Enquadramento do Produto das fotos do acervo
 * (docs/catalogo/PIPELINE_IMAGENS_CATALOGO.md §9.1): com a categoria do cadastro, o quadro 4:5 da foto do feed sai da
 * regra do registro (catalog/semantic-regions.json). Uma verificação por regra do produto final.
 */
class FeedFramingRulesTest {

    private static FeedFraming.Feed feed(BufferedImage piece, String category, String sub) {
        return FeedFraming.frame(piece, FeedFraming.template(category, sub, null), Set.of(), category, sub);
    }

    /** Caixa da peça no quadro: esquerda, topo, direita, base (frações; passa de 0–1 onde a peça sai do quadro). */
    private static double[] box(FeedFraming.Feed f) {
        List<Double> b = f.box();
        return new double[]{b.get(0), b.get(1), b.get(2), b.get(3)};
    }

    @Test
    void regra1e2ParteDeCimaPreencheOQuadroComAGolaNaMetadeSuperior() {
        FeedFraming.Feed f = feed(tee(1.0, 440, 620, 160, 0.5, 0, new Color(0x1F3A6B)), "upper_piece", "t_shirt");
        double[] b = box(f);
        // 100% do quadro: a peça cobre as quatro bordas (mangas/barra podem sair; nada de fundo vazio em volta)
        assertThat(b[0]).isLessThanOrEqualTo(0.001);
        assertThat(b[2]).isGreaterThanOrEqualTo(0.999);
        assertThat(b[1]).as("gola no topo do quadro").isCloseTo(0.0, within(0.01));
        assertThat(b[3]).isGreaterThanOrEqualTo(0.999);
        assertThat(f.landmarks()).containsKey("rule");
        assertThat(((Map<?, ?>) f.landmarks().get("rule")).get("fit")).isEqualTo("COVER");
        // gola: o topo da peça; a região gola/peito (primeiros 38% da peça) termina na metade superior do quadro
        assertThat(b[1] + 0.38 * (b[3] - b[1]) * 0.5).isLessThan(0.5);
    }

    @Test
    void regra3ParteDeBaixoPreencheALarguraComOCosNoTopo() {
        FeedFraming.Feed f = feed(pants(1.0, 380, 300, 720, 150, false), "lower_piece", "jeans");
        double[] b = box(f);
        assertThat(b[1]).as("cós no topo").isCloseTo(0.0, within(0.01));
        assertThat(b[0]).isLessThanOrEqualTo(0.001);
        assertThat(b[2]).isGreaterThanOrEqualTo(0.999);
        assertThat(b[3]).as("as pernas passam da base: cós e bolsos ficam na metade de cima").isGreaterThan(1.0);
        assertThat(((Map<?, ?>) f.landmarks().get("rule")).get("view")).isEqualTo("BACK");
    }

    @Test
    void regra4CalcadoComOComprimentoInteiroNaLarguraDoQuadro() throws Exception {
        FeedFraming.Feed f = feed(asset("03_Calcados/01_tenis_casual.png"), "shoes_piece", "casual_sneakers");
        double[] b = box(f);
        assertThat(b[0]).isCloseTo(0.0, within(0.005));
        assertThat(b[2]).isCloseTo(1.0, within(0.005));
        assertThat(b[1]).isGreaterThanOrEqualTo(0.0);
        assertThat(b[3]).isLessThanOrEqualTo(1.0);
        assertThat(f.frame().bleed()).isEmpty();
    }

    @Test
    void regra5aOculosComAsDuasLentesNaLarguraToda() throws Exception {
        for (String a : new String[]{"04_Acessorios/13_oculos_sol.png", "04_Acessorios/14_oculos_grau.png"}) {
            double[] b = box(feed(asset(a), "accessory_piece", "sunglasses"));
            assertThat(b[2] - b[0]).as(a).isGreaterThan(0.95);
            assertThat(b[1]).as(a).isGreaterThanOrEqualTo(0.0);
            assertThat(b[3]).as(a).isLessThanOrEqualTo(1.0);
        }
    }

    @Test
    void regra5bRelogioComOMostradorNoCentroDoQuadro() throws Exception {
        FeedFraming.Feed f = feed(asset("04_Acessorios/19_relogio.png"), "accessory_piece", "watch");
        double[] b = box(f);
        // mostrador = região do registro (x 20–80%, y 30–70% da peça): o centro dele cai no centro do quadro
        double dialX = b[0] + 0.50 * (b[2] - b[0]), dialY = b[1] + 0.50 * (b[3] - b[1]);
        assertThat(dialX).isCloseTo(0.5, within(0.01));
        assertThat(dialY).isCloseTo(0.5, within(0.01));
        assertThat(b[2] - b[0]).as("relógio preenche a largura").isGreaterThanOrEqualTo(0.999);
    }

    @Test
    void regra5cA5fJoiasGorroCachecolECintoInteirosDentroDoQuadro() throws Exception {
        Object[][] cases = {
                {"04_Acessorios/15_colar.png", "necklace"}, {"04_Acessorios/16_pulseira.png", "bracelet"},
                {"04_Acessorios/17_brincos.png", "earrings"}, {"04_Acessorios/18_anel.png", "ring"},
                {"04_Acessorios/09_gorro.png", "beanie"}, {"04_Acessorios/10_cachecol.png", "scarf"},
                {"04_Acessorios/06_cinto.png", "belt"},
        };
        for (Object[] c : cases) {
            FeedFraming.Feed f = feed(asset((String) c[0]), "accessory_piece", (String) c[1]);
            double[] b = box(f);
            assertThat(b[0]).as("%s inteiro (esquerda)", c[0]).isGreaterThanOrEqualTo(-0.001);
            assertThat(b[1]).as("%s inteiro (topo)", c[0]).isGreaterThanOrEqualTo(-0.001);
            assertThat(b[2]).as("%s inteiro (direita)", c[0]).isLessThanOrEqualTo(1.001);
            assertThat(b[3]).as("%s inteiro (base)", c[0]).isLessThanOrEqualTo(1.001);
            assertThat(f.frame().bleed()).as("%s sem sangria", c[0]).isEmpty();
            if (!"belt".equals(c[1])) {
                // objeto o maior possível: encosta na folga de 2% em pelo menos um eixo
                assertThat(Math.max(b[2] - b[0], (b[3] - b[1]) * 1.25)).as("%s ocupa o quadro", c[0]).isGreaterThan(0.94);
            }
        }
        // cinto: a fivela (ponta esquerda no registro: x 0–35%, y 20–80%) nivelada no centro do quadro
        double[] belt = box(feed(asset("04_Acessorios/06_cinto.png"), "accessory_piece", "belt"));
        double buckleX = belt[0] + 0.175 * (belt[2] - belt[0]), buckleY = belt[1] + 0.50 * (belt[3] - belt[1]);
        assertThat(buckleX).isCloseTo(0.5, within(0.01));
        assertThat(buckleY).isCloseTo(0.5, within(0.01));
    }

    @Test
    void semCategoriaContinuaOEnquadramentoDoTemplate() {
        BufferedImage t = tee(1.0, 440, 620, 160, 0.5, 0, new Color(0x1F3A6B));
        FeedFraming.Feed old = FeedFraming.frame(t, FeedFraming.Template.TOP, Set.of());
        FeedFraming.Feed none = FeedFraming.frame(t, FeedFraming.Template.TOP, Set.of(), null, null);
        assertThat(none.box()).isEqualTo(old.box());
        assertThat(none.landmarks()).doesNotContainKey("rule");
    }
}
