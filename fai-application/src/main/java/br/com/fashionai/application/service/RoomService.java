package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.event.TransactionPhase;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomInventoryItem;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.model.RoomStorageEntry;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserAchievement;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;
import br.com.fashionai.domain.repository.RoomLayoutRepository;
import br.com.fashionai.domain.repository.RoomStorageEntryRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF32 — Meu Quarto: visualização espacial do guarda-roupa (FAI Origem), endereçamento estável (§1.1),
 * estados comunicados pelo ambiente (§1.2), organização manual e com IA (CA04/CA05), "Mostrar no quarto"
 * (CA09), lista acessível (CA10), evolução do móvel por nível (RF35 §5.3) e loja (Molde + Acabamento).
 * Nenhum cadastro é bloqueado por capacidade: o excedente vai para a Cadeira (CA07).
 */
@Service
public class RoomService implements FaiPointsService.RoomLayoutAccess {
    private SideEffectRunner sideEffects;
    public static final ZoneId ZONE = FaiPointsService.ZONE;
    /** Esquecida: sem uso há 60+ dias (FORGOTTEN_DAYS, MyWardrobeView.tsx:61). */
    public static final int FORGOTTEN_DAYS = 60;
    public static final int HANGERS_PER_DOOR = 12;
    public static final int DRAWER_CAPACITY = 6;
    public static final int TOP_CAPACITY = 8;
    public static final int BASE_CAPACITY = 12;
    public static final int SHOE_RACK_CAPACITY = 24;
    public static final List<String> DEFAULT_DRAWER_LABELS = List.of("Jeans", Msg.k("room.academia"), Msg.k("room.praia"), Msg.k("room.acessorios"), Msg.k("room.intimas"), Msg.k("room.favoritas"));
    /** Categorias padrão de gaveta (código → texto adiado do rótulo); "jeans" é igual em todos os idiomas. */
    static final Map<String, String> DRAWER_KINDS = Map.of("jeans", "Jeans", "academia", Msg.k("room.academia"), "praia", Msg.k("room.praia"),
            "acessorios", Msg.k("room.acessorios"), "intimas", Msg.k("room.intimas"), "favoritas", Msg.k("room.favoritas"));
    static final Set<String> OUTERWEAR = Set.of("jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono");
    static final Set<String> KNITWEAR = Set.of("sweater", "sweatshirt", "hoodie", "vest");
    static final Set<String> DENIM = Set.of("jeans", "denim_shorts");
    static final Set<String> GYM = Set.of("sweatpants", "jogger_pants", "leggings", "training_shoes", "running_shoes");
    static final Set<String> BAGS = Set.of("handbag", "crossbody_bag", "tote_bag", "clutch", "backpack");
    static final Set<String> JEWELRY = Set.of("necklace", "bracelet", "earrings", "ring", "watch");
    static final Set<String> INTIMATES = Set.of("socks");
    static final Map<String, String> SUBCATEGORY_LABELS = Map.ofEntries(Map.entry("skirt", Msg.k("room.saias")), Map.entry("shorts", Msg.k("room.shorts")),
            Map.entry("bermuda_shorts", Msg.k("room.bermudas")), Map.entry("tailored_pants", Msg.k("room.alfaiataria")), Map.entry("chino_pants", Msg.k("room.chinos")),
            Map.entry("cargo_pants", Msg.k("room.cargo")), Map.entry("casual_pants", Msg.k("room.calcas_casuais")), Map.entry("culottes", Msg.k("room.pantacourts")),
            Map.entry("skort", Msg.k("room.short_saias")), Map.entry("belt", Msg.k("room.cintos")), Map.entry("scarf", Msg.k("room.lencos")), Map.entry("cap", Msg.k("room.bones")),
            Map.entry("hat", Msg.k("room.chapeus")), Map.entry("sunglasses", Msg.k("room.oculos")), Map.entry("t_shirt", Msg.k("room.camisetas")));

    /** Decorações de desafios ativos (RF36 §5) — implementado pelo ChallengeService, sem acoplar o quarto. */
    public interface DecorationsProvider {
        List<Map<String, Object>> decorations(UUID userId);
    }

    public record Location(RoomAddress address, String label, String moduleId) {
    }

    private final RoomLayoutRepository layouts;
    private final RoomStorageEntryRepository storage;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final DailyLookRepository dailyLooks;
    private final StyleDnaRepository dnas;
    private final PieceUsageDiaryEntryRepository diary;
    private final UserAchievementRepository achievements;
    private final UserPreferencesRepository preferences;
    private final UserRepository users;
    private final FaiPointsLedgerEntryRepository ledger;
    private final ObjectProvider<DecorationsProvider> decorations;
    private final AiEngine ai;
    private final Guard guard;
    private final ObjectProvider<InventoryScoreService> inventoryScore;
    private final RoomInventoryItemRepository roomInventory;
    private final RoomCatalogItemRepository roomCatalog;
    private final ApplicationEventPublisher events;

    public RoomService(RoomLayoutRepository layouts, RoomStorageEntryRepository storage, WardrobeItemRepository pieces,
                       SchemeRepository schemes, SchemeItemRepository schemeItems, DailyLookRepository dailyLooks,
                       StyleDnaRepository dnas, PieceUsageDiaryEntryRepository diary, UserAchievementRepository achievements,
                       UserPreferencesRepository preferences, UserRepository users, FaiPointsLedgerEntryRepository ledger,
                       ObjectProvider<DecorationsProvider> decorations, AiEngine ai, Guard guard, ApplicationEventPublisher events,
            SideEffectRunner sideEffects, ObjectProvider<InventoryScoreService> inventoryScore, RoomInventoryItemRepository roomInventory,
            RoomCatalogItemRepository roomCatalog) {
        this.sideEffects = sideEffects;
        this.inventoryScore = inventoryScore;
        this.roomInventory = roomInventory;
        this.roomCatalog = roomCatalog;
        this.layouts = layouts;
        this.storage = storage;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dailyLooks = dailyLooks;
        this.dnas = dnas;
        this.diary = diary;
        this.achievements = achievements;
        this.preferences = preferences;
        this.users = users;
        this.ledger = ledger;
        this.decorations = decorations;
        this.ai = ai;
        this.guard = guard;
        this.events = events;
    }

