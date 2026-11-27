package br.com.fashionai.application.flair3d.nucleos;

import java.util.List;

import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.ESQUIVA;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.FOCO;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.FORTE;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.GUARDA;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.RAPIDO;

/**
 * Os combos do Dress Fighter: uma sequência de golpes da pessoa, nos últimos lances, que dá um bônus ao golpe que a
 * fecha. Relâmpago (amarelo, amarelo, vermelho): o forte entra com +10 e atravessa a guarda. Contragolpe (verde,
 * vermelho): +8 no forte. Muralha (preto, branco): o contra-ataque do foco dobra. Puro.
 */
public final class DressFighterCombos {
    public static final String RELAMPAGO = "RELAMPAGO";
    public static final String CONTRAGOLPE = "CONTRAGOLPE";
    public static final String MURALHA = "MURALHA";

    /** Um combo: a sequência de golpes, do mais antigo ao que fecha. */
    record Combo(String codigo, List<String> sequencia) {
    }

    /** Do mais longo ao mais curto: o primeiro que bate vale. */
    static final List<Combo> TODOS = List.of(
            new Combo(RELAMPAGO, List.of(RAPIDO, RAPIDO, FORTE)),
            new Combo(CONTRAGOLPE, List.of(ESQUIVA, FORTE)),
            new Combo(MURALHA, List.of(GUARDA, FOCO)));

    private DressFighterCombos() {
    }

    /** O que o combo soma ao golpe que o fecha (a Muralha dobra o contra-ataque, não soma aqui). */
    static int bonus(String combo) {
        if (RELAMPAGO.equals(combo)) {
            return 10;
        }
        return CONTRAGOLPE.equals(combo) ? 8 : 0;
    }

    /** O combo que os golpes da pessoa até aqui (o último é o deste lance) fecham, ou nulo. */
    static String fechado(List<String> golpes) {
        for (Combo c : TODOS) {
            int n = c.sequencia().size();
            if (golpes.size() >= n && golpes.subList(golpes.size() - n, golpes.size()).equals(c.sequencia())) {
                return c.codigo();
            }
        }
        return null;
    }
}
