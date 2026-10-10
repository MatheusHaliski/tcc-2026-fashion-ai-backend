package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

import java.awt.image.BufferedImage;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Casamento do texto lido (OCR) com o catálogo de marcas e a grade de sub-retângulos da nova tentativa. */
class BrandReaderTest {

    private static BrandReader reader(List<TextReaderPort.Line> lines) {
        return reader(img -> lines);
    }

    /** Leitor falso que responde conforme a imagem recebida (variações da leitura robusta chegam em tamanhos diferentes). */
    private static BrandReader reader(java.util.function.Function<BufferedImage, List<TextReaderPort.Line>> answer) {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("ocr", new TextReaderPort() {
            public boolean available() {
                return true;
            }

            public List<Line> read(BufferedImage image) {
                return answer.apply(image);
            }
        });
        BrandReader r = new BrandReader(beans.getBeanProvider(TextReaderPort.class), beans.getBeanProvider(br.com.fashionai.domain.repository.BrandRepository.class));
        r.useCatalog(Map.of("lacoste", "Lacoste", "nike", "Nike", "tommyhilfiger", "Tommy Hilfiger", "gap", "Gap", "vans", "Vans",
                "underarmour", "Under Armour", "umbro", "Umbro", "puma", "Puma", "newbalance", "New Balance"));
        return r;
    }

    private static final List<BrandRegions.Zone> CHEST = List.of(
            new BrandRegions.Zone("gola", new double[]{0.3, 0, 0.7, 0.15}),
            new BrandRegions.Zone("peito_esquerdo", new double[]{0.5, 0.1, 0.95, 0.45}),
            new BrandRegions.Zone("peito_direito", new double[]{0.05, 0.1, 0.5, 0.45}),
            new BrandRegions.Zone("centro_peito", new double[]{0.2, 0.15, 0.8, 0.5}));

    private static BufferedImage piece() {
        return new BufferedImage(400, 500, BufferedImage.TYPE_INT_ARGB);
    }

    @Test
    void textoDoLogoViraMarcaDoCatalogo() {
        BrandReader r = reader(List.of());
        assertEquals("Lacoste", r.match("LACOSTE").orElseThrow());
        assertEquals("Lacoste", r.match("— LACOSTE — SINCE 1933").orElseThrow());
        assertEquals("Vans", r.match("VANS.").orElseThrow());
        assertEquals("Tommy Hilfiger", r.match("TOMMY HILFIGER").orElseThrow());
        assertEquals("Tommy Hilfiger", r.match("TOMMYHILFIGER").orElseThrow(), "OCR sem espaço entre as palavras");
        assertEquals("Lacoste", r.match("LAC0STE").orElseThrow(), "uma letra trocada em nome longo");
        assertTrue(r.match("GAPNLAHASN").isEmpty(), "marca curta não casa dentro de outra palavra");
        assertTrue(r.match("SINCE 1933").isEmpty());
        // logo parcialmente escondido (dobra do tecido, borda): sem a primeira ou a última letra, em nome longo
        assertEquals("Lacoste", r.match("ACOSTE").orElseThrow());
        assertEquals("Lacoste", r.match("LACOST").orElseThrow());
        assertTrue(r.match("COSTE").isEmpty(), "duas letras a menos já não é a marca");
        assertTrue(r.match("NIK").isEmpty(), "nome curto não aceita letra faltando");
    }

    @Test
    void camisaComLogoGrandeTemMarcaConfirmada() {
        BrandReader r = reader(List.of(new TextReaderPort.Line("LACOSTE", 0.97, new double[]{0.3, 0.25, 0.7, 0.32})));
        BrandReader.Found f = r.find(new BufferedImage(100, 100, BufferedImage.TYPE_INT_ARGB), List.of()).orElseThrow();
        assertEquals("Lacoste", f.brand());
        assertTrue(f.confirmed());
        assertEquals("peca", f.region());
    }

    @Test
    void fraseDeEstampaNaoViraMarca() {
        assertNull(BrandReader.wordmark(new TextReaderPort.Line("GOOD VIBES ONLY", 0.99, null)));
        assertNull(BrandReader.wordmark(new TextReaderPort.Line("GOODVIBESONLY", 0.99, null)));
        assertNull(BrandReader.wordmark(new TextReaderPort.Line("DVIBES", 0.99, null)), "frase cortada pelo recorte");
        assertEquals("Korvano", BrandReader.wordmark(new TextReaderPort.Line("KORVANO", 0.99, null)));
    }

