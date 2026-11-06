package br.com.fashionai.application.flair;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Glass Empire — os tipos novos da DSL (cards, mala, position, distinctTags, hypeBand), a forma deles e o despacho. */
class CbcRequirementsTest {
    private static CbcRules.Card card(String pos, String tier, Set<String> styles, Set<String> colors, Set<String> occasions, Set<String> materials,
                                      Double hyp) {
        return new CbcRules.Card(UUID.randomUUID(), pos, tier, 70, "Norte", "PIECE", styles, colors, occasions, materials,
                hyp == null ? Map.of() : Map.of("HYP", hyp), null, null, "upper_piece", "shirt");
    }

    private final CbcRules.Card sup = card("SUP", "OURO", Set.of("street"), Set.of("black"), Set.of("casual"), Set.of("cotton"), 92.0);
    private final CbcRules.Card inf = card("INF", "PRATA", Set.of("classic"), Set.of("crimson"), Set.of("casual"), Set.of("denim"), 61.0);
    private final CbcRules.Card cal = card("CAL", "BRONZE", Set.of("street"), Set.of("red"), Set.of("party"), Set.of("leather"), 15.0);
    private final CbcRules.Card ace = card("ACE", "ESPECIAL", Set.of("glam"), Set.of("print", "navy"), Set.of("party"), Set.of("cotton"), null);
    private final List<CbcRules.Slot> slots = List.of(new CbcRules.Slot("s1", "SUP"), new CbcRules.Slot("s2", "INF"), new CbcRules.Slot("s3", "CAL"),
            new CbcRules.Slot("s4", "ACE", Map.of("optional", true)));
    private final Map<String, CbcRules.Card> board = Map.of("s1", sup, "s2", inf, "s3", cal, "s4", ace);
    private final List<CbcRules.Card> cards = List.of(sup, inf, cal, ace);
    private final CbcRules.Context ctx = new CbcRules.Context(null, null, null, null, null, null, null);

