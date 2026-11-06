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

/** FLAIR 3D — vagas opcionais: {@code complete}, o {@code n} dos requisitos "para todas", sintoniaMax e validação. */
class CbcOptionalSlotsTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 5);
    private static final Instant START = Instant.parse("2026-11-01T00:00:00Z");

    private static CbcRules.Card card(String pos, String tier, int ovr, String origin, Instant added) {
        return new CbcRules.Card(UUID.randomUUID(), pos, tier, ovr, "Norte", origin, Set.of("street"), Set.of("black"), Set.of(), Set.of(), Map.of(),
                added, null);
    }

    private final List<CbcRules.Slot> slots = List.of(new CbcRules.Slot("a", "SUP"), new CbcRules.Slot("b", "INF"), new CbcRules.Slot("c", "CAL"),
            new CbcRules.Slot("d", "ACE", Map.of("optional", true)), new CbcRules.Slot("e", "VES", Map.of("optional", true, "tier", "ouro")));
    private final CbcRules.Context ctx = new CbcRules.Context(null, null, null, null, null, START, TODAY);
    private final CbcRules.Card a = card("SUP", "OURO", 80, "PIECE", START.minusSeconds(86_400));
    private final CbcRules.Card b = card("INF", "OURO", 80, "PIECE", START.minusSeconds(86_400));
    private final CbcRules.Card c = card("CAL", "OURO", 80, "PIECE", START.minusSeconds(86_400));
    private final CbcRules.Card extra = card("ACE", "BRONZE", 20, "AI", START.plusSeconds(86_400));

    private Map<String, CbcRules.Card> board(CbcRules.Card... placed) {
        String[] keys = {"a", "b", "c", "d", "e"};
        Map<String, CbcRules.Card> m = new LinkedHashMap<>();
        for (int i = 0; i < placed.length; i++) {
            if (placed[i] != null) {
                m.put(keys[i], placed[i]);
            }
        }
        return m;
    }

    @Test
    void vagasObrigatoriasContamEOpcionaisNao() {
        assertThat(CbcRules.requiredSlots(slots)).isEqualTo(3);
        assertThat(CbcRules.requiredSlots(null)).isZero();
        assertThat(slots.get(3).optional()).isTrue();
        assertThat(slots.get(0).optional()).isFalse();
        assertThat(new CbcRules.Slot("x", "SUP", Map.of("optional", "true")).optional()).isFalse();
    }

    @Test
    void completaComAsObrigatoriasESintoniaMaxContaTodasAsVagas() {
        CbcRules.Evaluation tres = CbcRules.evaluate(slots, board(a, b, c), List.of(), ctx);
        assertThat(tres.complete()).isTrue();
        assertThat(tres.ok()).isTrue();
        assertThat(tres.filled()).isEqualTo(3);
        assertThat(tres.sintoniaMax()).isEqualTo(15);
        assertThat(tres.slots().get(3).cardId()).isNull();
        assertThat(tres.sintonia()).isEqualTo(6);     // 3 × (posição + vizinhança); sem tema
        assertThat(Flair3dHype.perfect(tres, CbcRules.requiredSlots(slots))).isTrue();

        CbcRules.Evaluation faltaObrigatoria = CbcRules.evaluate(slots, board(a, null, c, extra), List.of(), ctx);
        assertThat(faltaObrigatoria.complete()).isFalse();
        assertThat(faltaObrigatoria.ok()).isFalse();
        assertThat(faltaObrigatoria.filled()).isEqualTo(3);

        CbcRules.Evaluation comOpcional = CbcRules.evaluate(slots, board(a, b, c, extra), List.of(), ctx);
        assertThat(comOpcional.complete()).isTrue();
        assertThat(comOpcional.filled()).isEqualTo(4);
        assertThat(comOpcional.sintonia()).isGreaterThanOrEqualTo(tres.sintonia());
    }

    @Test
    void vagaOpcionalPreenchidaAindaPrecisaSerAceita() {
        CbcRules.Evaluation ev = CbcRules.evaluate(slots, board(a, b, c, null, extra), List.of(), ctx);
        assertThat(ev.complete()).isTrue();
        assertThat(ev.slots().get(4).misses()).containsExactly("tier");
        assertThat(ev.ok()).isFalse();
        assertThat(CbcRules.misses(slots.get(3), extra)).isEmpty();        // "optional" não é uma exigência da carta
    }

    @Test
    void requisitosParaTodasAsCartasExigemSoAsObrigatorias() {
        List<Map<String, Object>> reqs = List.of(Map.of("type", "tier", "only", "OURO"), Map.of("type", "tier", "max", "OURO"),
                Map.of("type", "ovrAvg", "min", 80), Map.of("type", "origin"), Map.of("type", "noBuy"), Map.of("type", "strictPosition"),
                Map.of("type", "ovrMin", "min", 80), Map.of("type", "tier", "min", "OURO"), Map.of("type", "cards"));
        CbcRules.Evaluation tres = CbcRules.evaluate(slots, board(a, b, c), reqs, ctx);
        assertThat(tres.requirements()).allMatch(CbcRules.RequirementResult::ok);
        assertThat(tres.requirements()).extracting(CbcRules.RequirementResult::need).containsExactly(3, 3, 80, 3, 3, 3, 3, 3, 3);
        assertThat(tres.ok()).isTrue();

        // a carta da vaga opcional (Bronze, nota 20, IA, comprada depois) conta a favor, nunca contra
        CbcRules.Evaluation quatro = CbcRules.evaluate(slots, board(a, b, c, extra), reqs, ctx);
        assertThat(quatro.requirements()).extracting(CbcRules.RequirementResult::have).containsExactly(3, 4, 65, 3, 3, 4, 3, 3, 4);
        assertThat(quatro.requirements().get(0).ok()).isTrue();     // tier only: 3 Ouro ≥ 3 obrigatórias
        assertThat(quatro.requirements().get(2).ok()).isFalse();    // ovrAvg: a média cai para 65 (só a média reprova)
        assertThat(quatro.requirements().get(3).ok()).isTrue();     // origin: 3 PIECE ≥ 3
        assertThat(quatro.requirements().get(4).ok()).isTrue();     // noBuy: 3 antigas ≥ 3
        assertThat(quatro.requirements().get(5).ok()).isTrue();     // strictPosition: 4 ≥ 3

        CbcRules.Evaluation duas = CbcRules.evaluate(slots, board(a, b), List.of(Map.of("type", "ovrAvg", "min", 80)), ctx);
        assertThat(duas.requirements().get(0).ok()).isFalse();      // só duas cartas: a média ainda não vale
    }

    @Test
    void validacaoAceitaOptionalEOsLimitesDeCountOlhamTodasAsVagas() {
        assertThat(CbcRules.validate(slots, List.of(Map.of("type", "cards", "min", 5), Map.of("type", "theme", "count", 5)))).isEmpty();
        assertThat(CbcRules.validate(slots, List.of(Map.of("type", "theme", "count", 6)))).containsExactly("requirements.count:theme");
        assertThat(CbcRules.ACCEPT_KEYS).contains("optional");
        List<CbcRules.Slot> todasOpcionais = List.of(new CbcRules.Slot("a", "SUP", Map.of("optional", true)),
                new CbcRules.Slot("b", "INF", Map.of("optional", true)), new CbcRules.Slot("c", "CAL", Map.of("optional", true)));
        assertThat(CbcRules.validate(todasOpcionais, List.of())).isEmpty();
        CbcRules.Evaluation vazia = CbcRules.evaluate(todasOpcionais, Map.of(), List.of(), ctx);
        assertThat(vazia.complete()).isTrue();
        assertThat(vazia.sintoniaMax()).isEqualTo(9);
        assertThat(CbcRules.requiredSlots(todasOpcionais)).isZero();
        assertThat(Flair3dHype.perfect(vazia, 0)).isTrue();
    }
}
