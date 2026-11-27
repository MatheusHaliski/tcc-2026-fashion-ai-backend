package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento.Execucao;
import br.com.fashionai.application.flair3d.Flair3dExecucao.Nota;
import br.com.fashionai.application.flair3d.Flair3dExecucao.Pedido;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/**
 * A fase de uso dos jogos de zonas (reauditoria de 25/11/2026: "a fase de uso é andar 0,5 m e posar"): a estreia em
 * campo, o show, a volta de classificação e a missão com drones. É a mesma execução no percurso
 * ({@link Flair3dExecucao}), com {@value #MARCAS} marcas espalhadas pelo lugar, um prazo para a fase inteira e, em cada
 * marca, uma decisão: o lance seguro (o botão pedido, a janela inteira, pouco ponto) ou o lance ousado (outro botão,
 * janela curta, {@value #OUSADO} pontos), que gasta {@value #CUSTO} do recurso-vida do jogo mesmo quando sai errado. O
 * recurso é o que sobrou da tinta ({@link Flair3dTinta}): quem pintou caro tem menos fôlego para ousar. Recurso zerado
 * fecha a partida como {@link Flair3dExecucao#ESGOTADO}. Desde a rodada zonas (27/11/2026) a fase tem o lance do gênero
 * ({@link Flair3dMomentoChave}: pênalti, virada da música, pit stop, ameaça), cartas do guarda-roupa como ação
 * ({@link Flair3dCartaDeUso}: a cor aciona o lance, a faixa de Hype é a torcida, a Especial é a Metamorfose com recarga)
 * e a dificuldade que sobe com a rodada. O servidor sorteia os botões da semente e dá a nota
 * ({@link Flair3dFaseDeUsoNota}); os tempos vêm do navegador. Puro.
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
    /** Quanto a janela fecha a cada rodada depois da primeira e a cada marca da fase, em pontos percentuais. */
    public static final int FECHA_POR_RODADA_PCT = 12;
    public static final int FECHA_POR_MARCA_PCT = 4;
    public static final int PRAZO_POR_RODADA_MS = 3_000;
    static final Set<String> JOGOS = Set.of("CLUBE_CORACAO", "FAVORITE_SINGER", "PILOTO_FAVORITO", "SUPER_HEROI");

    private Flair3dFaseDeUso() {
    }

    /**
     * O risco de cada marca: o botão do lance ousado, quanto ele gasta, a janela dele (a da primeira marca) e o prazo da
     * fase; desde a rodada zonas, também a janela de cada marca (seguro e ousado, que fecham com a marca e com a rodada),
     * o momento-chave do jogo, as famílias de cor das zonas pintadas (a carta da cor do uniforme), o nível da rodada e o
     * jogo (o nome do lance que a cor da carta aciona).
     */
    public record Risco(List<String> ousados, int custo, int janelaMs, int prazoMs, List<Integer> janelas, List<Integer> janelasOusadas,
                        Flair3dMomentoChave chave, Set<String> uniforme, int nivel, String jogo) {
        public Risco {
            ousados = List.copyOf(ousados);
            janelas = janelas == null ? List.of() : List.copyOf(janelas);
            janelasOusadas = janelasOusadas == null ? List.of() : List.copyOf(janelasOusadas);
            uniforme = uniforme == null ? Set.of() : Set.copyOf(uniforme);
        }

        /** O risco de antes da rodada zonas: a mesma janela em todas as marcas, sem momento-chave nem cartas. */
        public Risco(List<String> ousados, int custo, int janelaMs, int prazoMs) {
            this(ousados, custo, janelaMs, prazoMs, null, null, null, null, 0, null);
        }

        /** A janela do lance seguro na marca (sem lista, a do pedido). */
        int janelaSegura(int marca, int doPedido) {
            return marca < janelas.size() ? janelas.get(marca) : doPedido;
        }

        int janelaOusada(int marca) {
            return marca < janelasOusadas.size() ? janelasOusadas.get(marca) : janelaMs;
        }

        void paraTela(Map<String, Object> m) {
            m.put("ousados", ousados);
            m.put("custo", custo);
            m.put("janelaOusadaMs", janelaMs);
            m.put("prazoMs", prazoMs);
            m.put("janelas", janelas);
            m.put("janelasOusadas", janelasOusadas);
            m.put("nivel", nivel);
            m.put("cartasMax", Flair3dCartaDeUso.MAXIMO);
            m.put("recarga", Flair3dCartaDeUso.RECARGA);
            m.put("uniforme", uniforme.stream().sorted().toList());
            if (chave != null) {
                chave.paraTela(m);
            }
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
     * (da semente). A dificuldade sobe com a rodada (a janela fecha {@value #FECHA_POR_RODADA_PCT}% e o prazo encurta
     * {@value #PRAZO_POR_RODADA_MS} ms por rodada depois da primeira) e dentro da fase (cada marca fecha a janela mais
     * {@value #FECHA_POR_MARCA_PCT}%).
     */
    static Risco riscoDe(String jogo, List<String> botoes, int janelaMs, Contexto contexto, Entrega entrega) {
        if (!tem(jogo)) {
            return null;
        }
        List<String> ousados = new ArrayList<>();
        for (int i = 0; i < botoes.size(); i++) {
            String pedido = botoes.get(i);
            List<String> outros = Flair3dExecucao.BOTOES.stream().filter(b -> !b.equals(pedido)).toList();
            ousados.add(contexto.sortear("ousado-" + i, outros));
        }
        int nivel = nivelDaRodada(jogo, contexto.rodada());
        List<Integer> janelas = new ArrayList<>();
        List<Integer> curtas = new ArrayList<>();
        for (int i = 0; i < botoes.size(); i++) {
            int pct = 100 - FECHA_POR_RODADA_PCT * nivel - FECHA_POR_MARCA_PCT * i;
            janelas.add(janelaMs * pct / 100);
            curtas.add(janelaMs * pct / 100 * JANELA_OUSADA_PCT / 100);
        }
        Flair3dMomentoChave chave = Flair3dMomentoChave.de(jogo, botoes, ousados, contexto);
        return new Risco(ousados, CUSTO, curtas.get(0), PRAZO_MS - PRAZO_POR_RODADA_MS * nivel, janelas, curtas, chave, uniforme(entrega), nivel, jogo);
    }

    /** A posição da rodada no jogo (0 a mais simples): a dificuldade da fase. */
    static int nivelDaRodada(String jogo, String rodada) {
        if (rodada == null) {
            return 0;
        }
        List<Definicao.Rodada> rodadas = Flair3dNucleos.porCodigo(jogo).map(n -> n.definicao().rodadas()).orElse(List.of());
        for (int i = 0; i < rodadas.size(); i++) {
            if (rodadas.get(i).codigo().equals(rodada)) {
                return Math.min(2, i);
            }
        }
        return 0;
    }

    /** As famílias de cor das zonas pintadas. */
    static Set<String> uniforme(Entrega entrega) {
        Set<String> out = new TreeSet<>();
        if (entrega != null) {
            entrega.zonas().values().stream().map(Flair3dZonas::familia).filter(Objects::nonNull).forEach(out::add);
        }
        return out;
    }

    /** A nota da fase de uso sem cartas jogadas. */
    static Nota avaliar(Pedido pedido, Execucao feita) {
        return Flair3dFaseDeUsoNota.avaliar(pedido, feita, Map.of());
    }

    /** A nota da fase de uso com as cartas da pessoa que os toques jogaram ({@link Flair3dFaseDeUsoNota}). */
    static Nota avaliar(Pedido pedido, Execucao feita, Map<UUID, CbcRules.Card> cartas) {
        return Flair3dFaseDeUsoNota.avaliar(pedido, feita, cartas);
    }
}