    private CbcRules.RequirementResult req(List<CbcRules.Card> placed, Object... kv) {
        Map<String, Object> r = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            r.put((String) kv[i], kv[i + 1]);
        }
        return CbcRules.requirement(r, slots, board, placed, 0, ctx);
    }

    private CbcRules.RequirementResult req(Object... kv) {
        return req(cards, kv);
    }

    @Test
    void cartasColocadasNoMinimo() {
        assertThat(req("type", "cards", "min", 4).ok()).isTrue();
        assertThat(req("type", "cards", "min", 5)).extracting(CbcRules.RequirementResult::ok, CbcRules.RequirementResult::have, CbcRules.RequirementResult::need)
                .containsExactly(false, 4, 5);
        // sem "min": o número de vagas obrigatórias (3, a quarta é opcional)
        assertThat(req(List.of(sup, inf, cal), "type", "cards").ok()).isTrue();
        assertThat(req(List.of(sup, inf), "type", "cards").need()).isEqualTo(3);
        assertThat(req("type", "cards", "min", 1).toMap()).containsEntry("type", "cards").containsEntry("args", Map.of("min", 1));
    }

    @Test
    void malaSomaOsPesosDosNiveis() {
        // Ouro 3 + Prata 2 + Bronze 1 + Especial 4 = 10
        assertThat(req("type", "mala", "max", 10).ok()).isTrue();
        assertThat(req("type", "mala", "max", 10).have()).isEqualTo(10);
        assertThat(req("type", "mala", "max", 9).ok()).isFalse();
        assertThat(req(List.of(), "type", "mala", "max", 1).have()).isZero();
        assertThat(CbcRequirementsBoard.weight(sup)).isEqualTo(3);
        assertThat(CbcRequirementsBoard.weight(card("SUP", "DIAMANTE", Set.of(), Set.of(), Set.of(), Set.of(), null))).isEqualTo(1);
    }

    @Test
    void posicaoContaCartasNaquelaPosicao() {
        assertThat(req("type", "position", "position", "ACE").ok()).isTrue();
        assertThat(req("type", "position", "position", "ace").have()).isEqualTo(1);
        assertThat(req("type", "position", "position", "SUP", "count", 2).ok()).isFalse();
        assertThat(req("type", "position", "position", "VES").have()).isZero();
        assertThat(req("type", "position").ok()).isFalse();
    }

    @Test
    void tagsDistintasPorFamiliaDeCorEPorValor() {
        // black (Preto), crimson e red (Vermelho), print (Especiais: a própria cor), navy (Azul) = 4 famílias
        assertThat(req("type", "distinctTags", "field", "color", "count", 4).ok()).isTrue();
        assertThat(req("type", "distinctTags", "field", "color", "count", 5).have()).isEqualTo(4);
        assertThat(req(List.of(inf, cal), "type", "distinctTags", "field", "color").have()).isEqualTo(1);
        // estilos: street, classic, glam = 3 (padrão count 2 e field style)
        assertThat(req("type", "distinctTags").ok()).isTrue();
        assertThat(req("type", "distinctTags", "count", 3).have()).isEqualTo(3);
        assertThat(req("type", "distinctTags", "field", "occasion", "count", 3).have()).isEqualTo(2);
        assertThat(req("type", "distinctTags", "field", "material", "count", 3).ok()).isTrue();
        assertThat(CbcRequirementsTags.colorFamily("xyz")).isEqualTo("xyz");
        assertThat(CbcRequirementsTags.colorFamily("multicolor")).isEqualTo("multicolor");
        assertThat(CbcRequirementsTags.colorFamily("charcoal")).isEqualTo("Preto");
        assertThat(CbcRequirementsTags.distinctValues(ace, "color")).containsExactlyInAnyOrder("print", "Azul");
    }

    @Test
    void faixaDeHypeSemEscopoContaPeloMenosNCartas() {
        // VIRAL (92), HOT (61), LOW_SIGNAL (15), sem HYP = LOW_SIGNAL
        assertThat(req("type", "hypeBand", "min", "HOT", "count", 2).ok()).isTrue();
        assertThat(req("type", "hypeBand", "min", "VIRAL").have()).isEqualTo(1);
        assertThat(req("type", "hypeBand", "min", "trending", "count", 2).ok()).isFalse();
        assertThat(req("type", "hypeBand").have()).isEqualTo(4);
        assertThat(req("type", "hypeBand", "min", "NICHE", "count", 3).ok()).isFalse();
        assertThat(req("type", "hypeBand", "min", "inventada", "count", 4).ok()).isTrue();
    }

    @Test
    void faixaDeHypeComEscopoTodasEPorPosicoes() {
        assertThat(req("type", "hypeBand", "min", "LOW_SIGNAL", "scope", "all").ok()).isTrue();
        CbcRules.RequirementResult all = req("type", "hypeBand", "min", "HOT", "scope", "all");
        assertThat(all.ok()).isFalse();
        assertThat(all.have()).isEqualTo(2);
        assertThat(all.need()).isEqualTo(4);
        assertThat(req(List.of(), "type", "hypeBand", "scope", "all").ok()).isFalse();
        assertThat(req(List.of(sup, inf), "type", "hypeBand", "min", "HOT", "scope", "all").ok()).isTrue();
        // posições: só SUP e INF olhadas; count padrão = 2 posições
        assertThat(req("type", "hypeBand", "min", "HOT", "scope", "positions", "positions", List.of("SUP", "INF")).ok()).isTrue();
        assertThat(req("type", "hypeBand", "min", "HOT", "scope", "positions", "positions", List.of("sup", "cal")).have()).isEqualTo(1);
        assertThat(req("type", "hypeBand", "min", "HOT", "scope", "positions", "positions", List.of("SUP", "CAL"), "count", 1).ok()).isTrue();
        assertThat(req("type", "hypeBand", "min", "VIRAL", "scope", "positions", "positions", List.of("SUP", "CAL")).need()).isEqualTo(2);
        assertThat(req("type", "hypeBand", "scope", "positions", "positions", List.of("VES")).have()).isZero();
    }

    @Test
    void tipoDesconhecidoReprovaEOsClassicosContinuamNosGrupos() {
        assertThat(req("type", "fantasia")).extracting(CbcRules.RequirementResult::ok, CbcRules.RequirementResult::have, CbcRules.RequirementResult::need)
                .containsExactly(false, 0, 1);
        assertThat(CbcRequirementsBoard.evaluate("brand", Map.of(), slots, board, cards, 0, 3, Map.of())).isNull();
        assertThat(CbcRequirementsTags.evaluate("tier", Map.of(), cards, ctx, 3, Map.of())).isNull();
        assertThat(req("type", "tier", "only", "ouro").need()).isEqualTo(3);
        assertThat(req("type", "brand", "anyOf", List.of("norte"), "count", 4).ok()).isTrue();
        assertThat(CbcRequirementsTags.tagMatch(sup, "color", Set.of("charcoal"))).isTrue();
        assertThat(CbcRequirementsTags.tagMatch(sup, "material", Set.of("silk"))).isFalse();
    }

    @Test
    void validacaoDaFormaDosTiposNovos() {
        List<Map<String, Object>> bons = List.of(Map.of("type", "cards", "min", 3), Map.of("type", "mala", "max", 12),
                Map.of("type", "position", "position", "VES", "count", 2), Map.of("type", "distinctTags", "field", "color", "count", 3),
                Map.of("type", "hypeBand", "min", "NICHE", "count", 4), Map.of("type", "hypeBand", "scope", "all"),
                Map.of("type", "hypeBand", "min", "HOT", "scope", "positions", "positions", List.of("SUP", "VES")));
        assertThat(CbcRules.validate(slots, bons)).isEmpty();
        List<Map<String, Object>> ruins = List.of(Map.of("type", "cards"), Map.of("type", "cards", "min", 5), Map.of("type", "mala"),
                Map.of("type", "mala", "max", 0), Map.of("type", "position"), Map.of("type", "position", "position", "ANY"),
                Map.of("type", "position", "position", "XX"), Map.of("type", "distinctTags"), Map.of("type", "distinctTags", "field", "brand"),
                Map.of("type", "hypeBand", "min", "ULTRA"), Map.of("type", "hypeBand", "scope", "some"),
                Map.of("type", "hypeBand", "scope", "positions"), Map.of("type", "hypeBand", "positions", List.of("ANY")),
                Map.of("type", "hypeBand", "count", 9));
        assertThat(CbcRules.validate(slots, ruins)).containsExactly("requirements.cards", "requirements.cards", "requirements.mala",
                "requirements.mala", "requirements.position", "requirements.position", "requirements.position", "requirements.distinctTags",
                "requirements.distinctTags", "requirements.hypeBand", "requirements.hypeBand", "requirements.hypeBand", "requirements.hypeBand",
                "requirements.count:hypeBand");
        assertThat(CbcRules.TYPES).contains("cards", "mala", "position", "distinctTags", "hypeBand");
        assertThat(CbcRequirements.concretePosition(null)).isFalse();
        assertThat(CbcRequirements.concretePosition("LOOK")).isTrue();
    }
}