    @Test
    void palavraDeLogoForaDoCatalogoEhSoPossivel() {
        BrandReader r = reader(List.of(new TextReaderPort.Line("OLYMPIKUS", 0.96, null)));
        BrandReader.Found f = r.find(new BufferedImage(100, 100, BufferedImage.TYPE_INT_ARGB), List.of()).orElseThrow();
        assertEquals("Olympikus", f.brand());
        assertFalse(f.confirmed());
        assertNull(BrandReader.wordmark(new TextReaderPort.Line("SINCE", 0.99, null)));
        assertNull(BrandReader.wordmark(new TextReaderPort.Line("Engineering", 0.99, null)), "minúsculas não parecem logo");
    }

    @Test
    void gradeCobreAPecaInteiraComSobreposicao() {
        BufferedImage piece = new BufferedImage(400, 500, BufferedImage.TYPE_INT_ARGB);
        List<BrandRegions.Zone> g3 = BrandRegions.tiles(piece, null, 3);
        assertEquals(9, g3.size());
        assertEquals(0.0, g3.get(0).box()[0]);
        assertEquals(1.0, g3.get(8).box()[2], 1e-9);
        assertTrue(g3.get(0).box()[2] > g3.get(1).box()[0], "vizinhos se sobrepõem");
        List<BrandRegions.Zone> withLogo = BrandRegions.tiles(piece, new double[]{0.4, 0.2, 0.6, 0.3}, 4);
        assertEquals("logo", withLogo.get(0).id());
        assertEquals(1 + 4 + 16, withLogo.size());
    }

    @Test
    void semelhancaComparaTambemComOComecoEOFimDaPalavra() {
        assertEquals(1.0, BrandReader.similarity("armour", "armour"), 1e-9);
        assertTrue(BrandReader.similarity("unpe", "under") > 0.6, "pedaço com o fim escondido pela dobra: começo da palavra");
        assertTrue(BrandReader.similarity("mour", "armour") > 0.8, "pedaço com o começo escondido: fim da palavra");
        assertTrue(BrandReader.similarity("inoer", "under") >= 0.6);
        assertTrue(BrandReader.similarity("unps", "puma") < 0.5, "pedaço de outra marca não vota");
        assertEquals(List.of("under", "armour"), BrandReader.brandWords("Under Armour"));
        assertEquals(List.of("tommy", "hilfiger"), BrandReader.brandWords("Tommy Hilfiger"));
    }

    @Test
    void duasLinhasDoLogoLidasEmSeparadoConfirmamAMarca() {
        // tecido dobrado: "UNDER" numa leitura, "ARMOUR" noutra (a linha de baixo só aparece invertida)
        BrandReader r = reader(img -> img.getWidth() == 400 ? List.of()
                : List.of(new TextReaderPort.Line(img.getRGB(0, 0) == 0xFF000000 ? "ARMOUR" : "UNDER", 0.8, new double[]{0.2, 0.3, 0.8, 0.45})));
        BrandReader.Found f = r.findRobust(piece(), CHEST).orElseThrow();
        assertEquals("Under Armour", f.brand());
        assertTrue(f.confirmed(), "duas palavras distintas da mesma marca = confirmada");
    }

    @Test
    void umaPalavraDeMarcaCompostaEhSoPossivel() {
        BrandReader r = reader(List.of(new TextReaderPort.Line("UNDER", 0.9, new double[]{0.2, 0.3, 0.8, 0.4})));
        BrandReader.Found f = r.find(piece(), CHEST).orElseThrow();
        assertEquals("Under Armour", f.brand());
        assertFalse(f.confirmed(), "\"UNDER\" sozinho pode ser estampa: a pessoa confirma");
        BrandReader.Found h = reader(List.of(new TextReaderPort.Line("HILFIGER", 0.9, null))).find(piece(), CHEST).orElseThrow();
        assertEquals("Tommy Hilfiger", h.brand());
        assertTrue(h.confirmed(), "palavra distintiva (7+ letras) confirma sozinha");
    }

