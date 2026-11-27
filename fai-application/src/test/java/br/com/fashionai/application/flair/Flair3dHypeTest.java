package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.Flair3dHype.Band;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** FLAIR 3D — faixas de Hype (limiares exatos), teto, bônus de jogada, faixa de partida e "perfeito". */
class Flair3dHypeTest {
    private static CbcRules.Card card(Map<String, Double> hype) {
        return new CbcRules.Card(UUID.randomUUID(), "SUP", "OURO", 80, "Norte", "PIECE", Set.of("street"), Set.of("black"), Set.of(), Set.of(), hype,
                null, null);
    }

    private static CbcRules.Card hyp(double v) {
        return card(Map.of("HYP", v));
    }

    private static CbcRules.SlotResult slot(UUID cardId, int sintonia) {
        return new CbcRules.SlotResult("s", "SUP", cardId, sintonia > 0, sintonia > 1, sintonia > 2, sintonia);
    }

    @Test
    void faixasPelosLimiaresExatos() {
        assertThat(Flair3dHype.bandOf(hyp(0))).isEqualTo(Band.LOW_SIGNAL);
        assertThat(Flair3dHype.bandOf(hyp(19.9))).isEqualTo(Band.LOW_SIGNAL);
        assertThat(Flair3dHype.bandOf(hyp(20))).isEqualTo(Band.NICHE);
        assertThat(Flair3dHype.bandOf(hyp(39))).isEqualTo(Band.NICHE);
        assertThat(Flair3dHype.bandOf(hyp(40))).isEqualTo(Band.RELEVANT);
        assertThat(Flair3dHype.bandOf(hyp(59))).isEqualTo(Band.RELEVANT);
        assertThat(Flair3dHype.bandOf(hyp(60))).isEqualTo(Band.HOT);
        assertThat(Flair3dHype.bandOf(hyp(74))).isEqualTo(Band.HOT);
        assertThat(Flair3dHype.bandOf(hyp(75))).isEqualTo(Band.TRENDING);
        assertThat(Flair3dHype.bandOf(hyp(89))).isEqualTo(Band.TRENDING);
        assertThat(Flair3dHype.bandOf(hyp(90))).isEqualTo(Band.VIRAL);
        assertThat(Flair3dHype.bandOf(hyp(100))).isEqualTo(Band.VIRAL);
        assertThat(Flair3dHype.bandOf(-5)).isEqualTo(Band.LOW_SIGNAL);
        // sem Hype público (ou só outras dimensões) = LOW_SIGNAL
        assertThat(Flair3dHype.bandOf(card(null))).isEqualTo(Band.LOW_SIGNAL);
        assertThat(Flair3dHype.bandOf(card(Map.of("POP", 99.0)))).isEqualTo(Band.LOW_SIGNAL);
        assertThat(Flair3dHype.bandOf((CbcRules.Card) null)).isEqualTo(Band.LOW_SIGNAL);
        assertThat(Flair3dHype.THRESHOLDS).containsExactly(20, 40, 60, 75, 90);
    }

    @Test
    void nomeDeFaixaDoJson() {
        assertThat(Flair3dHype.parse("hot", null)).isEqualTo(Band.HOT);
        assertThat(Flair3dHype.parse(" Viral ", null)).isEqualTo(Band.VIRAL);
        assertThat(Flair3dHype.parse(null, Band.NICHE)).isEqualTo(Band.NICHE);
        assertThat(Flair3dHype.parse("ultra", Band.NICHE)).isEqualTo(Band.NICHE);
        assertThat(Flair3dHype.parse(3, null)).isNull();
    }

    @Test
    void tetoSoRebaixaEDeslocamentoFicaEntreAsPontas() {
        assertThat(Flair3dHype.clampMax(Band.VIRAL, Band.TRENDING)).isEqualTo(Band.TRENDING);
        assertThat(Flair3dHype.clampMax(Band.NICHE, Band.TRENDING)).isEqualTo(Band.NICHE);
        assertThat(Flair3dHype.clampMax(Band.VIRAL, null)).isEqualTo(Band.VIRAL);
        assertThat(Flair3dHype.clampMax(null, Band.HOT)).isEqualTo(Band.LOW_SIGNAL);
        assertThat(Flair3dHype.shifted(Band.LOW_SIGNAL, -1)).isEqualTo(Band.LOW_SIGNAL);
        assertThat(Flair3dHype.shifted(Band.VIRAL, 1)).isEqualTo(Band.VIRAL);
        assertThat(Flair3dHype.shifted(Band.HOT, 1)).isEqualTo(Band.TRENDING);
        assertThat(Flair3dHype.shifted(Band.HOT, -1)).isEqualTo(Band.RELEVANT);
        assertThat(Flair3dHype.shifted(Band.HOT, 0)).isEqualTo(Band.HOT);
        assertThat(Flair3dHype.shifted(null, 2)).isEqualTo(Band.RELEVANT);
    }

