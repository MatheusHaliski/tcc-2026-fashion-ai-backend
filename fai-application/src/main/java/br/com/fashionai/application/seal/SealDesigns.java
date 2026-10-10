package br.com.fashionai.application.seal;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.enums.SealTier;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * RF25 — criador de selo. O desenho segue o medalhão do logo FashionAI: borda (bisel), campo entre a borda e o
 * centro (malha, grade, fluxo de pontos…), disco central e elemento central. Cada parte tem cor e material.
 * O mesmo catálogo é espelhado no frontend (components/seal-medallion.tsx), que desenha o SVG; aqui fica a
 * validação do JSON persistido em {@code seals.background_config_json.design}.
 *
 * <p>Três tipos de selo ({@code kind}): CIRCULAR (gerado, enviado ou modelo de anel com o elemento central do criador),
 * FOLHA (folha picotada com o nome do selo como título e uma legenda) e FASHIONAI (medalhão padrão pronto). Os modelos
 * ({@code template}, modo TEMPLATE) vêm de {@code seals/template-ids.json}, gerado com as artes do frontend por
 * scripts/selos/build_templates.py. Desenhos antigos, sem {@code kind}, continuam válidos como circulares.
 */
public final class SealDesigns {
    /** Proporções medidas no logo (frações do raio): bisel 6 %, campo até 94 %, disco central 45 %, elemento 36 %. */
    public static final Map<String, Object> GEOMETRY = Map.of(
            "bezel", 0.06, "fieldOuter", 0.94, "centerDisc", 0.45, "element", 0.36,
            "uploadRatioTolerance", 0.03, "uploadMinPx", 256, "uploadMaxPx", 4096, "uploadOutputPx", 512);

    public static final List<Map<String, String>> ELEMENTS = List.of(
            item("BAG", Msg.k("sealDesigns.sacola_fai")), item("HANGER", "Cabide"), item("STAR", "Estrela"), item("DIAMOND", "Diamante"),
            item("CROWN", "Coroa"), item("HEART", Msg.k("sealDesigns.coracao")), item("SCISSORS", "Tesoura"), item("NEEDLE", "Agulha"),
            item("LAUREL", "Louro"), item("BOLT", "Raio"), item("FLOWER", "Flor"), item("MONOGRAM", "Monograma"));

    /** "Qualquer elemento entre a borda e o centro". */
    public static final List<Map<String, String>> PATTERNS = List.of(
            item("MALHA", Msg.k("sealDesigns.malha_de_nos_logo")), item("GRADE", "Grade"), item("FLUXO_PONTOS", Msg.k("sealDesigns.fluxo_de_pontos")),
            item("PONTOS", "Pontos"), item("RAIOS", "Raios"), item("ONDAS", "Ondas"), item("ANEIS", Msg.k("sealDesigns.aneis")),
            item("HEXAGONOS", Msg.k("sealDesigns.hexagonos")), item("ESTRELAS", "Estrelas"), item("COSTURA", "Costura"),
            item("ESPINHA", Msg.k("sealDesigns.espinha_de_peixe")), item("TRAMA", Msg.k("sealDesigns.trama_textil")), item("NENHUM", "Liso"));

    public static final List<Map<String, String>> MATERIALS = List.of(
            item("FOSCO", "Fosco"), item("BRILHO", "Brilho"), item("DOURADO", "Dourado"), item("PRATA", "Prata"),
            item("BRONZE", "Bronze"), item("HOLOGRAFICO", Msg.k("common.holografico")), item("ESMALTE", "Esmalte"),
            item("MADEIRA", "Madeira"), item("COURO", "Couro"), item("TECIDO", "Tecido"), item("VIDRO", "Vidro"),
            item("NEON", "Neon"));

    /** Paletas prontas: borda, campo, linhas, nós, disco central, elemento. */
    public static final Map<String, Map<String, Object>> PALETTES = new LinkedHashMap<>();

