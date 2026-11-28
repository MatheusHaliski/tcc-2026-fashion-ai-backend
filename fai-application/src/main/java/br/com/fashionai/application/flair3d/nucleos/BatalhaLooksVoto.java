package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Resultado.Evento;

/**
 * Quem vence a Batalha de Looks pela soma, e o voto da plateia no empate: com o trunfo do Hype chamado na partida, a
 * plateia fica com a pessoa (rodada 8g); senão, da semente da partida (a prévia, a entrega e a revisão tiram sempre o
 * mesmo voto). Puro.
 */
final class BatalhaLooksVoto {
    private BatalhaLooksVoto() {
    }

    static boolean venceu(int voce, int adversario, Contexto contexto) {
        return voce > adversario || (voce == adversario && plateia(contexto));
    }

    /** O voto da plateia no empate: verdadeiro quando ela fica com a pessoa. */
    static boolean plateia(Contexto contexto) {
        return BatalhaLooksAura.trunfoChamado(contexto) || contexto.sorteio("plateia").nextBoolean();
    }

    static Evento evento(boolean venceu, Contexto contexto) {
        if (venceu && BatalhaLooksAura.trunfoChamado(contexto)) {
            return new Evento(BatalhaLooksFecho.VOTO, "HYPE");
        }
        return new Evento(BatalhaLooksFecho.VOTO, venceu ? "VOCE" : "ADVERSARIO");
    }
}
