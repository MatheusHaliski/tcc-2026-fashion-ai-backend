package br.com.fashionai.application.service;

import br.com.fashionai.application.imaging.BrandReader;
import br.com.fashionai.application.imaging.BrandRegions;
import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.imaging.PhotoAcceptance;
import br.com.fashionai.application.imaging.SubtypeReferences;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.taxonomy.TaxonomyRegistry;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** RF4 — leitura das respostas da IA e regras puras do pré-preenchimento (sem banco nem rede). */
class WardrobeServiceParsersTest {

    static LocalVision.PieceGuess guess(String category, String sub, String brand, Map<String, Double> conf, LocalVision.Insights in) {
        return new LocalVision.PieceGuess(category, sub, "white", "COTTON", brand, "UNISSEX", conf, 0.8, List.of("white"), null, in);
    }

    static LocalVision.Insights insights(String brandZone, String evidence) {
        return new LocalVision.Insights(null, List.of(), List.of(), brandZone, evidence, null, null, null, null, null, 0, List.of());
    }

    @Test
    void recusaUsaAPrimeiraOrientacaoReprovada() {
        var checks = List.of(new PhotoAcceptance.Check("fundo", true, 1, 0.5, "ok"),
                new PhotoAcceptance.Check("inteira", false, 0.2, 0.5, "mostre a peça inteira"));
        var e = DraftEvidence.rejection(checks);
        assertThat(e.getMessage()).contains("mostre a peça inteira");
        var e2 = DraftEvidence.rejection(List.of(new PhotoAcceptance.Check("fundo", true, 1, 0.5, "ok")), "lower_piece");
        assertThat(e2.getMessage()).isNotBlank();
    }

    @Test
    void palpiteLocalEscolheOSubtipoMaisParecidoDaCategoria() {
        var base = guess(null, "jeans", null, Map.of("subcategory", 0.3, "color", 0.9), null);
        var ranking = List.of(new SubtypeReferences.Match("jeans", 0.95), new SubtypeReferences.Match("t_shirt", 0.9),
                new SubtypeReferences.Match("shirt", 0.7));
        var g = DraftEvidence.localGuess(base, "upper_piece", ranking);
        assertThat(g.category()).isEqualTo("upper_piece");
        assertThat(g.subcategory()).isEqualTo("t_shirt");
        assertThat(g.confidence().get("category")).isEqualTo(1.0);
        assertThat(g.insights().ranking()).extracting(SubtypeReferences.Match::subcategory).containsExactly("t_shirt", "shirt");

        // só um candidato da categoria: folga padrão
        var um = DraftEvidence.localGuess(base, "upper_piece", List.of(new SubtypeReferences.Match("t_shirt", 0.8)));
        assertThat(um.subcategory()).isEqualTo("t_shirt");
        assertThat(um.confidence().get("subcategory")).isEqualTo(0.54);
    }

    @Test
    void palpiteLocalSemRankingCaiNoPrimeiroSubtipoDoTipoEscolhido() {
        var base = guess("lower_piece", "jeans", null, Map.of("category", 0.4), null);
        var g = DraftEvidence.localGuess(base, "upper_piece", List.of());
        assertThat(g.subcategory()).isEqualTo(Taxonomy.SUBCATEGORIES.get("upper_piece").get(0));
        assertThat(g.confidence().get("subcategory")).isEqualTo(0.2);

        // sem tipo escolhido: mantém o da análise local e a confiança dela
        var livre = DraftEvidence.localGuess(base, null, List.of(new SubtypeReferences.Match("t_shirt", 0.9)));
        assertThat(livre.category()).isEqualTo("lower_piece");
        assertThat(livre.subcategory()).isEqualTo("jeans");
        assertThat(livre.confidence().get("category")).isEqualTo(0.4);

        // subtipo da análise já é do tipo escolhido: fica
        var mesmo = DraftEvidence.localGuess(guess(null, "shirt", null, Map.of(), null), "upper_piece", List.of());
        assertThat(mesmo.subcategory()).isEqualTo("shirt");
    }

    @Test
    void candidatosSoDaCategoriaEAteTres() {
        var ranking = List.of(new SubtypeReferences.Match("t_shirt", 0.9), new SubtypeReferences.Match("jeans", 0.8),
                new SubtypeReferences.Match("shirt", 0.7), new SubtypeReferences.Match("hoodie", 0.6), new SubtypeReferences.Match("blazer", 0.5));
        assertThat(DraftEvidence.candidates(ranking, "upper_piece")).extracting(m -> m.get("code"))
                .containsExactly("t_shirt", "shirt", "hoodie");
        assertThat(DraftEvidence.candidates(ranking, null)).hasSize(3);
        assertThat(DraftEvidence.candidates(ranking, "inexistente")).isEmpty();
    }

