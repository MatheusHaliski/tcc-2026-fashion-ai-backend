package br.com.fashionai.application.hype;

import br.com.fashionai.application.hype.HypeScoreConfig.Dimension;
import br.com.fashionai.domain.model.enums.HypeSignalType;

import java.util.Collections;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * HypeScore v2 — leitura tolerante das propriedades da configuração ({@code chave=valor,...} e as faixas): entrada
 * inválida é ignorada ou volta ao padrão, nunca derruba o boot.
 */
final class HypeConfigParsing {
    private HypeConfigParsing() {
    }

    static Map<Dimension, Double> dimensions(String spec) {
        Map<Dimension, Double> out = new EnumMap<>(Dimension.class);
        for (Map.Entry<String, Double> e : pairs(spec).entrySet()) {
            try {
                out.put(Dimension.valueOf(e.getKey().toUpperCase(Locale.ROOT)), e.getValue());
            } catch (IllegalArgumentException ignored) {
                // dimensão desconhecida na propriedade: ignorada (não derruba o boot)
            }
        }
        return Collections.unmodifiableMap(out);
    }

    static Map<HypeSignalType, Double> signals(String spec) {
        Map<HypeSignalType, Double> out = new EnumMap<>(HypeSignalType.class);
        for (Map.Entry<String, Double> e : pairs(spec).entrySet()) {
            try {
                out.put(HypeSignalType.valueOf(e.getKey().toUpperCase(Locale.ROOT)), e.getValue());
            } catch (IllegalArgumentException ignored) {
                // sinal desconhecido: ignorado
            }
        }
        return Collections.unmodifiableMap(out);
    }

    static Map<String, Double> pairs(String spec) {
        Map<String, Double> out = new LinkedHashMap<>();
        if (spec == null) {
            return out;
        }
        for (String part : spec.split(",")) {
            String[] kv = part.trim().split("=");
            if (kv.length == 2) {
                try {
                    out.put(kv[0].trim(), Math.max(0, Double.parseDouble(kv[1].trim())));
                } catch (NumberFormatException ignored) {
                    // valor inválido: ignorado
                }
            }
        }
        return out;
    }

    static int[] thresholds(String spec) {
        int[] fallback = {20, 40, 60, 75, 90};
        if (spec == null) {
            return fallback;
        }
        String[] parts = spec.split(",");
        if (parts.length != fallback.length) {
            return fallback;
        }
        int[] out = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            try {
                out[i] = Integer.parseInt(parts[i].trim());
            } catch (NumberFormatException e) {
                return fallback;
            }
            if (i > 0 && out[i] <= out[i - 1]) {
                return fallback;
            }
        }
        return out;
    }
}
