package br.com.fashionai.application.flair3d.esporte;

import br.com.fashionai.application.flair.CbcRules;

import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * O desfecho de uma finalização do FASHION_SPORTS, da pessoa ou do adversário, pela margem do duelo contra o goleiro:
 * de zero para cima é ponto; até −6 o goleiro segura (a bola fica com ele); até −12 ele espalma (a bola sobra na área
 * para quem atacava; no futebol, escanteio); até −{@link #NA_TRAVE}, onde há trave, a bola bate nela e sai; abaixo
 * disso vai para fora. Depois do ponto a bola volta ao jogo do centro com quem sofreu; no futebol, a bola que sai pela
 * linha de fundo volta em tiro de meta. O reinício fica marcado na partida e aparece depois da jogada.
 */
final class EsporteFinalizacao {
    /** A finalização que perde por até isto (e por mais que a espalmada) bate na trave, onde há trave. */
    static final int NA_TRAVE = 15;
    /** Onde ficam os dois postes na largura do campo (o gol tem 3 m num campo de 20 m: 9 das 60 unidades). */
    static final double[] POSTES = {25.5, 34.5};

    private final EsportePartida p;
    private final Random sorteio;

    EsporteFinalizacao(EsportePartida partida, Random sorteio) {
        p = partida;
        this.sorteio = sorteio;
    }

    void resolver(boolean doNosso, CbcRules.Card carta, String acao, double margem) {
        int z = p.zona;
        String prefixo = doNosso ? "CHUTE" : "RIVAL";
        p.resumo.chute(doNosso, margem >= -12);
        if (margem >= 0) {
            p.pontos[doNosso ? 0 : 1][p.tempo() - 1] += p.regras.pontosDaZona()[z];
            p.lance(prefixo + "_GOL", doNosso, true, carta, acao, z, EsportePartida.GOL);
            p.nossa = !doNosso;
            p.zona = 1;
            if (p.regras.comBola()) {
                p.reinicio = () -> EsporteReinicio.saida(p, !doNosso);
            }
            return;
        }
        if (margem >= -6) {
            p.resumo.defesa(!doNosso);
            p.lance(prefixo + "_DEFENDIDO", doNosso, false, carta, acao, z, EsportePartida.GOL);
        } else if (margem >= -12) {
            p.resumo.defesa(!doNosso);
            Map<String, Object> lance = p.lance(prefixo + "_ESPALMADO", doNosso, false, carta, acao, z, EsportePartida.GOL);
            p.zona = 3;
            if (p.regras.comTrave()) {
                boolean emCima = y(lance) < 30;
                p.reinicio = () -> EsporteReinicio.escanteio(p, doNosso, emCima);
            }
            return;
        } else {
            if (margem >= -NA_TRAVE && p.regras.comTrave()) {
                naTrave(p.lance(prefixo + "_NA_TRAVE", doNosso, false, carta, acao, z, EsportePartida.GOL));
            } else {
                p.lance(prefixo + "_FORA", doNosso, false, carta, acao, z, EsportePartida.GOL);
            }
            if (p.regras.comTrave()) {
                p.reinicio = () -> EsporteReinicio.tiroDeMeta(p, !doNosso);
            }
        }
        p.nossa = !doNosso;
        p.zona = 0;
    }

    private static double y(Map<String, Object> lance) {
        return ((Number) ((List<?>) lance.get("para")).get(1)).doubleValue();
    }

    /** A bola na trave: bate num dos postes ou no travessão e sai; o lance diz onde bateu. */
    private void naTrave(Map<String, Object> lance) {
        int onde = sorteio.nextInt(3);
        if (onde < 2) {
            double x = ((Number) ((List<?>) lance.get("para")).get(0)).doubleValue();
            lance.put("para", EsporteCampo.ponto(new double[]{x, POSTES[onde]}));
        }
        lance.put("bateu", onde < 2 ? "TRAVE" : "TRAVESSAO");
    }
}
