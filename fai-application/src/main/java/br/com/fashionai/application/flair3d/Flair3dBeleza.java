package br.com.fashionai.application.flair3d;

import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Maquiagem de uma entrega (ROAD_TO_GLORY e os briefs do MAKE UP): família e acabamento por área, comparados sem
 * diferença de caixa. A nota olha só a escolha da maquiagem, nunca pele nem rosto.
 */
public final class Flair3dBeleza {
    public static final String LABIOS = "LABIOS";
    public static final String OLHOS = "OLHOS";
    public static final String BOCHECHAS = "BOCHECHAS";

    private Flair3dBeleza() {
    }

    public static boolean familia(Entrega entrega, String area, String... familias) {
        return valor(entrega, area, Entrega.Maquiagem::familia, familias);
    }

    public static boolean acabamento(Entrega entrega, String area, String... acabamentos) {
        return valor(entrega, area, Entrega.Maquiagem::acabamento, acabamentos);
    }

    private static boolean valor(Entrega entrega, String area, java.util.function.Function<Entrega.Maquiagem, String> campo, String... aceitos) {
        Map<String, Entrega.Maquiagem> m = entrega.maquiagem();
        Entrega.Maquiagem escolha = m.get(area);
        if (escolha == null) {
            return false;
        }
        String v = Objects.toString(campo.apply(escolha), "").trim().toUpperCase(Locale.ROOT);
        return Set.of(aceitos).contains(v);
    }
}