    @Test
    void buscaDaMarcaUsaAZonaDaIaOuADoLogo() {
        var zones = List.of(new BrandRegions.Zone("gola", new double[]{0, 0, 1, 0.3}), new BrandRegions.Zone("peito", new double[]{0, 0.3, 1, 1}));
        var naGola = DraftEvidence.brandSearch(zones, guess("upper_piece", "t_shirt", "Nike", Map.of(), insights("gola", "NIKE bordado")), null, "ia");
        assertThat(naGola).containsEntry("brand", "Nike").containsEntry("foundIn", "gola").containsEntry("evidence", "NIKE bordado")
                .containsEntry("logoSource", "ia");
        assertThat(naGola.get("zones")).isEqualTo(List.of("gola", "peito"));

        // zona da IA desconhecida: vale a zona onde está o logo
        var peloLogo = DraftEvidence.brandSearch(zones, guess("upper_piece", "t_shirt", " ", Map.of(), insights("outra", null)),
                new double[]{0.4, 0.5, 0.6, 0.7}, "local");
        assertThat(peloLogo).containsEntry("brand", null).containsEntry("foundIn", "peito");

        // sem marca e sem logo: não achou em lugar nenhum
        var nada = DraftEvidence.brandSearch(zones, guess("upper_piece", "t_shirt", null, Map.of(), insights(null, null)), null, null);
        assertThat(nada).containsEntry("foundIn", null);
    }

    @Test
    void ocrConfirmadoViraMarcaENaoConfirmadoViraSugestao() {
        var zones = List.of(new BrandRegions.Zone("peito", new double[]{0, 0, 1, 1}));
        Map<String, Object> bs = new LinkedHashMap<>();
        DraftEvidence.applyOcr(bs, new BrandReader.Found("Adidas", "peito", "ADIDAS", 0.9, true, new double[]{0.1, 0.1, 0.2, 0.2}), zones);
        assertThat(bs).containsEntry("brand", "Adidas").containsEntry("foundIn", "peito").containsEntry("logoSource", "ocr")
                .containsEntry("certainty", "confirmada");

        Map<String, Object> sug = new LinkedHashMap<>();
        DraftEvidence.applyOcr(sug, new BrandReader.Found("Puma", "fora", "PUM", 0.4, false, new double[]{2, 2, 3, 3}), zones);
        assertThat(sug).containsEntry("suggestion", "Puma").containsEntry("foundIn", "fora").containsEntry("certainty", "possivel")
                .doesNotContainKey("brand");

        Map<String, Object> jaAchou = new LinkedHashMap<>(Map.of("foundIn", "gola"));
        DraftEvidence.applyOcr(jaAchou, new BrandReader.Found("Puma", "peito", "PUM", 0.4, false, new double[]{0.1, 0.1, 0.2, 0.2}), zones);
        assertThat(jaAchou).containsEntry("foundIn", "gola");
    }

    @Test
    void caixaDoLogoGuardadaSoComQuatroNumeros() {
        assertThat(AiResponseJson.boxOf(Map.of("box", List.of(1, 2, 3.5, 4)))).containsExactly(1, 2, 3.5, 4);
        assertThat(AiResponseJson.boxOf(Map.of("box", List.of(1, 2, 3)))).isNull();
        assertThat(AiResponseJson.boxOf(Map.of("box", List.of(1, "x", 3, 4)))).isNull();
        assertThat(AiResponseJson.boxOf("nada")).isNull();
    }

    @Test
    void respostaDosRecortesDescartaMarcaFraca() {
        assertThat(PieceAnalysisParser.parseBrandTiles("sem json")).isNull();
        assertThat(PieceAnalysisParser.parseBrandTiles("{\"brand\":\"Nike\",\"image\":2,\"confidence\":0.9}")).containsEntry("brand", "Nike")
                .containsEntry("image", 2);
        assertThat(PieceAnalysisParser.parseBrandTiles("{\"brand\":\"Nike\",\"confidence\":0.3}")).containsEntry("brand", null);
        assertThat(PieceAnalysisParser.parseBrandTiles("{\"brand\":\"Lacoste\"}")).containsEntry("brand", "Lacoste");
        assertThat(PieceAnalysisParser.parseBrandTiles("{\"brand\":\"none\"}")).containsEntry("brand", null);
    }

    @Test
    void mensagemDoAnalisadorDescreveTipoImagensERanking() {
        var zones = List.of(new BrandRegions.Zone("gola", new double[]{0, 0, 1, 1}));
        String p = PieceAnalyzerPrompts.analyzerPrompt("upper_piece", List.of("1 t_shirt", "2 shirt"), zones,
                List.of(new SubtypeReferences.Match("t_shirt", 0.9)));
        assertThat(p).contains("Tipo escolhido pela pessoa: upper_piece").contains("folha de referências (1 t_shirt, 2 shirt)")
                .contains("zona de marca \"gola\"").contains("Similaridade de silhueta").contains("t_shirt 0.9")
                .contains("Modelagens por subtipo");
        String livre = PieceAnalyzerPrompts.analyzerPrompt(null, List.of(), List.of(), List.of());
        assertThat(livre).contains("Tipo não informado").doesNotContain("folha de referências").doesNotContain("Similaridade")
                .doesNotContain("Modelagens por subtipo").endsWith("Analise e responda só com o JSON.");
    }

    @Test
    void vocabularioListaModelagensEDimensoes() {
        String v = PieceAnalyzerPrompts.analyzerVocabulary("upper_piece");
        assertThat(v).startsWith("Modelagens por subtipo").contains("t_shirt: ").contains("Características (dimensão: códigos):");
        assertThat(PieceAnalyzerPrompts.analyzerVocabulary("inexistente")).contains("Modelagens por subtipo (código = nome): .");
    }

