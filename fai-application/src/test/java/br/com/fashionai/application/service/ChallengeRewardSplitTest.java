package br.com.fashionai.application.service;

import br.com.fashionai.application.service.ChallengeRewardSplit.Member;
import br.com.fashionai.application.service.ChallengeRewardSplit.Outcome;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Estratégias puras de divisão da recompensa por modo (sem Spring, repositório ou relógio). */
class ChallengeRewardSplitTest {
    private static final UUID A = UUID.randomUUID();
    private static final UUID B = UUID.randomUUID();
    private static final UUID C = UUID.randomUUID();

    private static Member m(UUID id, String team, double fraction) {
        return new Member(id, team, BigDecimal.valueOf(fraction));
    }

    @Test
    void modoEscolheAEstrategia() {
        assertThat(ChallengeRewardSplit.forMode("EQUIPE")).isEqualTo(ChallengeRewardSplit.TEAM);
        assertThat(ChallengeRewardSplit.forMode("DUELO")).isEqualTo(ChallengeRewardSplit.DUEL);
        assertThat(ChallengeRewardSplit.forMode("SOLO")).isEqualTo(ChallengeRewardSplit.INDIVIDUAL);
        assertThat(ChallengeRewardSplit.forMode("COMUNIDADE")).isEqualTo(ChallengeRewardSplit.INDIVIDUAL);
        assertThatThrownBy(() -> ChallengeRewardSplit.forMode(null)).isInstanceOf(NullPointerException.class);
    }

    @Test
    void equipeNoPisoExatoDe25PorCentoJaPontua() {
        Outcome o = ChallengeRewardSplit.TEAM.split(List.of(m(A, "A", 0.25), m(B, "A", 0.25)), Map.of(), 100);
        assertThat(o.points()).containsExactly(12, 12);   // pote 25 → 25/2 = 12 (divisão inteira)
        assertThat(o.summary()).containsExactly(Map.entry("teamFraction", 0.25), Map.entry("rewardEach", 12));
        assertThat(o.winners()).isEmpty();
    }

    @Test
    void equipeVaziaNaoDivide() {
        Outcome o = ChallengeRewardSplit.TEAM.split(List.of(), Map.of(), 100);
        assertThat(o.points()).isEmpty();
        assertThat(o.summary()).containsEntry("teamFraction", 0.0).containsEntry("rewardEach", 0);
    }

    @Test
    void individualTemTetoDe100PorCentoEPisoDe25() {
        Outcome o = ChallengeRewardSplit.INDIVIDUAL.split(List.of(m(A, null, 1.5), m(B, null, 0.24), m(C, null, 0.25)), Map.of(), 80);
        assertThat(o.points()).containsExactly(80, 0, 20);
        assertThat(o.summary()).containsExactly(Map.entry("fraction", 1.5));
    }

    @Test
    void dueloNaoLeOProgresso() {
        // no duelo o progresso não é lido (como antes): membro sem fração não quebra a divisão
        Outcome o = ChallengeRewardSplit.DUEL.split(List.of(new Member(A, null, null), new Member(B, null, null)),
                Map.of(A, 2.0, B, 1.0), 100);
        assertThat(o.points()).containsExactly(100, 25);
        assertThat(o.winners()).containsExactly(A);
        assertThat(o.summary()).isEmpty();
    }

    @Test
    void dueloSemPontuacaoNinguemVence() {
        Outcome o = ChallengeRewardSplit.DUEL.split(List.of(m(A, null, 0), m(B, null, 0)), Map.of(), 150);
        assertThat(o.points()).containsExactly(37, 37);
        assertThat(o.winners()).isEmpty();
    }

    @Test
    void dueloPorTimesComMediaETimeNuloContaComoA() {
        Outcome o = ChallengeRewardSplit.DUEL.split(List.of(m(A, null, 0), m(B, "B", 0), m(C, "A", 0)),
                Map.of(A, 4.0, B, 2.0, C, 6.0), 200);
        assertThat(o.summary().get("teams")).isEqualTo(Map.of("A", 5.0, "B", 2.0));
        assertThat(o.points()).containsExactly(200, 50, 200);
        assertThat(o.winners()).containsExactly(A, C);
    }

    @Test
    void dueloPorTimesTodosZeradosNinguemVence() {
        Outcome o = ChallengeRewardSplit.DUEL.split(List.of(m(A, "A", 0), m(B, "B", 0)), Map.of(), 100);
        assertThat(o.winners()).isEmpty();
        assertThat(o.points()).containsExactly(25, 25);
        assertThat(o.summary().get("teams")).isEqualTo(Map.of("A", 0.0, "B", 0.0));
    }
}
