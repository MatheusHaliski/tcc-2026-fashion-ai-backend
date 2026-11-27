package br.com.fashionai.application.flair3d;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Corpo de POST /api/flair/3d/partidas/{id}/acionar: o que a pessoa aciona entre as etapas da ação. {@code carta} é a
 * carta Especial do DRESS_FIGHTER (ou a carta jogada); {@code troca}, a peça trocada no intervalo do FASHION_SPORTS;
 * {@code alvo}, no FASHION_DETECTIVE, o que a pessoa faz com a carta ("IR:ponto", "ABRIR:armario", "ACUSAR:2"...);
 * {@code execucao}, nos jogos de ação jogável, os botões apertados em cada marca do percurso ({@link Flair3dExecucao}).
 * Tudo opcional: sem nada, a partida só avança.
 */
public record Acionamento(UUID carta, Troca troca, String alvo, Execucao execucao) {
    public static final Acionamento NENHUM = new Acionamento(null, null);

    public Acionamento(UUID carta, Troca troca) {
        this(carta, troca, null, null);
    }

    public Acionamento(UUID carta, Troca troca, String alvo) {
        this(carta, troca, alvo, null);
    }

    /** O que a pessoa fez no percurso: um toque por marca (a marca, o botão e o tempo de reação em ms). */
    public record Execucao(List<Toque> toques) {
        public Execucao {
            toques = toques == null ? List.of() : List.copyOf(toques);
        }
    }

    /** {@code carta}: nos jogos de zonas, a carta do guarda-roupa jogada na marca ({@link Flair3dCartaDeUso}), ou nula. */
    public record Toque(int marca, String botao, int ms, UUID carta) {
        public Toque(int marca, String botao, int ms) {
            this(marca, botao, ms, null);
        }
    }

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
        if (execucao != null) {
            execucao.toques().stream().filter(t -> t != null && t.carta() != null).forEach(t -> out.add(t.carta()));
        }
        return out;
    }
}
