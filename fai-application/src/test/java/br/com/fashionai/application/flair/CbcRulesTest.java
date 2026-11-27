package br.com.fashionai.application.flair;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * FLAIR-UT §14 — motor dos Desafios de Montagem e as regras de O Império do Efêmero que moram nele: qualquer leitura
 * vale (P1), a leitura escolhida não muda os requisitos (P3), "sem compras" e "redescoberta" (C2–C3), um nível que não
 * barra ninguém (A1) e a história escrita carta a carta (D1).
 */
class CbcRulesTest {
    static final LocalDate TODAY = LocalDate.of(2026, 10, 25);
    static final Instant START = Instant.parse("2026-10-20T03:00:00Z");

    static final List<CbcRules.Slot> HALLOWEEN = List.of(new CbcRules.Slot("rua", "CAL"), new CbcRules.Slot("festa", "SUP"),
            new CbcRules.Slot("pista", "INF"), new CbcRules.Slot("fotos", "ACE"));

    static final List<CbcRules.Interpretation> READINGS = List.of(
            new CbcRules.Interpretation("dark", Set.of("edgy", "grunge"), Set.of("black", "gray")),
            new CbcRules.Interpretation("orange-black", Set.of(), Set.of("orange", "black")),
            new CbcRules.Interpretation("minimal", Set.of("minimalist", "basic"), Set.of("black")));

    static CbcRules.Card card(String position, String tier, int ovr, String brand, Set<String> styles, Set<String> colors) {
        return new CbcRules.Card(UUID.randomUUID(), position, tier, ovr, brand, "PIECE", styles, colors, Set.of(), Set.of(), Map.of(),
                START.minusSeconds(86_400L * 200), TODAY.minusDays(5));
    }

    static CbcRules.Context ctx(String chosen) {
        return new CbcRules.Context(READINGS, Set.of(), Set.of(), Set.of(), chosen, START, TODAY);
    }

    @Test
    void temaValeComQualquerLeituraEAEscolhaNaoMudaOsRequisitos() {
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        board.put("rua", card("CAL", "BRONZE", 55, "Norte", Set.of("sporty"), Set.of("orange")));     // laranja e preto
        board.put("festa", card("SUP", "BRONZE", 58, "Lumi", Set.of("minimalist"), Set.of("white")));  // minimal
        board.put("pista", card("INF", "PRATA", 66, "Lumi", Set.of("grunge"), Set.of("charcoal")));     // dark (grafite conta como preto)
        board.put("fotos", card("ACE", "BRONZE", 50, null, Set.of("romantic"), Set.of("pink")));        // fora do tema
        List<Map<String, Object>> reqs = List.of(Map.of("type", "theme", "count", 3));

        CbcRules.Evaluation own = CbcRules.evaluate(HALLOWEEN, board, reqs, ctx(CbcRules.OWN));
        CbcRules.Evaluation dark = CbcRules.evaluate(HALLOWEEN, board, reqs, ctx("dark"));

        // P1: três leituras diferentes (laranja e preto, minimal, dark) contam para o mesmo tema
        assertThat(own.requirements().get(0).have()).isEqualTo(3);
        assertThat(own.ok()).isTrue();
        // P3: escolher "dark" não reprova quem montou com outras leituras — muda só a sintonia de tema
        assertThat(dark.ok()).isTrue();
        assertThat(dark.requirements().get(0).have()).isEqualTo(3);
        assertThat(dark.slots().get(2).theme()).isTrue();     // a carta grunge/grafite combina com "dark"
        assertThat(dark.slots().get(0).theme()).isFalse();    // o tênis laranja não é "dark": perde só o +1 de tema da sintonia
        assertThat(own.slots().get(0).theme()).isTrue();
        assertThat(dark.sintonia()).isLessThan(own.sintonia());
    }

