package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.ApiException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Afterparty: movimento, portaria, distração, interações, acessos e validação das ações. */
class AfterpartyEngineRegrasTest {
    private int seq;

    private AfterpartyEngine.State game() {
        return AfterpartyEngine.start(List.of(
                new AfterpartyEngine.Loadout("staff", "Staff", "COMMON", "STAFF", "#123456", false, null, 10, 6000),
                new AfterpartyEngine.Loadout("guest", "Guest", "RARE", "GUEST", "#654321", true, null, 20, 9000),
                new AfterpartyEngine.Loadout("vip", "VIP", "LEGENDARY", "VIP", "#ffd700", false, null, 35, 14000)), 1000);
    }

    private void act(AfterpartyEngine.State s, String type, String deck, double dx, double dz, boolean running, long now) {
        AfterpartyEngine.apply(s, new AfterpartyEngine.Action(type, deck, dx, dz, running, "request_" + (++seq)), now);
    }

    @Test
    void acaoSemIdentificadorValidoOuDesconhecidaEhRecusada() {
        var s = game();
        assertThatThrownBy(() -> AfterpartyEngine.apply(s, null, 1000)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> AfterpartyEngine.apply(s, new AfterpartyEngine.Action("WAIT", null, 0, 0, false, null), 1000)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> AfterpartyEngine.apply(s, new AfterpartyEngine.Action("WAIT", null, 0, 0, false, "x"), 1000)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> act(s, "DANCE", null, 0, 0, false, 1000)).hasMessageContaining("desconhecida");
        assertThatThrownBy(() -> act(s, null, null, 0, 0, false, 1000)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> act(s, "ACTIVATE", "nope", 0, 0, false, 1000)).hasMessageContaining("deck");
        assertThatThrownBy(() -> act(s, "MOVE", null, Double.NaN, 0, false, 1000)).hasMessageContaining("Direção");
        assertThatThrownBy(() -> act(s, "MOVE", null, 0, Double.POSITIVE_INFINITY, false, 1000)).hasMessageContaining("Direção");
        assertThatThrownBy(() -> act(s, "MOVE", null, 0, -2, false, 1000)).hasMessageContaining("Direção");
    }

    @Test
    void esperarParaDeCorrerEPartidaEncerradaIgnoraAcoes() {
        var s = game();
        s.running = true;
        act(s, "WAIT", null, 0, 0, false, 1100);
        assertThat(s.running).isFalse();
        assertThat(s.feedback).isEqualTo("WAITING");
        s.status = "FAILED";
        act(s, "WAIT", null, 0, 0, false, 1200);
        assertThat(s.feedback).isEqualTo("WAITING");
        assertThat(s.requests).hasSize(1);
        AfterpartyEngine.tick(s, 5000);
        assertThat(s.lastTickAt).isEqualTo(1100);
    }

    @Test
    void historicoDeRequisicoesGuardaNoMaximo32() {
        var s = game();
        s.z = 6;
        for (int i = 0; i < 40; i++) {
            act(s, "WAIT", null, 0, 0, false, 1000);
        }
        assertThat(s.requests).hasSize(32);
    }

    @Test
    void ticarNaZonaVipSemAcessoDetectaRapido() {
        var s = game();
        s.z = -4;
        AfterpartyEngine.tick(s, 3000);
        assertThat(s.suspicion).isEqualTo(60);
        AfterpartyEngine.tick(s, 5000);
        assertThat(s.status).isEqualTo("FAILED");
        assertThat(s.feedback).isEqualTo("DETECTED");
    }

    @Test
    void foraDaVisaoASuspeitaCaiEDisfarceAtivoTambem() {
        var s = game();
        s.suspicion = 50;
        s.z = 6;
        AfterpartyEngine.tick(s, 2000);
        assertThat(s.suspicion).isEqualTo(43);
        s.z = 1;
        act(s, "ACTIVATE", "vip", 0, 0, false, 2000);
        AfterpartyEngine.tick(s, 4000);
        assertThat(s.suspicion).isEqualTo(33);
        var visto = game();
        visto.z = 1;
        AfterpartyEngine.tick(visto, 2000);
        assertThat(visto.suspicion).isEqualTo(18);
    }

    @Test
    void moverParadoNaoAndaECorrerComTechwearEhMaisRapido() {
        var s = game();
        s.z = 6;
        s.running = true;
        act(s, "MOVE", null, 0, 0, true, 1200);
        assertThat(s.running).isFalse();
        assertThat(s.z).isEqualTo(6);

        var t = game();
        t.z = 6;
        act(t, "ACTIVATE", "guest", 0, 0, false, 1000);
        act(t, "MOVE", null, 1, 0, true, 1400);
        assertThat(t.x).isCloseTo(1.52, org.assertj.core.data.Offset.offset(0.001));
        assertThat(t.feedback).isEqualTo("MOVING");
        assertThat(t.running).isTrue();

        var u = game();
        u.z = 6;
        act(u, "MOVE", null, 1, 0, true, 1400);
        assertThat(u.x).isCloseTo(1.2, org.assertj.core.data.Offset.offset(0.001));
        var v = game();
        v.z = 6;
        act(v, "MOVE", null, -1, 0, false, 1400);
        assertThat(v.x).isCloseTo(-0.8, org.assertj.core.data.Offset.offset(0.001));
    }