    // ================================================================== layout (FAI Origem → Maison)
    static Map<String, Object> module(String id, String slotType, String mold, int widthCm, int capacity, String label,
                                      String sku, Map<String, Object> finish) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("slotType", slotType);
        m.put("mold", mold);
        m.put("widthCm", widthCm);
        m.put("capacity", capacity);
        m.put("label", label);
        m.put("sku", sku);
        m.put("finish", finish);
        return m;
    }

    /** Rótulo padrão do módulo como texto adiado (resolvido no idioma de quem lê); null = módulo sem rótulo padrão. */
    static String defaultModuleLabel(String id) {
        int c = id.indexOf(':');
        String zone = c < 0 ? id : id.substring(0, c);
        String n = c < 0 ? "" : id.substring(c + 1);
        return switch (zone) {
            case "door" -> Msg.k("roomAddress.porta", n);
            case "drawer" -> Msg.k("roomAddress.gaveta", n);
            case "top" -> Msg.k("roomAddress.maleiro");
            case "base" -> Msg.k("room.base");
            case "handles" -> Msg.k("room.puxadores");
            case "light" -> Msg.k("room.iluminacao");
            case "rug" -> Msg.k("room.tapete");
            case "hangers" -> Msg.k("room.cabides");
            case "logo" -> Msg.k("room.logo_das_portas");
            case "mirror" -> Msg.k("room.espelho");
            case "shoe" -> Msg.k("room.sapateira");
            case "bags" -> Msg.k("common.vitrine_de_bolsas");
            case "jewelry" -> Msg.k("room.porta_joias");
            case "island" -> Msg.k("room.ilha_central_bancada_de_looks");
            case "season" -> Msg.k("common.maleiro_de_estacao");
            case "signature" -> Msg.k("room.closet_de_assinatura");
            case "monogram" -> Msg.k("room.monograma");
            default -> null;
        };
    }

    /** Rótulo do módulo para exibir: layouts antigos guardaram o texto padrão já traduzido (pt-BR ou o idioma de quem criou) — vira texto adiado; rótulo personalizado fica como está. */
    static Object moduleLabel(Map<String, Object> module) {
        Object stored = module.get("label");
        String deferred = defaultModuleLabel(String.valueOf(module.get("id")));
        return deferred != null && (stored == null || Msg.matchesAnyLocale(deferred, String.valueOf(stored))) ? deferred : stored;
    }

    /** RF35 §5.3 — módulos do móvel por nível. O FAI Origem (Estreia) é propositalmente simples. */
    static List<Map<String, Object>> defaultModules(FaiPointsService.Level level) {
        Map<String, Object> white = Map.of("color", "#F4F2EF", "texture", "fosco", "roughness", 0.8);
        List<Map<String, Object>> mods = new ArrayList<>();
        for (int d = 1; d <= 4; d++) {
            mods.add(module("door:" + d, "DOOR", "PRT-AB60", 60, HANGERS_PER_DOOR, defaultModuleLabel("door:" + d), "FAI-PRT-AB60-WHT-FOS", white));
        }
        for (int n = 1; n <= 24; n++) {
            mods.add(module("drawer:" + n, "DRAWER", "GAV-STD", 0, DRAWER_CAPACITY, defaultModuleLabel("drawer:" + n), null, white));
        }
        mods.add(module("top", "TOP", null, 0, TOP_CAPACITY, defaultModuleLabel("top"), null, null));
        mods.add(module("base", "BASE", null, 0, BASE_CAPACITY, defaultModuleLabel("base"), null, null));
        mods.add(module("handles", "HANDLE", "PUX-CAV", 0, 0, defaultModuleLabel("handles"), null, Map.of("color", "#F4F2EF", "texture", "cava")));
        mods.add(module("light", "LIGHT", "LUZ-LED", 0, 0, defaultModuleLabel("light"), null, Map.of("kelvin", 4000, "guided", false)));
        mods.add(module("rug", "RUG", "TAP-RND", 0, 0, defaultModuleLabel("rug"), null, null));
        mods.add(module("hangers", "HANGER", "CAB-STD", 0, 0, defaultModuleLabel("hangers"), null, Map.of("color", "#6B5A4A", "texture", "madeira")));
        mods.add(module("logo", "LOGO", "LOG-PLC", 0, 0, defaultModuleLabel("logo"), null, null));
        // Smart Mirror (RF28) — módulo trocável na loja do quarto (retangular, arco, oval, camarim com luzes)
        mods.add(module("mirror", "MIRROR", "ESP-RET", 0, 0, defaultModuleLabel("mirror"), null,
                Map.of("color", "#6B4A2F", "texture", "madeira", "material", "MADEIRA", "roughness", 0.6, "metalness", 0.0)));
        if (level.atLeast(FaiPointsService.Level.LOFT)) {
            for (int d = 5; d <= 6; d++) {
                mods.add(module("door:" + d, "DOOR", "PRT-AB90", 90, HANGERS_PER_DOOR + 6, defaultModuleLabel("door:" + d), null, white));
            }
            for (int n = 25; n <= 36; n++) {
                mods.add(module("drawer:" + n, "DRAWER", "GAV-STD", 0, DRAWER_CAPACITY, defaultModuleLabel("drawer:" + n), null, white));
            }
        }
        if (level.atLeast(FaiPointsService.Level.CLOSET)) {
            mods.add(module("shoe", "SHOE_RACK", "SAP-MOD90", 90, SHOE_RACK_CAPACITY, defaultModuleLabel("shoe"), null, white));
            mods.add(module("bags", "BAG_DISPLAY", "VIT-BOL", 60, 8, defaultModuleLabel("bags"), null, null));
            mods.add(module("jewelry", "JEWELRY", "JOI-POR", 30, 12, defaultModuleLabel("jewelry"), null, null));
        }
        if (level.atLeast(FaiPointsService.Level.ATELIER)) {
            mods.add(module("island", "ISLAND", "ILH-BAN", 120, 3, defaultModuleLabel("island"), null, null));
        }
        if (level.atLeast(FaiPointsService.Level.PENTHOUSE)) {
            mods.add(module("season", "SEASON_STORAGE", null, 0, 60, defaultModuleLabel("season"), null, null));
        }
        if (level.atLeast(FaiPointsService.Level.MAISON)) {
            mods.add(module("signature", "SIGNATURE", null, 0, 0, defaultModuleLabel("signature"), null, null));
        }
        return mods;
    }

    public FaiPointsService.Level levelOf(UUID userId) {
        return FaiPointsService.Level.of(ledger.lifetime(userId));
    }

    @Override
    @Transactional
    public RoomLayout layout(UUID userId) {
        RoomLayout layout = layouts.findByUserId(userId).orElseGet(() -> {
            RoomLayout l = new RoomLayout();
            l.setUser(users.findById(userId).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario"))));
            l.setLevel(levelOf(userId).name());
            Map<String, Object> labels = new LinkedHashMap<>();
            Map<String, String> values = new LinkedHashMap<>();
            Map<String, String> sources = new LinkedHashMap<>();
            for (int i = 0; i < DEFAULT_DRAWER_LABELS.size(); i++) {
                values.put(String.valueOf(i + 1), DEFAULT_DRAWER_LABELS.get(i));
                sources.put(String.valueOf(i + 1), "DEFAULT");
            }
            labels.put("labels", values);
            labels.put("sources", sources);
            l.setDrawerLabelsJson(Json.write(labels));
            return l;
        });
        FaiPointsService.Level level = FaiPointsService.Level.valueOf(layout.getLevel());
        List<Map<String, Object>> existing = Json.list(layout.getModulesJson());
        Set<String> ids = existing.stream().map(m -> String.valueOf(m.get("id"))).collect(Collectors.toSet());
        boolean changed = false;
        for (Map<String, Object> m : defaultModules(level)) {
            if (!ids.contains(String.valueOf(m.get("id")))) {
                existing.add(m);
                changed = true;
            }
        }
        if (changed || layout.getModulesJson() == null) {
            layout.setModulesJson(Json.write(existing));
        }
        return layouts.save(layout);
    }

    List<Map<String, Object>> modules(RoomLayout layout) {
        return Json.list(layout.getModulesJson());
    }

    Optional<Map<String, Object>> module(RoomLayout layout, String id) {
        return modules(layout).stream().filter(m -> id.equals(String.valueOf(m.get("id")))).findFirst();
    }

    static int capacity(Map<String, Object> module) {
        return module.get("capacity") instanceof Number n ? n.intValue() : 0;
    }

    @SuppressWarnings("unchecked")
    Map<String, String> labels(RoomLayout layout) {
        Map<String, Object> root = Json.map(layout.getDrawerLabelsJson());
        Object v = root.get("labels");
        Map<String, String> sources = labelSources(layout);
        Map<String, String> out = new TreeMap<>((a, b) -> Integer.compare(Integer.parseInt(a), Integer.parseInt(b)));
        if (v instanceof Map<?, ?> m) {
            m.forEach((k, val) -> {
                if (val != null && !String.valueOf(val).isBlank()) {
                    String kind = "DEFAULT".equals(sources.getOrDefault(String.valueOf(k), "DEFAULT")) ? drawerKind(String.valueOf(val)) : null;
                    out.put(String.valueOf(k), kind == null ? String.valueOf(val) : DRAWER_KINDS.get(kind));   // rótulo padrão guardado em pt-BR volta no idioma de quem lê
                }
            });
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    Map<String, String> labelSources(RoomLayout layout) {
        Object v = Json.map(layout.getDrawerLabelsJson()).get("sources");
        Map<String, String> out = new HashMap<>();
        if (v instanceof Map<?, ?> m) {
            m.forEach((k, val) -> out.put(String.valueOf(k), String.valueOf(val)));
        }
        return out;
    }

    void saveLabels(RoomLayout layout, Map<String, String> labels, Map<String, String> sources) {
        layout.setDrawerLabelsJson(Json.write(Map.of("labels", labels, "sources", sources)));
    }

    // ------------------------------------------------------------------ RoomLayoutAccess (RF35)
    @Override
    @Transactional
    public void setLevel(UUID userId, String level) {
        RoomLayout l = layout(userId);
        l.setLevel(level);
        layouts.save(l);
        layout(userId); // mescla os módulos liberados pelo nível
    }

    @Override
    public List<String> compatibleModules(UUID userId, RoomCatalogItem item) {
        if ("WARDROBE".equals(item.getKind())) {
            return List.of("ALL");                               // guarda-roupa inteiro: cada bloco vai para todos os módulos do tipo
        }
        return modules(layout(userId)).stream()
                .filter(m -> item.getSlotType().equals(String.valueOf(m.get("slotType"))))
                .filter(m -> item.getWidthCm() == 0 || (m.get("widthCm") instanceof Number n && n.intValue() == item.getWidthCm()))
                .map(m -> String.valueOf(m.get("id")))
                .toList();
    }

    @Override
    @Transactional
    public void applyFinish(UUID userId, String moduleId, RoomCatalogItem item) {
        RoomLayout l = layout(userId);
        List<Map<String, Object>> mods = modules(l);
        if ("WARDROBE".equals(item.getKind())) {
            for (Map<String, Object> part : Json.list(item.getBundleJson())) {
                String slot = String.valueOf(part.get("slotType"));
                for (Map<String, Object> m : mods) {
                    if (slot.equals(String.valueOf(m.get("slotType")))) {
                        m.put("sku", item.getSku());
                        m.put("finish", part.get("finish"));
                        m.put("mold", part.get("moldId"));
                        m.put("rarity", item.getRarity());
                    }
                }
            }
            l.setModulesJson(Json.write(mods));
            layouts.save(l);
            return;
        }
        for (Map<String, Object> m : mods) {
            if (moduleId.equals(String.valueOf(m.get("id")))) {
                m.put("sku", item.getSku());
                m.put("finish", Json.map(item.getFinishJson()));
                m.put("mold", item.getMoldId());
                m.put("rarity", item.getRarity());
            }
        }
        l.setModulesJson(Json.write(mods));
        layouts.save(l);
    }

    /**
     * Luzes do closet (RF29): uma fileira de luzes por marco de faixa do FAI Inventory Score (Organizado → Maison Closet).
     * Cada faixa alcançada acende uma luz; a última acesa ganha a animação de conquista no espelho.
     */
    Map<String, Object> closetLights(UUID userId) {
        InventoryScoreService iss = inventoryScore.getIfAvailable();
        Integer score = null;
        String band = null;
        boolean eligible = false;
        if (iss != null) {
            try {
                InventoryScoreService.Result r = iss.compute(userId, true);
                score = r.score();
                band = r.band();
                eligible = r.eligible();
            } catch (RuntimeException e) {
                // a cena do quarto nunca quebra por causa da nota: sem nota, as luzes ficam apagadas
            }
        }
        int value = score == null ? 0 : score;
        List<Map<String, Object>> milestones = InventoryScoreService.BANDS.stream().skip(1)
                .map(b -> Map.<String, Object>of("at", b.min(), "label", b.label(), "lit", value >= b.min())).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("score", score);
        out.put("band", band);
        out.put("eligible", eligible);
        out.put("milestones", milestones);
        out.put("lit", milestones.stream().filter(m -> Boolean.TRUE.equals(m.get("lit"))).count());
        return out;
    }

    /** Iluminação guiada (nível Studio): temperatura de cor da luz do móvel, de 2700 K (quente) a 6500 K (fria). */
    @Transactional
    public Map<String, Object> setLight(CurrentUser user, int kelvin) {
        if (!levelOf(user.id()).atLeast(FaiPointsService.Level.STUDIO)) {
            throw new ApiException(409, "NIVEL_INSUFICIENTE", Msg.t("room.a_iluminacao_guiada_e_liberada"));
        }
        int k = Math.max(2700, Math.min(6500, kelvin));
        RoomLayout l = layout(user.id());
        List<Map<String, Object>> mods = modules(l);
        mods.stream().filter(m -> "light".equals(m.get("id"))).findFirst().ifPresent(m -> m.put("finish", Map.of("kelvin", k, "guided", true)));
        l.setModulesJson(Json.write(mods));
        layouts.save(l);
        return Map.of("kelvin", k, "guided", true);
    }

    /** DET-K03 — monograma nas portas a partir do Studio (até 3 iniciais em baixo-relevo). */
    @Transactional
    public Map<String, Object> setMonogram(CurrentUser user, String initials) {
        if (!levelOf(user.id()).atLeast(FaiPointsService.Level.STUDIO)) {
            throw new ApiException(409, "NIVEL_INSUFICIENTE", Msg.t("room.o_monograma_e_liberado_no"));
        }
        String clean = InputSanitizer.clean(initials == null ? "" : initials, 3).toUpperCase(Locale.ROOT).replaceAll("[^A-Z]", "");
        RoomLayout l = layout(user.id());
        List<Map<String, Object>> mods = modules(l).stream().filter(m -> !"monogram".equals(m.get("id"))).collect(Collectors.toCollection(ArrayList::new));
        if (!clean.isEmpty()) {
            Map<String, Object> m = module("monogram", "MONOGRAM", null, 0, 0, defaultModuleLabel("monogram"), null, null);
            m.put("initials", clean);
            mods.add(m);
        }
        l.setModulesJson(Json.write(mods));
        layouts.save(l);
        return Map.of("initials", clean);
    }

    // ================================================================== endereçamento (§1.1) e atribuição automática (CA02)
    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static boolean occHas(WardrobeItem w, String... codes) {
        List<String> occ = Json.csv(w.getOccasionTags());
        for (String c : codes) {
            if (occ.contains(c)) {
                return true;
            }
        }
        return false;
    }

    /** Categoria de gaveta preferida por tipo/tags (§1.1) — null = qualquer gaveta livre. */
    static String preferredDrawerLabel(WardrobeItem w) {
        String cat = nz(w.getCategory());
        String sub = nz(w.getSubcategory());
        if (cat.equals("accessory_piece")) {
            return DRAWER_KINDS.get(INTIMATES.contains(sub) ? "intimas" : "acessorios");
        }
        if (DENIM.contains(sub)) {
            return DRAWER_KINDS.get("jeans");
        }
        if (GYM.contains(sub) || occHas(w, "sport", "gym")) {
            return DRAWER_KINDS.get("academia");
        }
        if (occHas(w, "beach")) {
            return DRAWER_KINDS.get("praia");
        }
        return null;
    }

    /** Categoria padrão da gaveta (jeans, academia, praia, acessorios, intimas, favoritas) pelo rótulo — em qualquer idioma ou como texto adiado; null = rótulo livre. */
    static String drawerKind(String label) {
        if (label == null || label.isBlank()) {
            return null;
        }
        for (Map.Entry<String, String> e : DRAWER_KINDS.entrySet()) {
            for (Locale l : Msg.SUPPORTED) {
                if (Msg.resolve(l, e.getValue()).equalsIgnoreCase(Msg.resolve(l, label.trim()))) {
                    return e.getKey();
                }
            }
        }
        return null;
    }

    /** RF32.CA02 / RF34 §3.5 — o endereço é coerente com o tipo e com a categoria da gaveta? */
    public static boolean coherent(WardrobeItem w, RoomAddress a, Map<String, String> labels) {
        String cat = nz(w.getCategory());
        String sub = nz(w.getSubcategory());
        return switch (a.zone()) {
            case "door" -> cat.equals("upper_piece") || cat.equals("full_body_piece");
            case "drawer" -> {
                if (!(cat.equals("lower_piece") || cat.equals("accessory_piece"))) {
                    yield false;
                }
                String label = labels.get(String.valueOf(a.index()));
                if (label == null) {
                    yield true;
                }
                String kind = drawerKind(label);
                yield kind == null || switch (kind) {
                    case "jeans" -> DENIM.contains(sub);
                    case "academia" -> GYM.contains(sub) || occHas(w, "sport", "gym");
                    case "praia" -> occHas(w, "beach");
                    case "acessorios" -> cat.equals("accessory_piece");
                    case "intimas" -> INTIMATES.contains(sub);
                    case "favoritas" -> w.isFavorite();
                    default -> true;
                };
            }
            case "base", "shoe" -> cat.equals("shoes_piece");
            case "bags" -> BAGS.contains(sub);
            case "jewelry" -> JEWELRY.contains(sub);
            default -> true; // cadeira, maleiro de estação: nunca penalizam
        };
    }

    private record Occupancy(Set<String> taken, Map<String, Integer> drawerCount) {
        static Occupancy of(Collection<RoomStorageEntry> entries) {
            Set<String> taken = new HashSet<>();
            Map<String, Integer> drawers = new HashMap<>();
            for (RoomStorageEntry e : entries) {
                taken.add(e.getAddress());
                RoomAddress.parse(e.getAddress()).filter(a -> a.zone().equals("drawer"))
                        .ifPresent(a -> drawers.merge(String.valueOf(a.index()), 1, Integer::sum));
            }
            return new Occupancy(taken, drawers);
        }

        void add(RoomAddress a) {
            taken.add(a.toString());
            if (a.zone().equals("drawer")) {
                drawerCount.merge(String.valueOf(a.index()), 1, Integer::sum);
            }
        }
    }

    private Optional<RoomAddress> freeIn(RoomLayout layout, String moduleId, String zone, Occupancy occ) {
        return module(layout, moduleId).flatMap(m -> {
            for (int k = 1; k <= capacity(m); k++) {
                RoomAddress a = RoomAddress.of(zone, k);
                if (!occ.taken().contains(a.toString())) {
                    return Optional.of(a);
                }
            }
            return Optional.empty();
        });
    }

    private Optional<RoomAddress> freeHanger(RoomLayout layout, int door, Occupancy occ) {
        return module(layout, "door:" + door).flatMap(m -> {
            for (int k = 1; k <= capacity(m); k++) {
                RoomAddress a = RoomAddress.door(door, k);
                if (!occ.taken().contains(a.toString())) {
                    return Optional.of(a);
                }
            }
            return Optional.empty();
        });
    }

    /** Mesma categoria de gaveta? Pela categoria padrão (qualquer idioma) e, sem ela, pelo texto. */
    static boolean sameDrawer(String a, String b) {
        String ka = drawerKind(a);
        return ka != null ? ka.equals(drawerKind(b)) : Msg.resolve(a).equalsIgnoreCase(Msg.resolve(b));
    }

    private Optional<RoomAddress> freeDrawer(RoomLayout layout, Map<String, String> labels, Occupancy occ, String preferred,
                                             boolean allowSpecial) {
        List<Map<String, Object>> drawers = modules(layout).stream().filter(m -> "DRAWER".equals(m.get("slotType"))).toList();
        // 1) gaveta com a categoria preferida; 2) gaveta sem rótulo; 3) qualquer gaveta que não seja de categoria especial
        for (int pass = 0; pass < 3; pass++) {
            for (Map<String, Object> m : drawers) {
                String idx = String.valueOf(m.get("id")).substring("drawer:".length());
                String label = labels.get(idx);
                boolean ok = switch (pass) {
                    case 0 -> preferred != null && label != null && sameDrawer(label, preferred);
                    case 1 -> label == null;
                    default -> allowSpecial || label == null || drawerKind(label) == null;   // gaveta de categoria padrão só recebe o que combina com ela
                };
                if (ok && occ.drawerCount().getOrDefault(idx, 0) < capacity(m)) {
                    return Optional.of(RoomAddress.of("drawer", Integer.parseInt(idx)));
                }
            }
        }
        return Optional.empty();
    }

    /** Posição automática coerente com o tipo (CA02); sem posição livre → Cadeira (CA07). */
    RoomAddress place(WardrobeItem w, RoomLayout layout, Map<String, String> labels, Occupancy occ) {
        String cat = nz(w.getCategory());
        String sub = nz(w.getSubcategory());
        Optional<RoomAddress> found = Optional.empty();
        switch (cat) {
            case "upper_piece", "full_body_piece" -> {
                int pref = cat.equals("full_body_piece") ? 4 : OUTERWEAR.contains(sub) ? 3 : KNITWEAR.contains(sub) ? 2 : 1;
                List<Integer> order = new ArrayList<>(List.of(pref));
                for (int d = 1; d <= 6; d++) {
                    if (d != pref) {
                        order.add(d);
                    }
                }
                for (int d : order) {
                    found = freeHanger(layout, d, occ);
                    if (found.isPresent()) {
                        break;
                    }
                }
            }
            case "shoes_piece" -> {
                found = freeIn(layout, "shoe", "shoe", occ);
                if (found.isEmpty()) {
                    found = freeIn(layout, "base", "base", occ);
                }
            }
            case "accessory_piece" -> {
                if (BAGS.contains(sub)) {
                    found = freeIn(layout, "bags", "bags", occ);
                } else if (JEWELRY.contains(sub)) {
                    found = freeIn(layout, "jewelry", "jewelry", occ);
                }
                if (found.isEmpty()) {
                    found = freeDrawer(layout, labels, occ, preferredDrawerLabel(w), false);
                }
            }
            default -> found = freeDrawer(layout, labels, occ, preferredDrawerLabel(w), false);
        }
        if (found.isEmpty()) {
            found = freeDrawer(layout, labels, occ, null, true);
        }
        RoomAddress a = found.orElseGet(() -> {
            int n = 1;
            while (occ.taken().contains("chair:" + n)) {
                n++;
            }
            return RoomAddress.of("chair", n);
        });
        occ.add(a);
        return a;
    }

    /** Garante que toda peça do acervo tem endereço (peças anteriores ao quarto recebem posição automática). */
    @Transactional
    public List<RoomStorageEntry> entries(UUID userId, List<WardrobeItem> all) {
        RoomLayout layout = layout(userId);
        List<RoomStorageEntry> entries = new ArrayList<>(storage.findByUserId(userId));
        Set<UUID> known = entries.stream().map(RoomStorageEntry::getWardrobeItemId).collect(Collectors.toSet());
        Set<UUID> alive = all.stream().map(WardrobeItem::getId).collect(Collectors.toSet());
        entries.removeIf(e -> {
            if (!alive.contains(e.getWardrobeItemId())) {
                storage.delete(e);
                return true;
            }
            return false;
        });
        Occupancy occ = Occupancy.of(entries);
        Map<String, String> labels = labels(layout);
        for (WardrobeItem w : all) {
            if (!known.contains(w.getId())) {
                RoomStorageEntry e = new RoomStorageEntry();
                e.setUserId(userId);
                e.setWardrobeItemId(w.getId());
                e.setAddress(place(w, layout, labels, occ).toString());
                e.setAssignedBy("AUTO");
                entries.add(storage.save(e));
            }
        }
        return entries;
    }

    @Transactional
    public RoomAddress autoAssign(UUID userId, UUID pieceId) {
        WardrobeItem w = pieces.findById(pieceId).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        RoomLayout layout = layout(userId);
        Optional<RoomStorageEntry> existing = storage.findByWardrobeItemId(pieceId);
        if (existing.isPresent()) {
            return RoomAddress.parse(existing.get().getAddress()).orElseThrow();
        }
        Occupancy occ = Occupancy.of(storage.findByUserId(userId));
        RoomAddress a = place(w, layout, labels(layout), occ);
        RoomStorageEntry e = new RoomStorageEntry();
        e.setUserId(userId);
        e.setWardrobeItemId(pieceId);
        e.setAddress(a.toString());
        e.setAssignedBy("AUTO");
        storage.save(e);
        return a;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPieceCreated(DomainEvents.PieceCreated ev) {
        // o quarto nunca bloqueia o cadastro (CA07): endereço automático depois do commit, em transação própria
        sideEffects.run("quarto:PieceCreated", () -> autoAssign(ev.userId(), ev.pieceId()));
    }

    @EventListener
    @Transactional
    public void onPieceDeleted(DomainEvents.PieceDeleted ev) {
        storage.deleteByWardrobeItemId(ev.pieceId());
    }

    /** Endereço de uma peça (Copilot RF10.CA09, Vista-me RF33.CA10). */
    @Transactional
    public Optional<Location> locate(UUID userId, UUID pieceId) {
        RoomLayout layout = layout(userId);
        Map<String, String> labels = labels(layout);
        return storage.findByWardrobeItemId(pieceId).filter(e -> e.getUserId().equals(userId))
                .flatMap(e -> RoomAddress.parse(e.getAddress()))
                .or(() -> pieces.findById(pieceId).filter(w -> w.getUser().getId().equals(userId)).map(w -> autoAssign(userId, pieceId)))
                .map(a -> new Location(a, a.label(labels), a.moduleId()));
    }

    public Map<UUID, Location> locateAll(UUID userId) {
        RoomLayout layout = layout(userId);
        Map<String, String> labels = labels(layout);
        Map<UUID, Location> out = new HashMap<>();
        for (RoomStorageEntry e : storage.findByUserId(userId)) {
            RoomAddress.parse(e.getAddress()).ifPresent(a -> out.put(e.getWardrobeItemId(), new Location(a, a.label(labels), a.moduleId())));
        }
        return out;
    }

    /** Peças guardadas fora de estação (Penthouse) — o Vista-me as ignora (RF35 §5.3). */
    public Set<UUID> outOfSeason(UUID userId) {
        return storage.findByUserId(userId).stream().filter(e -> e.getAddress().startsWith("season:"))
                .map(RoomStorageEntry::getWardrobeItemId).collect(Collectors.toSet());
    }

    // ================================================================== visão do quarto (CA01, CA06, CA10)
    private static String period(LocalDateTime now) {
        int h = now.getHour();
        return h < 6 ? "night" : h < 11 ? "morning" : h < 17 ? "afternoon" : h < 20 ? "golden" : "night";
    }

    private static String seasonalDecoration(LocalDate d) {
        return switch (d.getMonthValue()) {
            case 6 -> "festa_junina";
            case 12 -> "fim_de_ano";
            case 4 -> "fashion_revolution_week";
            default -> null;
        };
    }

    public Set<UUID> usedRecently(UUID userId, LocalDate since) {
        return diary.findByUserIdAndUsedOnAfter(userId, since).stream().map(PieceUsageDiaryEntry::getWardrobeItemId).collect(Collectors.toSet());
    }

    /** Última data de uso conhecida (diário + lastWornDate); null = nunca usada. */
    public static LocalDate lastUse(WardrobeItem w, Map<UUID, LocalDate> lastDiary) {
        LocalDate d = lastDiary.get(w.getId());
        LocalDate worn = w.getLastWornDate();
        if (d == null) {
            return worn;
        }
        return worn == null || d.isAfter(worn) ? d : worn;
    }

    public static boolean forgotten(WardrobeItem w, LocalDate last, LocalDate today) {
        LocalDate ref = last != null ? last : w.getCreatedAt() == null ? today : LocalDate.ofInstant(w.getCreatedAt(), ZONE);
        return w.isDisponivel() && w.getAvailabilityStatus() == AvailabilityStatus.AVAILABLE
                && ChronoUnit.DAYS.between(ref, today) >= FORGOTTEN_DAYS;
    }

    public Map<UUID, LocalDate> lastDiaryDates(UUID userId, LocalDate since) {
        Map<UUID, LocalDate> out = new HashMap<>();
        for (PieceUsageDiaryEntry e : diary.findByUserIdAndUsedOnAfter(userId, since)) {
            out.merge(e.getWardrobeItemId(), e.getUsedOn(), (a, b) -> a.isAfter(b) ? a : b);
        }
        return out;
    }

    Map<String, Object> pieceSummary(WardrobeItem w, RoomAddress a, Map<String, String> labels, boolean owner, Set<String> states) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", w.getId());
        m.put("name", w.getName());
        m.put("category", w.getCategory());
        m.put("subcategory", w.getSubcategory());
        m.put("color", w.getColor());
        m.put("colorHex", Taxonomy.hex(w.getColor()));
        m.put("imageUrl", w.getImageUrl());
        m.put("thumbnailUrl", w.getThumbnailUrl());
        m.put("model3dUrl", w.getModel3dUrl());
        m.put("address", a == null ? null : a.toString());
        m.put("addressLabel", a == null ? null : a.label(labels));
        m.put("moduleId", a == null ? null : a.moduleId());
        m.put("states", states);
        m.put("wearCount", w.getWearCount());
        m.put("origin", w.getPieceOrigin());
        if (w.isForSale() && w.getPrice() != null) {
            m.put("salePrice", w.getPrice());                 // etiqueta de preço na Arara do Desapego (peça à venda é pública)
        }
        if (owner) {
            m.put("costPerUse", w.getPrice() != null && w.getWearCount() > 0
                    ? w.getPrice().divide(BigDecimal.valueOf(w.getWearCount()), 2, RoundingMode.HALF_UP) : null);
        }
        return m;
    }

    Set<String> statesOf(WardrobeItem w, RoomAddress a, LocalDate today, Map<UUID, LocalDate> lastDiary, Set<UUID> dailyLookPieces,
                         String iconPieceName) {
        Set<String> s = new java.util.LinkedHashSet<>();
        boolean unavailable = !w.isDisponivel() || w.getAvailabilityStatus() != AvailabilityStatus.AVAILABLE;
        if (unavailable) {
            s.add("INDISPONIVEL");
        } else if (forgotten(w, lastUse(w, lastDiary), today)) {
            s.add("ESQUECIDA");
        }
        if (w.isFavorite()) {
            s.add("FAVORITA");
        }
        if (iconPieceName != null && w.getName() != null && w.getName().equalsIgnoreCase(iconPieceName)) {
            s.add("ICONE");
        }
        if (w.isForSale()) {
            s.add("A_VENDA");
        }
        if (dailyLookPieces.contains(w.getId())) {
            s.add("LOOK_DO_DIA");
        }
        if (a != null && a.zone().equals("chair")) {
            s.add("CADEIRA");
        }
        if (a != null && a.zone().equals("season")) {
            s.add("FORA_DE_ESTACAO");
        }
        if (w.getImageUrl() == null || w.getPhotoProcessingStatus() == PhotoProcessingStatus.NEEDS_REUPLOAD
                || w.getPhotoProcessingStatus() == PhotoProcessingStatus.FAILED) {
            s.add("CROQUI");
        }
        if (w.getWearCount() >= 30) {
            s.add("30_USOS");
        }
        if ("GARIMPADA".equalsIgnoreCase(w.getPieceOrigin())) {
            s.add("GARIMPO");
        }
        return s;
    }

    private Set<UUID> dailyLookPieces(UUID userId, LocalDate today) {
        return dailyLooks.findByUserIdAndLookDate(userId, today)
                .map(dl -> schemeItems.findBySchemeIdOrderBySortOrder(dl.getScheme().getId()).stream()
                        .map(si -> si.getWardrobeItem().getId()).collect(Collectors.toSet()))
                .orElse(Set.of());
    }

    @Transactional
    public Map<String, Object> room(CurrentUser user) {
        return render(user.id(), true);
    }

    /** DET-K05 — Room Tour: quem tem a Chave do Quarto visita a versão pública (sem estados nem preços, ETI-04). */
    @Transactional
    public Map<String, Object> tour(CurrentUser viewer, UUID ownerId) {
        if (!viewer.id().equals(ownerId) && !keys(layout(ownerId)).contains(viewer.id().toString())) {
            throw guard.deny(viewer, "room:" + ownerId, Msg.t("room.voce_precisa_da_chave_do"));
        }
        return render(ownerId, viewer.id().equals(ownerId));
    }

    @SuppressWarnings("unchecked")
    List<String> keys(RoomLayout layout) {
        return module(layout, "keys").map(m -> m.get("users") instanceof List<?> l ? l.stream().map(String::valueOf).toList() : List.<String>of())
                .orElse(List.of());
    }

    @Transactional
    public Map<String, Object> giveKey(CurrentUser user, UUID guestId) {
        if (guestId.equals(user.id())) {
            throw ApiException.badRequest("CHAVE_INVALIDA", Msg.t("room.a_chave_e_para_outra"));
        }
        users.findById(guestId).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        RoomLayout l = layout(user.id());
        List<Map<String, Object>> mods = modules(l);
        Map<String, Object> keysModule = mods.stream().filter(m -> "keys".equals(m.get("id"))).findFirst().orElseGet(() -> {
            Map<String, Object> m = module("keys", "KEYS", null, 0, 0, Msg.t("room.chaves_do_quarto"), null, null);
            mods.add(m);
            return m;
        });
        Set<String> set = new java.util.LinkedHashSet<>(keysModule.get("users") instanceof List<?> lst ? lst.stream().map(String::valueOf).toList() : List.of());
        set.add(guestId.toString());
        keysModule.put("users", new ArrayList<>(set));
        l.setModulesJson(Json.write(mods));
        layouts.save(l);
        return Map.of("keys", set);
    }

    /** Quem me deu a chave (convites para desafios, RF36.CA04). */
    public boolean hasKey(UUID ownerId, UUID guestId) {
        return keys(layout(ownerId)).contains(guestId.toString());
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> render(UUID userId, boolean owner) {
        LocalDate today = LocalDate.now(ZONE);
        RoomLayout layout = layout(userId);
        Map<String, String> labels = labels(layout);
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(userId);
        if (!owner) {
            all = all.stream().filter(w -> w.getVisibility() == Visibility.PUBLIC).toList();
        }
        List<RoomStorageEntry> entries = entries(userId, pieces.findByUserIdOrderByCreatedAtDesc(userId));
        Map<UUID, RoomAddress> addr = new HashMap<>();
        for (RoomStorageEntry e : entries) {
            RoomAddress.parse(e.getAddress()).ifPresent(a -> addr.put(e.getWardrobeItemId(), a));
        }
        Map<UUID, LocalDate> lastDiary = owner ? lastDiaryDates(userId, today.minusDays(FORGOTTEN_DAYS + 1L)) : Map.of();
        Set<UUID> dailyPieces = owner ? dailyLookPieces(userId, today) : Set.of();
        String icon = dnas.findByUserId(userId).map(d -> d.getIconPieceName()).orElse(null);

        Map<String, List<Map<String, Object>>> byModule = new LinkedHashMap<>();
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        List<Map<String, Object>> basket = new ArrayList<>();
        List<Map<String, Object>> saleRack = new ArrayList<>();
        List<Map<String, Object>> showcase = new ArrayList<>();
        List<Map<String, Object>> chair = new ArrayList<>();
        int forgottenCount = 0;
        for (WardrobeItem w : all) {
            RoomAddress a = addr.get(w.getId());
            Set<String> states = owner ? statesOf(w, a, today, lastDiary, dailyPieces, icon) : Set.of();
            Map<String, Object> summary = pieceSummary(w, a, labels, owner, states);
            byId.put(w.getId().toString(), summary);
            if (states.contains("ESQUECIDA")) {
                forgottenCount++;
            }
            if (states.contains("INDISPONIVEL")) {
                basket.add(summary);
            }
            if (states.contains("A_VENDA")) {
                saleRack.add(summary);
            }
            if (states.contains("ICONE")) {
                showcase.add(summary);
            }
            if (a != null && a.zone().equals("chair")) {
                chair.add(summary);
            }
            String moduleId = a == null ? "chair" : a.moduleId();
            byModule.computeIfAbsent(moduleId, k -> new ArrayList<>()).add(summary);
        }

        List<Map<String, Object>> modules = new ArrayList<>();
        for (Map<String, Object> m : modules(layout)) {
            String id = String.valueOf(m.get("id"));
            Map<String, Object> view = new LinkedHashMap<>(m);
            Object moduleLabel = moduleLabel(m);
            view.put("label", moduleLabel);
            List<Map<String, Object>> content = byModule.getOrDefault(id, List.of());
            String slot = String.valueOf(m.get("slotType"));
            if (slot.equals("DRAWER")) {
                String idx = id.substring("drawer:".length());
                String label = labels.get(idx);
                view.put("label", label == null ? defaultModuleLabel(id) : label);
                view.put("category", label);
                view.put("labelSource", labelSources(layout).getOrDefault(idx, label == null ? null : "DEFAULT"));
                view.put("accessibleLabel", defaultModuleLabel(id) + (label == null ? "" : ", " + label) + ", " + content.size()
                        + (content.size() == 1 ? Msg.t("room.peca") : Msg.t("room.pecas")));
                view.put("empty", content.isEmpty());
                view.put("emptyCharm", content.isEmpty() ? Map.of("props", List.of("sache_lavanda", "meia_sem_par"),
                        "action", Msg.t("room.adicionar_peca_a_esta_gaveta")) : null);
            } else if (slot.equals("DOOR")) {
                int cap = capacity(m);
                List<Map<String, Object>> hangers = new ArrayList<>();
                for (int k = 1; k <= cap; k++) {
                    String hangerAddr = id + "/hanger:" + k;
                    Map<String, Object> piece = content.stream().filter(p -> hangerAddr.equals(p.get("address"))).findFirst().orElse(null);
                    hangers.add(Map.of("k", k, "address", hangerAddr, "pieceId", piece == null ? "" : String.valueOf(piece.get("id"))));
                }
                view.put("hangers", hangers);
                view.put("accessibleLabel", Msg.t("room.pecas_2", moduleLabel, content.size()));
            } else if (slot.equals("TOP")) {
                List<Scheme> boxes = owner ? schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(userId, SchemeStatus.ARCHIVED)
                        : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(userId, SchemeStatus.ARCHIVED).stream()
                        .filter(s -> s.getVisibility() == Visibility.PUBLIC && s.getStatus() == SchemeStatus.PUBLISHED).toList();
                view.put("lookBoxes", boxes.stream().limit(capacity(m)).map(s -> Map.of("id", s.getId(), "title", String.valueOf(s.getTitle()),
                        "coverImageUrl", String.valueOf(s.getCoverImageUrl()), "cardSkin", String.valueOf(s.getCardSkin()),
                        "lookDoDia", s.isLookDoDia())).toList());
                view.put("totalLooks", boxes.size());
                view.put("accessibleLabel", Msg.t("room.maleiro_caixas_de_look", boxes.size()));
            } else {
                view.put("accessibleLabel", moduleLabel + ", " + content.size() + (content.size() == 1 ? Msg.t("room.peca") : Msg.t("room.pecas")));
            }
            view.put("pieces", content);
            view.put("count", content.size());
            modules.add(view);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("owner", owner);
        out.put("level", layout.getLevel());
        out.put("levelInfo", Map.of("unlocks", FaiPointsService.Level.valueOf(layout.getLevel()).unlocks,
                "aesthetic", FaiPointsService.Level.valueOf(layout.getLevel()).aesthetic));
        out.put("modules", modules);
        out.put("drawerLabels", labels);
        out.put("pieces", byId);
        out.put("basket", basket);
        out.put("saleRack", Map.of("name", Msg.t("room.arara_do_desapego"), "pieces", saleRack));
        out.put("showcase", showcase);
        out.put("chair", chair);
        out.put("capacity", Map.of("pieces", all.size(), "positions", positions(layout), "overflow", chair.size()));
        out.put("forgottenCount", forgottenCount);
        if (owner) {
            DailyLook dl = dailyLooks.findByUserIdAndLookDate(userId, today).orElse(null);
            out.put("mirrorDailyLook", dl == null ? null : Map.of("schemeId", dl.getScheme().getId(), "title", String.valueOf(dl.getScheme().getTitle()),
                    "coverImageUrl", String.valueOf(dl.getScheme().getCoverImageUrl()), "pieceIds", dailyPieces));
            List<UserAchievement> recent = achievements.findByUserIdOrderByGrantedAtDesc(userId).stream()
                    .filter(a -> a.getGrantedAt().isAfter(Instant.now().minus(1, ChronoUnit.DAYS))).toList();
            out.put("celebrations", recent.stream().map(a -> Map.of("code", a.getAchievementCode(), "secret", a.isSecret(),
                    "grantedAt", a.getGrantedAt())).toList());
            List<Map<String, Object>> decos = new ArrayList<>();
            decorations.orderedStream().forEach(p -> decos.addAll(p.decorations(userId)));
            out.put("decorations", decos);
            boolean reduceMotion = preferences.findByUserId(userId).map(p -> p.isReduceMotion()).orElse(false);
            boolean sound = preferences.findByUserId(userId).map(p -> p.isSoundEnabled()).orElse(false);
            boolean haptics = preferences.findByUserId(userId).map(p -> p.isHapticsEnabled()).orElse(true);
            LocalDateTime now = LocalDateTime.now(ZONE);
            out.put("ambient", Map.of("period", reduceMotion ? "fixed" : period(now), "seasonal", String.valueOf(seasonalDecoration(today)),
                    "reduceMotion", reduceMotion, "sound", sound, "haptics", haptics));
            out.put("monogram", module(layout, "monogram").map(m -> String.valueOf(m.get("initials"))).orElse(null));
            out.put("closetLights", closetLights(userId));
            out.put("unboxing", roomInventory.findByUserId(userId).stream().filter(i -> i.getAppliedModule() == null)
                    .sorted(Comparator.comparing(RoomInventoryItem::getAcquiredAt, Comparator.nullsLast(Comparator.reverseOrder()))).limit(6)
                    .map(i -> Map.of("inventoryId", i.getId(), "sku", i.getSku(), "name", roomCatalog.findById(i.getSku()).map(RoomCatalogItem::getName).orElse(i.getSku()),
                            "slotType", roomCatalog.findById(i.getSku()).map(RoomCatalogItem::getSlotType).orElse(""))).toList());
            List<UUID> keyIds = keys(layout).stream().map(UUID::fromString).toList();
            out.put("keys", users.findAllById(keyIds).stream().map(Views::user).toList());
            out.put("light", module(layout, "light").map(m -> m.get("finish")).orElse(Map.of("kelvin", 4000, "guided", false)));
        }
        out.put("camera", Map.of("preset", "editorial_3_4", "azimuth", List.of(-35, 35), "polar", List.of(55, 80), "zoom", List.of(0.8, 1.6),
                "free", false));
        out.put("render", Map.of("preferred", "3d", "fallback", "2.5d", "note", Msg.t("room.sem_webgl_ou_abaixo_do")));
        out.put("photoMode", Map.of("framings", List.of("frontal", "tres_quartos", "detalhe_espelho", "gaveta_aberta"),
                "filters", List.of("editorial", "quente", "pb"), "depthOfField", true, "exportWithoutUi", true));
        return out;
    }

    int positions(RoomLayout layout) {
        return modules(layout).stream().filter(m -> Set.of("DOOR", "DRAWER", "BASE", "SHOE_RACK", "BAG_DISPLAY", "JEWELRY")
                .contains(String.valueOf(m.get("slotType")))).mapToInt(RoomService::capacity).sum();
    }

    /** RF32.CA10 — alternativa em lista com as mesmas ações. */
    @Transactional
    public List<Map<String, Object>> listView(CurrentUser user) {
        Map<String, Object> room = render(user.id(), true);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> m : (List<Map<String, Object>>) room.get("modules")) {
            if (capacity(m) == 0 && !"TOP".equals(m.get("slotType"))) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("moduleId", m.get("id"));
            row.put("label", m.get("accessibleLabel"));
            row.put("count", m.get("count"));
            row.put("pieces", m.get("pieces"));
            row.put("actions", List.of("abrir", "levar_ao_espelho", "mover", "renomear"));
            out.add(row);
        }
        List<Map<String, Object>> chair = (List<Map<String, Object>>) room.get("chair");
        if (!chair.isEmpty()) {
            out.add(Map.of("moduleId", "chair", "label", Msg.t("room.cadeira_pecas_excedentes", chair.size()), "count", chair.size(),
                    "pieces", chair, "actions", List.of("abrir", "mover")));
        }
        return out;
    }

    // ================================================================== ações (CA03/CA04/CA09)
    private WardrobeItem owned(CurrentUser user, UUID pieceId) {
        WardrobeItem w = pieces.findById(pieceId).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        guard.requireOwner(user, w.getUser().getId(), "piece:" + pieceId);
        return w;
    }

    /** Conteúdo de uma porta/gaveta/posição (CA03). */
    @Transactional
    public Map<String, Object> open(CurrentUser user, String moduleId) {
        Map<String, Object> room = render(user.id(), true);
        @SuppressWarnings("unchecked") List<Map<String, Object>> modules = (List<Map<String, Object>>) room.get("modules");
        return modules.stream().filter(m -> moduleId.equals(String.valueOf(m.get("id")))).findFirst()
                .orElseThrow(() -> ApiException.notFound(Msg.t("room.modulo")));
    }

    @Transactional
    public Map<String, Object> move(CurrentUser user, UUID pieceId, String rawAddress) {
        WardrobeItem w = owned(user, pieceId);
        RoomAddress a = RoomAddress.parse(rawAddress).orElseThrow(() -> ApiException.badRequest("ENDERECO_INVALIDO",
                Msg.t("room.endereco_invalido_use_door_n")));
        RoomLayout layout = layout(user.id());
        if (!a.zone().equals("chair")) {
            Map<String, Object> module = module(layout, a.moduleId()).orElseThrow(() -> new ApiException(409, "MODULO_INDISPONIVEL",
                    Msg.t("room.este_modulo_nao_existe_no", layout.getLevel())));
            int cap = capacity(module);
            int pos = a.zone().equals("door") ? a.sub() : a.index();
            if (a.zone().equals("drawer")) {
                long count = storage.findByUserId(user.id()).stream().filter(e -> !e.getWardrobeItemId().equals(pieceId))
                        .filter(e -> e.getAddress().equals(a.toString())).count();
                if (count >= cap) {
                    throw new ApiException(409, "GAVETA_CHEIA", Msg.t("room.a_gaveta_ja_tem_pecas", a.index(), cap));
                }
            } else if (pos < 1 || pos > cap) {
                throw ApiException.badRequest("POSICAO_INVALIDA", Msg.t("room.a_posicao_vai_de_1", cap));
            } else {
                boolean taken = storage.findByUserId(user.id()).stream().filter(e -> !e.getWardrobeItemId().equals(pieceId))
                        .anyMatch(e -> e.getAddress().equals(a.toString()));
                if (taken) {
                    throw new ApiException(409, "POSICAO_OCUPADA", Msg.t("room.ja_existe_uma_peca_nesta"));
                }
            }
        }
        RoomStorageEntry e = storage.findByWardrobeItemId(pieceId).orElseGet(() -> {
            RoomStorageEntry n = new RoomStorageEntry();
            n.setUserId(user.id());
            n.setWardrobeItemId(pieceId);
            return n;
        });
        e.setAddress(a.toString());
        e.setAssignedBy("USER");
        storage.save(e);
        Map<String, String> labels = labels(layout);
        return Map.of("pieceId", pieceId, "address", a.toString(), "label", a.label(labels), "moduleId", a.moduleId(),
                "coherent", coherent(w, a, labels));
    }

    @Transactional
    public Map<String, String> renameDrawer(CurrentUser user, int drawer, String label) {
        RoomLayout layout = layout(user.id());
        module(layout, "drawer:" + drawer).orElseThrow(() -> ApiException.notFound(Msg.t("entity.gaveta")));
        Map<String, String> labels = labels(layout);
        Map<String, String> sources = labelSources(layout);
        String clean = InputSanitizer.clean(label == null ? "" : label, 24);
        if (clean.isBlank()) {
            labels.remove(String.valueOf(drawer));
            sources.remove(String.valueOf(drawer));
        } else {
            labels.put(String.valueOf(drawer), clean);
            sources.put(String.valueOf(drawer), "USER");
        }
        saveLabels(layout, labels, sources);
        layouts.save(layout);
        events.publishEvent(new DomainEvents.RoomOrganized(user.id()));
        return labels;
    }

    /** RF32.CA09 — "Mostrar no quarto": endereço + enquadramento da câmera + destaque com iluminação. */
    @Transactional
    public Map<String, Object> showInRoom(CurrentUser user, UUID pieceId) {
        owned(user, pieceId);
        Location loc = locate(user.id(), pieceId).orElseThrow(() -> ApiException.notFound(Msg.t("room.posicao")));
        return Map.of("pieceId", pieceId, "address", loc.address().toString(), "label", loc.label(), "moduleId", loc.moduleId(),
                "camera", Map.of("target", loc.moduleId(), "highlight", loc.address().toString(), "lighting", "spot", "open", true));
    }

    /** Penthouse — guardar/retirar peças do maleiro de estação (RF35 §5.3). */
    @Transactional
    public Map<String, Object> seasonStorage(CurrentUser user, List<UUID> pieceIds, boolean store) {
        if (!levelOf(user.id()).atLeast(FaiPointsService.Level.PENTHOUSE)) {
            throw new ApiException(409, "NIVEL_INSUFICIENTE", Msg.t("room.a_troca_de_estacao_e"));
        }
        RoomLayout layout = layout(user.id());
        Map<String, String> labels = labels(layout);
        List<RoomStorageEntry> entries = storage.findByUserId(user.id());
        Occupancy occ = Occupancy.of(entries);
        int moved = 0;
        for (UUID id : pieceIds) {
            WardrobeItem w = owned(user, id);
            RoomStorageEntry e = entries.stream().filter(x -> x.getWardrobeItemId().equals(id)).findFirst().orElse(null);
            if (e == null) {
                continue;
            }
            occ.taken().remove(e.getAddress());
            RoomAddress a;
            if (store) {
                int n = 1;
                while (occ.taken().contains("season:" + n)) {
                    n++;
                }
                a = RoomAddress.of("season", n);
                occ.add(a);
            } else {
                a = place(w, layout, labels, occ);
            }
            e.setAddress(a.toString());
            e.setAssignedBy("USER");
            storage.save(e);
            moved++;
        }
        return Map.of("moved", moved, "stored", store);
    }

    // ================================================================== organizar com IA (CA05)
    static String titleCase(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    /** Sugestão local de rótulo para uma gaveta pelo conteúdo dominante. */
    static String suggestLabel(List<WardrobeItem> content, String current) {
        if (content.isEmpty()) {
            return current;
        }
        Map<String, Long> votes = new HashMap<>();
        for (WardrobeItem w : content) {
            String pref = preferredDrawerLabel(w);
            if (pref == null) {
                pref = SUBCATEGORY_LABELS.getOrDefault(nz(w.getSubcategory()), Msg.has("taxonomy." + nz(w.getSubcategory())) ? Msg.k("taxonomy." + nz(w.getSubcategory())) : titleCase(nz(w.getSubcategory()).replace('_', ' ')));
            }
            votes.merge(pref, 1L, Long::sum);
        }
        Map.Entry<String, Long> top = votes.entrySet().stream().max(Map.Entry.comparingByValue()).orElseThrow();
        return top.getValue() * 2 >= content.size() ? top.getKey() : current;
    }

    @Transactional
    public Map<String, Object> organizePreview(CurrentUser user, boolean useAi) {
        RoomLayout layout = layout(user.id());
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(user.id());
        Map<UUID, WardrobeItem> byId = all.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        List<RoomStorageEntry> entries = entries(user.id(), all);
        Map<String, String> labels = labels(layout);
        Map<String, List<WardrobeItem>> drawerContent = new HashMap<>();
        for (RoomStorageEntry e : entries) {
            RoomAddress.parse(e.getAddress()).filter(a -> a.zone().equals("drawer")).ifPresent(a ->
                    drawerContent.computeIfAbsent(String.valueOf(a.index()), k -> new ArrayList<>()).add(byId.get(e.getWardrobeItemId())));
        }
        Map<String, String> proposed = new TreeMap<>((a, b) -> Integer.compare(Integer.parseInt(a), Integer.parseInt(b)));
        proposed.putAll(labels);
        drawerContent.forEach((idx, content) -> {
            String s = suggestLabel(content.stream().filter(Objects::nonNull).toList(), labels.get(idx));
            if (s != null) {
                proposed.put(idx, s);
            }
        });
        AiOutcome<Map<String, String>> outcome = null;
        if (useAi) {
            List<Map<String, Object>> summary = drawerContent.entrySet().stream().map(en -> Map.<String, Object>of("drawer", en.getKey(),
                    "label", String.valueOf(labels.get(en.getKey())), "subcategories", en.getValue().stream().filter(Objects::nonNull)
                            .map(WardrobeItem::getSubcategory).toList())).toList();
            Map<String, String> local = new LinkedHashMap<>(proposed);
            outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.COPILOT,
                    "Você organiza o closet digital do Fashion AI. Responda em " + Msg.languageName() + ". Proponha rótulos curtos (até 24 caracteres, nesse idioma) para as gavetas "
                            + "com base no conteúdo. Categorias padrão: Jeans, Academia, Praia, Acessórios, Íntimas, Favoritas. "
                            + "Responda SOMENTE com JSON {\"labels\":{\"<gaveta>\":\"<rótulo>\"}}.",
                    "Gavetas: " + Json.write(summary), List.of(), 600, List.of(Msg.t("room.subcategorias_das_pecas_por_gaveta")),
                    text -> {
                        Map<String, Object> m = WardrobeService.extractJson(text);
                        if (!(m.get("labels") instanceof Map<?, ?> lm)) {
                            return null;
                        }
                        Map<String, String> out = new LinkedHashMap<>(local);
                        lm.forEach((k, v) -> {
                            String idx = String.valueOf(k);
                            if (drawerContent.containsKey(idx) && v != null) {
                                out.put(idx, InputSanitizer.clean(String.valueOf(v), 24));
                            }
                        });
                        return out;
                    }, () -> local, null));
            if (outcome.value() != null) {
                proposed.clear();
                proposed.putAll(outcome.value());
            }
        }
        // redistribuição: mantém quem já está coerente e cabe; reposiciona o resto
        Occupancy occ = new Occupancy(new HashSet<>(), new HashMap<>());
        List<Map<String, Object>> moves = new ArrayList<>();
        List<RoomStorageEntry> pending = new ArrayList<>();
        for (RoomStorageEntry e : entries) {
            WardrobeItem w = byId.get(e.getWardrobeItemId());
            RoomAddress a = RoomAddress.parse(e.getAddress()).orElse(null);
            boolean keep = w != null && a != null && !a.zone().equals("chair") && coherent(w, a, proposed)
                    && (!a.zone().equals("drawer") || occ.drawerCount().getOrDefault(String.valueOf(a.index()), 0) < DRAWER_CAPACITY);
            if (keep) {
                occ.add(a);
            } else {
                pending.add(e);
            }
        }
        for (RoomStorageEntry e : pending) {
            WardrobeItem w = byId.get(e.getWardrobeItemId());
            if (w == null) {
                continue;
            }
            RoomAddress target = place(w, layout, proposed, occ);
            if (!target.toString().equals(e.getAddress())) {
                Map<String, Object> mv = new LinkedHashMap<>();
                mv.put("pieceId", w.getId());
                mv.put("name", w.getName());
                mv.put("from", e.getAddress());
                mv.put("fromLabel", RoomAddress.parse(e.getAddress()).map(x -> x.label(labels)).orElse(""));
                mv.put("to", target.toString());
                mv.put("toLabel", target.label(proposed));
                mv.put("reason", target.zone().equals("drawer") ? Msg.t("room.categoria_da_gaveta") : target.zone().equals("door") ? Msg.t("room.peca_superior_vai_ao_cabideiro")
                        : target.zone().equals("chair") ? Msg.t("room.sem_posicao_livre") : Msg.t("room.posicao_do_tipo"));
                moves.add(mv);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("labels", proposed);
        out.put("changedLabels", proposed.entrySet().stream().filter(en -> !en.getValue().equals(labels.get(en.getKey())))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new)));
        out.put("moves", moves);
        out.put("summary", Msg.t("room.peca_s_reposicionada_s_gaveta", (moves.size()), ((Map<?, ?>) out.get("changedLabels")).size()));
        out.put("fallbackUsed", outcome != null && outcome.fallbackUsed());
        out.put("explanation", outcome == null ? null : outcome.explanation());
        out.put("canUndo", true);
        return out;
    }

    @Transactional
    public Map<String, Object> applyOrganization(CurrentUser user, Map<String, String> labels, List<Map<String, Object>> moves) {
        RoomLayout layout = layout(user.id());
        List<RoomStorageEntry> entries = storage.findByUserId(user.id());
        Map<String, Object> previous = new LinkedHashMap<>();
        previous.put("labels", labels(layout));
        previous.put("sources", labelSources(layout));
        previous.put("entries", entries.stream().collect(Collectors.toMap(e -> e.getWardrobeItemId().toString(), RoomStorageEntry::getAddress)));
        layout.setPreviousMapJson(Json.write(previous));
        Map<String, String> current = labels(layout);
        Map<String, String> sources = labelSources(layout);
        if (labels != null) {
            labels.forEach((k, v) -> {
                if (module(layout, "drawer:" + k).isPresent()) {
                    String clean = InputSanitizer.clean(v == null ? "" : v, 24);
                    if (clean.isBlank()) {
                        current.remove(k);
                        sources.remove(k);
                    } else if (!clean.equals(Msg.resolve(current.get(k)))) {
                        current.put(k, clean);
                        sources.put(k, "AI");
                    }
                }
            });
        }
        saveLabels(layout, current, sources);
        layouts.save(layout);
        int applied = 0;
        if (moves != null) {
            for (Map<String, Object> mv : moves) {
                UUID pieceId = UUID.fromString(String.valueOf(mv.get("pieceId")));
                Optional<RoomAddress> to = RoomAddress.parse(String.valueOf(mv.get("to")));
                RoomStorageEntry e = entries.stream().filter(x -> x.getWardrobeItemId().equals(pieceId)).findFirst().orElse(null);
                if (e != null && to.isPresent()) {
                    e.setAddress(to.get().toString());
                    e.setAssignedBy("AI");
                    storage.save(e);
                    applied++;
                }
            }
        }
        events.publishEvent(new DomainEvents.RoomOrganized(user.id()));
        return Map.of("applied", applied, "labels", current, "canUndo", true);
    }

    @Transactional
    public Map<String, Object> undoOrganization(CurrentUser user) {
        RoomLayout layout = layout(user.id());
        Map<String, Object> previous = Json.map(layout.getPreviousMapJson());
        if (previous.isEmpty()) {
            throw new ApiException(409, "NADA_A_DESFAZER", Msg.t("room.nao_ha_organizacao_anterior_para"));
        }
        @SuppressWarnings("unchecked") Map<String, Object> labels = previous.get("labels") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
        @SuppressWarnings("unchecked") Map<String, Object> sources = previous.get("sources") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
        @SuppressWarnings("unchecked") Map<String, Object> entries = previous.get("entries") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
        Map<String, String> l = new LinkedHashMap<>();
        labels.forEach((k, v) -> l.put(k, String.valueOf(v)));
        Map<String, String> s = new LinkedHashMap<>();
        sources.forEach((k, v) -> s.put(k, String.valueOf(v)));
        saveLabels(layout, l, s);
        layout.setPreviousMapJson(null);
        layouts.save(layout);
        int restored = 0;
        for (RoomStorageEntry e : storage.findByUserId(user.id())) {
            Object addr = entries.get(e.getWardrobeItemId().toString());
            if (addr != null && !String.valueOf(addr).equals(e.getAddress())) {
                e.setAddress(String.valueOf(addr));
                e.setAssignedBy("USER");
                storage.save(e);
                restored++;
            }
        }
        return Map.of("restored", restored, "labels", l);
    }

    // ================================================================== etiqueta da peça (DET-M02/M04/C07) e ilha (Atelier)
    @Transactional
    public Map<String, Object> pieceTag(CurrentUser user, UUID pieceId) {
        WardrobeItem w = owned(user, pieceId);
        List<PieceUsageDiaryEntry> uses = diary.findByWardrobeItemIdOrderByUsedOnDesc(pieceId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", w.getId());
        m.put("name", w.getName());
        m.put("composition", w.getMaterial());
        m.put("care", w.getCareInstructions());
        m.put("origin", w.getPieceOrigin());
        m.put("garimpo", "GARIMPADA".equalsIgnoreCase(w.getPieceOrigin()));
        m.put("wearCount", w.getWearCount());
        m.put("thirtyWears", w.getWearCount() >= 30);
        m.put("costPerUse", w.getPrice() != null && w.getWearCount() > 0
                ? w.getPrice().divide(BigDecimal.valueOf(w.getWearCount()), 2, RoundingMode.HALF_UP) : null);
        m.put("costPerUseNote", Msg.t("room.custo_por_uso_so_para"));
        m.put("location", locate(user.id(), pieceId).map(l -> Map.of("address", l.address().toString(), "label", l.label())).orElse(null));
        m.put("diary", uses.stream().limit(60).map(e -> Map.of("date", e.getUsedOn(), "occasion", String.valueOf(e.getOccasion()),
                "note", String.valueOf(e.getNote()), "source", e.getSource(), "schemeId", String.valueOf(e.getSchemeId()))).toList());
        m.put("beforeAfter", Map.of("original", String.valueOf(w.getOriginalImageUrl()), "flatLay", String.valueOf(w.getImageUrl())));
        return m;
    }

    /** DET-C07 — Diário da Peça: registro manual de uso com data, ocasião e nota curta. */
    @Transactional
    public Map<String, Object> diaryEntry(CurrentUser user, UUID pieceId, LocalDate date, String occasion, String note) {
        WardrobeItem w = owned(user, pieceId);
        LocalDate day = date == null ? LocalDate.now(ZONE) : date;
        if (day.isAfter(LocalDate.now(ZONE))) {
            throw ApiException.badRequest("DATA_FUTURA", Msg.t("room.o_diario_registra_usos_passados"));
        }
        if (occasion != null && !occasion.isBlank() && !Taxonomy.OCCASIONS.contains(occasion)) {
            throw ApiException.badRequest("OCASIAO_INVALIDA", Msg.t("room.ocasiao_fora_da_taxonomia"));
        }
        if (!diary.existsByWardrobeItemIdAndUsedOn(pieceId, day)) {
            PieceUsageDiaryEntry e = new PieceUsageDiaryEntry();
            e.setWardrobeItemId(pieceId);
            e.setUserId(user.id());
            e.setUsedOn(day);
            e.setOccasion(occasion);
            e.setNote(InputSanitizer.moderated("note", note == null ? "" : note, 160));
            e.setSource("MANUAL");
            diary.save(e);
            w.setWearCount(w.getWearCount() + 1);
            if (w.getLastWornDate() == null || day.isAfter(w.getLastWornDate())) {
                w.setLastWornDate(day);
            }
            pieces.save(w);
            events.publishEvent(new DomainEvents.PieceWorn(user.id(), pieceId, day, occasion));
        }
        return pieceTag(user, pieceId);
    }

    /** Atelier — bancada de looks: comparar 2–3 esquemas lado a lado. */
    @Transactional(readOnly = true)
    public Map<String, Object> island(CurrentUser user, List<UUID> schemeIds) {
        if (!levelOf(user.id()).atLeast(FaiPointsService.Level.ATELIER)) {
            throw new ApiException(409, "NIVEL_INSUFICIENTE", Msg.t("room.a_ilha_central_e_liberada"));
        }
        if (schemeIds == null || schemeIds.size() < 2 || schemeIds.size() > 3) {
            throw ApiException.badRequest("QUANTIDADE_INVALIDA", Msg.t("room.compare_2_ou_3_looks"));
        }
        List<Map<String, Object>> looks = new ArrayList<>();
        for (UUID id : schemeIds) {
            Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
            guard.requireOwner(user, s.getUser().getId(), "scheme:" + id);
            List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("title", s.getTitle());
            m.put("coverImageUrl", s.getCoverImageUrl());
            m.put("occasion", Json.csv(s.getOccasion()));
            m.put("style", Json.csv(s.getStyle()));
            m.put("totalPrice", s.getTotalPrice());
            m.put("hypeScore", s.getHypeScore());
            m.put("pieces", items.stream().map(si -> Map.of("id", si.getWardrobeItem().getId(), "name", String.valueOf(si.getWardrobeItem().getName()),
                    "slot", si.getSlot().name(), "imageUrl", String.valueOf(si.getWardrobeItem().getImageUrl()))).toList());
            looks.add(m);
        }
        return Map.of("looks", looks, "module", "island");
    }
}