    @Test
    void analiseVaziaOuSemJsonNaoViraPalpite() {
        assertThat(PieceAnalysisParser.parseAnalysis(null)).isNull();
        assertThat(PieceAnalysisParser.parseAnalysis("nada aqui")).isNull();
        assertThat(PieceAnalysisParser.parseAnalysis("} {")).isNull();
    }

    @Test
    void analiseComTipoEscolhidoFicaComOSubtipoDoTipo() {
        String json = """
                {"name":"Camiseta branca","matchesCategory":true,"detectedCategory":"upper_piece","category":"lower_piece",
                 "subcategory":"jeans","subcategoryRanking":[{"code":"jeans","similarity":0.9},{"code":"t_shirt","similarity":1.7},
                 {"code":"t_shirt","similarity":0.5},{"code":"xyz","similarity":0.9},"lixo",{"code":"shirt"}],
                 "color":"white","material":"COTTON","sex":"FEMININO","occasion":["casual","inventada"],"style":"basic",
                 "brand":"Nike","brandZone":"gola","brandEvidence":"NIKE","photo":{"fullyVisible":true,"viewAngle":"frontal_90","singlePiece":false},
                 "confidence":{"category":0.9,"subcategory":"alto","photo":0.8},"logo":{"visible":true,"box":[100,100,300,300]}}""";
        var g = PieceAnalysisParser.parseAnalysis(json, "upper_piece");
        assertThat(g.category()).isEqualTo("upper_piece");
        assertThat(g.subcategory()).isEqualTo("t_shirt");
        assertThat(g.color()).isEqualTo("white");
        assertThat(g.sex()).isEqualTo("FEMININO");
        assertThat(g.brand()).isEqualTo("Nike");
        assertThat(g.confidence()).containsEntry("category", 0.9).containsEntry("subcategory", 0.0).doesNotContainKey("photo");
        assertThat(g.overall()).isEqualTo(0.45);
        assertThat(g.logoBox()).containsExactly(100, 100, 300, 300);
        var in = g.insights();
        assertThat(in.name()).isEqualTo("Camiseta branca");
        assertThat(in.matchesCategory()).isTrue();
        assertThat(in.detectedCategory()).isEqualTo("upper_piece");
        assertThat(in.fullyVisible()).isTrue();
        assertThat(in.singlePiece()).isFalse();
        assertThat(in.viewAngle()).isEqualTo("frontal_90");
        assertThat(in.photoConfidence()).isEqualTo(0.8);
        assertThat(in.occasion()).containsExactly("casual");
        assertThat(in.style()).containsExactly("basic");
        assertThat(in.ranking()).extracting(SubtypeReferences.Match::subcategory).containsExactly("t_shirt", "shirt");
        assertThat(in.ranking().get(0).score()).isEqualTo(1.0);
    }

    @Test
    void analiseSemTipoEscolhidoDeduzACategoriaDoSubtipo() {
        var g = PieceAnalysisParser.parseAnalysis("ok {\"subcategory\":\"jeans\",\"color\":\"roxo-inventado\",\"name\":\" \"} fim");
        assertThat(g.category()).isEqualTo("lower_piece");
        assertThat(g.subcategory()).isEqualTo("jeans");
        assertThat(g.color()).isNull();
        assertThat(g.overall()).isEqualTo(0.5);
        assertThat(g.insights().name()).isNull();
        assertThat(g.insights().detectedCategory()).isNull();
        assertThat(g.logoBox()).isNull();

        var soCategoria = PieceAnalysisParser.parseAnalysis("{\"category\":\"shoes_piece\",\"subcategory\":\"nao_existe\"}");
        assertThat(soCategoria.category()).isEqualTo("shoes_piece");
        assertThat(soCategoria.subcategory()).isNull();
        assertThat(soCategoria.insights().detectedCategory()).isEqualTo("shoes_piece");

        var invalida = PieceAnalysisParser.parseAnalysis("{\"category\":\"nave\",\"subcategory\":\"nao_existe\"}");
        assertThat(invalida.category()).isNull();
        assertThat(invalida.subcategory()).isNull();

        // tipo escolhido sem nenhum subtipo válido no ranking: subtipo fica vazio
        var semSub = PieceAnalysisParser.parseAnalysis("{\"subcategory\":\"jeans\"}", "upper_piece");
        assertThat(semSub.subcategory()).isNull();
    }

