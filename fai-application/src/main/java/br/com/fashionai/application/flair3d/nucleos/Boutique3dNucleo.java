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
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.List;

/** Núcleo 7 — Cliente 1 pede "festa à noite, em preto": 33 por peça de ocasião festa e cor preta (3 vagas); 100 com as 3. */
public class Boutique3dNucleo implements Flair3dNucleo {
    public static final double POR_PECA = 33;
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL");

    @Override
    public String codigo() {
        return "BOUTIQUE_3D";
    }

    @Override
    public int numero() {
        return 7;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(), Definicao.objetivo("FESTA_EM_PRETO", new Regra("PEDIDO", POR_PECA)),
                List.of(Definicao.CARTAS), VAGAS, Deck.ate(8, Obrigatoria.uma("SUP"), Obrigatoria.uma("INF")), false)
                .comAvatares(Avatares.solo(null, Avatares.figurante("CLIENTE", 1)));
    }

    static boolean bate(CbcRules.Card c) {
        return Flair3dPecas.temOcasiao(c, Flair3dPecas.FESTA) && Flair3dPecas.daFamilia(c, "Preto");
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        List<RegraResultado> regras = Flair3dPecas.porVaga(VAGAS, contexto.vestidas(entrega), "PEDIDO", POR_PECA, Boutique3dNucleo::bate);
        boolean todas = regras.stream().allMatch(RegraResultado::ok);
        double pontos = todas ? 100 : regras.stream().mapToDouble(RegraResultado::pontos).sum();
        return Resultado.of(pontos, pontos >= 60 ? "APROVADO" : "REPROVADO", regras, List.of());
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return bate(carta) ? List.of(new Efeito("PEDIDO", POR_PECA)) : List.of();
    }
}
