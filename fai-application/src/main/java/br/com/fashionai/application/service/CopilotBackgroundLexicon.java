package br.com.fashionai.application.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Vocabulário de fundo do Copilot (RF10): termos PT/EN/ES que levam aos presets do Background Studio (AURA e suas
 * variações, material de fundo, gradiente e cartela sazonal). Mesma regra de comparação de {@link CopilotLexicon},
 * que reexporta estes mapas; o teste de interpretação confere cada destino contra o manifesto de assets.
 */
final class CopilotBackgroundLexicon {
    /** termo → preset AURA (id do manifesto) */
    static final Map<String, String> AURA_PRESETS = new LinkedHashMap<>();
    /** preset AURA → (termo → sufixo do id da variação) */
    static final Map<String, Map<String, String>> AURA_VARIANTS = new LinkedHashMap<>();
    /** termo → material de fundo do Background Studio (id do manifesto) */
    static final Map<String, String> BACKGROUND_MATERIALS = new LinkedHashMap<>();
    /** termo → gradiente AURA (id do manifesto) */
    static final Map<String, String> GRADIENTS = new LinkedHashMap<>();
    /** estação → cartela sazonal (id do manifesto) */
    static final Map<String, String> SEASONAL_PRESETS = Map.of("WINTER", "frost", "SUMMER", "solstice", "AUTUMN", "ember", "SPRING", "bloom");
    /** termos que pedem um material de fundo (evita que "jaqueta de couro" troque o material do fundo) */
    static final List<String> MATERIAL_CUES = List.of("material", "textura", "tecido", "acabamento", "texture", "fabric", "tela");
    /** termos que pedem a cartela sazonal no fundo */
    static final List<String> SEASONAL_CUES = List.of("sazonal", "cartela", "estacao", "estacional", "seasonal", "de temporada");

