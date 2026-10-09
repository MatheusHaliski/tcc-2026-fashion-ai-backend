package br.com.fashionai.application.service;

import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.taxonomy.Taxonomy;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * RF4 · Várias peças numa foto: a resposta da IA vira peças validadas pela taxonomia, com a caixa (em %) presa dentro
 * da foto; caixa ausente ou minúscula descarta a peça, e JSON ilegível é falha do provedor (o motor tenta o próximo).
 */
class MultiPieceDetectionTest {
    static final String AI = """
            Aqui está: {"pieces": [
              {"name": "Camiseta branca lisa", "category": "lower_piece", "subcategory": "t_shirt", "color": "white",
               "material": "COTTON", "sex": "UNISSEX", "style": ["basic", "not_a_style", "minimalist", "classic"],
               "occasion": ["casual", "casual"], "box": {"x": 20, "y": 10, "width": 50, "height": 35}, "confidence": 0.93},
              {"name": "Calça jeans", "category": "lower_piece", "subcategory": "not_a_sub", "color": "roxo-inventado",
               "material": "KEVLAR", "box": {"x": 90, "y": 45, "width": 30, "height": 60}, "confidence": 1.7},
              {"name": "Tênis", "category": "shoes_piece", "box": {"x": 10, "y": 90, "width": 1, "height": 5}},
              {"name": "Boné", "category": "accessory_piece"}
            ]}""";

    @Test
    void subtipoDefineOTipoEVocabularioVemDaTaxonomia() {
        List<MultiPieceService.DetectedPiece> ps = MultiPieceService.parseDetections(AI);
        assertThat(ps).hasSize(2);

        MultiPieceService.DetectedPiece shirt = ps.get(0);
        assertThat(shirt.index()).isZero();
        assertThat(shirt.name()).isEqualTo("Camiseta branca lisa");
        // "t_shirt" é peça de cima: o subtipo manda no tipo, não o "lower_piece" que a IA escreveu
        assertThat(shirt.category()).isEqualTo("upper_piece");
        assertThat(shirt.subcategory()).isEqualTo("t_shirt");
        assertThat(shirt.material()).isEqualTo("COTTON");
        assertThat(shirt.style()).hasSizeLessThanOrEqualTo(Taxonomy.MAX_PIECE_TAGS).doesNotContain("not_a_style");
        assertThat(shirt.occasion()).containsExactly("casual");
        assertThat(shirt.box()).isEqualTo(new MultiPieceService.Box(20, 10, 50, 35));
        assertThat(shirt.confidence()).isEqualTo(0.93);
    }

    @Test
    void foraDaTaxonomiaFicaVazioECaixaEPresaNaFoto() {
        MultiPieceService.DetectedPiece jeans = MultiPieceService.parseDetections(AI).get(1);
        assertThat(jeans.index()).isEqualTo(1);
        assertThat(jeans.category()).isEqualTo("lower_piece");
        assertThat(jeans.subcategory()).isNull();
        assertThat(jeans.color()).isNull();
        assertThat(jeans.material()).isNull();
        // x 90 + largura 30 passaria da borda: a caixa termina em 100
        assertThat(jeans.box()).isEqualTo(new MultiPieceService.Box(90, 45, 10, 55));
        assertThat(jeans.confidence()).isEqualTo(1.0);
    }

    @Test
    void listaVaziaEValidaEJsonIlegivelEFalha() {
        assertThat(MultiPieceService.parseDetections("{\"pieces\": []}")).isEmpty();
        assertThat(MultiPieceService.parseDetections("não achei nada")).isNull();
        assertThat(MultiPieceService.parseDetections("{\"outra\": 1}")).isNull();
    }

    @Test
    void semIaUmaPecaCobreAFotoInteira() {
        MultiPieceService.DetectedPiece p = MultiPieceService.localPiece();
        assertThat(p.box()).isEqualTo(new MultiPieceService.Box(0, 0, 100, 100));
        assertThat(p.category()).isNull();
    }

