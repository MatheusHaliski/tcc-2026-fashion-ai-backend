package br.com.fashionai.application.flair;


/**
 * Cor no {@link FlairLooks}: família de cor pelo hex (neutro ou faixa de matiz) e luminância para claro/escuro.
 */
final class FlairLookColors {
    private FlairLookColors() {
    }

    // ------------------------------------------------------------------ cor

    /** Família de cor a partir do hex: neutral (baixa saturação, preto/branco/cinza/bege) ou faixa de matiz. */
    public static String family(String hex) {
        if (hex == null || !hex.matches("#?[0-9A-Fa-f]{6}")) {
            return "neutral";
        }
        String h = hex.startsWith("#") ? hex.substring(1) : hex;
        float r = Integer.parseInt(h.substring(0, 2), 16) / 255f, g = Integer.parseInt(h.substring(2, 4), 16) / 255f, b = Integer.parseInt(h.substring(4, 6), 16) / 255f;
        float[] hsb = java.awt.Color.RGBtoHSB(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), null);
        if (hsb[1] < 0.18 || hsb[2] < 0.16) {
            return "neutral";
        }
        float hue = hsb[0] * 360;
        return hue < 15 || hue >= 345 ? "red" : hue < 40 ? "orange" : hue < 65 ? "yellow" : hue < 165 ? "green" : hue < 255 ? "blue" : hue < 290 ? "purple" : "pink";
    }

    static boolean dark(String hex) {
        return hex != null && hex.matches("#?[0-9A-Fa-f]{6}") && luminance(hex) < 0.18;
    }

    static boolean light(String hex) {
        return hex != null && hex.matches("#?[0-9A-Fa-f]{6}") && luminance(hex) > 0.82;
    }

    static double luminance(String hex) {
        String h = hex.startsWith("#") ? hex.substring(1) : hex;
        return (0.299 * Integer.parseInt(h.substring(0, 2), 16) + 0.587 * Integer.parseInt(h.substring(2, 4), 16) + 0.114 * Integer.parseInt(h.substring(4, 6), 16)) / 255.0;
    }
}
