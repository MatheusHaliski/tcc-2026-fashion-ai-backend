package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair3d.Acionamento.Execucao;
import br.com.fashionai.application.flair3d.Acionamento.Toque;
import br.com.fashionai.application.flair3d.Flair3dExecucao.Nota;
import br.com.fashionai.application.flair3d.Flair3dExecucao.Pedido;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * A fase de uso dos jogos de zonas (reauditoria de 25/11/2026: "a fase de uso é andar 0,5 m e posar"): a estreia em
 * campo, o show, a volta de classificação e a missão com drones. É a mesma execução no percurso
 * ({@link Flair3dExecucao}), com {@value #MARCAS} marcas espalhadas pelo lugar, um prazo para a fase inteira e, em cada
 * marca, uma decisão: o lance seguro (o botão pedido, a janela inteira, pouco ponto) ou o lance ousado (outro botão,
 * janela curta, {@value #OUSADO} pontos), que gasta {@value #CUSTO} do recurso-vida do jogo mesmo quando sai errado. O
 * recurso é o que sobrou da tinta ({@link Flair3dTinta}): quem pintou caro tem menos fôlego para ousar. Recurso zerado
 * fecha a partida como {@link Flair3dExecucao#ESGOTADO}. O servidor sorteia os botões da semente e dá a nota; os tempos
 * vêm do navegador. Puro.
 */
public final class Flair3dFaseDeUso {
    public static final int MARCAS = 5;
    /** Pontos do lance seguro (perfeito e bom) e do ousado certo; o erro tira o mesmo da execução comum. */
    public static final int SEGURO_PERFEITO = 2;
    public static final int SEGURO_BOM = 1;
    public static final int OUSADO = 4;
    /** O que cada lance ousado gasta do recurso, acerte ou erre. */
    public static final int CUSTO = 12;
    /** A janela do lance ousado, em centésimos da janela do seguro. */
    public static final int JANELA_OUSADA_PCT = 60;
    /** O prazo da fase inteira, da primeira marca à última: o que não foi tocado até lá conta como erro. */
    public static final int PRAZO_MS = 25_000;
    public static final String NOTA_OUSADO = "OUSADO";
    static final Set<String> JOGOS = Set.of("CLUBE_CORACAO", "FAVORITE_SINGER", "PILOTO_FAVORITO", "SUPER_HEROI");

    private Flair3dFaseDeUso() {
    }

    /** O risco de cada marca: o botão do lance ousado, quanto ele gasta, a janela dele e o prazo da fase. */
    public record Risco(List<String> ousados, int custo, int janelaMs, int prazoMs) {
        public Risco {
            ousados = List.copyOf(ousados);
        }

        void paraTela(Map<String, Object> m) {
            m.put("ousados", ousados);
            m.put("custo", custo);
            m.put("janelaOusadaMs", janelaMs);
            m.put("prazoMs", prazoMs);
        }
    }

    public static boolean tem(String jogo) {
        return JOGOS.contains(jogo);
    }

    /** Quantas marcas a execução do jogo tem. */
    public static int marcasDo(String jogo) {
        return tem(jogo) ? MARCAS : Flair3dExecucao.MARCAS;
    }

    /**
     * O risco do jogo, ou nulo fora da fase de uso: em cada marca, o botão ousado é um dos três que não são o pedido
     * (da semente).
     */
    static Risco riscoDe(String jogo, List<String> botoes, int janelaMs, Contexto contexto) {
        if (!tem(jogo)) {
            return null;
        }
        List<String> ousados = new ArrayList<>();
        for (int i = 0; i < botoes.size(); i++) {
            String pedido = botoes.get(i);
            List<String> outros = Flair3dExecucao.BOTOES.stream().filter(b -> !b.equals(pedido)).toList();
            ousados.add(contexto.sortear("ousado-" + i, outros));
        }
        return new Risco(ousados, CUSTO, janelaMs * JANELA_OUSADA_PCT / 100, PRAZO_MS);
    }

    /**
     * A nota da fase de uso, pelo primeiro toque de cada marca: o botão ousado gasta o custo e vale {@value #OUSADO}
     * dentro da janela curta; o botão pedido vale perfeito ou bom; o resto é erro, que tira pontos e drena o recurso.
     */
    static Nota avaliar(Pedido pedido, Execucao feita) {
        Risco risco = pedido.risco();
        List<String> marcas = new ArrayList<>();
        int pontos = 0;
        int restante = pedido.reserva();
        for (int i = 0; i < pedido.botoes().size(); i++) {
            int marca = i;
            Toque t = feita.toques().stream().filter(x -> x != null && x.marca() == marca).findFirst().orElse(null);
            boolean ousou = t != null && risco.ousados().get(i).equals(t.botao());
            if (ousou) {
                restante -= risco.custo();
            }
            String nota = ousou ? ousado(risco, t) : Flair3dExecucao.nota(pedido, t, i);
            marcas.add(nota);
            switch (nota) {
                case NOTA_OUSADO -> pontos += OUSADO;
                case "PERFEITO" -> pontos += SEGURO_PERFEITO;
                case "BOM" -> pontos += SEGURO_BOM;
                default -> {
                    pontos -= Flair3dExecucao.ERRO;
                    restante -= pedido.dreno();
                }
            }
        }
        int teto = Flair3dExecucao.TETO;
        return new Nota(marcas, Math.max(-teto, Math.min(teto, pontos)), Math.max(0, restante));
    }

    private static String ousado(Risco risco, Toque t) {
        boolean aTempo = t.ms() >= Flair3dExecucao.REACAO_MINIMA_MS && t.ms() <= risco.janelaMs();
        return aTempo ? NOTA_OUSADO : "ERROU";
    }
}
