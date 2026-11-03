package br.com.fashionai.application.seal;

import br.com.fashionai.application.common.Json;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.seal.SealDesignFields.HEX;

/**
 * RF25 — catálogo de modelos prontos do selo ({@code seals/templates.json}, gerado com as artes do frontend por
 * scripts/selos/build_templates.py): ids por tipo, tipo de um modelo pelo prefixo e o modelo circular de cor mais
 * próxima. Extraído de {@link SealDesigns} (R80).
 */
final class SealDesignTemplates {
    /** Prefixo do id do modelo por tipo ("circular/07", "folha/mat-04", "fai/03"). */
    static final Map<String, String> TEMPLATE_PREFIX = Map.of("CIRCULAR", "circular", "FOLHA", "folha", "FASHIONAI", "fai");
    /** Modelos por tipo ("fai", "circular", "folha"): id → cor dominante (folha sem cor). */
    static final Map<String, Map<String, String>> TEMPLATES = loadTemplates();
    static final Map<String, Set<String>> TEMPLATE_IDS = templateIds();

    private SealDesignTemplates() {
    }

    static String kindOfTemplate(String template) {
        if (template.startsWith("folha/")) {
            return "FOLHA";
        }
        return template.startsWith("fai/") ? "FASHIONAI" : "CIRCULAR";
    }

    /** Modelo circular de centro liso com a cor mais próxima (distância RGB ponderada) — usado pela sugestão "Com IA". */
    static String nearestCircular(String hex) {
        int[] c = rgb(hex);
        String best = "circular/01";
        double bd = Double.MAX_VALUE;
        for (Map.Entry<String, String> e : TEMPLATES.getOrDefault("circular", Map.of()).entrySet()) {
            if (e.getValue() == null) {
                continue;
            }
            int[] t = rgb(e.getValue());
            double rm = (c[0] + t[0]) / 2.0;
            double d = (2 + rm / 256) * Math.pow(c[0] - t[0], 2) + 4 * Math.pow(c[1] - t[1], 2) + (2 + (255 - rm) / 256) * Math.pow(c[2] - t[2], 2);
            if (d < bd) {
                bd = d;
                best = e.getKey();
            }
        }
        return best;
    }

    private static int[] rgb(String hex) {
        String h = hex == null || !HEX.matcher(hex).matches() ? "#F58220" : hex;
        int n = Integer.parseInt(h.substring(1), 16);
        return new int[]{(n >> 16) & 255, (n >> 8) & 255, n & 255};
    }

    /** Catálogo de modelos gerado junto com as artes do frontend (seals/templates.json, scripts/selos/build_templates.py). */
    private static Map<String, Map<String, String>> loadTemplates() {
        Map<String, Map<String, String>> out = new LinkedHashMap<>();
        try (InputStream in = SealDesigns.class.getClassLoader().getResourceAsStream("seals/templates.json")) {
            if (in != null) {
                Map<String, Object> m = Json.map(new String(in.readAllBytes(), StandardCharsets.UTF_8));
                m.forEach((kind, list) -> {
                    Map<String, String> byId = new LinkedHashMap<>();
                    if (list instanceof Collection<?> c) {
                        for (Object o : c) {
                            if (o instanceof Map<?, ?> t && t.get("id") != null) {
                                // centro estampado (plain=false) não entra na sugestão por cor
                                boolean plain = !Boolean.FALSE.equals(t.get("plain"));
                                byId.put(String.valueOf(t.get("id")), plain && t.get("color") != null ? String.valueOf(t.get("color")) : null);
                            }
                        }
                    }
                    out.put(kind, Collections.unmodifiableMap(byId));
                });
            }
        } catch (IOException e) {
            throw new IllegalStateException("seals/templates.json ilegível", e);
        }
        return Collections.unmodifiableMap(out);
    }

    private static Map<String, Set<String>> templateIds() {
        Map<String, Set<String>> out = new HashMap<>();
        TEMPLATES.forEach((k, v) -> out.put(k, Set.copyOf(v.keySet())));
        return Map.copyOf(out);
    }
}
