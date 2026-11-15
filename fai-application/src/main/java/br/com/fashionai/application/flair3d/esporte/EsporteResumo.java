package br.com.fashionai.application.flair3d.esporte;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Os números da partida para o resumo final: posse (em % das jogadas), finalizações, finalizações no gol, defesas do
 * goleiro, desarmes, passes certos e quantas jogadas a pessoa fez com carta. Em cada par, o primeiro número é da pessoa
 * e o segundo, do adversário.
 */
final class EsporteResumo {
    private final int[] posse = new int[2];
    private final int[] chutes = new int[2];
    private final int[] noGol = new int[2];
    private final int[] defesas = new int[2];
    private final int[] desarmes = new int[2];
    private int passes;
    private int passesCertos;
    private int cartas;

    private static int lado(boolean nosso) {
        return nosso ? 0 : 1;
    }

    void posse(boolean nossa) {
        posse[lado(nossa)]++;
    }

    void chute(boolean nosso, boolean noAlvo) {
        chutes[lado(nosso)]++;
        noGol[lado(nosso)] += noAlvo ? 1 : 0;
    }

    /** Uma defesa do goleiro do time dado. */
    void defesa(boolean nosso) {
        defesas[lado(nosso)]++;
    }

    /** Um desarme do time dado. */
    void desarme(boolean nosso) {
        desarmes[lado(nosso)]++;
    }

    void passe(boolean certo) {
        passes++;
        passesCertos += certo ? 1 : 0;
    }

    void carta() {
        cartas++;
    }

    private static List<Integer> par(int[] v) {
        return List.of(v[0], v[1]);
    }

    Map<String, Object> mapa() {
        int jogadas = Math.max(1, posse[0] + posse[1]);
        int nossa = Math.round(posse[0] * 100f / jogadas);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("posse", List.of(nossa, 100 - nossa));
        m.put("chutes", par(chutes));
        m.put("noGol", par(noGol));
        m.put("defesas", par(defesas));
        m.put("desarmes", par(desarmes));
        m.put("passes", List.of(passesCertos, passes));
        m.put("cartas", cartas);
        return m;
    }
}