    @Test
    void variacaoEAtributosSoDoVocabularioEComConfianca() {
        TaxonomyRegistry reg = TaxonomyRegistry.get();
        String sub = "t_shirt";
        String variation = reg.variationsOf(sub).get(0).code();
        String dim = PieceAnalyzerPrompts.ANALYZER_DIMENSIONS.stream().filter(d -> !reg.valuesFor(d, "upper_piece", sub).isEmpty()).findFirst().orElseThrow();
        String code = reg.valuesFor(dim, "upper_piece", sub).get(0).code();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("variation", Map.of("code", variation.toLowerCase(), "confidence", 0.9));
        m.put("attributes", Map.of(dim.toLowerCase(), Map.of("codes", List.of(code.toLowerCase(), "inventado"), "confidence", 0.8),
                "COLOR", Map.of("codes", List.of("x"), "confidence", 1), "PATTERN_X", "nao-mapa"));
        var in = PieceAnalysisParser.withTaxonomy(LocalVision.Insights.NONE, m, "upper_piece", sub);
        assertThat(in.variation()).isEqualTo(variation);
        assertThat(in.variationConfidence()).isEqualTo(0.9);
        assertThat(in.attributes()).containsEntry(dim, List.of(code));

        // confiança baixa: nada entra
        Map<String, Object> fraco = Map.of("variation", Map.of("code", variation, "confidence", 0.2),
                "attributes", Map.of(dim, Map.of("codes", List.of(code), "confidence", 0.5)));
        var f = PieceAnalysisParser.withTaxonomy(LocalVision.Insights.NONE, fraco, "upper_piece", sub);
        assertThat(f.variation()).isNull();
        assertThat(f.attributes()).isEmpty();

        // variação sem confiança informada vale 0
        var semConf = PieceAnalysisParser.withTaxonomy(LocalVision.Insights.NONE, Map.of("variation", Map.of("code", variation)), "upper_piece", sub);
        assertThat(semConf.variation()).isNull();
        assertThat(semConf.variationConfidence()).isZero();

        assertThat(PieceAnalysisParser.withTaxonomy(LocalVision.Insights.NONE, m, null, sub)).isSameAs(LocalVision.Insights.NONE);
        assertThat(PieceAnalysisParser.withTaxonomy(LocalVision.Insights.NONE, m, "upper_piece", null)).isSameAs(LocalVision.Insights.NONE);
    }

    @Test
    void utilitariosDeTextoENumeros() {
        assertThat(WardrobeService.oneOf("a", List.of("a"))).isEqualTo("a");
        assertThat(WardrobeService.oneOf("b", List.of("a"))).isNull();
        assertThat(WardrobeService.oneOf(null, List.of("a"))).isNull();
        assertThat(WardrobeService.brandName(null)).isNull();
        assertThat(WardrobeService.brandName("  ")).isNull();
        assertThat(WardrobeService.brandName("x".repeat(61))).isNull();
        assertThat(WardrobeService.brandName("Unknown")).isNull();
        assertThat(WardrobeService.brandName("sem marca")).isNull();
        assertThat(WardrobeService.brandName(" Osklen ")).isEqualTo("Osklen");
        assertThat(WardrobeService.strings(List.of("a", 1))).containsExactly("a", "1");
        assertThat(WardrobeService.strings("x")).containsExactly("x");
        assertThat(WardrobeService.strings(" ")).isEmpty();
        assertThat(WardrobeService.strings(5)).isEmpty();
        assertThat(PiecePrefill.firstNonBlank(null, " ", "a")).isEqualTo("a");
        assertThat(PiecePrefill.firstNonBlank(null, "")).isNull();
        assertThat(WardrobeService.str(null)).isNull();
        assertThat(WardrobeService.str(" a ")).isEqualTo("a");
        assertThat(WardrobeService.blank(null)).isTrue();
        assertThat(WardrobeService.blank("x")).isFalse();
        assertThat(WardrobeService.contains("Camiseta", "MISE")).isTrue();
        assertThat(WardrobeService.contains(null, "a")).isFalse();
        assertThat(WardrobeService.contains("a", null)).isFalse();
        assertThat(WardrobeService.extractJson(null)).isEmpty();
        assertThat(WardrobeService.extractJson("{\"a\":1}")).containsEntry("a", 1);
        assertThat(WardrobeService.enumMap(String.class)).isEmpty();
        assertThat(WardrobeService.emptyReactions()).isEmpty();
        WardrobeItem semId = new WardrobeItem();
        WardrobeItem comId = new WardrobeItem();
        UUID id = UUID.randomUUID();
        comId.assignId(id);
        assertThat(WardrobeService.ids(List.of(semId, comId))).containsExactly(id);
        var page = WardrobeService.page(-1, 500);
        assertThat(page.getPageNumber()).isZero();
        assertThat(page.getPageSize()).isEqualTo(60);
        assertThat(WardrobeService.page(2, 0).getPageSize()).isEqualTo(1);
        assertThat(WardrobeService.humanize("tank_top")).isEqualTo("Tank top");
        assertThat(WardrobeService.label("t_shirt")).isEqualTo("Camiseta");
        assertThat(WardrobeService.label("codigo_sem_rotulo")).isEqualTo("Codigo sem rotulo");
        assertThat(PiecePrefill.pieceName("t_shirt", "white")).isEqualTo("Camiseta branco");
    }

    @Test
    void caixaDoLogoDaIaValidada() {
        assertThat(AiResponseJson.logoBox(Map.of("visible", true, "box", List.of(-5, 10, 2000, 500)))).containsExactly(0, 10, 1000, 500);
        assertThat(AiResponseJson.logoBox(Map.of("visible", false, "box", List.of(0, 0, 100, 100)))).isNull();
        assertThat(AiResponseJson.logoBox(Map.of("box", List.of(0, 0, 100)))).isNull();
        assertThat(AiResponseJson.logoBox(Map.of("box", List.of(0, "a", 100, 100)))).isNull();
        assertThat(AiResponseJson.logoBox(Map.of("box", List.of(0, 0, 5, 100)))).isNull();
        assertThat(AiResponseJson.logoBox(Map.of("box", List.of(0, 0, 100, 5)))).isNull();
        assertThat(AiResponseJson.logoBox(null)).isNull();
        assertThat(AiResponseJson.logoBox(Map.of("box", "x"))).isNull();
    }