    static {
        palette("FAI", "#2B2622", "#F58220", "#F6E8CF", List.of("#F9B21C", "#2E86C1", "#6DB33F", "#7A4E2D", "#F26522"), "#F6E8CF", "#2B2622");
        palette("DOURADO", "#5A4212", "#1F1A14", "#C9A24A", List.of("#F2D27A", "#C9A24A", "#8A6A1E"), "#F5E9C8", "#2B2622");
        palette("MONOCROMO", "#111111", "#2A2A2A", "#8A8A8A", List.of("#FFFFFF", "#BDBDBD", "#7A7A7A"), "#F2F2F2", "#111111");
        palette("PASTEL", "#6B5B95", "#F7D9E3", "#FFFFFF", List.of("#B8E0D2", "#D6EADF", "#EAC4D5", "#F9E0C9"), "#FFF7F0", "#6B5B95");
        palette("NOTURNO", "#0E1230", "#1B2255", "#3D4CA3", List.of("#7C5FC0", "#4FB3AE", "#F9B21C"), "#EEF1FF", "#0E1230");
        palette("ESMERALDA", "#0F3D2E", "#1E7A5A", "#BFE8D3", List.of("#F9B21C", "#FFFFFF", "#8FD3B6"), "#F2FBF6", "#0F3D2E");
        palette("RUBI", "#3D0A14", "#9B1B30", "#F4C2CC", List.of("#F9B21C", "#FFFFFF", "#E06B7D"), "#FFF3F5", "#3D0A14");
        palette("SAFIRA", "#0B1F3F", "#1D4E89", "#BFD7F2", List.of("#F9B21C", "#FFFFFF", "#7FB3E6"), "#F0F6FF", "#0B1F3F");
    }

    public static final List<String> KINDS = List.of("CIRCULAR", "FOLHA", "FASHIONAI");
    public static final int LABEL_MAX = 22;
    public static final int CAPTION_MAX = 40;
    public static final int CORE_TEXT_MAX = 24;
    /** Demais textos editáveis da folha e o limite de cada um (título = label, legenda = caption). */
    public static final Map<String, Integer> FOLHA_TEXT_LIMITS = Map.of("series", 40, "subtitle", 36, "style", 28, "year", 6, "emblem", 4);
    public static final List<String> CORE_MODES = List.of("ELEMENT", "IMAGE", "TEXT");
    /** Prefixo do id do modelo por tipo ("circular/07", "folha/mat-04", "fai/03"). */
    private static final Map<String, String> TEMPLATE_PREFIX = Map.of("CIRCULAR", "circular", "FOLHA", "folha", "FASHIONAI", "fai");
    /** Modelos por tipo ("fai", "circular", "folha"): id → cor dominante (folha sem cor). */
    private static final Map<String, Map<String, String>> TEMPLATES = loadTemplates();
    private static final Map<String, Set<String>> TEMPLATE_IDS = templateIds();
    private static final Pattern TEXT_OK = Pattern.compile("[\\p{L}\\p{N} &+'.,·!?()/-]*");
    private static final Set<String> ELEMENT_IDS = ids(ELEMENTS);
    private static final Set<String> PATTERN_IDS = ids(PATTERNS);
    private static final Set<String> MATERIAL_IDS = ids(MATERIALS);
    private static final Pattern HEX = Pattern.compile("^#[0-9A-Fa-f]{6}$");

    private SealDesigns() {
    }

