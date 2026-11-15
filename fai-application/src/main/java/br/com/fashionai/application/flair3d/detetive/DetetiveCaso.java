package br.com.fashionai.application.flair3d.detetive;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Flair3dRateio;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.nucleos.FashionDetectiveAcusacao;

import java.util.List;
import java.util.Map;

/**
 * O resultado do caso "A Coleção Maré" ({@link DetetivePartida}): enquanto não há acusação final, a partida segue EM_ACAO
 * e o evento DETETIVE leva o retrato da investigação; depois dela, a nota é a soma das pistas completas (5 cada), dos
 * enigmas resolvidos (3 cada) e do final (26 o completo, 12 o parcial), menos 2 por vez que a pessoa foi vista, de 0 a
 * 100. A nota nunca usa pele, corpo ou rosto.
 */
public final class DetetiveCaso {
    public static final int POR_PISTA = 5;
    public static final int POR_ENIGMA = 3;
    public static final int FINAL_COMPLETO = 26;
    public static final int FINAL_PARCIAL = 12;
    public static final int POR_PENALIDADE = 2;

    public static final Definicao.Objetivo OBJETIVO = Definicao.objetivo("COLECAO_MARE", new Regra("PISTAS", POR_PISTA * 12),
            new Regra("ENIGMAS", POR_ENIGMA * 8), new Regra("ACUSACAO", FINAL_COMPLETO));

    private DetetiveCaso() {
    }

    public static Resultado pontuar(Map<String, CbcRules.Card> look, Contexto contexto) {
        DetetivePartida p = new DetetivePartida(contexto, look.values().stream().map(CbcRules.Card::id).toList())
                .jogar(contexto.andamento().acionamentos());
        List<Evento> eventos = List.of(new Evento("DETETIVE", p.retrato()));
        if (!p.encerrada()) {
            return Resultado.parcial(Resultado.EM_ACAO, Resultado.EM_ACAO, List.of(), eventos);
        }
        FashionDetectiveAcusacao.Final f = p.fim();
        int bonus = f == FashionDetectiveAcusacao.Final.COMPLETO ? FINAL_COMPLETO : f == FashionDetectiveAcusacao.Final.PARCIAL ? FINAL_PARCIAL : 0;
        double pontos = Math.max(0, Math.min(100, p.pistas() * POR_PISTA + p.salasResolvidas() * POR_ENIGMA + bonus - p.penalidades() * POR_PENALIDADE));
        String resultado = switch (f) {
            case COMPLETO -> "FAVORAVEL";
            case PARCIAL -> "PARCIAL";
            default -> "DESFAVORAVEL";
        };
        List<RegraResultado> regras = List.of(new RegraResultado("PISTAS", p.pistas() >= FashionDetectiveAcusacao.PISTAS_DO_FINAL_COMPLETO, p.pistas() * POR_PISTA),
                new RegraResultado("ENIGMAS", p.salasResolvidas() > 0, p.salasResolvidas() * POR_ENIGMA),
                new RegraResultado("ACUSACAO", bonus > 0, bonus));
        return Resultado.of(pontos, resultado, regras, eventos).comCartas(new Flair3dRateio(look).dividir(pontos, c -> 1.0).lista());
    }
}
