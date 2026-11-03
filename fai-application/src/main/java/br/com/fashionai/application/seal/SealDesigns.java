package br.com.fashionai.application.seal;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.enums.SealTier;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
    static final Set<String> ELEMENT_IDS = ids(ELEMENTS);
    static final Set<String> PATTERN_IDS = ids(PATTERNS);
    static final Set<String> MATERIAL_IDS = ids(MATERIALS);

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
        m.put("templates", SealDesignTemplates.TEMPLATE_IDS);
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
        return SealDesignNormalizer.normalize(raw);
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

    /** Título padrão da folha a partir do nome do selo (só os caracteres que a folha imprime, até {@link #LABEL_MAX}). */
    public static String labelFrom(String name) {
        String t = name == null ? "" : name.replaceAll("[^\\p{L}\\p{N} &+'.,·!?()/-]", "").replaceAll("\\s+", " ").trim();
        t = t.length() > LABEL_MAX ? t.substring(0, LABEL_MAX).trim() : t;
        return t.isEmpty() ? "FASHION AI" : t;
    }

    /** Modelo circular de centro liso com a cor mais próxima (distância RGB ponderada) — usado pela sugestão "Com IA". */
    public static String nearestCircular(String hex) {
        return SealDesignTemplates.nearestCircular(hex);
    }
}