    @Test
    void leiturasParciaisDoTecidoDobradoVotamNaMarcaDoCatalogo() {
        // o que o OCR devolveu de verdade para "UNDER ARMOUR" dobrado: pedaços da primeira linha em cada variação
        List<TextReaderPort.Line> pieces = List.of(new TextReaderPort.Line("UNPS", 0.67, new double[]{0.2, 0.3, 0.8, 0.5}),
                new TextReaderPort.Line("INOER", 0.64, new double[]{0.2, 0.3, 0.8, 0.5}), new TextReaderPort.Line("UNPE", 0.62, new double[]{0.2, 0.3, 0.8, 0.5}),
                new TextReaderPort.Line("INPIER", 0.74, new double[]{0.2, 0.3, 0.8, 0.5}));
        java.util.concurrent.atomic.AtomicInteger calls = new java.util.concurrent.atomic.AtomicInteger();
        BrandReader r = reader(img -> img.getWidth() == 400 ? List.of() : List.of(pieces.get(calls.getAndIncrement() % pieces.size())));
        assertTrue(r.find(piece(), CHEST).isEmpty(), "a leitura normal não inventa marca com pedaços");
        BrandReader.Found f = r.findRobust(piece(), CHEST).orElseThrow();
        assertEquals("Under Armour", f.brand());
        assertFalse(f.confirmed(), "sugestão para confirmar, nunca preenchida sozinha");
        assertFalse(f.evidence().isBlank());
        assertFalse(f.alternatives().contains("Under Armour"));
    }

    @Test
    void textoFirmeQueNaoCasaViraLogoIlegivel() {
        BrandReader r = reader(img -> img.getWidth() == 400 ? List.of() : List.of(new TextReaderPort.Line("XQZW", 0.5, new double[]{0.2, 0.3, 0.8, 0.4})));
        BrandReader.Found f = r.findRobust(piece(), CHEST).orElseThrow();
        assertNull(f.brand(), "há texto, mas nada do catálogo: a tela pede a marca ou outra foto");
        assertFalse(f.confirmed());
        assertTrue(r.find(piece(), CHEST).isEmpty(), "a leitura normal continua sem resultado");
    }

    @Test
    void semTextoNenhumNaoHaSugestao() {
        BrandReader r = reader(List.of());
        assertTrue(r.findRobust(piece(), CHEST).isEmpty());
    }

    @Test
    void zonasDaLeituraRobustaSaoOPeitoNuncaAGola() {
        List<BrandRegions.Zone> z = BrandReader.robustZones(CHEST);
        assertEquals(List.of("centro_peito", "peito_esquerdo", "peito_direito"), z.stream().map(BrandRegions.Zone::id).toList());
    }

    @Test
    void caixaAltaGanhaAsDuasMetadesNasVariacoes() {
        BufferedImage base = new BufferedImage(300, 200, BufferedImage.TYPE_INT_RGB);
        List<BrandReader.LineCrop> wide = BrandReader.lineVariants(base, BrandReader.invert(base), new double[]{0.1, 0.4, 0.9, 0.5});
        assertEquals(List.of("linha", "linha+8", "linha-8", "linha-inv", "linha+8-inv", "linha-8-inv"), wide.stream().map(BrandReader.LineCrop::variant).toList());
        List<BrandReader.LineCrop> tall = BrandReader.lineVariants(base, BrandReader.invert(base), new double[]{0.2, 0.2, 0.6, 0.7});
        assertEquals(10, tall.size(), "caixa alta (duas linhas juntas): + metade de cima e de baixo nas duas polaridades");
        BrandReader.LineCrop top = tall.stream().filter(v -> v.variant().equals("metade-cima")).findFirst().orElseThrow();
        BrandReader.LineCrop bottom = tall.stream().filter(v -> v.variant().equals("metade-baixo")).findFirst().orElseThrow();
        assertTrue(top.box()[3] <= bottom.box()[1] + 1e-9, "as metades ficam em ordem de leitura (cima, baixo)");
        assertTrue(top.image().getHeight() < 0.6 * tall.get(0).image().getHeight());
        assertEquals(0xFFFFFF, BrandReader.invert(base).getRGB(0, 0) & 0xFFFFFF, "preto vira branco");
        assertTrue(BrandReader.overlap(new double[]{0, 0, 1, 1}, new double[]{0, 0, 1, 1}) > 0.99);
        assertEquals(0.0, BrandReader.overlap(new double[]{0, 0, 0.5, 1}, new double[]{0.5, 0, 1, 1}), 1e-9);
    }
}
