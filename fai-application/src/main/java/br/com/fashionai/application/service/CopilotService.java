package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.RecommendationScoring;
import br.com.fashionai.application.hype.StyleCompatibility;
import br.com.fashionai.application.insights.InsightContext;
import br.com.fashionai.application.insights.InsightService;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.text.Normalizer;
import java.time.temporal.ChronoUnit;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * RF10 — Copilot contextual (01-especificacao-meu-quarto.md §3). Um motor, três portas (Copilot, Vista-me,
 * Autopiloto). Contexto por ferramentas executadas no servidor com a sessão do usuário (buscar_pecas,
 * localizar_peca, historico_uso, listar_looks, ler_dna_estilo, ler_inventory_score, montar_no_espelho,
 * abrir_criar_look), resumo compacto no prompt, toda peça citada validada no servidor e convertida em chip
 * (CA10/CA15), Camada 2 do DNA só com consentimento (CA16) e salvaguarda contra publicidade disfarçada (CA14).
 */
@Service
public class CopilotService {
    private SealService sealPolicyService;

    @org.springframework.beans.factory.annotation.Autowired
    public void setSealPolicyService(SealService service) { this.sealPolicyService = service; }
    public static final int MIN_PIECES = 3;
    static final Pattern REF = Pattern.compile("\\[\\[(p\\d+)]]");
    static final Map<String, Set<String>> COLOR_WORDS = new LinkedHashMap<>();
    static final Map<String, Set<String>> TYPE_WORDS = new LinkedHashMap<>();
    static final Map<String, Set<String>> MATERIAL_WORDS = new LinkedHashMap<>();

    static {
        COLOR_WORDS.put("branc", Set.of("white", "off_white", "ivory", "cream"));
        COLOR_WORDS.put("pret", Set.of("black", "charcoal", "washed_black"));
        COLOR_WORDS.put("cinza", Set.of("light_gray", "gray", "dark_gray", "silver"));
        COLOR_WORDS.put("azul", Set.of("blue", "navy", "light_blue", "sky_blue", "cobalt", "denim", "teal"));
        COLOR_WORDS.put("marinho", Set.of("navy"));
        COLOR_WORDS.put("vermelh", Set.of("red", "crimson", "burgundy", "maroon", "rust"));
        COLOR_WORDS.put("vinho", Set.of("burgundy", "maroon"));
        COLOR_WORDS.put("rosa", Set.of("pink", "hot_pink", "rose", "coral", "salmon"));
        COLOR_WORDS.put("laranja", Set.of("orange", "terracotta", "amber", "apricot"));
        COLOR_WORDS.put("amarel", Set.of("yellow", "mustard", "gold", "butter"));
        COLOR_WORDS.put("verde", Set.of("green", "olive", "military_green", "forest_green", "mint", "sage", "emerald"));
        COLOR_WORDS.put("roxo", Set.of("purple", "violet", "lilac", "lavender", "plum"));
        COLOR_WORDS.put("lilás", Set.of("lilac", "lavender"));
        COLOR_WORDS.put("marrom", Set.of("brown", "chocolate", "camel", "tan", "taupe"));
        COLOR_WORDS.put("bege", Set.of("beige", "tan", "camel", "cream"));
        COLOR_WORDS.put("jeans", Set.of("denim"));
        // inglês e espanhol (RF23): mesmos códigos da taxonomia
        COLOR_WORDS.put("white", Set.of("white", "off_white", "ivory", "cream")); COLOR_WORDS.put("black", Set.of("black", "charcoal", "washed_black"));
        COLOR_WORDS.put("gray", Set.of("light_gray", "gray", "dark_gray", "silver")); COLOR_WORDS.put("grey", Set.of("light_gray", "gray", "dark_gray", "silver"));
        COLOR_WORDS.put("blue", Set.of("blue", "navy", "light_blue", "sky_blue", "cobalt", "denim", "teal")); COLOR_WORDS.put("navy", Set.of("navy"));
        COLOR_WORDS.put("red", Set.of("red", "crimson", "burgundy", "maroon", "rust")); COLOR_WORDS.put("pink", Set.of("pink", "hot_pink", "rose", "coral", "salmon"));
        COLOR_WORDS.put("orange", Set.of("orange", "terracotta", "amber", "apricot")); COLOR_WORDS.put("yellow", Set.of("yellow", "mustard", "gold", "butter"));
        COLOR_WORDS.put("green", Set.of("green", "olive", "military_green", "forest_green", "mint", "sage", "emerald")); COLOR_WORDS.put("purple", Set.of("purple", "violet", "lilac", "lavender", "plum"));
        COLOR_WORDS.put("brown", Set.of("brown", "chocolate", "camel", "tan", "taupe")); COLOR_WORDS.put("beige", Set.of("beige", "tan", "camel", "cream")); COLOR_WORDS.put("denim", Set.of("denim"));
        COLOR_WORDS.put("blanc", Set.of("white", "off_white", "ivory", "cream")); COLOR_WORDS.put("negr", Set.of("black", "charcoal", "washed_black"));
        COLOR_WORDS.put("gris", Set.of("light_gray", "gray", "dark_gray", "silver")); COLOR_WORDS.put("roj", Set.of("red", "crimson", "burgundy", "maroon", "rust"));
        COLOR_WORDS.put("naranja", Set.of("orange", "terracotta", "amber", "apricot")); COLOR_WORDS.put("amarill", Set.of("yellow", "mustard", "gold", "butter"));
        COLOR_WORDS.put("morad", Set.of("purple", "violet", "lilac", "lavender", "plum")); COLOR_WORDS.put("lila", Set.of("lilac", "lavender"));
        COLOR_WORDS.put("marr", Set.of("brown", "chocolate", "camel", "tan", "taupe"));
        TYPE_WORDS.put("tênis", Taxonomy.SNEAKERS);
        TYPE_WORDS.put("tenis", Taxonomy.SNEAKERS);
        TYPE_WORDS.put("sapato", Set.of("loafers", "moccasins", "oxford_shoes", "derby_shoes", "flats"));
        TYPE_WORDS.put("bota", Set.of("boots"));
        TYPE_WORDS.put("sandália", Set.of("sandals", "flip_flops", "espadrilles"));
        TYPE_WORDS.put("salto", Set.of("heels"));
        TYPE_WORDS.put("calça", Set.of("jeans", "tailored_pants", "casual_pants", "chino_pants", "cargo_pants", "jogger_pants", "sweatpants"));
        TYPE_WORDS.put("jeans", Set.of("jeans", "denim_shorts", "shorts"));
        TYPE_WORDS.put("saia", Set.of("skirt", "skort"));
        TYPE_WORDS.put("short", Set.of("shorts"));
        TYPE_WORDS.put("bermuda", Set.of("bermuda_shorts", "shorts"));
        TYPE_WORDS.put("camiseta", Set.of("t_shirt", "tank_top", "top"));
        TYPE_WORDS.put("camisa", Set.of("shirt", "polo_shirt"));
        TYPE_WORDS.put("blusa", Set.of("blouse", "sweater"));
        TYPE_WORDS.put("moletom", Set.of("sweatshirt", "hoodie"));
        TYPE_WORDS.put("jaqueta", Set.of("jacket", "windbreaker", "parka"));
        TYPE_WORDS.put("casaco", Set.of("coat", "parka", "jacket"));
        TYPE_WORDS.put("blazer", Set.of("blazer"));
        TYPE_WORDS.put("vestido", Set.of("dress"));
        TYPE_WORDS.put("macacão", Set.of("jumpsuit", "overalls", "romper"));
        TYPE_WORDS.put("bolsa", Set.of("handbag", "tote_bag", "clutch"));
        TYPE_WORDS.put("mochila", Set.of("backpack"));
        TYPE_WORDS.put("boné", Set.of("cap"));
        TYPE_WORDS.put("chapéu", Set.of("hat"));
        TYPE_WORDS.put("cinto", Set.of("belt"));
        TYPE_WORDS.put("óculos", Set.of("sunglasses", "eyeglasses"));
        TYPE_WORDS.put("colar", Set.of("necklace"));
        TYPE_WORDS.put("relógio", Set.of("watch"));
        // inglês e espanhol (RF23)
        TYPE_WORDS.put("sneaker", Taxonomy.SNEAKERS); TYPE_WORDS.put("zapatilla", Taxonomy.SNEAKERS); TYPE_WORDS.put("tenis", Taxonomy.SNEAKERS);
        TYPE_WORDS.put("shoe", Set.of("loafers", "moccasins", "oxford_shoes", "derby_shoes", "flats")); TYPE_WORDS.put("zapato", Set.of("loafers", "moccasins", "oxford_shoes", "derby_shoes", "flats"));
        TYPE_WORDS.put("boot", Set.of("boots")); TYPE_WORDS.put("bota", Set.of("boots"));
        TYPE_WORDS.put("sandal", Set.of("sandals", "flip_flops", "espadrilles")); TYPE_WORDS.put("sandalia", Set.of("sandals", "flip_flops", "espadrilles")); TYPE_WORDS.put("sandália", Set.of("sandals", "flip_flops", "espadrilles"));
        TYPE_WORDS.put("heel", Set.of("heels")); TYPE_WORDS.put("tacón", Set.of("heels")); TYPE_WORDS.put("tacon", Set.of("heels"));
        TYPE_WORDS.put("pants", Set.of("jeans", "tailored_pants", "casual_pants", "chino_pants", "cargo_pants", "jogger_pants", "sweatpants")); TYPE_WORDS.put("trousers", Set.of("tailored_pants", "casual_pants", "chino_pants"));
        TYPE_WORDS.put("pantal", Set.of("jeans", "tailored_pants", "casual_pants", "chino_pants", "cargo_pants", "jogger_pants", "sweatpants"));
        TYPE_WORDS.put("skirt", Set.of("skirt", "skort")); TYPE_WORDS.put("falda", Set.of("skirt", "skort"));
        TYPE_WORDS.put("t-shirt", Set.of("t_shirt", "tank_top", "top")); TYPE_WORDS.put("tee", Set.of("t_shirt")); TYPE_WORDS.put("camiseta", Set.of("t_shirt", "tank_top", "top"));
        TYPE_WORDS.put("shirt", Set.of("shirt", "polo_shirt")); TYPE_WORDS.put("camisa", Set.of("shirt", "polo_shirt"));
        TYPE_WORDS.put("blouse", Set.of("blouse", "sweater")); TYPE_WORDS.put("sweater", Set.of("sweater")); TYPE_WORDS.put("blusa", Set.of("blouse", "sweater")); TYPE_WORDS.put("suéter", Set.of("sweater"));
        TYPE_WORDS.put("hoodie", Set.of("sweatshirt", "hoodie")); TYPE_WORDS.put("sweatshirt", Set.of("sweatshirt", "hoodie")); TYPE_WORDS.put("sudadera", Set.of("sweatshirt", "hoodie"));
        TYPE_WORDS.put("jacket", Set.of("jacket", "windbreaker", "parka")); TYPE_WORDS.put("chaqueta", Set.of("jacket", "windbreaker", "parka")); TYPE_WORDS.put("coat", Set.of("coat", "parka", "jacket")); TYPE_WORDS.put("abrigo", Set.of("coat", "parka", "jacket"));
        TYPE_WORDS.put("dress", Set.of("dress")); TYPE_WORDS.put("vestido", Set.of("dress")); TYPE_WORDS.put("jumpsuit", Set.of("jumpsuit", "overalls", "romper")); TYPE_WORDS.put("mono", Set.of("jumpsuit", "overalls", "romper"));
        TYPE_WORDS.put("bag", Set.of("handbag", "tote_bag", "clutch")); TYPE_WORDS.put("bolso", Set.of("handbag", "tote_bag", "clutch")); TYPE_WORDS.put("backpack", Set.of("backpack")); TYPE_WORDS.put("mochila", Set.of("backpack"));
        TYPE_WORDS.put("cap", Set.of("cap")); TYPE_WORDS.put("gorra", Set.of("cap")); TYPE_WORDS.put("hat", Set.of("hat")); TYPE_WORDS.put("sombrero", Set.of("hat"));
        TYPE_WORDS.put("belt", Set.of("belt")); TYPE_WORDS.put("cinturón", Set.of("belt")); TYPE_WORDS.put("cinturon", Set.of("belt"));
        TYPE_WORDS.put("glasses", Set.of("sunglasses", "eyeglasses")); TYPE_WORDS.put("gafas", Set.of("sunglasses", "eyeglasses")); TYPE_WORDS.put("necklace", Set.of("necklace")); TYPE_WORDS.put("collar", Set.of("necklace"));
        TYPE_WORDS.put("watch", Set.of("watch")); TYPE_WORDS.put("reloj", Set.of("watch"));
        MATERIAL_WORDS.put("algodao", Set.of("COTTON")); MATERIAL_WORDS.put("cotton", Set.of("COTTON"));
        MATERIAL_WORDS.put("poliester", Set.of("POLYESTER")); MATERIAL_WORDS.put("polyester", Set.of("POLYESTER"));
        MATERIAL_WORDS.put("lana", Set.of("WOOL")); MATERIAL_WORDS.put("wool", Set.of("WOOL"));
        MATERIAL_WORDS.put("seda", Set.of("SILK")); MATERIAL_WORDS.put("silk", Set.of("SILK"));
        MATERIAL_WORDS.put("couro", Set.of("LEATHER")); MATERIAL_WORDS.put("leather", Set.of("LEATHER")); MATERIAL_WORDS.put("piel", Set.of("LEATHER"));
        MATERIAL_WORDS.put("sintetico", Set.of("SYNTHETIC")); MATERIAL_WORDS.put("synthetic", Set.of("SYNTHETIC")); MATERIAL_WORDS.put("sintetica", Set.of("SYNTHETIC"));
        MATERIAL_WORDS.put("mistura", Set.of("BLEND")); MATERIAL_WORDS.put("blend", Set.of("BLEND"));
        // vocabulário ampliado (CopilotLexicon): não sobrescreve os termos acima
        CopilotLexicon.COLOR_PREFIXES.forEach(COLOR_WORDS::putIfAbsent);
        CopilotLexicon.TYPE_PREFIXES.forEach(TYPE_WORDS::putIfAbsent);
        CopilotLexicon.PIECE_MATERIALS.forEach(MATERIAL_WORDS::putIfAbsent);
    }