    @Test
    void sintoniaSomaPosicaoVizinhancaETema() {
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        board.put("rua", card("CAL", "BRONZE", 55, "Norte", Set.of("edgy"), Set.of("black")));
        board.put("festa", card("SUP", "BRONZE", 55, "Norte", Set.of("glam"), Set.of("burgundy")));   // mesma marca da vizinha
        board.put("pista", card("ACE", "BRONZE", 55, "Outra", Set.of("romantic"), Set.of("hot_pink"))); // posição errada
        CbcRules.Evaluation ev = CbcRules.evaluate(HALLOWEEN, board, List.of(), ctx(CbcRules.OWN));

        CbcRules.SlotResult rua = ev.slots().get(0);
        assertThat(rua.positionOk()).isTrue();
        assertThat(rua.neighbor()).isTrue();      // mesma marca da festa
        assertThat(rua.theme()).isTrue();         // edgy/preto = dark
        assertThat(rua.sintonia()).isEqualTo(3);
        CbcRules.SlotResult pista = ev.slots().get(2);
        assertThat(pista.positionOk()).isFalse();
        assertThat(pista.neighbor()).isTrue();    // pink ao lado de burgundy: famílias vizinhas na roda (Rosa–Vermelho)
        assertThat(ev.sintoniaMax()).isEqualTo(12);
        assertThat(ev.complete()).isFalse();      // a vaga "fotos" está vazia
        assertThat(ev.ok()).isFalse();
    }

    @Test
    void harmoniaDeCoresPelaTaxonomia() {
        assertThat(CbcRules.colorHarmony("black", "hot_pink")).isTrue();      // neutro combina com tudo
        assertThat(CbcRules.colorHarmony("red", "crimson")).isTrue();         // mesma família
        assertThat(CbcRules.colorHarmony("blue", "orange")).isTrue();         // complementares
        assertThat(CbcRules.colorHarmony("yellow", "green")).isTrue();        // vizinhas na roda
        assertThat(CbcRules.colorHarmony("red", "blue")).isFalse();
        assertThat(CbcRules.colorMatch("charcoal", "black")).isTrue();        // grafite vale como preto no tema
        assertThat(CbcRules.colorMatch("multicolor", "print")).isFalse();     // "Especiais" não viram família
    }

    @Test
    void niveisSoBronzeMinimoEExato() {
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        board.put("rua", card("CAL", "BRONZE", 55, null, Set.of(), Set.of()));
        board.put("festa", card("SUP", "OURO", 80, null, Set.of(), Set.of()));
        board.put("pista", card("INF", "OURO", 78, null, Set.of(), Set.of()));
        board.put("fotos", card("ACE", "PRATA", 70, null, Set.of(), Set.of()));
        CbcRules.Context c = ctx(null);
        assertThat(CbcRules.evaluate(HALLOWEEN, board, List.of(Map.of("type", "tier", "only", "BRONZE")), c).ok()).isFalse();
        assertThat(CbcRules.evaluate(HALLOWEEN, board, List.of(Map.of("type", "tier", "min", "OURO", "count", 2)), c).ok()).isTrue();
        assertThat(CbcRules.evaluate(HALLOWEEN, board, List.of(Map.of("type", "tier", "exact", "OURO", "count", 1)), c).ok()).isFalse();
        assertThat(CbcRules.evaluate(HALLOWEEN, board, List.of(Map.of("type", "ovrAvg", "min", 70)), c).ok()).isTrue();   // média 70,75 → 71
        assertThat(CbcRules.evaluate(HALLOWEEN, board, List.of(Map.of("type", "tier", "max", "PRATA")), c).ok()).isFalse();
        // A1: "só Bronze" continua aberto a todos; exigir Ouro não
        assertThat(CbcRules.levelOpen(List.of(Map.of("type", "tier", "only", "BRONZE")))).isTrue();
        assertThat(CbcRules.levelOpen(List.of(Map.of("type", "tier", "min", "OURO", "count", 3)))).isFalse();
        assertThat(CbcRules.levelOpen(List.of(Map.of("type", "theme", "count", 2)))).isTrue();
    }

