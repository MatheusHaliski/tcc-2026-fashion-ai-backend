package br.com.fashionai.application.service;

import br.com.fashionai.application.taxonomy.Taxonomy;
import org.junit.jupiter.api.Test;

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
    void promptDaCopiaPorIaUsaSoOQueEValidoEMantemAPeca() {
        String p = MultiPieceService.recreatePrompt("Camiseta \"branca\" lisa", "upper_piece", "white");
        assertThat(p).contains("Camiseta 'branca' lisa").contains("upper piece").contains("Main color: white")
                .contains("Keep exactly the same colors").contains("No person");
        String semDica = MultiPieceService.recreatePrompt(null, "not_a_category", "roxo-inventado");
        assertThat(semDica).doesNotContain("Type:").doesNotContain("Main color").doesNotContain("The item is");
    }
}
