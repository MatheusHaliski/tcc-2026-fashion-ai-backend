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

    /**
     * Pontua a entrega de forma determinística (o sorteio do contexto vem da semente da partida). Os núcleos em etapas
     * leem o andamento do contexto e devolvem o resultado com status EM_ACAO (falta acionamento) ou ABERTA (a pessoa pode
     * entregar de novo); sem status, a partida fecha.
     */
    Resultado pontuar(Entrega entrega, Contexto contexto);

    /**
     * Prévia da entrega, sem fechar a partida: os pontos e as regras de agora. Os núcleos que rodam sozinhos devolvem só
     * os atributos, nunca o desfecho.
     */
    default Resultado previa(Entrega entrega, Contexto contexto) {
        return pontuar(entrega, contexto);
    }

    /**
     * O efeito da carta neste núcleo (selos da tela do deck). Carta que não pontua devolve o motivo
     * ({@link Efeito#motivo}); vazio só nos núcleos sem cartas.
     */
    default List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return List.of();
    }
}