    @Test
    void semComprasERedescobertaOlhamOGuardaRoupa() {
        CbcRules.Card old = new CbcRules.Card(UUID.randomUUID(), "CAL", "BRONZE", 50, null, "PIECE", Set.of(), Set.of(), Set.of(), Set.of(), Map.of(),
                START.minusSeconds(86_400L * 400), TODAY.minusDays(90));                 // parada há 90 dias
        CbcRules.Card neverWorn = new CbcRules.Card(UUID.randomUUID(), "SUP", "BRONZE", 50, null, "PIECE", Set.of(), Set.of(), Set.of(), Set.of(), Map.of(),
                START.minusSeconds(86_400L * 70), null);                                // nunca usada, no armário há ~75 dias
        CbcRules.Card bought = new CbcRules.Card(UUID.randomUUID(), "INF", "BRONZE", 50, null, "PIECE", Set.of(), Set.of(), Set.of(), Set.of(), Map.of(),
                START.plusSeconds(86_400L), null);                                       // entrou depois do início
        CbcRules.Card gone = new CbcRules.Card(UUID.randomUUID(), "ACE", "BRONZE", 50, null, "PIECE", Set.of(), Set.of(), Set.of(), Set.of(), Map.of(),
                null, null);                                                             // peça removida
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        board.put("rua", old);
        board.put("festa", neverWorn);
        board.put("pista", bought);
        board.put("fotos", gone);

        CbcRules.Evaluation ev = CbcRules.evaluate(HALLOWEEN, board, List.of(Map.of("type", "noBuy"),
                Map.of("type", "rediscovery", "count", 2, "idleDays", 60)), ctx(null));
        assertThat(ev.requirements().get(0).have()).isEqualTo(2);        // a peça nova e a removida não contam
        assertThat(ev.requirements().get(0).ok()).isFalse();
        assertThat(ev.requirements().get(1).have()).isEqualTo(2);        // parada há 90 dias + nunca usada há 75
        assertThat(ev.requirements().get(1).ok()).isTrue();
        assertThat(ev.rediscovered()).containsExactlyInAnyOrder(old.id(), neverWorn.id());
    }

    @Test
    void historiaEscritaCartaACartaNuncaSeRepete() {
        List<CbcStory.SlotText> slots = HALLOWEEN.stream().map(s -> new CbcStory.SlotText(s.key(), null)).toList();
        Map<String, CbcStory.CardText> a = new LinkedHashMap<>();
        a.put("rua", new CbcStory.CardText("Tênis Aero", "Norte", "black"));
        a.put("festa", new CbcStory.CardText("Camisa Lua", null, "orange"));
        Map<String, CbcStory.CardText> b = new LinkedHashMap<>(a);
        b.put("rua", new CbcStory.CardText("Bota Noite", "Lumi", "black"));

        List<Map<String, Object>> first = CbcStory.write("halloween", slots, a, null, "dark");
        List<Map<String, Object>> second = CbcStory.write("halloween", slots, b, null, "dark");

        assertThat(first).isNotEqualTo(second);                                        // D1
        assertThat(first.get(0)).containsEntry("key", "cbc.scenario.halloween.open");
        assertThat(first.get(1)).containsEntry("key", "cbc.story.reading");
        Map<String, Object> rua = first.get(2);
        assertThat(rua).containsEntry("key", "cbc.scenario.halloween.rua.story").containsEntry("slot", "rua");
        assertThat(rua.get("vars")).isEqualTo(Map.of("name", "Tênis Aero", "brand", "Norte", "color", "black"));
        assertThat(((Map<?, ?>) first.get(3).get("vars")).get("brand")).isEqualTo("none");   // sem marca: o modelo ICU escolhe a frase sem marca
        assertThat(CbcStory.write("halloween", slots, a, null, CbcRules.OWN).get(1)).containsEntry("key", "cbc.story.reading_own");
        // cenário livre: o texto vem da vaga, por idioma
        List<Map<String, Object>> free = CbcStory.write(CbcStory.FREE, List.of(new CbcStory.SlotText("rua", Map.of("pt-BR", "Na rua, {name}."))),
                Map.of("rua", new CbcStory.CardText("Tênis", null, null)), null, null);
        assertThat(free.get(0)).containsEntry("key", "cbc.story.open_free");
        assertThat(free.get(2)).containsEntry("text", Map.of("pt-BR", "Na rua, {name}."));
    }

