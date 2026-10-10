package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.RecommendationScoring;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.MirrorState;
import br.com.fashionai.domain.model.TipoLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.MirrorStateRepository;
import br.com.fashionai.domain.repository.TipoLookRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
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
import java.util.stream.Collectors;

/**
 * RF33 — Smart Mirror e "Vista-me". O espelho é mais uma interface para iniciar o Criar Look (RF5), não uma
 * cópia dele: montagem manual por slots (§2.1), completude determinística sem IA, Vista-me com interpretação,
 * elegibilidade, validação anti-alucinação (CA09), localização no quarto (CA10), "Usar este look" que sempre
 * materializa um Esquema (§2.3) e entrega para o RF5 via RoomLookDraft (§2.4).
 * <p>
 * RF53 · P3-07 — o look no espelho traz os mesmos seis números do Copilot e do Autopiloto ({@link LookScorer}):
 * compatibilidade com o DNA, Hype, novidade, reutilização, uso comprovado e sustentabilidade, lado a lado e nunca somados.
 */
@Service
public class MirrorService {
    public static final List<String> SLOTS = List.of("upper", "lower", "dress", "shoes", "outer_layer", "accessory");
    public static final int MAX_ACCESSORIES = 4;
    public static final int MAX_SHOWN = 50;
    static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM");

    /** RF36.CA14 — desafios com conjunto de peças (10×10, Cápsula) restringem o Vista-me; implementado pelo ChallengeService. */
    public interface PieceRestrictionProvider {
        Optional<Restriction> restriction(UUID userId);

        record Restriction(String challengeName, Set<UUID> allowedPieceIds) {
        }
    }

    public record Interpretation(List<String> occasion, String mood, List<UUID> anchors, List<String> constraints, String season) {
    }

    private final MirrorStateRepository mirrors;
    private final WardrobeItemRepository pieces;
    private final WardrobeService wardrobe;
    private final RoomService room;
    private final TipoLookRepository tiposLook;
    private final SchemeService schemeService;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final DailyLookService dailyLooks;
    private final StyleDnaRepository dnas;
    private final ObjectProvider<PieceRestrictionProvider> restrictions;
    private final AiEngine ai;
    private final Audit audit;
    private final ApplicationEventPublisher events;
    /** P3-07 — a mesma régua de looks do Copilot e do Autopiloto (só lê o Hype gravado; nada recalcula nem vira sinal). */
    private final LookScorer scorer;

    public MirrorService(MirrorStateRepository mirrors, WardrobeItemRepository pieces, WardrobeService wardrobe, RoomService room,
                         SchemeService schemeService, SchemeRepository schemes, SchemeItemRepository schemeItems,
                         DailyLookService dailyLooks, StyleDnaRepository dnas, ObjectProvider<PieceRestrictionProvider> restrictions,
                         AiEngine ai, Audit audit, ApplicationEventPublisher events, HypeQueryService hype,
                         TipoLookRepository tiposLook) {
        this.tiposLook = tiposLook;
        this.mirrors = mirrors;
        this.pieces = pieces;
        this.wardrobe = wardrobe;
        this.room = room;
        this.schemeService = schemeService;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dailyLooks = dailyLooks;
        this.dnas = dnas;
        this.restrictions = restrictions;
        this.ai = ai;
        this.audit = audit;
        this.events = events;
        this.scorer = new LookScorer(pieces, schemes, schemeItems, dnas, hype);
    }

    // ================================================================== slots
    public static String slotOf(WardrobeItem w) {
        String cat = w.getCategory() == null ? "" : w.getCategory();
        return switch (cat) {
            case "upper_piece" -> w.getSubcategory() != null && RoomService.OUTERWEAR.contains(w.getSubcategory()) ? "outer_layer" : "upper";
            case "lower_piece" -> "lower";
            case "full_body_piece" -> "dress";
            case "shoes_piece" -> "shoes";
            default -> "accessory";
        };
    }

    static SchemeSlot schemeSlot(String slot) {
        return switch (slot) {
            case "upper" -> SchemeSlot.TOP;
            case "lower" -> SchemeSlot.BOTTOM;
            case "dress" -> SchemeSlot.FULL_BODY;
            case "shoes" -> SchemeSlot.SHOES;
            case "outer_layer" -> SchemeSlot.OUTERWEAR;
            default -> SchemeSlot.ACCESSORY;
        };
    }

    MirrorState stateEntity(UUID userId) {
        return mirrors.findByUserId(userId).orElseGet(() -> {
            MirrorState s = new MirrorState();
            s.setUserId(userId);
            s.setSlotsJson("{}");
            s.setShownCombinationsJson("[]");
            return mirrors.save(s);
        });
    }

    /** slots_json: upper/lower/dress/shoes/outer_layer → id; accessory → [ids]; origin, prompt, interpretation. */
    Map<String, Object> slots(MirrorState s) {
        return Json.map(s.getSlotsJson());
    }

    static List<UUID> accessories(Map<String, Object> slots) {
        List<UUID> out = new ArrayList<>();
        if (slots.get("accessory") instanceof List<?> l) {
            for (Object o : l) {
                try {
                    out.add(UUID.fromString(String.valueOf(o)));
                } catch (IllegalArgumentException ignored) {
                    // id inválido é ignorado
                }
            }
        }
        return out;
    }

