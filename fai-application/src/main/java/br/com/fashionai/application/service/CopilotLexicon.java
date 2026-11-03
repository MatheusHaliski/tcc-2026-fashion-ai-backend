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
 * Cada termo é comparado por palavra inteira e sem acento ({@link CopilotText#mentions}); os de peça e cor seguem
 * a regra de prefixo de {@link CopilotText#startsWithWord}, por isso ficam de fora prefixos que colidem com
 * outras palavras (ex.: "meia" casaria com "meia estação", "prata" com "prateleira"). O destino de cada termo é
 * sempre um código que já existe; o teste de interpretação confere isso contra a taxonomia e o manifesto de assets.
 * <p>
 * Este arquivo guarda a família de moda e clima (ocasião, estilo, humor, estação, faixa de clima) e as consultas sobre
 * o vocabulário inteiro; as famílias de fundo e de peça ficam em {@link CopilotBackgroundLexicon} e
 * {@link CopilotPieceVocabulary}, reexportadas aqui com os mesmos nomes.
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
    // vocabulário de fundo e de peça: definidos por família em CopilotBackgroundLexicon e CopilotPieceVocabulary
    /** termo → preset AURA (id do manifesto) */
    static final Map<String, String> AURA_PRESETS = CopilotBackgroundLexicon.AURA_PRESETS;
    /** preset AURA → (termo → sufixo do id da variação) */
    static final Map<String, Map<String, String>> AURA_VARIANTS = CopilotBackgroundLexicon.AURA_VARIANTS;
    /** termo → material de fundo do Background Studio (id do manifesto) */
    static final Map<String, String> BACKGROUND_MATERIALS = CopilotBackgroundLexicon.BACKGROUND_MATERIALS;
    /** termo → gradiente AURA (id do manifesto) */
    static final Map<String, String> GRADIENTS = CopilotBackgroundLexicon.GRADIENTS;
    /** estação → cartela sazonal (id do manifesto) */
    static final Map<String, String> SEASONAL_PRESETS = CopilotBackgroundLexicon.SEASONAL_PRESETS;
    /** termos que pedem um material de fundo (evita que "jaqueta de couro" troque o material do fundo) */
    static final List<String> MATERIAL_CUES = CopilotBackgroundLexicon.MATERIAL_CUES;
    /** termos que pedem a cartela sazonal no fundo */
    static final List<String> SEASONAL_CUES = CopilotBackgroundLexicon.SEASONAL_CUES;
    /** prefixo → cores da taxonomia (somados a CopilotService.COLOR_WORDS) */
    static final Map<String, Set<String>> COLOR_PREFIXES = CopilotPieceVocabulary.COLOR_PREFIXES;
    /** prefixo → subcategorias da taxonomia (somados a CopilotService.TYPE_WORDS) */
    static final Map<String, Set<String>> TYPE_PREFIXES = CopilotPieceVocabulary.TYPE_PREFIXES;
    /** termo → material da peça (Taxonomy.MATERIALS, somados a CopilotService.MATERIAL_WORDS) */
    static final Map<String, Set<String>> PIECE_MATERIALS = CopilotPieceVocabulary.PIECE_MATERIALS;

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
    }

    private CopilotLexicon() {
    }

    private static void occasion(String code, String... terms) { for (String t : terms) OCCASIONS.putIfAbsent(t, code); }
    private static void style(String code, String... terms) { for (String t : terms) STYLES.putIfAbsent(t, code); }
    private static void mood(String code, String... terms) { for (String t : terms) MOODS.putIfAbsent(t, code); }
    private static void season(String code, String... terms) { for (String t : terms) SEASONS.putIfAbsent(t, code); }
    private static void weather(String band, String... terms) { for (String t : terms) WEATHER.putIfAbsent(t, band); }

    /** Códigos distintos, na ordem do vocabulário, cujos termos aparecem no texto. */
    static List<String> matches(Map<String, String> vocabulary, String text) {
        Set<String> out = new LinkedHashSet<>();
        vocabulary.forEach((term, code) -> {
            if (CopilotText.mentions(text, term)) out.add(code);
        });
        return List.copyOf(out);
    }

    /** Primeiro código cujo termo aparece no texto (ordem do vocabulário), ou null. */
    static String first(Map<String, String> vocabulary, String text) {
        for (Map.Entry<String, String> e : vocabulary.entrySet()) {
            if (CopilotText.mentions(text, e.getKey())) return e.getValue();
        }
        return null;
    }

    /** Faixa de clima pedida no texto: temperatura explícita ("15 graus", "32°C") vale mais que adjetivos. */
    static String weatherBand(String text) {
        Matcher m = TEMPERATURE.matcher(CopilotText.normalized(text));
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