    @Test
    void moderacaoPelaRespostaDaIa() {
        WardrobeService s = new Kit().build(WardrobeService.class);
        assertThat(s.parseModeration("sem json")).isNull();
        assertThat(s.parseModeration("{\"isClothing\":true,\"safe\":false,\"confidence\":0.9,\"categories\":[\"nudity\"]}"))
                .satisfies(v -> {
                    assertThat(v.status()).isEqualTo(ModerationStatus.REJECTED_POLICY);
                    assertThat(v.reasons()).containsExactly("nudity");
                    assertThat(v.needsHumanReview()).isTrue();
                });
        var duvida = s.parseModeration("{\"isClothing\":true,\"safe\":false,\"confidence\":0.5}");
        assertThat(duvida.status()).isEqualTo(ModerationStatus.PENDING);
        assertThat(duvida.reasons()).hasSize(1);
        assertThat(s.parseModeration("{\"isClothing\":false,\"safe\":true,\"confidence\":0.95}").status())
                .isEqualTo(ModerationStatus.REJECTED_NOT_CLOTHING);
        assertThat(s.parseModeration("{\"isClothing\":false,\"safe\":true}").status()).isEqualTo(ModerationStatus.PENDING);
        var ok = s.parseModeration("{\"isClothing\":true,\"safe\":true,\"confidence\":0.7}");
        assertThat(ok.status()).isEqualTo(ModerationStatus.APPROVED);
        assertThat(ok.needsHumanReview()).isFalse();
        var incerto = s.parseModeration("{\"isClothing\":true,\"safe\":true,\"confidence\":0.4}");
        assertThat(incerto.status()).isEqualTo(ModerationStatus.PENDING);
        assertThat(incerto.needsHumanReview()).isTrue();
    }

    @Test
    void preenchimentoComConfiancaAltaUsaOQueAIaViu() {
        var in = new LocalVision.Insights("Camiseta Nike", List.of("party"), List.of("sporty"), null, null, null, null, null, null, null, 0, List.of());
        var g = new LocalVision.PieceGuess("upper_piece", "t_shirt", "navy", "POLYESTER", "Nike", "MASCULINO",
                Map.of("category", 0.9, "subcategory", 0.9, "color", 0.9, "material", 0.9, "brand", 0.9), 0.9, List.of(), null, in);
        var p = PiecePrefill.prefill(g, Map.of("box", List.of(1, 2, 3, 4)));
        assertThat(p.name()).isEqualTo("Camiseta Nike");
        assertThat(p.category()).isEqualTo("upper_piece");
        assertThat(p.subcategory()).isEqualTo("t_shirt");
        assertThat(p.color()).isEqualTo("navy");
        assertThat(p.material()).isEqualTo("POLYESTER");
        assertThat(p.brand()).isEqualTo("Nike");
        assertThat(p.sex()).isEqualTo("MASCULINO");
        assertThat(p.occasion()).containsExactly("party");
        assertThat(p.style()).containsExactly("sporty");
        assertThat(p.manualFillRequired()).isFalse();
        assertThat(p.warning()).isNull();
        assertThat(p.price()).isEqualByComparingTo("79");
        assertThat(p.size()).isEqualTo("m");
        assertThat(p.subcategoryCandidates()).isEmpty();
        assertThat(p.variation()).isNull();
        assertThat(p.variationConfidence()).isNull();
    }

    @Test
    void preenchimentoSemConfiancaCaiNosPadroes() {
        var g = new LocalVision.PieceGuess(null, null, null, null, null, "ALIEN", null, 0.1, List.of(), null);
        var p = PiecePrefill.prefill(g, null, null, null, null);
        assertThat(p.category()).isEqualTo("upper_piece");
        assertThat(p.subcategory()).isEqualTo(Taxonomy.SUBCATEGORIES.get("upper_piece").get(0));
        assertThat(p.color()).isEqualTo("black");
        assertThat(p.brand()).isEqualTo("Sem marca");
        assertThat(p.sex()).isEqualTo("UNISSEX");
        assertThat(p.occasion()).containsExactly(Taxonomy.allowedOccasions("upper_piece").get(0));
        assertThat(p.style()).hasSize(1);
        assertThat(p.manualFillRequired()).isTrue();
        assertThat(p.warning()).isNotBlank();
        assertThat(p.subcategoryCandidates()).isEmpty();
        assertThat(p.photoChecks()).isEmpty();

        // cor da paleta quando a IA não deu; cor fora da paleta vira preto; subtipo de outra categoria é trocado
        var pal = new LocalVision.PieceGuess("lower_piece", "t_shirt", null, null, null, null, Map.of(), 0.3, List.of("blue"), null);
        var pp = PiecePrefill.prefill(pal, null);
        assertThat(pp.color()).isEqualTo("blue");
        assertThat(pp.subcategory()).isEqualTo(Taxonomy.SUBCATEGORIES.get("lower_piece").get(0));
        var fora = new LocalVision.PieceGuess(null, "jeans", "furta-cor", null, null, null, Map.of(), 0.3, null, null);
        var pf = PiecePrefill.prefill(fora, null);
        assertThat(pf.category()).isEqualTo("lower_piece");
        assertThat(pf.color()).isEqualTo("black");
    }

