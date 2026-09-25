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
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
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
    public static final int MIN_PIECES = 3;
    static final Pattern REF = Pattern.compile("\\[\\[(p\\d+)]]");
    static final Map<String, Set<String>> COLOR_WORDS = new LinkedHashMap<>();
    static final Map<String, Set<String>> TYPE_WORDS = new LinkedHashMap<>();

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
        TYPE_WORDS.put("tênis", Taxonomy.SNEAKERS);
        TYPE_WORDS.put("tenis", Taxonomy.SNEAKERS);
        TYPE_WORDS.put("sapato", Set.of("loafers", "moccasins", "oxford_shoes", "derby_shoes", "flats"));
        TYPE_WORDS.put("bota", Set.of("ankle_boots", "long_boots", "combat_boots"));
        TYPE_WORDS.put("sandália", Set.of("sandals", "flip_flops", "espadrilles"));
        TYPE_WORDS.put("salto", Set.of("heels"));
        TYPE_WORDS.put("calça", Set.of("jeans", "tailored_pants", "casual_pants", "chino_pants", "cargo_pants", "jogger_pants", "sweatpants"));
        TYPE_WORDS.put("jeans", Set.of("jeans", "denim_shorts"));
        TYPE_WORDS.put("saia", Set.of("skirt", "skort"));
        TYPE_WORDS.put("short", Set.of("shorts", "bermuda_shorts", "denim_shorts"));
        TYPE_WORDS.put("bermuda", Set.of("bermuda_shorts"));
        TYPE_WORDS.put("camiseta", Set.of("t_shirt", "tank_top", "crop_top"));
        TYPE_WORDS.put("camisa", Set.of("shirt", "polo_shirt"));
        TYPE_WORDS.put("blusa", Set.of("blouse", "sweater"));
        TYPE_WORDS.put("moletom", Set.of("sweatshirt", "hoodie"));
        TYPE_WORDS.put("jaqueta", Set.of("jacket", "windbreaker", "parka"));
        TYPE_WORDS.put("casaco", Set.of("coat", "parka", "jacket"));
        TYPE_WORDS.put("blazer", Set.of("blazer"));
        TYPE_WORDS.put("vestido", Set.of("dress"));
        TYPE_WORDS.put("macacão", Set.of("jumpsuit", "overalls", "romper"));
        TYPE_WORDS.put("bolsa", Set.of("handbag", "crossbody_bag", "tote_bag", "clutch"));
        TYPE_WORDS.put("mochila", Set.of("backpack"));
        TYPE_WORDS.put("boné", Set.of("cap"));
        TYPE_WORDS.put("chapéu", Set.of("hat"));
        TYPE_WORDS.put("cinto", Set.of("belt"));
        TYPE_WORDS.put("óculos", Set.of("sunglasses", "eyeglasses"));
        TYPE_WORDS.put("colar", Set.of("necklace"));
        TYPE_WORDS.put("relógio", Set.of("watch"));
    }

    public record AskRequest(String message, String view, List<UUID> selection, List<String> occasion, String mood, String city,
                             Double latitude, Double longitude, List<String> excludeKeys) {
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
    private final Map<UUID, Deque<String>> shown = new ConcurrentHashMap<>();

    public CopilotService(WardrobeService wardrobe, WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                          DailyLookRepository dailyLooks, StyleDnaRepository dnas, UserPreferencesRepository preferences, RoomService room,
                          MirrorService mirror, InventoryScoreService inventory, ChallengeService challenges, AutopilotService autopilot,
                          DailyLookService dailyLookService, WeatherService weather, AiEngine ai, Audit audit, SchemeService schemeService) {
        this.schemeService = schemeService;
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
            case "GRADE" -> List.of("Monte um look com as peças selecionadas", "Tenho roupa que não uso há muito tempo?", "O que falta no meu guarda-roupa?");
            case "QUARTO" -> List.of("Onde está meu tênis branco?", "Vista-me para o trabalho", "Organize minhas gavetas");
            case "DESTAQUES" -> List.of("✨ Como melhorar meu inventário?", "Qual desafio combina comigo?", "Por que minha Utilização está baixa?");
            default -> List.of("Sugira 3 looks para hoje", "Quero algo diferente do que normalmente uso", "Está frio hoje, o que visto?");
        };
    }

    @Transactional(readOnly = true)
    public Map<String, Object> context(CurrentUser user, String view, List<UUID> selection, String city, Double lat, Double lon) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("view", view == null ? "COPILOT" : view.toUpperCase(Locale.ROOT));
        out.put("pieces", pieces.countByUserId(user.id()));
        out.put("available", eligible.size());
        out.put("ready", eligible.size() >= MIN_PIECES);
        if (eligible.size() < MIN_PIECES) {
            out.put("limitation", Map.of("message", Msg.t("copilot.o_copilot_precisa_de_ao"), "href", "/add-piece"));
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
        out.put("newCombinations", fresh);
        // 3) peças esquecidas: disponíveis e sem uso há 30+ dias (ou nunca usadas)
        LocalDate limit = LocalDate.now().minusDays(30);
        out.put("forgottenPieces", eligible.stream().filter(x -> x.getLastWornDate() == null || x.getLastWornDate().isBefore(limit))
                .sorted(Comparator.comparing((WardrobeItem x) -> x.getLastWornDate() == null ? LocalDate.MIN : x.getLastWornDate()))
                .limit(6).map(x -> Views.piece(x, null, null)).toList());
        // 4) peças para o clima: mesma régua do Autopiloto (faixa de temperatura → descarta peças inadequadas; camadas no frio)
        String band = w.band();
        out.put("weatherBand", band);
        out.put("weatherPieces", eligible.stream().filter(x -> !WeatherService.unsuitable(x.getSubcategory(), band))
                .sorted(Comparator.comparing((WardrobeItem x) -> !("CAMADAS".equals(band) || "INVERNO_PESADO".equals(band)) || !WeatherService.isLayer(x.getSubcategory())))
                .limit(6).map(x -> Views.piece(x, null, null)).toList());
        // 5) em alta na rede: looks públicos de outras pessoas, os de maior Hype primeiro
        out.put("trendingLooks", schemes.findPublicFeed(org.springframework.data.domain.PageRequest.of(0, 30)).stream()
                .filter(s -> !s.getUser().getId().equals(user.id()) && schemeService.canView(user, s))
                .sorted(Comparator.comparing((Scheme s) -> s.getHypeScore() == null ? java.math.BigDecimal.ZERO : s.getHypeScore()).reversed())
                .limit(4).map(s -> schemeService.view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList());
        out.put("suggestedPrompts", promptsFor("COPILOT"));
        return out;
    }

    // ================================================================== intenções
    enum Intent { WHERE_IS, FORGOTTEN, DIFFERENT, IMPROVE_INVENTORY, DIAGNOSIS, LOOKS, GENERAL }

    static Intent intent(String m) {
        String t = m == null ? "" : m.toLowerCase(Locale.ROOT);
        if (t.matches(".*(onde est|onde fica|cadê|cade |onde guardei|onde deixei).*")) {
            return Intent.WHERE_IS;
        }
        if (t.matches(".*(não uso|nao uso|esquecid|parad[ao]s?|há muito tempo|ha muito tempo|nunca usei).*")) {
            return Intent.FORGOTTEN;
        }
        if (t.matches(".*(melhorar (o |meu )?invent|inventory score|como melhorar|minha utiliza|meu score).*")) {
            return Intent.IMPROVE_INVENTORY;
        }
        if (t.matches(".*(diferente|fora do comum|ousad|sair da rotina|nunca combinei).*")) {
            return Intent.DIFFERENT;
        }
        if (t.matches(".*(comprar|o que falta|falta no meu|diagnóstic|diagnostic|lacuna).*")) {
            return Intent.DIAGNOSIS;
        }
        if (t.matches(".*(look|vestir|visto|usar hoje|sugest|montar|combina|roupa para|frio|calor|trabalho|festa|faculdade|academia).*")) {
            return Intent.LOOKS;
        }
        return Intent.GENERAL;
    }

    /** Ferramenta buscar_pecas(filtros) — só o próprio acervo; indisponíveis marcadas. */
    List<WardrobeItem> searchPieces(UUID userId, String text) {
        String t = text == null ? "" : text.toLowerCase(Locale.ROOT);
        Set<String> colors = new HashSet<>();
        COLOR_WORDS.forEach((k, v) -> {
            if (t.contains(k)) {
                colors.addAll(v);
            }
        });
        Set<String> subs = new HashSet<>();
        TYPE_WORDS.forEach((k, v) -> {
            if (t.contains(k)) {
                subs.addAll(v);
            }
        });
        if (subs.contains("jeans") && subs.size() > 1) {
            colors.remove("denim");
        }
        return pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> colors.isEmpty() || colors.contains(w.getColor()))
                .filter(w -> subs.isEmpty() || subs.contains(w.getSubcategory()))
                .filter(w -> !(colors.isEmpty() && subs.isEmpty()) || nameMatch(w, t))
                .limit(8).toList();
    }

    static boolean nameMatch(WardrobeItem w, String t) {
        if (w.getName() == null) {
            return false;
        }
        for (String tok : w.getName().toLowerCase(Locale.ROOT).split("\\s+")) {
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
        String message = InputSanitizer.clean(req.message() == null ? "" : req.message(), 600);
        if (message.isBlank()) {
            throw ApiException.badRequest("MENSAGEM_VAZIA", Msg.t("copilot.escreva_o_que_voce_precisa"));
        }
        Intent intent = intent(message);
        Map<String, Object> out = switch (intent) {
            case WHERE_IS -> whereIs(user, message, req.view());
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
            out.put("actions", List.of(Map.of("type", "ADD_PIECE", "href", "/add-piece")));
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
            sb.append("\n• ").append(w.getName()).append(" — ").append(ChronoUnit.DAYS.between(ref, today)).append(" dias");
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
            out.put("actions", List.of(Map.of("type", "ADD_PIECE", "href", "/add-piece")));
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
            throw new ApiException(422, "ACERVO_INSUFICIENTE", Msg.t("copilot.cadastre_ao_menos_3_pecas"), Map.of("href", "/add-piece"));
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
        List<Map<String, Object>> purchases = new ArrayList<>();
        if (enabled) {
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
                            "action", Map.of("type", "ADD_PIECE", "label", Msg.t("copilot.cadastrar_se_voce_ja_tiver"), "href", "/add-piece")));
                }
            }
            purchases.sort(Comparator.comparingLong((Map<String, Object> m) -> (Long) m.get("gain")).reversed());
        }
        out.put("purchaseSuggestions", enabled ? purchases.stream().limit(3).toList() : List.of());
        out.put("purchaseSuggestionsEnabled", enabled);
        out.put("purchaseRules", List.of(Msg.t("copilot.reuso_antes_de_compra"), Msg.t("copilot.combinacoes_visivel"), Msg.t("copilot.sem_marca_ou_produto"), Msg.t("copilot.patrocinio_so_em_bloco_separado"), Msg.t("copilot.opt_out_em_preferencias")));
        out.put("sponsored", Map.of("label", "Patrocinado", "items", List.of(), "note", Msg.t("copilot.conteudo_de_marca_nunca_entra")));
        out.put("text", String.join(" ", findings) + (purchases.isEmpty() || !enabled ? "" : Msg.t("copilot.depois_de_reaproveitar_o_que", purchases.get(0).get("subcategory"), purchases.get(0).get("color"), purchases.get(0).get("gainText"))));
        out.put("tools", List.of("buscar_pecas", "historico_uso", "ler_inventory_score"));
        return out;
    }

    /** CA02/CA03/CA05 — 3 looks distintos com justificativa; sem repetir a rodada anterior; fallback local. */
    Map<String, Object> looks(CurrentUser user, AskRequest req, String message) {
        if (wardrobe.eligible(user.id()).size() < MIN_PIECES) {
            throw new ApiException(422, "ACERVO_INSUFICIENTE", Msg.t("copilot.o_copilot_precisa_de_ao_2"), Map.of("href", "/add-piece"));
        }
        List<String> occasions = new ArrayList<>(req.occasion() == null ? List.of() : req.occasion());
        if (occasions.isEmpty()) {
            MirrorService.localInterpretation(message, List.of()).occasion().forEach(occasions::add);
        }
        Deque<String> prev = shown.computeIfAbsent(user.id(), k -> new ArrayDeque<>());
        Set<String> exclude = new HashSet<>(prev);
        if (req.excludeKeys() != null) {
            exclude.addAll(req.excludeKeys());
        }
        Map<String, Object> result = autopilot.daily(user, new AutopilotService.DailyRequest(occasions, req.mood(), req.city(), req.latitude(), req.longitude(),
                new ArrayList<>(exclude)));
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
        }
        Map<String, Object> out = new LinkedHashMap<>(result);
        out.put("text", suggestions.isEmpty() ? String.valueOf(result.getOrDefault("message", "Sem combinações novas.")) : Msg.t("copilot.separei_looks_com_pecas_do", suggestions.size(), (occasions.isEmpty() ? "" : " para " + String.join("/", occasions))));
        out.put("tools", List.of("buscar_pecas", "listar_looks", "montar_no_espelho", "abrir_criar_look"));
        return out;
    }

    /** CA06 — aceitar sugestão: esquema com origem Copilot + Look do Dia. */
    @Transactional
    public Map<String, Object> accept(CurrentUser user, List<UUID> pieceIds, String title, List<String> occasion) {
        Scheme s = autopilot.createScheme(user, pieceIds, title == null ? Msg.t("copilot.look_do_dia_copilot") : title, occasion, SchemeOrigin.COPILOT);
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
        int i = 1;
        for (WardrobeItem w : relevant) {
            String ref = "p" + i++;
            refs.put(ref, w);
            tool.add(Map.of("ref", ref, "name", String.valueOf(w.getName()), "subcategory", String.valueOf(w.getSubcategory()), "color", String.valueOf(w.getColor()),
                    "available", w.isDisponivel()));
        }
        Map<String, Object> summary = compactSummary(user);
        String localText = Msg.t("copilot.posso_ajudar_a_montar_looks", String.join(" · ", promptsFor(view)));
        AiOutcome<String> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.COPILOT,
                "Você é o Copilot do Fashion AI. Responda em " + Msg.languageName() + ", em até 4 frases. Use SOMENTE as peças listadas (refs p1..pn) e cite cada peça como [[pN]]. "
                        + "Nunca cite marca ou produto para compra. Nunca invente peças. Se precisar de algo fora do acervo, diga de forma genérica (categoria, cor, ocasião).",
                "Contexto (resumo): " + Json.write(summary) + "\nVisão atual: " + view + "\nPeças disponíveis via ferramenta buscar_pecas: " + Json.write(tool)
                        + "\nPergunta: " + message, List.of(), 500, List.of(Msg.t("copilot.resumo_compacto_contagens_dna_camada"), Msg.t("copilot.pecas_retornadas_por_buscar_pecas")),
                text -> text == null || text.isBlank() ? null : text, () -> localText, null));
        String raw = outcome.value() == null ? localText : outcome.value();
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        List<Map<String, Object>> chips = new ArrayList<>();
        Set<UUID> cited = new LinkedHashSet<>();
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
        return m;
    }
}
