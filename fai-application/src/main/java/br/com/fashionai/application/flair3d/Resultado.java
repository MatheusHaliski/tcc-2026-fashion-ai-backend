package br.com.fashionai.application.flair3d;

import java.util.List;

/**
 * Resultado de uma entrega: pontos de 0 a 100, estrelas (60, 80 e 100), código do resultado, cada regra conferida e os
 * eventos da cena (rounds, gols, o que faltou).
 */
public record Resultado(int pontos, int estrelas, String resultado, List<RegraResultado> regras, List<Evento> eventos) {
    public Resultado {
        pontos = Math.max(0, Math.min(100, pontos));
        regras = List.copyOf(regras);
        eventos = List.copyOf(eventos);
    }

    /** Pontos já em 0..100 (arredondados) e as estrelas que eles dão. */
    public static Resultado of(double pontos, String resultado, List<RegraResultado> regras, List<Evento> eventos) {
        int p = (int) Math.round(Math.max(0, Math.min(100, pontos)));
        return new Resultado(p, estrelas(p), resultado, regras, eventos);
    }

    /** Soma das regras cumpridas, com o resultado APROVADO a partir de 60. */
    public static Resultado somando(List<RegraResultado> regras, List<Evento> eventos) {
        double total = regras.stream().mapToDouble(RegraResultado::pontos).sum();
        return of(total, total >= 60 ? "APROVADO" : "REPROVADO", regras, eventos);
    }

    public static int estrelas(int pontos) {
        if (pontos >= 100) {
            return 3;
        }
        if (pontos >= 80) {
            return 2;
        }
        return pontos >= 60 ? 1 : 0;
    }

    /** Regra conferida: os pontos são os que ela rendeu (zero quando não cumprida). */
    public record RegraResultado(String codigo, boolean ok, double pontos) {
        public static RegraResultado de(String codigo, boolean ok, double valor) {
            return new RegraResultado(codigo, ok, ok ? valor : 0);
        }
    }

    /** Evento da cena: código e um valor (número do round, placar, quantas peças faltaram...). */
    public record Evento(String codigo, Object valor) {
    }
}
