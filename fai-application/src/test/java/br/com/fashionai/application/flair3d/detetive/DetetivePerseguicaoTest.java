package br.com.fashionai.application.flair3d.detetive;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Vigias que perseguem (pedido da dona: inimigos com movimento e mecânica de confronto, sem arma e sem sangue), na
 * entrada da gala: o segurança faz a ronda no fundo da sala, de x −3,5 a 3,5, olhando para onde vai.
 */
class DetetivePerseguicaoTest {
    private static DetetiveEstado naPortaDoSalao(int passo) {
        DetetiveEstado e = new DetetiveEstado();
        e.ponto = "portaSalao";
        e.passo = passo;
        return e;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> vigia(DetetiveEstado e) {
        Map<String, Object> layout = (Map<String, Object>) e.retrato(List.of(), 0).get("layout");
        return ((List<Map<String, Object>>) layout.get("vigias")).get(0);
    }

    @Test
    void quemEntraNoConeEVistoEOVigiaSaiAtrasSemPerderVidaAinda() {
        DetetiveEstado e = naPortaDoSalao(0);
        DetetivePerseguicao.depoisDoPasso(e);
        assertThat(e.avisos).containsExactly("VISTO:SEG_ENTRADA");
        assertThat(e.vida).isEqualTo(DetetiveEstado.VIDA);
        assertThat(vigia(e)).containsEntry("modo", "PERSEGUE");
    }

    @Test
    void ficarParadoPertoDoVigiaQuePersegueEhSerPego() {
        DetetiveEstado e = naPortaDoSalao(0);
        DetetivePerseguicao.depoisDoPasso(e);
        e.avisos.clear();
        e.passo = 1;
        DetetivePerseguicao.depoisDoPasso(e);
        assertThat(e.avisos).containsExactly("PEGO:SEG_ENTRADA");
        assertThat(e.vida).isEqualTo(DetetiveEstado.VIDA - 1);
        assertThat(e.ponto).isEqualTo(e.chegada);
        assertThat(vigia(e)).containsEntry("modo", "VOLTA");
    }

    @Test
    void esconderQuebraALinhaDeVisaoOVigiaProcuraEVoltaARonda() {
        DetetiveEstado e = naPortaDoSalao(0);
        DetetivePerseguicao.depoisDoPasso(e);
        e.ponto = "coluna";
        e.escondido = true;
        e.passo = 1;
        e.avisos.clear();
        DetetivePerseguicao.depoisDoPasso(e);
        assertThat(e.avisos).containsExactly("ESCAPOU:SEG_ENTRADA");
        assertThat(vigia(e)).containsEntry("modo", "PROCURA");
        e.passo = 2;
        DetetivePerseguicao.depoisDoPasso(e);
        assertThat(vigia(e)).containsEntry("modo", "VOLTA");
        for (int passo = 3; passo < 8 && e.alertas.containsKey("SEG_ENTRADA"); passo++) {
            e.passo = passo;
            DetetivePerseguicao.depoisDoPasso(e);
        }
        assertThat(vigia(e)).containsEntry("modo", "RONDA");
        assertThat(e.vida).isEqualTo(DetetiveEstado.VIDA);
    }

    @Test
    void oVigiaConvencidoNaoPersegueEMudarDeSalaEsqueceAPerseguicao() {
        DetetiveEstado convencido = naPortaDoSalao(0);
        convencido.convencidos.add("SEG_ENTRADA");
        DetetivePerseguicao.depoisDoPasso(convencido);
        assertThat(convencido.avisos).isEmpty();

        DetetiveEstado e = naPortaDoSalao(0);
        DetetivePerseguicao.depoisDoPasso(e);
        DetetiveAcoes.entrar(e, "SALAO");
        e.passo = 1;
        DetetivePerseguicao.depoisDoPasso(e);
        assertThat(e.alertas).doesNotContainKey("SEG_ENTRADA");
    }

    @Test
    void oVigiaAndaMaisDevagarQueAPessoa() {
        assertThat(DetetivePerseguicao.PASSO_DO_VIGIA).isLessThan(DetetiveSala.PASSO);
        DetetiveSala.Ponto de = new DetetiveSala.Ponto("a", 0, 0, false);
        DetetiveSala.Ponto ate = DetetivePerseguicao.andar(de, new DetetiveSala.Ponto("b", 6, 0, false), DetetivePerseguicao.PASSO_DO_VIGIA);
        assertThat(ate.x()).isEqualTo(DetetivePerseguicao.PASSO_DO_VIGIA);
    }
}
