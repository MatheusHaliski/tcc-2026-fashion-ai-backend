package br.com.fashionai.application.flair;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** CbcRules: cada tipo de requisito, o que a vaga aceita, harmonia de cores, tema, validação e apoio. */
class CbcRulesRequisitosTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 25);
    private static final Instant START = Instant.parse("2026-10-20T00:00:00Z");

    private static CbcRules.Card card(String pos, String tier, int ovr, String brand, String origin, Set<String> styles, Set<String> colors,
                                      Map<String, Double> hype, Instant added, LocalDate worn) {
        return new CbcRules.Card(UUID.randomUUID(), pos, tier, ovr, brand, origin, styles, colors, Set.of("casual"), Set.of("cotton"),
                hype, added, worn, "upper_piece", "shirt");
    }

    private final CbcRules.Card a = card("SUP", "OURO", 90, "Norte", "PIECE", Set.of("Street"), Set.of("black"), Map.of("POP", 80.0),
            Instant.parse("2026-01-01T00:00:00Z"), LocalDate.of(2026, 1, 10));
    private final CbcRules.Card b = card("INF", "PRATA", 70, " norte ", "PIECE", Set.of("classic"), Set.of("red"), Map.of(),
            Instant.parse("2026-10-22T00:00:00Z"), null);
    private final CbcRules.Card c = card("CAL", "BRONZE", 50, null, "AI", Set.of("glam"), Set.of("purple"), Map.of("POP", 20.0), null, null);
    private final List<CbcRules.Slot> slots = List.of(new CbcRules.Slot("s1", "SUP"), new CbcRules.Slot("s2", "INF"), new CbcRules.Slot("s3", "ANY"));
    private final List<CbcRules.Card> cards = List.of(a, b, c);
    private final Map<String, CbcRules.Card> board = Map.of("s1", a, "s2", b, "s3", c);
    private final CbcRules.Context ctx = new CbcRules.Context(List.of(new CbcRules.Interpretation("dark", Set.of("goth"), Set.of("black"))),
            Set.of("glam"), Set.of(), Set.of(), null, START, TODAY);

    private CbcRules.RequirementResult req(Object... kv) {
        Map<String, Object> r = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            r.put((String) kv[i], kv[i + 1]);
        }
        return CbcRules.requirement(r, slots, board, cards, 5, ctx);
    }

    @Test
    void requisitosDeNivel() {
        assertThat(req("type", "tier", "only", "ouro").ok()).isFalse();
        assertThat(req("type", "tier", "only", "ouro").have()).isEqualTo(1);
        assertThat(req("type", "tier", "max", "ouro").ok()).isTrue();
        assertThat(req("type", "tier", "max", "prata").have()).isEqualTo(2);
        assertThat(req("type", "tier", "exact", "prata").ok()).isTrue();
        assertThat(req("type", "tier", "exact", "prata", "count", 2).ok()).isFalse();
        assertThat(req("type", "tier", "min", "prata", "count", 2).ok()).isTrue();
        assertThat(req("type", "tier").ok()).isTrue();
        assertThat(req("type", "tier", "min", "ouro").need()).isEqualTo(3);
    }

    @Test
    void requisitosDeNotaMarcaESintonia() {
        assertThat(req("type", "ovrAvg", "min", 70).ok()).isTrue();
        assertThat(req("type", "ovrAvg", "min", 71).have()).isEqualTo(70);
        assertThat(CbcRules.requirement(Map.of("type", "ovrAvg"), slots, Map.of(), List.of(), 0, ctx).ok()).isFalse();
        assertThat(req("type", "ovrMin", "min", 60).ok()).isFalse();
        assertThat(req("type", "ovrMin", "min", 60, "count", 2).ok()).isTrue();
        assertThat(req("type", "brand", "anyOf", List.of("NORTE"), "count", 2).ok()).isTrue();
        assertThat(req("type", "brand", "anyOf", List.of("sul")).ok()).isFalse();
        assertThat(req("type", "sintonia", "min", 5).ok()).isTrue();
        assertThat(req("type", "sintonia", "min", 6).ok()).isFalse();
        assertThat(req("type", "sameBrand").have()).isEqualTo(2);
        assertThat(req("type", "sameBrand", "count", 3).ok()).isFalse();
        assertThat(req("type", "distinctBrands").have()).isEqualTo(1);
        assertThat(req("type", "distinctBrands", "count", 1).ok()).isTrue();
    }

    @Test
    void requisitosDeTagTemaHypeOrigemCompraRedescobertaEPosicao() {
        assertThat(req("type", "tag", "anyOf", List.of("street")).ok()).isTrue();
        assertThat(req("type", "tag", "field", "color", "anyOf", List.of("black")).ok()).isTrue();
        assertThat(req("type", "tag", "field", "occasion", "anyOf", List.of("casual"), "count", 3).ok()).isTrue();
        assertThat(req("type", "tag", "field", "material", "anyOf", List.of("silk")).ok()).isFalse();
        assertThat(req("type", "theme", "count", 2).have()).isEqualTo(2);
        assertThat(req("type", "hype", "dim", "pop", "min", 50).have()).isEqualTo(1);
        assertThat(req("type", "hype").ok()).isFalse();
        assertThat(req("type", "origin").have()).isEqualTo(2);
        assertThat(req("type", "origin", "only", "ai").ok()).isFalse();
        assertThat(req("type", "noBuy").have()).isEqualTo(1);
        assertThat(CbcRules.requirement(Map.of("type", "noBuy"), slots, board, cards, 0,
                new CbcRules.Context(null, null, null, null, null, null, TODAY)).have()).isEqualTo(2);
        assertThat(req("type", "rediscovery").have()).isEqualTo(1);
        assertThat(req("type", "rediscovery", "idleDays", 1, "count", 2).ok()).isTrue();
        assertThat(req("type", "strictPosition").ok()).isTrue();
        Map<String, CbcRules.Card> trocado = Map.of("s1", b, "s2", a, "s3", c);
        assertThat(CbcRules.requirement(Map.of("type", "strictPosition"), slots, trocado, cards, 0, ctx).have()).isEqualTo(1);
        assertThat(req("type", "inventado").ok()).isFalse();
    }

    @Test
    void avaliacaoComVagaVaziaVagaQueRecusaETemaEscolhido() {
        List<CbcRules.Slot> s = List.of(new CbcRules.Slot("s1", "SUP", Map.of("tier", "ouro")), new CbcRules.Slot("s2", null, null),
                new CbcRules.Slot("s3", "CAL", Map.of("minOvr", 60)));
        Map<String, CbcRules.Card> placed = new HashMap<>(Map.of("s1", a, "s3", c));
        CbcRules.Context escolhido = new CbcRules.Context(ctx.interpretations(), Set.of("glam"), Set.of("purple"), Set.of(), "dark", START, TODAY);

        CbcRules.Evaluation e = CbcRules.evaluate(s, placed, null, escolhido);

        assertThat(e.complete()).isFalse();
        assertThat(e.ok()).isFalse();
        assertThat(e.filled()).isEqualTo(2);
        assertThat(e.slots().get(1).cardId()).isNull();
        assertThat(e.slots().get(2).misses()).containsExactly("minOvr");
        assertThat(e.slots().get(0).theme()).isTrue();
        assertThat(e.slots().get(2).theme()).isTrue();
        assertThat(e.rediscovered()).containsExactly(a.id());
        assertThat(e.sintoniaMax()).isEqualTo(9);
        assertThat(e.slots().get(0).toMap()).containsEntry("accepted", true).containsEntry("slot", "s1");
        assertThat(e.requirements()).isEmpty();

        placed.put("s2", b);
        CbcRules.Evaluation full = CbcRules.evaluate(s, placed, List.of(Map.of("type", "tier", "max", "ouro")), escolhido);
        assertThat(full.complete()).isTrue();
        assertThat(full.ok()).isFalse();
        assertThat(full.requirements().get(0).toMap()).containsEntry("ok", true).containsEntry("type", "tier");
        assertThat(CbcRules.evaluate(slots, null, List.of(), ctx).filled()).isZero();
        CbcRules.Context ownCtx = new CbcRules.Context(ctx.interpretations(), Set.of(), Set.of(), Set.of(), CbcRules.OWN, START, TODAY);
        assertThat(CbcRules.evaluate(slots, board, List.of(), ownCtx).slots().get(0).theme()).isTrue();
        CbcRules.Context ausente = new CbcRules.Context(ctx.interpretations(), Set.of(), Set.of(), Set.of(), "nao-existe", START, TODAY);
        assertThat(CbcRules.evaluate(slots, board, List.of(), ausente).slots().get(1).theme()).isFalse();
    }

    @Test
    void vagaAceitaPorNivelMarcaCategoriaCorEstiloOcasiaoMaterialEOrigem() {
        CbcRules.Slot tudo = new CbcRules.Slot("x", "ANY", Map.of("tier", List.of("prata", "ouro"), "minOvr", 80, "brand", "norte",
                "category", List.of("upper_piece"), "subcategory", "shirt", "color", "black", "style", "street", "occasion", "casual",
                "material", "cotton", "origin", "piece"));
        assertThat(CbcRules.misses(tudo, a)).isEmpty();
        assertThat(CbcRules.misses(tudo, c)).containsExactly("tier", "minOvr", "brand", "color", "style", "origin");
        CbcRules.Card semCategoria = new CbcRules.Card(UUID.randomUUID(), "SUP", "OURO", 90, "Norte", "PIECE", Set.of("street"), Set.of("black"),
                Set.of("gala"), Set.of("silk"), null, null, null);
        assertThat(CbcRules.misses(tudo, semCategoria)).containsExactly("category", "subcategory", "occasion", "material");
        CbcRules.Slot errado = new CbcRules.Slot("y", "ANY", Map.of("category", "lower_piece", "subcategory", List.of("jeans")));
        assertThat(CbcRules.misses(errado, a)).containsExactly("category", "subcategory");
        assertThat(CbcRules.misses(tudo, null)).isEmpty();
        assertThat(CbcRules.listOrOne(5)).isEmpty();
    }

    @Test
    void harmoniaDeCoresPelaRodaENeutros() {
        assertThat(CbcRules.colorHarmony(null, "red")).isFalse();
        assertThat(CbcRules.colorHarmony("red", "red")).isTrue();
        assertThat(CbcRules.colorHarmony("black", "red")).isTrue();
        assertThat(CbcRules.colorHarmony("red", "white")).isTrue();
        assertThat(CbcRules.colorHarmony("red", "crimson")).isTrue();
        assertThat(CbcRules.colorHarmony("multicolor", "red")).isTrue();
        assertThat(CbcRules.colorHarmony("red", "orange")).isTrue();
        assertThat(CbcRules.colorHarmony("red", "pink")).isTrue();
        assertThat(CbcRules.colorHarmony("red", "green")).isTrue();
        assertThat(CbcRules.colorHarmony("blue", "orange")).isTrue();
        assertThat(CbcRules.colorHarmony("red", "blue")).isFalse();
        assertThat(CbcRules.colorHarmony("purple", "green")).isFalse();
        assertThat(CbcRules.colorMatch(null, "red")).isFalse();
        assertThat(CbcRules.colorMatch("crimson", "red")).isTrue();
        assertThat(CbcRules.colorMatch("multicolor", "print")).isFalse();
        assertThat(CbcRules.colorMatch("xyz", "red")).isFalse();
    }

    @Test
    void vizinhancaPorMarcaEstiloOuCor() {
        CbcRules.Card x = card("SUP", "BRONZE", 1, "Acme", "PIECE", Set.of("a"), Set.of("red"), null, null, null);
        CbcRules.Card mesmaMarca = card("SUP", "BRONZE", 1, " acme", "PIECE", Set.of("b"), Set.of("blue"), null, null, null);
        CbcRules.Card mesmoEstilo = card("SUP", "BRONZE", 1, "", "PIECE", Set.of("a"), Set.of("blue"), null, null, null);
        CbcRules.Card corVizinha = card("SUP", "BRONZE", 1, null, "PIECE", Set.of("c"), Set.of("orange"), null, null, null);
        CbcRules.Card nada = card("SUP", "BRONZE", 1, "Outra", "PIECE", Set.of("c"), Set.of("blue"), null, null, null);
        assertThat(CbcRules.harmonious(x, null)).isFalse();
        assertThat(CbcRules.harmonious(x, mesmaMarca)).isTrue();
        assertThat(CbcRules.harmonious(x, mesmoEstilo)).isTrue();
        assertThat(CbcRules.harmonious(x, corVizinha)).isTrue();
        assertThat(CbcRules.harmonious(x, nada)).isFalse();
        assertThat(CbcRules.harmonious(mesmoEstilo, x)).isTrue();
    }

    @Test
    void temaSemContextoOuPorOcasiao() {
        assertThat(CbcRules.themeAny(a, null)).isFalse();
        assertThat(CbcRules.themeAny(a, new CbcRules.Context(null, null, null, null, null, null, null))).isFalse();
        assertThat(CbcRules.themeAny(a, new CbcRules.Context(null, null, null, Set.of("casual"), null, null, null))).isTrue();
        assertThat(CbcRules.themeAny(a, new CbcRules.Context(null, null, Set.of("black"), null, null, null, null))).isTrue();
        assertThat(CbcRules.themeFocus(a, null)).isFalse();
        assertThat(CbcRules.idleDays(a, null)).isZero();
        assertThat(CbcRules.idleDays(c, TODAY)).isZero();
    }

    @Test
    void sugestaoDeInterpretacao() {
        var interps = List.of(new CbcRules.Interpretation("rosa", Set.of("x"), Set.of("pink")),
                new CbcRules.Interpretation("glam", Set.of("glam"), Set.of()), new CbcRules.Interpretation("tudo", Set.of("glam", "classic"), Set.of()));
        assertThat(CbcRules.suggestInterpretation(cards, interps)).isEqualTo("tudo");
        assertThat(CbcRules.suggestInterpretation(cards, List.of(interps.get(0)))).isNull();
    }

    @Test
    void desafioAbertoSoAteBronze() {
        assertThat(CbcRules.levelOpen(null)).isTrue();
        assertThat(CbcRules.levelOpen(List.of(Map.of("type", "ovrMin"), Map.of("type", "tier", "min", "bronze")))).isTrue();
        assertThat(CbcRules.levelOpen(List.of(Map.of("type", "tier", "min", "prata")))).isFalse();
        assertThat(CbcRules.levelOpen(List.of(Map.of("type", "tier", "exact", "ouro")))).isFalse();
        assertThat(CbcRules.levelOpen(List.of(Map.of("type", "tier", "only", "especial")))).isFalse();
        assertThat(CbcRules.levelOpen(List.of(Map.of("type", "tier", "max", "especial")))).isTrue();
    }

    @Test
    void validacaoDeVagasERequisitos() {
        assertThat(CbcRules.validate(null, null)).containsExactly("slots.count");
        assertThat(CbcRules.validate(slots.subList(0, 2), null)).containsExactly("slots.count");
        List<CbcRules.Slot> ruins = List.of(new CbcRules.Slot("ok", null), new CbcRules.Slot("ok", "XX"), new CbcRules.Slot(null, "SUP"),
                new CbcRules.Slot("Maiúscula", "SUP", Map.of("cor", "x")));
        assertThat(CbcRules.validate(ruins, List.of())).containsExactly("slots.key:ok", "slots.position:XX", "slots.key:null",
                "slots.key:Maiúscula", "slots.accepts:cor");
        List<Map<String, Object>> reqs = List.of(Map.of("type", 3), Map.of("type", "nada"), Map.of("type", "tier"), Map.of("type", "tier", "only", "x"),
                Map.of("type", "tier", "max", "ouro"), Map.of("type", "tier", "exact", "ouro"), Map.of("type", "tier", "min", "ouro"),
                Map.of("type", "tag", "field", "color"), Map.of("type", "tag", "field", "zzz", "anyOf", List.of("a")),
                Map.of("type", "tag", "field", "style", "anyOf", List.of("a")), Map.of("type", "brand"), Map.of("type", "brand", "anyOf", List.of("x")),
                Map.of("type", "hype", "dim", "xx"), Map.of("type", "hype"), Map.of("type", "ovrMin", "count", 0), Map.of("type", "ovrMin", "count", 9),
                Map.of("type", "ovrMin", "count", 2));
        assertThat(CbcRules.validate(slots, reqs)).containsExactly("requirements.type:3", "requirements.type:nada", "requirements.tier",
                "requirements.tier", "requirements.tag", "requirements.tag", "requirements.brand", "requirements.hype", "requirements.count:ovrMin",
                "requirements.count:ovrMin");
    }

    @Test
    void apoio() {
        assertThat(CbcRules.hasTheme(null)).isFalse();
        assertThat(CbcRules.hasTheme(List.of(Map.of("type", "tier")))).isFalse();
        assertThat(CbcRules.hasTheme(List.of(Map.of("type", "theme")))).isTrue();
        assertThat(CbcRules.tier(null)).isEqualTo("BRONZE");
        assertThat(CbcRules.intOf("3", 7)).isEqualTo(7);
        assertThat(CbcRules.strings(java.util.Arrays.asList("a", null, 2))).containsExactly("a", "2");
        assertThat(CbcRules.intersects(null, Set.of("a"))).isFalse();
        assertThat(CbcRules.intersects(Set.of("a"), Set.of())).isFalse();
        assertThat(CbcRules.norm(java.util.Arrays.asList(" A ", null, " ", "b"))).containsExactly("a", "b");
        assertThat(CbcRules.norm(null)).isEmpty();
    }
}
