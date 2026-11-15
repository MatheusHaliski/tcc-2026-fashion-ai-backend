package br.com.fashionai.application.flair3d.esporte;

import java.util.Random;

/**
 * Os reinícios do FASHION_SPORTS (pedido da dona de 15/11/2026: a bola volta ao jogo do lugar certo, à vista). São
 * lances a mais, sem carta e sem gastar jogada: a saída de bola do centro depois de cada gol e no começo de cada
 * tempo; e, no futebol de 5, o tiro de meta da pequena área, o escanteio do canto e o lateral da linha lateral. O campo
 * tem 100 × 60 e o gol da pessoa fica em x = 0.
 */
final class EsporteReinicio {
    private EsporteReinicio() {
    }

    private static Random sorteio(EsportePartida p) {
        return p.contexto.sorteio("reinicio" + p.lances);
    }

    /** A saída de bola: do centro do campo, com um toque para trás. Fora das modalidades de invasão, vale a de sempre. */
    static void saida(EsportePartida p, boolean doNosso) {
        if (!p.regras.deInvasao()) {
            p.lance("SAIDA", doNosso, true, null, null, 1, 1);
            return;
        }
        Random r = sorteio(p);
        int n = p.regras.jogadores();
        double[] para = {doNosso ? 41 : 59, 22 + r.nextInt(17)};
        p.registrar("SAIDA", doNosso, true, null, null, new int[]{n, n - 1}, new double[]{50, 30}, para);
    }

    /** O tiro de meta: o goleiro repõe a bola de dentro da área para um jogador da defesa. */
    static void tiroDeMeta(EsportePartida p, boolean doNosso) {
        Random r = sorteio(p);
        double[] de = {doNosso ? 6 : 94, 26 + r.nextInt(9)};
        double[] para = {p.x(doNosso, 0), 12 + r.nextInt(37)};
        p.registrar("TIRO_DE_META", doNosso, true, null, null, new int[]{1, p.jogadorDa(0, r)}, de, para);
    }

    /** O escanteio: do canto do lado em que a bola saiu para dentro da área. */
    static void escanteio(EsportePartida p, boolean doNosso, boolean emCima) {
        Random r = sorteio(p);
        int cobra = p.jogadorDa(2, r);
        int alvo = p.jogadorDa(3, r);
        double[] de = {doNosso ? 99 : 1, emCima ? 1 : 59};
        double[] para = {p.x(doNosso, 3), 24 + r.nextInt(13)};
        p.registrar("ESCANTEIO", doNosso, true, null, null, new int[]{cobra, alvo == cobra ? outro(p, cobra) : alvo}, de, para);
    }

    /** O lateral: da linha lateral, na altura em que a bola saiu, para um companheiro dentro do campo. */
    static void lateral(EsportePartida p, boolean doNosso, double x, boolean emCima) {
        Random r = sorteio(p);
        int cobra = p.jogadorDa(p.zona, r);
        int alvo = p.jogadorDa(Math.min(3, p.zona + 1), r);
        double[] de = {Math.max(4, Math.min(96, x)), emCima ? 1 : 59};
        double[] para = {p.x(doNosso, p.zona), emCima ? 12 + r.nextInt(14) : 34 + r.nextInt(14)};
        p.registrar("LATERAL", doNosso, true, null, null, new int[]{cobra, alvo == cobra ? outro(p, cobra) : alvo}, de, para);
    }

    /** Outro jogador de linha do mesmo time (o goleiro é o 1). */
    private static int outro(EsportePartida p, int n) {
        return n >= p.regras.jogadores() ? n - 1 : n + 1;
    }
}
