package br.com.fashionai.application.flair3d.esporte;

import java.util.List;

/**
 * Os números de uma modalidade do FASHION_SPORTS (docs/flair/flair-3d/JOGOS.md, jogo 14): quantas jogadas tem cada tempo,
 * quanto o relógio anda por jogada, quantos jogadores há de cada lado, quanto vale finalizar de cada zona e como o
 * placar é escrito. O motor é o mesmo em todas (posse, quatro zonas, finalização e defesa, {@link EsportePartida}); o
 * futebol de 5 é a modalidade de referência, e as outras trocam os números e as palavras.
 *
 * @param pontosDaZona pontos de uma finalização convertida, pela zona de onde ela sai (defesa, meio, ataque, área); no
 *                     basquete, 3 de fora do garrafão e 2 de dentro
 * @param sets         o placar final conta os tempos vencidos (vôlei e tênis: cada tempo é um set)
 * @param base         nota de partida do placar (skate: a nota começa em 50) e quanto cada ponto soma a ela
 */
public record EsporteRegras(String codigo, int jogadasPorTempo, int segundosPorJogada, int jogadores, int[] pontosDaZona,
                            boolean sets, int base, int porPonto) {
    public static final int TEMPOS = 2;
    public static final EsporteRegras FUTEBOL = new EsporteRegras("FUTEBOL", 8, 150, 5, new int[]{1, 1, 1, 1}, false, 0, 1);
    public static final List<EsporteRegras> TODAS = List.of(FUTEBOL,
            new EsporteRegras("BASQUETE", 8, 75, 3, new int[]{3, 3, 3, 2}, false, 0, 1),
            new EsporteRegras("VOLEI", 8, 60, 2, new int[]{1, 1, 1, 1}, true, 0, 1),
            new EsporteRegras("TENIS", 8, 60, 1, new int[]{1, 1, 1, 1}, true, 0, 1),
            new EsporteRegras("CORRIDA", 6, 15, 4, new int[]{1, 1, 1, 1}, false, 0, 1),
            new EsporteRegras("SKATE", 6, 20, 1, new int[]{1, 1, 1, 1}, false, 50, 10));
    public static final List<String> CODIGOS = TODAS.stream().map(EsporteRegras::codigo).toList();

    /** A modalidade da resposta da entrega; nula ou desconhecida = futebol de 5. */
    public static EsporteRegras de(String resposta) {
        return TODAS.stream().filter(m -> m.codigo.equals(resposta)).findFirst().orElse(FUTEBOL);
    }

    /** Há trave e goleiro (futebol de 5): só aqui a bola bate na trave e há tiro de meta, escanteio e lateral. */
    public boolean comTrave() {
        return "FUTEBOL".equals(codigo);
    }

    /** Os dois times dividem o campo inteiro (futebol e basquete): o servidor diz onde cada jogador vai em cada lance. */
    public boolean deInvasao() {
        return "FUTEBOL".equals(codigo) || "BASQUETE".equals(codigo);
    }

    /** Há bola em jogo e, depois de cada ponto, ela volta ao jogo com quem sofreu (corrida e skate não têm). */
    public boolean comBola() {
        return !"CORRIDA".equals(codigo) && !"SKATE".equals(codigo);
    }

    public int jogadas() {
        return jogadasPorTempo * TEMPOS;
    }

    /** O tempo (1 ou 2) da jogada de índice dado (a partir de 0). */
    public int tempoDa(int jogada) {
        return jogada < jogadasPorTempo ? 1 : 2;
    }

    /** O relógio da partida, em segundos, no fim da jogada de índice dado. */
    public int relogioApos(int jogada) {
        return (jogada + 1) * segundosPorJogada;
    }

    /**
     * O placar no jeito da modalidade, a partir dos pontos de cada lado em cada tempo: gols, pontos ou chegadas somados;
     * a nota do skate (base mais 10 por manobra convertida); no vôlei e no tênis, os sets vencidos (tempo empatado não dá
     * set a ninguém).
     */
    public String placar(int[] nos, int[] eles) {
        if (sets) {
            int a = 0;
            int b = 0;
            for (int t = 0; t < TEMPOS; t++) {
                a += nos[t] > eles[t] ? 1 : 0;
                b += eles[t] > nos[t] ? 1 : 0;
            }
            return a + "-" + b;
        }
        return (base + porPonto * (nos[0] + nos[1])) + "-" + (base + porPonto * (eles[0] + eles[1]));
    }

    /** Quem está na frente: positivo = a pessoa, negativo = o adversário, zero = empate (nos sets, desempata nos pontos). */
    public int saldo(int[] nos, int[] eles) {
        int pontos = nos[0] + nos[1] - eles[0] - eles[1];
        if (!sets) {
            return pontos;
        }
        String[] p = placar(nos, eles).split("-");
        int porSets = Integer.parseInt(p[0]) - Integer.parseInt(p[1]);
        return porSets != 0 ? porSets : pontos;
    }
}
