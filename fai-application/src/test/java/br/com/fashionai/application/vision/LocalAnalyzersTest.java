package br.com.fashionai.application.vision;

import br.com.fashionai.application.vision.analysis.GarmentEmbedder;
import br.com.fashionai.application.vision.analysis.LabelTextParser;
import br.com.fashionai.application.vision.analysis.PatternAnalyzer;
import org.junit.jupiter.api.Test;

import java.awt.Color;

import static org.assertj.core.api.Assertions.assertThat;

class LocalAnalyzersTest {
    private final PatternAnalyzer patterns = new PatternAnalyzer();
    private final LabelTextParser labels = new LabelTextParser();
    private final GarmentEmbedder embedder = new GarmentEmbedder();

    @Test
    void padraoLisoListradoEXadrez() {
        assertThat(patterns.analyze(Shapes.pants(Color.BLUE)).pattern()).isEqualTo(PatternAnalyzer.Pattern.SOLID);
        assertThat(patterns.analyze(Shapes.stripes(true, false)).pattern()).isEqualTo(PatternAnalyzer.Pattern.STRIPED);
        assertThat(patterns.analyze(Shapes.stripes(true, true)).pattern()).isEqualTo(PatternAnalyzer.Pattern.CHECKED);
    }

    @Test
    void pecaLisaComSombraEDetalhePequenoNaoViraEstampada() {
        // auditoria 10: jeans, legging, saia e camiseta lisas saíam como "Estampado" (sombra, dobra e o selo bordado)
        java.awt.image.BufferedImage jeans = Shapes.pants(Color.BLUE);
        java.awt.Graphics2D g = jeans.createGraphics();
        for (int y = 40; y < 760; y++) {
            int shade = 110 + (y - 40) * 100 / 720 - (Math.abs(y - 420) < 25 ? 70 : 0);
            g.setColor(new Color(40 * shade / 255, 90 * shade / 255, 220 * shade / 255));
            g.drawLine(80, y, 320, y);
        }
        g.setColor(new Color(240, 120, 20));
        g.fillOval(180, 300, 40, 40);
        g.dispose();
        assertThat(patterns.analyze(jeans).pattern()).isEqualTo(PatternAnalyzer.Pattern.SOLID);
        // a mesma calça recortada de uma foto (caixa opaca): o fundo bege entre as pernas não conta como estampa
        java.awt.image.BufferedImage foto = new java.awt.image.BufferedImage(400, 800, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.awt.Graphics2D fg = foto.createGraphics();
        fg.setColor(new Color(236, 232, 224));
        fg.fillRect(0, 0, 400, 800);
        fg.drawImage(jeans, 0, 0, null);
        fg.dispose();
        assertThat(patterns.analyze(foto).pattern()).isEqualTo(PatternAnalyzer.Pattern.SOLID);

        java.awt.image.BufferedImage florido = Shapes.pants(new Color(240, 235, 225));
        java.awt.Graphics2D f = florido.createGraphics();
        java.util.Random random = new java.util.Random(7);
        Color[] tintas = {new Color(200, 30, 60), new Color(40, 120, 60), new Color(240, 180, 40), new Color(30, 60, 160)};
        for (int i = 0; i < 900; i++) {
            f.setColor(tintas[i % tintas.length]);
            f.fillOval(80 + random.nextInt(240), 40 + random.nextInt(720), 14, 14);
        }
        f.dispose();
        assertThat(patterns.analyze(florido).pattern()).isEqualTo(PatternAnalyzer.Pattern.PRINTED);
    }

    @Test
    void composicaoDaEtiquetaViraMaterial() {
        assertThat(labels.parse("100% ALGODÃO · Made in Brazil · TAM M").material()).isEqualTo("COTTON");
        LabelTextParser.Parsed blend = labels.parse("60% cotton 40% polyester");
        assertThat(blend.material()).isEqualTo("BLEND");
        assertThat(blend.composition()).hasSize(2);
        assertThat(labels.parse("Composição: algodão 98% elastano 2%").material()).isEqualTo("COTTON");
        assertThat(labels.parse("100% linho").material()).isNull();
        LabelTextParser.Parsed p = labels.parse("100% ALGODÃO · Made in Brazil · TAM M");
        assertThat(p.size()).isEqualTo("M");
        assertThat(p.country()).startsWith("brazil");
    }

    @Test
    void codigosDeModeloSemNumeroDeSerie() {
        assertThat(labels.parse("NIKE AIR MAX 90 CN8490-002 US 9").codes()).contains("CN8490-002");
        assertThat(labels.parse("TISSOT T137.407.11.041.00 SWISS MADE").codes()).contains("T137.407.11.041.00");
        LabelTextParser.Parsed glasses = labels.parse("RB2140 901 50□22 150 3N");
        assertThat(glasses.eyewearSize()).isEqualTo("50□22 150");
        assertThat(glasses.codes()).contains("RB2140");
        LabelTextParser.Parsed serial = labels.parse("REF 5711 S/N ABC123456");
        assertThat(serial.serialPresent()).isTrue();
        assertThat(serial.codes()).doesNotContain("ABC123456");
    }

    @Test
    void embeddingNormalizadoESemelhantePorCor() {
        float[] a = embedder.embed(Shapes.pants(Color.BLUE));
        float[] b = embedder.embed(Shapes.pants(new Color(10, 10, 240)));
        float[] c = embedder.embed(Shapes.tshirt(Color.YELLOW));
        assertThat(a).hasSize(GarmentEmbedder.DIMENSIONS);
        assertThat(GarmentEmbedder.cosine(a, b)).isGreaterThan(GarmentEmbedder.cosine(a, c));
        assertThat(GarmentEmbedder.cosine(a, a)).isCloseTo(1.0, org.assertj.core.api.Assertions.within(1e-6));
    }
}
