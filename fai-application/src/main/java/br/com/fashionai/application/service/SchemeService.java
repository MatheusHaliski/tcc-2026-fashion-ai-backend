package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.imaging.ImageFilters;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.imaging.MannequinGeometry;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.ports.CounterStorePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.DisplayMode;
import br.com.fashionai.domain.model.enums.Mood;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF5 (Criar Look em 5 etapas: 1 modo · 2 prompt IA · 3 formulário · 4 arte · 5 preview/slots/salvar — etapas
 * 2 e 3 coexistem e só o salvar da etapa 5 persiste), RF9 (edição + "melhorar com IA" por diff), RF31 (toggles),
 * RF19.CA13 remixar e a renderização do card (preview e exportação).
 */
@Service
public class SchemeService {
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final ReactionRepository reactions;
    private final SavedItemRepository saved;
    private final WardrobeService wardrobe;
    private final BackgroundStudioService studio;
    private final SealService seals;
    private final SchemeCardRenderer renderer;
    private final ProjectionService projections;
    private final NotificationService notifications;
    private final CounterStorePort counters;
    private final MediaService media;
    private final AiEngine ai;
    private final Guard guard;
    private final Audit audit;
    private final DailyLookService dailyLooks;
    private final ApplicationEventPublisher events;
    private final StyleDnaRepository dna;
    /**
     * RF53 — HypeScore v2 lido direto do estado gravado pelo job (GET nunca recalcula). Repositório + configuração, e
     * NÃO o HypeQueryService: ele injeta este serviço (views dos looks), e a injeção inversa fecharia um ciclo.
     */
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;

    public SchemeService(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces,
                         UserRepository users, ReactionRepository reactions, SavedItemRepository saved,
                         WardrobeService wardrobe, BackgroundStudioService studio, SealService seals,
                         SchemeCardRenderer renderer, ProjectionService projections, NotificationService notifications,
                         CounterStorePort counters, MediaService media, AiEngine ai, Guard guard, Audit audit,
                         DailyLookService dailyLooks, ApplicationEventPublisher events, StyleDnaRepository dna,
                         HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
        this.dna = dna;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.users = users;
        this.reactions = reactions;
        this.saved = saved;
        this.wardrobe = wardrobe;
        this.studio = studio;
        this.seals = seals;
        this.renderer = renderer;
        this.projections = projections;
        this.notifications = notifications;
        this.counters = counters;
        this.media = media;
        this.ai = ai;
        this.guard = guard;
        this.audit = audit;
        this.dailyLooks = dailyLooks;
        this.events = events;
    }

