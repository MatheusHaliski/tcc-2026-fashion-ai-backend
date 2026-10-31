package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Regras puras do modelo do Avatar 3D (rosto, pele, cabelo, olhos e sobrancelhas), espelho de
 * {@code lib/avatar3d/model.ts}. Extraídas de {@link Avatar3dService} (lote GoF 12) sem mudança de comportamento:
 * campos obrigatórios fora da regra recusam com {@code MODELO_INVALIDO}; opcionais fora da regra são descartados em
 * silêncio, como no cliente; a saída só leva campos conhecidos, na mesma ordem. O corpo é validado por
 * {@link Avatar3dBodyRules}. Sem Spring, repositório, storage ou relógio.
 */
final class Avatar3dModelRules {
    static final int MODEL_VERSION = 1;
    static final int SHAPE_LEN = 468 * 3;
    private static final Pattern HEX = Pattern.compile("^#[0-9a-fA-F]{6}$");

    private Avatar3dModelRules() {
    }

    /** Mesmas regras de validateModel (lib/avatar3d/model.ts). Devolve só os campos conhecidos. */
    static Map<String, Object> validate(Map<String, Object> m) {
        ApiException invalid = ApiException.badRequest("MODELO_INVALIDO", Msg.t("avatar3d.modelo_invalido"));
        if (m == null || !(m.get("v") instanceof Number v) || v.intValue() != MODEL_VERSION) {
            throw invalid;
        }
        if (!(m.get("shape") instanceof List<?> shape) || shape.size() != SHAPE_LEN) {
            throw invalid;
        }
        for (Object o : shape) {
            if (!(o instanceof Number n) || !Double.isFinite(n.doubleValue()) || Math.abs(n.doubleValue()) >= 40) {
                throw invalid;
            }
        }
        if (!(m.get("skin") instanceof String skin) || !HEX.matcher(skin).matches()) {
            throw invalid;
        }
        if (!(m.get("hair") instanceof Map<?, ?> hair)) {
            throw invalid;
        }
        Object color = hair.get("color");
        if (color != null && !(color instanceof String c && HEX.matcher(c).matches())) {
            throw invalid;
        }
        for (String k : List.of("top", "side", "fringe")) {
            if (!(hair.get(k) instanceof Number n) || !Double.isFinite(n.doubleValue())) {
                throw invalid;
            }
        }
        // campos novos do cabelo (opcionais): valor fora da lista é descartado, como no validateModel do app
        @SuppressWarnings("unchecked") Map<String, Object> h = new LinkedHashMap<>((Map<String, Object>) hair);
        if (h.containsKey("length") && !HAIR_LENGTHS.contains(h.get("length"))) h.remove("length");
        if (h.containsKey("texture") && !HAIR_TEXTURES.contains(h.get("texture"))) h.remove("texture");
        if (h.containsKey("cover") && h.get("cover") != null && !(h.get("cover") instanceof String cv && HEX.matcher(cv).matches())) h.remove("cover");
        if (h.containsKey("outline") && !validOutline(h.get("outline"))) h.remove("outline");
        if (h.containsKey("tone") && h.get("tone") != null && !validTone(h.get("tone"))) h.remove("tone");
        // volume medido (fator 0,5–2,5) e a classe dele
        if (h.containsKey("volume") && !(h.get("volume") instanceof Number vn && Double.isFinite(vn.doubleValue()) && vn.doubleValue() >= 0.5 && vn.doubleValue() <= 2.5)) h.remove("volume");
        if (h.containsKey("volumeLevel") && !HAIR_VOLUMES.contains(h.get("volumeLevel"))) h.remove("volumeLevel");
        // risca medida na foto (−1 … 1) e variação de tom medida (0–1), hair-flow.ts e hair-tone.ts no cliente
        if (h.containsKey("part") && !(h.get("part") instanceof Number pn && Double.isFinite(pn.doubleValue()) && Math.abs(pn.doubleValue()) <= 1)) h.remove("part");
        if (h.containsKey("variation") && !(h.get("variation") instanceof Number vv && Double.isFinite(vv.doubleValue()) && vv.doubleValue() >= 0 && vv.doubleValue() <= 1)) h.remove("variation");
        h.keySet().retainAll(HAIR_KEYS);
        Map<String, Object> out = new LinkedHashMap<>();
        if (m.get("body") instanceof Map<?, ?> body) {
            @SuppressWarnings("unchecked") Map<String, Object> b = (Map<String, Object>) body;
            out.put("body", Avatar3dBodyRules.validate(b));
        }
        for (String k : List.of("v", "shape", "skin", "metrics", "views", "warnings")) {
            if (m.containsKey(k)) {
                out.put(k, m.get(k));
            }
        }
        // corpo base do avatar (estimado pelo rosto no aparelho ou escolhido pela pessoa); valor desconhecido é descartado
        if ("FEMININO".equals(m.get("sex")) || "MASCULINO".equals(m.get("sex"))) {
            out.put("sex", m.get("sex"));
        }
        // pele do corpo medida na foto (opcional): só hex válido passa
        if (m.get("bodySkin") instanceof String bs && HEX.matcher(bs).matches()) {
            out.put("bodySkin", bs);
        }
        out.put("hair", h);
        // olhos (AVATAR-ID I4): opcionais; fora das regras são descartados, o avatar continua (como no app)
        Map<String, Object> eyes = validEyes(m.get("eyes"));
        if (eyes != null) {
            out.put("eyes", eyes);
        }
        Map<String, Object> brows = validBrows(m.get("brows"));
        if (brows != null) {
            out.put("brows", brows);
        }
        return out;
    }

