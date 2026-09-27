package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.BrandRegions;
import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.imaging.PhotoAcceptance;
import br.com.fashionai.application.imaging.SubtypeReferences;
import br.com.fashionai.application.taxonomy.Taxonomy;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * RF4 — análise da foto: resposta da IA validada pela taxonomia (tipo escolhido manda no subtipo; ocasião/estilo só da
 * lista), marca lida nas zonas, recusa com os critérios e o pré-preenchimento que nunca mais derruba o cadastro.
 */
class WardrobeAnalysisTest {
    static final String AI = """
            {"name": "Camisa polo azul", "matchesCategory": true, "detectedCategory": "upper_piece",
             "category": "lower_piece", "subcategory": "jeans",
             "subcategoryRanking": [{"code": "polo_shirt", "similarity": 0.91}, {"code": "jeans", "similarity": 0.4}, {"code": "t_shirt", "similarity": 0.8}],
             "color": "navy", "material": "COTTON", "sex": "MASCULINO",
             "occasion": ["casual", "casual", "not_a_code", "beach"], "style": ["casual", "basic", "preppy", "sporty"],
             "brand": "Lacoste", "brandZone": "peito_esquerdo", "brandEvidence": "jacaré bordado no peito",
             "photo": {"fullyVisible": true, "viewAngle": "frontal_90", "singlePiece": true},
             "confidence": {"category": 0.95, "subcategory": 0.9, "color": 0.9, "material": 0.7, "brand": 0.85, "photo": 0.9},
             "logo": {"visible": true, "box": [560, 300, 640, 360]}}""";

    @Test
    void tipoEscolhidoMandaNoSubtipoEVocabularioVemDaTaxonomia() {
        LocalVision.PieceGuess g = WardrobeService.parseAnalysis(AI, "upper_piece");
        assertThat(g.category()).isEqualTo("upper_piece");
        // "jeans" não é peça de cima: vale o primeiro do ranking que é do tipo escolhido
        assertThat(g.subcategory()).isEqualTo("polo_shirt");
        assertThat(g.insights().ranking()).extracting(SubtypeReferences.Match::subcategory).containsExactly("polo_shirt", "t_shirt");
        assertThat(g.insights().occasion()).containsExactly("casual", "beach");
        // "casual" é ocasião, não estilo: sai; no máximo 2
        assertThat(g.insights().style()).containsExactly("basic", "preppy");
        assertThat(g.brand()).isEqualTo("Lacoste");
        assertThat(g.insights().brandZone()).isEqualTo("peito_esquerdo");
        assertThat(g.insights().matchesCategory()).isTrue();
        assertThat(g.insights().viewAngle()).isEqualTo("frontal_90");
        assertThat(g.insights().photoConfidence()).isEqualTo(0.9);
        assertThat(g.confidence()).doesNotContainKey("photo");
        assertThat(g.logoBox()).containsExactly(560, 300, 640, 360);
    }

    /**
     * Resposta com campos nulos/ausentes (material, sexo, código do ranking) era lida como falha do provedor (NPE em
     * List.of(...).contains(null)) e a análise caía no motor local — a marca lida pela IA se perdia.
     */
    @Test
    void respostaComCamposNulosNaoDerrubaOParser() {
        LocalVision.PieceGuess g = WardrobeService.parseAnalysis("""
                {"subcategory": "t_shirt", "material": null, "sex": null, "color": null,
                 "subcategoryRanking": [{"code": null}, {"similarity": 0.5}], "brand": "Adidas", "confidence": {"brand": 0.9}}""", null);
        assertThat(g).isNotNull();
        assertThat(g.brand()).isEqualTo("Adidas");
        assertThat(g.material()).isNull();
        assertThat(g.category()).isEqualTo("upper_piece");
        assertThat(Taxonomy.categoryOf(null)).isNull();
    }

    @Test
    void marcaQueNaoEhMarcaVoltaNula() {
        assertThat(WardrobeService.brandName("null")).isNull();
        assertThat(WardrobeService.brandName("Sem marca")).isNull();
        assertThat(WardrobeService.brandName("  ")).isNull();
        assertThat(WardrobeService.brandName(" Nike ")).isEqualTo("Nike");
        assertThat(WardrobeService.isNoBrandPlaceholder("No brand")).isTrue();
        assertThat(WardrobeService.isNoBrandPlaceholder("Sin marca")).isTrue();
        assertThat(WardrobeService.isNoBrandPlaceholder("Zara")).isFalse();
    }

    @Test
    void preenchimentoUsaOcasiaoEEstiloDaIaQuandoValem() {
        WardrobeService.Prefill p = WardrobeService.prefill(WardrobeService.parseAnalysis(AI, "upper_piece"), null);
        assertThat(p.name()).isEqualTo("Camisa polo azul");
        assertThat(p.occasion()).containsExactly("casual", "beach");
        assertThat(p.style()).containsExactly("basic", "preppy");
        assertThat(p.brand()).isEqualTo("Lacoste");
    }

