package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Avatares;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dAtributos;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dRateio;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Núcleo 2 — 3 rounds contra o oponente-padrão (velocidade, ataque e defesa 40): cada round compara um atributo que as
 * peças somam (vence quem tem mais; empate é do oponente). 2 rounds = 100, 1 = 50, 0 = 0.
 *
 * <p>A luta anda em etapas: a entrega joga o round 1 (EM_ACAO) e cada acionamento joga o round seguinte; o terceiro round
 * fecha a partida. Entre os rounds a pessoa pode acionar UMA carta Especial do deck por luta: ela soma o poder dela
 * ({@link #poder}) ao atributo do round seguinte.</p>
 */
public class DressFighterNucleo implements Flair3dNucleo {
    public static final int OPONENTE = 40;
    public static final int ROUNDS = 3;
    public static final String ESPECIAL = "ESPECIAL";
    public static final int PODER_BASE = 20;
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL", "ACE");
    static final String[] ATRIBUTOS = {"VELOCIDADE", "ATAQUE", "DEFESA"};

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
                .comAvatares(Avatares.solo(new Avatares.Online(1, 1, null), Avatares.figurante("OPONENTE", 1)));
    }

    /** O que a carta Especial soma ao atributo do round em que entra: 20 mais um décimo do OVR. */
    public static int poder(CbcRules.Card especial) {
        return PODER_BASE + especial.ovr() / 10;
    }

    /**
     * A carta Especial de cada round (índice 0 a 2; o round 1 nunca tem): o acionamento i vale para o round i + 2. Recusa
     * (422) carta que não é Especial e uma segunda Especial na mesma luta.
     */
    static CbcRules.Card[] especiais(Contexto contexto) {
        CbcRules.Card[] porRound = new CbcRules.Card[ROUNDS];
        List<Acionamento> acionamentos = contexto.andamento().acionamentos();
        boolean usada = false;
        for (int i = 0; i < acionamentos.size() && i < ROUNDS - 1; i++) {
            UUID id = acionamentos.get(i).carta();
            if (id == null) {
                continue;
            }
            CbcRules.Card c = contexto.cartas().get(id);
            if (c == null || !ESPECIAL.equals(c.tier())) {
                throw Flair3dErros.invalido("CARTA_NAO_ESPECIAL", "carta_nao_especial");
            }
            if (usada) {
                throw Flair3dErros.invalido("ESPECIAL_JA_USADA", "especial_ja_usada");
            }
            usada = true;
            porRound[i + 1] = c;
        }
        return porRound;
    }

    /** O round: quem ataca (no 1, o mais veloz; no 2, a pessoa; no 3, o oponente), os valores e quem venceu. */
    static Map<String, Object> round(int i, int voce) {
        boolean venceu = voce > OPONENTE;
        boolean ataca = i == 1 || (i == 0 && venceu);
        Map<String, Object> round = new LinkedHashMap<>();
        round.put("round", i + 1);
        round.put("atributo", ATRIBUTOS[i]);
        round.put("voce", voce);
        round.put("oponente", OPONENTE);
        round.put("atacante", ataca ? "VOCE" : "OPONENTE");
        round.put("valorAtacante", ataca ? voce : OPONENTE);
        round.put("valorDefensor", ataca ? OPONENTE : voce);
        round.put("venceu", venceu);
        return round;
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        Flair3dAtributos a = Flair3dAtributos.soma(vestidas.values());
        int[] voce = {a.velocidade(), a.ataque(), a.defesa()};
        CbcRules.Card[] especiais = especiais(contexto);
        int jogados = Math.min(ROUNDS, contexto.andamento().acionamentos().size() + 1);
        List<Evento> eventos = new ArrayList<>();
        int vitorias = 0;
        for (int i = 0; i < jogados; i++) {
            int valor = voce[i];
            if (especiais[i] != null) {
                valor += poder(especiais[i]);
                Map<String, Object> especial = new LinkedHashMap<>();
                especial.put("round", i + 1);
                especial.put("carta", especiais[i].id());
                especial.put("atributo", ATRIBUTOS[i]);
                especial.put("poder", poder(especiais[i]));
                eventos.add(new Evento(ESPECIAL, especial));
            }
            Map<String, Object> round = round(i, valor);
            vitorias += Boolean.TRUE.equals(round.get("venceu")) ? 1 : 0;
            eventos.add(new Evento("ROUND", round));
        }
        if (jogados < ROUNDS) {
            return Resultado.parcial(Resultado.EM_ACAO, Resultado.EM_ACAO, List.of(), eventos);
        }
        List<RegraResultado> regras = List.of(RegraResultado.de("VITORIA", vitorias >= 2, 100),
                RegraResultado.de("UM_ROUND", vitorias == 1, 50));
        double pontos = vitorias >= 2 ? 100 : vitorias == 1 ? 50 : 0;
        return Resultado.of(pontos, vitorias >= 2 ? "VITORIA" : "DERROTA", regras, eventos)
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
