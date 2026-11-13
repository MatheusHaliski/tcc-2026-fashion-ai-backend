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
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.List;
import java.util.Map;

/** Núcleo 1 — tema "Brasil": +10 por peça de marca brasileira, +20 se todas as vagas preenchidas são BR; 70 vira 100. */
public class PassarelaNucleo implements Flair3dNucleo {
    public static final double POR_PECA = 10;
    public static final double TODAS = 20;
    public static final double MAXIMO = 70;

    @Override
    public String codigo() {
        return "PASSARELA";
    }

    @Override
    public int numero() {
        return 1;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(),
                Definicao.objetivo("TEMA_BRASIL", new Regra("MARCA_BR", POR_PECA), new Regra("TODAS_BR", TODAS)),
                List.of(Definicao.CARTAS), Definicao.VAGAS,
                Deck.ate(8, Obrigatoria.uma("SUP"), Obrigatoria.uma("INF"), Obrigatoria.uma("CAL")), true)
                .comAvatares(Avatares.solo(new Avatares.Online(4, 8, null), Avatares.figurante("PLATEIA", 12), Avatares.figurante("FOTOGRAFO", 2)));
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        long br = vestidas.values().stream().filter(contexto::brasileira).count();
        boolean todas = !vestidas.isEmpty() && br == vestidas.size();
        List<RegraResultado> regras = List.of(RegraResultado.de("MARCA_BR", br > 0, POR_PECA * br),
                RegraResultado.de("TODAS_BR", todas, TODAS));
        double bruto = POR_PECA * br + (todas ? TODAS : 0);
        double pontos = Math.min(100, bruto * 100 / MAXIMO);
        return Resultado.of(pontos, pontos >= 60 ? "APROVADO" : "REPROVADO", regras, List.of());
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return contexto.brasileira(carta) ? List.of(new Efeito("MARCA_BR", POR_PECA)) : List.of();
    }
}
