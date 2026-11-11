package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;

import java.util.List;

/**
 * FLAIR 3D — um dos 15 núcleos (Strategy, docs/refactoring/gof/R90-flair3d-nucleos.md): cada implementação joga o
 * objetivo mais simples do núcleo (docs/flair/flair-3d/BASE_NUCLEOS.md). O {@link Flair3dNucleoService} abre a partida,
 * confere dono e deck e delega a definição, a pontuação e o efeito de cada carta ao núcleo escolhido pelo código.
 */
public interface Flair3dNucleo {
    String codigo();

    int numero();

    Definicao definicao();

    /** Pontua a entrega de forma determinística (o sorteio do contexto vem da semente da partida). */
    Resultado pontuar(Entrega entrega, Contexto contexto);

    /** O efeito da carta neste núcleo (selos da tela do deck); vazio nos núcleos sem cartas. */
    default List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return List.of();
    }
}