    @Test
    void estiloMaterialEPrecoPadraoPorTipo() {
        assertThat(PiecePrefill.defaultStyle("hoodie")).isEqualTo("sporty");
        assertThat(PiecePrefill.defaultStyle("cargo_pants")).isEqualTo("streetwear");
        assertThat(PiecePrefill.defaultStyle("blazer")).isEqualTo("classic");
        assertThat(PiecePrefill.defaultStyle("t_shirt")).isEqualTo("basic");

        assertThat(PiecePrefill.defaultMaterial("shoes_piece", "sandals")).isEqualTo("SYNTHETIC");
        assertThat(PiecePrefill.defaultMaterial("shoes_piece", "boots")).isEqualTo("LEATHER");
        assertThat(PiecePrefill.defaultMaterial("accessory_piece", "cap")).isEqualTo("COTTON");
        assertThat(PiecePrefill.defaultMaterial("accessory_piece", "watch")).isEqualTo("SYNTHETIC");
        assertThat(PiecePrefill.defaultMaterial("lower_piece", "jeans")).isEqualTo("COTTON");
        assertThat(PiecePrefill.defaultMaterial("upper_piece", "coat")).isEqualTo("WOOL");
        assertThat(PiecePrefill.defaultMaterial("upper_piece", "blazer")).isEqualTo("POLYESTER");
        assertThat(PiecePrefill.defaultMaterial("upper_piece", "t_shirt")).isEqualTo("COTTON");

        assertThat(PiecePrefill.estimatedPrice("upper_piece", "blazer")).isEqualByComparingTo("349");
        assertThat(PiecePrefill.estimatedPrice("lower_piece", "x")).isEqualByComparingTo("169");
        assertThat(PiecePrefill.estimatedPrice("shoes_piece", "x")).isEqualByComparingTo("249");
        assertThat(PiecePrefill.estimatedPrice("accessory_piece", "x")).isEqualByComparingTo("99");
        assertThat(PiecePrefill.estimatedPrice("full_body_piece", "x")).isEqualByComparingTo("229");
        assertThat(PiecePrefill.estimatedPrice("upper_piece", "x")).isEqualByComparingTo("129");
    }

    @Test
    void filtroDeSeloAceitaSinonimos() {
        assertThat(WardrobeService.sealFilter(null)).isNull();
        assertThat(WardrobeService.sealFilter(" HYPE ")).isEqualTo("hype");
        assertThat(WardrobeService.sealFilter("celebridade")).isEqualTo("brand");
        assertThat(WardrobeService.sealFilter("qualquer")).isEqualTo("any");
        assertThat(WardrobeService.sealFilter("outro")).isNull();
        WardrobeItem w = new WardrobeItem();
        w.setForDonation(true);
        assertThat(WardrobeService.stateMatches(w, "todos")).isTrue();
        assertThat(WardrobeService.stateMatches(w, "donation")).isTrue();
        assertThat(WardrobeService.stateMatches(w, "desconhecido")).isTrue();
    }

    @Test
    void tipoDoEstudioPorCategoria() {
        assertThat(PieceStudioHints.studioKind(null, null)).isNull();
        assertThat(PieceStudioHints.studioKind("upper_piece", "coat")).isEqualTo("OUTERWEAR");
        assertThat(PieceStudioHints.studioKind("upper_piece", "t_shirt")).isEqualTo("TOP");
        assertThat(PieceStudioHints.studioKind("lower_piece", "jeans")).isEqualTo("BOTTOM");
        assertThat(PieceStudioHints.studioKind("shoes_piece", "boots")).isEqualTo("SHOES");
        assertThat(PieceStudioHints.studioKind("full_body_piece", "dress")).isEqualTo("FULL_BODY");
        assertThat(PieceStudioHints.studioKind("accessory_piece", "cap")).isEqualTo("ACCESSORY");
        assertThat(PieceStudioHints.studioKind("outro", "x")).isNull();
    }

    @Test
    void caixaDoLogoRelativaAPeca() {
        assertThat(DraftEvidence.logoRelative(null, 100, 100)).isNull();
        assertThat(DraftEvidence.logoRelative(new double[]{0, 0, 1000, 1000}, 0, 100)).isNull();
        assertThat(DraftEvidence.logoRelative(new double[]{0, 0, 1000, 1000}, 100, -1)).isNull();
        double[] full = DraftEvidence.logoRelative(new double[]{0, 0, 1000, 1000}, 100, 100);
        assertThat(full).containsExactly(0, 0, 1, 1);
        double[] meio = DraftEvidence.logoRelative(new double[]{400, 400, 600, 600}, 200, 100);
        assertThat(meio[0]).isBetween(0.3, 0.45);
        assertThat(DraftEvidence.logoRelative(new double[]{500, 500, 501, 501}, 100, 100)).isNull();
    }

