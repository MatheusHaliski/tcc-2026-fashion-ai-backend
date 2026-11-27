package br.com.fashionai.application.flair3d.makeup;

/**
 * Carreira de Beleza (docs/flair/flair-3d-make-up/PLANO.md §2.2–2.3), pura: Prestígio para sair do nível n é 60, 90,
 * 120, 150 e 180 nos níveis 1 a 5 e round(15 · n^1,5) do 6 em diante (acumulado: nível 3 em 150, nível 10 em 1.842);
 * cada estrela nova num brief vale 0,2 × a base (100) = 20, e repetir o brief só paga as estrelas novas.
 */
public record FlairMakeUpCarreira(int nivel, int prestigio, int faltaParaProximo) {
    public static final int NIVEL_MAX = 30;
    public static final int BASE_DO_BRIEF = 100;
    public static final int POR_ESTRELA = (int) Math.round(0.2 * BASE_DO_BRIEF);
    private static final int[] INICIO = {60, 90, 120, 150, 180};
    private static final double K = 15;

    /** Prestígio para sair do nível n. */
    public static int custo(int n) {
        return n <= INICIO.length ? INICIO[n - 1] : (int) Math.round(K * Math.pow(n, 1.5));
    }

    /** Prestígio acumulado para chegar ao nível n. */
    public static int acumulado(int n) {
        int total = 0;
        for (int i = 1; i < n; i++) {
            total += custo(i);
        }
        return total;
    }

    public static FlairMakeUpCarreira de(int prestigio) {
        int p = Math.max(0, prestigio);
        int nivel = 1;
        while (nivel < NIVEL_MAX && p >= acumulado(nivel + 1)) {
            nivel++;
        }
        int falta = nivel == NIVEL_MAX ? 0 : acumulado(nivel + 1) - p;
        return new FlairMakeUpCarreira(nivel, p, falta);
    }

    /** Prestígio de uma entrega: só as estrelas acima da melhor marca anterior no brief. */
    public static int ganho(int melhorAnterior, int estrelas) {
        return Math.max(0, estrelas - Math.max(0, melhorAnterior)) * POR_ESTRELA;
    }
}
