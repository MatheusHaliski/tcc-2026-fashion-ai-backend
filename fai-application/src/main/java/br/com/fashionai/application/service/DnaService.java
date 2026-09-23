package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.ai.local.LocalDnaSynthesizer;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.DnaScheme;
import br.com.fashionai.domain.model.DnaSchemeItem;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.StyleDnaVersion;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.DailyLookFeedback;
import br.com.fashionai.domain.model.enums.DnaCell;
import br.com.fashionai.domain.model.enums.NarrativeType;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.StyleArchetype;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.DnaSchemeItemRepository;
import br.com.fashionai.domain.repository.DnaSchemeRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.StyleDnaVersionRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF13 / HU20 — DNA de Estilo: pré-requisitos (≥ 10 peças e ≥ 5 avaliações positivas), Camada 1 inferida
 * (arquétipo, paleta de 5 cores ΔE-agrupada, silhueta, índice de ousadia em percentil, peça ícone que nunca é acessório
 * básico), Camada 2 declarada e cifrada (lugares ≤ 3, pessoas ≤ 3, animais ≤ 2, objetos ≤ 4; 30 caracteres),
 * Frase de Identidade sintetizada pela IA, versões, recálculo a cada 10 interações, card PNG com marca d'água só com
 * campos visíveis (link expira em 30 dias) — e os Esquemas de DNA (anatomias A1–A4 e 12 narrativas do DNA v4).
 */
@Service
public class DnaService {
    public static final int MIN_PIECES = 10;
    public static final int MIN_POSITIVE = 5;
    public static final int RECALC_INTERACTIONS = 10;
    static final Map<String, Integer> LIFE_LIMITS = Map.of("places", 3, "people", 3, "animals", 2, "objects", 4);
    static final Set<String> BASIC_ACCESSORIES = Set.of("socks", "belt", "hair_accessory", "gloves", "beanie");
    public static final List<String> LAYOUTS = List.of("AMPLIADO", "GRADE", "HORIZONTAL", "LATERAL");
    static final Map<StyleArchetype, String> ARCHETYPE_LABEL = new EnumMap<>(StyleArchetype.class);

    static {
        ARCHETYPE_LABEL.put(StyleArchetype.ROMANTIC, "Romântico");
        ARCHETYPE_LABEL.put(StyleArchetype.DRAMATIC, "Dramático");
        ARCHETYPE_LABEL.put(StyleArchetype.CLASSIC, "Clássico");
        ARCHETYPE_LABEL.put(StyleArchetype.NATURAL, "Natural");
        ARCHETYPE_LABEL.put(StyleArchetype.GAMINE, "Gamine");
    }

    private final StyleDnaRepository dnas;
    private final StyleDnaVersionRepository versions;
    private final DnaSchemeRepository dnaSchemes;
    private final DnaSchemeItemRepository dnaItems;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final DailyLookRepository dailyLooks;
    private final UserRepository users;
    private final MediaService media;
    private final NotificationService notifications;
    private final AiEngine ai;
    private final Guard guard;

    public DnaService(StyleDnaRepository dnas, StyleDnaVersionRepository versions, DnaSchemeRepository dnaSchemes, DnaSchemeItemRepository dnaItems,
                      WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems, DailyLookRepository dailyLooks,
                      UserRepository users, MediaService media,
                      NotificationService notifications, AiEngine ai, Guard guard) {
        this.dnas = dnas;
        this.versions = versions;
        this.dnaSchemes = dnaSchemes;
        this.dnaItems = dnaItems;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dailyLooks = dailyLooks;
        this.users = users;
        this.media = media;
        this.notifications = notifications;
        this.ai = ai;
        this.guard = guard;
    }

    // ================================================================== pré-requisitos (CA01/CA02)
    long positiveFeedbacks(UUID userId) {
        return dailyLooks.countByUserIdAndFeedback(userId, DailyLookFeedback.ADOREI);
    }

