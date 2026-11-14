package br.com.fashionai.application.flair3d;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Corpo de POST /api/flair/3d/partidas/{id}/acionar: o que a pessoa aciona entre as etapas da ação. {@code carta} é a
 * carta Especial do DRESS_FIGHTER; {@code troca}, a peça trocada no intervalo do FASHION_SPORTS. Tudo opcional: sem
 * nada, a partida só avança.
 */
public record Acionamento(UUID carta, Troca troca) {
    public static final Acionamento NENHUM = new Acionamento(null, null);

    /** Troca de uma peça do uniforme: a vaga e a carta que entra. */
    public record Troca(String vaga, UUID carta) {
    }

    /** As cartas que este acionamento usa (para conferir dono e deck). */
    public List<UUID> cartas() {
        List<UUID> out = new ArrayList<>();
        if (carta != null) {
            out.add(carta);
        }
        if (troca != null && troca.carta() != null) {
            out.add(troca.carta());
        }
        return out;
    }
}
