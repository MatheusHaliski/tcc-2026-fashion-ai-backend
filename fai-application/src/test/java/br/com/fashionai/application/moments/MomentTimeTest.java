package br.com.fashionai.application.moments;

import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.enums.MomentStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.YearMonth;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Momentos §54 — status efetivo pelo relógio do servidor; calendário no fuso do Momento, nunca no do navegador. */
class MomentTimeTest {
    private Moment halloween() {
        Moment m = new Moment();
        m.setStatus(MomentStatus.SCHEDULED);
        m.setStartAt(Instant.parse("2026-10-20T03:00:00Z"));   // 00:00 em São Paulo
        m.setEndAt(Instant.parse("2026-11-01T02:59:59Z"));     // 23:59:59 de 31/10 em São Paulo
        m.setTimezone("America/Sao_Paulo");
        return m;
    }

    @Test
    void statusEfetivoSegueORelogioMesmoAntesDoJob() {
        Moment m = halloween();
        assertThat(MomentTime.effective(m, Instant.parse("2026-10-19T12:00:00Z"))).isEqualTo(MomentStatus.SCHEDULED);
        assertThat(MomentTime.effective(m, Instant.parse("2026-10-25T12:00:00Z"))).isEqualTo(MomentStatus.ACTIVE);
        assertThat(MomentTime.effective(m, Instant.parse("2026-11-02T12:00:00Z"))).isEqualTo(MomentStatus.ENDED);
        m.setStatus(MomentStatus.CANCELLED);
        assertThat(MomentTime.effective(m, Instant.parse("2026-10-25T12:00:00Z"))).isEqualTo(MomentStatus.CANCELLED);
    }

    @Test
    void diasLocaisECalendarioNoFusoDoMomento() {
        Moment m = halloween();
        assertThat(MomentTime.localStart(m).toString()).isEqualTo("2026-10-20");
        assertThat(MomentTime.localEnd(m).toString()).isEqualTo("2026-10-31");   // e não 01/11 (UTC)
        assertThat(MomentTime.touches(m, YearMonth.of(2026, 10))).isTrue();
        assertThat(MomentTime.touches(m, YearMonth.of(2026, 11))).isFalse();
    }

    @Test
    void contagemRegressivaEmSegundosVemDoServidor() {
        Moment m = halloween();
        Map<String, Object> v = MomentTime.view(m, Instant.parse("2026-10-25T03:00:00Z"));
        assertThat(v.get("status")).isEqualTo("ACTIVE");
        assertThat(v.get("endsInSeconds")).isEqualTo(6L * 86400 + 86399);
        assertThat(v.get("daysLeft")).isEqualTo(7);
        assertThat((Double) v.get("elapsed")).isBetween(0.4, 0.5);
        Map<String, Object> before = MomentTime.view(m, Instant.parse("2026-10-17T03:00:00Z"));
        assertThat(before.get("startsInSeconds")).isEqualTo(3L * 86400);
        assertThat(before.get("daysLeft")).isNull();
    }

    @Test
    void fusoInvalidoCaiNoPadraoSemQuebrar() {
        assertThat(MomentTime.zone("Marte/Olympus").getId()).isEqualTo("America/Sao_Paulo");
        assertThat(MomentTime.zone("Europe/Lisbon").getId()).isEqualTo("Europe/Lisbon");
    }
}
