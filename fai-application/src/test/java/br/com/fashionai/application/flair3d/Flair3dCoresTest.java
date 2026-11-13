package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.nucleos.FashionDetectiveNucleo;
import br.com.fashionai.application.flair3d.nucleos.FashionSportsNucleo;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.contexto;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * A cor da peça decide a ação (docs/flair/flair-3d/CORES_E_ACOES.md): a tabela de cada jogo, os lances do segundo tempo do
 * FASHION_SPORTS disparados pela peça que entra e o que as cores do look dão ao detetive.
 */
class Flair3dCoresTest {
    private static Acionamento troca(String vaga, CbcRules.Card entra) {
        return new Acionamento(null, new Acionamento.Troca(vaga, entra.id()));
    }

    /** O campo dado de cada evento LANCE, na ordem. */
    private static List<Object> lances(Resultado r, String campo) {
        return r.eventos().stream().filter(e -> e.codigo().equals("LANCE")).map(e -> (Object) ((Map<?, ?>) e.valor()).get(campo)).toList();
    }

    private static Object valor(Resultado r, String codigo) {
        return r.eventos().stream().filter(e -> e.codigo().equals(codigo)).map(Resultado.Evento::valor).findFirst().orElse(null);
    }

    @Test
    void cadaFamiliaDeCorTemUmaAcaoPorJogoEPecaSemCorMapeadaNaoTemAcao() {
        assertThat(Flair3dCores.acao(Flair3dCores.ESPORTE, card("SUP", "color:black"))).isEqualTo("DEFESA");
        assertThat(Flair3dCores.acao(Flair3dCores.ESPORTE, card("SUP", "color:emerald"))).isEqualTo("CHUTE");
        assertThat(Flair3dCores.acao(Flair3dCores.ESPORTE, card("SUP", "color:mustard"))).isEqualTo("DRIBLE");
        assertThat(Flair3dCores.acao(Flair3dCores.ESPORTE, card("SUP", "color:navy"))).isEqualTo("CORRIDA");
        assertThat(Flair3dCores.acao(Flair3dCores.DETETIVE, card("SUP", "color:green"))).isEqualTo("ABRIR");
        assertThat(Flair3dCores.acao(Flair3dCores.DETETIVE, card("SUP", "color:charcoal"))).isEqualTo("FURTIVIDADE");
        assertThat(Flair3dCores.acao(Flair3dCores.DETETIVE, card("SUP", "color:yellow"))).isEqualTo("VIDA");
        assertThat(Flair3dCores.acao(Flair3dCores.DETETIVE, card("SUP", "color:blue"))).isEqualTo("DANO");
        assertThat(Flair3dCores.acao(Flair3dCores.DETETIVE, card("SUP", "color:white"))).isEqualTo("PISTA");
        assertThat(Flair3dCores.acao(Flair3dCores.DETETIVE, card("SUP", "color:red"))).isEqualTo("MOEDA");
        assertThat(Flair3dCores.acao(Flair3dCores.ESPORTE, card("SUP"))).isNull();
        assertThat(Flair3dCores.acao(Flair3dCores.ESPORTE, null)).isNull();
    }

    @Test
    void pecaQueEntraDisparaAAcaoDaCorNaHoraEAPartidaSegueAteOApito() {
        CbcRules.Card sup = card("SUP", "ovr:60");
        CbcRules.Card inf = card("INF", "ovr:60");
        CbcRules.Card cal = card("CAL", "ovr:60");
        CbcRules.Card verde = card("SUP", "ovr:60", "color:green");
        CbcRules.Card preto = card("INF", "ovr:60", "color:black");
        CbcRules.Card[] deck = {sup, inf, cal, verde, preto};
        FashionSportsNucleo n = new FashionSportsNucleo();

        Resultado chute = n.pontuar(vestir(sup, inf, cal), contexto(7L, deck).comAndamento(Andamento.de(troca("SUP", verde))));
        assertThat(chute.status()).isEqualTo("EM_ACAO");
        assertThat(valor(chute, "LANCE")).isEqualTo(Map.of("lance", 1, "acao", "CHUTE", "carta", verde.id(), "venceu", true));
        assertThat(chute.eventos()).extracting(Resultado.Evento::codigo).doesNotContain("PLACAR");

        Andamento doisLances = Andamento.de(troca("SUP", verde), troca("INF", preto), Acionamento.NENHUM);
        Resultado fim = n.pontuar(vestir(sup, inf, cal), contexto(7L, deck).comAndamento(doisLances));
        assertThat(fim.fecha()).isTrue();
        assertThat(lances(fim, "acao")).containsExactly("CHUTE", "DEFESA");
        assertThat(fim.cartas()).extracting(Resultado.CartaPontos::cardId).containsExactly(verde.id(), preto.id(), cal.id());
        assertThat(n.pontuar(vestir(sup, inf, cal), contexto(7L, deck).comAndamento(doisLances))).isEqualTo(fim);
    }

