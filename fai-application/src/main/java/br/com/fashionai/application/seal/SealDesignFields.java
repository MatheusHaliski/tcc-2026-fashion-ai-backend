package br.com.fashionai.application.seal;

import br.com.fashionai.application.common.Msg;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * RF25 — leitura e validação campo a campo do desenho do selo (texto curto, material, cor hexadecimal, número com
 * limites, seção do JSON). Os erros vão para o mapa {@code errors} com o campo apontado. Extraído de {@link SealDesigns} (R80).
 */
final class SealDesignFields {
    static final Pattern TEXT_OK = Pattern.compile("[\\p{L}\\p{N} &+'.,·!?()/-]*");
    static final Pattern HEX = Pattern.compile("^#[0-9A-Fa-f]{6}$");

    private SealDesignFields() {
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> section(Map<String, Object> raw, String key) {
        return raw.get(key) instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }

    /** Texto curto impresso no selo de folha: sem quebras, sem marcação e com limite de tamanho. */
    static String text(Object v, int max, String field, Map<String, String> errors) {
        if (v == null) {
            return null;
        }
        String t = String.valueOf(v).replaceAll("\\s+", " ").trim();
        if (t.isEmpty()) {
            return null;
        }
        if (t.length() > max) {
            errors.put(field, Msg.t("sealDesigns.texto_longo", max));
            t = t.substring(0, max);
        }
        if (!TEXT_OK.matcher(t).matches()) {
            errors.put(field, Msg.t("sealDesigns.texto_caracteres"));
        }
        return t;
    }

    static String upper(Object v, String dflt) {
        return v == null || String.valueOf(v).isBlank() ? dflt : String.valueOf(v).trim().toUpperCase(Locale.ROOT);
    }

    static String material(Object v, String dflt, String field, Map<String, String> errors) {
        String m = upper(v, dflt);
        if (!SealDesigns.MATERIAL_IDS.contains(m)) {
            errors.put(field, Msg.t("sealDesigns.material_desconhecido"));
            return dflt;
        }
        return m;
    }

    static String color(Object v, String dflt, String field, Map<String, String> errors) {
        if (v == null || String.valueOf(v).isBlank()) {
            return dflt;
        }
        String c = String.valueOf(v).trim();
        if (!HEX.matcher(c).matches()) {
            errors.put(field, Msg.t("sealDesigns.cor_em_hexadecimal_rrggbb"));
            return dflt;
        }
        return c.toUpperCase(Locale.ROOT);
    }

    static double number(Object v, double dflt) {
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return v == null ? dflt : Double.parseDouble(String.valueOf(v));
        } catch (NumberFormatException e) {
            return dflt;
        }
    }

    static double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }
}
