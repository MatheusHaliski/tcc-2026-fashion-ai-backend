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
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("ocr", new TextReaderPort() {
            public boolean available() {
                return true;
            }

            public List<Line> read(BufferedImage image) {
                return lines;
            }
        });
        BrandReader r = new BrandReader(beans.getBeanProvider(TextReaderPort.class), beans.getBeanProvider(br.com.fashionai.domain.repository.BrandRepository.class));
        r.useCatalog(Map.of("lacoste", "Lacoste", "nike", "Nike", "tommyhilfiger", "Tommy Hilfiger", "gap", "Gap", "vans", "Vans"));
        return r;
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
}
