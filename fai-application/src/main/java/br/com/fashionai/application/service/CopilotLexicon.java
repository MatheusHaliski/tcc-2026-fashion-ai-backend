package br.com.fashionai.application.service;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Vocabulário do Copilot (RF10): palavras-chave em PT/EN/ES que o interpretador local converte em códigos da
 * taxonomia (ocasião, estilo, humor, peça, cor, material), em estação do ano, em faixa de clima do WeatherService e
 * nos presets do Background Studio (AURA, material de fundo, gradiente e cartela sazonal).
 * <p>
 * Cada termo é comparado por palavra inteira e sem acento ({@link CopilotService#mentions}); os de peça e cor seguem
 * a regra de prefixo de {@link CopilotService#startsWithWord}, por isso ficam de fora prefixos que colidem com
 * outras palavras (ex.: "meia" casaria com "meia estação", "prata" com "prateleira"). O destino de cada termo é
 * sempre um código que já existe; o teste de interpretação confere isso contra a taxonomia e o manifesto de assets.
 */
final class CopilotLexicon {
    /** termo → código de ocasião (Taxonomy.OCCASIONS) */
    static final Map<String, String> OCCASIONS = new LinkedHashMap<>();
    /** termo → código de estilo (Taxonomy.STYLES) */
    static final Map<String, String> STYLES = new LinkedHashMap<>();
    /** termo → humor aceito pelo Autopiloto (ENERGETIC, ELEGANT, COMFORTABLE, SOPHISTICATED) */
    static final Map<String, String> MOODS = new LinkedHashMap<>();
    /** termo → estação (WINTER, SUMMER, AUTUMN, SPRING); meses seguem o calendário do hemisfério sul */
    static final Map<String, String> SEASONS = new LinkedHashMap<>();
    /** termo → faixa de clima do WeatherService (VERAO_LEVE, MEIA_ESTACAO, CAMADAS, INVERNO_PESADO) */
    static final Map<String, String> WEATHER = new LinkedHashMap<>();
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
    /** prefixo → cores da taxonomia (somados a CopilotService.COLOR_WORDS) */
    static final Map<String, Set<String>> COLOR_PREFIXES = new LinkedHashMap<>();
    /** prefixo → subcategorias da taxonomia (somados a CopilotService.TYPE_WORDS) */
    static final Map<String, Set<String>> TYPE_PREFIXES = new LinkedHashMap<>();
    /** termo → material da peça (Taxonomy.MATERIALS, somados a CopilotService.MATERIAL_WORDS) */
    static final Map<String, Set<String>> PIECE_MATERIALS = new LinkedHashMap<>();

    static final Pattern TEMPERATURE = Pattern.compile("(-?\\d{1,2})\\s*(?:°|º|graus|grados|degrees)\\s*c?\\b");

    static {
        // ---------------------------------------------------------------- ocasiões
        occasion("work", "reuniao", "reunioes", "expediente", "office", "oficina", "trabajo", "meeting", "dia de trabalho", "plantao", "estagio");
        occasion("business", "entrevista de emprego", "entrevista", "apresentacao", "negocios", "evento corporativo", "conferencia", "palestra",
                "cliente", "business casual", "job interview", "negocio", "congresso");
        occasion("formal", "black tie", "traje a rigor", "gala", "baile", "jantar formal", "esporte fino", "etiqueta", "cerimonial", "evening wear");
        occasion("party", "balada", "aniversario", "festinha", "confraternizacao", "fiesta", "boate", "rave", "cumpleanos", "birthday", "reveillon",
                "ano novo", "virada", "festa de fim de ano");
        occasion("night_out", "sair a noite", "barzinho", "bar", "happy hour", "jantar fora", "night", "noche", "rolê", "role", "pub", "sabado a noite");
        occasion("date", "primeiro encontro", "namoro", "jantar romantico", "cita", "dia dos namorados", "romance", "valentines", "crush", "pedido de namoro");
        occasion("wedding", "madrinha", "padrinho", "convidada de casamento", "convidado de casamento", "boda", "noivado", "chá de panela",
                "cha de panela", "casamento civil");
        occasion("ceremony", "batizado", "missa", "culto", "igreja", "formatura", "colacao de grau", "velorio", "funeral", "graduation", "iglesia");
        occasion("sport", "futebol", "corrida", "correr", "ciclismo", "bike", "pedal", "yoga", "pilates", "caminhada", "deporte", "running", "beach tennis",
                "volei", "basquete", "skate", "surf");
        occasion("gym", "musculacao", "crossfit", "malhar", "treino", "treinar", "gimnasio", "workout", "fitness", "funcional");
        occasion("travel", "aeroporto", "voo", "aviao", "road trip", "viajar", "turismo", "viaje", "trip", "mochilao", "cruzeiro", "intercambio");
        occasion("beach", "piscina", "litoral", "beira mar", "playa", "praiano", "praiana", "pool party", "quiosque", "luau");
        occasion("vacation", "feriado", "feriadao", "recesso", "holiday", "vacaciones", "folga", "fim de semana");
        occasion("school", "aula", "colegio", "escuela", "ensino medio", "sala de aula", "prova");
        occasion("university", "campus", "universidade", "facul", "universidad", "college", "tcc", "seminario", "biblioteca");
        occasion("social", "evento social", "coquetel", "cocktail", "almoco de familia", "brunch", "cha da tarde", "vernissage", "jantar com amigos",
                "almoco", "visita", "reuniao de familia");
        occasion("home", "em casa", "ficar em casa", "home office", "lounge", "descansar", "maratona de series", "domingo em casa", "loungewear",
                "quarentena", "stay home");
        occasion("outdoor", "piquenique", "picnic", "parque", "acampamento", "camping", "trilha", "hiking", "ao ar livre", "aire libre", "cachoeira",
                "passeio", "zoologico");
        occasion("festival", "show", "festival de musica", "lollapalooza", "rock in rio", "carnaval", "festa junina", "bloquinho", "bloco de rua",
                "concierto", "concert", "arraial", "sao joao", "micareta");

        // ---------------------------------------------------------------- estilos
        style("classic", "classica", "tradicional", "atemporal", "timeless", "clasico", "old money");
        style("minimalist", "minimalismo", "clean", "clean look", "neutro", "tons neutros", "minimal", "simples");
        style("modern", "moderna", "contemporaneo", "contemporanea", "atual", "moderno");
        style("chic", "chique", "chiquerrimo", "parisiense", "francesa", "sofisticacao");
        style("streetwear", "street", "estilo de rua", "hype", "hypebeast", "skatista", "street style", "sneakerhead");
        style("sporty", "esportiva", "deportivo", "deportiva", "sport chic", "atletico");
        style("athleisure", "look de academia", "esportivo confortavel", "casual esportivo");
        style("preppy", "patricinha", "mauricinho", "colegial", "universitario classico", "ivy league");
        style("romantic", "romantica", "delicado", "delicada", "feminino", "feminina", "coquette", "fofo", "fofa");
        style("boho", "boho chic", "hippie", "bohemio", "bohemian", "etnico", "gypsy");
        style("vintage", "retro", "anos 70", "anos 80", "brecho", "old school", "setentista", "oitentista");
        style("grunge", "rock", "rocker", "roqueiro", "anos 90", "flanela");
        style("edgy", "punk", "gotico", "gotica", "dark", "alternativo", "alternativa", "emo");
        style("glam", "glamouroso", "glamourosa", "glamour", "diva", "brilhante", "poderosa");
        style("luxury", "luxo", "grife", "quiet luxury", "luxo silencioso", "premium", "alta costura");
        style("avant_garde", "conceitual", "vanguarda", "experimental", "avant garde", "desconstruido", "artistico");
        style("y2k", "anos 2000", "dosmil", "baby tee");
        style("utility", "utilitario", "utilitaria", "militar", "workwear", "funcionalidade");
        style("techwear", "tecnologico", "tech", "gorpcore", "cyberpunk", "impermeavel");
        style("tailored", "alfaiataria", "sob medida", "estruturado", "estruturada", "tailoring", "social masculino");
        style("urban", "urbana", "cidade", "metropole", "citadino");
        style("resort", "resort wear", "tropical chic", "costa amalfitana", "riviera");
        style("basic", "basico", "basica", "basicao", "essencial", "essenciais", "capsula", "guarda roupa capsula");
        style("statement", "chamativo", "chamativa", "impactante", "marcante", "fashionista", "extravagante");
        style("futuristic", "futurismo", "espacial", "metaverso", "sci fi");

        // ---------------------------------------------------------------- humor
        mood("ENERGETIC", "alegre", "animada", "divertido", "divertida", "cheio de energia", "pra cima", "empolgado", "empolgada", "vibe boa", "radiante");
        mood("ELEGANT", "classudo", "classuda", "fino", "fina", "arrumado", "arrumada", "bem vestido", "bem vestida", "alinhado", "alinhada");
        mood("COMFORTABLE", "leve", "soltinho", "soltinha", "relaxado", "relaxada", "tranquilo", "aconchegante", "comfy", "comodo", "pratico", "pratica");
        mood("SOPHISTICATED", "requintado", "requintada", "polido", "polida", "discreto", "discreta", "elegancia discreta");

        // ---------------------------------------------------------------- estações (hemisfério sul)
        season("SUMMER", "dezembro", "janeiro", "fevereiro", "veraneio", "alta temporada", "verano", "summertime");
        season("AUTUMN", "marco", "abril", "pascoa", "otono", "outonal", "autumnal");
        season("WINTER", "junho", "julho", "agosto", "invernal", "invierno", "wintertime", "ferias de julho");
        season("SPRING", "setembro", "outubro", "novembro", "primaveril", "springtime");

        // ---------------------------------------------------------------- clima → faixa do WeatherService (meia-estação primeiro: "nem frio nem calor")
        weather("MEIA_ESTACAO", "ameno", "amena", "clima ameno", "temperatura amena", "meia estacao", "mild", "templado", "nem frio nem calor",
                "fim de tarde fresco");
        weather("INVERNO_PESADO", "muito frio", "gelado", "gelada", "congelando", "geada", "neve", "nevando", "frio intenso", "abaixo de zero",
                "cold", "freezing", "snow", "helado", "nieve", "frio de rachar", "onda de frio");
        weather("CAMADAS", "frio", "friozinho", "fresco", "fresquinho", "ventando", "vento", "ventania", "chuva", "chuvoso", "chuvosa", "chovendo", "garoa",
                "garoando", "neblina", "cerracao", "temporal", "tempestade", "rain", "rainy", "windy", "chilly", "lluvia", "viento", "tempo fechado",
                "nublado", "nublada", "umido de frio");
        weather("VERAO_LEVE", "calor", "calorao", "quente", "muito quente", "abafado", "abafada", "mormaco", "sol forte", "ensolarado", "ensolarada",
                "dia de sol", "torrando", "derretendo", "onda de calor", "hot", "heat", "sunny", "caluroso", "calurosa", "soleado", "clima tropical",
                "sol de rachar", "humido e quente");

        // ---------------------------------------------------------------- AURA
        aura("aura_electro", "eletrico", "eletrica", "eletro", "electro", "electric", "led", "raio", "raios", "voltagem", "energia eletrica", "pulso",
                "choque", "eletronica", "techno", "efeito de luz", "luzes");
        aura("aura_geometry", "geometrico", "geometrica", "geometria", "geometric", "formas geometricas", "poligono", "poligonos", "poligonal",
                "triangulos", "arte grafica", "poster", "bauhaus", "abstrato", "abstrata", "geometrico gradiente");
        aura("aura_splash", "splash", "respingo", "respingos", "mancha de tinta", "manchas de tinta", "tinta", "pigmento", "explosao de cor",
                "paint splash", "ink", "salpico", "salpicos", "aquarela");
        aura("aura_alfaiataria", "alfaiataria", "quiet luxury", "luxo silencioso", "tailored steel", "cabide", "cabides", "aco escovado");
        aura("aura_editorial_mono", "editorial", "marfim", "ivory", "monocromatico", "monocromatica", "estudio fotografico", "revista");
        aura("aura_romantico_petala", "petala", "petalas", "floral", "flores", "rosas", "romantico", "romantica", "brilho suave");
        aura("aura_boemio_terracota", "terracota", "duna", "dunas", "deserto", "boho", "boemio", "boemia", "por do sol", "crepusculo");
        aura("aura_streetwear_neon", "neon", "concreto", "streetwear", "circuito", "circuitos", "grafite urbano", "diagonais neon");
        aura("aura_avantgarde_cromo", "cromo", "cromado", "cromada", "iridescente", "holografico", "holografica", "avant garde", "prisma", "fluxo de luz");
        aura("aura_esportivo_performance", "performance", "esportivo", "athleisure", "feixes", "velocidade", "pulso esportivo");
        aura("aura_glam_noite", "glam", "glamour", "tapete vermelho", "red carpet", "holofote", "spotlight", "palco", "noite de gala", "tecidos flutuando");
        aura("aura_dark_academia", "dark academia", "academia sombria", "livros", "ivy", "estante", "biblioteca antiga");
        aura("aura_natural_organico", "natural", "organico", "organica", "sustentavel", "floresta", "linho cru", "raw linen", "eco", "gotas", "plantas");

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

        // ---------------------------------------------------------------- cores (prefixos)
        color("dourad", "gold", "metallic_gold"); color("pratead", "silver", "metallic_silver"); color("bronze", "bronze");
        color("creme", "cream"); color("off white", "off_white"); color("marfim", "ivory"); color("caramel", "camel");
        color("caqui", "tan", "beige"); color("khaki", "tan", "beige"); color("bordo", "burgundy"); color("coral", "coral");
        color("salm", "salmon"); color("mostarda", "mustard"); color("oliva", "olive"); color("esmeralda", "emerald");
        color("turquesa", "teal"); color("petroleo", "teal"); color("lavanda", "lavender"); color("ameixa", "plum");
        color("chocolate", "chocolate"); color("grafite", "charcoal"); color("chumbo", "dark_gray"); color("fucsia", "hot_pink");
        color("terracota", "terracotta"); color("ferrugem", "rust"); color("estampad", "print");
        color("colorid", "multicolor"); color("multicolor", "multicolor"); color("cobalto", "cobalt"); color("celeste", "sky_blue");
        color("indigo", "navy", "denim"); color("sage", "sage"); color("salvia", "sage");

        // ---------------------------------------------------------------- tipos de peça (prefixos)
        type("regata", "tank_top"); type("cropped", "crop_top"); type("polo", "polo_shirt"); type("body", "bodysuit");
        type("sueter", "sweater"); type("cardig", "cardigan"); type("colete", "vest"); type("parka", "parka");
        type("corta vento", "windbreaker"); type("quimono", "kimono"); type("kimono", "kimono"); type("chino", "chino_pants");
        type("calca cargo", "cargo_pants"); type("jogger", "jogger_pants"); type("legging", "leggings"); type("pantacourt", "culottes");
        type("culote", "culottes"); type("saia short", "skort"); type("mocassim", "moccasins"); type("oxford", "oxford_shoes");
        type("derby", "derby_shoes"); type("coturno", "combat_boots"); type("sapatilha", "flats"); type("rasteir", "flats");
        type("chinelo", "flip_flops"); type("alpargata", "espadrilles"); type("espadrille", "espadrilles"); type("scarpin", "heels");
        type("transversal", "crossbody_bag"); type("sacola", "tote_bag"); type("clutch", "clutch"); type("gorro", "beanie");
        type("touca", "beanie"); type("cachecol", "scarf"); type("lenco", "scarf"); type("gravata", "tie", "bow_tie");
        type("pulseira", "bracelet"); type("brinco", "earrings"); type("anel", "ring"); type("luva", "gloves");
        type("meias", "socks"); type("tiara", "hair_accessory"); type("presilha", "hair_accessory"); type("macaquinho", "romper");
        type("jardineira", "overalls"); type("sobretudo", "coat");
        type("trench", "coat"); type("bomber", "jacket"); type("jaquetinha", "jacket"); type("bota cano longo", "long_boots");

        // ---------------------------------------------------------------- materiais da peça
        pieceMaterial("WOOL", "cashmere", "caxemira", "merino", "la merino", "angora");
        pieceMaterial("SYNTHETIC", "viscose", "elastano", "spandex", "lycra", "poliamida", "acrilico", "microfibra", "couro ecologico", "couro sintetico", "neoprene");
        pieceMaterial("COTTON", "algodao organico", "moletinho");
        pieceMaterial("SILK", "seda pura", "mousseline");
        pieceMaterial("BLEND", "misto", "mescla");
    }

    private CopilotLexicon() {
    }

    private static void occasion(String code, String... terms) { for (String t : terms) OCCASIONS.putIfAbsent(t, code); }
    private static void style(String code, String... terms) { for (String t : terms) STYLES.putIfAbsent(t, code); }
    private static void mood(String code, String... terms) { for (String t : terms) MOODS.putIfAbsent(t, code); }
    private static void season(String code, String... terms) { for (String t : terms) SEASONS.putIfAbsent(t, code); }
    private static void weather(String band, String... terms) { for (String t : terms) WEATHER.putIfAbsent(t, band); }
    private static void aura(String presetId, String... terms) { for (String t : terms) AURA_PRESETS.putIfAbsent(t, presetId); }
    private static void material(String id, String... terms) { for (String t : terms) BACKGROUND_MATERIALS.putIfAbsent(t, id); }
    private static void gradient(String id, String... terms) { for (String t : terms) GRADIENTS.putIfAbsent(t, id); }
    private static void color(String prefix, String... codes) { COLOR_PREFIXES.putIfAbsent(prefix, Set.of(codes)); }
    private static void type(String prefix, String... codes) { TYPE_PREFIXES.put(prefix, Set.of(codes)); }
    private static void pieceMaterial(String code, String... terms) { for (String t : terms) PIECE_MATERIALS.put(t, Set.of(code)); }

    private static void variants(String presetId, String... pairs) {
        Map<String, String> map = AURA_VARIANTS.computeIfAbsent(presetId, k -> new LinkedHashMap<>());
        for (int i = 0; i + 1 < pairs.length; i += 2) map.putIfAbsent(pairs[i], pairs[i + 1]);
    }

    /** Códigos distintos, na ordem do vocabulário, cujos termos aparecem no texto. */
    static List<String> matches(Map<String, String> vocabulary, String text) {
        Set<String> out = new LinkedHashSet<>();
        vocabulary.forEach((term, code) -> {
            if (CopilotService.mentions(text, term)) out.add(code);
        });
        return List.copyOf(out);
    }

    /** Primeiro código cujo termo aparece no texto (ordem do vocabulário), ou null. */
    static String first(Map<String, String> vocabulary, String text) {
        for (Map.Entry<String, String> e : vocabulary.entrySet()) {
            if (CopilotService.mentions(text, e.getKey())) return e.getValue();
        }
        return null;
    }

    /** Faixa de clima pedida no texto: temperatura explícita ("15 graus", "32°C") vale mais que adjetivos. */
    static String weatherBand(String text) {
        Matcher m = TEMPERATURE.matcher(CopilotService.normalized(text));
        if (m.find()) return WeatherService.band(Integer.parseInt(m.group(1)));
        return first(WEATHER, text);
    }

    /** Estação que corresponde à faixa de clima (mesma régua de WeatherService.season). */
    static String seasonOfBand(String band) {
        if (band == null) return null;
        return switch (band) {
            case "VERAO_LEVE" -> "SUMMER";
            case "MEIA_ESTACAO" -> "SPRING";
            case "CAMADAS" -> "AUTUMN";
            case "INVERNO_PESADO" -> "WINTER";
            default -> null;
        };
    }

    /** Sufixo de variação do preset citado no texto (ex.: "aura electro ciano" → 01_cyan_pulse), ou null. */
    static String variantSuffix(String presetId, String text) {
        return first(AURA_VARIANTS.getOrDefault(presetId, Map.of()), text);
    }

    /** Algum termo de moda/clima/fundo do vocabulário aparece no texto (roteia para a intenção LOOKS). */
    static boolean signalsLook(String text) {
        return first(OCCASIONS, text) != null || first(STYLES, text) != null || first(SEASONS, text) != null
                || weatherBand(text) != null || first(AURA_PRESETS, text) != null || first(BACKGROUND_MATERIALS, text) != null
                || first(GRADIENTS, text) != null;
    }

    /** Todas as palavras-chave do vocabulário (sem repetir), para auditoria e teste de cobertura. */
    static Set<String> keywords() {
        Set<String> all = new LinkedHashSet<>();
        all.addAll(OCCASIONS.keySet());
        all.addAll(STYLES.keySet());
        all.addAll(MOODS.keySet());
        all.addAll(SEASONS.keySet());
        all.addAll(WEATHER.keySet());
        all.addAll(AURA_PRESETS.keySet());
        AURA_VARIANTS.values().forEach(m -> all.addAll(m.keySet()));
        all.addAll(BACKGROUND_MATERIALS.keySet());
        all.addAll(GRADIENTS.keySet());
        all.addAll(COLOR_PREFIXES.keySet());
        all.addAll(TYPE_PREFIXES.keySet());
        all.addAll(PIECE_MATERIALS.keySet());
        return Collections.unmodifiableSet(all);
    }
}