    public static Map<String, Object> catalog() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("geometry", GEOMETRY);
        m.put("elements", ELEMENTS);
        m.put("patterns", PATTERNS);
        m.put("materials", MATERIALS);
        m.put("palettes", PALETTES);
        m.put("kinds", KINDS);
        m.put("templates", TEMPLATE_IDS);
        m.put("uploadRule", Msg.t("sealDesigns.imagem_quadrada_1_1_tolerancia"));
        return m;
    }

    /** Desenho padrão de um selo (marca: malha FAI; celebridade Premium: holográfico com estrelas). */
    public static Map<String, Object> defaultDesign(boolean premium, SealTier tier) {
        Map<String, Object> d = fromPalette(premium ? "NOTURNO" : "FAI");
        d.put("mode", "GENERATED");
        part(d, "border").put("material", premium ? "HOLOGRAFICO" : "FOSCO");
        Map<String, Object> field = part(d, "field");
        field.put("pattern", premium ? "ESTRELAS" : "MALHA");
        field.put("material", premium ? "VIDRO" : "FOSCO");
        field.put("density", 2);
        part(d, "center").put("material", premium ? "VIDRO" : "FOSCO");
        Map<String, Object> element = part(d, "element");
        element.put("id", tier == SealTier.PECA ? "HANGER" : "BAG");
        element.put("material", premium ? "DOURADO" : "FOSCO");
        element.put("text", "FAI");
        return d;
    }

    /** Valida e normaliza o JSON do desenho vindo do formulário; ids inválidos viram 400 com o campo apontado. */
    public static Map<String, Object> normalize(Map<String, Object> raw) {
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        Map<String, String> errors = new LinkedHashMap<>();
        Map<String, Object> out = new LinkedHashMap<>();
        String template = raw.get("template") == null || String.valueOf(raw.get("template")).isBlank() ? null : String.valueOf(raw.get("template")).trim().toLowerCase(Locale.ROOT);
        String mode = upper(raw.get("mode"), template == null ? "GENERATED" : "TEMPLATE");
        if (!mode.equals("GENERATED") && !mode.equals("UPLOAD") && !mode.equals("TEMPLATE")) {
            errors.put("mode", Msg.t("sealDesigns.use_generated_ou_upload"));
            mode = "GENERATED";
        }
        String kind = upper(raw.get("kind"), template == null ? "CIRCULAR" : kindOfTemplate(template));
        if (!KINDS.contains(kind)) {
            errors.put("kind", Msg.t("sealDesigns.tipo_desconhecido"));
            kind = "CIRCULAR";
        }
        if (!kind.equals("CIRCULAR")) {
            mode = "TEMPLATE";                                    // folha e padrão FashionAI são sempre um modelo
        }
        if (mode.equals("TEMPLATE")) {
            Set<String> known = TEMPLATE_IDS.getOrDefault(TEMPLATE_PREFIX.get(kind), Set.of());
            if (template == null || !template.startsWith(TEMPLATE_PREFIX.get(kind) + "/") || !known.contains(template)) {
                errors.put("template", Msg.t("sealDesigns.modelo_desconhecido"));
            }
        } else {
            template = null;
        }
        out.put("kind", kind);
        out.put("mode", mode);
        out.put("template", template);
        if (kind.equals("FOLHA")) {
            out.put("label", text(raw.get("label"), LABEL_MAX, "label", errors));
            out.put("caption", text(raw.get("caption"), CAPTION_MAX, "caption", errors));
            Map<String, Object> texts = section(raw, "texts");
            Map<String, Object> tx = new LinkedHashMap<>();
            for (String k : List.of("series", "subtitle", "style", "year", "emblem")) {
                String v = text(texts.get(k), FOLHA_TEXT_LIMITS.get(k), "texts." + k, errors);
                if (v != null) {
                    tx.put(k, v);
                }
            }
            out.put("texts", tx);
        }
        if (!kind.equals("FASHIONAI") && !mode.equals("UPLOAD")) {
            out.put("core", core(section(raw, "core"), errors));           // núcleo do circular / emblema da folha
        }
        String palette = raw.get("palette") == null ? null : upper(raw.get("palette"), null);
        if (palette != null && !PALETTES.containsKey(palette)) {
            errors.put("palette", Msg.t("sealDesigns.paleta_desconhecida"));
        }
        out.put("palette", palette);

        Map<String, Object> border = section(raw, "border");
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("material", material(border.get("material"), "FOSCO", "border.material", errors));
        b.put("color", color(border.get("color"), "#2B2622", "border.color", errors));
        b.put("width", clamp(number(border.get("width"), 0.06), 0.03, 0.12));
        out.put("border", b);

        Map<String, Object> field = section(raw, "field");
        Map<String, Object> f = new LinkedHashMap<>();
        String pattern = upper(field.get("pattern"), "MALHA");
        if (!PATTERN_IDS.contains(pattern)) {
            errors.put("field.pattern", Msg.t("sealDesigns.padrao_desconhecido"));
        }
        f.put("pattern", pattern);
        f.put("material", material(field.get("material"), "FOSCO", "field.material", errors));
        f.put("color", color(field.get("color"), "#F58220", "field.color", errors));
        f.put("lineColor", color(field.get("lineColor"), "#F6E8CF", "field.lineColor", errors));
        List<String> nodes = new ArrayList<>();
        if (field.get("nodeColors") instanceof List<?> l) {
            for (Object o : l) {
                if (nodes.size() >= 6) {
                    break;
                }
                String c = String.valueOf(o);
                if (HEX.matcher(c).matches()) {
                    nodes.add(c.toUpperCase(Locale.ROOT));
                }
            }
        }
        if (nodes.isEmpty()) {
            nodes.addAll(List.of("#F9B21C", "#2E86C1", "#6DB33F", "#7A4E2D"));
        }
        f.put("nodeColors", nodes);
        f.put("density", (int) clamp(number(field.get("density"), 2), 1, 3));
        f.put("seed", (int) clamp(number(field.get("seed"), 1), 1, 9999));
        out.put("field", f);

        Map<String, Object> center = section(raw, "center");
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("material", material(center.get("material"), "FOSCO", "center.material", errors));
        c.put("color", color(center.get("color"), "#F6E8CF", "center.color", errors));
        c.put("radius", clamp(number(center.get("radius"), 0.45), 0.3, 0.6));
        out.put("center", c);

        Map<String, Object> element = section(raw, "element");
        Map<String, Object> e = new LinkedHashMap<>();
        String id = upper(element.get("id"), "BAG");
        if (!ELEMENT_IDS.contains(id)) {
            errors.put("element.id", Msg.t("sealDesigns.elemento_central_desconhecido"));
        }
        e.put("id", id);
        e.put("material", material(element.get("material"), "FOSCO", "element.material", errors));
        e.put("color", color(element.get("color"), "#2B2622", "element.color", errors));
        String text = element.get("text") == null ? "FAI" : String.valueOf(element.get("text")).trim().toUpperCase(Locale.ROOT);
        text = text.replaceAll("[^A-Z0-9&+]", "");
        if (text.isEmpty()) {
            text = "FAI";
        }
        if (text.length() > 3) {
            errors.put("element.text", Msg.t("sealDesigns.no_maximo_3_caracteres"));
            text = text.substring(0, 3);
        }
        e.put("text", text);
        out.put("element", e);

        Object upload = raw.get("uploadUrl");
        String uploadUrl = upload == null || String.valueOf(upload).isBlank() ? null : String.valueOf(upload).trim();
        if (mode.equals("UPLOAD")) {
            if (uploadUrl == null) {
                errors.put("uploadUrl", Msg.t("sealDesigns.envie_a_imagem_do_selo"));
            } else if (!(uploadUrl.startsWith("/media/") || uploadUrl.startsWith("http://") || uploadUrl.startsWith("https://"))) {
                errors.put("uploadUrl", Msg.t("sealDesigns.url_de_upload_invalida"));
            }
        }
        out.put("uploadUrl", uploadUrl);
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("SELO_DESIGN_INVALIDO", Msg.t("sealDesigns.revise_o_desenho_do_selo"), Map.of("fields", errors));
        }
        return out;
    }

    /** Monta um desenho inteiro a partir de uma paleta (o formulário usa como ponto de partida). */
    public static Map<String, Object> fromPalette(String paletteId) {
        Map<String, Object> p = PALETTES.getOrDefault(paletteId, PALETTES.get("FAI"));
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("mode", "GENERATED");
        d.put("palette", paletteId);
        Map<String, Object> border = new LinkedHashMap<>();
        border.put("material", "FOSCO");
        border.put("color", p.get("border"));
        border.put("width", 0.06);
        d.put("border", border);
        Map<String, Object> field = new LinkedHashMap<>();
        field.put("pattern", "MALHA");
        field.put("material", "FOSCO");
        field.put("color", p.get("field"));
        field.put("lineColor", p.get("line"));
        field.put("nodeColors", p.get("nodes"));
        field.put("density", 2);
        field.put("seed", 1);
        d.put("field", field);
        Map<String, Object> center = new LinkedHashMap<>();
        center.put("material", "FOSCO");
        center.put("color", p.get("center"));
        center.put("radius", 0.45);
        d.put("center", center);
        Map<String, Object> element = new LinkedHashMap<>();
        element.put("id", "BAG");
        element.put("material", "FOSCO");
        element.put("color", p.get("element"));
        element.put("text", "FAI");
        d.put("element", element);
        d.put("uploadUrl", null);
        return d;
    }

    // ------------------------------------------------------------------ helpers
    private static Map<String, String> item(String id, String label) {
        return Map.of("id", id, "label", label);
    }

    private static void palette(String id, String border, String field, String line, List<String> nodes, String center, String element) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("id", id);
        p.put("border", border);
        p.put("field", field);
        p.put("line", line);
        p.put("nodes", nodes);
        p.put("center", center);
        p.put("element", element);
        PALETTES.put(id, p);
    }

    private static Set<String> ids(List<Map<String, String>> items) {
        return items.stream().map(i -> i.get("id")).collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> part(Map<String, Object> d, String key) {
        return (Map<String, Object>) d.computeIfAbsent(key, k -> new LinkedHashMap<String, Object>());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> section(Map<String, Object> raw, String key) {
        return raw.get(key) instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }

    /** Núcleo editável: elemento da arte, imagem enviada pelo emissor (recortada no disco/emblema) ou texto livre. */
    private static Map<String, Object> core(Map<String, Object> raw, Map<String, String> errors) {
        Map<String, Object> c = new LinkedHashMap<>();
        String mode = upper(raw.get("mode"), "ELEMENT");
        if (!CORE_MODES.contains(mode)) {
            errors.put("core.mode", Msg.t("sealDesigns.nucleo_modo"));
            mode = "ELEMENT";
        }
        c.put("mode", mode);
        Object img = raw.get("imageUrl");
        String imageUrl = img == null || String.valueOf(img).isBlank() ? null : String.valueOf(img).trim();
        if (imageUrl != null && !(imageUrl.startsWith("/media/") || imageUrl.startsWith("http://") || imageUrl.startsWith("https://"))) {
            errors.put("core.imageUrl", Msg.t("sealDesigns.url_de_upload_invalida"));
        }
        if (mode.equals("IMAGE") && imageUrl == null) {
            errors.put("core.imageUrl", Msg.t("sealDesigns.nucleo_sem_imagem"));
        }
        String text = text(raw.get("text"), CORE_TEXT_MAX, "core.text", errors);
        if (mode.equals("TEXT") && text == null) {
            errors.put("core.text", Msg.t("sealDesigns.nucleo_sem_texto"));
        }
        c.put("imageUrl", imageUrl);
        c.put("text", text);
        c.put("textColor", raw.get("textColor") == null ? null : color(raw.get("textColor"), null, "core.textColor", errors));
        c.put("zoom", clamp(number(raw.get("zoom"), 1), 1, 3));
        return c;
    }

    /** Título padrão da folha a partir do nome do selo (só os caracteres que a folha imprime, até {@link #LABEL_MAX}). */
    public static String labelFrom(String name) {
        String t = name == null ? "" : name.replaceAll("[^\\p{L}\\p{N} &+'.,·!?()/-]", "").replaceAll("\\s+", " ").trim();
        t = t.length() > LABEL_MAX ? t.substring(0, LABEL_MAX).trim() : t;
        return t.isEmpty() ? "FASHION AI" : t;
    }

    /** Texto curto impresso no selo de folha: sem quebras, sem marcação e com limite de tamanho. */
    private static String text(Object v, int max, String field, Map<String, String> errors) {
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

    private static String kindOfTemplate(String template) {
        if (template.startsWith("folha/")) {
            return "FOLHA";
        }
        return template.startsWith("fai/") ? "FASHIONAI" : "CIRCULAR";
    }

    /** Modelo circular de centro liso com a cor mais próxima (distância RGB ponderada) — usado pela sugestão "Com IA". */
    public static String nearestCircular(String hex) {
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

    private static String upper(Object v, String dflt) {
        return v == null || String.valueOf(v).isBlank() ? dflt : String.valueOf(v).trim().toUpperCase(Locale.ROOT);
    }

    private static String material(Object v, String dflt, String field, Map<String, String> errors) {
        String m = upper(v, dflt);
        if (!MATERIAL_IDS.contains(m)) {
            errors.put(field, Msg.t("sealDesigns.material_desconhecido"));
            return dflt;
        }
        return m;
    }

    private static String color(Object v, String dflt, String field, Map<String, String> errors) {
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

    private static double number(Object v, double dflt) {
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return v == null ? dflt : Double.parseDouble(String.valueOf(v));
        } catch (NumberFormatException e) {
            return dflt;
        }
    }

    private static double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }
}
