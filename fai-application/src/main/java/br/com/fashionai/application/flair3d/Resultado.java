package br.com.fashionai.application.flair3d;

import java.util.List;
import java.util.UUID;

/**
 * Resultado de uma entrega: pontos de 0 a 100, estrelas (60, 80 e 100), código do resultado, cada regra conferida, os
 * eventos da cena (rounds, gols, o que faltou), os pontos que cada carta vestida rendeu e o status em que a partida fica
 * (nulo ou ENTREGUE fecha; EM_ACAO espera um acionamento; ABERTA aceita outra entrega).
 */
public record Resultado(int pontos, int estrelas, String resultado, List<RegraResultado> regras, List<Evento> eventos,
                        List<CartaPontos> cartas, String status) {
    public static final String ABERTA = "ABERTA";
    public static final String EM_ACAO = "EM_ACAO";
    public static final String ENTREGUE = "ENTREGUE";

    public Resultado {
        pontos = Math.max(0, Math.min(100, pontos));
        regras = List.copyOf(regras);
        eventos = List.copyOf(eventos);
        cartas = cartas == null ? List.of() : List.copyOf(cartas);
    }

    public Resultado(int pontos, int estrelas, String resultado, List<RegraResultado> regras, List<Evento> eventos) {
        this(pontos, estrelas, resultado, regras, eventos, List.of(), null);
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

    /** Resultado sem nota de uma partida que continua (EM_ACAO ou ABERTA): só o código, as regras e os eventos até aqui. */
    public static Resultado parcial(String status, String resultado, List<RegraResultado> regras, List<Evento> eventos) {
        return new Resultado(0, 0, resultado, regras, eventos, List.of(), status);
    }

    public Resultado comCartas(List<CartaPontos> novas) {
        return new Resultado(pontos, estrelas, resultado, regras, eventos, novas, status);
    }

    public Resultado comStatus(String novo) {
        return new Resultado(pontos, estrelas, resultado, regras, eventos, cartas, novo);
    }

    /** A partida fecha com este resultado (os núcleos comuns não dizem o status: fecham sempre). */
    public boolean fecha() {
        return status == null || ENTREGUE.equals(status);
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

    /** Quanto a carta vestida numa vaga rendeu na nota (zero quando não pontuou). */
    public record CartaPontos(String vaga, UUID cardId, double pontos) {
    }
}