    static UUID single(Map<String, Object> slots, String slot) {
        Object v = slots.get(slot);
        if (v == null) {
            return null;
        }
        try {
            return UUID.fromString(String.valueOf(v));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    /** Teto da lista do espelho (peças trazidas para provar). */
    static final int MAX_RACK = 24;

    /**
     * Lista do espelho (QUARTO-ESPELHO): as peças trazidas do quarto para provar, na ordem em que chegaram. É separada do
     * que está vestido (slots): vestir tira da lista para o corpo e a peça continua na lista; tirar da lista nunca apaga
     * a peça do guarda-roupa.
     */
    static List<UUID> rack(Map<String, Object> slots) {
        List<UUID> out = new ArrayList<>();
        if (slots.get("rack") instanceof List<?> l) {
            for (Object o : l) {
                try {
                    UUID id = UUID.fromString(String.valueOf(o));
                    if (!out.contains(id)) {
                        out.add(id);
                    }
                } catch (IllegalArgumentException ignored) {
                    // id inválido é ignorado
                }
            }
        }
        return out;
    }

    static void putRack(Map<String, Object> slots, List<UUID> rack) {
        slots.put("rack", rack.stream().map(UUID::toString).toList());
    }

    /** Põe a peça na lista do espelho (sem duplicar; a mais antiga sai quando passa do teto). @return se entrou agora */
    static boolean addToRack(Map<String, Object> slots, UUID pieceId) {
        List<UUID> rack = rack(slots);
        if (rack.contains(pieceId)) {
            return false;
        }
        rack.add(pieceId);
        while (rack.size() > MAX_RACK) {
            rack.remove(0);
        }
        putRack(slots, rack);
        return true;
    }

    static List<UUID> allIds(Map<String, Object> slots) {
        List<UUID> ids = new ArrayList<>();
        for (String slot : List.of("outer_layer", "upper", "dress", "lower", "shoes")) {
            UUID id = single(slots, slot);
            if (id != null) {
                ids.add(id);
            }
        }
        ids.addAll(accessories(slots));
        return ids;
    }

    private Map<UUID, WardrobeItem> load(UUID userId, List<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return pieces.findByIdIn(ids).stream().filter(w -> w.getUser().getId().equals(userId))
                .collect(Collectors.toMap(WardrobeItem::getId, w -> w, (a, b) -> a, LinkedHashMap::new));
    }

    static boolean available(WardrobeItem w) {
        return w.isDisponivel() && w.getAvailabilityStatus() == AvailabilityStatus.AVAILABLE;
    }

    static boolean complete(Map<String, Object> slots) {
        boolean top = single(slots, "upper") != null && single(slots, "lower") != null;
        return (top || single(slots, "dress") != null) && single(slots, "shoes") != null;
    }

    /** Regra de completude determinística (sem IA): avisos de categoria faltando (CA03). */
    static List<Map<String, Object>> missing(Map<String, Object> slots) {
        List<Map<String, Object>> out = new ArrayList<>();
        boolean dress = single(slots, "dress") != null;
        if (!dress && single(slots, "upper") == null) {
            out.add(Map.of("slot", "upper", "message", Msg.t("mirror.esse_look_ainda_nao_possui"), "action", Msg.t("mirror.sugerir_peca_superior")));
        }
        if (!dress && single(slots, "lower") == null) {
            out.add(Map.of("slot", "lower", "message", Msg.t("mirror.esse_look_ainda_nao_possui_2"), "action", Msg.t("mirror.sugerir_peca_inferior")));
        }
        if (single(slots, "shoes") == null) {
            out.add(Map.of("slot", "shoes", "message", Msg.t("mirror.esse_look_ainda_nao_possui_3"), "action", Msg.t("mirror.sugerir_calcado")));
        }
        return out;
    }

    /** DET-M06 — leitura de silhueta (A, H, V, X) e regra 1/3–2/3, por heurística de subcategorias. */
    static Map<String, Object> silhouette(List<WardrobeItem> look) {
        Set<String> subs = look.stream().map(WardrobeItem::getSubcategory).filter(Objects::nonNull).collect(Collectors.toSet());
        boolean wideLower = subs.stream().anyMatch(Set.of("culottes", "skirt", "cargo_pants", "casual_pants", "sweatpants", "jogger_pants")::contains);
        boolean fittedLower = subs.stream().anyMatch(Set.of("leggings", "jeans", "tailored_pants", "chino_pants", "skort")::contains);
        boolean volUpper = subs.stream().anyMatch(Set.of("hoodie", "coat", "parka", "sweatshirt", "kimono", "jacket", "blazer")::contains);
        boolean fittedUpper = subs.stream().anyMatch(Set.of("tank_top", "crop_top", "top", "bodysuit", "polo_shirt", "t_shirt")::contains);
        boolean dress = subs.stream().anyMatch(Set.of("dress", "jumpsuit", "romper")::contains);
        boolean belt = subs.contains("belt");
        String letter = dress || belt ? "X" : wideLower && fittedUpper ? "A" : volUpper && fittedLower ? "V" : volUpper && wideLower ? "H" : "H";
        String thirds = letter.equals("A") ? Msg.t("mirror.n1_3_em_cima_2") : letter.equals("V")
                ? Msg.t("mirror.n2_3_em_cima_1") : letter.equals("X") ? Msg.t("mirror.cintura_marcada_divide_o_look")
                : Msg.t("mirror.proporcoes_iguais_1_2_1");
        return Map.of("letter", letter, "rule", thirds, "toggle", true);
    }

    Map<String, Object> pieceView(WardrobeItem w, Map<UUID, RoomService.Location> where) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", w.getId());
        m.put("name", w.getName());
        m.put("category", w.getCategory());
        m.put("subcategory", w.getSubcategory());
        m.put("color", w.getColor());
        m.put("colorHex", Taxonomy.hex(w.getColor()));
        m.put("imageUrl", w.getImageUrl());
        m.put("thumbnailUrl", w.getThumbnailUrl());
        m.put("studioImageUrl", w.getStudioImageUrl());
        // modelagem e dimensões da taxonomia: o espelho veste com o mesmo caimento do provador (classe, comprimentos)
        m.put("variation", w.getVariationCode());
        Map<String, List<String>> attrs = new LinkedHashMap<>();
        if (w.getAttributes() != null) {
            w.getAttributes().forEach(a -> attrs.computeIfAbsent(a.getDimensionCode(), k -> new ArrayList<>()).add(a.getValueCode()));
        }
        m.put("attributes", attrs);
        m.put("available", available(w));
        m.put("slot", slotOf(w));
        RoomService.Location loc = where.get(w.getId());
        m.put("address", loc == null ? null : loc.address().toString());
        m.put("addressLabel", loc == null ? null : loc.label());
        m.put("moduleId", loc == null ? null : loc.moduleId());
        return m;
    }

    @Transactional
    public Map<String, Object> state(CurrentUser user) {
        MirrorState s = stateEntity(user.id());
        Map<String, Object> slots = slots(s);
        return render(user, s, slots, Map.of());
    }

    @Transactional
    public Map<String, Object> updateTipoLook(CurrentUser user, UUID tipoLookId) {
        if (tipoLookId == null) throw ApiException.badRequest("TIPO_LOOK_INVALIDO", Msg.t("mirror.tipo_look_invalido"));
        var tipo = tiposLook.findById(tipoLookId).orElseThrow(() -> ApiException.badRequest("TIPO_LOOK_INVALIDO", Msg.t("mirror.tipo_look_invalido")));
        MirrorState state = stateEntity(user.id());
        state.setTipoLook(tipo);
        mirrors.save(state);
        return render(user, state, slots(state), Map.of());
    }

    Map<String, Object> render(CurrentUser user, MirrorState s, Map<String, Object> slots, Map<String, Object> extra) {
        List<UUID> wantRack = rack(slots);
        List<UUID> toLoad = new ArrayList<>(allIds(slots));
        wantRack.stream().filter(id -> !toLoad.contains(id)).forEach(toLoad::add);
        Map<UUID, WardrobeItem> loaded = load(user.id(), toLoad);
        // peças apagadas ou de terceiros somem do espelho
        boolean dirty = false;
        for (String slot : List.of("upper", "lower", "dress", "shoes", "outer_layer")) {
            UUID id = single(slots, slot);
            if (id != null && !loaded.containsKey(id)) {
                slots.remove(slot);
                dirty = true;
            }
        }
        List<UUID> acc = accessories(slots).stream().filter(loaded::containsKey).toList();
        if (acc.size() != accessories(slots).size()) {
            slots.put("accessory", acc.stream().map(UUID::toString).toList());
            dirty = true;
        }
        List<UUID> rackIds = wantRack.stream().filter(loaded::containsKey).toList();
        if (rackIds.size() != wantRack.size()) {
            putRack(slots, rackIds);
            dirty = true;
        }
        if (dirty) {
            s.setSlotsJson(Json.write(slots));
            mirrors.save(s);
        }
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> slotViews = new LinkedHashMap<>();
        for (String slot : List.of("outer_layer", "upper", "dress", "lower", "shoes")) {
            UUID id = single(slots, slot);
            slotViews.put(slot, id == null ? null : pieceView(loaded.get(id), where));
        }
        slotViews.put("accessory", acc.stream().map(id -> pieceView(loaded.get(id), where)).toList());
        out.put("slots", slotViews);
        Set<UUID> worn = new HashSet<>(allIds(slots));
        out.put("rack", rackIds.stream().map(id -> {
            Map<String, Object> v = pieceView(loaded.get(id), where);
            v.put("worn", worn.contains(id));
            return v;
        }).toList());
        out.put("tipoLook", Views.tipoLook(s.getTipoLook()));
        List<WardrobeItem> look = allIds(slots).stream().map(loaded::get).filter(Objects::nonNull).toList();
        boolean complete = complete(slots);
        out.put("complete", complete);
        out.put("missing", missing(slots));
        List<String> warnings = new ArrayList<>();
        for (WardrobeItem w : look) {
            if (!available(w)) {
                warnings.add(Msg.t("mirror.esta_no_cesto_nao_pode", w.getName()));
            }
        }
        out.put("warnings", warnings);
        out.put("origin", slots.getOrDefault("origin", "manual"));
        out.put("prompt", slots.get("prompt"));
        out.put("interpretation", slots.get("interpretation"));
        boolean canTakeOneOff = complete && (!acc.isEmpty() || single(slots, "outer_layer") != null);
        List<String> actions = new ArrayList<>();
        if (complete) {
            actions.addAll(List.of("SALVAR_LOOK", "REMIXAR", "LOOK_DO_DIA", "COMPARTILHAR", "CRIAR_LOOK_COM_ESTAS_PECAS"));
            if (canTakeOneOff) {
                actions.add("TIRA_UMA_COISA");
            }
        } else {
            missing(slots).forEach(m -> actions.add("SUGERIR_" + String.valueOf(m.get("slot")).toUpperCase(Locale.ROOT)));
            if (!look.isEmpty()) {
                actions.add("CRIAR_LOOK_COM_ESTAS_PECAS");
            }
        }
        actions.add("VISTA_ME");
        out.put("actions", actions);
        out.put("silhouette", complete ? silhouette(look) : null);
        out.put("postIt", !complete && !look.isEmpty() ? Msg.t("mirror.faltou_o_look_continua_pendurado", missing(slots).stream().map(m -> switch (String.valueOf(m.get("slot"))) {
            case "shoes" -> "o sapato";
            case "upper" -> Msg.t("mirror.a_peca_de_cima");
            default -> Msg.t("mirror.a_peca_de_baixo");
        }).collect(Collectors.joining(" e "))) : null);
        String colorSeason = dnas.findByUserId(user.id()).map(d -> d.getColorSeason()).orElse(null);
        out.put("light", Map.of("kelvin", colorSeason == null ? 4000 : switch (colorSeason.toUpperCase(Locale.ROOT)) {
            case "PRIMAVERA", "SPRING" -> 3400;
            case "VERAO", "VERÃO", "SUMMER" -> 5600;
            case "OUTONO", "AUTUMN" -> 2900;
            case "INVERNO", "WINTER" -> 6000;
            default -> 4000;
        }, "colorSeason", String.valueOf(colorSeason)));
        out.put("restriction", restriction(user.id()).map(r -> Map.of("challenge", r.challengeName(), "allowed", r.allowedPieceIds().size())).orElse(null));
        out.put("shownCount", Json.strings(s.getShownCombinationsJson()).size());
        out.put("scores", lookScores(user.id(), look));
        out.putAll(extra);
        return out;
    }

    /**
     * RF53 · P3-07 — os seis números do look no espelho ({@link LookScorer}, a mesma régua do Copilot e do Autopiloto):
     * compatibilidade com o DNA, Hype, novidade, reutilização, uso comprovado e sustentabilidade. Só entram as peças do
     * próprio dono (o {@link #load} já descarta as de terceiros), então o Hype é o pessoal dele — a média do v2 das peças,
     * lida do estado gravado: nada é recalculado nem vira sinal de Hype. Sem modo escolhido, nada é reordenado (o Hype não
     * pesa nada aqui; nos modos do Copilot nunca passa de 20%). Dimensão sem base fica nula ("—" na tela, nunca 0);
     * espelho vazio não tem números.
     */
    Map<String, Object> lookScores(UUID userId, List<WardrobeItem> look) {
        if (look.isEmpty()) {
            return null;
        }
        List<RecommendationScoring.Scores> scored = scorer.scoreLooks(userId, List.of(look));
        return scored.isEmpty() ? null : scored.get(0).toMap();
    }

    // ================================================================== montagem manual (CA01/CA02/CA05)
    @Transactional
    public Map<String, Object> place(CurrentUser user, UUID pieceId) {
        if (pieceId == null) {   // corpo sem pieceId: 400 com a mensagem, não erro interno ao buscar id nulo
            throw ApiException.badRequest("PECA_OBRIGATORIA", Msg.t("mirror.escolha_uma_peca"));
        }
        WardrobeItem w = wardrobe.owned(user, pieceId);
        MirrorState s = stateEntity(user.id());
        Map<String, Object> slots = slots(s);
        String slot = slotOf(w);
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        List<Map<String, Object>> returned = new ArrayList<>();
        if (slot.equals("accessory")) {
            List<String> acc = accessories(slots).stream().map(UUID::toString).collect(Collectors.toCollection(ArrayList::new));
            if (!acc.contains(pieceId.toString())) {
                if (acc.size() >= MAX_ACCESSORIES) {
                    UUID old = UUID.fromString(acc.remove(0));
                    load(user.id(), List.of(old)).values().forEach(o -> returned.add(pieceView(o, where)));
                }
                acc.add(pieceId.toString());
            }
            slots.put("accessory", acc);
        } else {
            UUID previous = single(slots, slot);
            if (previous != null && !previous.equals(pieceId)) {
                load(user.id(), List.of(previous)).values().forEach(o -> returned.add(pieceView(o, where)));
            }
            slots.put(slot, pieceId.toString());
            if (slot.equals("dress")) {
                for (String k : List.of("upper", "lower")) {
                    UUID prev = single(slots, k);
                    if (prev != null) {
                        load(user.id(), List.of(prev)).values().forEach(o -> returned.add(pieceView(o, where)));
                        slots.remove(k);
                    }
                }
            } else if (slot.equals("upper") || slot.equals("lower")) {
                UUID prev = single(slots, "dress");
                if (prev != null) {
                    load(user.id(), List.of(prev)).values().forEach(o -> returned.add(pieceView(o, where)));
                    slots.remove("dress");
                }
            }
        }
        addToRack(slots, pieceId);   // vestida também fica na lista do espelho (para trocar e voltar a ela)
        if ("vista_me".equals(slots.get("origin"))) {
            slots.put("origin", "smart_mirror");
        } else {
            slots.putIfAbsent("origin", "manual");
        }
        slots.put("updatedAt", Instant.now().toString());
        s.setSlotsJson(Json.write(slots));
        mirrors.save(s);
        events.publishEvent(new DomainEvents.MirrorAction(user.id(), "PLACE"));
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("placed", pieceView(w, where));
        extra.put("returned", returned);
        if (!available(w)) {
            extra.put("notice", Msg.t("mirror.esta_no_cesto_indisponivel_pode", w.getName()));
        }
        return render(user, s, slots, extra);
    }

    // ================================================================== lista do espelho (QUARTO-ESPELHO)
    /** Leva a peça ao espelho: entra na lista para provar (sem vestir). Repetir o pedido não duplica. */
    @Transactional
    public Map<String, Object> bring(CurrentUser user, UUID pieceId) {
        if (pieceId == null) {
            throw ApiException.badRequest("PECA_OBRIGATORIA", Msg.t("mirror.escolha_uma_peca"));
        }
        WardrobeItem w = wardrobe.owned(user, pieceId);
        MirrorState s = stateEntity(user.id());
        Map<String, Object> slots = slots(s);
        boolean added = addToRack(slots, w.getId());
        if (added) {
            slots.put("updatedAt", Instant.now().toString());
            s.setSlotsJson(Json.write(slots));
            mirrors.save(s);
            events.publishEvent(new DomainEvents.MirrorAction(user.id(), "BRING"));
        }
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("brought", w.getId());
        extra.put("added", added);
        return render(user, s, slots, extra);
    }

    /** Tira a peça da lista do espelho (e do corpo, se estava vestida). A peça continua no guarda-roupa. */
    @Transactional
    public Map<String, Object> unbring(CurrentUser user, UUID pieceId) {
        MirrorState s = stateEntity(user.id());
        Map<String, Object> slots = slots(s);
        List<UUID> rack = rack(slots);
        rack.remove(pieceId);
        putRack(slots, rack);
        for (String slot : List.of("upper", "lower", "dress", "shoes", "outer_layer")) {
            if (pieceId.equals(single(slots, slot))) {
                slots.remove(slot);
            }
        }
        slots.put("accessory", accessories(slots).stream().filter(id -> !id.equals(pieceId)).map(UUID::toString).toList());
        s.setSlotsJson(Json.write(slots));
        mirrors.save(s);
        return render(user, s, slots, Map.of("unbrought", pieceId));
    }

    @Transactional
    public Map<String, Object> remove(CurrentUser user, UUID pieceId) {
        MirrorState s = stateEntity(user.id());
        Map<String, Object> slots = slots(s);
        for (String slot : List.of("upper", "lower", "dress", "shoes", "outer_layer")) {
            if (pieceId.equals(single(slots, slot))) {
                slots.remove(slot);
            }
        }
        List<String> acc = accessories(slots).stream().filter(id -> !id.equals(pieceId)).map(UUID::toString).toList();
        slots.put("accessory", acc);
        s.setSlotsJson(Json.write(slots));
        mirrors.save(s);
        return render(user, s, slots, Map.of());
    }

    @Transactional
    public Map<String, Object> clear(CurrentUser user) {
        MirrorState s = stateEntity(user.id());
        // limpar tira tudo do corpo; a lista do espelho fica (tirar da lista é pedido a pedido)
        Map<String, Object> slots = new LinkedHashMap<>();
        putRack(slots, rack(slots(s)));
        s.setSlotsJson(Json.write(slots));
        mirrors.save(s);
        return render(user, s, slots, Map.of());
    }

    // ================================================================== elegibilidade (RF33 §2.2 passo 2)
    Optional<PieceRestrictionProvider.Restriction> restriction(UUID userId) {
        return restrictions.orderedStream().map(p -> p.restriction(userId)).filter(Optional::isPresent).map(Optional::get).findFirst();
    }

    /** Só peças disponíveis (RF31.CA02), dentro da estação (Penthouse) e permitidas pelo desafio ativo (RF36.CA14). */
    public List<WardrobeItem> eligible(UUID userId) {
        Set<UUID> outOfSeason = room.outOfSeason(userId);
        Optional<PieceRestrictionProvider.Restriction> r = restriction(userId);
        return wardrobe.eligible(userId).stream()
                .filter(w -> !w.isForSale())
                .filter(w -> !outOfSeason.contains(w.getId()))
                .filter(w -> r.isEmpty() || r.get().allowedPieceIds().contains(w.getId()))
                .toList();
    }

    static String key(List<UUID> ids) {
        return SchemeService.combinationKey(ids);
    }

    // ================================================================== sugerir para um slot (CA04 / CA12)
    @Transactional
    public Map<String, Object> suggest(CurrentUser user, String slot) {
        if (!SLOTS.contains(slot)) {
            throw ApiException.badRequest("SLOT_INVALIDO", "Slots: " + SLOTS);
        }
        MirrorState s = stateEntity(user.id());
        Map<String, Object> slots = slots(s);
        List<UUID> inMirror = allIds(slots);
        Map<UUID, WardrobeItem> mirrorPieces = load(user.id(), inMirror);
        UUID current = slot.equals("accessory") ? null : single(slots, slot);
        List<WardrobeItem> context = mirrorPieces.values().stream().filter(w -> !w.getId().equals(current)).toList();
        List<WardrobeItem> candidates = eligible(user.id()).stream().filter(w -> slotOf(w).equals(slot))
                .filter(w -> !inMirror.contains(w.getId())).toList();
        if (candidates.isEmpty()) {
            throw new ApiException(422, "SEM_CANDIDATAS", Msg.t("mirror.voce_nao_tem_peca_disponivel"),
                    Map.of("href", "/pieces/new", "slot", slot));
        }
        Map<String, WardrobeItem> byRef = new LinkedHashMap<>();
        List<Map<String, Object>> catalog = new ArrayList<>();
        int i = 1;
        for (WardrobeItem w : candidates) {
            String ref = "c" + i++;
            byRef.put(ref, w);
            catalog.add(Map.of("ref", ref, "name", String.valueOf(w.getName()), "subcategory", String.valueOf(w.getSubcategory()),
                    "color", String.valueOf(w.getColor()), "style", Json.csv(w.getStyleTags()), "occasion", Json.csv(w.getOccasionTags())));
        }
        List<Map<String, Object>> ctx = context.stream().map(w -> Map.<String, Object>of("name", String.valueOf(w.getName()),
                "subcategory", String.valueOf(w.getSubcategory()), "color", String.valueOf(w.getColor()), "style", Json.csv(w.getStyleTags()))).toList();
        AiOutcome<List<Map<String, Object>>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.SCHEME_COMPOSER,
                "Você é o Smart Mirror do Fashion AI. Escolha até 3 alternativas para o slot pedido, SOMENTE entre as candidatas (refs c1, c2...), "
                        + "que combinem com as peças já no espelho. Responda SOMENTE com JSON {\"alternatives\":[{\"ref\":\"c1\",\"why\":\"1 frase\"}]}.",
                "Slot: " + slot + "\nNo espelho: " + Json.write(ctx) + "\nCandidatas: " + Json.write(catalog),
                List.of(), 500, List.of(Msg.t("mirror.pecas_ja_no_espelho_e")),
                text -> {
                    Map<String, Object> m = WardrobeService.extractJson(text);
                    if (!(m.get("alternatives") instanceof List<?> list)) {
                        return null;
                    }
                    List<Map<String, Object>> out = new ArrayList<>();
                    Set<UUID> seen = new HashSet<>();
                    for (Object o : list) {
                        if (o instanceof Map<?, ?> alt && byRef.containsKey(String.valueOf(alt.get("ref")))) {
                            WardrobeItem w = byRef.get(String.valueOf(alt.get("ref")));
                            if (seen.add(w.getId())) {
                                out.add(Map.of("pieceId", w.getId(), "why", InputSanitizer.clean(alt.get("why") == null ? "" : String.valueOf(alt.get("why")), 160)));
                            }
                        } else if (o instanceof Map<?, ?> alt) {
                            audit.log(user, "VISTA_ME_ID_DESCARTADO", "mirror:" + user.id(), Map.of("ref", String.valueOf(alt.get("ref")), "slot", slot));
                        }
                        if (out.size() == 3) {
                            break;
                        }
                    }
                    return out.isEmpty() ? null : out;
                },
                () -> localAlternatives(candidates, context), null));
        List<Map<String, Object>> alternatives = outcome.value() == null ? localAlternatives(candidates, context) : outcome.value();
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        List<Map<String, Object>> view = new ArrayList<>();
        for (Map<String, Object> alt : alternatives) {
            WardrobeItem w = candidates.stream().filter(c -> c.getId().equals(alt.get("pieceId"))).findFirst().orElse(null);
            if (w != null) {
                Map<String, Object> m = pieceView(w, where);
                m.put("why", alt.get("why"));
                view.add(m);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("slot", slot);
        out.put("alternatives", view);
        out.put("fallbackUsed", outcome.fallbackUsed());
        out.put("explanation", outcome.explanation());
        out.put("quota", outcome.quota());
        out.put("message", outcome.userMessage());
        return out;
    }

    // ================================================================== escolher do guarda-roupa (WARDROBE-FIX)
    /**
     * Todas as peças que podem ir para o slot, para a pessoa escolher à mão: sem IA e sem custo. As mesmas regras do
     * Vista-me valem aqui (só disponíveis, dentro da estação, permitidas pelo desafio ativo); as que já estão no espelho
     * vêm marcadas.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> wardrobe(CurrentUser user, String slot) {
        if (!SLOTS.contains(slot)) {
            throw ApiException.badRequest("SLOT_INVALIDO", "Slots: " + SLOTS);
        }
        Set<UUID> inMirror = new HashSet<>(mirrors.findByUserId(user.id()).map(s -> allIds(slots(s))).orElse(List.of()));
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        List<Map<String, Object>> pieces = new ArrayList<>();
        for (WardrobeItem w : eligible(user.id())) {
            if (slotOf(w).equals(slot)) {
                Map<String, Object> m = pieceView(w, where);
                m.put("inMirror", inMirror.contains(w.getId()));
                pieces.add(m);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("slot", slot);
        out.put("pieces", pieces);
        if (pieces.isEmpty()) {
            out.put("message", Msg.t("mirror.voce_nao_tem_peca_disponivel"));
            out.put("href", "/pieces/new");
        }
        return out;
    }

    /** Fallback local (RNF8): similaridade ponderada com as peças do espelho + ocasião em comum + neutros. */
    static List<Map<String, Object>> localAlternatives(List<WardrobeItem> candidates, List<WardrobeItem> context) {
        List<Similarity.Signature> ctx = context.stream().map(Similarity::of).toList();
        Set<String> ctxOcc = context.stream().flatMap(w -> Json.csv(w.getOccasionTags()).stream()).collect(Collectors.toSet());
        return candidates.stream().map(c -> {
            Similarity.Signature sig = Similarity.of(c);
            double sim = ctx.isEmpty() ? 0.5 : ctx.stream().mapToDouble(x -> Similarity.weighted(sig, x)).average().orElse(0);
            boolean occ = ctxOcc.isEmpty() || Json.csv(c.getOccasionTags()).stream().anyMatch(ctxOcc::contains);
            double score = sim + (occ ? 0.3 : 0) + (br.com.fashionai.application.ai.local.ColorMath.isNeutral(c.getColor()) ? 0.1 : 0);
            String why = occ ? Msg.t("mirror.combina_com_a_ocasiao_das") : Msg.t("mirror.traz_contraste_com_o_que");
            return Map.<String, Object>of("pieceId", c.getId(), "why", why, "score", score);
        }).sorted((a, b) -> Double.compare((double) b.get("score"), (double) a.get("score"))).limit(3).toList();
    }

    // ================================================================== Vista-me (CA08–CA15)
    static final Map<String, List<String>> KEYWORDS = Map.ofEntries(
            Map.entry("faculdade", List.of("university")), Map.entry("aula", List.of("university", "school")), Map.entry("escola", List.of("school")),
            Map.entry("trabalho", List.of("work")), Map.entry("escritório", List.of("work", "business")), Map.entry("reunião", List.of("business")),
            Map.entry("apresentação", List.of("business", "formal")), Map.entry("entrevista", List.of("business", "formal")),
            Map.entry("festa", List.of("party")), Map.entry("balada", List.of("night_out")), Map.entry("jantar", List.of("date", "social")),
            Map.entry("encontro", List.of("date")), Map.entry("casamento", List.of("wedding")), Map.entry("formatura", List.of("ceremony", "formal")),
            Map.entry("praia", List.of("beach")), Map.entry("piscina", List.of("beach")), Map.entry("viagem", List.of("travel")),
            Map.entry("academia", List.of("gym")), Map.entry("treino", List.of("gym", "sport")), Map.entry("corrida", List.of("sport")),
            Map.entry("esporte", List.of("sport")), Map.entry("casa", List.of("home")), Map.entry("show", List.of("festival")),
            Map.entry("festival", List.of("festival")), Map.entry("passeio", List.of("casual", "outdoor")), Map.entry("parque", List.of("outdoor")),
            // inglês e espanhol (RF23)
            Map.entry("university", List.of("university")), Map.entry("college", List.of("university")), Map.entry("class", List.of("university", "school")), Map.entry("school", List.of("school")),
            Map.entry("work", List.of("work")), Map.entry("office", List.of("work", "business")), Map.entry("meeting", List.of("business")), Map.entry("presentation", List.of("business", "formal")),
            Map.entry("interview", List.of("business", "formal")), Map.entry("party", List.of("party")), Map.entry("club", List.of("night_out")), Map.entry("dinner", List.of("date", "social")),
            Map.entry("date", List.of("date")), Map.entry("wedding", List.of("wedding")), Map.entry("graduation", List.of("ceremony", "formal")), Map.entry("beach", List.of("beach")),
            Map.entry("pool", List.of("beach")), Map.entry("trip", List.of("travel")), Map.entry("travel", List.of("travel")), Map.entry("gym", List.of("gym")), Map.entry("workout", List.of("gym", "sport")),
            Map.entry("running", List.of("sport")), Map.entry("sport", List.of("sport")), Map.entry("home", List.of("home")), Map.entry("concert", List.of("festival")), Map.entry("walk", List.of("casual", "outdoor")), Map.entry("park", List.of("outdoor")),
            Map.entry("universidad", List.of("university")), Map.entry("clase", List.of("university", "school")), Map.entry("escuela", List.of("school")), Map.entry("oficina", List.of("work", "business")),
            Map.entry("reunión", List.of("business")), Map.entry("reunion", List.of("business")), Map.entry("presentación", List.of("business", "formal")), Map.entry("presentacion", List.of("business", "formal")),
            Map.entry("fiesta", List.of("party")), Map.entry("discoteca", List.of("night_out")), Map.entry("cena", List.of("date", "social")),
            Map.entry("cita", List.of("date")), Map.entry("boda", List.of("wedding")), Map.entry("graduación", List.of("ceremony", "formal")), Map.entry("graduacion", List.of("ceremony", "formal")),
            Map.entry("playa", List.of("beach")), Map.entry("viaje", List.of("travel")), Map.entry("gimnasio", List.of("gym")), Map.entry("entrenamiento", List.of("gym", "sport")),
            Map.entry("carrera", List.of("sport")), Map.entry("deporte", List.of("sport")), Map.entry("concierto", List.of("festival")), Map.entry("paseo", List.of("casual", "outdoor")));

    static Interpretation localInterpretation(String prompt, List<UUID> anchors) {
        String p = prompt == null ? "" : prompt.toLowerCase(Locale.ROOT);
        LinkedHashSet<String> occ = new LinkedHashSet<>();
        KEYWORDS.forEach((k, v) -> {
            if (p.contains(k)) {
                occ.addAll(v);
            }
        });
        String mood = p.contains("confort") || p.contains("relax") ? "COMFORTABLE" : p.contains("eleg") || p.contains("chique") ? "ELEGANT"
                : p.contains("sofistic") ? "SOPHISTICATED" : p.contains("energ") || p.contains("anim") ? "ENERGETIC" : null;
        List<String> constraints = new ArrayList<>();
        if (p.contains("frio") || p.contains("chuva")) {
            constraints.add("cold");
        }
        if (p.contains("calor") || p.contains("quente") || p.contains("sol")) {
            constraints.add("hot");
        }
        if (p.contains("diferente") || p.contains("ousad")) {
            constraints.add("different_from_usual");
        }
        if (p.contains("preto") || p.contains("monocrom")) {
            constraints.add("monochrome");
        }
        if (occ.isEmpty()) {
            occ.add("casual");
        }
        String season = constraints.contains("cold") ? "WINTER" : constraints.contains("hot") ? "SUMMER" : null;
        return new Interpretation(new ArrayList<>(occ).subList(0, Math.min(3, occ.size())), mood, anchors, constraints, season);
    }

    Interpretation interpret(CurrentUser user, String prompt, List<UUID> anchors, List<WardrobeItem> eligible, AiOutcome<?>[] holder) {
        Map<String, UUID> refs = new LinkedHashMap<>();
        List<Map<String, Object>> names = new ArrayList<>();
        int i = 1;
        for (WardrobeItem w : eligible) {
            String ref = "p" + i++;
            refs.put(ref, w.getId());
            names.add(Map.of("ref", ref, "name", String.valueOf(w.getName()), "subcategory", String.valueOf(w.getSubcategory()),
                    "color", String.valueOf(w.getColor())));
        }
        Interpretation local = localInterpretation(prompt, anchors);
        AiOutcome<Interpretation> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.COPILOT,
                Msg.t("mirror.interprete_o_pedido_de_look", Taxonomy.OCCASIONS),
                "Pedido: " + prompt + "\nPeças do acervo (refs): " + Json.write(names) + "\nÂncoras já escolhidas: " + anchors,
                List.of(), 400, List.of(Msg.t("mirror.texto_do_pedido"), Msg.t("mirror.nomes_subcategorias_das_pecas")),
                text -> {
                    Map<String, Object> m = WardrobeService.extractJson(text);
                    if (m.isEmpty()) {
                        return null;
                    }
                    List<String> occ = m.get("occasion") instanceof List<?> l ? l.stream().map(String::valueOf).filter(Taxonomy.OCCASIONS::contains)
                            .distinct().limit(3).toList() : List.of();
                    String mood = m.get("mood") == null ? null : String.valueOf(m.get("mood"));
                    if (mood != null && !Set.of("ENERGETIC", "ELEGANT", "COMFORTABLE", "SOPHISTICATED").contains(mood)) {
                        mood = null;
                    }
                    LinkedHashSet<UUID> anc = new LinkedHashSet<>(anchors);
                    if (m.get("anchor_refs") instanceof List<?> l) {
                        l.stream().map(String::valueOf).map(refs::get).filter(Objects::nonNull).forEach(anc::add);
                    }
                    List<String> cons = m.get("constraints") instanceof List<?> l ? l.stream().map(String::valueOf).map(c -> InputSanitizer.clean(c, 30))
                            .limit(5).toList() : List.of();
                    String season = m.get("season") == null ? null : String.valueOf(m.get("season"));
                    if (season != null && !Set.of("SPRING", "SUMMER", "AUTUMN", "WINTER").contains(season)) {
                        season = null;
                    }
                    return new Interpretation(occ.isEmpty() ? local.occasion() : occ, mood == null ? local.mood() : mood, new ArrayList<>(anc), cons, season);
                }, () -> local, null));
        holder[0] = outcome;
        return outcome.value() == null ? local : outcome.value();
    }

    /** Composição com âncoras obrigatórias e sem repetir as já mostradas — IA validada ou regras locais. */
    Optional<List<WardrobeItem>> compose(CurrentUser user, Interpretation it, List<WardrobeItem> eligible, Set<String> shown,
                                         List<WardrobeItem> mirrorContext, AiOutcome<?>[] holder) {
        Map<String, WardrobeItem> byRef = new LinkedHashMap<>();
        List<Map<String, Object>> catalog = new ArrayList<>();
        int i = 1;
        for (WardrobeItem w : eligible) {
            String ref = "p" + i++;
            byRef.put(ref, w);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ref", ref);
            m.put("name", w.getName());
            m.put("slot", slotOf(w));
            m.put("subcategory", w.getSubcategory());
            m.put("color", w.getColor());
            m.put("style", Json.csv(w.getStyleTags()));
            m.put("occasion", Json.csv(w.getOccasionTags()));
            m.put("anchor", it.anchors().contains(w.getId()));
            catalog.add(m);
        }
        Set<UUID> eligibleIds = byRef.values().stream().map(WardrobeItem::getId).collect(Collectors.toSet());
        java.util.function.Supplier<List<WardrobeItem>> local = () -> localCompose(it, eligible, shown);
        AiOutcome<List<WardrobeItem>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.SCHEME_COMPOSER,
                "Você é o Vista-me do Smart Mirror do Fashion AI. Monte UM look completo usando SOMENTE as peças do acervo (refs). "
                        + "Obrigatório: (upper + lower) ou dress, e shoes; até 1 outer_layer e até 2 accessory. Toda peça marcada anchor=true DEVE "
                        + "entrar. Nunca invente peças. Responda SOMENTE com JSON {\"refs\":[...],\"title\":string,\"rationale\":\"até 2 frases\"}.",
                Msg.t("mirror.pedido_interpretado_acervo_elegivel", Json.write(Map.of("occasion", it.occasion(), "mood", String.valueOf(it.mood()), "constraints", it.constraints(),
                        "season", String.valueOf(it.season()))), Json.write(catalog), (mirrorContext.isEmpty() ? "" : "\nJá no espelho (prefira manter): " + mirrorContext.stream().map(WardrobeItem::getName).toList()), (shown.isEmpty() ? "" : "\nNÃO repita estas combinações (ids ordenados): " + shown)),
                List.of(), 700, List.of("acervo elegível (metadados, sem fotos)", "pedido interpretado", Msg.t("mirror.combinacoes_ja_mostradas_na_sessao")),
                text -> {
                    Map<String, Object> m = WardrobeService.extractJson(text);
                    if (!(m.get("refs") instanceof List<?> refs)) {
                        return null;
                    }
                    List<WardrobeItem> chosen = new ArrayList<>();
                    for (Object r : refs) {
                        WardrobeItem w = byRef.get(String.valueOf(r));
                        if (w == null || !eligibleIds.contains(w.getId())) {
                            // RF33.CA09 — id fora do conjunto elegível: descarta a sugestão inteira e registra
                            audit.log(user, "VISTA_ME_SUGESTAO_DESCARTADA", "mirror:" + user.id(), Map.of("ref", String.valueOf(r), "motivo", "id fora do conjunto elegível"));
                            return null;
                        }
                        if (!chosen.contains(w)) {
                            chosen.add(w);
                        }
                    }
                    if (!chosen.stream().map(WardrobeItem::getId).collect(Collectors.toSet()).containsAll(it.anchors())) {
                        audit.log(user, "VISTA_ME_SUGESTAO_DESCARTADA", "mirror:" + user.id(), Map.of("motivo", "âncora ausente"));
                        return null;
                    }
                    if (chosen.size() < 2 || shown.contains(key(chosen.stream().map(WardrobeItem::getId).toList()))) {
                        return null;
                    }
                    return chosen;
                }, local, null));
        holder[0] = outcome;
        List<WardrobeItem> look = outcome.value() == null ? local.get() : outcome.value();
        return look == null || look.isEmpty() ? Optional.empty() : Optional.of(look);
    }

    static List<WardrobeItem> localCompose(Interpretation it, List<WardrobeItem> eligible, Set<String> shown) {
        Set<UUID> anchors = new HashSet<>(it.anchors());
        List<LocalSchemeComposer.Composition> comps = LocalSchemeComposer.compose(eligible, it.occasion(), List.of(), it.season(),
                String.join(" ", it.constraints()), 24);
        Map<UUID, WardrobeItem> byId = eligible.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        for (LocalSchemeComposer.Composition c : comps) {
            List<UUID> ids = c.items().stream().map(LocalSchemeComposer.Pick::wardrobeItemId).toList();
            if (ids.containsAll(anchors) && !shown.contains(key(ids))) {
                return ids.stream().map(byId::get).filter(Objects::nonNull).toList();
            }
        }
        // monta na mão: âncoras + melhor candidata por slot faltante (similaridade com as âncoras + ocasião)
        List<WardrobeItem> look = new ArrayList<>(anchors.stream().map(byId::get).filter(Objects::nonNull).toList());
        Set<String> filled = look.stream().map(MirrorService::slotOf).collect(Collectors.toSet());
        List<String> need = new ArrayList<>();
        if (!filled.contains("dress")) {
            if (!filled.contains("upper")) {
                need.add("upper");
            }
            if (!filled.contains("lower")) {
                need.add("lower");
            }
        }
        if (!filled.contains("shoes")) {
            need.add("shoes");
        }
        for (String slot : need) {
            List<WardrobeItem> cands = eligible.stream().filter(w -> slotOf(w).equals(slot)).filter(w -> !look.contains(w)).toList();
            if (slot.equals("upper") && cands.isEmpty()) {
                cands = eligible.stream().filter(w -> slotOf(w).equals("dress")).toList();
            }
            List<Map<String, Object>> ranked = localAlternatives(cands, look);
            for (Map<String, Object> r : ranked) {
                WardrobeItem w = byId.get((UUID) r.get("pieceId"));
                if (w != null && !shown.contains(key(concat(look, w)))) {
                    look.add(w);
                    break;
                }
            }
            if (look.stream().noneMatch(w -> slotOf(w).equals(slot)) && !ranked.isEmpty()) {
                look.add(byId.get((UUID) ranked.get(0).get("pieceId")));
            }
        }
        return look.size() >= 2 ? look : List.of();
    }

    private static List<UUID> concat(List<WardrobeItem> look, WardrobeItem w) {
        List<UUID> ids = look.stream().map(WardrobeItem::getId).collect(Collectors.toCollection(ArrayList::new));
        ids.add(w.getId());
        return ids;
    }

    @Transactional
    public Map<String, Object> vistaMe(CurrentUser user, String rawPrompt, List<UUID> anchorIds, UUID focusPieceId, boolean keepMirror) {
        String prompt = InputSanitizer.clean(rawPrompt == null ? "" : rawPrompt, 300);
        MirrorState s = stateEntity(user.id());
        Map<String, Object> slots = slots(s);
        List<WardrobeItem> eligible = eligible(user.id());
        boolean hasTop = eligible.stream().anyMatch(w -> slotOf(w).equals("upper") || slotOf(w).equals("dress"));
        if (!hasTop) {
            throw new ApiException(422, "ACERVO_SEM_SUPERIOR", Msg.t("mirror.voce_ainda_nao_tem_peca"), Map.of("href", "/pieces/new", "rf", "RF33.CA14"));
        }
        Set<UUID> eligibleIds = eligible.stream().map(WardrobeItem::getId).collect(Collectors.toSet());
        LinkedHashSet<UUID> anchors = new LinkedHashSet<>();
        if (anchorIds != null) {
            anchorIds.stream().filter(eligibleIds::contains).forEach(anchors::add);
        }
        String low = prompt.toLowerCase(Locale.ROOT);
        if (focusPieceId != null && eligibleIds.contains(focusPieceId) && (low.contains("esta ") || low.contains("essa ") || low.contains("este ")
                || low.contains("esse ") || low.contains("usar"))) {
            anchors.add(focusPieceId);
        }
        List<WardrobeItem> mirrorContext = keepMirror ? load(user.id(), allIds(slots)).values().stream().filter(w -> eligibleIds.contains(w.getId())).toList() : List.of();
        AiOutcome<?>[] holder = new AiOutcome<?>[1];
        Interpretation it = interpret(user, prompt, new ArrayList<>(anchors), eligible, holder);
        AiOutcome<?> interpretOutcome = holder[0];
        Set<String> shown = new LinkedHashSet<>(Json.strings(s.getShownCombinationsJson()));
        Optional<List<WardrobeItem>> composed = compose(user, it, eligible, shown, mirrorContext, holder);
        AiOutcome<?> composeOutcome = holder[0];
        if (composed.isEmpty()) {
            throw new ApiException(422, "SEM_COMBINACAO_NOVA", Msg.t("mirror.nao_encontrei_uma_combinacao_nova"),
                    Map.of("href", "/pieces/new"));
        }
        List<WardrobeItem> look = composed.get();
        Map<String, Object> newSlots = new LinkedHashMap<>();
        List<String> acc = new ArrayList<>();
        for (WardrobeItem w : look) {
            String slot = slotOf(w);
            if (slot.equals("accessory")) {
                if (acc.size() < MAX_ACCESSORIES) {
                    acc.add(w.getId().toString());
                }
            } else {
                newSlots.put(slot, w.getId().toString());
            }
        }
        newSlots.put("accessory", acc);
        newSlots.put("origin", "vista_me");
        newSlots.put("prompt", prompt);
        newSlots.put("interpretation", Map.of("occasion", it.occasion(), "mood", String.valueOf(it.mood()), "anchors", it.anchors().stream().map(UUID::toString).toList(),
                "constraints", it.constraints(), "season", String.valueOf(it.season())));
        newSlots.put("updatedAt", Instant.now().toString());
        // a lista do espelho continua: o look sugerido entra nela, as peças que a pessoa trouxe ficam
        putRack(newSlots, rack(slots(s)));
        look.forEach(w -> addToRack(newSlots, w.getId()));
        shown.add(key(look.stream().map(WardrobeItem::getId).toList()));
        List<String> shownList = new ArrayList<>(shown);
        if (shownList.size() > MAX_SHOWN) {
            shownList = shownList.subList(shownList.size() - MAX_SHOWN, shownList.size());
        }
        s.setSlotsJson(Json.write(newSlots));
        s.setShownCombinationsJson(Json.write(shownList));
        s.setLastPrompt(prompt);
        mirrors.save(s);
        int hour = LocalDateTime.now(FaiPointsService.ZONE).getHour();
        events.publishEvent(new DomainEvents.MirrorAction(user.id(), hour < 5 ? "VISTA_ME_MADRUGADA" : "VISTA_ME"));

        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        List<Map<String, Object>> sequence = new ArrayList<>();
        for (WardrobeItem w : look) {
            RoomService.Location loc = where.get(w.getId());
            sequence.add(Map.of("pieceId", w.getId(), "name", String.valueOf(w.getName()), "address", loc == null ? "" : loc.address().toString(),
                    "label", loc == null ? "" : loc.label(), "moduleId", loc == null ? "" : loc.moduleId(),
                    "legend", w.getName() + " — " + (loc == null ? Msg.t("common.posicao_desconhecida") : loc.label())));
        }
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("sequence", sequence);
        extra.put("legend", sequence.stream().map(m -> String.valueOf(m.get("legend"))).toList());
        extra.put("fallbackUsed", (composeOutcome != null && composeOutcome.fallbackUsed()) || (interpretOutcome != null && interpretOutcome.fallbackUsed()));
        extra.put("fallbackMessage", composeOutcome != null && composeOutcome.fallbackUsed()
                ? Msg.t("mirror.sugestao_montada_por_regras_locais") : null);
        extra.put("explanation", composeOutcome == null ? null : composeOutcome.explanation());
        extra.put("quota", composeOutcome == null ? null : composeOutcome.quota());
        extra.put("message", composeOutcome == null ? null : composeOutcome.userMessage());
        extra.put("actions", List.of("USAR_ESTE_LOOK", "TROCAR_UMA_PECA", "REMIXAR", "SALVAR", "OUTRA_SUGESTAO", "CRIAR_LOOK_COM_ESTAS_PECAS"));
        restriction(user.id()).ifPresent(r -> extra.put("challengeNotice", Msg.t("mirror.respeitando_o_desafio_so_as", r.challengeName())));
        return render(user, s, newSlots, extra);
    }

    /** RF33.CA13 — outra sugestão para o mesmo pedido, sem repetir as já mostradas na sessão. */
    @Transactional
    public Map<String, Object> another(CurrentUser user) {
        MirrorState s = stateEntity(user.id());
        Map<String, Object> slots = slots(s);
        List<UUID> anchors = new ArrayList<>();
        if (slots.get("interpretation") instanceof Map<?, ?> m && m.get("anchors") instanceof List<?> l) {
            l.forEach(o -> anchors.add(UUID.fromString(String.valueOf(o))));
        }
        return vistaMe(user, s.getLastPrompt() == null ? "" : s.getLastPrompt(), anchors, null, false);
    }

    /** RF33.CA12 — "Trocar uma peça": até 3 alternativas para o slot, mantendo as demais. */
    @Transactional
    public Map<String, Object> swap(CurrentUser user, String slot) {
        return suggest(user, slot);
    }

    // ================================================================== "Tira uma coisa" (DET-M01)
    @Transactional
    public Map<String, Object> takeOneOff(CurrentUser user) {
        MirrorState s = stateEntity(user.id());
        Map<String, Object> slots = slots(s);
        if (!complete(slots)) {
            throw new ApiException(409, "LOOK_INCOMPLETO", Msg.t("mirror.complete_o_look_superior_inferior"));
        }
        List<UUID> wantRack = rack(slots);
        List<UUID> toLoad = new ArrayList<>(allIds(slots));
        wantRack.stream().filter(id -> !toLoad.contains(id)).forEach(toLoad::add);
        Map<UUID, WardrobeItem> loaded = load(user.id(), toLoad);
        List<WardrobeItem> removable = new ArrayList<>();
        accessories(slots).stream().map(loaded::get).filter(Objects::nonNull).forEach(removable::add);
        UUID outer = single(slots, "outer_layer");
        if (outer != null && loaded.containsKey(outer)) {
            removable.add(loaded.get(outer));
        }
        if (removable.isEmpty()) {
            throw new ApiException(409, "NADA_A_TIRAR", Msg.t("mirror.esse_look_nao_tem_acessorio"));
        }
        List<WardrobeItem> look = allIds(slots).stream().map(loaded::get).filter(Objects::nonNull).toList();
        Map<String, WardrobeItem> byRef = new LinkedHashMap<>();
        List<Map<String, Object>> cands = new ArrayList<>();
        int i = 1;
        for (WardrobeItem w : removable) {
            String ref = "r" + i++;
            byRef.put(ref, w);
            cands.add(Map.of("ref", ref, "name", String.valueOf(w.getName()), "subcategory", String.valueOf(w.getSubcategory()), "color", String.valueOf(w.getColor())));
        }
        AiOutcome<Map<String, Object>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.STYLE_ADVISOR,
                "Regra de Coco Chanel: antes de sair, tire uma coisa. Entre as peças removíveis (refs), escolha UMA para tirar e diga por quê em 1 frase "
                        + "curta (ex.: 'o colar compete com a estampa'). Responda SOMENTE com JSON {\"remove_ref\":\"r1\",\"why\":\"...\"}.",
                "Look: " + look.stream().map(w -> w.getName() + " (" + w.getSubcategory() + ", " + w.getColor() + ")").toList() + "\nRemovíveis: " + Json.write(cands),
                List.of(), 200, List.of(Msg.t("mirror.pecas_do_look_no_espelho")),
                text -> {
                    Map<String, Object> m = WardrobeService.extractJson(text);
                    WardrobeItem w = byRef.get(String.valueOf(m.get("remove_ref")));
                    return w == null ? null : Map.of("pieceId", w.getId(), "why", InputSanitizer.clean((m.get("why") == null ? "" : String.valueOf(m.get("why"))), 160));
                },
                () -> localTakeOneOff(removable, look), null));
        Map<String, Object> pick = outcome.value() == null ? localTakeOneOff(removable, look) : outcome.value();
        UUID removeId = (UUID) pick.get("pieceId");
        WardrobeItem removed = loaded.get(removeId);
        Map<String, Object> state = remove(user, removeId);
        events.publishEvent(new DomainEvents.MirrorAction(user.id(), "TIRA_UMA_COISA"));
        Map<String, Object> out = new LinkedHashMap<>(state);
        out.put("removed", pieceView(removed, room.locateAll(user.id())));
        out.put("why", pick.get("why"));
        out.put("fallbackUsed", outcome.fallbackUsed());
        out.put("explanation", outcome.explanation());
        return out;
    }

    static Map<String, Object> localTakeOneOff(List<WardrobeItem> removable, List<WardrobeItem> look) {
        Map<String, Long> families = look.stream().map(w -> Taxonomy.COLOR_FAMILY.getOrDefault(w.getColor(), "Especiais"))
                .collect(Collectors.groupingBy(f -> f, Collectors.counting()));
        WardrobeItem pick = removable.stream().filter(w -> "print".equals(w.getColor()) || "multicolor".equals(w.getColor())).findFirst()
                .orElseGet(() -> removable.stream().min((a, b) -> Long.compare(families.getOrDefault(Taxonomy.COLOR_FAMILY.get(a.getColor()), 0L),
                        families.getOrDefault(Taxonomy.COLOR_FAMILY.get(b.getColor()), 0L))).orElse(removable.get(removable.size() - 1)));
        String why = "print".equals(pick.getColor()) || "multicolor".equals(pick.getColor()) ? Msg.t("mirror.a_estampa_compete_com_o")
                : Msg.t("mirror.e_a_cor_que_menos");
        return Map.of("pieceId", pick.getId(), "why", why);
    }

    // ================================================================== usar / salvar / entregar ao RF5
    private Scheme findExistingScheme(UUID userId, List<UUID> ids, TipoLook tipo) {
        String key = key(ids);
        for (Scheme s : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(userId, SchemeStatus.ARCHIVED)) {
            List<UUID> sIds = schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).stream().map(si -> si.getWardrobeItem().getId()).toList();
            if (sIds.size() == ids.size() && key(sIds).equals(key)
                    && Objects.equals(s.getTipoLook() == null ? null : s.getTipoLook().getId(), tipo == null ? null : tipo.getId())) {
                return s;
            }
        }
        return null;
    }

    private Scheme materialize(CurrentUser user, MirrorState mirror, Map<String, Object> slots, String title, boolean publish) {
        List<UUID> ids = allIds(slots);
        if (ids.size() < 2) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("mirror.leve_ao_menos_2_pecas"));
        }
        Scheme existing = findExistingScheme(user.id(), ids, mirror.getTipoLook());
        if (existing != null) {
            return existing;
        }
        Map<UUID, WardrobeItem> loaded = load(user.id(), ids);
        SchemeOrigin origin = "vista_me".equals(slots.get("origin")) ? SchemeOrigin.VISTA_ME : SchemeOrigin.SMART_MIRROR;
        List<SchemeService.ItemForm> items = new ArrayList<>();
        int order = 0;
        for (UUID id : ids) {
            WardrobeItem w = loaded.get(id);
            if (w != null) {
                items.add(new SchemeService.ItemForm(id, schemeSlot(slotOf(w)), order, order, null, null, null, null, null, null));
                order++;
            }
        }
        List<WardrobeItem> look = ids.stream().map(loaded::get).filter(Objects::nonNull).toList();
        List<String> occasions = new ArrayList<>();
        if (slots.get("interpretation") instanceof Map<?, ?> m && m.get("occasion") instanceof List<?> l) {
            l.stream().map(String::valueOf).filter(Taxonomy.OCCASIONS::contains).limit(3).forEach(occasions::add);
        }
        LocalSchemeComposer.Composition base = LocalSchemeComposer.toComposition(look, occasions, List.of(), null, 0);
        String finalTitle = title != null && !title.isBlank() ? InputSanitizer.clean(title, 120)
                : (origin == SchemeOrigin.VISTA_ME ? Msg.t("mirror.vista_me") : Msg.t("mirror.espelho")) + LocalDate.now(FaiPointsService.ZONE).format(DAY);
        SchemeService.SchemeForm form = new SchemeService.SchemeForm(finalTitle, slots.get("prompt") == null ? null : "Pedido: " + slots.get("prompt"),
                base.occasions(), base.styles(), null, null, null, null, items, origin == SchemeOrigin.VISTA_ME ? CreationMode.AI_ASSISTED : CreationMode.MANUAL, origin, null, null, Boolean.TRUE,
                null, null, null, null, publish, null);
        Map<String, Object> created = schemeService.create(user, form);
        Views.SchemeView view = (Views.SchemeView) created.get("scheme");
        Scheme scheme = schemes.findById(view.id()).orElseThrow();
        scheme.setTipoLook(mirror.getTipoLook());
        return schemes.save(scheme);
    }

    /** RF33.CA11 / §2.3 — "Usar este look": cria o esquema se necessário e registra o Look do Dia. */
    @Transactional
    public Map<String, Object> useLook(CurrentUser user) {
        MirrorState s = stateEntity(user.id());
        Map<String, Object> slots = slots(s);
        if (!complete(slots)) {
            throw new ApiException(409, "LOOK_INCOMPLETO", Msg.t("mirror.o_look_do_dia_precisa"));
        }
        Scheme scheme = materialize(user, s, slots, null, false);
        DailyLookSource source = scheme.getOrigin() == SchemeOrigin.VISTA_ME ? DailyLookSource.VISTA_ME : DailyLookSource.SMART_MIRROR;
        var dl = dailyLooks.register(user, scheme, source, LocalDate.now(FaiPointsService.ZONE));
        events.publishEvent(new DomainEvents.MirrorAction(user.id(), "USE_LOOK"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("schemeId", scheme.getId());
        out.put("dailyLook", dailyLooks.view(dl));
        out.put("source", source.name());
        out.put("closing", Map.of("animation", "fecho_vista_me", "steps", List.of("porta_fecha", "luz_sobe", "foto_do_look"), "respectsReduceMotion", true));
        out.put("message", Msg.t("mirror.look_do_dia_registrado", (source == DailyLookSource.VISTA_ME ? Msg.t("mirror.fai_pts_pelo_vista_me") : "")));
        return out;
    }

    @Transactional
    public Map<String, Object> save(CurrentUser user, String title, boolean publish) {
        MirrorState s = stateEntity(user.id());
        Scheme scheme = materialize(user, s, slots(s), title, publish);
        return Map.of("schemeId", scheme.getId(), "title", String.valueOf(scheme.getTitle()), "origin", scheme.getOrigin().name());
    }

    /** RF33.CA07 / §2.4 — payload RoomLookDraft para o Criar Look (sessionStorage 'sai_room_look_draft'). */
    @Transactional(readOnly = true)
    public Map<String, Object> draft(CurrentUser user, String originOverride) {
        MirrorState s = stateEntity(user.id());
        Map<String, Object> slots = slots(s);
        Map<String, Object> d = new LinkedHashMap<>();
        String origin = originOverride != null ? originOverride : String.valueOf(slots.getOrDefault("origin", "smart_mirror"));
        d.put("origin", origin.equals("manual") ? "smart_mirror" : origin);
        Map<String, String> ss = new LinkedHashMap<>();
        for (String slot : List.of("upper", "lower", "dress", "shoes", "outer_layer")) {
            UUID id = single(slots, slot);
            if (id != null) {
                ss.put(slot, id.toString());
            }
        }
        d.put("slots", ss);
        d.put("tipoLook", Views.tipoLook(s.getTipoLook()));
        d.put("accessories", accessories(slots).stream().map(UUID::toString).toList());
        if (slots.get("interpretation") instanceof Map<?, ?> m && m.get("occasion") instanceof List<?> l && !l.isEmpty()) {
            d.put("occasion", String.valueOf(l.get(0)));
        }
        d.put("prompt", slots.get("prompt"));
        d.put("created_at", Instant.now().toString());
        d.put("sessionStorageKey", "sai_room_look_draft");
        return d;
    }

    /** DET-K02 — "Arrume-se Comigo": storyboard (≤ 15 s) das portas acendendo, peças indo ao espelho e o look pronto. */
    @Transactional
    public Map<String, Object> grwmStoryboard(CurrentUser user) {
        MirrorState s = stateEntity(user.id());
        Map<String, Object> slots = slots(s);
        List<UUID> ids = allIds(slots);
        if (ids.isEmpty()) {
            throw new ApiException(409, "ESPELHO_VAZIO", Msg.t("mirror.monte_um_look_no_espelho"));
        }
        Map<UUID, WardrobeItem> loaded = load(user.id(), ids);
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        int per = Math.min(2500, 12000 / Math.max(1, ids.size()));
        List<Map<String, Object>> steps = new ArrayList<>();
        int t = 0;
        for (UUID id : ids) {
            WardrobeItem w = loaded.get(id);
            if (w == null) {
                continue;
            }
            RoomService.Location loc = where.get(id);
            steps.add(Map.of("at", t, "durationMs", per, "moduleId", loc == null ? "" : loc.moduleId(), "address", loc == null ? "" : loc.address().toString(),
                    "pieceId", id, "imageUrl", String.valueOf(w.getImageUrl()), "caption", w.getName() + (loc == null ? "" : " — " + loc.label())));
            t += per;
        }
        steps.add(Map.of("at", t, "durationMs", 3000, "moduleId", "mirror", "caption", Msg.t("mirror.look_pronto")));
        events.publishEvent(new DomainEvents.MirrorAction(user.id(), "GRWM_VIDEO"));
        return Map.of("format", "9:16", "maxSeconds", 15, "totalMs", t + 3000, "steps", steps, "music", Msg.t("mirror.sem_trilha_com_direitos_autorais"),
                "watermark", "FAI", "excludes", List.of(Msg.t("common.preco"), "marca (ETI-04)"));
    }
}