    /** Sobrancelhas (lib/avatar3d/identity/brows.ts): cor "#rrggbb", medidas nas faixas, forma da lista. */
    static final List<String> BROW_SHAPES = List.of("STRAIGHT", "SOFT_ARCH", "HIGH_ARCH");

    static Map<String, Object> validBrows(Object o) {
        if (!(o instanceof Map<?, ?> b) || !isHex(b.get("color")) || !BROW_SHAPES.contains(b.get("shape"))) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("color", b.get("color"));
        for (Map.Entry<String, Double> e : Map.of("thickness", 1.0, "arch", 0.5, "density", 1.0, "confidence", 1.0).entrySet()) {
            if (!(b.get(e.getKey()) instanceof Number n) || !Double.isFinite(n.doubleValue()) || n.doubleValue() < 0 || n.doubleValue() > e.getValue()) {
                return null;
            }
            out.put(e.getKey(), n.doubleValue());
        }
        out.put("shape", b.get("shape"));
        // medidas por fatia, de dentro para fora (opcional, clientes novos): 5 espessuras 0–1 e 5 cores hex ou nulas
        if (b.get("zones") instanceof Map<?, ?> z && z.get("thickness") instanceof List<?> zt && zt.size() == 5
                && z.get("color") instanceof List<?> zc && zc.size() == 5) {
            boolean ok = true;
            List<Object> th = new ArrayList<>(), co = new ArrayList<>();
            for (Object t : zt) {
                if (!(t instanceof Number n) || !Double.isFinite(n.doubleValue()) || n.doubleValue() < 0 || n.doubleValue() > 1) { ok = false; break; }
                th.add(n.doubleValue());
            }
            for (Object cc : zc) {
                if (cc != null && !isHex(cc)) { ok = false; break; }
                co.add(cc);
            }
            if (ok) {
                Map<String, Object> zones = new LinkedHashMap<>();
                zones.put("thickness", th);
                zones.put("color", co);
                out.put("zones", zones);
            }
        }
        return out;
    }