    /**
     * {@code mode}: SAFE (prioriza o DNA de estilo), DISCOVERY (familiar + novidades) ou EXPERIMENTAL (mais distância do
     * histórico) — reordena os looks sugeridos pela pontuação multidimensional ({@link RecommendationScoring}).
     */
    public record AskRequest(String message, String view, List<UUID> selection, List<String> occasion, String mood, String city,
                             Double latitude, Double longitude, List<String> excludeKeys, String mode) {
    }

    /** Momentos §17 — o Copilot conhece os Momentos ativos (injeção opcional: o construtor dos testes não muda). */
    private br.com.fashionai.application.moments.MomentService moments;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setMoments(br.com.fashionai.application.moments.MomentService moments) {
        this.moments = moments;
    }

    private final WardrobeService wardrobe;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final DailyLookRepository dailyLooks;
    private final StyleDnaRepository dnas;
    private final UserPreferencesRepository preferences;
    private final RoomService room;
    private final MirrorService mirror;
    private final InventoryScoreService inventory;
    private final ChallengeService challenges;
    private final AutopilotService autopilot;
    private final DailyLookService dailyLookService;
    private final WeatherService weather;
    private final AiEngine ai;
    private final Audit audit;
    private final SchemeService schemeService;
    private final BackgroundStudioService backgroundStudio;
    /** HypeScore v2 — contexto de recomendação (nunca critério único) */
    private final HypeQueryService hype;
    /** Seis dimensões por look — a mesma régua do Autopiloto. */
    private final LookScorer scorer;
    /** Insights dinâmicos do contexto COPILOT (Hype ao lado do DNA e do uso, redescoberta antes de compra). */
    private final InsightService insights;
    private final Map<UUID, Deque<String>> shown = new ConcurrentHashMap<>();

    public CopilotService(WardrobeService wardrobe, WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                          DailyLookRepository dailyLooks, StyleDnaRepository dnas, UserPreferencesRepository preferences, RoomService room,
                          MirrorService mirror, InventoryScoreService inventory, ChallengeService challenges, AutopilotService autopilot,
                          DailyLookService dailyLookService, WeatherService weather, AiEngine ai, Audit audit, SchemeService schemeService,
                          BackgroundStudioService backgroundStudio, HypeQueryService hype, InsightService insights) {
        this.hype = hype;
        this.insights = insights;
        this.scorer = new LookScorer(pieces, schemes, schemeItems, dnas, hype);
        this.schemeService = schemeService;
        this.backgroundStudio = backgroundStudio;
        this.wardrobe = wardrobe;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dailyLooks = dailyLooks;
        this.dnas = dnas;
        this.preferences = preferences;
        this.room = room;
        this.mirror = mirror;
        this.inventory = inventory;
        this.challenges = challenges;
        this.autopilot = autopilot;
        this.dailyLookService = dailyLookService;
        this.weather = weather;
        this.ai = ai;
        this.audit = audit;
    }

    // ================================================================== contexto pré-preenchido (CA01/CA08)
    static List<String> promptsFor(String view) {
        return switch (view == null ? "" : view.toUpperCase(Locale.ROOT)) {
            case "GRADE" -> List.of(Msg.t("copilot.prompt_monte_um_look"), Msg.t("copilot.prompt_roupa_sem_uso"), Msg.t("copilot.prompt_o_que_falta"));
            case "QUARTO" -> List.of(Msg.t("copilot.prompt_onde_esta_tenis"), Msg.t("copilot.prompt_vista_me_trabalho"), Msg.t("copilot.prompt_organize_gavetas"));
            case "DESTAQUES" -> List.of(Msg.t("copilot.prompt_melhorar_inventario"), Msg.t("copilot.prompt_qual_desafio"), Msg.t("copilot.prompt_utilizacao_baixa"));
            default -> List.of(Msg.t("copilot.prompt_sugira_3_looks"), Msg.t("copilot.prompt_algo_diferente"), Msg.t("copilot.prompt_esta_frio"));
        };
    }

