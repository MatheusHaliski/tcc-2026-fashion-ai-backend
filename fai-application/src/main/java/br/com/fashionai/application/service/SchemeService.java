package br.com.fashionai.application.service;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.fashionai.application.ai.*;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.dna.CompositionContext;
import br.com.fashionai.application.dna.SchemeRemixPrototype;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.imaging.*;
import br.com.fashionai.application.ports.CounterStorePort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;

/**
 * RF5 (Criar Look em 5 etapas: 1 modo · 2 prompt IA · 3 formulário · 4 arte · 5 preview/slots/salvar — etapas
 * 2 e 3 coexistem e só o salvar da etapa 5 persiste), RF9 (edição + "melhorar com IA" por diff), RF31 (toggles),
 * RF19.CA13 remixar e a renderização do card (preview e exportação).
 */
@Service
public class SchemeService {
    @org.springframework.beans.factory.annotation.Autowired
    private LookTypePreferencesService lookTypePreferences;
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
    private final SchemeCardAssembler cards;
    /** Coleção e intensidade térmica do look (FKs em schemes). Opcional nos testes que montam o serviço sem Spring. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private ClassificationService classification;
    /** Nível térmico do look (FK em schemes). Opcional nos testes que montam o serviço sem Spring. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private SchemeThermalWriter thermal;

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
        this.cards = new SchemeCardAssembler(media, studio);
    }

    // ================================================================== etapa 1/3 — compositor
    /** RF5.CA01/CA02/CA07b — listas por parte do corpo espelhando o guarda-roupa real (só disponíveis). */
    @Transactional(readOnly = true)
    public Map<String, Object> builder(CurrentUser user) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        return SchemeBuilderView.of(eligible, pieces.countByUserId(user.id()), users.findById(user.id()).orElseThrow());
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
            HypeScoreCurrent h = hype.get(w.getId());
            catalog.add(SchemeComposePrompt.entry(ref, w, h, h == null || h.getScore() == null ? null : levelOf(h)));
        }
        List<AiRequest.AiImage> photos = new ArrayList<>();
        List<String> photoRefs = new ArrayList<>();
        for (Map.Entry<String, WardrobeItem> e : byRef.entrySet()) {
            if (photos.size() >= SchemeComposePrompt.MAX_PHOTOS) {
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
        dna.findByUserId(user.id()).ifPresent(d -> profile.put("styleDna", CompositionContext.dnaContext(d)));
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
                SchemeComposePrompt.system(), prompt, photos, 1800, inputs,
                text -> SchemeComposePrompt.parse(text, byRef, req, exclude),
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
                             List<String> seals, Boolean publish, Boolean lookDoDia, UUID colecaoId,
                             UUID intensidadeTermicaId, UUID nivelTermicoId, Boolean clearNivelTermico) {
        /** Compatibilidade: quem monta o look por código (provador, espelho, autopiloto) não escolhe coleção, intensidade nem nível térmico. */
        public SchemeForm(String title, String description, List<String> occasion, List<String> style, Season season,
                          Mood mood, Visibility visibility, DisplayMode displayMode, List<ItemForm> items,
                          CreationMode creationMode, SchemeOrigin origin, UUID remixedFromId, Map<String, Object> background,
                          Boolean applyRecommendedDirection, String cardSkin, String layoutAnatomy, List<String> tags,
                          List<String> seals, Boolean publish, Boolean lookDoDia) {
            this(title, description, occasion, style, season, mood, visibility, displayMode, items, creationMode, origin,
                    remixedFromId, background, applyRecommendedDirection, cardSkin, layoutAnatomy, tags, seals, publish,
                    lookDoDia, null, null, null, null);
        }
    }

    @Transactional
    public Map<String, Object> create(CurrentUser user, SchemeForm form) {
        guard.requireCanCreate(user);
        User owner = users.findById(user.id()).orElseThrow();
        if (form.items() == null || form.items().isEmpty()) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("scheme.adicione_ao_menos_1_peca"));
        }
        Scheme s = CreationLookDefaults.scheme(owner, form, lookTypePreferences);
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
        studio.requireAuraAccess(user, form.background());
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
        if (classification != null) {
            classification.apply(s, f.colecaoId(), f.intensidadeTermicaId());
        }
        if (thermal != null) {
            thermal.apply(s, f.nivelTermicoId(), Boolean.TRUE.equals(f.clearNivelTermico()));
        }
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
            SchemeLayout.place(si, f, order);
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

    /**
     * RF5 — a foto do conjunto é enviada pelo usuário, como a foto de um post. Passa pelo pipeline (validação, redimensionamento,
     * reencode sem metadados, registro na moderação); os filtros escolhidos (brilho, contraste, saturação, matiz, desfoque)
     * ficam no config e são aplicados na exibição. A arte do Background Studio nunca é aplicada sobre ela (RF11).
     */
    @Transactional
    public Map<String, Object> uploadLookPhoto(CurrentUser user, byte[] bytes) {
        guard.requireCanCreate(user);
        BufferedImage normalized = SchemeLookPhoto.normalized(bytes);
        byte[] jpeg = ImageOps.jpeg(normalized, 0.88f);
        User owner = users.findById(user.id()).orElseThrow();
        MediaStoragePort.StoredObject stored = media.put("users/" + user.id() + "/looks/photo-" + UUID.randomUUID() + ".jpg", jpeg, "image/jpeg");
        media.register(owner, PhotoOrigin.SCHEME, null, stored, null, null, bytes, normalized.getWidth(), normalized.getHeight(), null,
                ModerationStatus.APPROVED, Map.of("kind", "look_photo"));
        return Map.of("url", stored.url(), "width", normalized.getWidth(), "height", normalized.getHeight(), "pipeline", SchemeLookPhoto.PIPELINE);
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
        if (onlyForOwner(viewer, s)) {
            throw ApiException.notFound(Msg.t("entity.esquema"));
        }
        guard.requireView(viewer, s.getUser().getId(), effective, "scheme:" + s.getId());
    }

    public boolean canView(CurrentUser viewer, Scheme s) {
        if (onlyForOwner(viewer, s)) {
            return false;
        }
        return guard.canView(viewer, s.getUser().getId(), moreRestrictive(s.getVisibility(), s.getUser().getProfileVisibility()));
    }

    /**
     * Rascunho e arquivado são só do dono, qualquer que seja a visibilidade marcada: sem isso, um rascunho "público"
     * abria pelo link direto e aparecia na busca antes de ser publicado. Quem não é o dono recebe "não encontrado".
     */
    private static boolean onlyForOwner(CurrentUser viewer, Scheme s) {
        return s.getStatus() != SchemeStatus.PUBLISHED && (viewer == null || !viewer.id().equals(s.getUser().getId()));
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
                .filter(s -> SchemeListing.stateMatches(s, st))
                .filter(s -> kind == null || kind.isBlank() || kind.equalsIgnoreCase(SchemeListing.kindOf(s)) || "todos".equalsIgnoreCase(kind))
                .toList();
        String order = SchemeListing.lookSort(sort);
        Integer minimum = SchemeListing.hypeMinimum(hypeLevel, hypeConfig == null ? null : hypeConfig.levelThresholds());
        if (SchemeListing.LOOK_HYPE_SORTS.contains(order) || minimum != null) {
            all = SchemeListing.byHype(all, order, minimum, currentHype(HypeEntityType.SCHEME, all.stream().map(Scheme::getId).toList()));
        }
        int sz = Math.max(1, Math.min(60, size <= 0 ? 20 : size));
        int from = Math.min(all.size(), Math.max(0, page) * sz);
        int to = Math.min(all.size(), from + sz);
        List<Views.SchemeView> items = all.subList(from, to).stream()
                .map(s -> view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList();
        return new Views.Page<>(items, page, sz, all.size(), to < all.size());
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
            studio.requireAuraAccess(user, form.background());
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
        Map<String, Object> current = SchemeEditDiff.current(s);
        AiOutcome<List<LocalAdvisors.FieldChange>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.EDIT_ASSISTANT,
                SchemeEditDiff.system(), Msg.t("scheme.esquema_atual_instrucao", Json.write(current), InputSanitizer.clean(instruction, 500)),
                List.of(), 900, List.of(Msg.t("scheme.campos_atuais_do_esquema"), "instrução em linguagem natural"),
                text -> SchemeEditDiff.parse(text, current), () -> LocalAdvisors.proposeEdit(current, instruction == null ? "" : instruction), null));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("changes", outcome.value());
        out.put("explanation", outcome.explanation());
        out.put("inferenceId", outcome.inferenceId());
        out.put("message", outcome.userMessage());
        return out;
    }

    /** Aplica só os campos do diff que o usuário aceitou. */
    @Transactional
    public Map<String, Object> applyDiff(CurrentUser user, UUID id, Map<String, Object> accepted) {
        guard.requireCanCreate(user);
        Scheme s = owned(user, id);
        for (Map.Entry<String, Object> e : accepted.entrySet()) {
            if (!SchemeEditDiff.validChange(e.getKey(), e.getValue())) {
                throw ApiException.badRequest("DIFF_INVALIDO", Msg.t("scheme.alteracao_invalida_para_o_campo", e.getKey()));
            }
            SchemeEditDiff.apply(s, e.getKey(), e.getValue());
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
        SchemeRemixPrototype.PieceMapping mapping = SchemeRemixPrototype.mapPieces(srcItems, mine, src.getUser().getId().equals(user.id()));
        Map<String, Object> prefill = SchemeRemixPrototype.prefill(src, mapping.items());
        List<Map<String, Object>> missing = mapping.missing();
        return Map.of("prefill", prefill, "missingPieces", missing, "source", Map.of("id", src.getId(), "title", src.getTitle(),
                "owner", Views.user(src.getUser())), "next", "/create-look?remix=" + src.getId());
    }

    // ================================================================== render do card (RF5 preview / RF19.CA09)
    @Transactional(readOnly = true)
    public byte[] renderCard(CurrentUser viewer, UUID id, boolean expanded) {
        Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        requireView(viewer, s);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        boolean owner = viewer != null && viewer.id().equals(s.getUser().getId());
        return renderer.render(cards.card(s, items, expanded, cardHypeLabel(currentHype(HypeEntityType.SCHEME, List.of(id)).get(id), owner)));
    }

    /**
     * RF53 (P2-15) — rótulo do Hype no PNG do card: HypeScore v2 do look + faixa em texto ("HypeScore 72 · Em alta").
     * Sem dados (insuficiente ou não calculado) o rótulo é omitido, nunca "0". Para terceiros só aparece o Hype
     * público ({@code publicEligible}); o dono vê o próprio Hype pessoal (look privado ou só para seguidores).
     */
    String cardHypeLabel(HypeScoreCurrent h, boolean owner) {
        return SchemeCardAssembler.hypeLabel(h == null ? null : h.getScore(), h == null || h.getScore() == null ? null : levelOf(h),
                h != null && (owner || h.isPublicEligible()));
    }



    /** Preview da etapa 5 antes de salvar (nada é persistido). */
    @Transactional(readOnly = true)
    public byte[] preview(CurrentUser user, SchemeForm form) {
        Scheme s = new Scheme();
        s.setUser(users.findById(user.id()).orElseThrow());
        s.setTitle(form.title() == null ? Msg.t("scheme.pre_visualizacao") : form.title());
        s.setOccasion(Json.csv(form.occasion()));
        s.setStyle(Json.csv(form.style()));
        studio.requireAuraAccess(user, form.background());
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
            SchemeLayout.place(si, f, items.size());
            items.add(si);
            total = total.add(w.getPrice() == null ? BigDecimal.ZERO : w.getPrice());
        }
        s.setTotalPrice(total);
        return renderer.render(cards.card(s, items, false, null));
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
        SchemeLayout.apply(items, layout, true);
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
        SchemeLayout.apply(items, layout, false);
        return renderer.render(cards.card(s, items, true, null));
    }


    public Scheme owned(CurrentUser user, UUID id) {
        Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        guard.requireOwner(user, s.getUser().getId(), "scheme:" + id);
        return s;
    }
}