    @Test
    void bonusDeJogadaAcimaDeRelevante() {
        Map<String, Object> rule = Map.of("mode", "BONUS_ABOVE_RELEVANT");
        assertThat(Flair3dHype.playBonus(hyp(95), rule, null)).isEqualTo(3);          // VIRAL: 3 faixas acima
        assertThat(Flair3dHype.playBonus(hyp(80), rule, null)).isEqualTo(2);          // TRENDING
        assertThat(Flair3dHype.playBonus(hyp(60), rule, null)).isEqualTo(1);          // HOT
        assertThat(Flair3dHype.playBonus(hyp(45), rule, null)).isZero();              // RELEVANT
        assertThat(Flair3dHype.playBonus(hyp(5), rule, null)).isZero();
        assertThat(Flair3dHype.playBonus(hyp(95), rule, Band.HOT)).isEqualTo(1);      // o teto rebaixa antes do bônus
        assertThat(Flair3dHype.playBonus(hyp(95), Map.of("mode", "bonus_above_relevant", "cap", 2), null)).isEqualTo(2);
        assertThat(Flair3dHype.playBonus(hyp(95), Map.of("mode", "BONUS_ABOVE_RELEVANT", "cap", 0), null)).isZero();
    }

    @Test
    void bonusDeJogadaNosOutrosModos() {
        assertThat(Flair3dHype.playBonus(hyp(95), null, null)).isZero();
        assertThat(Flair3dHype.playBonus(hyp(95), Map.of(), null)).isZero();
        assertThat(Flair3dHype.playBonus(hyp(95), Map.of("mode", "NONE"), null)).isZero();
        assertThat(Flair3dHype.playBonus(hyp(95), Map.of("mode", "TIEBREAK"), null)).isZero();
        assertThat(Flair3dHype.playBonus(hyp(95), Map.of("mode", "inventado"), null)).isZero();
        Map<String, Object> low = Map.of("mode", "LOW_IS_GOOD");
        assertThat(Flair3dHype.playBonus(hyp(10), low, null)).isEqualTo(2);
        assertThat(Flair3dHype.playBonus(hyp(39), low, null)).isEqualTo(2);
        assertThat(Flair3dHype.playBonus(hyp(40), low, null)).isZero();
        assertThat(Flair3dHype.playBonus(card(null), Map.of("mode", "LOW_IS_GOOD", "bonus", 5), null)).isEqualTo(5);
        assertThat(Flair3dHype.playBonus(hyp(95), low, Band.NICHE)).isEqualTo(2);     // teto NICHE: até a VIRAL joga como nicho
        Map<String, Object> dim = Map.of("mode", "DIMENSION", "dim", "ORI");
        assertThat(Flair3dHype.playBonus(card(Map.of("ORI", 24.0)), dim, null)).isZero();
        assertThat(Flair3dHype.playBonus(card(Map.of("ORI", 25.0)), dim, null)).isEqualTo(1);
        assertThat(Flair3dHype.playBonus(card(Map.of("ORI", 74.0)), dim, null)).isEqualTo(2);
        assertThat(Flair3dHype.playBonus(card(Map.of("ORI", 100.0)), dim, null)).isEqualTo(3);     // 4 passos, teto 3
        assertThat(Flair3dHype.playBonus(card(Map.of("ORI", 100.0)), Map.of("mode", "DIMENSION", "dim", "ori", "per", 10, "cap", 5), null)).isEqualTo(5);
        assertThat(Flair3dHype.playBonus(card(Map.of("POP", 100.0)), dim, null)).isZero();          // sem a dimensão = 0
        assertThat(Flair3dHype.playBonus(card(Map.of("ORI", 100.0)), Map.of("mode", "DIMENSION", "dim", "ORI", "per", 0), null)).isEqualTo(3);
        assertThat(Flair3dHype.playBonus(card(Map.of("ORI", 100.0)), dim, Band.LOW_SIGNAL)).isEqualTo(3);  // o teto é do HYP, não da dimensão
        assertThat(Flair3dHype.PLAY_MODES).containsExactly("NONE", "BONUS_ABOVE_RELEVANT", "LOW_IS_GOOD", "DIMENSION", "TIEBREAK");
    }

