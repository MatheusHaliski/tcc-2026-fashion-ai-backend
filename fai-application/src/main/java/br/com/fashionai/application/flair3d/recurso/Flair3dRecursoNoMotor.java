package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.flair3d.Andamento.UsoDeRecurso;

import java.util.List;

/**
 * O que a peça usada como recurso faz dentro dos jogos de motor próprio (Dress Fighter, Fashion Sports, Fashion
 * Detective): vale no lance, na jogada ou no salão em que foi usada, nunca para trás — a revisão da partida refaz o
 * mesmo jogo. Puro.
 *
 * <ul>
 *   <li>luta: VIDA cura no lance; ENERGIA soma um quinto ao golpe; FOCO tira um quinto do golpe sofrido;</li>
 *   <li>esporte: ENERGIA recupera o fôlego do time a partir da jogada;</li>
 *   <li>detetive: VIDA soma à vida do salão e FOCO, à furtividade.</li>
 * </ul>
 */
public final class Flair3dRecursoNoMotor {
    private Flair3dRecursoNoMotor() {
    }

    /** Quanto do recurso foi usado exatamente neste lance. */
    public static int noLance(List<UsoDeRecurso> usos, String recurso, int lance) {
        return usos.stream().filter(u -> u.lance() == lance && u.recurso().equals(recurso)).mapToInt(UsoDeRecurso::quantidade).sum();
    }

    /** Quanto do recurso foi usado nesta etapa (o salão do detetive). */
    public static int naEtapa(List<UsoDeRecurso> usos, String recurso, int etapa) {
        return usos.stream().filter(u -> u.etapa() == etapa && u.recurso().equals(recurso)).mapToInt(UsoDeRecurso::quantidade).sum();
    }

    /** Os lances em que o recurso foi usado, em ordem (as recargas de fôlego do esporte). */
    public static List<Integer> lances(List<UsoDeRecurso> usos, String recurso) {
        return usos.stream().filter(u -> u.recurso().equals(recurso)).map(UsoDeRecurso::lance).sorted().toList();
    }
}