    @Test
    void dicasDoEstudioComLadosCortadosELogo() {
        var h = PieceStudioHints.studioHints("upper_piece", "t_shirt", List.of("top", "left"), Map.of("box", List.of(0.1, 0.1, 0.2, 0.2)));
        assertThat(h.toString()).contains("TOP").contains("ia");
        var semNada = PieceStudioHints.studioHints("lower_piece", "jeans", "x", Map.of("box", List.of(0.1, "a", 0.2, 0.2)));
        assertThat(semNada.toString()).contains("BOTTOM").doesNotContain("ia,");
        var outro = PieceStudioHints.studioHints("lower_piece", "jeans", null, Map.of("box", List.of(1, 2)));
        assertThat(outro.toString()).contains("BOTTOM");
    }

    @Test
    void versoesDoEstudio() {
        WardrobeItem w = new WardrobeItem();
        assertThat(WardrobeService.studioMeta(Map.of())).isNull();
        assertThat(WardrobeService.studioMeta(Map.of("studio", Map.of("version", 2)))).containsEntry("version", 2);
        assertThat(WardrobeService.studioVersion(Map.of("version", 3), w)).isEqualTo(3);
        assertThat(WardrobeService.studioVersion(null, w)).isZero();
        assertThat(WardrobeService.studioApproved(null, w)).isFalse();
        w.setStudioImageUrl("/s.jpg");
        assertThat(WardrobeService.studioVersion(Map.of(), w)).isEqualTo(1);
        assertThat(WardrobeService.studioApproved(null, w)).isTrue();
        assertThat(WardrobeService.studioApproved(Map.of("approved", false), w)).isFalse();
        assertThat(WardrobeService.studioApproved(Map.of("approved", true), w)).isTrue();
        Map<String, Object> info = new LinkedHashMap<>(Map.of("url", "/a.jpg", "provider", 7, "ghost", true));
        var s = WardrobeService.studioSummary(info, 2, true);
        assertThat(s).containsEntry("url", "/a.jpg").containsEntry("provider", "7").containsEntry("version", 2)
                .containsEntry("approved", true).containsKey("approvedAt").doesNotContainKey("ghost");
        assertThat(WardrobeService.studioSummary(info, 1, false)).doesNotContainKey("approvedAt");
    }

    @Test
    void versaoDoFeedAtual() {
        WardrobeItem w = new WardrobeItem();
        assertThat(PieceStudioHints.currentFeedVersion(w)).isFalse();
        w.setFlatLayMetadataJson("{\"studio\":{\"feed\":\"x\"}}");
        assertThat(PieceStudioHints.currentFeedVersion(w)).isFalse();
        w.setFlatLayMetadataJson("{\"studio\":{\"feed\":{\"pipelineVersion\":\"" + br.com.fashionai.application.imaging.GarmentCrop.VERSION + "\"}}}");
        assertThat(PieceStudioHints.currentFeedVersion(w)).isTrue();
        w.setFlatLayMetadataJson("{\"studio\":{\"feed\":{\"pipelineVersion\":\"velha\"}}}");
        assertThat(PieceStudioHints.currentFeedVersion(w)).isFalse();
    }

    @Test
    void taxonomiaV2TrazVariacoesDimensoesELegado() {
        Map<String, Object> t = WardrobeService.taxonomyV2();
        assertThat(t).containsKeys("variationsBySubcategory", "variations", "dimensions", "legacySubcategories", "subcategoryLabels");
        assertThat(((Map<?, ?>) t.get("variationsBySubcategory")).containsKey("t_shirt")).isTrue();
        assertThat((List<?>) t.get("dimensions")).isNotEmpty();
    }

    @Test
    void semMarcaNoIdiomaDeQualquerUmNaoEMarca() {
        assertThat(PieceAnalysisParser.isNoBrandPlaceholder(" Sem marca ")).isTrue();
        assertThat(PieceAnalysisParser.isNoBrandPlaceholder("Nike")).isFalse();
    }

    @Test
    void subcategoriaLegadaViraOPadraoNovo() {
        TaxonomyRegistry reg = TaxonomyRegistry.get();
        var legacy = reg.legacySubcategories().stream().filter(l -> reg.resolve(l.code()) != null && !reg.resolve(l.code()).implied().isEmpty())
                .findFirst().orElseThrow();
        var r = reg.resolve(legacy.code());
        var f = form(legacy.category(), legacy.code(), null, null, null).resolveTaxonomy();
        assertThat(f.subcategory()).isEqualTo(r.subcategory());
        r.implied().forEach((k, v) -> {
            if ("MATERIAL".equals(k)) {
                assertThat(f.material()).isEqualTo(v);
            } else {
                assertThat(f.attributes()).containsEntry(k, List.of(v));
            }
        });
        // subcategoria ativa: o formulário volta igual
        var ativa = form("upper_piece", "t_shirt", null, null, null);
        assertThat(ativa.resolveTaxonomy()).isSameAs(ativa);
        // material escolhido que não é genérico vale mais que o implícito
        var shortsJeans = reg.legacySubcategories().stream().filter(l -> reg.resolve(l.code()) != null
                && reg.resolve(l.code()).implied().containsKey("MATERIAL")).findFirst();
        shortsJeans.ifPresent(l -> {
            assertThat(form(l.category(), l.code(), "WOOL", null, null).resolveTaxonomy().material()).isEqualTo("WOOL");
            assertThat(form(l.category(), l.code(), "COTTON", null, null).resolveTaxonomy().material())
                    .isEqualTo(reg.resolve(l.code()).implied().get("MATERIAL"));
        });
    }