    /**
     * Regressão do "erro nas listas de estilo e ocasião" ao salvar: o pré-preenchimento mandava estilo "casual" (que é
     * ocasião) para quase toda peça. Para TODO subtipo da taxonomia, o que a análise preenche passa na validação do
     * cadastro — com a IA sem reconhecer nada e com a IA sugerindo códigos inválidos.
     */
    @Test
    void preenchimentoDeQualquerSubtipoPassaNaValidacaoDoCadastro() {
        LocalVision.Insights junk = new LocalVision.Insights(null, List.of("xyz", "gym"), List.of("casual", "Chic"), null, null,
                null, null, null, null, null, 0, List.of());
        for (Map.Entry<String, List<String>> e : Taxonomy.SUBCATEGORIES.entrySet()) {
            for (String sub : e.getValue()) {
                for (LocalVision.Insights seen : List.of(LocalVision.Insights.NONE, junk)) {
                    LocalVision.PieceGuess g = new LocalVision.PieceGuess(e.getKey(), sub, null, null, null, null,
                            Map.of("category", 0.9, "subcategory", 0.9), 0.9, List.of(), null, seen);
                    WardrobeService.Prefill p = WardrobeService.prefill(g, null);
                    assertThatCode(() -> Taxonomy.requirePiece(p.category(), p.subcategory(), p.sex(), p.color(), p.material(), p.size(),
                            p.occasion(), p.style())).as(sub).doesNotThrowAnyException();
                }
            }
        }
    }

    @Test
    void cadastroNormalizaAsListasQueATelaManda() {
        WardrobeService.PieceForm f = new WardrobeService.PieceForm(null, true, "Camiseta", "upper_piece", "t_shirt", "UNISSEX", null,
                null, "black", "COTTON", "m", null, List.of(" Casual ", "casual", ""), List.of("BASIC"), List.of(), BigDecimal.TEN,
                null, List.of(), null, null, null, null, null, null, false, null, null, null, null, null);
        assertThat(f.occasion()).containsExactly("casual");
        assertThat(f.style()).containsExactly("basic");
        assertThatCode(() -> Taxonomy.requirePiece(f.category(), f.subcategory(), f.sex(), f.color(), f.material(), f.size(),
                f.occasion(), f.style())).doesNotThrowAnyException();
    }

    @Test
    void promptDizOQueECadaImagemNaOrdem() {
        List<BrandRegions.Zone> zones = BrandRegions.TOP_ZONES.stream().map(id -> new BrandRegions.Zone(id, new double[]{0, 0, 1, 1})).toList();
        String p = WardrobeService.analyzerPrompt("upper_piece", List.of("1 = t_shirt", "2 = shirt"), zones,
                List.of(new SubtypeReferences.Match("t_shirt", 0.93)));
        assertThat(p).contains("Tipo escolhido pela pessoa: upper_piece")
                .contains("1 = peça inteira; 2 = folha de referências (1 = t_shirt, 2 = shirt); 3 = zona de marca \"gola\"; "
                        + "4 = zona de marca \"peito_esquerdo\"; 5 = zona de marca \"peito_direito\"; 6 = zona de marca \"centro_peito\"")
                .contains("t_shirt 0.93")
                .doesNotContain("jeans");                       // só os subtipos do tipo escolhido
    }

    @Test
    void semIaOSubtipoEOMaisParecidoDaCategoria() {
        LocalVision.PieceGuess base = new LocalVision.PieceGuess("upper_piece", "t_shirt", "blue", null, null, null,
                Map.of("category", 0.4, "subcategory", 0.3, "color", 0.8), 0.5, List.of("blue"), null);
        LocalVision.PieceGuess g = WardrobeService.localGuess(base, "lower_piece", List.of(
                new SubtypeReferences.Match("t_shirt", 0.97), new SubtypeReferences.Match("jeans", 0.93), new SubtypeReferences.Match("skirt", 0.8)));
        assertThat(g.category()).isEqualTo("lower_piece");
        assertThat(g.subcategory()).isEqualTo("jeans");
        assertThat(g.confidence().get("category")).isEqualTo(1.0);
        assertThat(WardrobeService.candidates(g.insights().ranking(), "lower_piece")).extracting(m -> m.get("code")).containsExactly("jeans", "skirt");
    }

    @Test
    void recusaTrazAPrimeiraOrientacaoETodosOsCriterios() {
        ApiException e = WardrobeService.rejection(List.of(
                new PhotoAcceptance.Check("fundo", true, 0.9, 0.45, null),
                new PhotoAcceptance.Check("inteira", false, 1, 0, "a peça foi cortada pela borda da foto (embaixo).")));
        assertThat(e.status()).isEqualTo(422);
        assertThat(e.code()).isEqualTo("FOTO_RECUSADA");
        assertThat(e.getMessage()).startsWith("Foto recusada: a peça foi cortada");
        assertThat(e.details()).containsEntry("failed", List.of("inteira"));
        WardrobeService.Draft d = WardrobeService.Draft.rejected(e);
        assertThat(d.draftId()).isNull();
        assertThat(d.rejection()).containsEntry("code", "FOTO_RECUSADA");
    }
}
