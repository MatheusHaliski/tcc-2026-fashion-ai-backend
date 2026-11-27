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
import br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.Lutador;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Núcleo 2 — a luta contra a oponente da arena, lance a lance ({@link DressFighterLuta}): o look dá velocidade, ataque e
 * defesa; depois de entregar, a pessoa joga uma carta da mão em cada lance e a cor dela é o golpe
 * ({@link DressFighterGolpes}), com combos ({@link DressFighterCombos}). As duas têm 100 de vida; três rounds de três
 * lances; vence a luta quem nocauteia ou ganha mais rounds. Vitória = 100, um round = 50, nenhum = 0.
 *
 * <p>As rodadas são arenas: a da base e duas com oponente de atributos e estilo próprios ({@link #ARENAS}). A partida
 * fica EM_ACAO até a luta acabar; a carta Especial vira o golpe especial, uma vez por luta.</p>
 */
public class DressFighterNucleo implements Flair3dNucleo {
    public static final int OPONENTE = 40;
    public static final int ROUNDS = 3;
    public static final String ESPECIAL = "ESPECIAL";
    public static final int PODER_BASE = 20;
    /** a peça inteira (VES) também veste: ocupa cima e baixo */
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL", "ACE", "VES");
    static final String[] ATRIBUTOS = {"VELOCIDADE", "ATAQUE", "DEFESA"};
    public static final String ARENA_VELOZ = "ARENA_VELOZ";
    public static final String ARENA_BLINDADA = "ARENA_BLINDADA";
    /** Velocidade, ataque e defesa do oponente de cada arena. */
    public static final Map<String, int[]> ARENAS = Map.of(ARENA_VELOZ, new int[]{60, 35, 45}, ARENA_BLINDADA, new int[]{40, 50, 65});
    static final int[] PADRAO = {OPONENTE, OPONENTE, OPONENTE};

    @Override
    public String codigo() {
        return "DRESS_FIGHTER";
    }

    @Override
    public int numero() {
        return 2;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(),
                Definicao.objetivo("VENCER_2_DE_3", new Regra("VITORIA", 100), new Regra("UM_ROUND", 50)),
                List.of(Definicao.CARTAS), VAGAS, Deck.ate(6, Obrigatoria.uma("CAL")), false)
                .comAvatares(Avatares.solo(new Avatares.Online(1, 1, null), Avatares.figurante("OPONENTE", 1)))
                .comRodadas(Definicao.Rodada.de(ARENA_VELOZ, new Regra("VITORIA", 100), new Regra("UM_ROUND", 50)),
                        Definicao.Rodada.de(ARENA_BLINDADA, new Regra("VITORIA", 100), new Regra("UM_ROUND", 50)));
    }

    /** Os atributos do oponente da arena da partida. */
    static int[] oponente(Contexto contexto) {
        return ARENAS.getOrDefault(String.valueOf(contexto.rodada()), PADRAO);
    }

    @Override
    public Map<String, Object> abertura(Contexto contexto) {
        int[] o = oponente(contexto);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("velocidade", o[0]);
        m.put("ataque", o[1]);
        m.put("defesa", o[2]);
        return Map.of("oponente", m);
    }

    /** O que a carta Especial soma ao atributo do round em que entra: 20 mais um décimo do OVR. */
    public static int poder(CbcRules.Card especial) {
        return PODER_BASE + especial.ovr() / 10;
    }

    /** O round: quem ataca (no 1, o mais veloz; no 2, a pessoa; no 3, o oponente), os valores e quem venceu. */
    static Map<String, Object> round(int i, int voce) {
        return round(i, voce, OPONENTE);
    }

    static Map<String, Object> round(int i, int voce, int oponente) {
        boolean venceu = voce > oponente;
        boolean ataca = i == 1 || (i == 0 && venceu);
        Map<String, Object> round = new LinkedHashMap<>();
        round.put("round", i + 1);
        round.put("atributo", ATRIBUTOS[i]);
        round.put("voce", voce);
        round.put("oponente", oponente);
        round.put("atacante", ataca ? "VOCE" : "OPONENTE");
        round.put("valorAtacante", ataca ? voce : oponente);
        round.put("valorDefensor", ataca ? oponente : voce);
        round.put("venceu", venceu);
        return round;
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        Flair3dAtributos a = Flair3dAtributos.soma(vestidas.values());
        int[] o = oponente(contexto);
        DressFighterLuta luta = new DressFighterLuta(contexto, new Lutador(a.velocidade(), a.ataque(), a.defesa()),
                new Lutador(o[0], o[1], o[2])).jogar(contexto.andamento().acionamentos());
        if (!luta.encerrada()) {
            return Resultado.parcial(Resultado.EM_ACAO, Resultado.EM_ACAO, List.of(), luta.eventos);
        }
        boolean venceu = luta.venceu();
        boolean umRound = !venceu && luta.vitorias >= 1;
        List<RegraResultado> regras = List.of(RegraResultado.de("VITORIA", venceu, 100), RegraResultado.de("UM_ROUND", umRound, 50));
        double pontos = venceu ? 100 : umRound ? 50 : 0;
        return Resultado.of(pontos, venceu ? "VITORIA" : "DERROTA", regras, luta.eventos)
                .comCartas(new Flair3dRateio(vestidas).dividir(pontos, DressFighterNucleo::peso).lista());
    }

    /** Peso da carta na luta: o que ela soma de velocidade, ataque e defesa (o que tira não conta). */
    static double peso(CbcRules.Card c) {
        Flair3dAtributos a = Flair3dAtributos.daCarta(c);
        return Math.max(0, a.velocidade()) + Math.max(0, a.ataque()) + Math.max(0, a.defesa());
    }

    /** Só os atributos do look (a luta não roda na prévia). */
    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        Flair3dAtributos a = Flair3dAtributos.soma(contexto.vestidas(entrega).values());
        return Resultado.parcial(null, "PREVIA", List.of(), List.of(new Evento("VELOCIDADE", a.velocidade()),
                new Evento("ATAQUE", a.ataque()), new Evento("DEFESA", a.defesa())));
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        Flair3dAtributos a = Flair3dAtributos.daCarta(carta);
        List<Efeito> out = new ArrayList<>(List.of(new Efeito("VELOCIDADE", a.velocidade()), new Efeito("ATAQUE", a.ataque()),
                new Efeito("DEFESA", a.defesa())));
        if (ESPECIAL.equals(carta.tier())) {
            out.add(new Efeito("PODER_ESPECIAL", poder(carta)));
        }
        return out;
    }
}
