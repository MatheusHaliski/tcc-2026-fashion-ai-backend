package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.aura.Flair3dAuraEvento;
import br.com.fashionai.application.flair3d.aura.Flair3dAuraRegras;

/**
 * A Aura dentro de uma rodada da Batalha de Looks (rodada 8g): o júri pela faixa de Hype, o trunfo chamado para esta
 * rodada e a Metamorfose da carta Especial, que entra na regra de qualquer desafio. As regras são as de
 * {@link Flair3dAuraRegras}; aqui só a parte da rodada. Puro.
 */
final class BatalhaLooksAura {
    static final String REGRA = "AURA_DO_JURI";

    private BatalhaLooksAura() {
    }

    /** O júri mais o destaque do trunfo, quando ele foi chamado para esta rodada (etapa = rodada - 1). */
    static int daRodada(Flair3dAuraEvento aura, int rodada) {
        if (aura == null) {
            return 0;
        }
        return aura.plateia() + (aura.trunfo() != null && aura.etapaDoTrunfo() == rodada - 1 ? aura.bonusDoTrunfo() : 0);
    }

    /** O desafio em que a carta Especial com Aura Metamorfose vale na regra (a proibida segue proibida). */
    static BatalhaLooksRodadas.Desafio comMetamorfose(BatalhaLooksRodadas.Desafio d, Contexto contexto) {
        if (contexto == null) {
            return d;
        }
        return new BatalhaLooksRodadas.Desafio(d.codigo(), d.naRegra().or(c -> Flair3dAuraRegras.metamorfose(c, contexto)), d.proibida());
    }

    /** O trunfo do Hype chamado na partida ganha o voto da plateia no empate. */
    static boolean trunfoChamado(Contexto contexto) {
        return contexto != null && contexto.andamento().hype() != null;
    }
}