    @Transactional(readOnly = true)
    public Map<String, Object> context(CurrentUser user, String view, List<UUID> selection, String city, Double lat, Double lon) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("userId", user.id());
        out.put("view", view == null ? "COPILOT" : view.toUpperCase(Locale.ROOT));
        out.put("pieces", pieces.countByUserId(user.id()));
        out.put("available", eligible.size());
        out.put("ready", eligible.size() >= MIN_PIECES);
        if (eligible.size() < MIN_PIECES) {
            out.put("limitation", Map.of("message", Msg.t("copilot.o_copilot_precisa_de_ao"), "href", "/pieces/new"));
        }
        // ocasião e humor pré-preenchidos pelo que o sistema conhece (último Look do Dia e ocasiões mais usadas)
        List<DailyLook> recent = dailyLooks.findTop30ByUserIdOrderByLookDateDesc(user.id());
        Map<String, Long> occ = recent.stream().flatMap(dl -> Json.csv(dl.getScheme().getOccasion()).stream())
                .collect(Collectors.groupingBy(o -> o, Collectors.counting()));
        out.put("occasion", occ.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(1).map(Map.Entry::getKey).toList());
        out.put("mood", recent.isEmpty() || recent.get(0).getScheme().getMood() == null ? null : recent.get(0).getScheme().getMood().name());
        out.put("weather", WeatherService.view(weather.resolve(lat, lon, city)));
        out.put("selection", selection == null ? List.of() : selection);
        out.put("suggestedPrompts", promptsFor(view));
        out.put("activeChallenges", challenges.activeSummary(user.id()));
        out.put("activeMoments", activeMoments(user.id()));
        return out;
    }

    // ================================================================== sugestões visuais (RF10 — "mais sugestivo")
    /**
     * Painel do Copilot antes de qualquer pergunta: looks prontos do usuário para hoje, combinações novas montadas só com
     * o acervo (motor local, sem custo), peças esquecidas, peças que combinam com o clima/estação e looks em alta na rede.
     * Tudo volta como esquema/peça completos para o card abrir o detalhe ampliado (RF7) no modal.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> suggestions(CurrentUser user, String city, Double lat, Double lon) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        WeatherService.Context w = weather.resolve(lat, lon, city);
        String season = w.season();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("weather", WeatherService.view(w));
        // 1) looks prontos: favoritos, Look do Dia recente e os menos repetidos primeiro
        List<Scheme> mine = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED).stream()
                .filter(Scheme::isDisponivel)
                .sorted(Comparator.comparing((Scheme s) -> !s.isFavorite()).thenComparing(Scheme::getLookDoDiaCount))
                .limit(6).toList();
        out.put("readyLooks", mine.stream().map(s -> schemeService.view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList());
        // 2) combinações novas (não salvas) com peças do acervo — o usuário salva com um clique
        List<Map<String, Object>> fresh = new ArrayList<>();
        if (eligible.size() >= 2) {
            Map<UUID, WardrobeItem> byId = eligible.stream().collect(Collectors.toMap(WardrobeItem::getId, x -> x, (a, b) -> a));
            for (LocalSchemeComposer.Composition c : LocalSchemeComposer.compose(eligible, List.of(), List.of(), season, null, 3)) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("title", c.title());
                m.put("rationale", c.rationale());
                m.put("occasions", c.occasions());
                m.put("styles", c.styles());
                m.put("totalPrice", c.totalPrice());
                m.put("pieces", c.items().stream().map(pk -> byId.get(pk.wardrobeItemId())).filter(Objects::nonNull)
                        .map(x -> Views.piece(x, null, null)).toList());
                m.put("pieceIds", c.items().stream().map(LocalSchemeComposer.Pick::wardrobeItemId).toList());
                fresh.add(m);
            }
        }
        // P2-16 — os mesmos seis números dos looks do chat e do Autopiloto (LookScorer): compatibilidade com o DNA, Hype
        // (média v2 das peças), novidade, reutilização, uso e sustentabilidade, lado a lado e nunca somados. Sem modo
        // escolhido, a ordem do motor local fica como está; dimensão sem base vem nula ("—"), nunca 0.
        out.put("newCombinations", fresh.isEmpty() ? fresh : scoreLooks(user, fresh, null));
        // 3) peças esquecidas: a MESMA régua do app inteiro (RoomService.forgotten — 60+ dias desde o último uso ou, se
        //    nunca usada, desde o cadastro). Antes era 30 dias aqui e "nunca usada" contava até para peça cadastrada ontem.
        LocalDate todayZ = LocalDate.now(FaiPointsService.ZONE);
        out.put("forgottenPieces", eligible.stream().filter(x -> RoomService.forgotten(x, x.getLastWornDate(), todayZ))
                .sorted(Comparator.comparingLong((WardrobeItem x) -> -HypeQueryService.idleDays(x, todayZ)))
                .limit(6).map(x -> Views.piece(x, null, null)).toList());
        // 4) peças para o clima: mesma régua do Autopiloto (faixa de temperatura → descarta peças inadequadas; camadas no frio)
        String band = w.band();
        out.put("weatherBand", band);
        out.put("weatherPieces", eligible.stream().filter(x -> !WeatherService.unsuitable(x.getSubcategory(), band))
                .sorted(Comparator.comparing((WardrobeItem x) -> !("CAMADAS".equals(band) || "INVERNO_PESADO".equals(band)) || !WeatherService.isLayer(x.getSubcategory())))
                .limit(6).map(x -> Views.piece(x, null, null)).toList());
        // 5) em alta na rede: looks públicos de outras pessoas, os de maior HypeScore v2 primeiro (sem Hype calculado = por último)
        List<Scheme> publicLooks = schemes.findPublicFeed(org.springframework.data.domain.PageRequest.of(0, 30)).stream()
                .filter(s -> !s.getUser().getId().equals(user.id()) && schemeService.canView(user, s)).toList();
        Map<UUID, HypeScoreCurrent> lookHype = hype.currentOf(HypeEntityType.SCHEME, publicLooks.stream().map(Scheme::getId).toList());
        out.put("trendingLooks", publicLooks.stream()
                .sorted(Comparator.comparing((Scheme s) -> lookHype.containsKey(s.getId()) ? lookHype.get(s.getId()).getScore() : null,
                        Comparator.nullsLast(Comparator.<java.math.BigDecimal>reverseOrder())))
                .limit(4).map(s -> schemeService.view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList());
        out.put("suggestedPrompts", promptsFor("COPILOT"));
        // insights dinâmicos do contexto COPILOT: Hype sempre ao lado do DNA/uso, redescoberta antes de qualquer compra
        out.put("insights", insights.itemsOrEmpty(user, InsightContext.COPILOT));
        return out;
    }

    // ================================================================== intenções
    enum Intent { WHERE_IS, HYPE, FORGOTTEN, DIFFERENT, IMPROVE_INVENTORY, DIAGNOSIS, LOOKS, GENERAL }

    /** Pergunta sobre relevância das próprias peças/looks ("qual peça está em alta?", "tenho peça rara?"). */
    static final java.util.regex.Pattern HYPE_QUESTION = java.util.regex.Pattern.compile(
            ".*\\b(qual|quais|tenho|minhas?|meus?|which|what|do i|my|cu[aá]l|cu[aá]les|tengo|mis?)\\b.*\\b(hype|em alta|relevan\\w*|tend[eê]nc\\w*|trend\\w*|"
                    + "crescend\\w*|subindo|voltando|rar[ao]s?|raridade|rare|rarest|exclusiv\\w*|popular\\w*|viral|bombando|potencial|growing|rising|creciendo|volviendo)\\b.*");
    /** Pedido para montar algo continua sendo LOOKS, mesmo citando tendência ("monte um look em alta"). */
    static final java.util.regex.Pattern BUILD_REQUEST = java.util.regex.Pattern.compile(
            ".*\\b(monte|montar|monta|sugira|sugere|crie|criar|gere|gerar|build|suggest|create|make me|arma|sugiere|crea)\\b.*");

    /** weather: faixa de clima pedida no texto (VERAO_LEVE, MEIA_ESTACAO, CAMADAS, INVERNO_PESADO) ou null */
    record LookPrompt(List<String> occasions, List<String> styles, String mood, String season, String weather) {}

    static String normalized(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replace('_', ' ').replace('-', ' ').replaceAll("\\s+", " ").trim();
    }

    static boolean mentions(String text, String phrase) {
        String value = normalized(text);
        String target = normalized(phrase).trim();
        return !target.isEmpty() && (" " + value.replaceAll("[^a-z0-9]+", " ") + " ").contains(" " + target + " ");
    }

    static boolean startsWithWord(String text, String prefix) {
        String wanted = normalized(prefix);
        if (wanted.contains(" ")) return mentions(text, wanted);
        return java.util.Arrays.stream(normalized(text).split("\\s+")).anyMatch(word -> word.startsWith(wanted));
    }

    static LookPrompt lookPrompt(String message, List<String> requestedOccasions, String requestedMood) {
        List<String> occasions = new ArrayList<>(requestedOccasions == null ? List.of() : requestedOccasions.stream()
                .filter(Taxonomy.OCCASIONS::contains).distinct().limit(3).toList());
        Map<String, List<String>> occasionTerms = Map.ofEntries(
                Map.entry("casual", List.of("casual", "informal", "dia a dia")), Map.entry("work", List.of("work", "trabalho", "escritorio")),
                Map.entry("business", List.of("business", "executivo", "corporativo")), Map.entry("formal", List.of("formal")),
                Map.entry("party", List.of("party", "festa")), Map.entry("night_out", List.of("night out", "noite")),
                Map.entry("date", List.of("date", "encontro", "romantico")), Map.entry("wedding", List.of("wedding", "casamento")),
                Map.entry("ceremony", List.of("ceremony", "cerimonia")), Map.entry("sport", List.of("sport", "esporte")),
                Map.entry("gym", List.of("gym", "academia")), Map.entry("travel", List.of("travel", "viagem")),
                Map.entry("beach", List.of("beach", "praia")), Map.entry("vacation", List.of("vacation", "ferias")),
                Map.entry("school", List.of("school", "escola")), Map.entry("university", List.of("university", "faculdade")),
                Map.entry("social", List.of("social", "social")), Map.entry("home", List.of("home", "casa")),
                Map.entry("outdoor", List.of("outdoor", "ar livre")), Map.entry("festival", List.of("festival")));
        for (String value : Taxonomy.OCCASIONS) {
            if (!occasions.contains(value) && occasionTerms.getOrDefault(value, List.of(value.replace('_', ' '))).stream().anyMatch(term -> mentions(message, term))) {
                occasions.add(value);
            }
        }
        CopilotLexicon.matches(CopilotLexicon.OCCASIONS, message).stream().filter(Taxonomy.OCCASIONS::contains)
                .filter(value -> !occasions.contains(value)).forEach(occasions::add);
        List<String> detectedStyles = new ArrayList<>(Taxonomy.STYLES.stream().filter(value -> mentions(message, value.replace('_', ' '))).limit(3).toList());
        Map<String, String> translated = Map.ofEntries(Map.entry("classico", "classic"), Map.entry("minimalista", "minimalist"),
                Map.entry("moderno", "modern"), Map.entry("elegante", "chic"), Map.entry("urbano", "urban"),
                Map.entry("romantico", "romantic"), Map.entry("boemio", "boho"), Map.entry("esportivo", "sporty"),
                Map.entry("luxuoso", "luxury"), Map.entry("futurista", "futuristic"), Map.entry("vintage", "vintage"));
        translated.entrySet().stream().filter(e -> mentions(message, e.getKey())).map(Map.Entry::getValue).forEach(detectedStyles::add);
        CopilotLexicon.matches(CopilotLexicon.STYLES, message).stream().filter(Taxonomy.STYLES::contains).forEach(detectedStyles::add);
        List<String> styles = detectedStyles.stream().distinct().limit(3).toList();
        String mood = requestedMood;
        if (mood != null && !Set.of("ENERGETIC", "ELEGANT", "COMFORTABLE", "SOPHISTICATED").contains(mood.toUpperCase(Locale.ROOT))) mood = null;
        if (mood == null) {
            if (List.of("energetico", "energetica", "vibrante", "animado").stream().anyMatch(term -> mentions(message, term))) mood = "ENERGETIC";
            else if (List.of("elegante", "elegancia", "chique").stream().anyMatch(term -> mentions(message, term))) mood = "ELEGANT";
            else if (List.of("confortavel", "conforto", "cozy").stream().anyMatch(term -> mentions(message, term))) mood = "COMFORTABLE";
            else if (List.of("sofisticado", "sofisticada", "refinado").stream().anyMatch(term -> mentions(message, term))) mood = "SOPHISTICATED";
            else mood = CopilotLexicon.first(CopilotLexicon.MOODS, message);
        }
        String season = null;
        if (List.of("inverno", "winter").stream().anyMatch(term -> mentions(message, term))) season = "WINTER";
        else if (List.of("verao", "summer").stream().anyMatch(term -> mentions(message, term))) season = "SUMMER";
        else if (List.of("outono", "autumn", "fall").stream().anyMatch(term -> mentions(message, term))) season = "AUTUMN";
        else if (List.of("primavera", "spring").stream().anyMatch(term -> mentions(message, term))) season = "SPRING";
        else season = CopilotLexicon.first(CopilotLexicon.SEASONS, message);
        String weatherBand = CopilotLexicon.weatherBand(message);
        if (season == null) season = CopilotLexicon.seasonOfBand(weatherBand);
        return new LookPrompt(occasions.stream().distinct().limit(3).toList(), styles, mood, season, weatherBand);
    }

    static Intent intent(String m) {
        String t = m == null ? "" : m.toLowerCase(Locale.ROOT);
        if (t.matches(".*(onde est|onde fica|cadê|cade |onde guardei|onde deixei|where is|where are|where's|where did i|dónde est|donde est|dónde guard|donde guard).*")) {
            return Intent.WHERE_IS;
        }
        if (HYPE_QUESTION.matcher(t).matches() && !BUILD_REQUEST.matcher(t).matches()) {
            return Intent.HYPE;
        }
        if (t.matches(".*(não uso|nao uso|esquecid|parad[ao]s?|há muito tempo|ha muito tempo|nunca usei|haven't worn|never worn|not worn|forgotten|unused|long time|no uso|olvidad|nunca usé|nunca use|mucho tiempo|redescobert|rediscover|redescubr).*")) {
            return Intent.FORGOTTEN;
        }
        if (t.matches(".*(melhorar (o |meu )?invent|inventory score|como melhorar|minha utiliza|meu score|improve (my )?invent|my utilization|my score|mejorar (el |mi )?invent|mi utiliza|mi puntuaci).*")) {
            return Intent.IMPROVE_INVENTORY;
        }
        if (t.matches(".*(diferente|fora do comum|ousad|sair da rotina|nunca combinei|different|out of the ordinary|bold|break the routine|never combined|diferente|fuera de lo común|atrevid|salir de la rutina|nunca combiné).*")) {
            return Intent.DIFFERENT;
        }
        if (t.matches(".*(comprar|o que falta|falta no meu|diagnóstic|diagnostic|lacuna|buy|what's missing|what is missing|missing from my|gap|qué falta|que falta|falta en mi|diagnóstico|brecha).*")) {
            return Intent.DIAGNOSIS;
        }
        if (t.matches(".*(look|vestir|visto|usar hoje|sugest|montar|combina|roupa para|frio|calor|trabalho|festa|faculdade|academia|fundo|background|aura|material|conjunto).*")
                || hasPieceConstraints(t) || CopilotLexicon.signalsLook(t)) {
            return Intent.LOOKS;
        }
        return Intent.GENERAL;
    }

    /** Ferramenta buscar_pecas(filtros) — só o próprio acervo; indisponíveis marcadas. */
    List<WardrobeItem> searchPieces(UUID userId, String text) {
        return searchPieces(userId, text, false);
    }

    List<WardrobeItem> searchPieces(UUID userId, String text, boolean availableOnly) {
        String original = text == null ? "" : text.toLowerCase(Locale.ROOT);
        String t = normalized(text);
        Set<String> colors = new HashSet<>();
        COLOR_WORDS.forEach((k, v) -> {
            if (startsWithWord(t, k)) {
                colors.addAll(v);
            }
        });
        Set<String> subs = new HashSet<>();
        TYPE_WORDS.forEach((k, v) -> {
            if (startsWithWord(t, k)) {
                subs.addAll(v);
            }
        });
        Set<String> materials = new HashSet<>();
        MATERIAL_WORDS.forEach((k, v) -> {
            if (mentions(text, k)) materials.addAll(v);
        });
        if (original.contains("lã")) materials.add("WOOL");
        if (subs.contains("jeans") && subs.size() > 1) {
            colors.remove("denim");
        }
        return pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> !availableOnly || (w.isDisponivel() && w.getAvailabilityStatus() == AvailabilityStatus.AVAILABLE))
                .filter(w -> colors.isEmpty() || colors.contains(w.getColor()))
                .filter(w -> subs.isEmpty() || subs.contains(Taxonomy.activeSubcategory(w.getSubcategory())) || subs.contains(w.getSubcategory()))
                .filter(w -> materials.isEmpty() || materials.contains(w.getMaterial()))
                .filter(w -> !(colors.isEmpty() && subs.isEmpty() && materials.isEmpty()) || nameMatch(w, t))
                .limit(8).toList();
    }

    static boolean hasPieceConstraints(String message) {
        return COLOR_WORDS.keySet().stream().anyMatch(k -> startsWithWord(message, k))
                || TYPE_WORDS.keySet().stream().anyMatch(k -> startsWithWord(message, k))
                || MATERIAL_WORDS.keySet().stream().anyMatch(k -> mentions(message, k))
                || (message != null && message.toLowerCase(Locale.ROOT).contains("lã"));
    }

    record BackgroundPrompt(Map<String, Object> configuration, Map<String, String> unresolved) {}

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> catalogEntries(Object entries) {
        if (!(entries instanceof List<?> list)) return List.of();
        return list.stream().filter(Map.class::isInstance).map(x -> (Map<String, Object>) x).toList();
    }

    static Map<String, Object> namedEntry(List<Map<String, Object>> entries, String text, String... fields) {
        for (Map<String, Object> entry : entries) {
            for (String field : fields) {
                Object value = entry.get(field);
                if (value instanceof String s && s.length() > 2 && mentions(text, s.replace('_', ' '))) return entry;
            }
        }
        return null;
    }

    BackgroundPrompt backgroundPrompt(String message, List<String> styles, List<String> occasions) {
        return backgroundPrompt(message, styles, occasions, true);
    }

    /**
     * Orientação livre do Criar Look ("Gerar com IA"): o mesmo vocabulário do Copilot (CopilotLexicon, 800+ termos
     * PT/EN/ES de ocasião, estilo, humor, estação, clima, cores, tipos e materiais de peça, presets e variações AURA,
     * materiais de fundo, gradientes e cartela sazonal) lido sem exigir a palavra "fundo": o que a pessoa citar vira
     * arte de background, ocasião, estilo, estação e humor do look gerado.
     */
    public Map<String, Object> orientation(String text, List<String> styles, List<String> occasions) {
        if (text == null || text.isBlank()) return Map.of();
        Map<String, Object> out = new LinkedHashMap<>();
        BackgroundPrompt bg = backgroundPrompt(text, styles, occasions, false);
        if (bg.configuration() != null && bg.configuration().get("scheme") instanceof Map<?, ?> scheme && !scheme.isEmpty()) {
            out.put("background", scheme);
        }
        if (!bg.unresolved().isEmpty()) out.put("unresolved", bg.unresolved());
        LookPrompt look = lookPrompt(text, occasions, null);
        if (!look.occasions().isEmpty()) out.put("occasions", look.occasions());
        if (!look.styles().isEmpty()) out.put("styles", look.styles());
        if (look.season() != null) out.put("season", look.season());
        if (look.mood() != null) out.put("mood", look.mood());
        if (look.weather() != null) out.put("weather", look.weather());
        return out;
    }

    BackgroundPrompt backgroundPrompt(String message, List<String> styles, List<String> occasions, boolean requireCue) {
        String text = normalized(message);
        Map<String, Object> scheme = new LinkedHashMap<>();
        Map<String, String> unresolved = new LinkedHashMap<>();
        boolean backgroundRequested = !requireCue || List.of("fundo", "background", "arte de fundo", "aura", "material", "moldura", "arte do card", "fondo")
                .stream().anyMatch(term -> mentions(message, term));
        if (!backgroundRequested) return new BackgroundPrompt(null, Map.of());

        Matcher hex = Pattern.compile("#[0-9a-fA-F]{6}(?![0-9a-fA-F])").matcher(message);
        if (hex.find() && (mentions(message, "fundo") || mentions(message, "background") || mentions(message, "container"))) {
            String color = hex.group().toUpperCase(Locale.ROOT);
            if (mentions(message, "container")) scheme.put("container", Map.of("color", color));
            else scheme.put("color", color);
        } else if (mentions(message, "fundo") || mentions(message, "background")) {
            for (Map.Entry<String, Set<String>> term : COLOR_WORDS.entrySet()) {
                if (!startsWithWord(message, term.getKey())) continue;
                String colorId = term.getValue().stream().filter(Taxonomy.COLORS::containsKey).findFirst().orElse(null);
                if (colorId != null) {
                    scheme.put("color", Taxonomy.COLORS.get(colorId));
                    break;
                }
            }
        }

        Map<String, Object> catalog = backgroundStudio.catalog();
        List<Map<String, Object>> auraPresets = catalogEntries(catalog.get("auraPresets"));
        Map<String, Object> selectedAura = null;
        Map<String, Object> selectedVariant = null;
        for (Map<String, Object> preset : auraPresets) {
            if (mentions(message, String.valueOf(preset.get("name"))) || mentions(message, String.valueOf(preset.get("id")).replace('_', ' '))) {
                selectedAura = preset;
                break;
            }
            for (Map<String, Object> variant : catalogEntries(preset.get("variants"))) {
                if (mentions(message, String.valueOf(variant.get("theme"))) || mentions(message, String.valueOf(variant.get("code"))
                        .replace('_', ' ')) || mentions(message, String.valueOf(variant.get("id")).replace('_', ' '))) {
                    selectedAura = preset;
                    selectedVariant = variant;
                    break;
                }
            }
            if (selectedAura != null) break;
        }
        String gradientTerm = CopilotLexicon.first(CopilotLexicon.GRADIENTS, message);
        if (selectedAura == null && (gradientTerm == null || mentions(message, "aura"))) {
            // vocabulário: "fundo geométrico", "aura elétrica ciano", "fundo floral"… → preset (e variação, se citada)
            String presetId = CopilotLexicon.first(CopilotLexicon.AURA_PRESETS, message);
            if (presetId != null) {
                selectedAura = auraPresets.stream().filter(p -> presetId.equals(p.get("id"))).findFirst().orElse(null);
                String suffix = selectedAura == null ? null : CopilotLexicon.variantSuffix(presetId, message);
                if (suffix != null) {
                    String variantId = presetId + "__" + suffix;
                    selectedVariant = catalogEntries(selectedAura.get("variants")).stream().filter(v -> variantId.equals(v.get("id"))).findFirst().orElse(null);
                }
            }
        }
        boolean asksAura = mentions(message, "aura") || selectedAura != null;
        if (asksAura && selectedAura == null && (mentions(message, "geometry") || mentions(message, "geometria")
                || mentions(message, "electro") || mentions(message, "eletro"))) {
            unresolved.put("aura", Msg.t("backgroundStudio.preset_aura_desconhecido", "Aura solicitada"));
        } else if (asksAura && selectedAura == null) {
            Map<String, Object> direction = backgroundStudio.recommend(styles, occasions);
            Object recommendedAura = direction.get("aura");
            if (recommendedAura instanceof String id) {
                scheme.put("aura", Map.of("variantId", id));
                if (direction.get("skin") instanceof String skin) scheme.put("cardSkin", skin);
                if (direction.get("material") instanceof String material && mentions(message, "material")) scheme.put("materialId", material);
            } else {
                unresolved.put("aura", Msg.t("backgroundStudio.preset_aura_desconhecido", "Aura solicitada"));
            }
        }
        if (selectedAura != null) {
            if (selectedVariant == null) {
                List<Map<String, Object>> variants = catalogEntries(selectedAura.get("variants"));
                selectedVariant = variants.isEmpty() ? null : variants.get(0);
            }
            if (selectedVariant != null && selectedVariant.get("id") instanceof String id) {
                Map<String, Object> aura = new LinkedHashMap<>();
                aura.put("variantId", id);
                if (mentions(message, "gif") || mentions(message, "animado") || mentions(message, "dinamico")) aura.put("animated", true);
                scheme.put("aura", aura);
            }
        }

        List<Map<String, Object>> materials = catalogEntries(catalog.get("materials"));
        Map<String, Object> selectedMaterial = namedEntry(materials, message, "id", "name");
        if (selectedMaterial == null && CopilotLexicon.MATERIAL_CUES.stream().anyMatch(cue -> mentions(message, cue))) {
            String materialId = CopilotLexicon.first(CopilotLexicon.BACKGROUND_MATERIALS, message);
            selectedMaterial = materialId == null ? null : materials.stream().filter(m -> materialId.equals(m.get("id"))).findFirst().orElse(null);
        }
        if (selectedMaterial != null && selectedMaterial.get("id") instanceof String id) scheme.put("materialId", id);
        else if (mentions(message, "material")) {
            Map<String, Object> direction = backgroundStudio.recommend(styles, occasions);
            if (direction.get("material") instanceof String id) scheme.put("materialId", id);
            else unresolved.put("material", Msg.t("backgroundStudio.material_desconhecido", "material solicitado"));
        }

        List<Map<String, Object>> gradients = catalogEntries(catalog.get("gradients"));
        Map<String, Object> selectedGradient = namedEntry(gradients, message, "id", "name");
        if (selectedGradient == null && gradientTerm != null) {
            selectedGradient = gradients.stream().filter(g -> gradientTerm.equals(g.get("id"))).findFirst().orElse(null);
        }
        if (selectedGradient != null) {
            scheme.put("gradientPresetId", selectedGradient.get("id"));
            scheme.put("gradient", selectedGradient);
        }
        List<Map<String, Object>> seasonal = catalogEntries(catalog.get("seasonal"));
        Map<String, Object> selectedSeasonal = namedEntry(seasonal, message, "id", "name");
        if (selectedSeasonal == null && CopilotLexicon.SEASONAL_CUES.stream().anyMatch(cue -> mentions(message, cue))) {
            String seasonalId = CopilotLexicon.SEASONAL_PRESETS.get(lookPrompt(message, List.of(), null).season());
            selectedSeasonal = seasonalId == null ? null : seasonal.stream().filter(g -> seasonalId.equals(g.get("id"))).findFirst().orElse(null);
        }
        if (selectedSeasonal != null) {
            scheme.put("seasonalPresetId", selectedSeasonal.get("id"));
            scheme.put("gradient", selectedSeasonal);
        }
        if (scheme.get("aura") instanceof Map<?, ?> aura && scheme.containsKey("materialId")
                && (mentions(message, "gif") || mentions(message, "animado") || mentions(message, "dinamico"))) {
            ((Map<String, Object>) aura).put("format", "IMAGEM_UNICA");
        }
        if (scheme.isEmpty()) return new BackgroundPrompt(null, unresolved);
        Map<String, Object> configuration = new LinkedHashMap<>();
        configuration.put("scheme", scheme);
        configuration.put("pieces", Map.of("anatomy", "PECA_AMPLIADO"));
        return new BackgroundPrompt(configuration, unresolved);
    }

    static boolean nameMatch(WardrobeItem w, String t) {
        if (w.getName() == null) {
            return false;
        }
        for (String tok : normalized(w.getName()).split("\\s+")) {
            if (tok.length() > 3 && t.contains(tok)) {
                return true;
            }
        }
        return false;
    }

    Map<String, Object> chip(WardrobeItem w, Map<UUID, RoomService.Location> where) {
        RoomService.Location loc = where.get(w.getId());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pieceId", w.getId());
        m.put("name", w.getName());
        m.put("imageUrl", w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl());
        m.put("available", w.isDisponivel() && w.getAvailabilityStatus() == AvailabilityStatus.AVAILABLE);
        m.put("address", loc == null ? null : loc.address().toString());
        m.put("addressLabel", loc == null ? null : loc.label());
        m.put("actions", List.of("VER_PECA", "MONTAR_NO_ESPELHO", "CRIAR_LOOK"));
        return m;
    }

    // ================================================================== resposta principal
    @Transactional
    public Map<String, Object> ask(CurrentUser user, AskRequest req) {
        if (SealPolicyCopilot.tagged(req.message())) {
            if (sealPolicyService == null) throw new ApiException(503, "IA_INDISPONIVEL", Msg.t("sealCopilot.ia_indisponivel"));
            return sealPolicyService.draft(user, null, req.message(), null);
        }
        String message = InputSanitizer.clean(req.message() == null ? "" : req.message(), 600);
        if (message.isBlank()) {
            throw ApiException.badRequest("MENSAGEM_VAZIA", Msg.t("copilot.escreva_o_que_voce_precisa"));
        }
        Intent intent = intent(message);
        Map<String, Object> out = switch (intent) {
            case WHERE_IS -> whereIs(user, message, req.view());
            case HYPE -> hypeAnswer(user, message);
            case FORGOTTEN -> forgotten(user);
            case IMPROVE_INVENTORY -> improveInventory(user);
            case DIFFERENT -> different(user, req);
            case DIAGNOSIS -> diagnosis(user);
            case LOOKS -> looks(user, req, message);
            case GENERAL -> general(user, message, req.view());
        };
        out.put("intent", intent.name());
        out.put("view", req.view());
        out.put("suggestedPrompts", promptsFor(req.view()));
        restrictionNotice(user).ifPresent(n -> out.put("challengeNotice", n));
        return out;
    }

    Optional<String> restrictionNotice(CurrentUser user) {
        return challenges.restriction(user.id()).map(r -> Msg.t("copilot.estou_respeitando_o_desafio_so", r.challengeName(), r.allowedPieceIds().size()));
    }

    /** CA09 — "Onde está meu tênis branco?" → endereço e destaque no quarto. */
    Map<String, Object> whereIs(CurrentUser user, String message, String view) {
        List<WardrobeItem> found = searchPieces(user.id(), message);
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        if (found.isEmpty()) {
            out.put("text", Msg.t("copilot.nao_encontrei_essa_peca_no"));
            out.put("actions", List.of(Map.of("type", "ADD_PIECE", "href", "/pieces/new")));
            out.put("chips", List.of());
            return out;
        }
        List<Map<String, Object>> chips = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        for (WardrobeItem w : found) {
            RoomService.Location loc = where.get(w.getId());
            if (loc == null) {
                loc = room.locate(user.id(), w.getId()).orElse(null);
                if (loc != null) {
                    where.put(w.getId(), loc);
                }
            }
            chips.add(chip(w, where));
            if (sb.length() > 0) {
                sb.append(' ');
            }
            sb.append(Msg.t("copilot.sua")).append(w.getName()).append(Msg.t("copilot.esta_em")).append(loc == null ? Msg.t("common.posicao_desconhecida") : loc.label()).append("**.");
            if (!w.isDisponivel()) {
                sb.append(Msg.t("copilot.esta_no_cesto_indisponivel"));
            }
        }
        out.put("text", sb.toString());
        out.put("chips", chips);
        WardrobeItem first = found.get(0);
        RoomService.Location loc = where.get(first.getId());
        if (loc != null) {
            out.put("roomHighlight", Map.of("pieceId", first.getId(), "address", loc.address().toString(), "moduleId", loc.moduleId(),
                    "applyNow", "QUARTO".equalsIgnoreCase(view)));
        }
        out.put("tools", List.of("buscar_pecas", "localizar_peca"));
        return out;
    }

    /** CA11 — peças esquecidas ordenadas por tempo sem uso + [Criar look com elas]. */
    Map<String, Object> forgotten(CurrentUser user) {
        LocalDate today = LocalDate.now(FaiPointsService.ZONE);
        Map<UUID, LocalDate> last = room.lastDiaryDates(user.id(), today.minusYears(10));
        List<WardrobeItem> list = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(w -> RoomService.forgotten(w, RoomService.lastUse(w, last), today))
                .sorted(Comparator.comparing((WardrobeItem w) -> Optional.ofNullable(RoomService.lastUse(w, last))
                        .orElse(LocalDate.ofInstant(w.getCreatedAt(), FaiPointsService.ZONE))))
                .toList();
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        if (list.isEmpty()) {
            out.put("text", Msg.t("copilot.boa_noticia_nenhuma_peca_esta"));
            out.put("chips", List.of());
            return out;
        }
        List<Map<String, Object>> chips = new ArrayList<>();
        StringBuilder sb = new StringBuilder(Msg.t("copilot.estas_pecas_estao_paradas_ha"));
        for (WardrobeItem w : list.stream().limit(8).toList()) {
            LocalDate ref = Optional.ofNullable(RoomService.lastUse(w, last)).orElse(LocalDate.ofInstant(w.getCreatedAt(), FaiPointsService.ZONE));
            Map<String, Object> c = chip(w, where);
            c.put("daysUnused", ChronoUnit.DAYS.between(ref, today));
            chips.add(c);
            long days = ChronoUnit.DAYS.between(ref, today);
            sb.append("\n• ").append(w.getName()).append(" — ").append(days == 1 ? Msg.t("copilot.um_dia") : Msg.t("copilot.n_dias", days));
        }
        out.put("text", sb.toString());
        out.put("chips", chips);
        out.put("actions", List.of(Map.of("type", "COMPOSE_WITH", "label", Msg.t("common.criar_look_com_elas"), "pieceIds", list.stream().limit(3).map(WardrobeItem::getId).toList()),
                Map.of("type", "CHALLENGE", "label", Msg.t("common.segunda_chance"), "code", "SECOND_CHANCE")));
        out.put("tools", List.of("historico_uso"));
        return out;
    }

    /** CA13 — as 2 dimensões mais fracas com números e ações diretas. */
    Map<String, Object> improveInventory(CurrentUser user) {
        Map<String, Object> hints = inventory.improvementHints(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        if (!Boolean.TRUE.equals(hints.get("eligible"))) {
            out.put("text", Msg.t("copilot.o_inventory_score_aparece_a"));
            out.put("actions", List.of(Map.of("type", "ADD_PIECE", "href", "/pieces/new")));
            return out;
        }
        @SuppressWarnings("unchecked") List<InventoryScoreService.Dimension> weakest = (List<InventoryScoreService.Dimension>) hints.get("weakest");
        StringBuilder sb = new StringBuilder(Msg.t("copilot.seu_inventory_score_e_as", hints.get("score")));
        for (InventoryScoreService.Dimension d : weakest) {
            sb.append("\n• **").append(d.name()).append(" ").append(d.value()).append("** — ").append(d.rule());
        }
        out.put("text", sb.toString());
        out.put("dimensions", weakest);
        out.put("actions", hints.get("actions"));
        out.put("suggestedChallenges", hints.get("suggestedChallenges"));
        out.put("tools", List.of("ler_inventory_score"));
        return out;
    }

    /** CA12 — maximiza a distância das combinações mais frequentes do histórico, só com peças disponíveis. */
    Map<String, Object> different(CurrentUser user, AskRequest req) {
        List<WardrobeItem> eligible = mirror.eligible(user.id());
        if (eligible.size() < MIN_PIECES) {
            throw new ApiException(422, "ACERVO_INSUFICIENTE", Msg.t("copilot.cadastre_ao_menos_3_pecas"), Map.of("href", "/pieces/new"));
        }
        Map<UUID, Long> freq = new HashMap<>();
        for (Scheme s : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED)) {
            schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).forEach(si -> freq.merge(si.getWardrobeItem().getId(), 1L, Long::sum));
        }
        Map<String, Long> styleFreq = new HashMap<>();
        eligible.stream().filter(w -> freq.containsKey(w.getId())).forEach(w -> Json.csv(w.getStyleTags()).forEach(s -> styleFreq.merge(s, freq.get(w.getId()), Long::sum)));
        Set<String> usual = styleFreq.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(2).map(Map.Entry::getKey).collect(Collectors.toSet());
        List<WardrobeItem> ranked = eligible.stream().sorted(Comparator.comparingLong((WardrobeItem w) -> freq.getOrDefault(w.getId(), 0L))
                .thenComparingLong(w -> Json.csv(w.getStyleTags()).stream().filter(usual::contains).count())).toList();
        List<WardrobeItem> look = new ArrayList<>();
        for (String slot : List.of("upper", "lower", "shoes")) {
            ranked.stream().filter(w -> MirrorService.slotOf(w).equals(slot)).findFirst().ifPresent(look::add);
        }
        if (look.stream().noneMatch(w -> MirrorService.slotOf(w).equals("upper")) || look.stream().noneMatch(w -> MirrorService.slotOf(w).equals("lower"))) {
            look.removeIf(w -> !MirrorService.slotOf(w).equals("shoes"));
            ranked.stream().filter(w -> MirrorService.slotOf(w).equals("dress")).findFirst().ifPresent(look::add);
        }
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("text", look.isEmpty() ? Msg.t("copilot.nao_consegui_montar_algo_diferente") : Msg.t("copilot.fugindo_do_seu_habitual_que", String.join(", ", usual), look.stream().map(WardrobeItem::getName).collect(Collectors.joining(" + "))));
        out.put("chips", look.stream().map(w -> chip(w, where)).toList());
        out.put("actions", look.isEmpty() ? List.of() : List.of(Map.of("type", "MOUNT_MIRROR", "pieceIds", look.stream().map(WardrobeItem::getId).toList()),
                Map.of("type", "OPEN_CREATE_LOOK", "draft", draft(look, "copilot", req.message()))));
        out.put("tools", List.of("historico_uso", "buscar_pecas"));
        return out;
    }

    static Map<String, Object> draft(List<WardrobeItem> look, String origin, String prompt) {
        Map<String, String> slots = new LinkedHashMap<>();
        List<String> acc = new ArrayList<>();
        for (WardrobeItem w : look) {
            String s = MirrorService.slotOf(w);
            if (s.equals("accessory")) {
                acc.add(w.getId().toString());
            } else {
                slots.put(s, w.getId().toString());
            }
        }
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("origin", origin);
        d.put("slots", slots);
        d.put("accessories", acc);
        d.put("prompt", prompt);
        d.put("created_at", java.time.Instant.now().toString());
        d.put("sessionStorageKey", "sai_room_look_draft");
        return d;
    }

    /** §3.3 / CA14 — diagnóstico: reuso antes de compra, Δcombinações visível, genérico, patrocínio separado, opt-out. */
    Map<String, Object> diagnosis(CurrentUser user) {
        List<WardrobeItem> a = wardrobe.eligible(user.id());
        long uppers = a.stream().filter(w -> "upper_piece".equals(w.getCategory())).count();
        long lowers = a.stream().filter(w -> "lower_piece".equals(w.getCategory())).count();
        long shoes = a.stream().filter(w -> "shoes_piece".equals(w.getCategory())).count();
        List<String> findings = new ArrayList<>();
        findings.add(Msg.t("copilot.partes_de_cima_para_partes", (uppers), lowers, shoes));
        Map<UUID, Long> freq = new HashMap<>();
        long totalApp = 0;
        for (Scheme s : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED)) {
            for (SchemeItem si : schemeItems.findBySchemeIdOrderBySortOrder(s.getId())) {
                freq.merge(si.getWardrobeItem().getId(), 1L, Long::sum);
                totalApp++;
            }
        }
        if (totalApp > 0) {
            long top3 = freq.values().stream().sorted(Comparator.reverseOrder()).limit(3).mapToLong(Long::longValue).sum();
            findings.add(Msg.t("copilot.das_aparicoes_nos_seus_looks", (Math.round(100.0 * top3 / totalApp))));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        // 1) reuso primeiro
        Map<String, Object> reuse = forgotten(user);
        Map<String, Object> album = inventory.album(user);
        List<Map<String, Object>> reuseSuggestions = new ArrayList<>();
        reuseSuggestions.add(Map.of("type", "FORGOTTEN", "text", reuse.get("text"), "chips", reuse.getOrDefault("chips", List.of())));
        reuseSuggestions.add(Map.of("type", "UNSEEN_COMBOS", "text", album.get("message"), "undiscovered", album.getOrDefault("undiscovered", List.of())));
        out.put("findings", findings);
        out.put("reuse", reuseSuggestions);
        // 2) sugestão de compra só depois, com Δcombinações > 0, genérica e com opt-out
        boolean enabled = preferences.findByUserId(user.id()).map(UserPreferences::isPurchaseSuggestionsEnabled).orElse(true);
        List<Map<String, Object>> purchases = enabled ? purchaseSuggestions(a) : new ArrayList<>();
        out.put("purchaseSuggestions", enabled ? purchases.stream().limit(3).toList() : List.of());
        out.put("purchaseSuggestionsEnabled", enabled);
        out.put("purchaseRules", List.of(Msg.t("copilot.reuso_antes_de_compra"), Msg.t("copilot.combinacoes_visivel"), Msg.t("copilot.sem_marca_ou_produto"), Msg.t("copilot.patrocinio_so_em_bloco_separado"), Msg.t("copilot.opt_out_em_preferencias")));
        out.put("sponsored", Map.of("label", "Patrocinado", "items", List.of(), "note", Msg.t("copilot.conteudo_de_marca_nunca_entra")));
        out.put("text", String.join(" ", findings) + (purchases.isEmpty() || !enabled ? "" : Msg.t("copilot.depois_de_reaproveitar_o_que", purchases.get(0).get("subcategory"), purchases.get(0).get("color"), purchases.get(0).get("gainText"))));
        out.put("tools", List.of("buscar_pecas", "historico_uso", "ler_inventory_score"));
        return out;
    }

    /**
     * Sugestões de compra GENÉRICAS (subcategoria + cor, nunca marca ou produto) que aumentam as combinações válidas do
     * acervo disponível ({@code InventoryScoreService.combos}), em ordem de ganho. Só aparecem DEPOIS do reuso (quem chama
     * mostra antes as peças esquecidas e as combinações não descobertas) e respeitam o opt-out das preferências.
     */
    public static List<Map<String, Object>> purchaseSuggestions(List<WardrobeItem> a) {
        List<Map<String, Object>> purchases = new ArrayList<>();
        long base = InventoryScoreService.combos(a, 0, null).total();
        WeatherService.Context none = WeatherService.Context.none("");
        for (LocalAdvisors.PieceSuggestion g : LocalAdvisors.wardrobeGaps(a, none.temperatureC())) {
            String cat = Taxonomy.categoryOf(g.subcategory());
            Set<String> occ = new LinkedHashSet<>();
            a.stream().flatMap(w -> Json.csv(w.getOccasionTags()).stream()).collect(Collectors.groupingBy(o -> o, Collectors.counting()))
                    .entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(2).forEach(e -> occ.add(e.getKey()));
            WardrobeItem hyp = new WardrobeItem();
            hyp.setCategory(cat);
            hyp.setSubcategory(g.subcategory());
            hyp.setColor(g.color());
            hyp.setOccasionTags(String.join(",", occ));
            hyp.setDisponivel(true);
            hyp.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
            List<WardrobeItem> plus = new ArrayList<>(a);
            plus.add(hyp);
            long gain = InventoryScoreService.combos(plus, 0, null).total() - base;
            if (gain > 0) {
                purchases.add(Map.of("category", String.valueOf(cat), "subcategory", g.subcategory(), "color", g.color(), "occasions", occ,
                        "gain", gain, "gainText", Msg.t("copilot.combinacoes_possiveis", gain), "reason", g.reason(), "external", true,
                        "action", Map.of("type", "ADD_PIECE", "label", Msg.t("copilot.cadastrar_se_voce_ja_tiver"), "href", "/pieces/new")));
            }
        }
        purchases.sort(Comparator.comparingLong((Map<String, Object> m) -> (Long) m.get("gain")).reversed());
        return purchases;
    }

    /** CA02/CA03/CA05 — 3 looks distintos com justificativa; sem repetir a rodada anterior; fallback local. */
    Map<String, Object> looks(CurrentUser user, AskRequest req, String message) {
        if (wardrobe.eligible(user.id()).size() < MIN_PIECES) {
            throw new ApiException(422, "ACERVO_INSUFICIENTE", Msg.t("copilot.o_copilot_precisa_de_ao_2"), Map.of("href", "/pieces/new"));
        }
        LookPrompt interpreted = lookPrompt(message, req.occasion(), req.mood());
        List<String> occasions = new ArrayList<>(interpreted.occasions());
        if (occasions.isEmpty()) {
            MirrorService.localInterpretation(message, List.of()).occasion().stream().filter(Taxonomy.OCCASIONS::contains).limit(3).forEach(occasions::add);
        }
        // Momentos §17: "monte um look para o Halloween…" — o Momento ativo mencionado empresta ocasiões e tema
        Map<String, Object> moment = detectMoment(user.id(), message);
        if (moment != null && occasions.isEmpty()) {
            strings(moment.get("occasionTags")).stream().filter(Taxonomy.OCCASIONS::contains).limit(2).forEach(occasions::add);
        }
        Set<UUID> requiredPieceIds = Set.of();
        if (hasPieceConstraints(message)) {
            requiredPieceIds = searchPieces(user.id(), message, true).stream().map(WardrobeItem::getId).collect(Collectors.toSet());
            if (requiredPieceIds.isEmpty()) {
                Map<String, Object> noMatch = new LinkedHashMap<>();
                noMatch.put("text", Msg.t("copilot.nao_encontrei_essa_peca_no"));
                noMatch.put("looks", List.of());
                noMatch.put("suggestions", List.of());
                noMatch.put("requestedFilters", Map.of("message", InputSanitizer.clean(message, 200)));
                return noMatch;
            }
        }
        BackgroundPrompt backgroundRequest = backgroundPrompt(message, interpreted.styles(), occasions);
        Deque<String> prev = shown.computeIfAbsent(user.id(), k -> new ArrayDeque<>());
        Set<String> exclude = new HashSet<>(prev);
        if (req.excludeKeys() != null) {
            exclude.addAll(req.excludeKeys());
        }
        Map<String, Object> result = autopilot.daily(user, new AutopilotService.DailyRequest(occasions, interpreted.mood(), req.city(), req.latitude(), req.longitude(),
                new ArrayList<>(exclude)), requiredPieceIds, interpreted.weather());
        @SuppressWarnings("unchecked") List<Map<String, Object>> suggestions = (List<Map<String, Object>>) result.getOrDefault("suggestions", List.of());
        suggestions.forEach(s -> {
            prev.addLast(String.valueOf(s.get("key")));
            while (prev.size() > 60) {
                prev.removeFirst();
            }
        });
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        for (Map<String, Object> s : suggestions) {
            @SuppressWarnings("unchecked") List<UUID> ids = (List<UUID>) s.get("pieceIds");
            List<WardrobeItem> look = pieces.findByIdIn(ids);
            s.put("chips", look.stream().map(w -> chip(w, where)).toList());
            s.put("actions", List.of(Map.of("type", "ACCEPT_DAILY_LOOK", "label", Msg.t("copilot.usar_como_look_do_dia")), Map.of("type", "MOUNT_MIRROR", "pieceIds", ids),
                    Map.of("type", "OPEN_CREATE_LOOK", "draft", draft(look, "copilot", message))));
            s.put("occasion", occasions);
            s.put("style", interpreted.styles());
            s.put("mood", interpreted.mood());
            s.put("season", interpreted.season());
            s.put("weather", interpreted.weather());
            s.put("background", backgroundRequest.configuration());
            s.put("description", message);
        }
        Map<String, Object> out = new LinkedHashMap<>(result);
        out.put("text", suggestions.isEmpty() ? String.valueOf(result.getOrDefault("message", "Sem combinações novas.")) : lookSummary(suggestions.size(), occasions));
        if (!backgroundRequest.unresolved().isEmpty()) out.put("backgroundNotice", backgroundRequest.unresolved());
        List<Map<String, Object>> lookCards = suggestions.stream().map(s -> {
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("title", s.get("title"));
            card.put("pieceIds", s.get("pieceIds"));
            card.put("pieces", s.getOrDefault("chips", List.of()));
            card.put("why", s.get("rationale"));
            card.put("occasion", occasions);
            card.put("style", interpreted.styles());
            card.put("mood", interpreted.mood());
            card.put("season", interpreted.season());
            card.put("weather", interpreted.weather());
            card.put("background", backgroundRequest.configuration());
            card.put("description", InputSanitizer.clean(message, 2048));
            return card;
        }).toList();
        RecommendationScoring.Mode mode = RecommendationScoring.Mode.parse(req.mode());
        List<Map<String, Object>> scored = scoreLooks(user, lookCards, mode);
        if (moment != null) {
            scored = withMomentMatch(scored, moment, occasions);
            out.put("momentNotice", momentNotice(moment, scored));
            out.put("moment", Map.of("id", moment.get("id"), "slug", moment.get("slug"), "name", moment.get("name")));
        }
        out.put("looks", scored);
        out.put("mode", mode == null ? null : mode.name());
        if (hasPieceConstraints(message)) out.put("requestedFilters", Map.of("pieceIds", requiredPieceIds));
        out.put("tools", List.of("buscar_pecas", "listar_looks", "montar_no_espelho", "abrir_criar_look"));
        return out;
    }

    // ================================================================== Momentos como contexto (§17–§18)
    List<Map<String, Object>> activeMoments(UUID userId) {
        try {
            return moments == null ? List.of() : moments.activeSummary(userId);
        } catch (RuntimeException ex) {
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    static List<String> strings(Object v) {
        return v instanceof List<?> l ? ((List<Object>) l).stream().map(String::valueOf).toList() : List.of();
    }

    /** O Momento ativo que a mensagem menciona (nome, slug ou tag de estilo/cor exclusiva dele); nulo se nenhum. */
    Map<String, Object> detectMoment(UUID userId, String message) {
        List<Map<String, Object>> active = activeMoments(userId);
        for (Map<String, Object> m : active) {
            String name = String.valueOf(m.get("name"));
            String slug = String.valueOf(m.get("slug")).replace('-', ' ').replaceAll("\\d{4}", "").trim();
            if (mentions(message, name) || (!slug.isBlank() && mentions(message, slug)) || mentions(message, name.replaceAll("\\d{4}", "").trim())) {
                return m;
            }
        }
        return null;
    }

    /**
     * MomentMatch de cada sugestão (sobre as tags das peças, determinístico) e reordenação: a leitura do Momento mais
     * compatível com o DNA sobe, sem apagar as demais — descoberta e identidade convivem (§18).
     */
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> withMomentMatch(List<Map<String, Object>> cards, Map<String, Object> moment, List<String> occasions) {
        List<br.com.fashionai.application.moments.MomentMatch.Interpretation> interps = new ArrayList<>();
        for (Object o : (List<Object>) moment.getOrDefault("interpretations", List.of())) {
            if (o instanceof Map<?, ?> im) {
                Map<String, Object> i = (Map<String, Object>) im;
                interps.add(br.com.fashionai.application.moments.MomentMatch.interpretation(String.valueOf(i.get("key")), strings(i.get("styleTags")), strings(i.get("colorTags"))));
            }
        }
        br.com.fashionai.application.moments.MomentMatch.Context ctx = br.com.fashionai.application.moments.MomentMatch.context(
                strings(moment.get("styleTags")), strings(moment.get("colorTags")), strings(moment.get("occasionTags")), List.of(), interps);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> card : cards) {
            Map<String, Object> c = new LinkedHashMap<>(card);
            List<UUID> ids = (List<UUID>) c.get("pieceIds");
            List<WardrobeItem> look = ids == null ? List.of() : pieces.findByIdIn(ids);
            Set<String> styles = new LinkedHashSet<>(strings(c.get("style")));
            Set<String> colors = new LinkedHashSet<>();
            List<String> subs = new ArrayList<>();
            for (WardrobeItem w : look) {
                styles.addAll(Json.csv(w.getStyleTags()));
                colors.addAll(HypeQueryService.colorsOf(w));
                if (w.getSubcategory() != null) subs.add(w.getSubcategory());
            }
            br.com.fashionai.application.moments.MomentMatch.Result r = br.com.fashionai.application.moments.MomentMatch.score(ctx,
                    br.com.fashionai.application.moments.MomentMatch.subject(styles, colors, occasions, subs));
            Map<String, Object> scores = new LinkedHashMap<>((Map<String, Object>) c.getOrDefault("scores", Map.of()));
            scores.put("moment", r == null ? null : r.score());
            c.put("scores", scores);
            c.put("moment", Map.of("slug", moment.get("slug"), "name", moment.get("name"), "match", r == null ? 0 : r.score(),
                    "interpretation", r == null || r.interpretation() == null ? "" : r.interpretation()));
            out.add(c);
        }
        out.sort(Comparator.comparingInt((Map<String, Object> c) -> (Integer) ((Map<?, ?>) c.get("moment")).get("match")).reversed());
        return out;
    }

    @SuppressWarnings("unchecked")
    String momentNotice(Map<String, Object> moment, List<Map<String, Object>> cards) {
        String name = String.valueOf(moment.get("name"));
        String interpretation = cards.stream().map(c -> (Map<String, Object>) c.get("moment")).map(m -> String.valueOf(m.get("interpretation")))
                .filter(x -> !x.isBlank()).findFirst().orElse(null);
        return interpretation == null ? Msg.t("copilot.momento_sem_interpretacao", name) : Msg.t("copilot.momento_interpretacao", name, interpretation);
    }

    // ================================================================== HypeScore v2 como contexto
    /**
     * Pontua cada look sugerido nas seis dimensões independentes de {@link RecommendationScoring} (a mesma régua do
     * Autopiloto, em {@link LookScorer}) e, com um modo escolhido, reordena pelo peso do modo. Sem modo, mantém a ordem
     * do motor e só mostra os números.
     */
    List<Map<String, Object>> scoreLooks(CurrentUser user, List<Map<String, Object>> cards, RecommendationScoring.Mode mode) {
        return scorer.scoreCards(user, cards, mode);
    }

    /**
     * "Qual é a peça mais relevante do meu guarda-roupa?", "qual item está crescendo?", "tenho alguma peça rara?",
     * "qual peça está voltando a ser tendência?", "qual look tem mais potencial de trend?" — respondido com o HypeScore v2
     * e SEMPRE com a compatibilidade com o estilo ao lado (Hype ≠ estilo pessoal).
     */
    Map<String, Object> hypeAnswer(CurrentUser user, String message) {
        String t = message.toLowerCase(Locale.ROOT);
        LocalDate today = LocalDate.now(FaiPointsService.ZONE);
        Map<String, Object> out = new LinkedHashMap<>();
        StyleCompatibility.Profile dna = dnas.findByUserId(user.id()).map(HypeQueryService::profileOf).orElse(null);
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        boolean looksAsked = t.matches(".*\\b(look|looks|esquema|esquemas|outfit)\\b.*");
        if (looksAsked) {
            List<Scheme> mine = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED);
            Map<UUID, HypeScoreCurrent> h = hype.currentOf(HypeEntityType.SCHEME, mine.stream().map(Scheme::getId).toList());
            List<Scheme> ranked = mine.stream().filter(s -> h.containsKey(s.getId()) && h.get(s.getId()).getScore() != null)
                    .sorted(Comparator.comparingDouble((Scheme s) -> potential(h.get(s.getId()))).reversed()).limit(3).toList();
            if (ranked.isEmpty()) {
                out.put("text", Msg.t("copilot.hype.nada") + "\n\n" + Msg.t("copilot.hype.aviso"));
                out.put("chips", List.of());
                return out;
            }
            StringBuilder sb = new StringBuilder(Msg.t("copilot.hype.looks"));
            List<Map<String, Object>> cards = new ArrayList<>();
            for (Scheme s : ranked) {
                HypeScoreCurrent c = h.get(s.getId());
                sb.append("\n• ").append(Msg.t("copilot.hype.linha_look", s.getTitle(), (int) Math.round(c.getScore().doubleValue()), dim(c.getDimensions().getTrend()), dim(c.getDimensions().getTrendVelocity())));
                List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(s.getId());
                Map<String, Object> card = new LinkedHashMap<>();
                card.put("title", s.getTitle());
                card.put("pieceIds", items.stream().map(si -> si.getWardrobeItem().getId()).toList());
                card.put("pieces", items.stream().map(si -> chip(si.getWardrobeItem(), where)).toList());
                card.put("why", Msg.t("copilot.hype.linha_look", s.getTitle(), (int) Math.round(c.getScore().doubleValue()), dim(c.getDimensions().getTrend()), dim(c.getDimensions().getTrendVelocity())));
                card.put("schemeId", s.getId());
                cards.add(card);
            }
            out.put("text", sb + "\n\n" + Msg.t("copilot.hype.aviso"));
            out.put("looks", cards);
            out.put("chips", List.of());
            out.put("actions", List.of(Map.of("type", "OPEN_HYPE", "label", Msg.t("copilot.hype.ver_historico"), "href", "/history?tab=hype")));
            out.put("tools", List.of("hype_score"));
            return out;
        }
        List<WardrobeItem> own = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
        Map<UUID, HypeScoreCurrent> h = hype.currentOf(HypeEntityType.PIECE, own.stream().map(WardrobeItem::getId).toList());
        java.util.function.Predicate<WardrobeItem> scored = w -> h.containsKey(w.getId()) && h.get(w.getId()).getScore() != null;
        String header;
        List<WardrobeItem> picked;
        if (t.matches(".*(rar[ao]s?|raridade|rare|rarest|exclusiv).*")) {
            header = Msg.t("copilot.hype.rare");
            // só o que é de fato raro (≥ 50): listar peças comuns como "raras" seria enganoso
            picked = own.stream().filter(w -> h.containsKey(w.getId()) && h.get(w.getId()).getDimensions().getRarity() != null
                            && h.get(w.getId()).getDimensions().getRarity().doubleValue() >= 50)
                    .sorted(Comparator.comparing((WardrobeItem w) -> h.get(w.getId()).getDimensions().getRarity()).reversed()).limit(5).toList();
        } else if (t.matches(".*(voltando|volta a ser|voltar a ser|comeback|coming back|volviendo|vuelve a ser).*")) {
            header = Msg.t("copilot.hype.comeback");
            picked = own.stream().filter(w -> h.containsKey(w.getId()) && HypeQueryService.idleDays(w, today) >= RoomService.FORGOTTEN_DAYS && comeback(h.get(w.getId())))
                    .sorted(Comparator.comparingDouble((WardrobeItem w) -> similarGrowth(h.get(w.getId()))).reversed()).limit(5).toList();
        } else if (t.matches(".*(crescend|subindo|growing|rising|creciendo|em crescimento|aumentando).*")) {
            header = Msg.t("copilot.hype.rising", hype.config().deltaWindowDays());
            picked = own.stream().filter(scored).filter(w -> h.get(w.getId()).getDeltaPoints() != null && h.get(w.getId()).getDeltaPoints().signum() > 0
                            || (h.get(w.getId()).getDimensions().getTrend() != null && h.get(w.getId()).getDimensions().getTrend().doubleValue() >= 60))
                    .sorted(Comparator.comparingDouble((WardrobeItem w) -> dim(h.get(w.getId()).getDimensions().getTrend())).reversed()).limit(5).toList();
        } else {
            header = Msg.t("copilot.hype.top");
            picked = own.stream().filter(scored).sorted(Comparator.comparing((WardrobeItem w) -> h.get(w.getId()).getScore()).reversed()).limit(5).toList();
        }
        if (picked.isEmpty()) {
            out.put("text", Msg.t("copilot.hype.nada") + "\n\n" + Msg.t("copilot.hype.aviso"));
            out.put("chips", List.of());
            out.put("actions", List.of(Map.of("type", "OPEN_HYPE", "label", Msg.t("copilot.hype.ver_historico"), "href", "/history?tab=hype")));
            return out;
        }
        StringBuilder sb = new StringBuilder(header);
        List<Map<String, Object>> chips = new ArrayList<>();
        for (WardrobeItem w : picked) {
            HypeScoreCurrent c = h.get(w.getId());
            Map<String, Object> compat = dna == null ? null : StyleCompatibility.score(dna, HypeQueryService.profileOf(w));
            Integer style = compat == null ? null : ((Number) compat.get("score")).intValue();
            String hypeText = c.getScore() == null ? Msg.t("copilot.hype.sem_dados") : String.valueOf(Math.round(c.getScore().doubleValue()));
            sb.append("\n• ").append(style == null ? Msg.t("copilot.hype.linha", w.getName(), hypeText) : Msg.t("copilot.hype.linha_estilo", w.getName(), hypeText, style));
            Map<String, Object> chip = chip(w, where);
            chip.put("hype", c.getScore() == null ? null : (int) Math.round(c.getScore().doubleValue()));
            chip.put("compatibility", style);
            chip.put("daysUnused", HypeQueryService.idleDays(w, today));
            chips.add(chip);
        }
        out.put("text", sb + "\n\n" + Msg.t("copilot.hype.aviso"));
        out.put("chips", chips);
        out.put("actions", List.of(Map.of("type", "COMPOSE_WITH", "label", Msg.t("common.criar_look_com_elas"), "pieceIds", picked.stream().limit(3).map(WardrobeItem::getId).toList()),
                Map.of("type", "OPEN_HYPE", "label", Msg.t("copilot.hype.ver_historico"), "href", "/history?tab=hype")));
        out.put("tools", List.of("hype_score", "dna_de_estilo"));
        return out;
    }

    /** Potencial de trend de um look: crescimento recente + aceleração (não o score acumulado). */
    static double potential(HypeScoreCurrent c) {
        return 0.6 * dim(c.getDimensions().getTrend()) + 0.4 * dim(c.getDimensions().getTrendVelocity());
    }

    static boolean comeback(HypeScoreCurrent c) {
        return similarGrowth(c) >= 15 || dim(c.getDimensions().getTrend()) >= 60;
    }

    static double similarGrowth(HypeScoreCurrent c) {
        Map<String, Object> sig = Json.map(c.getSignalsJson());
        return sig != null && sig.get("similarGrowthPercent") instanceof Number n ? n.doubleValue() : 0;
    }

    static int dim(java.math.BigDecimal v) {
        return v == null ? 0 : (int) Math.round(v.doubleValue());
    }

    /** CA06 — aceitar sugestão: esquema com origem Copilot + Look do Dia. */
    @Transactional
    public Map<String, Object> accept(CurrentUser user, List<UUID> pieceIds, String title, List<String> occasion, List<String> style,
                                      String mood, String season, String description, Map<String, Object> background) {
        Scheme s = autopilot.createScheme(user, pieceIds, title == null ? Msg.t("copilot.look_do_dia_copilot") : title,
                occasion, SchemeOrigin.COPILOT, style, mood, season, description, background);
        DailyLook dl = dailyLookService.register(user, s, DailyLookSource.COPILOT, LocalDate.now(FaiPointsService.ZONE));
        return Map.of("schemeId", s.getId(), "origin", "COPILOT", "dailyLook", dailyLookService.view(dl));
    }

    /** Conversa livre: resumo compacto + ferramentas; toda peça citada precisa ser [[pN]] do acervo (validação no servidor). */
    Map<String, Object> general(CurrentUser user, String message, String view) {
        List<WardrobeItem> own = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
        List<WardrobeItem> relevant = searchPieces(user.id(), message);
        if (relevant.isEmpty()) {
            relevant = own.stream().filter(w -> w.isDisponivel()).limit(12).toList();
        }
        Map<String, WardrobeItem> refs = new LinkedHashMap<>();
        List<Map<String, Object>> tool = new ArrayList<>();
        Map<UUID, HypeScoreCurrent> toolHype = hype.currentOf(HypeEntityType.PIECE, relevant.stream().map(WardrobeItem::getId).toList());
        int i = 1;
        for (WardrobeItem w : relevant) {
            String ref = "p" + i++;
            refs.put(ref, w);
            Map<String, Object> fields = new LinkedHashMap<>();
            fields.put("ref", ref);
            fields.put("name", String.valueOf(w.getName()));
            fields.put("category", String.valueOf(w.getCategory()));
            fields.put("subcategory", String.valueOf(w.getSubcategory()));
            fields.put("color", String.valueOf(w.getColor()));
            fields.put("material", String.valueOf(w.getMaterial()));
            fields.put("size", String.valueOf(w.getSizeLabel()));
            fields.put("style", Json.csv(w.getStyleTags()));
            fields.put("occasion", Json.csv(w.getOccasionTags()));
            fields.put("condition", w.getCondition() == null ? "" : w.getCondition().name());
            fields.put("available", w.isDisponivel());
            fields.put("favorite", w.isFavorite());
            fields.put("forSale", w.isForSale());
            fields.put("wearCount", w.getWearCount());
            fields.put("lastWornDate", w.getLastWornDate() == null ? "" : w.getLastWornDate().toString());
            // HypeScore v2 = relevância no ecossistema agora (contexto), não compatibilidade com o estilo da pessoa
            fields.put("hype", toolHype.containsKey(w.getId()) && toolHype.get(w.getId()).getScore() != null ? (int) Math.round(toolHype.get(w.getId()).getScore().doubleValue()) : "");
            fields.put("tags", Json.csv(w.getTags()));
            fields.put("notes", InputSanitizer.clean(w.getNotes(), 160));
            tool.add(fields);
        }
        Map<String, Object> summary = compactSummary(user);
        String localText = Msg.t("copilot.posso_ajudar_a_montar_looks", String.join(" · ", promptsFor(view)));
        AiOutcome<String> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.COPILOT,
                "Você é o Copilot do Fashion AI. Responda em " + Msg.languageName() + ", em até 4 frases. Use SOMENTE as peças listadas (refs p1..pn) e cite cada peça como [[pN]]. "
                        + "Nunca cite marca ou produto para compra. Nunca invente peças. Se precisar de algo fora do acervo, diga de forma genérica (categoria, cor, ocasião). "
                        + "Responda só com o texto da resposta, em prosa corrida: sem JSON, sem blocos de código.",
                "Contexto (resumo): " + Json.write(summary) + "\nVisão atual: " + view + "\nPeças disponíveis via ferramenta buscar_pecas (categoria, subcategoria, cor, material, tamanho, estilo, ocasião, estado, preço, uso, favoritas, tags e notas): " + Json.write(tool)
                        + "\nPergunta: " + message, List.of(), 500, List.of(Msg.t("copilot.resumo_compacto_contagens_dna_camada"), Msg.t("copilot.pecas_retornadas_por_buscar_pecas")),
                text -> text == null || text.isBlank() ? null : text, () -> localText, null));
        Answer answer = plainAnswer(outcome.value() == null ? localText : outcome.value());
        String raw = answer.text();
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        List<Map<String, Object>> chips = new ArrayList<>();
        Set<UUID> cited = new LinkedHashSet<>();
        // peças citadas só na lista "pecas" de uma resposta em JSON também viram chips
        answer.refs().stream().map(refs::get).filter(Objects::nonNull).forEach(w -> cited.add(w.getId()));
        Matcher m = REF.matcher(raw);
        StringBuilder sb = new StringBuilder();
        List<String> discarded = new ArrayList<>();
        while (m.find()) {
            WardrobeItem w = refs.get(m.group(1));
            if (w == null) {
                discarded.add(m.group(1));
                m.appendReplacement(sb, "");
            } else {
                cited.add(w.getId());
                m.appendReplacement(sb, Matcher.quoteReplacement("**" + w.getName() + "**"));
            }
        }
        m.appendTail(sb);
        if (!discarded.isEmpty()) {
            audit.log(user, "COPILOT_REF_DESCARTADA", "copilot:" + user.id(), Map.of("refs", discarded)); // CA10
        }
        for (UUID id : cited) {
            own.stream().filter(w -> w.getId().equals(id)).findFirst().ifPresent(w -> chips.add(chip(w, where)));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("text", sb.toString().trim());
        out.put("chips", chips);
        out.put("fallbackUsed", outcome.fallbackUsed());
        out.put("explanation", outcome.explanation());
        out.put("quota", outcome.quota());
        out.put("message", outcome.userMessage());
        out.put("tools", List.of("buscar_pecas", "ler_dna_estilo", "ler_inventory_score"));
        return out;
    }

    /** Texto da resposta do Copilot e as refs de peça (p1..pn) que vieram fora do texto. */
    record Answer(String text, List<String> refs) {
    }

    /** Campos em que a IA costuma pôr o texto quando responde em JSON apesar do pedido de prosa. */
    private static final List<String> ANSWER_FIELDS = List.of("resposta", "answer", "respuesta", "texto", "text", "response", "message");

    /**
     * A IA às vezes devolve {@code {"resposta": "...", "pecas": ["p1"]}} (às vezes dentro de ```json) em vez de prosa:
     * sem desembrulhar, a tela mostrava chaves e aspas. Texto comum passa como veio.
     */
    static Answer plainAnswer(String text) {
        if (text == null) {
            return new Answer("", List.of());
        }
        String t = text.trim();
        if (t.startsWith("```")) {
            t = t.replaceFirst("^```[a-zA-Z]*\\s*", "").replaceFirst("\\s*```$", "").trim();
        }
        if (!t.startsWith("{")) {
            return new Answer(text.trim(), List.of());
        }
        Map<String, Object> m = WardrobeService.extractJson(t);
        String body = ANSWER_FIELDS.stream().map(m::get).filter(v -> v instanceof String s && !s.isBlank())
                .map(String::valueOf).findFirst().orElse(null);
        if (body == null) {
            return new Answer(text.trim(), List.of());
        }
        List<String> refs = new ArrayList<>();
        for (String key : List.of("pecas", "peças", "pieces", "prendas", "refs")) {
            if (m.get(key) instanceof List<?> l) {
                l.stream().map(String::valueOf).filter(r -> r.matches("p\\d+")).forEach(refs::add);
            }
        }
        return new Answer(body.trim(), refs);
    }

    /** "Separei 2 looks … para trabalho/festa": ocasiões pelo rótulo da taxonomia, a frase inteira no idioma da pessoa. */
    static String lookSummary(int count, List<String> occasions) {
        if (occasions == null || occasions.isEmpty()) {
            return Msg.t("copilot.separei_looks_com_pecas_do", count, "");
        }
        String labels = String.join("/", occasions.stream().map(o -> WardrobeService.label(o).toLowerCase(Msg.locale())).toList());
        return Msg.t("copilot.separei_looks_para", count, labels);
    }

    /** Resumo compacto (§3.2): contagens, DNA Camada 1 (Camada 2 só com consentimento — CA16), Inventory Score. */
    Map<String, Object> compactSummary(CurrentUser user) {
        Map<String, Object> m = new LinkedHashMap<>();
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(user.id());
        m.put("pieces", all.size());
        m.put("byCategory", all.stream().collect(Collectors.groupingBy(w -> String.valueOf(w.getCategory()), Collectors.counting())));
        m.put("looks", schemes.countByUserId(user.id()));
        Optional<StyleDna> dna = dnas.findByUserId(user.id());
        dna.ifPresent(d -> {
            m.put("dnaArchetype", d.getArchetype().name());
            m.put("dnaPalette", Json.csv(d.getColorPalette()));
            m.put("dnaStyles", Json.csv(d.getStyleKeywords()));
            boolean lifeAllowed = preferences.findByUserId(user.id()).map(UserPreferences::isLifeIdentityInAi).orElse(false);
            if (lifeAllowed && d.getLifeIdentityJson() != null) {
                Map<String, Object> life = Json.map(d.getLifeIdentityJson());
                List<String> hidden = Json.strings(d.getLifePrivateFieldsJson());
                hidden.forEach(life::remove);
                m.put("lifeIdentity", life);
            }
        });
        try {
            InventoryScoreService.Result r = inventory.computeIsolated(user.id(), true);   // falha não afeta esta transação
            m.put("inventoryScore", r.score());
            m.put("inventoryDims", r.dims());
        } catch (RuntimeException ex) {
            m.put("inventoryScore", null);
        }
        m.put("activeChallenges", challenges.activeSummary(user.id()));
        m.put("activeMoments", activeMoments(user.id()));
        return m;
    }
}