    @Test
    void validacaoDasVagasEDosRequisitos() {
        assertThat(CbcRules.validate(HALLOWEEN, List.of(Map.of("type", "theme", "count", 2)))).isEmpty();
        assertThat(CbcRules.validate(HALLOWEEN.subList(0, 2), List.of())).containsExactly("slots.count");
        assertThat(CbcRules.validate(List.of(new CbcRules.Slot("a", "SUP"), new CbcRules.Slot("a", "INF"), new CbcRules.Slot("b", "XYZ")), List.of()))
                .contains("slots.key:a", "slots.position:XYZ");
        assertThat(CbcRules.validate(HALLOWEEN, List.of(Map.of("type", "fantasia")))).contains("requirements.type:fantasia");
        assertThat(CbcRules.validate(HALLOWEEN, List.of(Map.of("type", "tier", "min", "DIAMANTE")))).contains("requirements.tier");
        assertThat(CbcRules.validate(HALLOWEEN, List.of(Map.of("type", "theme", "count", 9)))).contains("requirements.count:theme");
    }

    @Test
    void mosaicoPodeExigirCartasEspecificasPorVagaEContarMarcaENota() {
        // "Só cartas Ouro, 3 cartas Norte e 3 com nota acima de 80" + a vaga do tapete só aceita peça vermelha
        List<CbcRules.Slot> slots = List.of(new CbcRules.Slot("tapete", "SUP", Map.of("color", List.of("red"), "tier", "OURO")),
                new CbcRules.Slot("flash", "ANY"), new CbcRules.Slot("escada", "ANY"));
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        board.put("tapete", new CbcRules.Card(UUID.randomUUID(), "SUP", "OURO", 84, "Norte", "PIECE", Set.of("glam"), Set.of("crimson"), Set.of(), Set.of(),
                Map.of(), START, null, "upper_piece", "dress"));
        board.put("flash", new CbcRules.Card(UUID.randomUUID(), "ACE", "OURO", 81, "norte", "PIECE", Set.of(), Set.of("black"), Set.of(), Set.of(),
                Map.of(), START, null, "accessory_piece", "clutch"));
        board.put("escada", new CbcRules.Card(UUID.randomUUID(), "CAL", "OURO", 79, "Lumi", "PIECE", Set.of(), Set.of("black"), Set.of(), Set.of(),
                Map.of(), START, null, "shoes_piece", "heels"));
        List<Map<String, Object>> reqs = List.of(Map.of("type", "tier", "only", "OURO"), Map.of("type", "brand", "anyOf", List.of("Norte"), "count", 3),
                Map.of("type", "ovrMin", "min", 80, "count", 2));

        CbcRules.Evaluation ev = CbcRules.evaluate(slots, board, reqs, ctx(null));

        assertThat(ev.slots().get(0).accepted()).isTrue();                    // carmim é da família vermelha e é Ouro
        assertThat(ev.requirements().get(1).have()).isEqualTo(2);            // a marca não diferencia maiúsculas
        assertThat(ev.requirements().get(1).ok()).isFalse();
        assertThat(ev.requirements().get(2).ok()).isTrue();                  // 84 e 81: duas acima de 80
        assertThat(ev.ok()).isFalse();
        // a vaga exige vermelho: uma carta preta não completa aquele fragmento, mesmo cumprindo o resto
        board.put("tapete", board.get("flash"));
        board.put("flash", new CbcRules.Card(UUID.randomUUID(), "SUP", "OURO", 90, "Norte", "PIECE", Set.of(), Set.of("black"), Set.of(), Set.of(),
                Map.of(), START, null, "upper_piece", "shirt"));
        CbcRules.Evaluation wrong = CbcRules.evaluate(slots, board, reqs, ctx(null));
        assertThat(wrong.slots().get(0).accepted()).isFalse();
        assertThat(wrong.slots().get(0).misses()).containsExactly("color");
        assertThat(wrong.ok()).isFalse();
        // vaga sem restrição aceita qualquer carta (a restrição é opcional, conforme o enredo)
        assertThat(wrong.slots().get(1).accepted()).isTrue();
        assertThat(CbcRules.validate(slots, reqs)).isEmpty();
        assertThat(CbcRules.validate(List.of(new CbcRules.Slot("a", "SUP", Map.of("logo", "x")), new CbcRules.Slot("b", "ANY"), new CbcRules.Slot("c", "ANY")),
                List.of(Map.of("type", "brand", "count", 2)))).contains("slots.accepts:logo", "requirements.brand");
    }
}
