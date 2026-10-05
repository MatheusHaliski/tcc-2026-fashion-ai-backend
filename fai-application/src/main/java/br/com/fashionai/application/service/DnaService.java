package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.ai.local.LocalDnaSynthesizer;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.DnaScheme;
import br.com.fashionai.domain.model.DnaSchemeItem;
import br.com.fashionai.domain.model.HypeScoreCurrent;
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
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.NarrativeType;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.StyleArchetype;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.DnaSchemeItemRepository;
import br.com.fashionai.domain.repository.DnaSchemeRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
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
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
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
 * RF13 / HU20 — DNA de Estilo: sempre disponível (bloco 12 — não precisa ser destravado; ≥ 10 peças e ≥ 5 avaliações
 * positivas só tornam a síntese mais precisa), Camada 1 inferida
 * (arquétipo, paleta de 5 cores ΔE-agrupada, silhueta, índice de ousadia em percentil, peça ícone que nunca é acessório
 * básico), Camada 2 declarada e cifrada (lugares ≤ 3, pessoas ≤ 3, animais ≤ 2, objetos ≤ 4; 30 caracteres),
 * Frase de Identidade sintetizada pela IA, versões, recálculo a cada 10 interações, card PNG com marca d'água só com
 * campos visíveis (link expira em 30 dias) — e os Esquemas de DNA (anatomias A1–A4 e 12 narrativas do DNA v4), criados
 * com o mesmo construtor do RF5 (modo manual/IA → esquemas → dados → Background Studio → revisar e salvar).
 * <p>
 * Hype ≠ DNA: o HypeScore nunca entra na síntese do DNA (arquétipo, paleta, silhueta, ousadia, frase). Ele só aparece
 * como dado de cada célula e na narrativa HYPE_FOCUS (B10), sempre em v2 (P2-12): o dono vê o Hype pessoal dos próprios
 * looks; quem visita um DNA publicado vê só o Hype público elegível. "Sem dados" chega como status, nunca como 0.
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
        ARCHETYPE_LABEL.put(StyleArchetype.ROMANTIC, Msg.k("dna.romantico"));
        ARCHETYPE_LABEL.put(StyleArchetype.DRAMATIC, Msg.k("dna.dramatico"));
        ARCHETYPE_LABEL.put(StyleArchetype.CLASSIC, Msg.k("dna.classico"));
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
    private final SchemeService schemeService;
    /** HypeScore v2 (estado gravado pelo job; aqui só leitura) — narrativa HYPE_FOCUS e contexto da IA. */
    private final HypeScoreCurrentRepository hypeV2;
    private final HypeScoreConfig hypeV2Config;

    public DnaService(StyleDnaRepository dnas, StyleDnaVersionRepository versions, DnaSchemeRepository dnaSchemes, DnaSchemeItemRepository dnaItems,
                      WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems, DailyLookRepository dailyLooks,
                      UserRepository users, MediaService media,
                      NotificationService notifications, AiEngine ai, Guard guard, SchemeService schemeService,
                      HypeScoreCurrentRepository hypeV2, HypeScoreConfig hypeV2Config) {
        this.hypeV2 = hypeV2;
        this.hypeV2Config = hypeV2Config;
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
        this.schemeService = schemeService;
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
        // Bloco 12: o DNA de Estilo não precisa ser destravado. A Camada 1 é sintetizada com o que houver no acervo e o
        // construtor de Esquemas de DNA fica sempre disponível; peças e looks "adorei" só deixam a síntese mais precisa.
        out.put("prerequisites", Map.of("pieces", p, "positiveFeedbacks", f, "ready", true, "unlockRequired", false));
        if (p < MIN_PIECES || f < MIN_POSITIVE) {
            out.put("precisionNote", Msg.t("dna.seu_dna_fica_mais_preciso", MIN_PIECES, MIN_POSITIVE, p, f));
        }
        StyleDna d = ensureDna(user);
        out.put("generated", true);
        if (interactions(user.id()) - d.getInteractionsAtSynthesis() >= RECALC_INTERACTIONS) {
            synthesize(user, d, true, "EVOLUCAO");
            notifications.notify(user.id(), null, NotificationType.AI_JOB_FINISHED, "DNA", d.getId(), Msg.k("dna.sua_identidade_evoluiu"),
                    Msg.k("dna.recalculamos_a_camada_1_do"), Map.of());
        }
        out.put("dna", view(d, true));
        out.put("versions", versions.findTop20ByUserIdOrderByCreatedAtDesc(user.id()).stream().map(v -> Map.of("id", v.getId(), "createdAt", v.getCreatedAt(),
                "snapshot", Json.map(v.getSnapshotJson()))).toList());
        out.put("lifeForm", lifeFormSpec());
        return out;
    }

    /** DET-K06 / ETI-03 — tamanho mínimo do grupo para mostrar um número de prova social. */
    public static final int SOCIAL_PROOF_MIN = 10;

    /**
     * DET-K06 — prova social pelo DNA: "12 pessoas com o seu arquétipo usaram jaqueta jeans esta semana". Conta pessoas
     * distintas com o mesmo arquétipo que usaram cada subcategoria num Look do Dia nos últimos 7 dias. Só grupos com
     * {@value #SOCIAL_PROOF_MIN} pessoas ou mais aparecem, e a resposta nunca identifica ninguém (só contagens).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> socialProof(CurrentUser user) {
        StyleDna d = dnas.findByUserId(user.id()).orElse(null);
        if (d == null || d.getArchetype() == null) {
            return Map.of("items", List.of(), "minGroup", SOCIAL_PROOF_MIN);
        }
        String archetype = ARCHETYPE_LABEL.get(d.getArchetype());
        List<Map<String, Object>> items = dnas.archetypeUsageSince(d.getArchetype(), LocalDate.now().minusDays(7)).stream()
                .filter(r -> r[0] != null && ((Number) r[1]).longValue() >= SOCIAL_PROOF_MIN).limit(3)
                .map(r -> {
                    long n = ((Number) r[1]).longValue();
                    String sub = String.valueOf(r[0]);
                    String key = "taxonomy." + sub.toLowerCase(Locale.ROOT);
                    String label = Msg.has(key) ? Msg.t(key).toLowerCase(Msg.locale()) : sub.replace('_', ' ');
                    return Map.<String, Object>of("subcategory", sub, "people", n, "text", Msg.t("dna.prova_social", n, Msg.resolve(Msg.locale(), archetype), label));
                }).toList();
        return Map.of("archetype", d.getArchetype().name(), "items", items, "minGroup", SOCIAL_PROOF_MIN,
                "note", Msg.t("dna.prova_social_nota", SOCIAL_PROOF_MIN));
    }

    /** DNA sintetizado do usuário; na primeira vez é gerado na hora (só Camada 1), sem pré-requisitos. */
    StyleDna ensureDna(CurrentUser user) {
        Optional<StyleDna> found = dnas.findByUserId(user.id());
        if (found.isPresent() && found.get().getSynthesizedAt() != null) {
            return found.get();
        }
        StyleDna d = found.orElseGet(() -> new StyleDna(users.findById(user.id()).orElseThrow()));
        dnas.save(d);
        synthesize(user, d, true, "GERACAO");
        return d;
    }

    static Map<String, Object> lifeFormSpec() {
        return Map.of("places", Map.of("label", "Lugares", "max", 3, "examples", Msg.t("dna.cidade_natal_lugar_favorito_destino")),
                "people", Map.of("label", "Pessoas", "max", 3, "examples", Msg.t("dna.nomes_ou_apelidos_sem_foto")),
                "animals", Map.of("label", "Animais", "max", 2, "examples", Msg.t("dna.nome_e_especie_do_pet")),
                "objects", Map.of("label", Msg.t("dna.objetos_itens"), "max", 4, "examples", Msg.t("dna.instrumento_livro_bebida_hobby_esporte")),
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
                    errors.put(k, Msg.t("dna.categoria_desconhecida"));
                    return;
                }
                List<String> clean = (v == null ? List.<String>of() : v).stream().map(s -> InputSanitizer.clean(s == null ? "" : s, 30))
                        .filter(s -> !s.isBlank()).distinct().toList();
                if (clean.size() > LIFE_LIMITS.get(k)) {
                    errors.put(k, Msg.t("dna.maximo_de_itens", LIFE_LIMITS.get(k)));
                }
                out.put(k, clean.stream().limit(LIFE_LIMITS.get(k)).toList());
            });
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("dna.revise_a_identidade_de_vida"), errors);
        }
        return out;
    }

    @Transactional
    public Map<String, Object> generate(CurrentUser user, LifeForm form) {
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
            out.put("notice", Msg.t("dna.card_gerado_so_com_a"));
        }
        return out;
    }

    /** CA05 — editar a Identidade de Vida regenera só a Frase; a Camada 1 permanece intacta. */
    @Transactional
    public Map<String, Object> updateLife(CurrentUser user, LifeForm form) {
        StyleDna d = dnas.findByUserId(user.id()).filter(x -> x.getSynthesizedAt() != null).orElseThrow(() -> ApiException.notFound(Msg.t("common.dna_de_estilo")));
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
        StyleDna d = dnas.findByUserId(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.dna_de_estilo")));
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
        LocalDnaSynthesizer.Synthesis syn = ai.local(user.id(), AiCapability.DNA_SYNTHESIZER, List.of(Msg.t("dna.esquemas_e_pecas_do_acervo"), Msg.t("dna.looks_avaliados_como_adorei")),
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
        String prompt = Msg.t("dna.arquetipo_paleta_silhueta_ousadia_100", ARCHETYPE_LABEL.get(d.getArchetype()), d.getColorPalette(), d.getSilhouette(), d.getBoldnessIndex(), d.getIconPieceName(), d.getStyleKeywords(), (withLife ? Msg.t("dna.identidade_de_vida_use_como", privateValues, Json.write(life)) : ""));
        AiOutcome<String> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.DNA_SYNTHESIZER,
                Msg.t("dna.escreva_a_frase_de_identidade", Msg.languageName()),
                prompt, List.of(), 200, withLife ? List.of(Msg.t("dna.camada_1_estilo"), Msg.t("dna.camada_2_identidade_de_vida")) : List.of(Msg.t("dna.camada_1_estilo")),
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
        String base = ARCHETYPE_LABEL.get(d.getArchetype()) + " de silhueta " + d.getSilhouette() + (d.getIconPieceName() == null ? "" : Msg.t("dna.que_chega_de", d.getIconPieceName()));
        List<String> bits = new ArrayList<>();
        for (String k : List.of("objects", "places", "animals")) {
            if (!hidden.contains(k) && life.get(k) instanceof List<?> l && !l.isEmpty()) {
                String v = String.valueOf(l.get(0));
                bits.add(switch (k) {
                    case "objects" -> "leva " + v + " na rotina";
                    case "places" -> "tem " + v + " no mapa";
                    default -> Msg.t("dna.divide_os_dias_com", v);
                });
            }
        }
        return InputSanitizer.clean(base + (bits.isEmpty() ? " — " + (d.getBoldnessIndex() >= 60 ? Msg.t("common.sem_medo_de_arriscar") : Msg.t("dna.com_elegancia_serena")) : ", " + String.join(" e ", bits)) + ".", 240);
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
        StyleDna d = dnas.findByUserId(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.dna_de_estilo")));
        String s = season == null ? null : season.toUpperCase(Locale.ROOT);
        if (s != null && !Set.of("SPRING", "SUMMER", "AUTUMN", "WINTER").contains(s)) {
            throw ApiException.badRequest("ESTACAO_INVALIDA", Msg.t("dna.use_spring_summer_autumn_ou"));
        }
        d.setColorSeason(s);
        dnas.save(d);
        return view(d, true);
    }

    // ================================================================== card PNG com marca d'água (CA09 / RN07 / RN08)
    @Transactional
    public Map<String, Object> shareCard(CurrentUser user) {
        StyleDna d = dnas.findByUserId(user.id()).filter(x -> x.getSynthesizedAt() != null).orElseThrow(() -> ApiException.notFound(Msg.t("common.dna_de_estilo")));
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
        g.drawString(Msg.resolve(Msg.t("common.dna_de_estilo")), 110, 200);
        g.setFont(new Font("SansSerif", Font.PLAIN, 34));
        g.drawString(Msg.resolve(ARCHETYPE_LABEL.get(d.getArchetype()) + " · silhueta " + d.getSilhouette() + " · ousadia " + d.getBoldnessIndex()), 110, 260);
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
        g.drawString(Msg.resolve(Msg.t("dna.peca_icone", (d.getIconPieceName() == null ? "—" : d.getIconPieceName()))), 110, 900);
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
            g.drawString(Msg.resolve(label + ": " + l.stream().map(String::valueOf).collect(Collectors.joining(" · "))), 110, y);
            y += 50;
        }
        g.setFont(new Font("SansSerif", Font.BOLD, 30));
        g.setColor(new Color(0xF57C1F));
        g.drawString(Msg.resolve(Msg.t("dna.fashion_ai_fai")), w - 360, h - 110);
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
                g.drawString(Msg.resolve(line.toString()), x, y);
                y += lh;
                line = new StringBuilder(word);
            } else {
                line = new StringBuilder(test);
            }
        }
        if (!line.isEmpty()) {
            g.drawString(Msg.resolve(line.toString()), x, y);
        }
    }

    // ================================================================== Esquemas de DNA (anatomias A1–A4, narrativas B1–B12)
    public record DnaCellForm(UUID schemeId, String eraLabel, Boolean milestone) {
    }

    public record DnaSchemeForm(String title, List<DnaCellForm> cells, String cardLayout, String targetElement, NarrativeType narrativeType,
                                String occasion, String style, Season seasonalTheme, Visibility visibility, Map<String, Object> background,
                                Boolean publish, String creationMode) {
    }

    /** Célula do DNA (persistida ou transitória na pré-visualização): esquema referenciado + rótulo de época + marco. */
    record CellRef(DnaCell cell, Scheme scheme, String eraLabel, boolean milestone) {
    }

    @Transactional
    public Map<String, Object> createDnaScheme(CurrentUser user, DnaSchemeForm f) {
        guard.requireCanCreate(user);
        StyleDna dna = ensureDna(user);
        DnaScheme d = new DnaScheme();
        d.setUser(users.findById(user.id()).orElseThrow());
        stamp(d, dna);
        d.setCreationMode("AI".equalsIgnoreCase(f.creationMode()) ? CreationMode.AI_ASSISTED : CreationMode.MANUAL);
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

    /** Identidade do DNA (arquétipo, ousadia, frase, paleta) copiada para o esquema no momento em que ele é montado. */
    static void stamp(DnaScheme d, StyleDna dna) {
        d.setArchetype(dna.getArchetype());
        d.setBoldnessIndex(dna.getBoldnessIndex());
        d.setIdentityPhrase(dna.getIdentityPhrase());
        d.setColorPaletteJson(Json.write(Json.csv(dna.getColorPalette())));
    }

    @Transactional
    public Map<String, Object> updateDnaScheme(CurrentUser user, UUID id, DnaSchemeForm f) {
        DnaScheme d = dnaSchemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("dna.esquema_de_dna")));
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
            throw ApiException.badRequest("ALVO_INVALIDO", Msg.t("dna.elemento_alvo_dna_completo_ou"));
        }
        d.setTargetElement(target);
        if (f.narrativeType() != null) {
            // Seção B só existe quando o elemento-alvo da Etapa 1 é o Conjunto DNA completo
            if (!"DNA_COMPLETO".equals(target)) {
                throw ApiException.badRequest("NARRATIVA_INDISPONIVEL", Msg.t("dna.as_narrativas_so_aparecem_quando"));
            }
            d.setNarrativeType(f.narrativeType());
        } else if (creating || f.cardLayout() != null || !"DNA_COMPLETO".equals(target)) {
            // sem narrativa: o card usa só a anatomia base da Seção A escolhida na etapa 4
            d.setNarrativeType(null);
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
            throw ApiException.badRequest("CELULAS_INVALIDAS", Msg.t("dna.um_dna_referencia_de_2"));
        }
        if (d.getId() != null) {
            dnaItems.deleteByDnaSchemeId(d.getId());
        }
        long milestones = cells.stream().filter(c -> Boolean.TRUE.equals(c.milestone())).count();
        if (milestones > 1) {
            throw ApiException.badRequest("MARCO_UNICO", Msg.t("dna.escolha_uma_unica_celula_como"));
        }
        DnaCell[] slots = DnaCell.values();
        Set<UUID> seen = new HashSet<>();
        for (int i = 0; i < cells.size(); i++) {
            DnaCellForm c = cells.get(i);
            if (!seen.add(c.schemeId())) {
                throw ApiException.badRequest("ESQUEMA_REPETIDO", Msg.t("dna.cada_esquema_entra_uma_vez"));
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
        DnaScheme d = dnaSchemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("dna.esquema_de_dna")));
        User owner = d.getUser();
        if (viewer == null || !viewer.id().equals(owner.getId())) {
            guard.requireView(viewer, owner.getId(), SchemeService.moreRestrictive(d.getVisibility(), owner.getProfileVisibility()), "dna:" + id);
            if (d.getStatus() != SchemeStatus.PUBLISHED) {
                throw guard.deny(viewer, "dna:" + id, Msg.t("dna.este_dna_ainda_nao_foi"));
            }
        }
        return dnaSchemeView(viewer, d);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> myDnaSchemes(CurrentUser user) {
        return dnaSchemes.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(d -> d.getStatus() != SchemeStatus.ARCHIVED)
                .map(d -> dnaSchemeView(user, d)).toList();
    }

    @Transactional
    public void deleteDnaScheme(CurrentUser user, UUID id) {
        DnaScheme d = dnaSchemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("dna.esquema_de_dna")));
        guard.requireOwner(user, d.getUser().getId(), "dna:" + id);
        d.setStatus(SchemeStatus.ARCHIVED);
        d.setVisibility(Visibility.PRIVATE);
    }

    Map<String, Object> dnaSchemeView(CurrentUser viewer, DnaScheme d) {
        List<CellRef> refs = dnaItems.findByDnaSchemeIdOrderByCell(d.getId()).stream()
                .map(i -> new CellRef(i.getCell(), i.getScheme(), i.getEraLabel(), i.isMilestone())).toList();
        return dnaSchemeView(viewer, d, refs);
    }

    Map<String, Object> dnaSchemeView(CurrentUser viewer, DnaScheme d, List<CellRef> items) {
        Map<UUID, List<SchemeItem>> itemsBy = groupItems(items.stream().map(CellRef::scheme).toList());
        // Hype v2 de cada célula: o dono vê o Hype pessoal; quem visita, só o público elegível (privacidade, §9)
        boolean personal = viewer != null && d.getUser() != null && viewer.id().equals(d.getUser().getId());
        Map<UUID, Map<String, Object>> hypeByScheme = cellHype(hypeV2Of(items.stream().map(i -> i.scheme().getId()).toList()), personal);
        List<Map<String, Object>> cells = new ArrayList<>();
        for (CellRef it : items) {
            Scheme s = it.scheme();
            List<SchemeItem> sItems = itemsBy.getOrDefault(s.getId(), List.of());
            List<Map<String, Object>> ranking = logoRanking(sItems);
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("cell", it.cell().name());
            c.put("schemeId", s.getId());
            c.put("title", s.getTitle());
            c.put("description", s.getDescription());
            c.put("coverImageUrl", s.getCoverImageUrl() != null ? s.getCoverImageUrl()
                    : sItems.stream().map(si -> si.getWardrobeItem().getImageUrl()).filter(Objects::nonNull).findFirst().orElse(null));
            c.put("occasion", Json.csv(s.getOccasion()));
            c.put("style", Json.csv(s.getStyle()));
            c.put("season", s.getSeason() == null ? null : s.getSeason().name());
            c.put("eraLabel", it.eraLabel());
            c.put("milestone", it.milestone());
            c.put("createdAt", s.getCreatedAt());
            c.put("dominantBrand", ranking.isEmpty() ? null : ranking.get(0).get("brand"));
            c.put("dominantBrandLogoUrl", ranking.isEmpty() ? null : ranking.get(0).get("logoUrl"));
            c.put("dominantColor", dominantColor(sItems));
            c.put("hypeScoreGlobal", hypeOf(s));   // @deprecated v1 (escala legada, 0 = sem dados); use "hype" (v2)
            c.put("hype", hypeByScheme.getOrDefault(s.getId(), HypeScoreService.v2Summary(null, hypeV2Config, null)));
            c.put("pieces", sItems.stream().map(si -> pieceBrief(si.getWardrobeItem())).toList());
            cells.add(c);
        }
        List<SchemeItem> allItems = itemsBy.values().stream().flatMap(List::stream).toList();
        Map<String, Object> bg = Json.map(d.getStudioConfigJson());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", d.getId());
        out.put("owner", Views.user(d.getUser()));
        out.put("title", d.getTitle());
        out.put("archetype", d.getArchetype() == null ? null : d.getArchetype().name());
        out.put("archetypeLabel", d.getArchetype() == null ? null : ARCHETYPE_LABEL.get(d.getArchetype()));
        out.put("boldnessIndex", d.getBoldnessIndex());
        out.put("identityPhrase", d.getIdentityPhrase());
        out.put("palette", Json.strings(d.getColorPaletteJson()));
        out.put("cardLayout", d.getCardLayout());
        out.put("targetElement", d.getTargetElement());
        out.put("narrativeType", d.getNarrativeType() == null ? null : d.getNarrativeType().name());
        out.put("seasonalTheme", d.getSeasonalTheme() == null ? null : d.getSeasonalTheme().name());
        out.put("occasion", d.getOccasion());
        out.put("style", d.getStyle());
        out.put("creationMode", d.getCreationMode() == null ? null : d.getCreationMode().name());
        out.put("visibility", d.getVisibility().name());
        out.put("status", d.getStatus().name());
        out.put("background", bg);
        out.put("cardSkin", bg.get("skin"));
        out.put("backgroundVideoUrl", d.getBackgroundVideoUrl());
        out.put("cells", cells);
        List<Map<String, Object>> logos = logoRanking(allItems);
        out.put("logos", logos);
        out.put("logoCut", logoCut(d));
        out.put("narrative", narrativeData(d, items, itemsBy, hypeByScheme));
        out.put("counters", Map.of("likes", d.getLikeCount(), "comments", d.getCommentCount(), "shares", d.getShareCount(), "remixes", d.getRemixCount()));
        out.put("canEdit", viewer != null && viewer.id().equals(d.getUser().getId()));
        out.put("createdAt", d.getCreatedAt());
        out.put("publishedAt", d.getPublishedAt());
        return out;
    }

    /** Itens de cada esquema na ordem dos slots (a mesma ordem do card do RF5). */
    Map<UUID, List<SchemeItem>> groupItems(List<Scheme> list) {
        if (list.isEmpty()) {
            return Map.of();
        }
        return schemeItems.findBySchemeIdIn(list.stream().map(Scheme::getId).distinct().toList()).stream()
                .sorted(Comparator.comparingInt(SchemeItem::getSortOrder))
                .collect(Collectors.groupingBy(si -> si.getScheme().getId(), LinkedHashMap::new, Collectors.toList()));
    }

    /**
     * @deprecated v1 legado ({@code hypeScoreGlobal} → {@code hypeScore}, 0 quando não há dado). Só alimenta o campo
     * deprecado {@code hypeScoreGlobal} das células; a narrativa HYPE_FOCUS e o contexto da IA usam o v2 (P2-12).
     */
    @Deprecated
    static double hypeOf(Scheme s) {
        java.math.BigDecimal h = s.getHypeScoreGlobal() != null ? s.getHypeScoreGlobal() : s.getHypeScore();
        return h == null ? 0 : h.doubleValue();
    }

    /** Estado v2 atual dos looks (uma consulta). Sem linha = ainda não calculado. Só lê o que o job gravou. */
    Map<UUID, HypeScoreCurrent> hypeV2Of(Collection<UUID> schemeIds) {
        if (hypeV2 == null || hypeV2Config == null || schemeIds == null || schemeIds.isEmpty()) {
            return Map.of();
        }
        return hypeV2.findByEntityTypeAndEntityIdInAndAlgorithmVersion(HypeEntityType.SCHEME, new HashSet<>(schemeIds), hypeV2Config.algorithmVersion())
                .stream().collect(Collectors.toMap(HypeScoreCurrent::getEntityId, h -> h, (a, b) -> a));
    }

    /**
     * Resumo v2 por look para o card DNA. {@code personal} = quem vê é o dono (Hype pessoal, inclusive de look privado);
     * para terceiros, linha não elegível ao público fica como "ainda não calculado" (igual a /api/hype/summaries).
     */
    Map<UUID, Map<String, Object>> cellHype(Map<UUID, HypeScoreCurrent> rows, boolean personal) {
        Map<UUID, Map<String, Object>> out = new HashMap<>();
        java.time.Instant now = java.time.Instant.now();
        rows.forEach((id, c) -> out.put(id, HypeScoreService.v2Summary(personal || c.isPublicEligible() ? c : null, hypeV2Config, now)));
        return out;
    }

    /** Score v2 que pode ordenar (AVAILABLE); nulo = sem Hype (dados insuficientes ou não calculado) — sempre por último. */
    static Double hypeScoreOf(Map<String, Object> v2) {
        return v2 != null && v2.get("score") instanceof Number n ? n.doubleValue() : null;
    }

    /** Score v2 pessoal do dono (só para ordenar as próprias propostas e para o contexto da IA). */
    static Map<UUID, Double> ownerScores(Map<UUID, HypeScoreCurrent> rows) {
        Map<UUID, Double> out = new HashMap<>();
        rows.forEach((id, c) -> {
            if (c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null) {
                out.put(id, c.getScore().doubleValue());
            }
        });
        return out;
    }

    static Map<String, Object> pieceBrief(WardrobeItem w) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", w.getId());
        m.put("name", w.getName());
        m.put("imageUrl", w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl());
        m.put("brand", w.getBrand() != null ? w.getBrand().getName() : w.getBrandName());
        m.put("category", w.getCategory());
        m.put("color", w.getColor());
        return m;
    }

    // ================================================================== construtor igual ao RF5 (bloco 12)
    static final List<String> BUILDER_STEPS = List.of(Msg.k("dna.n1_modo"), Msg.k("dna.n2_esquemas"), Msg.k("dna.n3_dados"), Msg.k("dna.n4_background_studio"), Msg.k("dna.n5_revisar_e_salvar"));

    /** Etapas 1–2: os "itens" de um Esquema de DNA são os esquemas de vestimenta do próprio usuário (RF5), de 2 a 6. */
    @Transactional
    public Map<String, Object> builder(CurrentUser user) {
        StyleDna dna = ensureDna(user);
        List<Scheme> own = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalSchemes", own.size());
        out.put("source", "RF5");
        if (own.size() < 2) {
            out.put("status", "INSUFICIENTE");
            out.put("message", Msg.t("dna.um_dna_de_estilo_referencia"));
            out.put("action", Map.of("label", Msg.t("dna.criar_esquema_de_vestimenta"), "href", "/schemes/new"));
        } else {
            out.put("status", "PRONTO");
        }
        Map<UUID, List<SchemeItem>> itemsBy = groupItems(own);
        out.put("schemes", own.stream().map(s -> schemeService.view(user, s, itemsBy.getOrDefault(s.getId(), List.of()))).toList());
        out.put("dna", view(dna, false));
        out.put("defaultVisibility", AccountService.defaultVisibility(users.findById(user.id()).orElseThrow()));
        out.put("steps", BUILDER_STEPS);
        out.put("layouts", LAYOUTS);
        out.put("narratives", NarrativeType.values());
        out.put("seasons", Season.values());
        out.put("minCells", 2);
        out.put("maxCells", 6);
        return out;
    }

    /** Etapa 5 / pré-visualização ao vivo: monta o card do DNA sem salvar (células transitórias). */
    @Transactional
    public Map<String, Object> preview(CurrentUser user, DnaSchemeForm f) {
        StyleDna dna = ensureDna(user);
        DnaScheme d = new DnaScheme();
        d.setUser(users.findById(user.id()).orElseThrow());
        stamp(d, dna);
        d.setCreationMode("AI".equalsIgnoreCase(f.creationMode()) ? CreationMode.AI_ASSISTED : CreationMode.MANUAL);
        String title = f.title() == null || f.title().strip().length() < 2 ? Msg.t("common.sem_titulo") : f.title(); // a prévia aparece antes da etapa 3
        apply(user, d, new DnaSchemeForm(title, f.cells(), f.cardLayout(), f.targetElement(), f.narrativeType(), f.occasion(), f.style(),
                f.seasonalTheme(), f.visibility(), f.background(), false, f.creationMode()), true);
        List<CellRef> refs = new ArrayList<>();
        DnaCell[] slots = DnaCell.values();
        Set<UUID> seen = new HashSet<>();
        for (DnaCellForm c : f.cells() == null ? List.<DnaCellForm>of() : f.cells()) {
            if (refs.size() == slots.length || c.schemeId() == null || !seen.add(c.schemeId())) {
                continue;
            }
            Scheme s = schemes.findById(c.schemeId()).orElseThrow(() -> ApiException.notFound("Esquema"));
            guard.requireOwner(user, s.getUser().getId(), "scheme:" + s.getId());
            refs.add(new CellRef(slots[refs.size()], s, c.eraLabel() == null ? null : InputSanitizer.clean(c.eraLabel(), 120), Boolean.TRUE.equals(c.milestone())));
        }
        return dnaSchemeView(user, d, refs);
    }

    public record DnaComposeRequest(String prompt, List<String> occasion, List<String> style, NarrativeType narrativeType, Season season) {
    }

    public record DnaProposal(String title, NarrativeType narrativeType, String cardLayout, List<DnaCellForm> cells, List<String> occasion,
                              List<String> style, Season seasonalTheme, String rationale) {
    }

    static final java.time.format.DateTimeFormatter ERA = java.time.format.DateTimeFormatter.ofPattern("MMM/yy", Locale.forLanguageTag("pt-BR"))
            .withZone(java.time.ZoneOffset.UTC);

    /**
     * Etapa 1 (modo IA): propõe até 3 DNAs a partir dos esquemas do usuário, interpretando tudo o que eles carregam —
     * materiais, cores, estampas, marcas, ocasiões, estilos, estação, datas, hype — mais o DNA sintetizado e as
     * orientações livres. Sem IA remota, o motor local monta as propostas.
     */
    @Transactional
    public Map<String, Object> compositions(CurrentUser user, DnaComposeRequest req) {
        DnaComposeRequest r = req == null ? new DnaComposeRequest(null, List.of(), List.of(), null, null) : req;
        StyleDna dna = ensureDna(user);
        List<Scheme> own = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED).stream().limit(40).toList();
        if (own.size() < 2) {
            throw new ApiException(422, "ESQUEMAS_INSUFICIENTES", Msg.t("dna.crie_ao_menos_2_esquemas"),
                    Map.of("action", "/schemes/new"));
        }
        Map<UUID, List<SchemeItem>> itemsBy = groupItems(own);
        // contexto da IA com o HypeScore v2 PESSOAL do dono (os looks são dele); sem dados = null, nunca 0
        Map<UUID, HypeScoreCurrent> v2Rows = hypeV2Of(own.stream().map(Scheme::getId).toList());
        Map<UUID, Double> v2 = ownerScores(v2Rows);
        Map<String, Scheme> byRef = new LinkedHashMap<>();
        List<Map<String, Object>> catalog = new ArrayList<>();
        for (Scheme s : own) {
            String ref = "s" + (byRef.size() + 1);
            byRef.put(ref, s);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ref", ref);
            m.put("title", s.getTitle());
            m.put("date", s.getCreatedAt() == null ? null : s.getCreatedAt().toString().substring(0, 10));
            m.put("occasion", Json.csv(s.getOccasion()));
            m.put("style", Json.csv(s.getStyle()));
            m.put("season", s.getSeason() == null ? null : s.getSeason().name());
            m.put("hype", v2.containsKey(s.getId()) ? Math.round(v2.get(s.getId()) * 10) / 10.0 : null);
            m.put("hypeLevel", v2.containsKey(s.getId()) && v2Rows.get(s.getId()).getLevel() != null ? v2Rows.get(s.getId()).getLevel().name() : null);
            m.put("likes", s.getLikeCount());
            m.put("pieces", itemsBy.getOrDefault(s.getId(), List.of()).stream().map(si -> {
                WardrobeItem w = si.getWardrobeItem();
                Map<String, Object> pm = new LinkedHashMap<>(pieceBrief(w));
                pm.remove("id");
                pm.remove("imageUrl");
                pm.put("material", w.getMaterial());
                pm.put("analysis", SchemeService.pieceAnalysis(w)); // estampa, textura, caimento lidos da foto (RF4)
                return pm;
            }).toList());
            catalog.add(m);
        }
        String system = """
                Você monta Esquemas de DNA de Estilo do Fashion AI (RF13). Um DNA referencia de 2 a 6 esquemas de vestimenta do PRÓPRIO
                usuário (use só os refs fornecidos) e conta uma história com eles. narrativeType: TIMELINE, MOMENTOS_MARCANTES,
                PRIMEIRA_VEZ, CAPSULA_VERSATILIDADE, POR_OCASIAO, MOOD_BOARD, PALETA_DOMINANTE, HARMONIA_CROMATICA, MARCAS_FAVORITAS,
                HYPE_FOCUS, CARTELA_SAZONAL, LEGO ou null (só a anatomia base). cardLayout: AMPLIADO, GRADE, HORIZONTAL, LATERAL.
                Interprete TUDO o que os esquemas carregam: materiais, cores, estampas, marcas, ocasiões, estilos, estação, datas e hype,
                além do DNA sintetizado e das orientações livres (que podem citar cores, materiais, marcas, épocas ou momentos: respeite-as).
                MOMENTOS_MARCANTES exige exatamente um marco; CARTELA_SAZONAL exige seasonalTheme (SPRING, SUMMER, AUTUMN, WINTER).
                Proponha até 3 DNAs diferentes entre si. Responda SOMENTE com JSON:
                {"compositions":[{"title":string,"narrativeType":string|null,"cardLayout":string,"refs":["s1",...],
                "eraLabels":{"s1":"2024 · primeiro emprego"},"milestone":"s2"|null,"seasonalTheme":string|null,
                "occasion":[...],"style":[...],"rationale":"até 2 frases"}]}""";
        String prompt = Msg.t("dna.esquemas_dna_sintetizado_ocasiao_estilo", Json.write(catalog), Json.write(Map.of("archetype", String.valueOf(dna.getArchetype()), "palette", Json.csv(dna.getColorPalette()),
                "styles", Json.csv(dna.getStyleKeywords()), "silhouette", String.valueOf(dna.getSilhouette()))), r.occasion(), r.style(), r.narrativeType(), r.season(), (r.prompt() == null ? "" : InputSanitizer.clean(r.prompt(), 500)));
        List<String> inputs = List.of(Msg.t("dna.esquemas_de_vestimenta_seus_pecas", (own.size())),
                Msg.t("dna.dna_sintetizado_arquetipo_paleta_estilos"), Msg.t("dna.ocasiao_estilo_narrativa_estacao_pedidos"), Msg.t("common.orientacoes_livres"));
        AiOutcome<List<DnaProposal>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.DNA_SYNTHESIZER, system, prompt, List.of(), 1400,
                inputs, text -> parseProposals(text, byRef), () -> localProposals(own, itemsBy, r, v2), null));
        List<DnaProposal> list = outcome.value() == null || outcome.value().isEmpty() ? localProposals(own, itemsBy, r, v2) : outcome.value();
        Map<UUID, Scheme> byId = own.stream().collect(Collectors.toMap(Scheme::getId, s -> s));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("compositions", list.stream().map(pr -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("title", pr.title());
            m.put("narrativeType", pr.narrativeType() == null ? null : pr.narrativeType().name());
            m.put("cardLayout", pr.cardLayout());
            m.put("cells", pr.cells().stream().map(c -> {
                Map<String, Object> cm = new LinkedHashMap<>();
                cm.put("schemeId", c.schemeId());
                cm.put("title", byId.containsKey(c.schemeId()) ? byId.get(c.schemeId()).getTitle() : null);
                cm.put("eraLabel", c.eraLabel());
                cm.put("milestone", Boolean.TRUE.equals(c.milestone()));
                return cm;
            }).toList());
            m.put("occasion", pr.occasion());
            m.put("style", pr.style());
            m.put("seasonalTheme", pr.seasonalTheme() == null ? null : pr.seasonalTheme().name());
            m.put("rationale", pr.rationale());
            return m;
        }).toList());
        out.put("message", outcome.userMessage());
        out.put("fallbackUsed", outcome.fallbackUsed());
        out.put("provider", outcome.provider());
        out.put("explanation", outcome.explanation());
        return out;
    }

    List<DnaProposal> parseProposals(String text, Map<String, Scheme> byRef) {
        Map<String, Object> m = WardrobeService.extractJson(text);
        if (!(m.get("compositions") instanceof List<?> list)) {
            return null;
        }
        List<DnaProposal> out = new ArrayList<>();
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> c) || !(c.get("refs") instanceof List<?> refs)) {
                continue;
            }
            List<String> chosen = refs.stream().map(String::valueOf).filter(byRef::containsKey).distinct().limit(6).toList();
            if (chosen.size() < 2) {
                continue;
            }
            NarrativeType nt = enumOr(NarrativeType.class, c.get("narrativeType"), null);
            String layout = LAYOUTS.contains(String.valueOf(c.get("cardLayout"))) ? String.valueOf(c.get("cardLayout")) : "AMPLIADO";
            Map<?, ?> eras = c.get("eraLabels") instanceof Map<?, ?> em ? em : Map.of();
            String milestone = c.get("milestone") == null ? null : String.valueOf(c.get("milestone"));
            if (nt == NarrativeType.MOMENTOS_MARCANTES && (milestone == null || !chosen.contains(milestone))) {
                milestone = chosen.get(0);
            }
            final String mk = milestone;
            List<DnaCellForm> cells = chosen.stream().map(ref -> new DnaCellForm(byRef.get(ref).getId(),
                    eras.get(ref) == null ? era(byRef.get(ref)) : InputSanitizer.clean(String.valueOf(eras.get(ref)), 60), ref.equals(mk))).toList();
            Season season = enumOr(Season.class, c.get("seasonalTheme"), nt == NarrativeType.CARTELA_SAZONAL ? Season.AUTUMN : null);
            out.add(new DnaProposal(c.get("title") == null ? Msg.t("dna.meu_dna") : InputSanitizer.clean(String.valueOf(c.get("title")), 120), nt, layout, cells,
                    strs(c.get("occasion"), Taxonomy.OCCASIONS), strs(c.get("style"), Taxonomy.STYLES),
                    season, c.get("rationale") == null ? null : InputSanitizer.clean(String.valueOf(c.get("rationale")), 300)));
            if (out.size() == 3) {
                break;
            }
        }
        return out.isEmpty() ? null : out;
    }

    static <E extends Enum<E>> E enumOr(Class<E> type, Object raw, E fallback) {
        if (raw == null) {
            return fallback;
        }
        try {
            return Enum.valueOf(type, String.valueOf(raw).trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return fallback;
        }
    }

    static List<String> strs(Object raw, Collection<String> allowed) {
        return raw instanceof List<?> l ? l.stream().map(String::valueOf).filter(allowed::contains).distinct().limit(3).toList() : List.of();
    }

    static String era(Scheme s) {
        return s.getCreatedAt() == null ? null : ERA.format(s.getCreatedAt()).replace(".", "");
    }

    /** Motor local sem Hype (todas as células "sem dados"): a narrativa HYPE_FOCUS cai na ordem de criação. */
    static List<DnaProposal> localProposals(List<Scheme> own, Map<UUID, List<SchemeItem>> itemsBy, DnaComposeRequest r) {
        return localProposals(own, itemsBy, r, Map.of());
    }

    /**
     * Motor local: escolhe a narrativa pelas orientações/pedido e seleciona os esquemas que melhor a contam.
     * {@code hypeV2} = score v2 pessoal por look (ausente = sem dados), usado só pela narrativa HYPE_FOCUS.
     */
    static List<DnaProposal> localProposals(List<Scheme> own, Map<UUID, List<SchemeItem>> itemsBy, DnaComposeRequest r, Map<UUID, Double> hypeV2) {
        String q = (r.prompt() == null ? "" : r.prompt()).toLowerCase(Locale.ROOT);
        // filtro pelas orientações: cores, materiais, marcas, estampas, ocasiões e estilos citados
        List<Scheme> pool = own.stream().filter(s -> matches(s, itemsBy.getOrDefault(s.getId(), List.of()), q, r)).toList();
        if (pool.size() < 2) {
            pool = own;
        }
        List<NarrativeType> order = new ArrayList<>();
        if (r.narrativeType() != null) {
            order.add(r.narrativeType());
        }
        Map<String, NarrativeType> keywords = new LinkedHashMap<>();
        keywords.put("tempo|evolu|histór|histor|trajet|timeline|journey|over time|tiempo|trayect", NarrativeType.TIMELINE);
        keywords.put("marco|formatura|momento|conquista|milestone|graduation|achievement|hito|graduación|graduacion|logro", NarrativeType.MOMENTOS_MARCANTES);
        keywords.put("primeir|estreia|first time|debut|primera vez|estreno", NarrativeType.PRIMEIRA_VEZ);
        keywords.put("cápsula|capsula|versát|versat|poucas peças|capsule|versatil|few pieces|pocas piezas", NarrativeType.CAPSULA_VERSATILIDADE);
        keywords.put("ocasi|trabalho|festa|papel|occasion|work|party|role|trabajo|fiesta", NarrativeType.POR_OCASIAO);
        keywords.put("mood|inspira|afinidade", NarrativeType.MOOD_BOARD);
        keywords.put("paleta|cores|tons|cor |palette|colors|colours|tones|colores|tonos", NarrativeType.PALETA_DOMINANTE);
        keywords.put("harmonia|contraste|complement|harmony|contrast|armonía|armonia", NarrativeType.HARMONIA_CROMATICA);
        keywords.put("marca|brand", NarrativeType.MARCAS_FAVORITAS);
        keywords.put("hype|alta|tendên|tenden|bombando|trend|tendencia", NarrativeType.HYPE_FOCUS);
        keywords.put("inverno|verão|verao|outono|primavera|estaç|estac|sazon|winter|summer|autumn|fall|spring|season|invierno|verano|otoño|otono|estación|estacion", NarrativeType.CARTELA_SAZONAL);
        keywords.put("lego|bloco|block|bloque", NarrativeType.LEGO);
        keywords.forEach((re, nt) -> {
            if (java.util.regex.Pattern.compile(re).matcher(q).find() && !order.contains(nt)) {
                order.add(nt);
            }
        });
        for (NarrativeType nt : List.of(NarrativeType.TIMELINE, NarrativeType.POR_OCASIAO, NarrativeType.CAPSULA_VERSATILIDADE, NarrativeType.HYPE_FOCUS,
                NarrativeType.PALETA_DOMINANTE, NarrativeType.MOMENTOS_MARCANTES)) {
            if (!order.contains(nt)) {
                order.add(nt);
            }
        }
        Season season = r.season() != null ? r.season() : q.matches(".*(inverno|winter|invierno).*") ? Season.WINTER : q.matches(".*(verão|verao|summer|verano).*") ? Season.SUMMER
                : q.matches(".*(primavera|spring).*") ? Season.SPRING : Season.AUTUMN;
        List<DnaProposal> out = new ArrayList<>();
        Set<String> used = new HashSet<>();
        for (NarrativeType nt : order) {
            List<Scheme> pick = pickFor(nt, pool, itemsBy, season, hypeV2);
            if (pick.size() < 2 || !used.add(pick.stream().map(s -> s.getId().toString()).sorted().collect(Collectors.joining(",")) + nt)) {
                continue;
            }
            Scheme milestone = nt == NarrativeType.MOMENTOS_MARCANTES ? pick.get(0) : null;
            List<DnaCellForm> cells = pick.stream().map(s -> new DnaCellForm(s.getId(), era(s), s == milestone)).toList();
            List<String> occ = pick.stream().flatMap(s -> Json.csv(s.getOccasion()).stream()).distinct().limit(3).toList();
            List<String> sty = pick.stream().flatMap(s -> Json.csv(s.getStyle()).stream()).distinct().limit(3).toList();
            String layout = switch (nt) {
                case MARCAS_FAVORITAS, HYPE_FOCUS -> "HORIZONTAL";
                case PALETA_DOMINANTE, CARTELA_SAZONAL, CAPSULA_VERSATILIDADE -> "GRADE";
                case MOMENTOS_MARCANTES -> "LATERAL";
                default -> "AMPLIADO";
            };
            out.add(new DnaProposal(TITLES.getOrDefault(nt, Msg.t("dna.meu_dna")), nt, layout, cells, occ, sty, nt == NarrativeType.CARTELA_SAZONAL ? season : null,
                    RATIONALE.getOrDefault(nt, "") + (q.isBlank() ? "" : Msg.t("dna.considerou_as_suas_orientacoes", InputSanitizer.clean(r.prompt(), 80)))));
            if (out.size() == 3) {
                break;
            }
        }
        return out;
    }

    static final Map<NarrativeType, String> TITLES = new EnumMap<>(Map.of(NarrativeType.TIMELINE, Msg.k("dna.minha_linha_do_tempo"),
            NarrativeType.MOMENTOS_MARCANTES, Msg.k("dna.momentos_que_me_vestiram"), NarrativeType.PRIMEIRA_VEZ, Msg.k("dna.minhas_estreias"),
            NarrativeType.CAPSULA_VERSATILIDADE, Msg.k("dna.capsula_que_rende"), NarrativeType.POR_OCASIAO, Msg.k("dna.eu_em_cada_ocasiao"),
            NarrativeType.MOOD_BOARD, Msg.k("dna.mood_board_do_meu_estilo"), NarrativeType.PALETA_DOMINANTE, Msg.k("dna.minha_paleta"),
            NarrativeType.HARMONIA_CROMATICA, Msg.k("dna.cores_que_conversam"), NarrativeType.MARCAS_FAVORITAS, Msg.k("dna.marcas_que_me_vestem"),
            NarrativeType.HYPE_FOCUS, Msg.k("hypeDna.title")));
    static final Map<NarrativeType, String> RATIONALE = new EnumMap<>(Map.of(NarrativeType.TIMELINE, Msg.k("dna.looks_em_ordem_cronologica_espacados"),
            NarrativeType.MOMENTOS_MARCANTES, Msg.k("dna.o_look_mais_curtido_vira"),
            NarrativeType.PRIMEIRA_VEZ, Msg.k("dna.um_look_por_estreia_primeira"),
            NarrativeType.CAPSULA_VERSATILIDADE, Msg.k("dna.looks_que_reaproveitam_as_mesmas"),
            NarrativeType.POR_OCASIAO, Msg.k("dna.um_grupo_por_ocasiao_predominante"),
            NarrativeType.MOOD_BOARD, Msg.k("dna.looks_agrupados_por_afinidade_de"),
            NarrativeType.PALETA_DOMINANTE, Msg.k("dna.looks_cuja_cor_dominante_reforca"),
            NarrativeType.HARMONIA_CROMATICA, Msg.k("dna.looks_cujas_cores_formam_uma"),
            NarrativeType.MARCAS_FAVORITAS, Msg.k("dna.looks_que_mostram_as_marcas"),
            NarrativeType.HYPE_FOCUS, Msg.k("hypeDna.rationale")));

    static boolean matches(Scheme s, List<SchemeItem> items, String q, DnaComposeRequest r) {
        if (r.occasion() != null && !r.occasion().isEmpty() && Json.csv(s.getOccasion()).stream().noneMatch(r.occasion()::contains)) {
            return false;
        }
        if (r.style() != null && !r.style().isEmpty() && Json.csv(s.getStyle()).stream().noneMatch(r.style()::contains)) {
            return false;
        }
        if (q.isBlank()) {
            return true;
        }
        List<String> terms = new ArrayList<>();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            terms.add(String.valueOf(w.getColor()));
            terms.add(String.valueOf(w.getMaterial()));
            terms.add(String.valueOf(w.getBrand() != null ? w.getBrand().getName() : w.getBrandName()));
            terms.add(String.valueOf(w.getName()));
        }
        terms.addAll(Json.csv(s.getOccasion()));
        terms.addAll(Json.csv(s.getStyle()));
        terms.add(String.valueOf(s.getTitle()));
        // só filtra quando a orientação cita algo que existe em algum look; caso contrário a orientação guia só a narrativa
        return terms.stream().map(t -> t.toLowerCase(Locale.ROOT)).filter(t -> t.length() > 2 && !"null".equals(t)).anyMatch(q::contains);
    }

    static List<Scheme> pickFor(NarrativeType nt, List<Scheme> pool, Map<UUID, List<SchemeItem>> itemsBy, Season season) {
        return pickFor(nt, pool, itemsBy, season, Map.of());
    }

    static List<Scheme> pickFor(NarrativeType nt, List<Scheme> pool, Map<UUID, List<SchemeItem>> itemsBy, Season season, Map<UUID, Double> hypeV2) {
        List<Scheme> chrono = pool.stream().sorted(Comparator.comparing(Scheme::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))).toList();
        return switch (nt) {
            case TIMELINE, PRIMEIRA_VEZ, LEGO, MOOD_BOARD, MARCAS_FAVORITAS -> spread(chrono, 5);
            case MOMENTOS_MARCANTES -> pool.stream().sorted(Comparator.comparingLong(Scheme::getLikeCount).reversed()).limit(4).toList();
            // HYPE_FOCUS: maior HypeScore v2 pessoal primeiro; sem Hype (dados insuficientes/não calculado) por último, nunca como 0
            case HYPE_FOCUS -> pool.stream().sorted(Comparator.comparing((Scheme s) -> hypeV2.get(s.getId()), Comparator.nullsLast(Comparator.reverseOrder())))
                    .limit(4).toList();
            case POR_OCASIAO -> {
                Map<String, List<Scheme>> byOcc = new LinkedHashMap<>();
                pool.forEach(s -> byOcc.computeIfAbsent(Json.csv(s.getOccasion()).stream().findFirst().orElse("livre"), k -> new ArrayList<>()).add(s));
                List<Scheme> out = new ArrayList<>();
                byOcc.values().stream().limit(3).forEach(l -> out.addAll(l.stream().limit(2).toList()));
                yield out.size() >= 2 && byOcc.size() >= 2 ? out : List.of();
            }
            case CAPSULA_VERSATILIDADE -> {
                Map<UUID, Set<UUID>> piecesOf = new HashMap<>();
                pool.forEach(s -> piecesOf.put(s.getId(), itemsBy.getOrDefault(s.getId(), List.of()).stream().map(si -> si.getWardrobeItem().getId()).collect(Collectors.toSet())));
                List<Scheme> out = new ArrayList<>();
                Set<UUID> base = new HashSet<>();
                List<Scheme> rest = new ArrayList<>(pool);
                while (out.size() < 5 && !rest.isEmpty()) {
                    Scheme best = rest.stream().max(Comparator.comparingLong((Scheme s) -> piecesOf.get(s.getId()).stream()
                            .filter(id -> base.isEmpty() || base.contains(id)).count())).orElseThrow();
                    if (!base.isEmpty() && piecesOf.get(best.getId()).stream().noneMatch(base::contains)) {
                        break;
                    }
                    out.add(best);
                    base.addAll(piecesOf.get(best.getId()));
                    rest.remove(best);
                }
                yield out.size() >= 2 ? out : List.of();
            }
            case CARTELA_SAZONAL -> {
                List<Scheme> inSeason = pool.stream().filter(s -> s.getSeason() == season).toList();
                List<Scheme> out = new ArrayList<>(inSeason.stream().limit(4).toList());
                pool.stream().filter(s -> !out.contains(s)).limit(Math.max(0, 4 - out.size())).forEach(out::add);
                yield out;
            }
            case PALETA_DOMINANTE, HARMONIA_CROMATICA -> {
                Map<String, List<Scheme>> byFam = new LinkedHashMap<>();
                pool.forEach(s -> {
                    String c = itemsBy.getOrDefault(s.getId(), List.of()).stream().map(si -> si.getWardrobeItem().getColor()).filter(Objects::nonNull)
                            .collect(Collectors.groupingBy(x -> x, Collectors.counting())).entrySet().stream().max(Map.Entry.comparingByValue())
                            .map(Map.Entry::getKey).orElse("");
                    byFam.computeIfAbsent(String.valueOf(Taxonomy.COLOR_FAMILY.getOrDefault(c, "Neutro")), k -> new ArrayList<>()).add(s);
                });
                List<Scheme> out = new ArrayList<>();
                byFam.values().stream().sorted(Comparator.comparingInt((List<Scheme> l) -> l.size()).reversed()).forEach(l -> {
                    if (out.size() < 4) {
                        out.addAll(l.stream().limit(4 - out.size()).toList());
                    }
                });
                yield out;
            }
        };
    }

    /** Até n esquemas espaçados na ordem dada (primeiro e último sempre entram). */
    static List<Scheme> spread(List<Scheme> list, int n) {
        if (list.size() <= n) {
            return list;
        }
        List<Scheme> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            out.add(list.get((int) Math.round(i * (list.size() - 1) / (double) (n - 1))));
        }
        return out.stream().distinct().toList();
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
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("brand", e.getKey());
                    m.put("pieces", e.getValue()[0]);
                    m.put("structural", e.getValue()[1]);
                    m.put("logoUrl", logo.get(e.getKey()));
                    return m;
                })
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
                case LEGO -> Map.of("shown", 3, "counter", true);
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

    /** Cor dominante do esquema: média ponderada — peças estruturais (superior, inferior, peça única) pesam 3, as demais 1. */
    static String dominantColor(List<SchemeItem> items) {
        Map<String, Integer> weight = new LinkedHashMap<>();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            if (w.getColor() != null) {
                weight.merge(w.getColor(), Set.of("upper_piece", "lower_piece", "full_body_piece").contains(w.getCategory()) ? 3 : 1, Integer::sum);
            }
        }
        return weight.entrySet().stream().max(Map.Entry.comparingByValue()).map(e -> Taxonomy.hex(e.getKey())).orElse(null);
    }

    /**
     * Dados específicos de cada narrativa (Seção B): ordenação, agrupamento e elementos gráficos. {@code hypeByScheme} =
     * resumo v2 de cada célula já filtrado pela privacidade de quem vê (só a HYPE_FOCUS usa).
     */
    Map<String, Object> narrativeData(DnaScheme d, List<CellRef> items, Map<UUID, List<SchemeItem>> itemsBy, Map<UUID, Map<String, Object>> hypeByScheme) {
        if (!"DNA_COMPLETO".equals(d.getTargetElement()) || d.getNarrativeType() == null) {
            return Map.of();
        }
        Map<String, Object> n = new LinkedHashMap<>();
        switch (d.getNarrativeType()) {
            case TIMELINE -> n.put("order", items.stream().sorted(Comparator.comparing((CellRef i) -> i.scheme().getCreatedAt(), Comparator.nullsLast(Comparator.naturalOrder())))
                    .map(i -> i.scheme().getId()).toList());
            case MOMENTOS_MARCANTES -> {
                Optional<CellRef> cover = items.stream().filter(CellRef::milestone).findFirst();
                n.put("cover", cover.map(i -> i.scheme().getId()).orElse(items.isEmpty() ? null : items.get(0).scheme().getId()));
                n.put("coverLabel", cover.map(CellRef::eraLabel).orElse(null));
            }
            case PRIMEIRA_VEZ -> {
                List<Map<String, Object>> firsts = new ArrayList<>();
                Set<String> occ = new HashSet<>(), brands = new HashSet<>();
                List<CellRef> chrono = items.stream().sorted(Comparator.comparing((CellRef i) -> i.scheme().getCreatedAt(), Comparator.nullsLast(Comparator.naturalOrder()))).toList();
                for (int i = 0; i < chrono.size(); i++) {
                    Scheme s = chrono.get(i).scheme();
                    if (i == 0) {
                        firsts.add(Map.of("schemeId", s.getId(), "label", Msg.t("dna.n1_esquema_salvo"), "kind", "PRIMEIRO"));
                        occ.addAll(Json.csv(s.getOccasion()));
                        itemsBy.getOrDefault(s.getId(), List.of()).forEach(si -> brands.add(String.valueOf(si.getWardrobeItem().getBrandName())));
                        continue;
                    }
                    String newOcc = Json.csv(s.getOccasion()).stream().filter(o -> !occ.contains(o)).findFirst().orElse(null);
                    String newBrand = itemsBy.getOrDefault(s.getId(), List.of()).stream().map(si -> si.getWardrobeItem().getBrandName())
                            .filter(b -> b != null && !brands.contains(b)).findFirst().orElse(null);
                    if (newOcc != null) {
                        firsts.add(Map.of("schemeId", s.getId(), "label", Msg.t("dna.n1_vez_em", newOcc), "kind", "OCASIAO", "value", newOcc));
                    } else if (newBrand != null) {
                        firsts.add(Map.of("schemeId", s.getId(), "label", Msg.t("dna.n1_peca", newBrand), "kind", "MARCA", "value", newBrand));
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
                // fator de versatilidade = looks ÷ peças-base; "rende em média" = em quantos looks cada peça-base aparece
                n.put("factor", use.isEmpty() ? 0 : Math.round(10.0 * items.size() / use.size()) / 10.0);
                n.put("baseCount", use.size());
                n.put("avgUses", use.isEmpty() ? 0 : Math.round(10.0 * use.values().stream().mapToInt(Integer::intValue).sum() / use.size()) / 10.0);
            }
            case POR_OCASIAO -> n.put("groups", items.stream().collect(Collectors.groupingBy(i -> Json.csv(i.scheme().getOccasion()).stream().findFirst().orElse("livre"),
                    LinkedHashMap::new, Collectors.mapping(i -> i.scheme().getId(), Collectors.toList()))));
            case MOOD_BOARD -> n.put("orbits", items.stream().map(i -> Map.of("schemeId", i.scheme().getId(), "orbit",
                    Json.csv(i.scheme().getStyle()).stream().anyMatch(s -> Json.csv(d.getStyle() == null ? "" : d.getStyle()).contains(s)) ? 1 : 2)).toList());
            case PALETA_DOMINANTE -> {
                Map<String, Long> freq = itemsBy.values().stream().flatMap(List::stream).map(si -> si.getWardrobeItem().getColor()).filter(Objects::nonNull)
                        .collect(Collectors.groupingBy(c -> c, Collectors.counting()));
                long total = freq.values().stream().mapToLong(Long::longValue).sum();
                n.put("band", freq.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(5)
                        .map(e -> Map.of("color", e.getKey(), "hex", String.valueOf(Taxonomy.hex(e.getKey())), "share", total == 0 ? 0 : Math.round(100.0 * e.getValue() / total))).toList());
            }
            case HARMONIA_CROMATICA -> n.put("harmony", harmony(itemsBy.values().stream().flatMap(List::stream).map(si -> si.getWardrobeItem().getColor()).toList()));
            case MARCAS_FAVORITAS -> n.put("ranking", logoRanking(itemsBy.values().stream().flatMap(List::stream).toList()));
            case HYPE_FOCUS -> {
                // P2-12: medidores em HypeScore v2 (score + faixa; "sem dados" = status, nunca 0), maior Hype primeiro e
                // sem Hype por último. "hype" (v1) segue só por compatibilidade (deprecado).
                List<Map<String, Object>> meters = new ArrayList<>();
                for (CellRef i : items) {
                    Map<String, Object> v2 = hypeByScheme.getOrDefault(i.scheme().getId(), HypeScoreService.v2Summary(null, null, null));
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("schemeId", i.scheme().getId());
                    m.put("status", v2.get("status"));
                    m.put("score", v2.get("score"));
                    m.put("level", v2.get("level"));
                    m.put("hype", hypeOf(i.scheme()));   // @deprecated v1
                    meters.add(m);
                }
                meters.sort(Comparator.comparing((Map<String, Object> m) -> hypeScoreOf(m), Comparator.nullsLast(Comparator.reverseOrder())));
                n.put("meters", meters);
                n.put("basis", "HYPE_V2");
            }
            case CARTELA_SAZONAL -> n.put("season", Map.of("theme", String.valueOf(d.getSeasonalTheme()), "preset", switch (d.getSeasonalTheme() == null ? Season.AUTUMN : d.getSeasonalTheme()) {
                case WINTER -> "frost";
                case SUMMER -> "solstice";
                case AUTUMN -> "ember";
                default -> "bloom";
            }, "note", Msg.t("dna.escolher_a_cartela_sazonal_sobrescreve")));
            case LEGO -> n.put("blocks", Map.of("order", List.of("chrome", "hero", "titulo", "lista", "logos", "frase"), "socialOutsideContainer", true,
                    "note", Msg.t("dna.lego_muda_a_forma_nao")));
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