    @Test
    void faixaDeParticaoPorSintoniaDaVaga() {
        UUID id = UUID.randomUUID();
        assertThat(Flair3dHype.partialShift(slot(id, 3), null, true)).isZero();
        assertThat(Flair3dHype.partialShift(slot(id, 3), Map.of("mode", "NONE"), true)).isZero();
        Map<String, Object> up = Map.of("mode", "UP_ONLY");
        assertThat(Flair3dHype.partialShift(slot(id, 2), up, false)).isEqualTo(1);
        assertThat(Flair3dHype.partialShift(slot(id, 3), up, false)).isEqualTo(1);
        assertThat(Flair3dHype.partialShift(slot(id, 1), up, false)).isZero();
        assertThat(Flair3dHype.partialShift(slot(id, 0), up, false)).isZero();
        Map<String, Object> upDown = Map.of("mode", "up_down");
        assertThat(Flair3dHype.partialShift(slot(id, 2), upDown, false)).isEqualTo(1);
        assertThat(Flair3dHype.partialShift(slot(id, 1), upDown, false)).isZero();
        assertThat(Flair3dHype.partialShift(slot(id, 0), upDown, false)).isEqualTo(-1);
        assertThat(Flair3dHype.partialShift(slot(null, 0), upDown, false)).isZero();       // vaga vazia não cai
        Map<String, Object> all = Map.of("mode", "ALL_UP_IF_COMPLETE");
        assertThat(Flair3dHype.partialShift(slot(id, 0), all, true)).isEqualTo(1);
        assertThat(Flair3dHype.partialShift(slot(id, 3), all, false)).isZero();
        assertThat(Flair3dHype.partialShift(null, all, true)).isEqualTo(1);
        assertThat(Flair3dHype.partialShift(null, up, true)).isZero();
        assertThat(Flair3dHype.PARTIAL_MODES).containsExactly("NONE", "UP_ONLY", "UP_DOWN", "ALL_UP_IF_COMPLETE");
        assertThat(Flair3dHype.shifted(Flair3dHype.bandOf(hyp(60)), Flair3dHype.partialShift(slot(id, 2), upDown, false))).isEqualTo(Band.TRENDING);
    }

    @Test
    void perfeitoSemTema() {
        List<CbcRules.Slot> slots = List.of(new CbcRules.Slot("a", "SUP"), new CbcRules.Slot("b", "INF"), new CbcRules.Slot("c", "CAL"),
                new CbcRules.Slot("d", "ACE", Map.of("optional", true)));
        CbcRules.Card a = new CbcRules.Card(UUID.randomUUID(), "SUP", "OURO", 80, "Norte", "PIECE", Set.of("street"), Set.of("black"), Set.of(), Set.of(),
                Map.of(), null, null);
        CbcRules.Card b = new CbcRules.Card(UUID.randomUUID(), "INF", "OURO", 80, "Norte", "PIECE", Set.of("street"), Set.of("navy"), Set.of(), Set.of(),
                Map.of(), null, null);
        CbcRules.Card c = new CbcRules.Card(UUID.randomUUID(), "CAL", "OURO", 80, "Norte", "PIECE", Set.of("street"), Set.of("white"), Set.of(), Set.of(),
                Map.of(), null, null);
        CbcRules.Context semTema = new CbcRules.Context(null, null, null, null, null, null, null);
        CbcRules.Evaluation ev = CbcRules.evaluate(slots, Map.of("a", a, "b", b, "c", c), List.of(), semTema);
        assertThat(ev.sintonia()).isEqualTo(6);
        assertThat(ev.sintoniaMax()).isEqualTo(12);
        assertThat(ev.ok()).isTrue();
        assertThat(Flair3dHype.perfect(ev, CbcRules.requiredSlots(slots))).isTrue();      // 6 ≥ 2 × 3, sem ponto de tema
        assertThat(Flair3dHype.perfect(ev, 4)).isFalse();
        CbcRules.Card fora = new CbcRules.Card(UUID.randomUUID(), "VES", "OURO", 80, "Outra", "PIECE", Set.of("glam"), Set.of("red"), Set.of(), Set.of(),
                Map.of(), null, null);
        CbcRules.Evaluation menor = CbcRules.evaluate(slots, Map.of("a", a, "b", b, "c", fora), List.of(), semTema);
        assertThat(menor.ok()).isTrue();
        assertThat(Flair3dHype.perfect(menor, 3)).isFalse();
        CbcRules.Evaluation reprovada = CbcRules.evaluate(slots, Map.of("a", a, "b", b, "c", c), List.of(Map.of("type", "cards", "min", 4)), semTema);
        assertThat(Flair3dHype.perfect(reprovada, 3)).isFalse();
        assertThat(Flair3dHype.perfect(null, 3)).isFalse();
    }
}