    @Test
    void localRegionsHaveIndependentColorsWithoutInventingGarmentMetadata() {
        var photo = new BufferedImage(800, 600, BufferedImage.TYPE_INT_RGB);
        var g = photo.createGraphics();
        g.setColor(new Color(190, 180, 165)); g.fillRect(0, 0, 800, 600);
        int[] rgb = {0x141414, 0xFFFFFF, 0x1B2A4A, 0x6B1220, 0x6E7A3C};
        int[] x = {45, 305, 565, 150, 430}, y = {40, 40, 40, 325, 325};
        for (int i = 0; i < rgb.length; i++) {
            g.setColor(new Color(rgb[i])); g.fillRect(x[i], y[i], 180, 220);
        }
        g.dispose();
        var pieces = MultiPieceService.localPieces(photo);
        assertThat(pieces).hasSize(5);
        assertThat(pieces).extracting(MultiPieceService.DetectedPiece::color)
                .containsExactly("black", "white", "navy", "burgundy", "olive");
        for (int i = 0; i < pieces.size(); i++) {
            var piece = pieces.get(i);
            assertThat(piece.index()).isEqualTo(i);
            assertThat(piece.name()).isNull();
            assertThat(piece.category()).isNull();
            assertThat(piece.subcategory()).isNull();
            assertThat(piece.material()).isNull();
            assertThat(piece.brandName()).isNull();
            assertThat(piece.sex()).isNull();
            assertThat(piece.style()).isEmpty();
            assertThat(piece.occasion()).isEmpty();
            assertThat(piece.confidence()).isLessThan(LocalVision.PREFILL_CONFIDENCE);
        }
    }

    @Test
    void brandEvidenceBelongsToEachGarmentAndMissingEvidenceStaysEmpty() {
        var pieces = MultiPieceService.parseDetections("""
                {"pieces": [
                  {"name": "Gorro", "category": "accessory_piece", "brandName": "Adidas",
                   "box": {"x": 10, "y": 10, "width": 25, "height": 20}},
                  {"name": "Camiseta", "category": "upper_piece", "brandName": "Nike",
                   "box": {"x": 35, "y": 30, "width": 50, "height": 60}},
                  {"name": "Calça", "category": "lower_piece",
                   "box": {"x": 10, "y": 30, "width": 20, "height": 60}},
                  {"name": "Outra camiseta", "category": "upper_piece", "brandName": "  ",
                   "box": {"x": 65, "y": 10, "width": 20, "height": 20}}
                ]}
                """);
        assertThat(pieces).hasSize(4);
        assertThat(pieces.get(0).brandName()).isEqualTo("Adidas");
        assertThat(pieces.get(1).brandName()).isEqualTo("Nike");
        assertThat(pieces.get(2).brandName()).isNull();
        assertThat(pieces.get(3).brandName()).isNull();
        assertThat(MultiPieceService.localPiece().brandName()).isNull();
    }

    @Test
    void logoCloseupsMergeByIndexWithoutOverwritingOrLeakingBrands() {
        var pieces = MultiPieceService.parseDetections("""
            {"pieces":[
              {"name":"Calça","brand":"Adidas","box":{"x":10,"y":10,"width":30,"height":70}},
              {"name":"Tênis","box":{"x":40,"y":80,"width":30,"height":15}},
              {"name":"Camisa","brandName":"unknown","box":{"x":50,"y":10,"width":40,"height":60}}
            ]}
            """);
        var brands = MultiPieceService.parseBrands("""
            {"brands":[{"index":1,"brandName":"Nike"},{"index":0,"brandName":"Puma"},
                       {"index":2,"brandName":null},{"index":999,"brandName":"Gucci"}]}
            """);
        var merged = MultiPieceService.mergeBrands(pieces, brands);
        assertThat(merged).extracting(MultiPieceService.DetectedPiece::brandName).containsExactly("Adidas", "Nike", null);
        assertThat(merged.get(1).box()).isEqualTo(pieces.get(1).box());
    }

    @Test
    void promptDaCopiaPorIaUsaSoOQueEValidoEMantemAPeca() {
        String p = MultiPieceService.recreatePrompt("Camiseta \"branca\" lisa", "upper_piece", "white");
        assertThat(p).contains("Camiseta 'branca' lisa").contains("upper piece").contains("Main color: white")
                .contains("Keep exactly the same colors").contains("No person");
        String semDica = MultiPieceService.recreatePrompt(null, "not_a_category", "roxo-inventado");
        assertThat(semDica).doesNotContain("Type:").doesNotContain("Main color").doesNotContain("The item is");
    }
}
