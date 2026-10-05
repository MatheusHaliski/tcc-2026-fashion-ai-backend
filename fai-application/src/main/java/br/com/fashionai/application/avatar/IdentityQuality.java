package br.com.fashionai.application.avatar;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * AVATAR-ID I0/I1 — relatório de qualidade da identidade e o gate (os mesmos limiares de lib/avatar3d/identity/gate.ts).
 *
 * <p>O cliente mede no aparelho (reprojeção, assimetria, captura...) e manda só números agregados. Aqui eles são
 * validados (faixas plausíveis, chaves conhecidas) e o gate é recalculado: o servidor não confia no "passou" do cliente.
 * Nada aqui é forma, cor ou ponto do rosto.
 */
public final class IdentityQuality {
    private IdentityQuality() {
    }

    static final double REPROJ_ALL = 1.5, REPROJ_REGION = 1.2, ASYM_MIN_MM = 1.0, ASYM_PRESERVATION = 0.7,
            HAIR_SILHOUETTE = 0.15, SKIN_DE = 5.0;
    static final List<String> REGIONS = List.of("all", "eyes", "brows", "nose", "mouth", "contour");
    /** Ordem fixa dos checks, igual à do cliente. */
    public static final List<String> CHECKS = List.of("similarityFront", "similarity34", "reprojectionMm", "asymmetry",
            "hairSilhouetteError", "skinColorError", "seams");

    private static Double num(Object o, double lo, double hi) {
        return o instanceof Number n && Double.isFinite(n.doubleValue()) && n.doubleValue() >= lo && n.doubleValue() <= hi
                ? Math.round(n.doubleValue() * 1000) / 1000.0 : null;
    }

    /** Só as chaves conhecidas, nas faixas plausíveis; o resto é descartado. null quando não sobra nada. */
    public static Map<String, Object> sanitize(Map<String, Object> q) {
        if (q == null) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        if (q.get("reprojectionMm") instanceof Map<?, ?> r) {
            Map<String, Object> m = new LinkedHashMap<>();
            for (String k : REGIONS) {
                Double v = num(r.get(k), 0, 100);
                if (v != null) m.put(k, v);
            }
            if (m.containsKey("all")) out.put("reprojectionMm", m);
        }
        if (q.get("asymmetry") instanceof Map<?, ?> a) {
            Double measured = num(a.get("measuredMm"), 0, 100), avatar = num(a.get("avatarMm"), 0, 100), pres = num(a.get("preservation"), 0, 10);
            if (measured != null && pres != null) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("measuredMm", measured);
                if (avatar != null) m.put("avatarMm", avatar);
                m.put("preservation", pres);
                out.put("asymmetry", m);
            }
        }
        for (String k : List.of("capture", "shapePreservation")) {
            Double v = num(q.get(k), 0, 1);
            if (v != null) out.put(k, v);
        }
        Double skin = num(q.get("skinColorError"), 0, 100), hair = num(q.get("hairSilhouetteError"), 0, 1), seams = num(q.get("seams"), 0, 1000);
        if (skin != null) out.put("skinColorError", skin);
        if (hair != null) out.put("hairSilhouetteError", hair);
        if (seams != null) out.put("seams", seams.intValue());
        if (out.isEmpty()) {
            return null;
        }
        out.put("gate", evaluate(out));
        return out;
    }

    /** O gate: {passed, failed[], notMeasured[]}. Semelhança (SFace/ArcFace) é medida no CI, não chega do aparelho. */
    public static Map<String, Object> evaluate(Map<String, Object> m) {
        List<String> failed = new ArrayList<>(), notMeasured = new ArrayList<>();
        for (String k : CHECKS) {
            Object v = m.get(k);
            if (v == null) {
                notMeasured.add(k);
                continue;
            }
            boolean ok = switch (k) {
                case "reprojectionMm" -> {
                    Map<?, ?> r = (Map<?, ?>) v;
                    yield le(r.get("all"), REPROJ_ALL) && le(r.get("eyes"), REPROJ_REGION) && le(r.get("nose"), REPROJ_REGION) && le(r.get("mouth"), REPROJ_REGION);
                }
                case "asymmetry" -> {
                    Map<?, ?> a = (Map<?, ?>) v;
                    yield ((Number) a.get("measuredMm")).doubleValue() <= ASYM_MIN_MM || ((Number) a.get("preservation")).doubleValue() >= ASYM_PRESERVATION;
                }
                case "hairSilhouetteError" -> ((Number) v).doubleValue() <= HAIR_SILHOUETTE;
                case "skinColorError" -> ((Number) v).doubleValue() <= SKIN_DE;
                case "seams" -> ((Number) v).intValue() <= 0;
                default -> true;
            };
            if (!ok) failed.add(k);
        }
        Map<String, Object> g = new LinkedHashMap<>();
        g.put("passed", failed.isEmpty());
        g.put("failed", failed);
        g.put("notMeasured", notMeasured);
        return g;
    }

    /** Região não medida não reprova (o cliente pode não mandar todas). */
    private static boolean le(Object o, double max) {
        return !(o instanceof Number n) || n.doubleValue() <= max;
    }

    /** Passou no gate? Sem relatório (cliente antigo): sim, como antes da versão 2. */
    public static boolean passed(Map<String, Object> sanitized) {
        return sanitized == null || !(sanitized.get("gate") instanceof Map<?, ?> g) || Boolean.TRUE.equals(g.get("passed"));
    }

    @SuppressWarnings("unchecked")
    public static List<String> failed(Map<String, Object> sanitized) {
        return sanitized != null && sanitized.get("gate") instanceof Map<?, ?> g && g.get("failed") instanceof List<?> l
                ? (List<String>) l : List.of();
    }
}
