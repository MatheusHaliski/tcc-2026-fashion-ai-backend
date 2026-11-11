package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dAtributos;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Núcleo 2 — 3 rounds contra o oponente-padrão (velocidade, ataque e defesa 40): cada round compara um atributo que as
 * peças somam (vence quem tem mais; empate é do oponente). 2 rounds = 100, 1 = 50, 0 = 0.
 */
public class DressFighterNucleo implements Flair3dNucleo {
    public static final int OPONENTE = 40;
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL", "ACE");

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
                List.of(Definicao.CARTAS), VAGAS, Deck.ate(6, Obrigatoria.uma("CAL")), false);
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Flair3dAtributos a = Flair3dAtributos.soma(contexto.vestidas(entrega).values());
        int[] voce = {a.velocidade(), a.ataque(), a.defesa()};
        String[] nomes = {"VELOCIDADE", "ATAQUE", "DEFESA"};
        List<Evento> eventos = new ArrayList<>();
        int vitorias = 0;
        for (int i = 0; i < 3; i++) {
            boolean venceu = voce[i] > OPONENTE;
            vitorias += venceu ? 1 : 0;
            Map<String, Object> round = new LinkedHashMap<>();
            round.put("round", i + 1);
            round.put("atributo", nomes[i]);
            round.put("voce", voce[i]);
            round.put("oponente", OPONENTE);
            round.put("venceu", venceu);
            eventos.add(new Evento("ROUND", round));
        }
        List<RegraResultado> regras = List.of(RegraResultado.de("VITORIA", vitorias >= 2, 100),
                RegraResultado.de("UM_ROUND", vitorias == 1, 50));
        double pontos = vitorias >= 2 ? 100 : vitorias == 1 ? 50 : 0;
        return Resultado.of(pontos, vitorias >= 2 ? "VITORIA" : "DERROTA", regras, eventos);
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        Flair3dAtributos a = Flair3dAtributos.daCarta(carta);
        return List.of(new Efeito("VELOCIDADE", a.velocidade()), new Efeito("ATAQUE", a.ataque()), new Efeito("DEFESA", a.defesa()));
    }
}