    static WardrobeService.PieceForm form(String category, String sub, String material, String variation, Map<String, List<String>> attrs) {
        return form(category, sub, material, variation, attrs, null);
    }

    static WardrobeService.PieceForm form(String category, String sub, String material, String variation, Map<String, List<String>> attrs,
                                          List<String> confirmed) {
        return new WardrobeService.PieceForm(null, true, "Peça", category, sub, "UNISSEX", null, null, "white", material, "m",
                null, List.of("casual"), List.of("basic"), List.of(), new BigDecimal("10"), null, List.of(), null, null, null, null, null,
                null, null, null, null, null, null, null, null, variation, attrs, confirmed);
    }

    @Test
    void variacaoSugeridaPelaIaContinuaDaIaAteAPessoaConfirmar() {
        String variation = TaxonomyRegistry.get().variationsOf("t_shirt").get(0).code();
        Map<String, Object> ai = Map.of("variation", variation.toLowerCase(), "variationConfidence", 0.8);
        WardrobeItem w = new WardrobeItem();
        PieceTaxonomyWriter.applyTaxonomy(w, form("upper_piece", "t_shirt", null, variation, null), ai);
        assertThat(w.getVariationCode()).isEqualTo(variation);
        assertThat(w.getVariationStatus()).isEqualTo("AI_SUGGESTED");
        assertThat(w.getVariationSource()).isEqualTo("AI");
        assertThat(w.getVariationConfidence()).isEqualByComparingTo("0.8");

        // mesma variação, agora confirmada pela pessoa
        PieceTaxonomyWriter.applyTaxonomy(w, form("upper_piece", "t_shirt", null, variation, null, List.of("variation")), ai);
        assertThat(w.getVariationStatus()).isEqualTo("USER_CONFIRMED");
        assertThat(w.getVariationSource()).isEqualTo("USER");

        // sugestão sem confiança numérica
        WardrobeItem w2 = new WardrobeItem();
        PieceTaxonomyWriter.applyTaxonomy(w2, form("upper_piece", "t_shirt", null, variation, null), Map.of("variation", variation));
        assertThat(w2.getVariationConfidence()).isNull();
        assertThat(w2.getVariationStatus()).isEqualTo("AI_SUGGESTED");

        // trocar pela pessoa (sem sugestão)
        WardrobeItem w3 = new WardrobeItem();
        PieceTaxonomyWriter.applyTaxonomy(w3, form("upper_piece", "t_shirt", null, variation, Map.of()), null);
        assertThat(w3.getVariationStatus()).isEqualTo("USER_CONFIRMED");
        // limpar a variação (atributos informados)
        PieceTaxonomyWriter.applyTaxonomy(w3, form("upper_piece", "t_shirt", null, null, Map.of()), null);
        assertThat(w3.getVariationCode()).isNull();
        assertThat(w3.getVariationStatus()).isNull();
    }

    @Test
    void formularioAntigoSoTiraVariacaoQueDeixouDeValer() {
        TaxonomyRegistry reg = TaxonomyRegistry.get();
        String variation = reg.variationsOf("t_shirt").stream().map(TaxonomyRegistry.VariationLink::code)
                .filter(c -> !reg.isVariationOf("jeans", c)).findFirst().orElseThrow();
        WardrobeItem w = new WardrobeItem();
        w.setVariationCode(variation);
        w.setVariationStatus("USER_CONFIRMED");
        PieceTaxonomyWriter.applyTaxonomy(w, form("upper_piece", "t_shirt", null, null, null));
        assertThat(w.getVariationCode()).isEqualTo(variation);
        PieceTaxonomyWriter.applyTaxonomy(w, form("lower_piece", "jeans", null, null, null));
        assertThat(w.getVariationCode()).isNull();
        assertThat(w.getVariationStatus()).isNull();
        assertThat(w.getAttributes()).isNotEmpty();
    }

    @Test
    void formularioNormalizaVariacao() {
        assertThat(form("upper_piece", "t_shirt", null, " regular ", null).variation()).isEqualTo("REGULAR");
        assertThat(form("upper_piece", "t_shirt", null, " ", null).variation()).isNull();
        var curto = new WardrobeService.PieceForm(null, true, "P", "upper_piece", "t_shirt", "UNISSEX", null, null, "white", null, "m",
                null, null, null, null, BigDecimal.ONE, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        assertThat(curto.captureSessionId()).isNull();
        assertThat(curto.variation()).isNull();
        var comSessao = new WardrobeService.PieceForm(null, true, "P", "upper_piece", "t_shirt", "UNISSEX", null, null, "white", null, "m",
                null, null, null, null, BigDecimal.ONE, null, null, null, null, null, null, null, null, null, null, null, null, null, null, UUID.randomUUID());
        assertThat(comSessao.captureSessionId()).isNotNull();
        assertThat(comSessao.attributes()).isNull();
        var pick = new WardrobeService.CatalogPick(UUID.randomUUID(), null, "/img.png");
        assertThat(pick.thumbnailUrl()).isNull();
        assertThat(new WardrobeService.ClosetFilter(null, null, null, null, null, null, null, null, 0, 0).seal()).isNull();
        assertThat(new WardrobeService.ClosetFilter(null, null, null, null, null, null, null, null, 0, 0, "HOT").hypeLevel()).isEqualTo("HOT");
    }
}