    @Test
    void chuteViraGolComTecnicaEDesarmeTiraOGolDoAdversario() {
        CbcRules.Card sup = card("SUP", "ovr:10");
        CbcRules.Card inf = card("INF", "ovr:10");
        CbcRules.Card cal = card("CAL", "ovr:10");
        CbcRules.Card preto = card("INF", "ovr:10", "color:black");
        CbcRules.Card verde = card("SUP", "ovr:90", "color:green");
        CbcRules.Card chuteira = card("CAL", "ovr:90", "sub:casual_sneakers", "color:green");
        CbcRules.Card[] deck = {sup, inf, cal, preto, verde, chuteira};
        FashionSportsNucleo n = new FashionSportsNucleo();

        Resultado semLance = n.pontuar(vestir(sup, inf, cal), contexto(7L, deck).comAndamento(Andamento.de(Acionamento.NENHUM)));
        assertThat(valor(semLance, "PLACAR")).isEqualTo("0-2");
        Resultado desarme = n.pontuar(vestir(sup, inf, cal), contexto(7L, deck).comAndamento(Andamento.de(troca("INF", preto), Acionamento.NENHUM)));
        assertThat(valor(desarme, "PLACAR")).isEqualTo("0-1");
        Andamento tresLances = Andamento.de(troca("INF", preto), troca("CAL", chuteira), troca("SUP", verde));
        Resultado tres = n.pontuar(vestir(sup, inf, cal), contexto(7L, deck).comAndamento(tresLances));
        assertThat(tres.fecha()).isTrue();
        assertThat(lances(tres, "venceu")).containsExactly(true, true, true);
        CbcRules.Card verdeFraco = card("SUP", "ovr:10", "color:green");
        Resultado chuteFraco = n.pontuar(vestir(sup, inf, cal), contexto(7L, sup, inf, cal, verdeFraco)
                .comAndamento(Andamento.de(troca("SUP", verdeFraco), Acionamento.NENHUM)));
        assertThat(lances(chuteFraco, "venceu")).containsExactly(false);
        assertThat(valor(chuteFraco, "PLACAR")).isEqualTo("0-2");
        assertThat(n.efeitos(verde, contexto(7L, deck))).extracting(Efeito::codigo).contains("ACAO_CHUTE");
    }

    @Test
    void coresDoLookDaoAsAcoesDoDetetiveEAPistaDaBlusaBrancaRendeAChave() {
        CbcRules.Card branca = card("SUP", "color:white", "occasion:formal");
        CbcRules.Card verde = card("INF", "color:olive", "occasion:party");
        CbcRules.Card preto = card("CAL", "color:black");
        CbcRules.Card amarelo = card("ACE", "color:gold");
        FashionDetectiveNucleo n = new FashionDetectiveNucleo();

        Resultado r = n.pontuar(vestir(branca, verde, preto, amarelo), contexto(1L, branca, verde, preto, amarelo));
        assertThat(valor(r, "GAVETAS")).isEqualTo(1L);
        assertThat(valor(r, "FURTIVIDADE")).isEqualTo(20L);
        assertThat(valor(r, "VIDA")).isEqualTo(20L);
        assertThat(valor(r, "DANO")).isEqualTo(0L);
        assertThat(valor(r, "CHAVE")).isEqualTo(true);
        assertThat(valor(n.pontuar(vestir(branca, preto), contexto(1L, branca, preto)), "CHAVE")).isEqualTo(false);
        assertThat(n.efeitos(verde, contexto(1L, verde))).extracting(Efeito::codigo).containsExactly("ACESSO", "DEFESA", "COR_ABRIR");
        assertThat(n.efeitos(card("SUP"), contexto(1L))).extracting(Efeito::codigo).containsExactly("ACESSO", "DEFESA");
        assertThat(List.copyOf(Flair3dCores.DETETIVE.values())).doesNotHaveDuplicates();
    }
}
