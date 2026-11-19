package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Avatares;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dAtributos;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dRateio;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.esporte.EsporteForcas;
import br.com.fashionai.application.flair3d.esporte.EsportePartida;
import br.com.fashionai.application.flair3d.esporte.EsporteRegras;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Núcleo 14 — futebol de 5 e as outras modalidades ({@link EsporteRegras}, escolhida na entrega), jogados por cartas
 * (definição da dona de 15/11/2026: "integre a mecânica de cartas como componente essencial para realizar qualquer
 * ação"). A entrega veste o uniforme do time (camisa, calção e chuteira), que dá os atributos de base; as outras cartas
 * do deck viram a mão. A partida fica EM_ACAO, e cada acionamento é uma jogada: a carta jogada (a cor decide a ação, o
 * poder decide o duelo) ou nenhuma. No fim do segundo tempo a partida fecha: mais pontos = vitória (100); iguais =
 * empate (60); menos = derrota (0). A simulação está em {@link EsportePartida}. O deck aceita carta de qualquer
 * posição: fora do uniforme, toda carta é jogada na mão.
 */
public class FashionSportsNucleo implements Flair3dNucleo {
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL");
    public static final int DECK = 15;

    @Override
    public String codigo() {
        return "FASHION_SPORTS";
    }

    @Override
    public int numero() {
        return 14;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(), Definicao.objetivo("FUTEBOL_DE_5", new Regra("VITORIA", 100),
                new Regra("EMPATE", 60)), List.of(Definicao.CARTAS, Definicao.RESPOSTA), VAGAS,
                Deck.ate(DECK, Obrigatoria.uma("SUP"), Obrigatoria.uma("INF"), Obrigatoria.uma("CAL")).so(Definicao.VAGAS), false)
                .comOpcoes(EsporteRegras.CODIGOS).comAvatares(Avatares.solo(new Avatares.Online(2, 10, 5), Avatares.figurante("COLEGA", 4), Avatares.figurante("ADVERSARIO", 5)));
    }

    /** Os atributos do time, como a prévia e o começo da partida os mostram. */
    private static List<Evento> atributos(EsporteForcas.Time t) {
        return List.of(new Evento("VELOCIDADE", t.velocidade()), new Evento("TECNICA", t.tecnica()), new Evento("RESISTENCIA", t.resistencia()),
                new Evento("DEFESA", t.defesa()), new Evento("FISICO", t.fisico()), new Evento("COESAO", 100));
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> uniforme = contexto.vestidas(entrega);
        EsporteRegras regras = EsporteRegras.de(entrega.resposta());
        EsportePartida partida = new EsportePartida(regras, uniforme, contexto).jogar(contexto.andamento().acionamentos());
        List<Evento> eventos = new ArrayList<>(List.of(new Evento("MODALIDADE", regras.codigo())));
        eventos.addAll(partida.eventos());
        if (!partida.encerrada()) {
            return Resultado.parcial(Resultado.EM_ACAO, Resultado.EM_ACAO, List.of(), eventos);
        }
        boolean vitoria = partida.saldo() > 0;
        boolean empate = partida.saldo() == 0;
        // a coesão do uniforme é um atributo do time (a prévia a mostra), não uma regra da nota: a nota é só o placar
        List<RegraResultado> regrasDoJogo = List.of(RegraResultado.de("VITORIA", vitoria, 100), RegraResultado.de("EMPATE", empate, 60));
        double pontos = vitoria ? 100 : empate ? 60 : 0;
        return Resultado.of(pontos, vitoria ? "VITORIA" : empate ? "EMPATE" : "DERROTA", regrasDoJogo, eventos)
                .comCartas(new Flair3dRateio(uniforme).dividir(pontos, FashionSportsNucleo::peso).lista());
    }

    /** Peso da carta do uniforme no jogo: o que ela soma de velocidade, técnica, resistência, defesa e físico. */
    static double peso(CbcRules.Card c) {
        Flair3dAtributos a = Flair3dAtributos.daCarta(c);
        return Math.max(0, a.velocidade()) + Math.max(0, a.tecnica()) + Math.max(0, a.resistencia()) + Math.max(0, a.defesa()) + EsporteForcas.fisico(c);
    }

    /** Só os atributos do uniforme (a partida não roda na prévia nem gasta o sorteio). */
    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        return Resultado.parcial(null, "PREVIA", List.of(), atributos(EsporteForcas.time(contexto.vestidas(entrega).values())));
    }

    /** O selo da carta: a ação que a cor dela dispara e o poder dela nessa ação; no uniforme, o que ela soma ao time. */
    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        Flair3dAtributos a = Flair3dAtributos.daCarta(carta);
        String acao = EsporteForcas.acao(carta);
        List<Efeito> out = new ArrayList<>(List.of(new Efeito("PODER", EsporteForcas.poder(carta, acao)), new Efeito("VELOCIDADE", a.velocidade()),
                new Efeito("TECNICA", a.tecnica()), new Efeito("RESISTENCIA", a.resistencia()), new Efeito("DEFESA", a.defesa()),
                new Efeito("FISICO", EsporteForcas.fisico(carta))));
        // a ação da cor entra pelo serviço (Flair3dCores); a carta sem cor de ação joga o toque curto
        if (EsporteForcas.TOQUE.equals(acao)) {
            out.add(new Efeito("ACAO_TOQUE", 0));
        }
        return out;
    }
}