    @Test
    void portariaBloqueiaSemAcessoMasConvidadoPassaEStaffUsaEntradaLateral() {
        var s = game();
        s.z = 0.1;
        act(s, "MOVE", null, 0, -1, false, 1400);
        assertThat(s.feedback).isEqualTo("GATE_BLOCKED");
        assertThat(s.z).isEqualTo(0.1);

        var g = game();
        g.z = 0.1;
        act(g, "ACTIVATE", "guest", 0, 0, false, 1000);
        act(g, "MOVE", null, 0, -1, false, 1400);
        assertThat(g.z).isLessThan(0);
        // voltando pela portaria também é permitido com acesso
        act(g, "MOVE", null, 0, 1, false, 1800);
        assertThat(g.z).isGreaterThanOrEqualTo(0);

        var st = game();
        st.z = 0.1;
        st.x = 4;
        act(st, "ACTIVATE", "staff", 0, 0, false, 1000);
        act(st, "MOVE", null, 0, -1, false, 1400);
        assertThat(st.feedback).isEqualTo("MOVING");
        var central = game();
        central.z = 0.1;
        act(central, "ACTIVATE", "staff", 0, 0, false, 1000);
        act(central, "MOVE", null, 0, -1, false, 1400);
        assertThat(central.feedback).isEqualTo("GATE_BLOCKED");
    }

    @Test
    void distracaoExigeProximidadeDisfarceEnergiaERecarga() {
        var s = game();
        s.x = 4;
        act(s, "DISTRACT", null, 0, 0, false, 1000);
        assertThat(s.feedback).isEqualTo("TOO_FAR");
        s.x = 0;
        s.z = -1;
        act(s, "DISTRACT", null, 0, 0, false, 1000);
        assertThat(s.feedback).isEqualTo("TOO_FAR");
        s.z = 4;
        act(s, "DISTRACT", null, 0, 0, false, 1000);
        assertThat(s.feedback).isEqualTo("TOO_FAR");
        s.z = 3;
        act(s, "DISTRACT", null, 0, 0, false, 1000);
        assertThat(s.feedback).isEqualTo("DISGUISE_REQUIRED");
        act(s, "ACTIVATE", "staff", 0, 0, false, 1000);
        act(s, "DISTRACT", null, 0, 0, false, 1000);
        assertThat(s.feedback).isEqualTo("DISGUISE_REQUIRED");
        act(s, "ACTIVATE", "guest", 0, 0, false, 1000);
        s.x = -1;
        act(s, "DISTRACT", null, 0, 0, false, 1000);
        assertThat(s.feedback).isEqualTo("DISTRACTED");
        assertThat(s.distractionUntilLeft).isEqualTo(13000);
        act(s, "DISTRACT", null, 0, 0, false, 1000);
        assertThat(s.feedback).isEqualTo("COOLDOWN");
        s.x = 1;
        s.energy = 5;
        act(s, "DISTRACT", null, 0, 0, false, 7000);
        assertThat(s.feedback).isEqualTo("ENERGY_LOW");
        s.energy = 100;
        act(s, "DISTRACT", null, 0, 0, false, 7000);
        assertThat(s.distractionUntilRight).isEqualTo(19000);
        assertThat(AfterpartyEngine.vipAccess(s, 8000)).isTrue();
    }

    @Test
    void interacoesComCrachaItemESaida() {
        var s = game();
        s.x = 4;
        s.z = -2;
        act(s, "INTERACT", null, 0, 0, false, 1000);
        assertThat(s.feedback).isEqualTo("STAFF_REQUIRED");
        s.x = 0;
        s.z = -5.5;
        act(s, "INTERACT", null, 0, 0, false, 1000);
        assertThat(s.feedback).isEqualTo("VIP_BLOCKED");
        assertThat(s.item).isFalse();
        s.z = 5;
        act(s, "INTERACT", null, 0, 0, false, 1000);
        assertThat(s.feedback).isEqualTo("TOO_FAR");
        s.z = 1;
        act(s, "INTERACT", null, 0, 0, false, 1000);
        assertThat(s.feedback).isEqualTo("TOO_FAR");
    }

    @Test
    void acessosPorPapel() {
        var s = game();
        assertThat(AfterpartyEngine.effectActive(s, 1000)).isFalse();
        assertThat(AfterpartyEngine.mainAccess(s, 1000)).isFalse();
        act(s, "ACTIVATE", "guest", 0, 0, false, 1000);
        assertThat(AfterpartyEngine.mainAccess(s, 1000)).isTrue();
        assertThat(AfterpartyEngine.vipAccess(s, 1000)).isFalse();
        assertThat(AfterpartyEngine.effectActive(s, 30000)).isFalse();
        s.distractionUntilLeft = 5000;
        assertThat(AfterpartyEngine.vipAccess(s, 30000)).isFalse();
    }
}