    static {
        // ---------------------------------------------------------------- AURA
        aura("aura_electro", "eletrico", "aura electro", "eletrica", "eletro", "electro", "electric", "led", "raio", "raios", "voltagem", "energia eletrica", "pulso",
                "choque", "eletronica", "techno", "efeito de luz", "luzes");
        aura("aura_geometry", "geometrico", "aura geometry", "geometry", "geometrica", "geometria", "geometric", "formas geometricas", "poligono", "poligonos", "poligonal",
                "triangulos", "arte grafica", "poster", "bauhaus", "abstrato", "abstrata", "geometrico gradiente");
        aura("aura_splash", "splash", "aura splash", "respingo", "respingos", "mancha de tinta", "manchas de tinta", "tinta", "pigmento", "explosao de cor",
                "paint splash", "ink", "salpico", "salpicos", "aquarela");
        aura("aura_alfaiataria", "alfaiataria", "tailored", "quiet luxury", "luxo silencioso", "tailored steel", "cabide", "cabides", "aco escovado");
        aura("aura_editorial_mono", "editorial", "editorial ivory", "marfim", "ivory", "monocromatico", "monocromatica", "estudio fotografico", "revista");
        aura("aura_romantico_petala", "petala", "petal bloom", "bloom", "petalas", "floral", "flores", "rosas", "romantico", "romantica", "brilho suave");
        aura("aura_boemio_terracota", "terracota", "terracotta", "terracotta dune", "duna", "dunas", "deserto", "boho", "boemio", "boemia", "por do sol", "crepusculo");
        aura("aura_streetwear_neon", "neon", "concrete neon", "concreto", "streetwear", "circuito", "circuitos", "grafite urbano", "diagonais neon");
        aura("aura_avantgarde_cromo", "cromo", "chrome", "chrome iridescent", "iridescent", "cromado", "cromada", "iridescente", "holografico", "holografica", "avant garde", "prisma", "fluxo de luz");
        aura("aura_esportivo_performance", "performance", "performance pulse", "esportivo", "athleisure", "feixes", "velocidade", "pulso esportivo");
        aura("aura_glam_noite", "glam", "midnight spotlight", "midnight", "glamour", "tapete vermelho", "red carpet", "holofote", "spotlight", "palco", "noite de gala", "tecidos flutuando");
        aura("aura_dark_academia", "dark academia", "ivy library", "academia sombria", "livros", "ivy", "estante", "biblioteca antiga");
        aura("aura_natural_organico", "natural", "raw linen", "organico", "organica", "sustentavel", "floresta", "linho cru", "raw linen", "eco", "gotas", "plantas");

        variants("aura_electro", "ciano", "01_cyan_pulse", "cyan", "01_cyan_pulse", "turquesa", "01_cyan_pulse",
                "violeta", "02_violet_voltage", "roxo", "02_violet_voltage", "magenta", "03_magenta_rush", "pink", "03_magenta_rush", "rosa", "03_magenta_rush",
                "lima", "04_lime_circuit", "verde limao", "04_lime_circuit", "solar", "05_solar_flow", "laranja", "05_solar_flow",
                "dourado", "06_gold_charge", "ouro", "06_gold_charge", "brasil", "07_brasil_current", "verde e amarelo", "07_brasil_current",
                "aurora", "08_aurora_boreal", "arco iris", "09_rainbow_spectrum", "rainbow", "09_rainbow_spectrum", "colorido", "09_rainbow_spectrum",
                "gelo", "10_ice_chrome", "prateado", "10_ice_chrome", "vermelho", "11_red_reactor", "reator", "11_red_reactor",
                "sinal", "12_fashion_signal", "fashion", "12_fashion_signal");
        variants("aura_geometry", "geometria um", "geometry_01", "geometria 1", "geometry_01", "geometria dois", "geometry_02", "geometria 2", "geometry_02",
                "geometria tres", "geometry_03", "geometria 3", "geometry_03", "geometria quatro", "geometry_04", "geometria 4", "geometry_04",
                "geometria cinco", "geometry_05", "geometria 5", "geometry_05", "geometria seis", "geometry_06", "geometria 6", "geometry_06");
        variants("aura_splash", "splash um", "splash_01", "splash 1", "splash_01", "splash dois", "splash_02", "splash 2", "splash_02",
                "splash tres", "splash_03", "splash 3", "splash_03", "splash quatro", "splash_04", "splash 4", "splash_04",
                "splash cinco", "splash_05", "splash 5", "splash_05", "splash seis", "splash_06", "splash 6", "splash_06");

        // ---------------------------------------------------------------- materiais de fundo (Background Studio)
        material("la_fria_alfaiataria", "la fria", "worsted", "la de alfaiataria", "tecido de terno");
        material("cetim_liquido", "cetim", "satin", "acetinado", "acetinada", "seda liquida", "raso");
        material("couro_nappa", "nappa", "couro", "leather", "cuero");
        material("veludo_profundo", "veludo", "velvet", "terciopelo", "aveludado", "aveludada");
        material("linho_natural", "linho", "linen", "lino");
        material("malha_canelada", "canelado", "canelada", "ribana", "trico", "tricot", "malha", "knit");
        material("nylon_ripstop", "nylon", "ripstop", "tecido tecnico", "corta vento tecnico");
        material("organza_translucida", "organza", "chiffon", "tule", "voil", "transparente", "translucido", "translucida");
        material("brocado_jacquard", "brocado", "jacquard", "damasco", "adamascado");
        material("denim_selvagem", "denim", "selvedge", "sarja", "jeans cru");
        material("tweed_boucle", "tweed", "boucle", "chanel");
        material("laminado_metalico", "metalico", "metalizado", "metalizada", "laminado", "lame", "paete", "lurex");

        // ---------------------------------------------------------------- gradientes AURA
        gradient("heat_pulse", "pulso de calor", "gradiente quente", "calor pulsante");
        gradient("vibrant_spin", "giro vibrante", "gradiente vibrante", "espiral vibrante");
        gradient("iconic_gold", "ouro iconico", "dourado iconico", "gradiente dourado");
        gradient("legendary_holo", "holo lendario", "gradiente holografico", "holografico lendario");
        gradient("neon_drift", "gradiente neon", "deriva neon");
        gradient("neon_grid", "grade neon", "grid neon", "quadriculado neon");
        gradient("aurora_mist", "nevoa aurora", "gradiente aurora", "bruma aurora");
    }

    private CopilotBackgroundLexicon() {
    }

    private static void aura(String presetId, String... terms) { for (String t : terms) AURA_PRESETS.putIfAbsent(t, presetId); }
    private static void material(String id, String... terms) { for (String t : terms) BACKGROUND_MATERIALS.putIfAbsent(t, id); }
    private static void gradient(String id, String... terms) { for (String t : terms) GRADIENTS.putIfAbsent(t, id); }

    private static void variants(String presetId, String... pairs) {
        Map<String, String> map = AURA_VARIANTS.computeIfAbsent(presetId, k -> new LinkedHashMap<>());
        for (int i = 0; i + 1 < pairs.length; i += 2) map.putIfAbsent(pairs[i], pairs[i + 1]);
    }
}
