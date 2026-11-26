package br.com.fashionai.application.flair3d.esporte;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.nucleos.FashionSportsNucleo;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * A barra de tempo do chute e do desarme (reauditoria de 25/11/2026): o acerto vai como faixa 0 a 2 no alvo e corta a
 * sorte ruim do duelo (perfeito, nunca abaixo de −3; bom, de −5; errou, nunca acima de +3), sem mudar a ordem dos
 * sorteios da semente.
 */
class EsporteTempoTest {
    @Test
    void aFaixaApertaASorteSemMudarONumeroSorteado() {
        for (int s = -EsportePartida.SORTE; s <= EsportePartida.SORTE; s++) {
            assertThat(EsporteTempo.sorte(s, 2)).isGreaterThanOrEqualTo(-3).isGreaterThanOrEqualTo(EsporteTempo.sorte(s, 1));
            assertThat(EsporteTempo.sorte(s, 1)).isGreaterThanOrEqualTo(-5).isGreaterThanOrEqualTo(s);
            assertThat(EsporteTempo.sorte(s, 0)).isLessThanOrEqualTo(3).isLessThanOrEqualTo(s);
            assertThat(EsporteTempo.sorte(s, EsporteTempo.SEM)).isEqualTo(s);
        }
        assertThat(EsporteTempo.sorte(-8, 2)).isEqualTo(-3);
        assertThat(EsporteTempo.sorte(8, 2)).isEqualTo(8);
        assertThat(EsporteTempo.sorte(8, 0)).isEqualTo(3);
    }

    @Test
    void oAlvoLevaATempoJuntoDaPosicaoEOServidorSoAceitaTresFaixas() {
        assertThat(EsporteTempo.faixa(null)).isEqualTo(EsporteTempo.SEM);
        assertThat(EsporteTempo.faixa("POSICAO:8,2")).isEqualTo(EsporteTempo.SEM);
        assertThat(EsporteTempo.faixa("POSICAO:8,2;TEMPO:2")).isEqualTo(2);
        assertThat(EsporteTempo.faixa("TEMPO:0")).isZero();
        // a posição continua valendo no alvo combinado
        assertThat(EsportePosicao.ajuste("POSICAO:8,2;TEMPO:2", true)).isEqualTo(EsportePosicao.BOM);
        assertThat(catchThrowableOfType(ApiException.class, () -> EsporteTempo.faixa("TEMPO:9")).status()).isEqualTo(422);
        assertThat(catchThrowableOfType(ApiException.class, () -> EsporteTempo.faixa("TEMPO:2.5")).status()).isEqualTo(422);
    }

    static final CbcRules.Card SUP = card("SUP", "ovr:70");
    static final CbcRules.Card INF = card("INF", "ovr:70");
    static final CbcRules.Card CAL = card("CAL", "ovr:70", "sub:running_shoes");
    static final CbcRules.Card CHUTE = card("SUP", "color:green", "ovr:70", "material:leather");
    static final CbcRules.Card DESARME = card("INF", "color:black", "ovr:70", "material:leather");
    static final CbcRules.Card PASSE = card("ACE", "color:red", "ovr:70");

    /** Joga a partida inteira com a carta de chute ou de desarme sempre que dá, com o acerto dado na barra. */
    @SuppressWarnings("unchecked")
    static Resultado partida(long semente, String tempo) {
        CbcRules.Card sup = SUP;
        CbcRules.Card inf = INF;
        CbcRules.Card cal = CAL;
        CbcRules.Card chute = CHUTE;
        CbcRules.Card desarme = DESARME;
        CbcRules.Card passe = PASSE;
        CbcRules.Card[] deck = {sup, inf, cal, chute, desarme, passe};
        FashionSportsNucleo n = new FashionSportsNucleo();
        List<Acionamento> feitos = new ArrayList<>();
        while (true) {
            Resultado r = n.pontuar(new Entrega(vestir(sup, inf, cal).cartas(), null, null, null),
                    Flair3dFixtures.contexto(semente, deck).comAndamento(new Andamento(1, feitos)));
            if (r.fecha()) {
                return r;
            }
            Map<String, Object> s = (Map<String, Object>) r.eventos().get(r.eventos().size() - 1).valor();
            List<UUID> mao = (List<UUID>) s.get("mao");
            UUID carta = "NOS".equals(s.get("posse")) ? (mao.contains(chute.id()) ? chute.id() : mao.contains(passe.id()) ? passe.id() : null)
                    : (mao.contains(desarme.id()) ? desarme.id() : null);
            feitos.add(new Acionamento(carta, null, carta == null ? null : tempo));
        }
    }

    @Test
    void quemAcertaABarraNaoDependeTantoDaSorte() {
        int perfeitos = 0;
        int errados = 0;
        for (long semente = 1; semente <= 30; semente++) {
            perfeitos += Math.round(partida(semente, "TEMPO:2").pontos());
            errados += Math.round(partida(semente, "TEMPO:0").pontos());
            // a mesma semente e os mesmos acertos dão sempre a mesma partida
            assertThat(partida(semente, "TEMPO:2")).isEqualTo(partida(semente, "TEMPO:2"));
        }
        assertThat(perfeitos).as("perfeito %d x errou %d", perfeitos, errados).isGreaterThan(errados);
    }
}
