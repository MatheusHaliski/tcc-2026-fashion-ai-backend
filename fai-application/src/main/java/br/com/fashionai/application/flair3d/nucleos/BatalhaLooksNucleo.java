package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.List;

/** Núcleo 15 — rodada "Look Monocromático" em azul: 25 por peça da família azul; vence o adversário-padrão (75) com mais de 75. */
public class BatalhaLooksNucleo implements Flair3dNucleo {
    public static final double POR_PECA = 25;
    public static final int ADVERSARIO = 75;
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL", "ACE");

    @Override
    public String codigo() {
        return "BATALHA_LOOKS";
    }

    @Override
    public int numero() {
        return 15;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(), Definicao.objetivo("MONOCROMATICO_AZUL", new Regra("FAMILIA_AZUL", POR_PECA)),
                List.of(Definicao.CARTAS), VAGAS,
                Deck.ate(8, Obrigatoria.uma("SUP"), Obrigatoria.uma("INF"), Obrigatoria.uma("CAL")), true);
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        List<RegraResultado> regras = Flair3dPecas.porVaga(VAGAS, contexto.vestidas(entrega), "FAMILIA_AZUL", POR_PECA,
                c -> Flair3dPecas.daFamilia(c, "Azul"));
        double pontos = regras.stream().mapToDouble(RegraResultado::pontos).sum();
        return Resultado.of(pontos, pontos > ADVERSARIO ? "VITORIA" : "DERROTA", regras, List.of(new Evento("ADVERSARIO", ADVERSARIO)));
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return Flair3dPecas.daFamilia(carta, "Azul") ? List.of(new Efeito("FAMILIA_AZUL", POR_PECA)) : List.of();
    }
}
