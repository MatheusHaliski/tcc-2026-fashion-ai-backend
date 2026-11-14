package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Zonas do editor (CLUBE_CORACAO, FAVORITE_SINGER, PILOTO_FAVORITO, SUPER_HEROI): a família de cor de um hex é a da cor
 * mais próxima da taxonomia (fora as "Especiais", que não são famílias).
 */
public final class Flair3dZonas {
    public static final String METALICO = "METALICO";
    public static final String ESPELHADO = "ESPELHADO";

    private Flair3dZonas() {
    }

    /** Família da cor da zona, ou nulo quando o hex é inválido. */
    public static String familia(Entrega.Zona zona) {
        int[] rgb = zona == null ? null : rgb(zona.cor());
        if (rgb == null) {
            return null;
        }
        String melhor = null;
        long menor = Long.MAX_VALUE;
        for (Map.Entry<String, String> e : Taxonomy.COLORS.entrySet()) {
            String familia = Taxonomy.COLOR_FAMILY.get(e.getKey());
            int[] t = rgb(e.getValue());
            if (t == null || "Especiais".equals(familia)) {
                continue;
            }
            long d = sq(rgb[0] - t[0]) + sq(rgb[1] - t[1]) + sq(rgb[2] - t[2]);
            if (d < menor) {
                menor = d;
                melhor = familia;
            }
        }
        return melhor;
    }

    public static boolean daFamilia(Entrega.Zona zona, String familia) {
        return familia.equals(familia(zona));
    }

    public static boolean acabamento(Entrega.Zona zona, String acabamento) {
        return zona != null && acabamento.equalsIgnoreCase(Objects.toString(zona.acabamento(), ""));
    }

    /** O hex normalizado (#RRGGBB maiúsculo), para contar cores distintas. */
    public static String hex(Entrega.Zona zona) {
        return zona == null || rgb(zona.cor()) == null ? null : zona.cor().trim().toUpperCase(Locale.ROOT);
    }

    static int[] rgb(String hex) {
        if (hex == null || !hex.trim().matches("#[0-9a-fA-F]{6}")) {
            return null;
        }
        int v = Integer.parseInt(hex.trim().substring(1), 16);
        return new int[]{(v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF};
    }

    private static long sq(int x) {
        return (long) x * x;
    }
}
