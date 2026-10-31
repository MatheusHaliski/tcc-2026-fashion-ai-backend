package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Regras puras do corpo do Avatar 3D (dado corporal pessoal, LGPD): faixas das proporções e profundidades
 * ({@code lib/avatar3d/body-spec.ts}), medidas de fita ({@code lib/tryon/sizes.ts}) e o recorte do que outra pessoa
 * pode ver ({@link #publicModel}). Extraídas de {@link Avatar3dService} (lote GoF 12) sem mudança de comportamento;
 * qualquer violação recusa com {@code CORPO_INVALIDO}. Sem Spring, repositório, storage ou relógio.
 */
final class Avatar3dBodyRules {
    private Avatar3dBodyRules() {
    }

    /** Medidas de fita (cm) e número do calçado (BR): as mesmas faixas de lib/tryon/sizes.ts (TAPE_RANGE). */
    static final Map<String, double[]> TAPE_RANGE = Map.of(
            "chest", new double[]{60, 170}, "waist", new double[]{50, 170}, "hip", new double[]{60, 180}, "shoe", new double[]{33, 46});
    /** O que é da pessoa e não vai para quem vê o avatar dela: altura e peso informados e as medidas de fita. */
    static final List<String> PERSONAL_BODY_KEYS = List.of("heightCm", "weightKg", "measuresCm");

    /** Modelo para outra pessoa: as proporções desenham o corpo; as medidas pessoais ficam só com o dono. */
    static Map<String, Object> publicModel(Map<String, Object> model) {
        if (!(model.get("body") instanceof Map<?, ?> body)) {
            return model;
        }
        Map<String, Object> b = new LinkedHashMap<>();
        body.forEach((k, v) -> {
            if (!PERSONAL_BODY_KEYS.contains(String.valueOf(k))) {
                b.put(String.valueOf(k), v);
            }
        });
        Map<String, Object> out = new LinkedHashMap<>(model);
        out.put("body", b);
        return out;
    }

    /** Faixas plausíveis de cada proporção do corpo (as mesmas de lib/avatar3d/body-spec.ts, BODY_RANGE). */
    static final Map<String, double[]> BODY_RANGE = Map.of(
            "stature", new double[]{1.2, 2.2}, "shoulderW", new double[]{0.15, 0.26}, "chestW", new double[]{0.13, 0.26},
            "waistW", new double[]{0.11, 0.26}, "hipW", new double[]{0.15, 0.27}, "legLen", new double[]{0.46, 0.58},
            "armLen", new double[]{0.29, 0.38}, "headH", new double[]{0.11, 0.155}, "build", new double[]{-1.5, 2});
    /**
     * Profundidades do tronco (frente → costas): só existem quando uma foto de perfil as mediu ou a pessoa as
     * ajustou. Ausentes, o corpo é o mesmo de antes (a profundidade sai da largura) — por isso são opcionais aqui,
     * e corpos salvos antes desta versão continuam válidos.
     */
    static final Map<String, double[]> BODY_DEPTH_RANGE = Map.of(
            "chestD", new double[]{0.08, 0.22}, "waistD", new double[]{0.07, 0.24}, "hipD", new double[]{0.08, 0.24});
    static final List<String> BODY_SOURCES = List.of("observed", "user", "estimated", "default");

    /**
     * Corpo do avatar: só números finitos dentro das faixas, uma origem conhecida por proporção, altura e peso
     * informados dentro de limites humanos. Devolve só os campos conhecidos (nada de texto livre).
     */
    static Map<String, Object> validate(Map<String, Object> b) {
        ApiException invalid = ApiException.badRequest("CORPO_INVALIDO", Msg.t("avatar3d.corpo_invalido"));
        if (b == null || !(b.get("v") instanceof Number v) || v.intValue() != 1) {
            throw invalid;
        }
        if (!"FEMININO".equals(b.get("sex")) && !"MASCULINO".equals(b.get("sex"))) {
            throw invalid;
        }
        if (!(b.get("params") instanceof Map<?, ?> params) || !(b.get("sources") instanceof Map<?, ?> sources)) {
            throw invalid;
        }
        Map<String, Object> p = new LinkedHashMap<>(), src = new LinkedHashMap<>();
        for (Map.Entry<String, double[]> e : BODY_RANGE.entrySet()) {
            Object n = params.get(e.getKey());
            if (!(n instanceof Number num) || !Double.isFinite(num.doubleValue()) || num.doubleValue() < e.getValue()[0] || num.doubleValue() > e.getValue()[1]) {
                throw invalid;
            }
            Object sv = sources.get(e.getKey());
            if (!(sv instanceof String so) || !BODY_SOURCES.contains(so)) {
                throw invalid;
            }
            p.put(e.getKey(), num.doubleValue());
            src.put(e.getKey(), so);
        }
        // profundidades: opcionais, mas quando vêm precisam do valor na faixa E da origem, como qualquer medida
        for (Map.Entry<String, double[]> e : BODY_DEPTH_RANGE.entrySet()) {
            Object n = params.get(e.getKey()), sv = sources.get(e.getKey());
            if (n == null && sv == null) {
                continue;
            }
            if (!(n instanceof Number num) || !Double.isFinite(num.doubleValue()) || num.doubleValue() < e.getValue()[0] || num.doubleValue() > e.getValue()[1]
                    || !(sv instanceof String so) || !BODY_SOURCES.contains(so)) {
                throw invalid;
            }
            p.put(e.getKey(), num.doubleValue());
            src.put(e.getKey(), so);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("v", 1);
        out.put("sex", b.get("sex"));
        out.put("params", p);
        out.put("sources", src);
        out.put("heightCm", bounded(b.get("heightCm"), 120, 220));
        out.put("weightKg", bounded(b.get("weightKg"), 30, 250));
        // medidas de fita e número do calçado informados pela pessoa (opcionais): só o tamanho do provador usa
        if (b.get("measuresCm") instanceof Map<?, ?> tape) {
            Map<String, Object> cm = new LinkedHashMap<>();
            for (Map.Entry<String, double[]> e : TAPE_RANGE.entrySet()) {
                Double cmValue = bounded(tape.get(e.getKey()), e.getValue()[0], e.getValue()[1]);
                if (cmValue != null) {
                    cm.put(e.getKey(), cmValue);
                }
            }
            if (!cm.isEmpty()) {
                out.put("measuresCm", cm);
            }
        }
        out.put("photo", Boolean.TRUE.equals(b.get("photo")));
        out.put("warnings", b.get("warnings") instanceof List<?> w ? w.stream().limit(20).map(String::valueOf)
                .map(x -> x.replaceAll("[^A-Za-z0-9_]", "")).filter(x -> !x.isEmpty()).toList() : List.of());
        return out;
    }

    private static Double bounded(Object o, double lo, double hi) {
        if (o == null) {
            return null;
        }
        if (!(o instanceof Number n) || !Double.isFinite(n.doubleValue()) || n.doubleValue() < lo || n.doubleValue() > hi) {
            throw ApiException.badRequest("CORPO_INVALIDO", Msg.t("avatar3d.corpo_invalido"));
        }
        return n.doubleValue();
    }
}
