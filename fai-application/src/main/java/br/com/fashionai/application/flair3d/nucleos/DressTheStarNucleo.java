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

import java.util.List;
import java.util.Set;

/** Núcleo 3 — a "Estrela Pop dos anos 2000": 25 por peça com estilo y2k ou glam, ou cor rosa ou prata (4 vagas). */
public class DressTheStarNucleo implements Flair3dNucleo {
    public static final double POR_PECA = 25;
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL", "ACE");
    public static final Set<String> ESTILOS = Set.of("y2k", "glam");

    @Override
    public String codigo() {
        return "DRESS_THE_STAR";
    }

    @Override
    public int numero() {
        return 3;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(), Definicao.objetivo("ESTRELA_POP_2000", new Regra("FIGURINO", POR_PECA)),
                List.of(Definicao.CARTAS), VAGAS, Deck.ate(8, Obrigatoria.uma("SUP"), Obrigatoria.uma("INF")), true)
                .comAvatares(Avatares.solo(new Avatares.Online(3, 8, null)));
    }

    static boolean bate(CbcRules.Card c) {
        return Flair3dPecas.temEstilo(c, ESTILOS) || Flair3dPecas.daFamilia(c, "Rosa") || Flair3dPecas.temCor(c, "silver", "metallic_silver");
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        return Resultado.somando(Flair3dPecas.porVaga(VAGAS, contexto.vestidas(entrega), "FIGURINO", POR_PECA, DressTheStarNucleo::bate),
                List.of());
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return bate(carta) ? List.of(new Efeito("FIGURINO", POR_PECA)) : List.of();
    }
}