    /** Olhos (lib/avatar3d/iris.ts, AvatarEyes): cores "#rrggbb", valores das listas, confiança 0–1. */
    static final List<String> IRIS_CLASSES = List.of("DARK_BROWN", "MEDIUM_BROWN", "LIGHT_BROWN", "HAZEL", "AMBER", "GREEN", "GREEN_GRAY", "GRAY", "GRAY_BLUE", "BLUE", "BLUE_GRAY");
    static final List<String> IRIS_PATTERNS = List.of("RADIAL", "CRYPT", "RING", "UNIFORM");
    static final List<String> GLASSES_KINDS = List.of("NONE", "PRESCRIPTION", "SUNGLASSES");

    static Map<String, Object> validEyes(Object o) {
        if (!(o instanceof Map<?, ?> e) || !isHex(e.get("color")) || !isHex(e.get("secondary"))) {
            return null;
        }
        if (!IRIS_CLASSES.contains(e.get("cls")) || !IRIS_PATTERNS.contains(e.get("pattern")) || !GLASSES_KINDS.contains(e.get("glasses"))) {
            return null;
        }
        if (!"IMAGE_ANALYSIS".equals(e.get("source")) && !"DEFAULT".equals(e.get("source"))) {
            return null;
        }
        if (!(e.get("confidence") instanceof Number c) || !Double.isFinite(c.doubleValue()) || c.doubleValue() < 0 || c.doubleValue() > 1) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        for (String k : List.of("color", "secondary", "cls", "pattern")) {
            out.put(k, e.get(k));
        }
        out.put("confidence", c.doubleValue());
        out.put("source", e.get("source"));
        out.put("glasses", e.get("glasses"));
        if (isHex(e.get("frame"))) {
            out.put("frame", e.get("frame"));
        }
        // heterocromia: a cor de cada olho, só quando os dois vêm certos
        Map<String, Object> r = irisColor(e.get("right")), l = irisColor(e.get("left"));
        if (r != null && l != null) {
            out.put("right", r);
            out.put("left", l);
        }
        return out;
    }

    private static boolean isHex(Object o) {
        return o instanceof String s && HEX.matcher(s).matches();
    }

    private static Map<String, Object> irisColor(Object o) {
        if (!(o instanceof Map<?, ?> m) || !isHex(m.get("color")) || !isHex(m.get("secondary"))) {
            return null;
        }
        return new LinkedHashMap<>(Map.of("color", m.get("color"), "secondary", m.get("secondary")));
    }

    /** Cabelo: comprimento e textura medidos na foto (lib/avatar3d/hair.ts) e a silhueta por altura. */
    static final List<String> HAIR_LENGTHS = List.of("bald", "buzz", "short", "medium", "long");
    static final List<String> HAIR_TEXTURES = List.of("straight", "wavy", "curly", "coily");
    static final java.util.Set<String> HAIR_KEYS = java.util.Set.of("present", "color", "top", "side", "bottom", "fringe", "cut", "length", "texture", "cover", "outline", "tone", "volume", "volumeLevel", "part", "variation");
    static final List<String> HAIR_VOLUMES = List.of("flat", "normal", "full", "big");
    static final List<String> HAIR_FAMILIES = List.of("natural", "ash", "golden", "copper", "red", "gray", "white");

    /** Tom medido: {level: 1–10, family: uma de HAIR_FAMILIES}, nada mais. */
    static boolean validTone(Object o) {
        if (!(o instanceof Map<?, ?> t) || t.size() != 2 || !(t.get("level") instanceof Number n) || !HAIR_FAMILIES.contains(t.get("family"))) {
            return false;
        }
        double d = n.doubleValue();
        return d == Math.rint(d) && d >= 1 && d <= 10;
    }

    static boolean validOutline(Object o) {
        if (!(o instanceof List<?> l) || l.size() > 32) {
            return false;
        }
        for (Object x : l) {
            if (!(x instanceof Number n) || !Double.isFinite(n.doubleValue()) || n.doubleValue() < 0 || n.doubleValue() > 30) {
                return false;
            }
        }
        return true;
    }
}