    long activePieces(UUID userId) {
        return pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).count();
    }

    int interactions(UUID userId) {
        return (int) (schemes.countByUserId(userId) + dailyLooks.findTop60ByUserIdOrderByLookDateDesc(userId).stream().filter(d -> d.getFeedback() != null).count()
                + activePieces(userId));
    }

    @Transactional
    public Map<String, Object> overview(CurrentUser user) {
        long p = activePieces(user.id());
        long f = positiveFeedbacks(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        boolean ready = p >= MIN_PIECES && f >= MIN_POSITIVE;
        out.put("prerequisites", Map.of("pieces", p, "piecesRequired", MIN_PIECES, "positiveFeedbacks", f, "feedbacksRequired", MIN_POSITIVE,
                "missingPieces", Math.max(0, MIN_PIECES - p), "missingFeedbacks", Math.max(0, MIN_POSITIVE - f), "ready", ready));
        Optional<StyleDna> dna = dnas.findByUserId(user.id()).filter(d -> d.getSynthesizedAt() != null);
        out.put("generated", dna.isPresent());
        if (!ready && dna.isEmpty()) {
            out.put("progressMessage", "Faltam " + Math.max(0, MIN_PIECES - p) + " peça(s) e " + Math.max(0, MIN_POSITIVE - f)
                    + " avaliação(ões) \"adorei\" para destravar seu DNA de Estilo.");
            out.put("actions", List.of(Map.of("label", "Adicionar peça", "href", "/add-piece"), Map.of("label", "Avaliar Look do Dia", "href", "/profile?tab=daily")));
            return out;
        }
        if (dna.isEmpty()) {
            out.put("lifeForm", lifeFormSpec());
            return out;
        }
        StyleDna d = dna.get();
        if (interactions(user.id()) - d.getInteractionsAtSynthesis() >= RECALC_INTERACTIONS) {
            synthesize(user, d, true, "EVOLUCAO");
            notifications.notify(user.id(), null, NotificationType.AI_JOB_FINISHED, "DNA", d.getId(), "Sua identidade evoluiu ✨",
                    "Recalculamos a Camada 1 do seu DNA de Estilo com as suas novas interações.", Map.of());
        }
        out.put("dna", view(d, true));
        out.put("versions", versions.findTop20ByUserIdOrderByCreatedAtDesc(user.id()).stream().map(v -> Map.of("id", v.getId(), "createdAt", v.getCreatedAt(),
                "snapshot", Json.map(v.getSnapshotJson()))).toList());
        out.put("lifeForm", lifeFormSpec());
        return out;
    }

    static Map<String, Object> lifeFormSpec() {
        return Map.of("places", Map.of("label", "Lugares", "max", 3, "examples", "cidade natal, lugar favorito, destino dos sonhos"),
                "people", Map.of("label", "Pessoas", "max", 3, "examples", "nomes ou apelidos (sem foto de terceiros)"),
                "animals", Map.of("label", "Animais", "max", 2, "examples", "nome e espécie do pet"),
                "objects", Map.of("label", "Objetos / Itens", "max", 4, "examples", "instrumento, livro, bebida, hobby, esporte"),
                "maxChars", 30, "encrypted", true);
    }

    // ================================================================== geração (CA01/CA03/CA04/CA05/CA07/CA08)
    public record LifeForm(Map<String, List<String>> fields, List<String> privateFields, Boolean skip) {
    }

    Map<String, List<String>> validateLife(Map<String, List<String>> raw) {
        Map<String, List<String>> out = new LinkedHashMap<>();
        Map<String, Object> errors = new LinkedHashMap<>();
        if (raw != null) {
            raw.forEach((k, v) -> {
                if (!LIFE_LIMITS.containsKey(k)) {
                    errors.put(k, "Categoria desconhecida.");
                    return;
                }
                List<String> clean = (v == null ? List.<String>of() : v).stream().map(s -> InputSanitizer.clean(s == null ? "" : s, 30))
                        .filter(s -> !s.isBlank()).distinct().toList();
                if (clean.size() > LIFE_LIMITS.get(k)) {
                    errors.put(k, "Máximo de " + LIFE_LIMITS.get(k) + " itens.");
                }
                out.put(k, clean.stream().limit(LIFE_LIMITS.get(k)).toList());
            });
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", "Revise a Identidade de Vida.", errors);
        }
        return out;
    }

    @Transactional
    public Map<String, Object> generate(CurrentUser user, LifeForm form) {
        long p = activePieces(user.id());
        long f = positiveFeedbacks(user.id());
        if (p < MIN_PIECES || f < MIN_POSITIVE) {
            throw new ApiException(422, "PRE_REQUISITOS", "Faltam " + Math.max(0, MIN_PIECES - p) + " peça(s) e " + Math.max(0, MIN_POSITIVE - f)
                    + " avaliação(ões) positiva(s) para gerar o DNA.", Map.of("missingPieces", Math.max(0, MIN_PIECES - p), "missingFeedbacks", Math.max(0, MIN_POSITIVE - f)));
        }
        User owner = users.findById(user.id()).orElseThrow();
        StyleDna d = dnas.findByUserId(user.id()).orElseGet(() -> new StyleDna(owner));
        boolean skip = form == null || Boolean.TRUE.equals(form.skip()) || form.fields() == null || form.fields().values().stream().allMatch(l -> l == null || l.isEmpty());
        if (!skip) {
            d.setLifeIdentityJson(Json.write(validateLife(form.fields())));
            d.setLifePrivateFieldsJson(Json.write(form.privateFields() == null ? List.of() : form.privateFields()));
        }
        dnas.save(d);
        synthesize(user, d, true, "GERACAO");
        Map<String, Object> out = new LinkedHashMap<>(view(d, true));
        if (skip) {
            out.put("notice", "Card gerado só com a Camada 1 (estilo). Você pode enriquecê-lo com a Identidade de Vida a qualquer momento.");
        }
        return out;
    }

    /** CA05 — editar a Identidade de Vida regenera só a Frase; a Camada 1 permanece intacta. */
    @Transactional
    public Map<String, Object> updateLife(CurrentUser user, LifeForm form) {
        StyleDna d = dnas.findByUserId(user.id()).filter(x -> x.getSynthesizedAt() != null).orElseThrow(() -> ApiException.notFound("DNA de Estilo"));
        d.setLifeIdentityJson(Json.write(validateLife(form.fields())));
        d.setLifePrivateFieldsJson(Json.write(form.privateFields() == null ? List.of() : form.privateFields()));
        phrase(user, d);
        d.setCardImageUrl(null);
        dnas.save(d);
        snapshot(d, "EDICAO_VIDA");
        return view(d, true);
    }

    /** CA06 / RN07 — visibilidade por campo da Camada 2 no card exportado. */
    @Transactional
    public Map<String, Object> setPrivateFields(CurrentUser user, List<String> privateFields) {
        StyleDna d = dnas.findByUserId(user.id()).orElseThrow(() -> ApiException.notFound("DNA de Estilo"));
        d.setLifePrivateFieldsJson(Json.write(privateFields == null ? List.of() : privateFields));
        d.setCardImageUrl(null);
        dnas.save(d);
        return view(d, true);
    }

    void synthesize(CurrentUser user, StyleDna d, boolean regeneratePhrase, String reason) {
        List<Scheme> own = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED);
        Map<UUID, List<SchemeItem>> itemsBy = own.isEmpty() ? Map.of() : schemeItems.findBySchemeIdIn(own.stream().map(Scheme::getId).toList()).stream()
                .collect(Collectors.groupingBy(si -> si.getScheme().getId()));
        // looks aprovados (feedback "adorei") pesam em dobro na síntese (HU20 — principal fonte de sinal)
        Set<UUID> loved = dailyLooks.findTop60ByUserIdOrderByLookDateDesc(user.id()).stream().filter(dl -> dl.getFeedback() == DailyLookFeedback.ADOREI)
                .map(dl -> dl.getScheme().getId()).collect(Collectors.toSet());
        List<Scheme> weighted = new ArrayList<>(own);
        own.stream().filter(s -> loved.contains(s.getId())).forEach(weighted::add);
        List<WardrobeItem> wardrobe = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
        LocalDnaSynthesizer.Synthesis syn = ai.local(user.id(), AiCapability.DNA_SYNTHESIZER, List.of("esquemas e peças do acervo", "looks avaliados como \"adorei\""),
                () -> LocalDnaSynthesizer.synthesize(weighted, itemsBy, wardrobe)).value();
        d.setArchetype(syn.archetype());
        d.setBoldnessIndex(boldnessPercentile(user.id(), wardrobe));
        d.setColorPalette(Json.csv(syn.palette()));
        d.setStyleKeywords(Json.csv(syn.styleKeywords()));
        d.setOccasionKeywords(Json.csv(syn.occasionKeywords()));
        d.setIconPieceName(iconPiece(weighted, itemsBy, wardrobe));
        d.setSilhouette(silhouette(wardrobe));
        d.setSynthesizedAt(Instant.now());
        d.setInteractionsAtSynthesis(interactions(user.id()));
        if (regeneratePhrase) {
            phrase(user, d);
        }
        d.setCardImageUrl(null);
        dnas.save(d);
        snapshot(d, reason);
    }

    /** RN04 — a peça ícone nunca é acessório básico; é a mais frequente em looks aprovados. */
    static String iconPiece(List<Scheme> weighted, Map<UUID, List<SchemeItem>> itemsBy, List<WardrobeItem> wardrobe) {
        Map<UUID, Integer> use = new HashMap<>();
        Map<UUID, WardrobeItem> byId = new HashMap<>();
        for (Scheme s : weighted) {
            for (SchemeItem si : itemsBy.getOrDefault(s.getId(), List.of())) {
                WardrobeItem w = si.getWardrobeItem();
                if ("accessory_piece".equals(w.getCategory()) && BASIC_ACCESSORIES.contains(w.getSubcategory())) {
                    continue;
                }
                use.merge(w.getId(), 1, Integer::sum);
                byId.put(w.getId(), w);
            }
        }
        return use.entrySet().stream().max(Map.Entry.comparingByValue()).map(e -> byId.get(e.getKey()).getName())
                .orElse(wardrobe.stream().filter(w -> !"accessory_piece".equals(w.getCategory())).map(WardrobeItem::getName).findFirst().orElse(null));
    }

    static String silhouette(List<WardrobeItem> wardrobe) {
        Set<String> oversized = Set.of("hoodie", "sweatshirt", "parka", "coat", "cargo_pants", "sweatpants", "jogger_pants", "kimono");
        Set<String> fitted = Set.of("bodysuit", "crop_top", "leggings", "tank_top", "tailored_pants", "skirt");
        Set<String> layering = Set.of("blazer", "cardigan", "jacket", "vest", "windbreaker", "coat");
        long o = wardrobe.stream().filter(w -> oversized.contains(w.getSubcategory())).count();
        long f = wardrobe.stream().filter(w -> fitted.contains(w.getSubcategory())).count();
        long l = wardrobe.stream().filter(w -> layering.contains(w.getSubcategory())).count();
        long max = Math.max(o, Math.max(f, l));
        if (max == 0) {
            return "equilibrada";
        }
        return max == l ? "layering" : max == o ? "oversized" : "fitted";
    }

    /** RN03 — índice de ousadia em percentil da diversidade cromática e de estilo frente aos demais usuários ativos. */
    int boldnessPercentile(UUID userId, List<WardrobeItem> wardrobe) {
        double mine = diversity(wardrobe);
        List<Double> others = new ArrayList<>();
        Map<UUID, List<WardrobeItem>> byUser = pieces.findAllPublic(Pageable.ofSize(2000)).stream().collect(Collectors.groupingBy(w -> w.getUser().getId()));
        byUser.forEach((u, list) -> {
            if (!u.equals(userId) && list.size() >= 5) {
                others.add(diversity(list));
            }
        });
        if (others.isEmpty()) {
            return (int) Math.round(mine * 100);
        }
        long below = others.stream().filter(v -> v <= mine).count();
        return (int) Math.round(100.0 * below / others.size());
    }

    static double diversity(List<WardrobeItem> list) {
        List<String> fam = list.stream().map(w -> Taxonomy.COLOR_FAMILY.get(w.getColor())).filter(Objects::nonNull).toList();
        List<String> sty = list.stream().flatMap(w -> Json.csv(w.getStyleTags()).stream()).toList();
        return 0.5 * InventoryScoreService.entropy(fam, new HashSet<>(Taxonomy.COLOR_FAMILY.values()).size())
                + 0.5 * InventoryScoreService.entropy(sty, Taxonomy.STYLES.size());
    }

    /** Frase de Identidade: a IA sintetiza (não lista); campos privados podem influenciar, mas nunca aparecem literalmente. */
    void phrase(CurrentUser user, StyleDna d) {
        Map<String, Object> life = Json.map(d.getLifeIdentityJson());
        List<String> hidden = Json.strings(d.getLifePrivateFieldsJson());
        boolean withLife = !life.isEmpty() && life.values().stream().anyMatch(v -> v instanceof List<?> l && !l.isEmpty());
        String local = localPhrase(d, life, hidden);
        Set<String> privateValues = new HashSet<>();
        for (String h : hidden) {
            if (life.get(h) instanceof List<?> l) {
                l.forEach(x -> privateValues.add(String.valueOf(x)));
            }
        }
        String prompt = "Arquétipo: " + ARCHETYPE_LABEL.get(d.getArchetype()) + "\nPaleta: " + d.getColorPalette() + "\nSilhueta: " + d.getSilhouette()
                + "\nOusadia: " + d.getBoldnessIndex() + "/100\nPeça ícone: " + d.getIconPieceName() + "\nEstilos: " + d.getStyleKeywords()
                + (withLife ? "\nIdentidade de Vida (use como inspiração; NÃO cite literalmente estes itens privados: " + privateValues + "): " + Json.write(life) : "");
        AiOutcome<String> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.DNA_SYNTHESIZER,
                "Escreva a Frase de Identidade do DNA de Estilo do Fashion AI: UMA frase em português (até 220 caracteres), que sintetiza — nunca lista — "
                        + "estilo e vida. Moda é a moldura, vida é o quadro. Sem emojis, sem hashtags. Responda só a frase.",
                prompt, List.of(), 200, withLife ? List.of("Camada 1 (estilo)", "Camada 2 (Identidade de Vida, cifrada em repouso)") : List.of("Camada 1 (estilo)"),
                text -> {
                    if (text == null || text.isBlank()) {
                        return null;
                    }
                    String t = InputSanitizer.clean(text.replace("\"", "").trim(), 240);
                    for (String pv : privateValues) {
                        if (!pv.isBlank() && t.toLowerCase(Locale.ROOT).contains(pv.toLowerCase(Locale.ROOT))) {
                            return null; // vazaria um campo privado no card → usa a frase local
                        }
                    }
                    return t;
                }, () -> local, null));
        d.setIdentityPhrase(outcome.value() == null ? local : outcome.value());
        d.setPhraseSource(withLife ? "STYLE_AND_LIFE" : "STYLE_ONLY");
    }

    static String localPhrase(StyleDna d, Map<String, Object> life, List<String> hidden) {
        String base = ARCHETYPE_LABEL.get(d.getArchetype()) + " de silhueta " + d.getSilhouette() + (d.getIconPieceName() == null ? "" : ", que chega de " + d.getIconPieceName());
        List<String> bits = new ArrayList<>();
        for (String k : List.of("objects", "places", "animals")) {
            if (!hidden.contains(k) && life.get(k) instanceof List<?> l && !l.isEmpty()) {
                String v = String.valueOf(l.get(0));
                bits.add(switch (k) {
                    case "objects" -> "leva " + v + " na rotina";
                    case "places" -> "tem " + v + " no mapa";
                    default -> "divide os dias com " + v;
                });
            }
        }
        return InputSanitizer.clean(base + (bits.isEmpty() ? " — " + (d.getBoldnessIndex() >= 60 ? "sem medo de arriscar" : "com elegância serena") : ", " + String.join(" e ", bits)) + ".", 240);
    }

    void snapshot(StyleDna d, String reason) {
        StyleDnaVersion v = new StyleDnaVersion();
        v.setId(UUID.randomUUID());
        v.setUserId(d.getUser().getId());
        v.setSnapshotJson(Json.write(Map.of("reason", reason, "archetype", d.getArchetype().name(), "palette", Json.csv(d.getColorPalette()),
                "silhouette", String.valueOf(d.getSilhouette()), "boldness", d.getBoldnessIndex(), "icon", String.valueOf(d.getIconPieceName()),
                "phrase", String.valueOf(d.getIdentityPhrase()), "phraseSource", String.valueOf(d.getPhraseSource()))));
        v.setCreatedAt(Instant.now());
        versions.save(v);
    }

    Map<String, Object> view(StyleDna d, boolean owner) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("archetype", d.getArchetype().name());
        m.put("archetypeLabel", ARCHETYPE_LABEL.get(d.getArchetype()));
        m.put("palette", Json.csv(d.getColorPalette()).stream().map(c -> Map.of("color", c, "hex", c.startsWith("#") ? c : Taxonomy.hex(c))).toList());
        m.put("silhouette", d.getSilhouette());
        m.put("boldnessIndex", d.getBoldnessIndex());
        m.put("iconPiece", d.getIconPieceName());
        m.put("styles", Json.csv(d.getStyleKeywords()));
        m.put("occasions", Json.csv(d.getOccasionKeywords()));
        m.put("phrase", d.getIdentityPhrase());
        m.put("phraseSource", d.getPhraseSource());
        m.put("colorSeason", d.getColorSeason());
        m.put("synthesizedAt", d.getSynthesizedAt());
        if (owner) {
            m.put("life", Json.map(d.getLifeIdentityJson()));
            m.put("privateFields", Json.strings(d.getLifePrivateFieldsJson()));
        }
        m.put("cardImageUrl", d.getCardImageUrl());
        m.put("cardExpiresAt", d.getCardExpiresAt());
        return m;
    }

    /** DET-M05 — estação da coloração pessoal (opcional). */
    @Transactional
    public Map<String, Object> setColorSeason(CurrentUser user, String season) {
        StyleDna d = dnas.findByUserId(user.id()).orElseThrow(() -> ApiException.notFound("DNA de Estilo"));
        String s = season == null ? null : season.toUpperCase(Locale.ROOT);
        if (s != null && !Set.of("SPRING", "SUMMER", "AUTUMN", "WINTER").contains(s)) {
            throw ApiException.badRequest("ESTACAO_INVALIDA", "Use SPRING, SUMMER, AUTUMN ou WINTER.");
        }
        d.setColorSeason(s);
        dnas.save(d);
        return view(d, true);
    }

    // ================================================================== card PNG com marca d'água (CA09 / RN07 / RN08)
    @Transactional
    public Map<String, Object> shareCard(CurrentUser user) {
        StyleDna d = dnas.findByUserId(user.id()).filter(x -> x.getSynthesizedAt() != null).orElseThrow(() -> ApiException.notFound("DNA de Estilo"));
        byte[] png = renderCard(d);
        MediaStoragePort.StoredObject stored = media.put("dna/" + user.id() + "/card-" + Instant.now().toEpochMilli() + ".png", png, "image/png");
        d.setCardImageUrl(stored.url());
        d.setCardExpiresAt(Instant.now().plus(30, ChronoUnit.DAYS));
        dnas.save(d);
        return Map.of("url", stored.url(), "expiresAt", d.getCardExpiresAt(), "watermark", "Fashion AI", "hiddenFields", Json.strings(d.getLifePrivateFieldsJson()));
    }

    byte[] renderCard(StyleDna d) {
        int w = 1080, h = 1350;
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        List<String> palette = Json.csv(d.getColorPalette());
        Color c1 = palette.isEmpty() ? new Color(0x2A211C) : color(palette.get(0));
        Color c2 = palette.size() > 1 ? color(palette.get(1)) : new Color(0xF57C1F);
        g.setPaint(new GradientPaint(0, 0, darken(c1), w, h, darken(c2)));
        g.fillRect(0, 0, w, h);
        g.setColor(new Color(245, 235, 215, 235));
        g.fillRoundRect(60, 60, w - 120, h - 120, 48, 48);
        g.setColor(new Color(0x1E1B18));
        g.setFont(new Font("Serif", Font.BOLD, 72));
        g.drawString("DNA de Estilo", 110, 200);
        g.setFont(new Font("SansSerif", Font.PLAIN, 34));
        g.drawString(ARCHETYPE_LABEL.get(d.getArchetype()) + " · silhueta " + d.getSilhouette() + " · ousadia " + d.getBoldnessIndex(), 110, 260);
        int x = 110;
        for (String p : palette) {
            g.setColor(color(p));
            g.fillRoundRect(x, 310, 150, 150, 24, 24);
            g.setColor(new Color(0, 0, 0, 60));
            g.setStroke(new BasicStroke(2));
            g.drawRoundRect(x, 310, 150, 150, 24, 24);
            x += 172;
        }
        g.setColor(new Color(0x1E1B18));
        g.setFont(new Font("Serif", Font.ITALIC, 44));
        drawWrapped(g, "“" + d.getIdentityPhrase() + "”", 110, 560, w - 220, 58);
        g.setFont(new Font("SansSerif", Font.PLAIN, 32));
        g.drawString("Peça ícone: " + (d.getIconPieceName() == null ? "—" : d.getIconPieceName()), 110, 900);
        Map<String, Object> life = Json.map(d.getLifeIdentityJson());
        List<String> hidden = Json.strings(d.getLifePrivateFieldsJson());
        int y = 960;
        for (String k : List.of("places", "people", "animals", "objects")) {
            if (hidden.contains(k) || !(life.get(k) instanceof List<?> l) || l.isEmpty()) {
                continue; // RN07 — campo privado nunca aparece na imagem
            }
            String label = switch (k) {
                case "places" -> "Lugares";
                case "people" -> "Pessoas";
                case "animals" -> "Animais";
                default -> "Objetos";
            };
            g.drawString(label + ": " + l.stream().map(String::valueOf).collect(Collectors.joining(" · ")), 110, y);
            y += 50;
        }
        g.setFont(new Font("SansSerif", Font.BOLD, 30));
        g.setColor(new Color(0xF57C1F));
        g.drawString("Fashion AI · FAI", w - 360, h - 110);
        g.dispose();
        return ImageOps.png(img);
    }

    static Color color(String c) {
        String hex = c.startsWith("#") ? c : Taxonomy.hex(c);
        try {
            return new Color(ColorMath.parseHex(hex == null ? "#888888" : hex));
        } catch (RuntimeException ex) {
            return Color.GRAY;
        }
    }

    static Color darken(Color c) {
        return new Color((int) (c.getRed() * 0.6), (int) (c.getGreen() * 0.6), (int) (c.getBlue() * 0.6));
    }

    static void drawWrapped(Graphics2D g, String text, int x, int y, int width, int lh) {
        StringBuilder line = new StringBuilder();
        for (String word : text.split(" ")) {
            String test = line.isEmpty() ? word : line + " " + word;
            if (g.getFontMetrics().stringWidth(test) > width) {
                g.drawString(line.toString(), x, y);
                y += lh;
                line = new StringBuilder(word);
            } else {
                line = new StringBuilder(test);
            }
        }
        if (!line.isEmpty()) {
            g.drawString(line.toString(), x, y);
        }
    }

    // ================================================================== Esquemas de DNA (anatomias A1–A4, narrativas B1–B12)
    public record DnaCellForm(UUID schemeId, String eraLabel, Boolean milestone) {
    }

    public record DnaSchemeForm(String title, List<DnaCellForm> cells, String cardLayout, String targetElement, NarrativeType narrativeType,
                                String occasion, String style, Season seasonalTheme, Visibility visibility, Map<String, Object> background,
                                Boolean publish) {
    }

    @Transactional
    public Map<String, Object> createDnaScheme(CurrentUser user, DnaSchemeForm f) {
        guard.requireCanCreate(user);
        StyleDna dna = dnas.findByUserId(user.id()).filter(x -> x.getSynthesizedAt() != null)
                .orElseThrow(() -> new ApiException(409, "SEM_DNA", "Gere o seu DNA de Estilo antes de montar um Esquema de DNA."));
        DnaScheme d = new DnaScheme();
        d.setUser(users.findById(user.id()).orElseThrow());
        d.setArchetype(dna.getArchetype());
        d.setBoldnessIndex(dna.getBoldnessIndex());
        d.setIdentityPhrase(dna.getIdentityPhrase());
        d.setColorPaletteJson(Json.write(Json.csv(dna.getColorPalette())));
        d.setCreationMode(CreationMode.MANUAL);
        d.setStatus(SchemeStatus.DRAFT);
        apply(user, d, f, true);
        dnaSchemes.save(d);
        replaceCells(user, d, f.cells());
        dna.setLatestDnaSchemeId(d.getId());
        if (Boolean.TRUE.equals(f.publish())) {
            d.setStatus(SchemeStatus.PUBLISHED);
            d.setPublishedAt(Instant.now());
        }
        return dnaSchemeView(user, d);
    }

    @Transactional
    public Map<String, Object> updateDnaScheme(CurrentUser user, UUID id, DnaSchemeForm f) {
        DnaScheme d = dnaSchemes.findById(id).orElseThrow(() -> ApiException.notFound("Esquema de DNA"));
        guard.requireOwner(user, d.getUser().getId(), "dna:" + id);
        apply(user, d, f, false);
        if (f.cells() != null) {
            replaceCells(user, d, f.cells());
        }
        if (Boolean.TRUE.equals(f.publish()) && d.getStatus() != SchemeStatus.PUBLISHED) {
            d.setStatus(SchemeStatus.PUBLISHED);
            d.setPublishedAt(Instant.now());
        }
        return dnaSchemeView(user, d);
    }

    void apply(CurrentUser user, DnaScheme d, DnaSchemeForm f, boolean creating) {
        if (f.title() != null || creating) {
            d.setTitle(InputSanitizer.required("title", f.title(), 2, 120));
        }
        if (f.cardLayout() != null) {
            if (!LAYOUTS.contains(f.cardLayout())) {
                throw ApiException.badRequest("LAYOUT_INVALIDO", "Anatomias: " + LAYOUTS);
            }
            d.setCardLayout(f.cardLayout());
        } else if (creating) {
            d.setCardLayout("AMPLIADO");
        }
        String target = f.targetElement() == null ? (creating ? "DNA_COMPLETO" : d.getTargetElement()) : f.targetElement();
        if (!Set.of("DNA_COMPLETO", "ESQUEMA").contains(target)) {
            throw ApiException.badRequest("ALVO_INVALIDO", "Elemento-alvo: DNA_COMPLETO ou ESQUEMA.");
        }
        d.setTargetElement(target);
        if (f.narrativeType() != null) {
            // Seção B só existe quando o elemento-alvo da Etapa 1 é o Conjunto DNA completo
            if (!"DNA_COMPLETO".equals(target)) {
                throw ApiException.badRequest("NARRATIVA_INDISPONIVEL", "As narrativas só aparecem quando o elemento-alvo é o DNA completo.");
            }
            d.setNarrativeType(f.narrativeType());
        } else if (creating) {
            d.setNarrativeType(NarrativeType.TIMELINE);
        }
        if (f.occasion() != null) {
            d.setOccasion(InputSanitizer.clean(f.occasion(), 120));
        }
        if (f.style() != null) {
            d.setStyle(InputSanitizer.clean(f.style(), 120));
        }
        if (f.seasonalTheme() != null) {
            d.setSeasonalTheme(f.seasonalTheme());
        }
        if (f.visibility() != null) {
            d.setVisibility(f.visibility());
        } else if (creating) {
            d.setVisibility(AccountService.defaultVisibility(d.getUser()));
        }
        if (f.background() != null) {
            d.setStudioConfigJson(Json.write(f.background()));
            Object color = f.background().get("color");
            if (color != null) {
                d.setBackgroundColor(String.valueOf(color));
            }
            Object video = f.background().get("backgroundVideoUrl");
            if (video != null) {
                d.setBackgroundVideoUrl(String.valueOf(video));
            }
        }
        if (d.getNarrativeType() == NarrativeType.CARTELA_SAZONAL && d.getSeasonalTheme() == null) {
            d.setSeasonalTheme(Season.AUTUMN);
        }
    }

    void replaceCells(CurrentUser user, DnaScheme d, List<DnaCellForm> cells) {
        if (cells == null || cells.size() < 2 || cells.size() > 6) {
            throw ApiException.badRequest("CELULAS_INVALIDAS", "Um DNA referencia de 2 a 6 esquemas.");
        }
        if (d.getId() != null) {
            dnaItems.deleteByDnaSchemeId(d.getId());
        }
        long milestones = cells.stream().filter(c -> Boolean.TRUE.equals(c.milestone())).count();
        if (milestones > 1) {
            throw ApiException.badRequest("MARCO_UNICO", "Escolha uma única célula como marco (Momentos Marcantes).");
        }
        DnaCell[] slots = DnaCell.values();
        Set<UUID> seen = new HashSet<>();
        for (int i = 0; i < cells.size(); i++) {
            DnaCellForm c = cells.get(i);
            if (!seen.add(c.schemeId())) {
                throw ApiException.badRequest("ESQUEMA_REPETIDO", "Cada esquema entra uma vez no DNA.");
            }
            Scheme s = schemes.findById(c.schemeId()).orElseThrow(() -> ApiException.notFound("Esquema"));
            guard.requireOwner(user, s.getUser().getId(), "scheme:" + s.getId());
            DnaSchemeItem it = new DnaSchemeItem();
            it.setDnaScheme(d);
            it.setScheme(s);
            it.setCell(slots[i]);
            it.setEraLabel(c.eraLabel() == null ? null : InputSanitizer.clean(c.eraLabel(), 120));
            it.setMilestone(Boolean.TRUE.equals(c.milestone()));
            dnaItems.save(it);
        }
    }

    @Transactional
    public Map<String, Object> getDnaScheme(CurrentUser viewer, UUID id) {
        DnaScheme d = dnaSchemes.findById(id).orElseThrow(() -> ApiException.notFound("Esquema de DNA"));
        User owner = d.getUser();
        if (!viewer.id().equals(owner.getId())) {
            guard.requireView(viewer, owner.getId(), SchemeService.moreRestrictive(d.getVisibility(), owner.getProfileVisibility()), "dna:" + id);
            if (d.getStatus() != SchemeStatus.PUBLISHED) {
                throw guard.deny(viewer, "dna:" + id, "Este DNA ainda não foi publicado.");
            }
        }
        return dnaSchemeView(viewer, d);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> myDnaSchemes(CurrentUser user) {
        return dnaSchemes.findByUserIdOrderByCreatedAtDesc(user.id()).stream().map(d -> Map.<String, Object>of("id", d.getId(), "title", String.valueOf(d.getTitle()),
                "cardLayout", String.valueOf(d.getCardLayout()), "narrativeType", String.valueOf(d.getNarrativeType()), "status", d.getStatus().name(),
                "visibility", d.getVisibility().name(), "createdAt", d.getCreatedAt())).toList();
    }

    @Transactional
    public void deleteDnaScheme(CurrentUser user, UUID id) {
        DnaScheme d = dnaSchemes.findById(id).orElseThrow(() -> ApiException.notFound("Esquema de DNA"));
        guard.requireOwner(user, d.getUser().getId(), "dna:" + id);
        d.setStatus(SchemeStatus.ARCHIVED);
        d.setVisibility(Visibility.PRIVATE);
    }

    Map<String, Object> dnaSchemeView(CurrentUser viewer, DnaScheme d) {
        List<DnaSchemeItem> items = dnaItems.findByDnaSchemeIdOrderByCell(d.getId());
        Map<UUID, List<SchemeItem>> itemsBy = items.isEmpty() ? Map.of() : schemeItems.findBySchemeIdIn(items.stream().map(i -> i.getScheme().getId()).toList())
                .stream().collect(Collectors.groupingBy(si -> si.getScheme().getId()));
        List<Map<String, Object>> cells = new ArrayList<>();
        for (DnaSchemeItem it : items) {
            Scheme s = it.getScheme();
            List<SchemeItem> sItems = itemsBy.getOrDefault(s.getId(), List.of());
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("cell", it.getCell().name());
            c.put("schemeId", s.getId());
            c.put("title", s.getTitle());
            c.put("coverImageUrl", s.getCoverImageUrl());
            c.put("occasion", Json.csv(s.getOccasion()));
            c.put("style", Json.csv(s.getStyle()));
            c.put("eraLabel", it.getEraLabel());
            c.put("milestone", it.isMilestone());
            c.put("createdAt", s.getCreatedAt());
            c.put("dominantBrand", dominantBrand(sItems));
            c.put("dominantColor", dominantColor(sItems));
            c.put("hypeScoreGlobal", s.getHypeScoreGlobal() == null ? s.getHypeScore() : s.getHypeScoreGlobal());
            cells.add(c);
        }
        List<SchemeItem> allItems = itemsBy.values().stream().flatMap(List::stream).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", d.getId());
        out.put("owner", Views.user(d.getUser()));
        out.put("title", d.getTitle());
        out.put("archetype", d.getArchetype().name());
        out.put("identityPhrase", d.getIdentityPhrase());
        out.put("palette", Json.strings(d.getColorPaletteJson()));
        out.put("cardLayout", d.getCardLayout());
        out.put("targetElement", d.getTargetElement());
        out.put("narrativeType", d.getNarrativeType() == null ? null : d.getNarrativeType().name());
        out.put("seasonalTheme", d.getSeasonalTheme() == null ? null : d.getSeasonalTheme().name());
        out.put("occasion", d.getOccasion());
        out.put("style", d.getStyle());
        out.put("visibility", d.getVisibility().name());
        out.put("status", d.getStatus().name());
        out.put("background", Json.map(d.getStudioConfigJson()));
        out.put("backgroundVideoUrl", d.getBackgroundVideoUrl());
        out.put("cells", cells);
        List<Map<String, Object>> logos = logoRanking(allItems);
        out.put("logos", logos);
        out.put("logoCut", logoCut(d));
        out.put("narrative", narrativeData(d, items, itemsBy));
        out.put("counters", Map.of("likes", d.getLikeCount(), "comments", d.getCommentCount(), "shares", d.getShareCount(), "remixes", d.getRemixCount()));
        out.put("canEdit", viewer.id().equals(d.getUser().getId()));
        out.put("publishedAt", d.getPublishedAt());
        return out;
    }

    /** Regra transversal de logos: nº de peças por marca; empate → mais peças em superior/inferior. */
    static List<Map<String, Object>> logoRanking(List<SchemeItem> items) {
        Map<String, int[]> counts = new LinkedHashMap<>();
        Map<String, String> logo = new HashMap<>();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            String brand = w.getBrand() != null ? w.getBrand().getName() : w.getBrandName();
            if (brand == null || brand.isBlank()) {
                continue;
            }
            int[] c = counts.computeIfAbsent(brand, k -> new int[2]);
            c[0]++;
            if ("upper_piece".equals(w.getCategory()) || "lower_piece".equals(w.getCategory())) {
                c[1]++;
            }
            if (w.getBrand() != null && w.getBrand().getLogoUrl() != null) {
                logo.put(brand, w.getBrand().getLogoUrl());
            }
        }
        return counts.entrySet().stream().sorted((a, b) -> a.getValue()[0] != b.getValue()[0] ? b.getValue()[0] - a.getValue()[0] : b.getValue()[1] - a.getValue()[1])
                .map(e -> Map.<String, Object>of("brand", e.getKey(), "pieces", e.getValue()[0], "structural", e.getValue()[1], "logoUrl", String.valueOf(logo.get(e.getKey()))))
                .toList();
    }

    /** Quantos logos cada anatomia/narrativa exibe (o resto só ao abrir o DNA completo). */
    static Map<String, Object> logoCut(DnaScheme d) {
        if ("DNA_COMPLETO".equals(d.getTargetElement()) && d.getNarrativeType() != null) {
            return switch (d.getNarrativeType()) {
                case TIMELINE, PALETA_DOMINANTE -> Map.of("shown", 1, "counter", true);
                case MOMENTOS_MARCANTES -> Map.of("shown", 1, "counter", false, "onlyCover", true);
                case PRIMEIRA_VEZ -> Map.of("shown", "variable", "counter", false);
                case CAPSULA_VERSATILIDADE -> Map.of("shown", 2, "counter", true);
                case POR_OCASIAO -> Map.of("shown", 1, "counter", false);
                case MOOD_BOARD -> Map.of("shown", 3, "counter", false);
                case MARCAS_FAVORITAS -> Map.of("shown", "all", "counter", false, "isContent", true);
                case HYPE_FOCUS, HARMONIA_CROMATICA, CARTELA_SAZONAL -> Map.of("shown", 1, "counter", true);
                case BLOCOS -> Map.of("shown", 3, "counter", true);
            };
        }
        return switch (String.valueOf(d.getCardLayout())) {
            case "LATERAL" -> Map.of("shown", 2, "counter", true, "row", true);
            case "HORIZONTAL" -> Map.of("shown", "perCell", "counter", false);
            default -> Map.of("shown", 1, "counter", true);
        };
    }

    static String dominantBrand(List<SchemeItem> items) {
        return logoRanking(items).stream().findFirst().map(m -> String.valueOf(m.get("brand"))).orElse(null);
    }

    static String dominantColor(List<SchemeItem> items) {
        return items.stream().map(si -> si.getWardrobeItem().getColor()).filter(Objects::nonNull)
                .collect(Collectors.groupingBy(c -> c, Collectors.counting())).entrySet().stream().max(Map.Entry.comparingByValue())
                .map(e -> Taxonomy.hex(e.getKey())).orElse(null);
    }

    /** Dados específicos de cada narrativa (Seção B): ordenação, agrupamento e elementos gráficos. */
    Map<String, Object> narrativeData(DnaScheme d, List<DnaSchemeItem> items, Map<UUID, List<SchemeItem>> itemsBy) {
        if (!"DNA_COMPLETO".equals(d.getTargetElement()) || d.getNarrativeType() == null) {
            return Map.of();
        }
        Map<String, Object> n = new LinkedHashMap<>();
        switch (d.getNarrativeType()) {
            case TIMELINE -> n.put("order", items.stream().sorted(Comparator.comparing((DnaSchemeItem i) -> i.getScheme().getCreatedAt()))
                    .map(i -> i.getScheme().getId()).toList());
            case MOMENTOS_MARCANTES -> {
                Optional<DnaSchemeItem> cover = items.stream().filter(DnaSchemeItem::isMilestone).findFirst();
                n.put("cover", cover.map(i -> i.getScheme().getId()).orElse(items.isEmpty() ? null : items.get(0).getScheme().getId()));
                n.put("coverLabel", cover.map(DnaSchemeItem::getEraLabel).orElse(null));
            }
            case PRIMEIRA_VEZ -> {
                List<Map<String, Object>> firsts = new ArrayList<>();
                Set<String> occ = new HashSet<>(), brands = new HashSet<>();
                List<DnaSchemeItem> chrono = items.stream().sorted(Comparator.comparing((DnaSchemeItem i) -> i.getScheme().getCreatedAt())).toList();
                for (int i = 0; i < chrono.size(); i++) {
                    Scheme s = chrono.get(i).getScheme();
                    if (i == 0) {
                        firsts.add(Map.of("schemeId", s.getId(), "label", "1º esquema salvo"));
                        occ.addAll(Json.csv(s.getOccasion()));
                        itemsBy.getOrDefault(s.getId(), List.of()).forEach(si -> brands.add(String.valueOf(si.getWardrobeItem().getBrandName())));
                        continue;
                    }
                    String newOcc = Json.csv(s.getOccasion()).stream().filter(o -> !occ.contains(o)).findFirst().orElse(null);
                    String newBrand = itemsBy.getOrDefault(s.getId(), List.of()).stream().map(si -> si.getWardrobeItem().getBrandName())
                            .filter(b -> b != null && !brands.contains(b)).findFirst().orElse(null);
                    if (newOcc != null) {
                        firsts.add(Map.of("schemeId", s.getId(), "label", "1ª vez em " + newOcc));
                    } else if (newBrand != null) {
                        firsts.add(Map.of("schemeId", s.getId(), "label", "1ª peça " + newBrand));
                    }
                    occ.addAll(Json.csv(s.getOccasion()));
                    itemsBy.getOrDefault(s.getId(), List.of()).forEach(si -> brands.add(String.valueOf(si.getWardrobeItem().getBrandName())));
                }
                n.put("firsts", firsts);
            }
            case CAPSULA_VERSATILIDADE -> {
                Map<UUID, Integer> use = new LinkedHashMap<>();
                Map<UUID, WardrobeItem> byId = new HashMap<>();
                itemsBy.values().forEach(l -> l.forEach(si -> {
                    use.merge(si.getWardrobeItem().getId(), 1, Integer::sum);
                    byId.put(si.getWardrobeItem().getId(), si.getWardrobeItem());
                }));
                n.put("basePieces", use.entrySet().stream().sorted(Map.Entry.<UUID, Integer>comparingByValue().reversed()).limit(6)
                        .map(e -> Map.of("pieceId", e.getKey(), "name", String.valueOf(byId.get(e.getKey()).getName()), "looks", e.getValue(),
                                "imageUrl", String.valueOf(byId.get(e.getKey()).getImageUrl()))).toList());
                n.put("factor", use.isEmpty() ? 0 : Math.round(10.0 * items.size() / use.size()) / 10.0);
            }
            case POR_OCASIAO -> n.put("groups", items.stream().collect(Collectors.groupingBy(i -> Json.csv(i.getScheme().getOccasion()).stream().findFirst().orElse("livre"),
                    LinkedHashMap::new, Collectors.mapping(i -> i.getScheme().getId(), Collectors.toList()))));
            case MOOD_BOARD -> n.put("orbits", items.stream().map(i -> Map.of("schemeId", i.getScheme().getId(), "orbit",
                    Json.csv(i.getScheme().getStyle()).stream().anyMatch(s -> Json.csv(d.getStyle() == null ? "" : d.getStyle()).contains(s)) ? 1 : 2)).toList());
            case PALETA_DOMINANTE -> {
                Map<String, Long> freq = itemsBy.values().stream().flatMap(List::stream).map(si -> si.getWardrobeItem().getColor()).filter(Objects::nonNull)
                        .collect(Collectors.groupingBy(c -> c, Collectors.counting()));
                long total = freq.values().stream().mapToLong(Long::longValue).sum();
                n.put("band", freq.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(5)
                        .map(e -> Map.of("color", e.getKey(), "hex", String.valueOf(Taxonomy.hex(e.getKey())), "share", total == 0 ? 0 : Math.round(100.0 * e.getValue() / total))).toList());
            }
            case HARMONIA_CROMATICA -> n.put("harmony", harmony(itemsBy.values().stream().flatMap(List::stream).map(si -> si.getWardrobeItem().getColor()).toList()));
            case MARCAS_FAVORITAS -> n.put("ranking", logoRanking(itemsBy.values().stream().flatMap(List::stream).toList()));
            case HYPE_FOCUS -> n.put("meters", items.stream().map(i -> Map.of("schemeId", i.getScheme().getId(), "hype",
                    i.getScheme().getHypeScoreGlobal() == null ? (i.getScheme().getHypeScore() == null ? 0 : i.getScheme().getHypeScore()) : i.getScheme().getHypeScoreGlobal())).toList());
            case CARTELA_SAZONAL -> n.put("season", Map.of("theme", String.valueOf(d.getSeasonalTheme()), "preset", switch (d.getSeasonalTheme() == null ? Season.AUTUMN : d.getSeasonalTheme()) {
                case WINTER -> "frost";
                case SUMMER -> "solstice";
                case AUTUMN -> "ember";
                default -> "bloom";
            }, "note", "Escolher a Cartela Sazonal sobrescreve a arte de fundo manual da Etapa 4."));
            case BLOCOS -> n.put("blocks", Map.of("order", List.of("chrome", "hero", "titulo", "lista", "logos", "frase"), "socialOutsideContainer", true,
                    "note", "Blocos muda a forma, não o conteúdo; LEGO é marca registrada."));
        }
        return n;
    }

    static String harmony(List<String> colors) {
        Set<String> fam = colors.stream().filter(Objects::nonNull).map(c -> Taxonomy.COLOR_FAMILY.get(c)).filter(Objects::nonNull)
                .filter(f -> !ColorMath.NEUTRAL_FAMILIES.contains(f)).collect(Collectors.toSet());
        if (fam.size() <= 1) {
            return "MONOCROMATICA";
        }
        Set<Set<String>> complementary = Set.of(Set.of("Azul", "Laranja"), Set.of("Vermelho", "Verde"), Set.of("Amarelo", "Roxo"));
        if (fam.size() == 2 && complementary.contains(fam)) {
            return "COMPLEMENTAR";
        }
        return fam.size() == 3 ? "TRIADICA" : fam.size() == 2 ? "ANALOGA" : "MULTICOLOR";
    }
}