    // ================================================================== etapa 1/3 — compositor
    /** RF5.CA01/CA02/CA07b — listas por parte do corpo espelhando o guarda-roupa real (só disponíveis). */
    @Transactional(readOnly = true)
    public Map<String, Object> builder(CurrentUser user) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        long total = pieces.countByUserId(user.id());
        out.put("totalPieces", total);
        out.put("eligiblePieces", eligible.size());
        // Etapa 3 (formulário): as peças exibidas são SEMPRE as cadastradas pelo usuário no RF4 (guarda-roupa próprio);
        // as indisponíveis/reprovadas ficam ocultas e o total informa quantas.
        out.put("source", "RF4");
        out.put("hiddenPieces", Math.max(0, total - eligible.size()));
        if (eligible.size() < 2) {
            out.put("status", "INSUFICIENTE");
            out.put("message", Msg.t("scheme.voce_precisa_de_ao_menos"));
            out.put("action", Map.of("label", Msg.t("common.adicionar_nova_peca"), "href", "/pieces/new"));
        } else {
            out.put("status", "PRONTO");
        }
        Map<String, List<Views.PieceView>> lists = new LinkedHashMap<>();
        for (String cat : Taxonomy.SUBCATEGORIES.keySet()) {
            lists.put(cat, eligible.stream().filter(w -> cat.equals(w.getCategory()))
                    .map(w -> Views.piece(w, null, null)).toList());
        }
        out.put("lists", lists);
        User u = users.findById(user.id()).orElseThrow();
        out.put("defaultVisibility", AccountService.defaultVisibility(u));
        out.put("steps", List.of(Msg.t("scheme.n1_modo_de_geracao"), Msg.t("scheme.n2_prompt_da_ia"), Msg.t("scheme.n3_formulario_manual"), Msg.t("scheme.n4_arte_de_background"),
                Msg.t("scheme.n5_preview_slots_e_salvar")));
        out.put("displayModes", DisplayMode.values());
        out.put("moods", Mood.values());
        out.put("seasons", Season.values());
        out.put("anatomies", BackgroundStudioService.ANATOMIES);
        out.put("sealPlacements", BackgroundStudioService.SEAL_PLACEMENT);
        out.put("pieceSealPlacements", BackgroundStudioService.PIECE_SEAL_PLACEMENT);
        return out;
    }

    // ================================================================== etapa 2 — gerar com IA (RF5.CA04)
    public record ComposeRequest(List<String> occasion, List<String> style, String mood, String season, String prompt,
                                 List<String> excludeCombinations) {
    }

    public record ComposeResult(List<LocalSchemeComposer.Composition> compositions, String message,
                                AiOutcome.Explanation explanation, UUID inferenceId, AiOutcome.Quota quota,
                                boolean fallbackUsed, String provider,
                                /** o que a orientação livre pediu (CopilotService.orientation): background, ocasiões, estilos, estação, humor */
                                Map<String, Object> orientation,
                                /**
                                 * RF53 (P2-14) — os seis números de cada composição (RecommendationScoring, mesma ordem de
                                 * {@code compositions}), calculados pelo LookPreviewService; nulo quando não deu para calcular
                                 */
                                List<Map<String, Object>> scores) {
        public ComposeResult(List<LocalSchemeComposer.Composition> compositions, String message, AiOutcome.Explanation explanation,
                             UUID inferenceId, AiOutcome.Quota quota, boolean fallbackUsed, String provider) {
            this(compositions, message, explanation, inferenceId, quota, fallbackUsed, provider, null, null);
        }

        public ComposeResult(List<LocalSchemeComposer.Composition> compositions, String message, AiOutcome.Explanation explanation,
                             UUID inferenceId, AiOutcome.Quota quota, boolean fallbackUsed, String provider, Map<String, Object> orientation) {
            this(compositions, message, explanation, inferenceId, quota, fallbackUsed, provider, orientation, null);
        }

        public ComposeResult withOrientation(Map<String, Object> orientation) {
            return new ComposeResult(compositions, message, explanation, inferenceId, quota, fallbackUsed, provider,
                    orientation == null || orientation.isEmpty() ? null : orientation, scores);
        }

        public ComposeResult withScores(List<Map<String, Object>> scores) {
            return new ComposeResult(compositions, message, explanation, inferenceId, quota, fallbackUsed, provider, orientation,
                    scores == null || scores.size() != (compositions == null ? 0 : compositions.size()) ? null : scores);
        }
    }

    public ComposeResult compose(CurrentUser user, ComposeRequest req, AiCapability capability) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        if (eligible.size() < 2) {
            throw new ApiException(422, "ACERVO_INSUFICIENTE",
                    Msg.t("scheme.cadastre_ao_menos_2_pecas"), Map.of("href", "/pieces/new"));
        }
        Set<String> exclude = new HashSet<>(req.excludeCombinations() == null ? List.of() : req.excludeCombinations());
        Map<String, WardrobeItem> byRef = new LinkedHashMap<>();
        List<Map<String, Object>> catalog = new ArrayList<>();
        // RF53 (P2-14) — a IA recebe o HypeScore v2 das peças (Hype pessoal do dono: são as próprias peças), não o v1
        Map<UUID, HypeScoreCurrent> hype = currentHype(HypeEntityType.PIECE, eligible.stream().map(WardrobeItem::getId).toList());
        int i = 1;
        for (WardrobeItem w : eligible) {
            String ref = "p" + i++;
            byRef.put(ref, w);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ref", ref);
            m.put("name", w.getName());
            m.put("category", w.getCategory());
            m.put("subcategory", w.getSubcategory());
            m.put("color", w.getColor());
            m.put("material", w.getMaterial());
            m.put("sex", w.getSex());
            m.put("style", Json.csv(w.getStyleTags()));
            m.put("occasion", Json.csv(w.getOccasionTags()));
            m.put("brand", w.getBrandName());
            // RF5 etapa 2 — tudo que a peça carrega no RF4 entra na interpretação da IA
            m.put("size", w.getSizeLabel());
            m.put("condition", w.getCondition() == null ? null : w.getCondition().name());
            m.put("price", w.getPrice());
            m.put("favorite", w.isFavorite());
            m.put("wearCount", w.getWearCount());
            m.put("lastWorn", w.getLastWornDate());
            HypeScoreCurrent h = hype.get(w.getId());
            // sem dados = nulo (nunca 0); a faixa acompanha o número
            m.put("hypeScore", h == null || h.getScore() == null ? null : h.getScore().setScale(0, java.math.RoundingMode.HALF_UP));
            HypeLevel level = h == null || h.getScore() == null ? null : levelOf(h);
            m.put("hypeLevel", level == null ? null : level.name());
            m.put("tags", Json.csv(w.getTags()));
            m.put("notes", InputSanitizer.clean(w.getNotes(), 160));
            m.put("analysis", pieceAnalysis(w));
            catalog.add(m);
        }
        List<AiRequest.AiImage> photos = new ArrayList<>();
        List<String> photoRefs = new ArrayList<>();
        for (Map.Entry<String, WardrobeItem> e : byRef.entrySet()) {
            if (photos.size() >= MAX_COMPOSE_PHOTOS) {
                break;
            }
            WardrobeItem w = e.getValue();
            if (w.isDefaultImage()) {
                continue;
            }
            String url = w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl();
            if (url == null) {
                continue;
            }
            media.read(url).ifPresent(bytes -> {
                photos.add(new AiRequest.AiImage(bytes, ImageOps.detectMime(bytes)));
                photoRefs.add(e.getKey());
            });
        }
        Map<String, Object> profile = new LinkedHashMap<>();
        users.findById(user.id()).ifPresent(u -> profile.put("country", u.getCountry()));
        dna.findByUserId(user.id()).ifPresent(d -> profile.put("styleDna", dnaContext(d)));
        String system = """
                Você é o Scheme Composer do Fashion AI. Monte EXATAMENTE 3 looks distintos usando SOMENTE as peças do
                acervo informado (referências p1, p2...). Nunca invente peças. Cada look: 2 a 4 peças, no máximo 1 de cada
                tipo (upper/lower/shoes/accessory; full_body ocupa upper e lower), sexo coerente.
                Interprete TUDO que o acervo oferece: materiais (texturas e combinações — linho/algodão para calor, lã/couro
                para frio, evite três materiais pesados juntos), cores (harmonia, contraste, paleta e estação cromática do
                DNA de estilo), padrões/estampas (no máximo uma estampa forte por look; leia a estampa real nas fotos),
                as FOTOS anexadas (caimento, corte, comprimento, brilho, estado real da peça), tamanho/caimento, estado de
                conservação, preço (coerência entre peças), frequência de uso (varie peças pouco usadas quando o usuário
                pedir novidade), favoritas, notas/tags do usuário, além de ocasião, estilo, humor, estação e clima do país.
                hypeScore (0–100) e hypeLevel são o HypeScore v2: a relevância atual da peça no FashionAI, não qualidade
                nem gosto pessoal; nulo = sem dados. Use só como contexto, nunca como critério principal do look.
                As orientações livres do usuário podem citar materiais, cores, estampas ou peças específicas: respeite-as.
                Sintetize ocasião e estilo (máx. 3 cada, nunca concatene as tags das peças). No rationale, cite os
                atributos que pesaram (ex.: "linho cru + terracota, sem estampa, clima quente"). Responda SOMENTE com JSON:
                {"compositions":[{"title":string,"refs":["p1",...],"occasion":[...],"style":[...],"mood":one of
                [ENERGETIC,ELEGANT,COMFORTABLE,SOPHISTICATED],"rationale":"até 2 frases"}]}"""
                + "\nEscreva title e rationale em " + Msg.languageName() + "; refs, occasion, style e mood seguem os códigos acima.";
        String prompt = Msg.t("scheme.acervo_ocasiao_estilo_humor_estacao", Json.write(catalog), (photoRefs.isEmpty() ? "" : "\nFotos anexadas, na ordem, das peças: " + photoRefs), (profile.isEmpty() ? "" : "\nPerfil do usuário: " + Json.write(profile)), req.occasion(), req.style(), req.mood(), req.season(), (req.prompt() == null ? "" : InputSanitizer.clean(req.prompt(), 500)), (exclude.isEmpty() ? "" : "\nNÃO repita estas combinações (refs ordenadas): " + exclude));
        List<String> inputs = new ArrayList<>(List.of(Msg.t("scheme.pecas_do_acervo_com_todos", (eligible.size())),
                Msg.t("scheme.ocasiao_estilo_humor_estacao_pedidos"), Msg.t("common.orientacoes_livres")));
        if (!photoRefs.isEmpty()) {
            inputs.add(Msg.t("scheme.fotos_das_pecas_visao", (photoRefs.size())));
        }
        if (profile.containsKey("styleDna")) {
            inputs.add(Msg.t("scheme.dna_de_estilo_arquetipo_paleta"));
        }
        AiOutcome<List<LocalSchemeComposer.Composition>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), capability,
                system, prompt, photos, 1800, inputs,
                text -> parseCompositions(text, byRef, req, exclude),
                () -> LocalSchemeComposer.compose(eligible, req.occasion(), req.style(), req.season(), req.prompt(), 12).stream()
                        .filter(c -> !exclude.contains(combinationKey(c.items().stream().map(LocalSchemeComposer.Pick::wardrobeItemId).toList())))
                        .limit(3).toList(), null));
        List<LocalSchemeComposer.Composition> list = outcome.value() == null ? List.of() : outcome.value();
        String message = outcome.userMessage();
        if (list.size() < 3) {
            message = Msg.t("scheme.seu_acervo_permitiu_combinacao_oes", ((message == null ? "" : message + " ")), list.size());
        }
        return new ComposeResult(list, message, outcome.explanation(), outcome.inferenceId(), outcome.quota(),
                outcome.fallbackUsed(), outcome.provider());
    }

    /** Fotos enviadas à IA na etapa 2 (miniaturas das peças mais recentes). */
    static final int MAX_COMPOSE_PHOTOS = 12;

    /** Atributos visuais detectados no RF4 (Piece Analyzer / flat lay): padrão, estampa, textura, cores, caimento. */
    static Map<String, Object> pieceAnalysis(WardrobeItem w) {
        Map<String, Object> src = Json.map(w.getFlatLayMetadataJson());
        Map<String, Object> out = new LinkedHashMap<>();
        for (String key : List.of("pattern", "print", "texture", "fit", "colors", "dominantColors", "secondaryColors",
                "neckline", "sleeve", "length", "finish", "silhouette", "season", "attributes")) {
            Object v = src.get(key);
            if (v != null && !(v instanceof Map<?, ?>)) {
                out.put(key, v instanceof String str ? InputSanitizer.clean(str, 120) : v);
            }
        }
        return out.isEmpty() ? null : out;
    }

    /** Resumo do DNA de estilo (RF19) que orienta cores, silhueta e arquétipo na composição. */
    static Map<String, Object> dnaContext(StyleDna d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("archetype", d.getArchetype() == null ? null : d.getArchetype().name());
        m.put("boldnessIndex", d.getBoldnessIndex());
        m.put("identityPhrase", d.getIdentityPhrase());
        m.put("colorPalette", d.getColorPalette());
        m.put("colorSeason", d.getColorSeason());
        m.put("styleKeywords", d.getStyleKeywords());
        m.put("silhouette", d.getSilhouette());
        m.put("iconPiece", d.getIconPieceName());
        return m;
    }

    List<LocalSchemeComposer.Composition> parseCompositions(String text, Map<String, WardrobeItem> byRef, ComposeRequest req,
                                                            Set<String> exclude) {
        Map<String, Object> m = WardrobeService.extractJson(text);
        if (!(m.get("compositions") instanceof List<?> list)) {
            return null;
        }
        List<LocalSchemeComposer.Composition> out = new ArrayList<>();
        Set<String> seen = new HashSet<>(exclude);
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> c) || !(c.get("refs") instanceof List<?> refs)) {
                continue;
            }
            // a IA às vezes repete o tipo (duas blusas); o look fica com a primeira de cada tipo
            List<WardrobeItem> chosen = LocalSchemeComposer.onePerType(
                    refs.stream().map(String::valueOf).map(byRef::get).filter(Objects::nonNull).distinct().toList());
            if (chosen.size() < 2) {
                continue;
            }
            String key = combinationKey(chosen.stream().map(WardrobeItem::getId).toList());
            if (!seen.add(key)) {
                continue;
            }
            LocalSchemeComposer.Composition base = LocalSchemeComposer.toComposition(chosen,
                    strs(c.get("occasion"), Taxonomy.OCCASIONS, 3, req.occasion()), strs(c.get("style"), Taxonomy.STYLES, 3, req.style()),
                    req.season(), 0);
            String title = c.get("title") == null ? base.title() : InputSanitizer.clean(String.valueOf(c.get("title")), 120);
            String mood = c.get("mood") != null && Set.of("ENERGETIC", "ELEGANT", "COMFORTABLE", "SOPHISTICATED")
                    .contains(String.valueOf(c.get("mood"))) ? String.valueOf(c.get("mood")) : base.mood();
            String rationale = c.get("rationale") == null ? base.rationale() : InputSanitizer.clean(String.valueOf(c.get("rationale")), 300);
            // selos só vêm de vínculo com marca/celebridade (RF25), nunca de rótulo genérico da composição
            out.add(new LocalSchemeComposer.Composition(title, base.items(), base.occasions(), base.styles(), req.season(), mood,
                    List.of(), base.totalPrice(), 1, rationale));
            if (out.size() == 3) {
                break;
            }
        }
        return out.isEmpty() ? null : out;
    }

    private static List<String> strs(Object o, List<String> allowed, int max, List<String> fallback) {
        List<String> out = new ArrayList<>();
        if (o instanceof List<?> l) {
            l.stream().map(String::valueOf).filter(allowed::contains).distinct().limit(max).forEach(out::add);
        }
        return out.isEmpty() && fallback != null ? fallback.stream().limit(max).toList() : out;
    }

    public static String combinationKey(List<UUID> ids) {
        return ids.stream().map(UUID::toString).sorted().collect(Collectors.joining("+"));
    }

    // ================================================================== etapa 5 — salvar (RF5.CA03/CA05/CA06)
    public record ItemForm(UUID wardrobeItemId, SchemeSlot slot, Integer sortOrder, Integer zIndex, BigDecimal positionX,
                           BigDecimal positionY, BigDecimal scale, BigDecimal rotation, BigDecimal opacity,
                           Map<String, Object> filters) {
    }

    public record SchemeForm(String title, String description, List<String> occasion, List<String> style, Season season,
                             Mood mood, Visibility visibility, DisplayMode displayMode, List<ItemForm> items,
                             CreationMode creationMode, SchemeOrigin origin, UUID remixedFromId, Map<String, Object> background,
                             Boolean applyRecommendedDirection, String cardSkin, String layoutAnatomy, List<String> tags,
                             List<String> seals, Boolean publish, Boolean lookDoDia) {
    }

    @Transactional
    public Map<String, Object> create(CurrentUser user, SchemeForm form) {
        guard.requireCanCreate(user);
        User owner = users.findById(user.id()).orElseThrow();
        if (form.items() == null || form.items().isEmpty()) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("scheme.adicione_ao_menos_1_peca"));
        }
        Scheme s = new Scheme();
        s.setUser(owner);
        s.setCreationMode(form.creationMode() == null ? CreationMode.MANUAL : form.creationMode());
        s.setOrigin(form.origin() == null ? SchemeOrigin.CRIAR_LOOK : form.origin());
        s.setVisibility(form.visibility() != null ? form.visibility() : AccountService.defaultVisibility(owner));
        applyForm(s, form);
        if (form.remixedFromId() != null) {
            Scheme src = schemes.findById(form.remixedFromId()).orElseThrow(() -> ApiException.notFound(Msg.t("scheme.esquema_de_origem")));
            // mesma regra do remix pela interação: visibilidade efetiva (look × perfil do autor), bloqueio e arquivamento
            requireView(user, src);
            if (!src.isDisponivel() && !src.getUser().getId().equals(user.id())) {
                throw ApiException.conflict("INDISPONIVEL", Msg.t("scheme.o_autor_marcou_este_look"));
            }
            s.setOriginalScheme(src);
            s.setOrigin(SchemeOrigin.REMIX);
        }
        schemes.save(s);
        List<SchemeItem> items = replaceItems(user, s, form.items());
        studio.applyToScheme(s, form.background(), Boolean.TRUE.equals(form.applyRecommendedDirection()));
        applyLookPhoto(user, s, form.background(), items);
        if (Boolean.TRUE.equals(form.publish())) {
            publishInternal(s, items);
        }
        if (s.getOriginalScheme() != null) {
            Scheme src = s.getOriginalScheme();
            src.setRemixCount(src.getRemixCount() + 1);
            counters.increment("scheme", src.getId(), "remixes", 1);
            notifications.notify(src.getUser().getId(), owner.getId(), NotificationType.NEW_REMIX, "SCHEME", s.getId(),
                    Msg.k("scheme.seu_look_foi_remixado"), Msg.k("scheme.criou_um_look_a_partir", owner.getUsername(), src.getTitle()), null);
            events.publishEvent(new DomainEvents.InteractionReceived(src.getUser().getId(), owner.getId(), "REMIX", src.getId()));
            events.publishEvent(new DomainEvents.HypeSignal(HypeSignalType.LOOK_REMIXED, HypeEntityType.SCHEME, src.getId(), owner.getId(), src.getUser().getId()));
        }
        projections.scheme(s, items);
        List<UUID> pieceIds = items.stream().map(si -> si.getWardrobeItem().getId()).toList();
        // RF32–RF36: diário de uso, FAI Points, conquistas secretas, progresso de desafios
        events.publishEvent(new DomainEvents.SchemeSaved(owner.getId(), s.getId(), pieceIds, s.getOrigin().name(), true));
        String dailyLookWarning = null;
        if (Boolean.TRUE.equals(form.lookDoDia())) {
            try {
                dailyLooks.register(user, s, DailyLookSource.MANUAL, LocalDate.now(FaiPointsService.ZONE));
            } catch (ApiException ex) {
                s.setLookDoDia(false);
                dailyLookWarning = ex.getMessage();
            }
        }
        notifications.notify(owner.getId(), null, NotificationType.SCHEME_CREATED, "SCHEME", s.getId(),
                Msg.k("scheme.esquema_criado_com_sucesso"), Msg.k("scheme.foi_adicionado_aos_seus_looks", s.getTitle()), null);
        audit.log(user, AuditActions.CRIACAO_ESQUEMA, "scheme:" + s.getId(), Map.of("items", items.size(),
                "creationMode", s.getCreationMode().name(), "origin", s.getOrigin().name()));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scheme", view(user, s, items));
        if (dailyLookWarning != null) {
            out.put("dailyLookWarning", dailyLookWarning);
        }
        // RF20.CA01 — a sugestão de vínculo roda depois do commit (SchemeController → suggestSealsAfterSave): uma falha
        // na sugestão não pode marcar esta transação como rollback-only e derrubar o salvamento do esquema.
        return out;
    }

    /**
     * RF20.CA01 — sugestão de vínculo não bloqueante, chamada fora da transação do salvamento (o esquema já está
     * gravado). {@code seals.suggest} abre a própria transação; se falhar, devolve a mensagem sem afetar o esquema.
     */
    public Map<String, Object> suggestSealsAfterSave(CurrentUser user, UUID schemeId) {
        try {
            return seals.suggest(user, schemeId);
        } catch (RuntimeException ex) {
            return Map.of("suggestions", List.of(), "message", Msg.t("scheme.sugestao_de_vinculo_indisponivel_agora"));
        }
    }

    private void applyForm(Scheme s, SchemeForm f) {
        s.setTitle(InputSanitizer.required("title", InputSanitizer.moderated("title", f.title(), 120), 2, 120));
        s.setDescription(InputSanitizer.moderated("description", f.description(), 1000));
        Map<String, Object> errors = new LinkedHashMap<>();
        Taxonomy.requireTags("occasion", f.occasion(), Taxonomy.OCCASIONS, 3, errors);
        Taxonomy.requireTags("style", f.style(), Taxonomy.STYLES, 3, errors);
        if (f.seals() != null && f.seals().size() > 4) {
            errors.put("seals", Msg.t("scheme.maximo_de_4_selos_sugeridos"));
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), errors);
        }
        s.setOccasion(Json.csv(f.occasion()));
        s.setStyle(Json.csv(f.style()));
        s.setSeason(f.season());
        s.setMood(f.mood());
        if (f.displayMode() != null) {
            s.setDisplayMode(f.displayMode());
        }
        if (f.cardSkin() != null) {
            s.setCardSkin(f.cardSkin());
        }
        if (f.layoutAnatomy() != null) {
            s.setLayoutAnatomy(f.layoutAnatomy());
        }
        s.setTags(Json.csv(f.tags() == null ? List.of() : f.tags().stream().map(t -> t.replaceFirst("^#", "")).toList()));
        if (f.lookDoDia() != null) {
            s.setLookDoDia(f.lookDoDia());
        }
    }

    private List<SchemeItem> replaceItems(CurrentUser user, Scheme s, List<ItemForm> forms) {
        Map<UUID, WardrobeItem> own = new LinkedHashMap<>();
        for (ItemForm f : forms) {
            if (f.wardrobeItemId() == null) {
                throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), Map.of("items", Msg.t("scheme.cada_item_precisa_de_wardrobeitemid")));
            }
            WardrobeItem w = pieces.findById(f.wardrobeItemId()).orElseThrow(() -> ApiException.notFound(Msg.t("scheme.peca", f.wardrobeItemId())));
            if (!w.getUser().getId().equals(user.id())) {
                // RF5.CA07b / RF30.CA02 — só peças do acervo real do usuário.
                throw ApiException.badRequest("PECA_DE_OUTRO_USUARIO", Msg.t("scheme.use_apenas_pecas_do_seu"));
            }
            if (!w.isDisponivel()) {
                throw ApiException.badRequest("PECA_INDISPONIVEL", Msg.t("scheme.a_peca_esta_marcada_como", w.getName()));
            }
            own.put(w.getId(), w);
        }
        List<SchemeItem> existing = schemeItems.findBySchemeIdOrderBySortOrder(s.getId());
        Map<UUID, SchemeItem> byPiece = existing.stream().collect(Collectors.toMap(si -> si.getWardrobeItem().getId(), si -> si, (a, b) -> a));
        List<SchemeItem> result = new ArrayList<>();
        int order = 0;
        Set<UUID> kept = new HashSet<>();
        for (ItemForm f : forms) {
            WardrobeItem w = own.get(f.wardrobeItemId());
            if (!kept.add(w.getId())) {
                continue;
            }
            SchemeItem si = byPiece.getOrDefault(w.getId(), new SchemeItem());
            boolean created = si.getId() == null;
            si.setScheme(s);
            si.setWardrobeItem(w);
            si.setSlot(f.slot() != null ? f.slot() : LocalSchemeComposer.slotOf(w));
            si.setTryOnLayer(MannequinGeometry.layerOf(si.getSlot()));
            si.setSortOrder(f.sortOrder() == null ? order : f.sortOrder());
            si.setZIndex(f.zIndex() == null ? order : f.zIndex());
            si.setPositionX(f.positionX());
            si.setPositionY(f.positionY());
            si.setScale(f.scale() == null ? BigDecimal.ONE : f.scale());
            si.setRotation(f.rotation() == null ? BigDecimal.ZERO : f.rotation());
            si.setOpacity(f.opacity() == null ? BigDecimal.ONE : f.opacity());
            ImageFilters.Filters filters = ImageFilters.Filters.of(f.filters());
            si.setFiltersJson(filters.neutral() ? null : Json.write(Map.of("blur", filters.blur(), "saturation", filters.saturation(),
                    "brightness", filters.brightness(), "contrast", filters.contrast(), "hue_shift", filters.hueShift())));
            schemeItems.save(si);
            if (created) {
                w.setSchemeUsageCount(w.getSchemeUsageCount() + 1);
            }
            result.add(si);
            order++;
        }
        for (SchemeItem old : existing) {
            if (!kept.contains(old.getWardrobeItem().getId())) {
                // RF9.CA02 — remover do esquema não remove do Closet.
                schemeItems.delete(old);
            }
        }
        s.setTotalPrice(result.stream().map(si -> si.getWardrobeItem().getPrice()).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        if (s.getCoverImageUrl() == null && !result.isEmpty()) {
            s.setCoverImageUrl(result.get(0).getWardrobeItem().getImageUrl());
        }
        // selos nunca são rótulos automáticos por preço/material: só vínculos com marca ou celebridade (RF20/RF21)
        return result;
    }

    // ================================================================== foto do look (como a foto de um post)
    static final List<String> PHOTO_PIPELINE = List.of(Msg.k("scheme.formato_validado_jpeg_png_webp"), Msg.k("scheme.tamanho_minimo_400_400_px"),
            Msg.k("scheme.proporcao_de_post_entre_1"), Msg.k("scheme.redimensionada_para_no_maximo_1600"), Msg.k("scheme.metadados_removidos_exif_gps"),
            Msg.k("scheme.registrada_na_moderacao_de_midia"), Msg.k("scheme.filtros_aplicados_na_exibicao_sem"));

    /**
     * RF5 — a foto do conjunto é enviada pelo usuário, como a foto de um post. Passa pelo pipeline (validação, redimensionamento,
     * reencode sem metadados, registro na moderação); os filtros escolhidos (brilho, contraste, saturação, matiz, desfoque)
     * ficam no config e são aplicados na exibição. A arte do Background Studio nunca é aplicada sobre ela (RF11).
     */
    @Transactional
    public Map<String, Object> uploadLookPhoto(CurrentUser user, byte[] bytes) {
        guard.requireCanCreate(user);
        ImageOps.requireAcceptedImage(bytes);
        BufferedImage img = ImageOps.decode(bytes);
        if (img.getWidth() < 400 || img.getHeight() < 400) {
            throw ApiException.badRequest("IMAGEM_PEQUENA", Msg.t("scheme.a_foto_do_look_precisa"));
        }
        double ratio = img.getWidth() / (double) img.getHeight();
        if (ratio > 2.0 || ratio < 0.5) {
            throw ApiException.badRequest("PROPORCAO_INVALIDA", Msg.t("scheme.use_uma_foto_com_proporcao"));
        }
        BufferedImage normalized = ImageOps.scaleToFit(img, 1600, 1600);
        byte[] jpeg = ImageOps.jpeg(normalized, 0.88f);
        User owner = users.findById(user.id()).orElseThrow();
        MediaStoragePort.StoredObject stored = media.put("users/" + user.id() + "/looks/photo-" + UUID.randomUUID() + ".jpg", jpeg, "image/jpeg");
        media.register(owner, PhotoOrigin.SCHEME, null, stored, null, null, bytes, normalized.getWidth(), normalized.getHeight(), null,
                ModerationStatus.APPROVED, Map.of("kind", "look_photo"));
        return Map.of("url", stored.url(), "width", normalized.getWidth(), "height", normalized.getHeight(), "pipeline", PHOTO_PIPELINE);
    }

    /** Aplica a foto do look vinda do config ({@code scheme.photo.url}); sem foto própria, a capa volta para a primeira peça. */
    void applyLookPhoto(CurrentUser user, Scheme s, Map<String, Object> background, List<SchemeItem> items) {
        if (background == null) {
            return;
        }
        Object inner = background.get("scheme") instanceof Map<?, ?> m ? m : background;
        if (!(inner instanceof Map<?, ?> scheme) || !scheme.containsKey("photo")) {
            return;
        }
        String url = scheme.get("photo") instanceof Map<?, ?> p && p.get("url") instanceof String u && !u.isBlank() ? u : null;
        if (url == null) {
            s.setCoverImageUrl(items.isEmpty() ? null : items.get(0).getWardrobeItem().getImageUrl());
            return;
        }
        if (!url.contains("/users/" + user.id() + "/looks/")) {
            throw ApiException.badRequest("FOTO_INVALIDA", Msg.t("scheme.envie_a_foto_do_look"));
        }
        s.setCoverImageUrl(url);
        media.linkSource(user.id(), url, s.getId());
    }

    private void publishInternal(Scheme s, List<SchemeItem> items) {
        s.setStatus(SchemeStatus.PUBLISHED);
        if (s.getPublishedAt() == null) {
            s.setPublishedAt(Instant.now());
        }
        s.setCommunityIndexed(s.getVisibility() == Visibility.PUBLIC);
        for (SchemeItem si : items) {
            // RF7.CA03 — snapshot da peça no momento da publicação.
            si.setSnapshotJson(Json.write(Views.snapshot(si.getWardrobeItem())));
        }
        projections.published(s);
    }

    @Transactional
    public Map<String, Object> publish(CurrentUser user, UUID id, Visibility visibility) {
        guard.requireCanCreate(user);
        Scheme s = owned(user, id);
        if (visibility != null) {
            s.setVisibility(visibility);
        }
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        if (items.isEmpty()) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("scheme.adicione_ao_menos_1_peca_2"));
        }
        publishInternal(s, items);
        projections.scheme(s, items);
        audit.log(user, AuditActions.PUBLICACAO_ESQUEMA, "scheme:" + id, Map.of("visibility", s.getVisibility().name()));
        return Map.of("scheme", view(user, s, items));
    }

    // ================================================================== leitura
    @Transactional
    public Map<String, Object> get(CurrentUser viewer, UUID id) {
        Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        requireView(viewer, s);
        boolean owner = viewer != null && viewer.id().equals(s.getUser().getId());
        if (!owner) {
            s.setViewCount(s.getViewCount() + 1);
            counters.increment("scheme", id, "views", 1);
            if (viewer != null) {
                events.publishEvent(new DomainEvents.HypeSignal(HypeSignalType.LOOK_VIEWED, HypeEntityType.SCHEME, id, viewer.id(), s.getUser().getId()));
            }
        }
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scheme", view(viewer, s, items));
        out.put("wearstyles", items.stream().collect(Collectors.toMap(si -> si.getWardrobeItem().getId().toString(),
                si -> Taxonomy.wearstylesOf(si.getWardrobeItem().getCategory(), Json.csv(si.getWardrobeItem().getOccasionTags())),
                (a, b) -> a, LinkedHashMap::new)));
        out.put("seals", sealsOf(s));
        out.put("sealBadges", seals.approvedBadges(s.getId()));
        out.put("remixedFrom", s.getOriginalScheme() == null ? null : Map.of("id", s.getOriginalScheme().getId(),
                "title", s.getOriginalScheme().getTitle(), "owner", Views.user(s.getOriginalScheme().getUser())));
        out.put("canEdit", owner);
        return out;
    }

    /** RF3.CA13 — a visibilidade do esquema prevalece sobre a do perfil quando for mais restritiva. */
    public void requireView(CurrentUser viewer, Scheme s) {
        Visibility effective = moreRestrictive(s.getVisibility(), s.getUser().getProfileVisibility());
        if (s.getStatus() == SchemeStatus.ARCHIVED && (viewer == null || !viewer.id().equals(s.getUser().getId()))) {
            throw ApiException.notFound(Msg.t("entity.esquema"));
        }
        guard.requireView(viewer, s.getUser().getId(), effective, "scheme:" + s.getId());
    }

    public boolean canView(CurrentUser viewer, Scheme s) {
        if (s.getStatus() == SchemeStatus.ARCHIVED && (viewer == null || !viewer.id().equals(s.getUser().getId()))) {
            return false;
        }
        return guard.canView(viewer, s.getUser().getId(), moreRestrictive(s.getVisibility(), s.getUser().getProfileVisibility()));
    }

    public static Visibility moreRestrictive(Visibility a, Visibility b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.ordinal() < b.ordinal() ? a : b;
    }

    private List<Object> sealsOf(Scheme s) {
        return new ArrayList<>(Json.strings(s.getSealIdsJson()));
    }

    public Views.SchemeView view(CurrentUser viewer, Scheme s, List<SchemeItem> items) {
        Views.ViewerState state = Views.ViewerState.NONE;
        if (viewer != null) {
            List<String> mine = reactions.findByActorIdAndTargetTypeAndTargetId(viewer.id(), TargetType.SCHEME, s.getId()).stream()
                    .map(r -> r.getReactionType().name()).toList();
            boolean isSaved = saved.findByUserIdAndTargetTypeAndTargetId(viewer.id(), TargetType.SCHEME, s.getId()).isPresent();
            state = new Views.ViewerState(mine.contains("LIKE"), mine.stream().filter(r -> !r.equals("LIKE")).toList(), isSaved,
                    viewer.id().equals(s.getUser().getId()), false);
        }
        return Views.scheme(s, items, state, wardrobe.reactionCounts(TargetType.SCHEME, s.getId()), seals.approvedBadges(s.getId()));
    }

    @Transactional(readOnly = true)
    public Views.Page<Views.SchemeView> mine(CurrentUser user, String occasion, String state, int page, int size) {
        return mine(user, occasion, state, null, null, null, page, size);
    }

    public Views.Page<Views.SchemeView> mine(CurrentUser user, String occasion, String state, String kind, int page, int size) {
        return mine(user, occasion, state, kind, null, null, page, size);
    }

    /**
     * Meus looks (domínio Looks e Lookbook). {@code state} restringe pelo estado (favoritos, disponível, indisponível,
     * publicados, rascunhos, arquivados) e {@code kind} pela origem (ia, manual, remix). Antes, publicados/rascunhos/
     * arquivados chegavam do frontend e eram ignorados; arquivados só aparecem quando pedidos.
     * <p>
     * RF53 (P1-07) — {@code sort}: recent (padrão), hype/hype_desc, hype_asc e growth (maior crescimento), do HypeScore
     * v2; {@code hypeLevel} é FILTRO (faixa mínima NICHE, RELEVANT, HOT, TRENDING, VIRAL), não aba. A lista é sempre do
     * próprio dono, então vale o Hype PESSOAL (look privado ou só para seguidores também tem score para quem o criou).
     * Look sem Hype (dados insuficientes ou ainda não calculado) vai para o fim, nunca vira 0.
     */
    @Transactional(readOnly = true)
    public Views.Page<Views.SchemeView> mine(CurrentUser user, String occasion, String state, String kind, String sort, String hypeLevel,
                                             int page, int size) {
        String st = state == null ? "" : state.trim().toLowerCase(Locale.ROOT);
        boolean archived = st.equals("arquivados") || st.equals("archived");
        List<Scheme> source = archived ? schemes.findByUserIdOrderByCreatedAtDesc(user.id())
                : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED);
        List<Scheme> all = source.stream()
                .filter(s -> occasion == null || occasion.isBlank() || Json.csv(s.getOccasion()).contains(occasion))
                .filter(s -> stateMatches(s, st))
                .filter(s -> kind == null || kind.isBlank() || kind.equalsIgnoreCase(kindOf(s)) || "todos".equalsIgnoreCase(kind))
                .toList();
        String order = lookSort(sort);
        Integer minimum = hypeMinimum(hypeLevel, hypeConfig == null ? null : hypeConfig.levelThresholds());
        if (LOOK_HYPE_SORTS.contains(order) || minimum != null) {
            all = byHype(all, order, minimum, currentHype(HypeEntityType.SCHEME, all.stream().map(Scheme::getId).toList()));
        }
        int sz = Math.max(1, Math.min(60, size <= 0 ? 20 : size));
        int from = Math.min(all.size(), Math.max(0, page) * sz);
        int to = Math.min(all.size(), from + sz);
        List<Views.SchemeView> items = all.subList(from, to).stream()
                .map(s -> view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList();
        return new Views.Page<>(items, page, sz, all.size(), to < all.size());
    }

    /** Ordenações de Meus looks que dependem do HypeScore v2 (as demais caem em "recent", a ordem do repositório). */
    static final Set<String> LOOK_HYPE_SORTS = Set.of("hype", "hype_desc", "hype_asc", "growth");

    /** Ordenação pedida pela tela; nomes em português e valores desconhecidos caem em "recent". */
    static String lookSort(String raw) {
        String s = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        return switch (s) {
            case "hype", "hype_desc", "maior_hype" -> "hype_desc";
            case "hype_asc", "menor_hype" -> "hype_asc";
            case "growth", "crescimento", "em_crescimento" -> "growth";
            default -> "recent";
        };
    }

    /**
     * Faixa mínima de Hype → score mínimo (limiares do HypeScoreConfig: NICHE, RELEVANT, HOT, TRENDING, VIRAL).
     * LOW_SIGNAL = "tem Hype calculado" (0); faixa vazia ou desconhecida = sem filtro (nulo).
     */
    static Integer hypeMinimum(String level, int[] thresholds) {
        if (level == null || level.isBlank() || thresholds == null || thresholds.length < 5) {
            return null;
        }
        return switch (level.trim().toUpperCase(Locale.ROOT)) {
            case "LOW_SIGNAL" -> 0;
            case "NICHE" -> thresholds[0];
            case "RELEVANT" -> thresholds[1];
            case "HOT" -> thresholds[2];
            case "TRENDING" -> thresholds[3];
            case "VIRAL" -> thresholds[4];
            default -> null;
        };
    }

    /**
     * Filtro e ordenação de Meus looks pelo HypeScore v2 (pura, testável). {@code minimum} usa o mesmo arredondamento
     * da faixa exibida ({@code min - 0,5}: 59,6 aparece como 60 e já é "Em alta"), igual ao guarda-roupa. Sem score =
     * fora do filtro e por último na ordenação (nunca 0); empate mantém a ordem recebida (mais recentes primeiro).
     */
    static List<Scheme> byHype(List<Scheme> list, String order, Integer minimum, Map<UUID, HypeScoreCurrent> hype) {
        java.util.function.Function<Scheme, BigDecimal> score = s -> hype.containsKey(s.getId()) ? hype.get(s.getId()).getScore() : null;
        List<Scheme> out = new ArrayList<>(list);
        if (minimum != null) {
            out.removeIf(s -> score.apply(s) == null || score.apply(s).doubleValue() < minimum - 0.5);
        }
        Comparator<Scheme> cmp = switch (order == null ? "" : order) {
            case "hype", "hype_desc" -> nullsLast(score, true);
            case "hype_asc" -> nullsLast(score, false);
            case "growth" -> nullsLast(s -> hype.containsKey(s.getId()) && hype.get(s.getId()).getScore() != null ? hype.get(s.getId()).getDeltaPoints() : null, true)
                    .thenComparing(nullsLast(s -> hype.containsKey(s.getId()) && hype.get(s.getId()).getDimensions() != null
                            ? hype.get(s.getId()).getDimensions().getTrend() : null, true));
            default -> null;
        };
        if (cmp != null) {
            out.sort(cmp);   // List.sort é estável: empates continuam do mais recente para o mais antigo
        }
        return out;
    }

    private static Comparator<Scheme> nullsLast(java.util.function.Function<Scheme, BigDecimal> key, boolean desc) {
        Comparator<BigDecimal> cmp = desc ? Comparator.<BigDecimal>reverseOrder() : Comparator.<BigDecimal>naturalOrder();
        return Comparator.comparing(key, Comparator.nullsLast(cmp));
    }

    /** Estado atual do HypeScore v2 (versão ativa) de várias entidades, numa consulta. */
    Map<UUID, HypeScoreCurrent> currentHype(HypeEntityType type, List<UUID> ids) {
        if (hypeScores == null || hypeConfig == null || ids == null || ids.isEmpty()) {
            return Map.of();
        }
        return hypeScores.findByEntityTypeAndEntityIdInAndAlgorithmVersion(type, ids, hypeConfig.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, h -> h, (a, b) -> a));
    }

    /** Faixa do estado gravado; sem ela (linha antiga), a mesma classificação do job a partir do score. */
    private HypeLevel levelOf(HypeScoreCurrent h) {
        return h.getLevel() != null || hypeConfig == null ? h.getLevel() : hypeConfig.level(h.getScore().doubleValue());
    }

    static boolean stateMatches(Scheme s, String state) {
        return switch (state == null ? "" : state) {
            case "", "todos", "all" -> true;
            case "favoritos", "favorites" -> s.isFavorite();
            case "disponivel", "available" -> s.isDisponivel();
            case "indisponivel", "unavailable" -> !s.isDisponivel();
            case "publicados", "published" -> s.getStatus() == SchemeStatus.PUBLISHED;
            case "rascunhos", "drafts" -> s.getStatus() == SchemeStatus.DRAFT;
            case "arquivados", "archived" -> s.getStatus() == SchemeStatus.ARCHIVED;
            default -> true;
        };
    }

    /** Origem do look para o domínio Looks: remix (derivado de outro), ia (Copilot, Autopiloto, espelho, IA no criador) ou manual. */
    public static String kindOf(Scheme s) {
        if (s.getOrigin() == SchemeOrigin.REMIX || s.getOriginalScheme() != null) {
            return "remix";
        }
        if (s.getCreationMode() == CreationMode.AI_ASSISTED || s.getOrigin() == SchemeOrigin.COPILOT
                || s.getOrigin() == SchemeOrigin.AUTOPILOTO || s.getOrigin() == SchemeOrigin.VISTA_ME
                || s.getOrigin() == SchemeOrigin.SMART_MIRROR) {
            return "ia";
        }
        return "manual";
    }

    // ================================================================== RF9 — edição
    @Transactional
    public Map<String, Object> update(CurrentUser user, UUID id, SchemeForm form) {
        guard.requireCanCreate(user);
        Scheme s = owned(user, id);
        Set<UUID> before = schemeItems.findBySchemeIdOrderBySortOrder(id).stream().map(si -> si.getWardrobeItem().getId())
                .collect(Collectors.toSet());
        applyForm(s, form);
        Visibility oldVisibility = s.getVisibility();
        if (form.visibility() != null) {
            s.setVisibility(form.visibility());
        }
        List<SchemeItem> items = form.items() == null ? schemeItems.findBySchemeIdOrderBySortOrder(id) : replaceItems(user, s, form.items());
        if (items.isEmpty()) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("scheme.o_esquema_precisa_de_ao"));
        }
        Set<UUID> after = items.stream().map(si -> si.getWardrobeItem().getId()).collect(Collectors.toSet());
        if (form.background() != null || Boolean.TRUE.equals(form.applyRecommendedDirection())) {
            studio.applyToScheme(s, form.background(), Boolean.TRUE.equals(form.applyRecommendedDirection()));
            applyLookPhoto(user, s, form.background(), items);
        }
        if (!before.equals(after) && s.getStatus() == SchemeStatus.PUBLISHED) {
            seals.flagRevalidation(s);
            for (SchemeItem si : items) {
                if (si.getSnapshotJson() == null) {
                    si.setSnapshotJson(Json.write(Views.snapshot(si.getWardrobeItem())));
                }
            }
        }
        if (s.getVisibility() == Visibility.PRIVATE && oldVisibility != Visibility.PRIVATE) {
            // RF20.CA14 — esquema tornado privado revoga os selos.
            seals.revokeForScheme(s.getId(), Msg.t("scheme.esquema_tornado_privado"));
        }
        if (Boolean.TRUE.equals(form.publish()) && s.getStatus() != SchemeStatus.PUBLISHED) {
            publishInternal(s, items);
        }
        projections.scheme(s, items);
        audit.log(user, AuditActions.EDICAO_ESQUEMA, "scheme:" + id, Map.of("itemsChanged", !before.equals(after)));
        if (!before.equals(after)) {
            events.publishEvent(new DomainEvents.SchemeSaved(user.id(), id, new ArrayList<>(after), s.getOrigin().name(), false));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scheme", view(user, s, items));
        out.put("revalidationPending", s.isRevalidationPending());
        return out;
    }

    /** RF9 / RF24.CA10 — "melhorar com IA": diff estruturado, aceito ou recusado item a item. */
    public Map<String, Object> improve(CurrentUser user, UUID id, String instruction) {
        guard.requireCanCreate(user);
        Scheme s = owned(user, id);
        Map<String, Object> current = new LinkedHashMap<>();
        current.put("title", s.getTitle());
        current.put("description", s.getDescription());
        current.put("occasion", Json.csv(s.getOccasion()));
        current.put("style", Json.csv(s.getStyle()));
        current.put("season", s.getSeason() == null ? null : s.getSeason().name());
        current.put("mood", s.getMood() == null ? null : s.getMood().name());
        current.put("visibility", s.getVisibility().name());
        String system = """
                Você é o Edit Assistant do Fashion AI. Proponha alterações ao esquema a partir da instrução do usuário.
                Campos editáveis: title, description, occasion (máx 3 códigos), style (máx 3 códigos), season
                (SPRING/SUMMER/AUTUMN/WINTER), mood (ENERGETIC/ELEGANT/COMFORTABLE/SOPHISTICATED), visibility
                (PRIVATE/FOLLOWERS/PUBLIC). Responda SOMENTE com JSON:
                {"changes":[{"field":string,"proposed":valor,"reason":"1 frase"}]}"""
                + "\nEscreva title, description e reason em " + Msg.languageName() + "; field, occasion, style, season, mood e visibility seguem os códigos acima.";
        AiOutcome<List<LocalAdvisors.FieldChange>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.EDIT_ASSISTANT,
                system, Msg.t("scheme.esquema_atual_instrucao", Json.write(current), InputSanitizer.clean(instruction, 500)),
                List.of(), 900, List.of(Msg.t("scheme.campos_atuais_do_esquema"), "instrução em linguagem natural"),
                text -> parseDiff(text, current), () -> LocalAdvisors.proposeEdit(current, instruction == null ? "" : instruction), null));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("changes", outcome.value());
        out.put("explanation", outcome.explanation());
        out.put("inferenceId", outcome.inferenceId());
        out.put("message", outcome.userMessage());
        return out;
    }

    List<LocalAdvisors.FieldChange> parseDiff(String text, Map<String, Object> current) {
        Map<String, Object> m = WardrobeService.extractJson(text);
        if (!(m.get("changes") instanceof List<?> list)) {
            return null;
        }
        List<LocalAdvisors.FieldChange> out = new ArrayList<>();
        for (Object o : list) {
            if (o instanceof Map<?, ?> c && c.get("field") != null && current.containsKey(String.valueOf(c.get("field")))) {
                String field = String.valueOf(c.get("field"));
                Object proposed = c.get("proposed");
                if (!validChange(field, proposed)) {
                    continue;
                }
                out.add(new LocalAdvisors.FieldChange(field, current.get(field), proposed, String.valueOf(c.get("reason"))));
            }
        }
        return out;
    }

    static boolean validChange(String field, Object v) {
        return switch (field) {
            case "occasion" -> v instanceof List<?> l && l.size() <= 3 && l.stream().allMatch(x -> Taxonomy.OCCASIONS.contains(String.valueOf(x)));
            case "style" -> v instanceof List<?> l && l.size() <= 3 && l.stream().allMatch(x -> Taxonomy.STYLES.contains(String.valueOf(x)));
            case "season" -> Set.of("SPRING", "SUMMER", "AUTUMN", "WINTER").contains(String.valueOf(v));
            case "mood" -> Set.of("ENERGETIC", "ELEGANT", "COMFORTABLE", "SOPHISTICATED").contains(String.valueOf(v));
            case "visibility" -> Set.of("PRIVATE", "FOLLOWERS", "PUBLIC").contains(String.valueOf(v));
            case "title", "description" -> v instanceof String s && !s.isBlank();
            default -> false;
        };
    }

    /** Aplica só os campos do diff que o usuário aceitou. */
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> applyDiff(CurrentUser user, UUID id, Map<String, Object> accepted) {
        guard.requireCanCreate(user);
        Scheme s = owned(user, id);
        for (Map.Entry<String, Object> e : accepted.entrySet()) {
            if (!validChange(e.getKey(), e.getValue())) {
                throw ApiException.badRequest("DIFF_INVALIDO", Msg.t("scheme.alteracao_invalida_para_o_campo", e.getKey()));
            }
            switch (e.getKey()) {
                case "title" -> s.setTitle(InputSanitizer.moderated("title", (String) e.getValue(), 120));
                case "description" -> s.setDescription(InputSanitizer.moderated("description", (String) e.getValue(), 1000));
                case "occasion" -> s.setOccasion(Json.csv(((List<Object>) e.getValue()).stream().map(String::valueOf).toList()));
                case "style" -> s.setStyle(Json.csv(((List<Object>) e.getValue()).stream().map(String::valueOf).toList()));
                case "season" -> s.setSeason(Season.valueOf(String.valueOf(e.getValue())));
                case "mood" -> s.setMood(Mood.valueOf(String.valueOf(e.getValue())));
                case "visibility" -> s.setVisibility(Visibility.valueOf(String.valueOf(e.getValue())));
                default -> {
                }
            }
        }
        audit.log(user, AuditActions.EDICAO_ESQUEMA, "scheme:" + id, Map.of("aiDiffFields", accepted.keySet()));
        return Map.of("scheme", view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(id)));
    }

    // ================================================================== RF31 · exclusão
    @Transactional
    public Map<String, Object> toggles(CurrentUser user, UUID id, Boolean favorite, Boolean disponivel) {
        guard.requireCanCreate(user);
        Scheme s = owned(user, id);
        if (favorite != null) {
            s.setFavorite(favorite);
        }
        if (disponivel != null) {
            s.setDisponivel(disponivel);
        }
        return Map.of("id", id, "favorite", s.isFavorite(), "disponivel", s.isDisponivel());
    }

    @Transactional
    public Map<String, Object> archive(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        Scheme s = owned(user, id);
        s.setStatus(SchemeStatus.ARCHIVED);
        seals.revokeForScheme(id, Msg.t("scheme.esquema_excluido_pelo_autor"));
        projections.removeScheme(id);
        // RF12.CA13: a foto do look sai de "Minhas Fotos" junto com ele (as antigas, sem vínculo, casam pela URL da capa)
        String cover = s.getCoverImageUrl() != null && s.getCoverImageUrl().contains("/users/" + user.id() + "/looks/") ? s.getCoverImageUrl() : null;
        int photosRemoved = media.retire(user.id(), id, Set.of(PhotoOrigin.SCHEME), cover == null ? List.of() : List.of(cover));
        audit.log(user, AuditActions.EDICAO_ESQUEMA, "scheme:" + id, Map.of("op", "archive", "photosRemoved", photosRemoved));
        return Map.of("id", id, "status", s.getStatus(), "photosRemoved", photosRemoved);
    }

    // ================================================================== RF19.CA13 — remixar
    @Transactional
    public Map<String, Object> remix(CurrentUser user, UUID sourceId) {
        guard.requireCanCreate(user);
        Scheme src = schemes.findById(sourceId).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        requireView(user, src);
        if (!src.isDisponivel()) {
            throw ApiException.conflict("INDISPONIVEL", Msg.t("scheme.o_autor_marcou_este_look"));
        }
        List<SchemeItem> srcItems = schemeItems.findBySchemeIdOrderBySortOrder(sourceId);
        List<WardrobeItem> mine = wardrobe.eligible(user.id());
        List<ItemForm> mapped = new ArrayList<>();
        List<Map<String, Object>> missing = new ArrayList<>();
        Set<UUID> used = new HashSet<>();
        for (SchemeItem si : srcItems) {
            WardrobeItem target = si.getWardrobeItem();
            WardrobeItem match = src.getUser().getId().equals(user.id()) ? target : mine.stream()
                    .filter(w -> !used.contains(w.getId()))
                    .max(Comparator.comparingDouble(w -> similarity(w, target))).filter(w -> similarity(w, target) >= 1.0).orElse(null);
            if (match != null) {
                used.add(match.getId());
                mapped.add(new ItemForm(match.getId(), si.getSlot(), si.getSortOrder(), si.getZIndex(), si.getPositionX(),
                        si.getPositionY(), si.getScale(), si.getRotation(), si.getOpacity(), Json.map(si.getFiltersJson())));
            } else {
                missing.add(Map.of("sourcePiece", Views.row(si), "action", Msg.t("scheme.adicionar_ao_guarda_roupa_ou")));
            }
        }
        Map<String, Object> prefill = new LinkedHashMap<>();
        prefill.put("title", Msg.t("scheme.remix_de", src.getTitle()));
        prefill.put("description", src.getDescription());
        prefill.put("occasion", Json.csv(src.getOccasion()));
        prefill.put("style", Json.csv(src.getStyle()));
        prefill.put("season", src.getSeason());
        prefill.put("mood", src.getMood());
        prefill.put("items", mapped);
        prefill.put("background", Json.map(src.getStudioConfigJson()));
        prefill.put("cardSkin", src.getCardSkin());
        prefill.put("remixedFromId", src.getId());
        prefill.put("origin", SchemeOrigin.REMIX);
        return Map.of("prefill", prefill, "missingPieces", missing, "source", Map.of("id", src.getId(), "title", src.getTitle(),
                "owner", Views.user(src.getUser())), "next", "/create-look?remix=" + src.getId());
    }

    private static double similarity(WardrobeItem a, WardrobeItem b) {
        double s = 0;
        if (Objects.equals(a.getSubcategory(), b.getSubcategory())) {
            s += 1;
        } else if (Objects.equals(a.getCategory(), b.getCategory())) {
            s += 0.5;
        }
        if (Objects.equals(a.getColor(), b.getColor())) {
            s += 0.5;
        } else if (Objects.equals(Taxonomy.COLOR_FAMILY.get(a.getColor()), Taxonomy.COLOR_FAMILY.get(b.getColor()))) {
            s += 0.25;
        }
        return s;
    }

    // ================================================================== render do card (RF5 preview / RF19.CA09)
    @Transactional(readOnly = true)
    public byte[] renderCard(CurrentUser viewer, UUID id, boolean expanded) {
        Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        requireView(viewer, s);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        boolean owner = viewer != null && viewer.id().equals(s.getUser().getId());
        return renderer.render(card(s, items, expanded, cardHypeLabel(currentHype(HypeEntityType.SCHEME, List.of(id)).get(id), owner)));
    }

    /**
     * RF53 (P2-15) — rótulo do Hype no PNG do card: HypeScore v2 do look + faixa em texto ("HypeScore 72 · Em alta").
     * Sem dados (insuficiente ou não calculado) o rótulo é omitido, nunca "0". Para terceiros só aparece o Hype
     * público ({@code publicEligible}); o dono vê o próprio Hype pessoal (look privado ou só para seguidores).
     */
    String cardHypeLabel(HypeScoreCurrent h, boolean owner) {
        return cardHypeLabel(h == null ? null : h.getScore(), h == null || h.getScore() == null ? null : levelOf(h),
                h != null && (owner || h.isPublicEligible()));
    }

    static String cardHypeLabel(BigDecimal score, HypeLevel level, boolean visible) {
        if (!visible || score == null || level == null) {
            return null;
        }
        return Msg.t("schemeHype.card", score.setScale(0, java.math.RoundingMode.HALF_UP), Msg.t("schemeHype.level." + level.name()));
    }

    /** Card sem Hype (prévia da etapa 5: o look ainda não existe, então não tem sinais próprios). */
    SchemeCardRenderer.Card card(Scheme s, List<SchemeItem> items, boolean expanded) {
        return card(s, items, expanded, null);
    }

    SchemeCardRenderer.Card card(Scheme s, List<SchemeItem> items, boolean expanded, String hypeLabel) {
        List<SchemeCardRenderer.CardItem> cardItems = new ArrayList<>();
        Map<String, Object> studioCfg = Json.map(s.getStudioConfigJson());
        Map<?, ?> pieceBgs = studioCfg.get("pieces") instanceof Map<?, ?> p ? p : Map.of();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            BufferedImage img = media.readImage(w.getImageUrl()).orElseGet(() -> placeholder(w));
            Object bgCfg = pieceBgs.get(w.getId().toString());
            String pieceBg = bgCfg instanceof Map<?, ?> m && m.get("color") != null ? String.valueOf(m.get("color")) : null;
            cardItems.add(new SchemeCardRenderer.CardItem(img, si.getSlot(),
                    si.getPositionX() == null ? null : si.getPositionX().doubleValue(),
                    si.getPositionY() == null ? null : si.getPositionY().doubleValue(),
                    si.getScale() == null ? 1 : si.getScale().doubleValue(), si.getRotation() == null ? 0 : si.getRotation().doubleValue(),
                    si.getOpacity() == null ? 1 : si.getOpacity().doubleValue(), si.getZIndex(),
                    ImageFilters.Filters.of(Json.map(si.getFiltersJson())), pieceBg));
        }
        List<String> chips = new ArrayList<>(Json.csv(s.getOccasion()));
        chips.addAll(Json.csv(s.getStyle()));
        // Preços são em reais: o PNG usa a mesma moeda das telas, formatada no idioma de quem pediu a imagem.
        java.text.NumberFormat brl = java.text.NumberFormat.getCurrencyInstance(Msg.locale());
        brl.setCurrency(java.util.Currency.getInstance("BRL"));
        String price = s.getTotalPrice() == null ? null : brl.format(s.getTotalPrice());
        // o Hype do PNG é o v2 do look (cardHypeLabel); a coluna v1 schemes.hype_score não entra mais na imagem
        return new SchemeCardRenderer.Card(s.getTitle(), s.getUser().getUsername(), chips, price, hypeLabel, studio.rendererBackground(s),
                cardItems, expanded ? SchemeCardRenderer.Size.EXPANDED : SchemeCardRenderer.Size.COMPACT);
    }

    /** Peça sem foto legível (ex.: imagem padrão SVG): bloco com a cor da peça e a subcategoria. */
    static BufferedImage placeholder(WardrobeItem w) {
        BufferedImage img = new BufferedImage(420, 420, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        ImageOps.quality(g);
        g.setColor(new Color(ColorMath.parseHex(Taxonomy.hex(w.getColor()))));
        g.fill(new RoundRectangle2D.Double(10, 10, 400, 400, 60, 60));
        g.setColor(ColorMath.isNeutral(w.getColor()) && Taxonomy.hex(w.getColor()).compareTo("#888888") > 0 ? Color.DARK_GRAY : Color.WHITE);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 34));
        // Nome da peça (escrito pelo usuário) em vez do código da subcategoria, que é em inglês.
        String label = w.getName() != null && !w.getName().isBlank() ? (w.getName().length() > 22 ? w.getName().substring(0, 21) + "…" : w.getName())
                : WardrobeService.humanize(w.getSubcategory() == null ? Msg.t("scheme.peca_2") : w.getSubcategory());
        g.drawString(Msg.resolve(label), 210 - g.getFontMetrics().stringWidth(label) / 2, 220);
        g.dispose();
        return img;
    }

    /** Preview da etapa 5 antes de salvar (nada é persistido). */
    @Transactional(readOnly = true)
    public byte[] preview(CurrentUser user, SchemeForm form) {
        Scheme s = new Scheme();
        s.setUser(users.findById(user.id()).orElseThrow());
        s.setTitle(form.title() == null ? Msg.t("scheme.pre_visualizacao") : form.title());
        s.setOccasion(Json.csv(form.occasion()));
        s.setStyle(Json.csv(form.style()));
        studio.applyToScheme(s, form.background(), Boolean.TRUE.equals(form.applyRecommendedDirection()));
        if (form.cardSkin() != null) {
            s.setCardSkin(form.cardSkin());
        }
        List<SchemeItem> items = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (ItemForm f : form.items() == null ? List.<ItemForm>of() : form.items()) {
            WardrobeItem w = pieces.findById(f.wardrobeItemId()).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            guard.requireOwner(user, w.getUser().getId(), "piece:" + w.getId());
            SchemeItem si = new SchemeItem();
            si.setWardrobeItem(w);
            si.setSlot(f.slot() != null ? f.slot() : LocalSchemeComposer.slotOf(w));
            si.setPositionX(f.positionX());
            si.setPositionY(f.positionY());
            si.setScale(f.scale() == null ? BigDecimal.ONE : f.scale());
            si.setRotation(f.rotation() == null ? BigDecimal.ZERO : f.rotation());
            si.setOpacity(f.opacity() == null ? BigDecimal.ONE : f.opacity());
            si.setZIndex(f.zIndex() == null ? items.size() : f.zIndex());
            si.setFiltersJson(f.filters() == null ? null : Json.write(f.filters()));
            items.add(si);
            total = total.add(w.getPrice() == null ? BigDecimal.ZERO : w.getPrice());
        }
        s.setTotalPrice(total);
        return renderer.render(card(s, items, false));
    }

    // ================================================================== RF15 · composição do look (camadas)

    /**
     * RF15 · Composição do look por camadas: posição (centro, 0–1 do container), escala, rotação, opacidade e ordem
     * (zIndex) de cada peça já no look — os mesmos campos que o card usa. Só o dono edita; nada de cor, filtro ou
     * reconstrução aqui: a peça entra com a sua foto canônica (as edições do RF15 da peça acompanham). Peças fora do
     * look são ignoradas; nenhuma é adicionada ou removida por este caminho (isso é o editor do look, RF9).
     */
    @Transactional
    public Views.SchemeView updateLayout(CurrentUser user, UUID id, List<ItemForm> layout) {
        Scheme s = owned(user, id);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        applyLayout(items, layout, true);
        for (SchemeItem si : items) {
            schemeItems.save(si);
        }
        projections.scheme(s, items);
        audit.log(user, AuditActions.EDICAO_ESQUEMA, "scheme:" + id, Map.of("layout", true));
        return view(user, s, items);
    }

    /** Prévia (PNG do card ampliado) da composição com o layout dado, sem gravar — o mesmo render do card. */
    @Transactional(readOnly = true)
    public byte[] layoutPreview(CurrentUser user, UUID id, List<ItemForm> layout) {
        Scheme s = owned(user, id);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        applyLayout(items, layout, false);
        return renderer.render(card(s, items, true));
    }

    /** Aplica o layout por peça; {@code strict} recusa valores fora da faixa (gravação), a prévia só os prende. */
    static void applyLayout(List<SchemeItem> items, List<ItemForm> layout, boolean strict) {
        if (layout == null) {
            return;
        }
        for (ItemForm f : layout) {
            if (f.wardrobeItemId() == null) {
                continue;
            }
            SchemeItem si = items.stream().filter(i -> f.wardrobeItemId().equals(i.getWardrobeItem().getId())).findFirst().orElse(null);
            if (si == null) {
                continue;
            }
            if (strict && (outside(f.positionX(), 0, 1) || outside(f.positionY(), 0, 1) || outside(f.scale(), 0.2, 3)
                    || outside(f.rotation(), -180, 180) || outside(f.opacity(), 0.05, 1))) {
                throw ApiException.badRequest("LAYOUT_FORA_DA_FAIXA", Msg.t("scheme.layout_fora_da_faixa"));
            }
            si.setPositionX(f.positionX() == null ? null : clamp(f.positionX(), 0, 1));
            si.setPositionY(f.positionY() == null ? null : clamp(f.positionY(), 0, 1));
            si.setScale(f.scale() == null ? BigDecimal.ONE : clamp(f.scale(), 0.2, 3));
            si.setRotation(f.rotation() == null ? BigDecimal.ZERO : clamp(f.rotation(), -180, 180));
            si.setOpacity(f.opacity() == null ? BigDecimal.ONE : clamp(f.opacity(), 0.05, 1));
            if (f.zIndex() != null) {
                si.setZIndex(f.zIndex());
            }
            if (f.sortOrder() != null) {
                si.setSortOrder(f.sortOrder());
            }
        }
    }

    private static boolean outside(BigDecimal v, double min, double max) {
        return v != null && (v.doubleValue() < min - 1e-9 || v.doubleValue() > max + 1e-9);
    }

    private static BigDecimal clamp(BigDecimal v, double min, double max) {
        return BigDecimal.valueOf(Math.max(min, Math.min(max, v.doubleValue()))).setScale(4, java.math.RoundingMode.HALF_UP);
    }

    public Scheme owned(CurrentUser user, UUID id) {
        Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        guard.requireOwner(user, s.getUser().getId(), "scheme:" + id);
        return s;
    }
}
