package br.com.fashionai.application.seal;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.enums.SealTier;

import java.util.ArrayList;
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
 */
public final class SealDesigns {
    /** Proporções medidas no logo (frações do raio): bisel 6 %, campo até 94 %, disco central 45 %, elemento 36 %. */
    public static final Map<String, Object> GEOMETRY = Map.ofEntries(
            Map.entry("bezel", 0.06), Map.entry("fieldOuter", 0.94), Map.entry("centerDisc", 0.45), Map.entry("element", 0.36),
            Map.entry("uploadRatioTolerance", 0.03), Map.entry("uploadMinPx", 256), Map.entry("uploadMaxPx", 4096), Map.entry("uploadOutputPx", 512),
            // estampa privada no campo do selo (validação mais leve que a do selo inteiro): quadrada, 256–2048 px, saída 1024 px
            Map.entry("patternMinPx", 256), Map.entry("patternMaxPx", 2048), Map.entry("patternOutputPx", 1024),
            // formatos FOLHA e FASHION_AI: folha 240 × 300 (4:5) — scripts/selos/gen.py; o selo enviado pronto nesses formatos
            // respeita a mesma proporção e é salvo em 480 × 600 (o CIRCULAR segue 1:1, circular, 512 × 512)
            Map.entry("sheetWidth", 240), Map.entry("sheetHeight", 300), Map.entry("uploadSheetOutputWidth", 480),
            Map.entry("uploadSheetOutputHeight", 600));

    /**
     * Catálogo do editor "Cadastrar novo selo" (RF20.CA24, docs/novo-projeto/insumos/selos/): os mesmos ids de
     * scripts/selos/gen_mat.py (materiais), gen.py (molduras) e do doc 06 §4 (centro e denominação). Minúsculos, como
     * no objeto SealPolicy ({@code aesthetics.*}) — o desenho guarda em {@code design.style} exatamente o que a política diz.
     */
    /**
     * Formato (silhueta) do selo — escolha de primeira classe do editor e do Copilot ({@code aesthetics.format}):
     * CIRCULAR = medalhão do logo FashionAI; FOLHA = silhueta de folha; FASHION_AI = folha perfurada 4:5 com o emblema
     * (geometria dos SVGs de docs/novo-projeto/insumos/selos/fashion-ai/). O mesmo enum vive em {@code SealFormat}.
     */
    public static final List<String> FORMATS = List.of("CIRCULAR", "FOLHA", "FASHION_AI");
    public static final List<String> STYLE_MATERIALS = List.of("plastico", "metal", "madeira", "vidro", "marmore", "tecido",
            "couro", "ceramica", "neon", "concreto", "ouro", "holo");
    public static final List<String> STYLE_FRAMES = List.of("malha", "hachura", "listras", "chevron", "xadrez", "losango",
            "perolas", "raios", "ondas", "estrelas");
    public static final List<String> STYLE_CENTERS = List.of("logo_url", "camisa_3d", "sacola_fai", "vazio");
    public static final List<String> STYLE_DENOMINATIONS = List.of("year", "edition", "serial");
    /** RF21.CA20 — Selo Premium (celebridade) só aceita material vítreo. */
    public static final List<String> PREMIUM_MATERIALS = List.of("vidro", "holo");

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
        Map<String, Object> style = new LinkedHashMap<>();
        style.put("formats", FORMATS);
        style.put("materials", STYLE_MATERIALS);
        style.put("premiumMaterials", PREMIUM_MATERIALS);
        style.put("frames", STYLE_FRAMES);
        style.put("centers", STYLE_CENTERS);
        style.put("denominations", STYLE_DENOMINATIONS);
        m.put("style", style);
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
        element.put("id", tier == SealTier.PECA ? "HANGER" : tier == SealTier.PERFIL ? "LAUREL" : "BAG");
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
        String mode = upper(raw.get("mode"), "GENERATED");
        if (!mode.equals("GENERATED") && !mode.equals("UPLOAD")) {
            errors.put("mode", Msg.t("sealDesigns.use_generated_ou_upload"));
            mode = "GENERATED";
        }
        out.put("mode", mode);
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

        // RF20.CA24 — formato e estilo do catálogo (selects do editor). O validador do selo enviado pronto depende do formato.
        String format = upper(raw.get("format"), "CIRCULAR");
        if (!FORMATS.contains(format)) {
            errors.put("format", Msg.t("sealDesigns.formato_desconhecido"));
            format = "CIRCULAR";
        }
        out.put("format", format);
        Map<String, Object> style = section(raw, "style");
        if (!style.isEmpty()) {
            Map<String, Object> st = new LinkedHashMap<>();
            st.put("material", pick(style.get("material"), STYLE_MATERIALS, "plastico", "style.material", errors));
            st.put("frame", pick(style.get("frame"), STYLE_FRAMES, "malha", "style.frame", errors));
            st.put("center", pick(style.get("center"), STYLE_CENTERS, "logo_url", "style.center", errors));
            st.put("denomination", pick(style.get("denomination"), STYLE_DENOMINATIONS, "year", "style.denomination", errors));
            st.put("number", (int) clamp(number(style.get("number"), 1), 1, 9999));
            out.put("style", st);
        }
        // Estampa privada do emissor aplicada como textura do CAMPO (o centro segue com o logotipo/emblema).
        Map<String, Object> printed = section(raw, "fieldPattern");
        Object patternUrl = printed.get("url");
        if (patternUrl != null && !String.valueOf(patternUrl).isBlank()) {
            String url = String.valueOf(patternUrl).trim();
            if (!(url.startsWith("/media/") || url.startsWith("http://") || url.startsWith("https://"))) {
                errors.put("fieldPattern.url", Msg.t("sealDesigns.url_de_upload_invalida"));
            }
            Map<String, Object> fp = new LinkedHashMap<>();
            fp.put("url", url);
            fp.put("scale", (int) clamp(number(printed.get("scale"), 1), 1, 3));
            out.put("fieldPattern", fp);
        }
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

    private static String lower(Object v, String dflt) {
        return v == null || String.valueOf(v).isBlank() ? dflt : String.valueOf(v).trim().toLowerCase(Locale.ROOT);
    }

    private static String pick(Object v, List<String> allowed, String dflt, String field, Map<String, String> errors) {
        String id = lower(v, dflt);
        if (!allowed.contains(id)) {
            errors.put(field, Msg.t("sealDesigns.item_fora_do_catalogo"));
            return dflt;
        }
        return id;
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
