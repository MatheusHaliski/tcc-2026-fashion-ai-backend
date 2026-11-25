package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Andamento.UsoDeRecurso;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.esporte.EsporteForcas;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.naRodada;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * A peça usada como recurso dentro dos motores próprios (Flair3dRecursoNoMotor): vale a partir do lance, da jogada ou
 * do salão em que foi usada; sem uso, a partida é a mesma de antes.
 */
class Flair3dRecursoNosMotoresTest {
    final CbcRules.Card vermelha = card("SUP", "color:red", "ovr:55");
    final CbcRules.Card preta = card("INF", "color:black", "ovr:55");
    final CbcRules.Card verde = card("CAL", "color:green", "sub:casual_sneakers", "ovr:55");
    final CbcRules.Card amarela = card("ACE", "color:yellow", "ovr:55");
    final CbcRules.Card[] deck = {vermelha, preta, verde, amarela};
    final List<Acionamento> lances = List.of(new Acionamento(vermelha.id(), null), new Acionamento(preta.id(), null),
            new Acionamento(verde.id(), null), new Acionamento(amarela.id(), null));

    private Resultado lutar(List<UsoDeRecurso> usos) {
        Andamento a = new Andamento(1, lances, List.of(), null, null, usos);
        return new DressFighterNucleo().pontuar(vestir(vermelha, preta, verde, amarela), naRodada(null, 7L, deck).comAndamento(a));
    }

    @SuppressWarnings("unchecked")
    private static int vidaVoce(Resultado r) {
        Map<String, Object> luta = (Map<String, Object>) r.eventos().stream().filter(e -> e.codigo().equals("LUTA")).reduce((a, b) -> b).orElseThrow().valor();
        return ((Number) luta.get("vidaVoce")).intValue();
    }

    @Test
    void naLutaAPecaUsadaCuraNoLanceEmQueFoiUsadaESemUsoNadaMuda() {
        Resultado sem = lutar(List.of());
        assertThat(lutar(List.of())).isEqualTo(sem);
        int vidaSem = vidaVoce(sem);
        // a vida só cura se a pessoa já levou golpe; a cura entra no último lance jogado
        UsoDeRecurso cura = new UsoDeRecurso(UUID.randomUUID(), "VIDA", 25, "p", lances.size() - 1, 0);
        int vidaCom = vidaVoce(lutar(List.of(cura)));
        assertThat(vidaCom).isBetween(vidaSem, Math.min(100, vidaSem + 25));
        if (vidaSem < 100) assertThat(vidaCom).isGreaterThan(vidaSem);
        // usada num lance que ainda não aconteceu, não muda nada do que já aconteceu
        UsoDeRecurso depois = new UsoDeRecurso(UUID.randomUUID(), "VIDA", 25, "q", lances.size() + 3, 0);
        assertThat(vidaVoce(lutar(List.of(depois)))).isEqualTo(vidaSem);
    }

    @Test
    void noEsporteAEnergiaDevolveOFolegoAPartirDaJogada() {
        EsporteForcas.Time time = new EsporteForcas.Time(20, 20, 0, 20, 20);
        EsporteForcas.Time recarregado = time.comRecargas(List.of(10));
        assertThat(recarregado.folego(5)).isEqualTo(time.folego(5));
        assertThat(recarregado.folego(10)).isEqualTo(1.0);
        assertThat(recarregado.folego(12)).isGreaterThan(time.folego(12));
    }

    @Test
    void noDetetiveVidaEFocoUsadosSomamNoSalao() {
        Map<String, CbcRules.Card> look = Map.of("SUP", vermelha, "INF", preta);
        FashionDetectiveSalao sem = new FashionDetectiveSalao(1, look, new FashionDetectiveMercado());
        FashionDetectiveSalao com = new FashionDetectiveSalao(1, look, new FashionDetectiveMercado(), 25, 40);
        Map<String, Object> m1 = medidores(sem);
        Map<String, Object> m2 = medidores(com);
        assertThat(((Number) m2.get("VIDA")).longValue()).isEqualTo(((Number) m1.get("VIDA")).longValue() + 25);
        assertThat(((Number) m2.get("FURTIVIDADE")).longValue()).isEqualTo(((Number) m1.get("FURTIVIDADE")).longValue() + 40);
    }

    private static Map<String, Object> medidores(FashionDetectiveSalao s) {
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        s.medidores().forEach(e -> out.put(e.codigo(), e.valor()));
        return out;
    }
}
