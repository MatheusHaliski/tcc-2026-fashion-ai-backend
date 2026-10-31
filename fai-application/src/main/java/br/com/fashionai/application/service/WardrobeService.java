package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.assets.PieceReferenceCatalog;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.imaging.PhotoAcceptance;
import br.com.fashionai.application.ports.JobQueuePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ItemCondition;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.model.enums.ReactionType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.ModerationQueueRepository;
import br.com.fashionai.domain.repository.PhotoRepository;
import br.com.fashionai.domain.repository.PipelineJobRepository;
import br.com.fashionai.domain.repository.ProcessingJobLogRepository;
import br.com.fashionai.domain.repository.QualityScoreRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import br.com.fashionai.application.events.DomainEvents;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
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
 * RF4 (adicionar peça por foto + formulário, com IA e pipeline Flat Lay), RF6 Closet Digital, RF7 detalhe,
 * RF9.CA07 edição de peça, RF31 toggles de estado, RF15.CA02 imagem editada, RF18.CA05 remoção de fundo
 * sob demanda e RF16 (3D, atrás de feature flag).
 */
@Service
public class WardrobeService {
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final BrandRepository brands;
    private final PipelineJobRepository jobs;
    private final ProcessingJobLogRepository processingLogs;
    private final QualityScoreRepository qualityScores;
    private final ModerationQueueRepository moderationQueue;
    private final SchemeItemRepository schemeItems;
    private final SchemeRepository schemes;
    private final ReactionRepository reactions;
    private final SavedItemRepository saved;
    private final PhotoRepository photos;
    private final FlatLayPipeline flatLay;
    private final br.com.fashionai.application.imaging.StudioPipeline studio;
    private final AiEngine ai;
    private final MediaService media;
    private final AssetCatalogService assets;
    private final ProjectionService projections;
    private final NotificationService notifications;
    private final JobQueuePort queue;
    private final Model3dService model3d;
    private final Guard guard;
    private final Audit audit;
    private final ApplicationEventPublisher events;
    /** HypeScore v2 — estado atual (ordenações e filtro por faixa de Hype do closet) */
    private final br.com.fashionai.domain.repository.HypeScoreCurrentRepository hypeScores;
    private final br.com.fashionai.application.hype.HypeScoreConfig hypeConfig;
    private final BrandLogoService brandLogos;
    private final br.com.fashionai.domain.repository.BrandProfileRepository brandProfiles;
    private final PieceReferenceCatalog pieceReferences;
    private final OwnMedia ownMedia;
    /** OCR local da marca (RF4): lê o logo quando a IA de visão não leu (ou está fora do ar). Opcional nos testes. */
    private br.com.fashionai.application.imaging.BrandReader brandReader;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setBrandReader(br.com.fashionai.application.imaging.BrandReader brandReader) {
        this.brandReader = brandReader;
    }

    /** RF53 — vínculos de selo (filtro "com selo de marca/celebridade" do closet). Opcional nos testes. */
    private br.com.fashionai.domain.repository.SealBondRepository sealBonds;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setSealBonds(br.com.fashionai.domain.repository.SealBondRepository sealBonds) {
        this.sealBonds = sealBonds;
    }

    public WardrobeService(WardrobeItemRepository pieces, UserRepository users, BrandRepository brands,
                           PipelineJobRepository jobs, ProcessingJobLogRepository processingLogs,
                           QualityScoreRepository qualityScores, ModerationQueueRepository moderationQueue,
                           SchemeItemRepository schemeItems, SchemeRepository schemes, ReactionRepository reactions,
                           SavedItemRepository saved, PhotoRepository photos, FlatLayPipeline flatLay, AiEngine ai,
                           MediaService media, AssetCatalogService assets, ProjectionService projections,
                           NotificationService notifications, JobQueuePort queue,
                           Model3dService model3d, br.com.fashionai.application.imaging.StudioPipeline studio, Guard guard, Audit audit,
                           ApplicationEventPublisher events, BrandLogoService brandLogos,
                           br.com.fashionai.domain.repository.BrandProfileRepository brandProfiles,
                           PieceReferenceCatalog pieceReferences, OwnMedia ownMedia,
                           br.com.fashionai.domain.repository.HypeScoreCurrentRepository hypeScores,
                           br.com.fashionai.application.hype.HypeScoreConfig hypeConfig) {
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
        this.pieces = pieces;
        this.users = users;
        this.brands = brands;
        this.jobs = jobs;
        this.processingLogs = processingLogs;
        this.qualityScores = qualityScores;
        this.moderationQueue = moderationQueue;
        this.schemeItems = schemeItems;
        this.schemes = schemes;
        this.reactions = reactions;
        this.saved = saved;
        this.photos = photos;
        this.flatLay = flatLay;
        this.studio = studio;
        this.ai = ai;
        this.media = media;
        this.assets = assets;
        this.projections = projections;
        this.notifications = notifications;
        this.queue = queue;
        this.model3d = model3d;
        this.guard = guard;
        this.audit = audit;
        this.events = events;
        this.brandLogos = brandLogos;
        this.brandProfiles = brandProfiles;
        this.pieceReferences = pieceReferences;
        this.ownMedia = ownMedia;
    }

    private PieceConservationService conservation;

    @org.springframework.beans.factory.annotation.Autowired
    void setConservation(PieceConservationService conservation) {
        this.conservation = conservation;
    }

    // ------------------------------------------------------------------ colaboradores (Facade)
    // Objetos sem estado, criados a cada chamada com as dependências deste serviço: leem os campos no momento da chamada
    // e não são beans. Transação, autorização, posse e auditoria continuam nos métodos públicos daqui.
    private PieceFormWriter formWriter() {
        return new PieceFormWriter(conservation, brands, brandProfiles, ownMedia, media, brandLogos);
    }

    private DraftPieceImport draftImport() {
        return new DraftPieceImport(pieces, jobs, qualityScores, processingLogs, moderationQueue, media, queue);
    }

    private ClosetHype closetHype() {
        return new ClosetHype(hypeScores, hypeConfig);
    }

    private StudioShots shots() {
        return new StudioShots(ai, studio, media);
    }

    private StudioVersionFlow versions() {
        return new StudioVersionFlow(media);
    }

    private WardrobeStudio studios() {
        return new WardrobeStudio(pieces, assets, media, shots(), versions());
    }

    private PieceImageEdits imageEdits() {
        return new PieceImageEdits(media, shots(), versions(), studios());
    }

    // ================================================================== RF4 — análise da foto (rascunho)
    /**
     * @param subcategoryCandidates subtipos mais parecidos com a foto ({code, score}), do mais parecido para o menos
     * @param brandSearch           onde a marca foi procurada (zonas), onde foi achada, por quem (ia/local) e a evidência
     * @param photoChecks           critérios de aceite da foto, todos aprovados (id, medida, limite)
     */
    public record Prefill(String name, String category, String subcategory, String color, String material, String brand,
                          String sex, List<String> occasion, List<String> style, List<String> seals,
                          Map<String, Double> confidence, double overall, boolean manualFillRequired, String warning,
                          Map<String, Object> logo, String size, BigDecimal price,
                          List<Map<String, Object>> subcategoryCandidates, Map<String, Object> brandSearch,
                          List<Map<String, Object>> photoChecks, String variation, Double variationConfidence,
                          Map<String, List<String>> attributes) {
    }

    /** @param rejection só na análise em lote: a foto recusada pelos critérios (as demais seguem) */
    public record Draft(UUID draftId, String processedUrl, String flatLayUrl, String thumbnailUrl, String originalUrl,
                        Prefill prefill, Map<String, Object> quality, Map<String, Object> moderation,
                        List<FlatLayPipeline.Stage> stages, BigDecimal costUsd, long totalMs, boolean backgroundRemoved,
                        boolean reprocessPending, AiOutcome.Explanation explanation, String aiMessage,
                        AiOutcome.Quota quota, Map<String, Object> studio, String backgroundWarning,
                        Map<String, Object> rejection) {
        static Draft rejected(ApiException e) {
            Map<String, Object> r = new LinkedHashMap<>(e.details() == null ? Map.of() : e.details());
            r.put("code", e.code());
            r.put("message", e.getMessage());
            return new Draft(null, null, null, null, null, null, null, null, List.of(), BigDecimal.ZERO, 0, false, false, null,
                    e.getMessage(), null, null, null, r);
        }
    }

    public Draft analyze(CurrentUser user, byte[] bytes) {
        return analyze(user, bytes, null);
    }

    /**
     * RF4.CA01–CA03/CA06: valida, padroniza (Flat Lay), aplica os critérios de aceite da foto, detecta o subtipo dentro
     * do tipo escolhido pela pessoa, procura a marca nas zonas da peça, modera e pré-preenche; nada vai ao acervo ainda.
     * Foto fora dos critérios → 422 FOTO_RECUSADA (o registro da inferência e a cota consumida ficam gravados).
     *
     * @param category tipo escolhido pela pessoa (upper_piece, lower_piece…); null = descobrir pela foto
     */
    @Transactional(noRollbackFor = PhotoRejectedException.class)
    public Draft analyze(CurrentUser user, byte[] bytes, String category) {
        return analyzeInternal(user, bytes, category, false).draft();
    }

    /**
     * RF4 · Captura adaptativa: a mesma análise, devolvendo também o que a visão computacional precisa (recorte em alta,
     * logo, OCR, critérios) para landmarks, ensemble, quality gate e asset canônico.
     *
     * @param lenient "orientar, não recusar": critérios de foto reprovados voltam em {@link CaptureAnalysis#failedChecks()}
     *                e o rascunho é criado mesmo assim; só conteúdo fora da política continua recusado (422)
     */
    @Transactional(noRollbackFor = PhotoRejectedException.class)
    public CaptureAnalysis analyzeForCapture(CurrentUser user, byte[] bytes, String category, boolean lenient) {
        return analyzeInternal(user, bytes, category, lenient);
    }

    /**
     * Resultado completo da análise para a sessão de captura.
     *
     * @param studioSource  peça endireitada e recortada em alta resolução (fonte do canônico e das zonas)
     * @param logoBox       caixa do logo relativa a {@code studioSource} (x0, y0, x1, y1 em 0–1) ou null
     * @param failedChecks  critérios de foto reprovados (só no modo lenient)
     * @param allChecks     todos os critérios avaliados (aprovados e reprovados)
     */
    public record CaptureAnalysis(Draft draft, java.awt.image.BufferedImage studioSource, Set<String> truncated,
                                  double[] logoBox, String logoSource, LocalVision.PieceGuess guess,
                                  br.com.fashionai.application.imaging.BrandReader.Found ocr,
                                  List<PhotoAcceptance.Check> failedChecks, List<PhotoAcceptance.Check> allChecks,
                                  double rotationDeg, double backgroundConfidence, int originalWidth, int originalHeight,
                                  boolean aiRan) {
    }

    private CaptureAnalysis analyzeInternal(CurrentUser user, byte[] bytes, String category, boolean lenient) {
        guard.requireCanCreate(user);
        PieceDraftAnalyzer.Detection detection = new PieceDraftAnalyzer(users, ai, flatLay, pieceReferences, brandReader)
                .detect(user, bytes, category, lenient);
        return new DraftRecorder(jobs, media, shots()).record(user, bytes, detection);
    }

    /**
     * RF4 — nova tentativa de ler a marca de um rascunho: a peça é dividida numa grade de sub-retângulos sobrepostos (e a
     * região do logo em quatro), cada um ampliado. Primeiro o OCR local lê todos; se não achar marca do catálogo, a IA
     * de visão recebe os recortes. A cada nova tentativa a grade fica mais fina (3×3 → 4×4 → 5×5).
     */
    @Transactional
    public Map<String, Object> retryBrand(CurrentUser user, UUID draftId, int grid) {
        PipelineJob draft = ownedDraft(user, draftId);
        return new DraftBrandRetry(media, ai, brandReader).retry(user, draftId, draft, grid);
    }

    /** Rascunho de análise do próprio usuário (404 se não existe; negado e auditado se é de outra pessoa). */
    private PipelineJob ownedDraft(CurrentUser user, UUID draftId) {
        PipelineJob draft = jobs.findById(draftId).orElseThrow(() -> ApiException.notFound("Rascunho"));
        if (!draft.getUser().getId().equals(user.id())) {
            throw guard.deny(user, "draft:" + draftId, Msg.t("wardrobe.rascunho_de_outro_usuario"));
        }
        return draft;
    }

    /** RF4.CA05 — várias fotos: um rascunho por foto; a foto recusada volta com o motivo e as demais seguem. */
    public List<Draft> analyzeBatch(CurrentUser user, List<byte[]> files) {
        return analyzeBatch(user, files, null);
    }

    // P12: transacional — a auto-invocação de analyze() não passa pelo proxy, e sem transação os campos gravados
    // depois de jobs.save(job) (resultJson, estágios, custo) se perdiam com open-in-view desligado
    @Transactional(noRollbackFor = PhotoRejectedException.class)
    public List<Draft> analyzeBatch(CurrentUser user, List<byte[]> files, String category) {
        if (files == null || files.isEmpty()) {
            throw ApiException.badRequest("SEM_FOTOS", Msg.t("wardrobe.envie_ao_menos_uma_foto"));
        }
        if (files.size() > 12) {
            throw ApiException.badRequest("LOTE_GRANDE", Msg.t("wardrobe.envie_no_maximo_12_fotos"));
        }
        List<Draft> drafts = new ArrayList<>();
        for (byte[] f : files) {
            try {
                drafts.add(analyze(user, f, category));
            } catch (PhotoRejectedException e) {
                drafts.add(Draft.rejected(e));
            }
        }
        return drafts;
    }

    // ================================================================== RF4 — salvar
    public record PieceForm(UUID draftId, boolean useDefaultImage, String name, String category, String subcategory,
                            String sex, UUID brandId, String brandName, String color, String material, String size,
                            String market, List<String> occasion, List<String> style, List<String> seals, BigDecimal price,
                            Visibility visibility, List<String> tags, String notes, ItemCondition condition,
                            LocalDate purchaseDate, String purchaseLocation, String sku, String careInstructions,
                            Boolean forSale, Boolean studio, String brandLogoUrl, String brandSource, String brandRef,
                            Map<String, Object> background, UUID captureSessionId, String variation,
                            Map<String, List<String>> attributes, List<String> confirmed, UUID estadoConservacaoId, Boolean clearEstadoConservacao) {
        /** Ocasião e estilo chegam da tela como listas de códigos: espaços, maiúsculas e repetidos não derrubam o cadastro. */
        public PieceForm {
            occasion = Taxonomy.normalizeTags(occasion);
            style = Taxonomy.normalizeTags(style);
            variation = variation == null || variation.isBlank() ? null : variation.trim().toUpperCase(java.util.Locale.ROOT);
        }

        /** Compatibility constructor: old callers do not set or clear the conservation FK. */
        public PieceForm(UUID draftId, boolean useDefaultImage, String name, String category, String subcategory,
                         String sex, UUID brandId, String brandName, String color, String material, String size,
                         String market, List<String> occasion, List<String> style, List<String> seals, BigDecimal price,
                         Visibility visibility, List<String> tags, String notes, ItemCondition condition,
                         LocalDate purchaseDate, String purchaseLocation, String sku, String careInstructions,
                         Boolean forSale, Boolean studio, String brandLogoUrl, String brandSource, String brandRef,
                         Map<String, Object> background, UUID captureSessionId, String variation,
                         Map<String, List<String>> attributes, List<String> confirmed) {
            this(draftId, useDefaultImage, name, category, subcategory, sex, brandId, brandName, color, material, size, market,
                    occasion, style, seals, price, visibility, tags, notes, condition, purchaseDate, purchaseLocation, sku,
                    careInstructions, forSale, studio, brandLogoUrl, brandSource, brandRef, background, captureSessionId,
                    variation, attributes, confirmed, null, false);
        }

        /**
         * Formulário com variação/atributos, sem a lista {@code confirmed} (campos que a pessoa tocou ou confirmou — só
         * servem para promover a origem a USER; a origem AI/CATALOG/RULE é deduzida no servidor, nunca declarada).
         */
        public PieceForm(UUID draftId, boolean useDefaultImage, String name, String category, String subcategory,
                         String sex, UUID brandId, String brandName, String color, String material, String size,
                         String market, List<String> occasion, List<String> style, List<String> seals, BigDecimal price,
                         Visibility visibility, List<String> tags, String notes, ItemCondition condition,
                         LocalDate purchaseDate, String purchaseLocation, String sku, String careInstructions,
                         Boolean forSale, Boolean studio, String brandLogoUrl, String brandSource, String brandRef,
                         Map<String, Object> background, UUID captureSessionId, String variation,
                         Map<String, List<String>> attributes) {
            this(draftId, useDefaultImage, name, category, subcategory, sex, brandId, brandName, color, material, size, market,
                    occasion, style, seals, price, visibility, tags, notes, condition, purchaseDate, purchaseLocation, sku,
                    careInstructions, forSale, studio, brandLogoUrl, brandSource, brandRef, background, captureSessionId,
                    variation, attributes, null);
        }

        /** Formulário sem variação/atributos (versões anteriores da tela, cadastro pelo catálogo, lote). */
        public PieceForm(UUID draftId, boolean useDefaultImage, String name, String category, String subcategory,
                         String sex, UUID brandId, String brandName, String color, String material, String size,
                         String market, List<String> occasion, List<String> style, List<String> seals, BigDecimal price,
                         Visibility visibility, List<String> tags, String notes, ItemCondition condition,
                         LocalDate purchaseDate, String purchaseLocation, String sku, String careInstructions,
                         Boolean forSale, Boolean studio, String brandLogoUrl, String brandSource, String brandRef,
                         Map<String, Object> background, UUID captureSessionId) {
            this(draftId, useDefaultImage, name, category, subcategory, sex, brandId, brandName, color, material, size, market,
                    occasion, style, seals, price, visibility, tags, notes, condition, purchaseDate, purchaseLocation, sku,
                    careInstructions, forSale, studio, brandLogoUrl, brandSource, brandRef, background, captureSessionId, null, null);
        }

        /**
         * Subcategoria LEGACY no padrão novo (docs/taxonomia, C.3): bermuda_shorts vira shorts + LENGTH=KNEE, coturno vira
         * boots + COMBAT, short jeans vira shorts + material DENIM. O que a pessoa já escolheu (variação, atributo,
         * material) vale mais que o implícito.
         */
        public PieceForm resolveTaxonomy() {
            return PieceTaxonomyWriter.resolveLegacy(this);
        }

        /** Formulário sem sessão de captura adaptativa (lote, várias peças numa foto, edição). */
        public PieceForm(UUID draftId, boolean useDefaultImage, String name, String category, String subcategory,
                         String sex, UUID brandId, String brandName, String color, String material, String size,
                         String market, List<String> occasion, List<String> style, List<String> seals, BigDecimal price,
                         Visibility visibility, List<String> tags, String notes, ItemCondition condition,
                         LocalDate purchaseDate, String purchaseLocation, String sku, String careInstructions,
                         Boolean forSale, Boolean studio, String brandLogoUrl, String brandSource, String brandRef,
                         Map<String, Object> background) {
            this(draftId, useDefaultImage, name, category, subcategory, sex, brandId, brandName, color, material, size, market,
                    occasion, style, seals, price, visibility, tags, notes, condition, purchaseDate, purchaseLocation, sku,
                    careInstructions, forSale, studio, brandLogoUrl, brandSource, brandRef, background, null);
        }
    }

    @Transactional
    public Views.PieceView create(CurrentUser user, PieceForm form) {
        return createInternal(user, form, null);
    }

    /**
     * RF47 · produto escolhido no catálogo global: a peça pessoal referencia o produto (sem copiar foto nem metadados)
     * e usa a foto oficial (proveniência no catálogo) como imagem principal até a pessoa adicionar a própria foto.
     * {@code catalogImage}: a imagem do card ({@code CatalogImagePipelineService.cardImage}) — com o recorte semântico
     * da canônica (nível A, a foto não é copiada) ou os assets processados (nível B); null = foto inteira.
     */
    public record CatalogPick(UUID productId, UUID variantId, String imageUrl, String thumbnailUrl, Map<String, Object> catalogImage) {
        public CatalogPick(UUID productId, UUID variantId, String imageUrl) {
            this(productId, variantId, imageUrl, null, null);
        }
    }

    @Transactional
    public Views.PieceView createFromCatalog(CurrentUser user, PieceForm form, CatalogPick pick) {
        return createInternal(user, form, Objects.requireNonNull(pick));
    }

    @org.springframework.beans.factory.annotation.Autowired
    private BackgroundStudioService backgroundStudioAccess;

    private void requireBackgroundAuraAccess(CurrentUser user, Object config) {
        if (backgroundStudioAccess != null) backgroundStudioAccess.requireAuraAccess(user, config);
    }

    private Views.PieceView createInternal(CurrentUser user, PieceForm form, CatalogPick pick) {
        guard.requireCanCreate(user);
        requireBackgroundAuraAccess(user, form.background());
        User owner = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        form = form.resolveTaxonomy();
        PieceFormWriter.validate(form);
        // o rascunho é travado (SELECT … FOR UPDATE): dois envios simultâneos do mesmo rascunho são atendidos um depois do outro
        PipelineJob draft = form.draftId() == null ? null : jobs.findByIdForUpdate(form.draftId()).orElse(null);
        if (draft != null && !draft.getUser().getId().equals(owner.getId())) {
            throw guard.deny(user, "draft:" + form.draftId(), Msg.t("wardrobe.rascunho_de_outro_usuario"));
        }
        // idempotência: um rascunho de foto vira UMA peça. Duplo clique ou nova tentativa depois de uma resposta perdida
        // devolvem a peça já criada, em vez de criar outra igual.
        if (draft != null && "PIECE".equals(draft.getTargetType()) && draft.getInputResourceId() != null) {
            Optional<WardrobeItem> existing = pieces.findById(draft.getInputResourceId()).filter(p -> p.getUser().getId().equals(owner.getId()));
            if (existing.isPresent()) {
                return Views.piece(existing.get(), viewerState(user, existing.get()), Map.of());
            }
        }
        WardrobeItem w = new WardrobeItem();
        w.setUser(owner);
        // a origem da variação (IA × pessoa) é deduzida do pré-preenchimento guardado no rascunho, nunca declarada
        Map<?, ?> aiPrefill = draft != null && Json.map(draft.getResultJson()).get("prefill") instanceof Map<?, ?> prefill ? prefill : null;
        formWriter().apply(w, form, true, aiPrefill);
        w.setVisibility(form.visibility() != null ? form.visibility() : AccountService.defaultVisibility(owner));
        if (draft == null && !form.useDefaultImage() && pick == null) {
            throw ApiException.badRequest("FOTO_OBRIGATORIA", Msg.t("wardrobe.envie_uma_foto_ou_escolha"));
        }
        if (draft == null && pick != null) {
            PieceImages.fromCatalog(w, pick, assets);
            pieces.save(w);
        } else if (draft == null) {
            // imagem padrão da peça (/public/assets_pecas) quando o usuário deixa a foto vazia.
            PieceImages.useDefault(w, assets);
            pieces.save(w);
            defaultStudio(w);                       // a imagem padrão também sai de estúdio: quadro cheio, foco no logo FAI
        } else {
            draftImport().importDraft(owner, w, draft, form);
        }
        projections.piece(w);
        notifications.notify(owner.getId(), null, NotificationType.PIECE_CREATED, "PIECE", w.getId(),
                Msg.k("wardrobe.peca_adicionada_ao_guarda_roupa"), Msg.k("wardrobe.ja_esta_no_seu_closet", (w.getName())), null);
        audit.log(user, AuditActions.CADASTRO_PECA, "piece:" + w.getId(), Map.of("category", w.getCategory(),
                "defaultImage", w.isDefaultImage()));
        // RF32.CA02 (endereço automático), RF35 (pontos), RF34 (histórico de disponibilidade)
        events.publishEvent(new DomainEvents.PieceCreated(owner.getId(), w.getId(), InventoryScoreService.catalogReady(w)));
        if (form.captureSessionId() != null && form.draftId() != null) {
            // RF4 · captura adaptativa: liga fotos, canônicos e identificação à peça e registra correções (depois do commit)
            w.setCaptureSessionId(form.captureSessionId());
            events.publishEvent(new DomainEvents.PieceCapturedFromSession(owner.getId(), w.getId(), form.captureSessionId(), form.draftId()));
        }
        return Views.piece(w, viewerState(user, w), Map.of());
    }

    /** RF4.CA05 — confirma o lote de rascunhos revisados. */
    @Transactional
    public List<Views.PieceView> createBatch(CurrentUser user, List<PieceForm> forms) {
        List<Views.PieceView> out = new ArrayList<>();
        for (PieceForm f : forms) {
            out.add(create(user, f));
        }
        return out;
    }

    /**
     * RF12.CA03 — a foto que era a imagem da peça foi excluída: a peça volta para a imagem padrão da subcategoria
     * (image_url é obrigatório; a peça nunca fica sem imagem).
     */
    public void useDefaultImageAfterPhotoDeletion(WardrobeItem w) {
        PieceImages.afterPhotoDeletion(w, assets);
    }

    /**
     * Etapa remota do Flat Lay (rembg → remove.bg + Cloudinary) dentro do motor de IA: toda remoção de fundo que pode
     * cair num provedor pago passa pela cota diária da capacidade, pelo teto de gasto e pelo registro da inferência.
     */
    public AiEngine.RemoteStep<FlatLayPipeline.Result> flatLayStep(byte[] bytes) {
        return new FlatLayRemoteStep(flatLay, bytes);
    }

    /** Remoção de fundo sob demanda pelo motor de IA (cota + teto de gasto); sem provedor ou fora da cota, o recorte é local. */
    public FlatLayPipeline.Result governedFlatLay(UUID userId, byte[] bytes) {
        return ai.execute(userId, AiCapability.FLAT_LAY_STANDARDIZER, List.of(Msg.t("wardrobe.foto_enviada_kb", bytes.length / 1024)),
                null, null, List.of(flatLayStep(bytes)), () -> flatLay.run(bytes, false)).value();
    }

    // ================================================================== RF6 — Closet Digital
    /**
     * Filtros do closet. {@code hypeLevel} é FILTRO (faixa mínima: NICHE, RELEVANT, HOT, TRENDING, VIRAL), não aba.
     * Ordenações: recent, name, price, worn (mais usada), least_worn, idle (mais tempo sem uso) e, do HypeScore v2,
     * hype/hype_desc, hype_asc, growth (maior crescimento) e rarity (mais rara). {@code seal} (RF53) também é FILTRO:
     * {@code hype} (peças com selo de Hype FashionAI), {@code brand} (com selo de marca/celebridade aprovado na peça) ou
     * {@code any} (qualquer um dos dois).
     */
    public record ClosetFilter(String category, String color, String season, String occasion, String style, String state,
                               String q, String sort, int page, int size, String hypeLevel, String seal) {
        public ClosetFilter(String category, String color, String season, String occasion, String style, String state, String q, String sort, int page, int size) {
            this(category, color, season, occasion, style, state, q, sort, page, size, null, null);
        }

        public ClosetFilter(String category, String color, String season, String occasion, String style, String state, String q, String sort,
                            int page, int size, String hypeLevel) {
            this(category, color, season, occasion, style, state, q, sort, page, size, hypeLevel, null);
        }
    }

    @Transactional(readOnly = true)
    public Views.Page<Views.PieceView> closet(CurrentUser viewer, UUID ownerId, ClosetFilter f) {
        UUID owner = ownerId == null ? viewer.id() : ownerId;
        boolean self = viewer != null && viewer.id().equals(owner);
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(owner).stream()
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> self || guard.canView(viewer, owner, effectiveVisibility(w)))
                .filter(w -> self || w.getModerationStatus() == ModerationStatus.APPROVED)
                .filter(w -> ClosetQuery.matches(w, f))
                .collect(Collectors.toCollection(ArrayList::new));
        String sort = ClosetQuery.sortKey(f.sort());
        String seal = sealFilter(f.seal());
        Map<UUID, br.com.fashionai.domain.model.HypeScoreCurrent> hype = ClosetQuery.needsHype(sort, f.hypeLevel(), seal)
                ? closetHype().scores(all, self) : Map.of();
        if (!blank(f.hypeLevel()) && hypeConfig != null) {
            int min = hypeMinimum(f.hypeLevel());
            all.removeIf(w -> ClosetQuery.belowMinimum(hype.get(w.getId()), min));
        }
        if (seal != null) {
            // RF53 — selo de Hype: derivado do Hype atual (peça privada não tem: só item público elegível); selo de marca:
            // vínculo APROVADO de tier PEÇA vindo de um look que quem vê consegue ver
            Set<UUID> branded = "hype".equals(seal) ? Set.of()
                    : SealService.approvedPieceBonds(all.stream().map(WardrobeItem::getId).toList(), schemeItems, sealBonds,
                    sc -> SealService.canViewScheme(guard, viewer, sc)).keySet();
            all.removeIf(w -> !ClosetQuery.keepForSeal(seal,
                    !br.com.fashionai.application.hype.HypeSeals.of(hype.get(w.getId())).isEmpty(), branded.contains(w.getId())));
        }
        all.sort(ClosetQuery.order(sort, hype, LocalDate.now(br.com.fashionai.application.hype.HypeSignalRecorder.ZONE)));
        ClosetQuery.Window win = ClosetQuery.window(f.page(), f.size(), all.size());
        List<Views.PieceView> items = all.subList(win.from(), win.to()).stream().map(w -> Views.piece(w, viewerState(viewer, w), null)).toList();
        return new Views.Page<>(items, win.page(), win.size(), all.size(), win.hasMore(all.size()));
    }

    /** Faixa mínima de Hype → score mínimo (limiares centralizados no HypeScoreConfig). */
    int hypeMinimum(String level) {
        return closetHype().minimum(level);
    }

    // ================================================================== RF7 — detalhe
    @Transactional
    public Map<String, Object> detail(CurrentUser viewer, UUID id, UUID fromSchemeId) {
        WardrobeItem w = pieces.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        boolean owner = viewer != null && viewer.id().equals(w.getUser().getId());
        // visibilidade (peça, perfil do dono, bloqueio) e moderação antes de qualquer dado — inclusive do retrato arquivado
        requireVisiblePiece(viewer, w);
        PieceDetailView view = new PieceDetailView(schemeItems, s -> schemeVisible(viewer, s));
        if (w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED && !owner) {
            // RF7.CA03 — snapshot do momento da publicação, marcado como "não mais disponível"; só de um look que quem
            // pede também consegue ver
            return view.archived(w, id, fromSchemeId);
        }
        // Atualização direta (sem @Version): o detalhe é aberto em paralelo (ex.: antes/depois de a sessão carregar)
        // e mexer na entidade gerava conflito de versão (409) num simples GET.
        pieces.touchView(w.getId(), owner ? 0 : 1, Instant.now());
        if (!owner && viewer != null) {
            events.publishEvent(new DomainEvents.HypeSignal(HypeSignalType.PIECE_VIEWED, HypeEntityType.PIECE, id, viewer.id(), w.getUser().getId()));
        }
        Views.PieceView piece = Views.piece(w, viewerState(viewer, w), reactionCounts(TargetType.PIECE, w.getId()));
        return view.live(w, id, fromSchemeId, owner, piece);
    }

    /**
     * L1/L2 — quem não é dono nem admin só alcança peça aprovada na moderação e visível para ele: visibilidade da peça e
     * do perfil do dono (a mais restritiva) e nenhum bloqueio entre os dois. Peça em moderação ou reprovada responde 404.
     */
    void requireVisiblePiece(CurrentUser viewer, WardrobeItem w) {
        if (viewer != null && (viewer.id().equals(w.getUser().getId()) || viewer.admin())) {
            return;
        }
        if (w.getModerationStatus() != ModerationStatus.APPROVED) {
            throw ApiException.notFound(Msg.t("common.peca"));
        }
        guard.requireView(viewer, w.getUser().getId(), effectiveVisibility(w), "piece:" + w.getId());
    }

    /** Esquema visível para quem pede: não arquivado e pela visibilidade efetiva (esquema × perfil do autor, bloqueio). */
    boolean schemeVisible(CurrentUser viewer, Scheme s) {
        if (s.getStatus() == SchemeStatus.ARCHIVED) {
            return false;
        }
        return guard.canView(viewer, s.getUser().getId(), SchemeService.moreRestrictive(s.getVisibility(), s.getUser().getProfileVisibility()));
    }

    /** Visibilidade efetiva da peça: a mais restritiva entre a da peça e a do perfil do dono (mesma regra dos esquemas). */
    public static Visibility effectiveVisibility(WardrobeItem w) {
        return SchemeService.moreRestrictive(w.getVisibility(), w.getUser().getProfileVisibility());
    }

    public Views.ViewerState viewerState(CurrentUser viewer, WardrobeItem w) {
        return new PieceViewerState(reactions, saved).of(viewer, w);
    }

    public Map<String, Long> reactionCounts(TargetType type, UUID id) {
        return new PieceViewerState(reactions, saved).reactionCounts(type, id);
    }

    // ================================================================== RF9.CA07 — edição
    @Transactional
    public Views.PieceView update(CurrentUser user, UUID id, PieceForm form) {
        guard.requireCanCreate(user);
        requireBackgroundAuraAccess(user, form.background());
        WardrobeItem w = owned(user, id);
        form = form.resolveTaxonomy();
        PieceFormWriter.validate(form);
        formWriter().apply(w, form, false);
        if (form.visibility() != null) {
            w.setVisibility(form.visibility());
        }
        projections.piece(w);
        audit.log(user, AuditActions.EDICAO_PECA, "piece:" + id, Map.of());
        events.publishEvent(new DomainEvents.PieceUpdated(user.id(), id, InventoryScoreService.completeness(w)));
        return Views.piece(w, viewerState(user, w), null);
    }

    /** RF19.CA08 — publicar no feed: a dona confirmou no diálogo de compartilhar que a peça privada passa a ser pública. */
    @Transactional
    public void publishForFeed(CurrentUser user, UUID id) {
        WardrobeItem w = owned(user, id);
        w.setVisibility(Visibility.PUBLIC);
        projections.piece(w);
        audit.log(user, AuditActions.EDICAO_PECA, "piece:" + id, Map.of("visibility", Visibility.PUBLIC.name()));
    }

    // ================================================================== RF31 — toggles da faixa superior
    @Transactional
    public Views.PieceView toggles(CurrentUser user, UUID id, Boolean favorite, Boolean disponivel, Boolean forSale) {
        return toggles(user, id, favorite, disponivel, forSale, null);
    }

    /** Estados da peça; "à venda" e "para doar" são exclusivos entre si (marcar um desmarca o outro). */
    @Transactional
    public Views.PieceView toggles(CurrentUser user, UUID id, Boolean favorite, Boolean disponivel, Boolean forSale, Boolean forDonation) {
        guard.requireCanCreate(user);
        WardrobeItem w = owned(user, id);
        if (favorite != null) {
            w.setFavorite(favorite);
        }
        if (disponivel != null) {
            // disponível e indisponível são exclusivos entre si (RF31.CA06).
            boolean changed = w.isDisponivel() != disponivel;
            w.setDisponivel(disponivel);
            w.setAvailabilityStatus(disponivel ? AvailabilityStatus.AVAILABLE : AvailabilityStatus.UNAVAILABLE);
            if (changed) {
                // RF34 §3.3 — histórico de transições (população de exposição da Utilização)
                events.publishEvent(new DomainEvents.AvailabilityChanged(user.id(), id, disponivel));
            }
        }
        PieceFormWriter.applyListing(w, forSale, forDonation);
        return Views.piece(w, viewerState(user, w), null);
    }

    @Transactional
    public Views.PieceView markWorn(CurrentUser user, UUID id) {
        WardrobeItem w = owned(user, id);
        w.setWearCount(w.getWearCount() + 1);
        w.setLastWornDate(LocalDate.now(FaiPointsService.ZONE));
        events.publishEvent(new DomainEvents.PieceWorn(user.id(), id, w.getLastWornDate(), null));
        return Views.piece(w, viewerState(user, w), null);
    }

    // ================================================================== RF6.CA05 — exclusão
    @Transactional(readOnly = true)
    public Map<String, Object> deletionImpact(CurrentUser user, UUID id) {
        WardrobeItem w = owned(user, id);
        List<SchemeItem> uses = schemeItems.findByWardrobeItemId(id);
        long published = uses.stream().filter(si -> si.getScheme().getStatus() == SchemeStatus.PUBLISHED).count();
        return Map.of("pieceId", w.getId(), "schemesAffected", uses.stream().map(si -> si.getScheme().getId()).distinct().count(),
                "publishedSchemes", published,
                "message", uses.isEmpty() ? Msg.t("wardrobe.a_peca_nao_esta_em")
                        : Msg.t("wardrobe.a_peca_esta_em_esquema", uses.stream().map(si -> si.getScheme().getId()).distinct().count()));
    }

    @Transactional
    public Map<String, Object> delete(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        WardrobeItem w = owned(user, id);
        Map<String, Object> impact = deletionImpact(user, id);
        for (SchemeItem si : schemeItems.findByWardrobeItemId(id)) {
            if (si.getSnapshotJson() == null) {
                si.setSnapshotJson(Json.write(Views.snapshot(w)));
            }
        }
        w.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        w.setDisponivel(false);
        w.setVisibility(Visibility.PRIVATE);
        projections.removePiece(id);
        // RF12.CA13: as fotos da peça (original e edições) saem de "Minhas Fotos" junto com ela
        int photosRemoved = media.retire(user.id(), id, Set.of(PhotoOrigin.WARDROBE_ITEM, PhotoOrigin.EDITOR),
                java.util.stream.Stream.of(w.getImageUrl(), w.getOriginalImageUrl()).filter(java.util.Objects::nonNull).toList());
        events.publishEvent(new DomainEvents.PieceDeleted(user.id(), id));
        audit.log(user, AuditActions.EXCLUSAO_PECA, "piece:" + id, Map.of("schemesAffected", impact.get("schemesAffected"), "photosRemoved", photosRemoved));
        Map<String, Object> out = new java.util.LinkedHashMap<>(impact);
        out.put("photosRemoved", photosRemoved);
        return out;
    }

    // ================================================================== RF15.CA02 — imagem editada no Canvas 2D
    @Transactional
    public Views.PieceView replaceImage(CurrentUser user, UUID id, byte[] bytes, UUID editedFromPhotoId) {
        guard.requireCanCreate(user);
        WardrobeItem w = owned(user, id);
        imageEdits().replaceImage(user.id(), id, w, bytes, editedFromPhotoId);
        audit.log(user, AuditActions.EDICAO_PECA, "piece:" + id, Map.of("field", "image"));
        return Views.piece(w, viewerState(user, w), null);
    }

    /** RF18.CA05 / RF15.CA01 — remoção de fundo sob demanda (falha é informada sem travar as demais ferramentas). */
    @Transactional
    public Map<String, Object> removeBackground(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        WardrobeItem w = owned(user, id);
        byte[] bytes = media.read(w.getOriginalImageUrl() != null ? w.getOriginalImageUrl() : w.getImageUrl())
                .orElseThrow(() -> new ApiException(422, "SEM_IMAGEM", Msg.t("wardrobe.esta_peca_nao_tem_foto")));
        FlatLayPipeline.Result r = governedFlatLay(user.id(), bytes);
        return imageEdits().removedBackground(user.id(), id, w, r);
    }

    /** Job (RF4.CA06): reprocessa peças salvas com a foto original quando a remoção de fundo volta. */
    @Transactional
    public int reprocessPending() {
        return new FlatLayReprocessor(jobs, pieces, flatLay, ai, media, notifications, imageEdits()).run();
    }

    // ================================================================== RF4 · Estúdio: versões e aprovação da foto de estúdio
    // A foto de estúdio aprovada nunca é trocada em silêncio por um processamento novo: com uma aprovada no ar, o
    // resultado novo fica em flatLayMetadata.studio.pending (com a própria versão e todos os derivados: foto inteira,
    // miniatura, variante do feed, detalhe do logo, recorte realçado, enquadramento e marcos para ajuste manual) até a
    // pessoa aprovar (POST /studio/approve) ou descartar (DELETE /studio/pending). Peças antigas sem esses campos
    // contam como versão 1 aprovada (regras em StudioVersionFlow e StudioVersionMetadata).

    /** Resultado novo do estúdio: pendente (com aprovada no ar e mesma origem) ou no ar aguardando aprovação. */
    String offerStudio(WardrobeItem w, Map<String, Object> info, boolean sourceChanged) {
        return versions().offerStudio(w, info, sourceChanged);
    }

    /** Aprova a foto de estúdio: a pendente vai ao ar (a anterior fica no histórico) ou a atual é marcada como aprovada. */
    @Transactional
    public Views.PieceView approveStudio(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        WardrobeItem w = owned(user, id);
        versions().approve(w);
        audit.log(user, AuditActions.EDICAO_PECA, "piece:" + id, Map.of("field", "studio", "action", "approve"));
        return Views.piece(w, viewerState(user, w), null);
    }

    /** Descarta a versão pendente: a aprovada continua no ar e os arquivos da pendente são apagados. */
    @Transactional
    public Views.PieceView discardStudio(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        WardrobeItem w = owned(user, id);
        versions().discard(w);
        audit.log(user, AuditActions.EDICAO_PECA, "piece:" + id, Map.of("field", "studio", "action", "discard"));
        return Views.piece(w, viewerState(user, w), null);
    }

    void defaultStudio(WardrobeItem w) {
        studios().defaultStudio(w);
    }

    /** Peças com imagem padrão cadastradas antes do estúdio da imagem padrão: 20 por rodada, a cada 10 min. */
    @org.springframework.scheduling.annotation.Scheduled(fixedDelayString = "${fashionai.studio.default-backfill-ms:600000}", initialDelay = 30000)
    @Transactional
    public void backfillDefaultStudio() {
        for (WardrobeItem w : pieces.findTop20ByDefaultImageTrueAndStudioImageUrlIsNull()) {
            defaultStudio(w);
        }
    }

    /** Fundos de estúdio disponíveis (+ "auto", que escolhe pela cor da peça). */
    public List<Map<String, Object>> studioBackdrops() {
        return PieceStudioHints.backdrops();
    }

    /**
     * Refaz o estúdio do rascunho com outro fundo (antes de salvar a peça). {@code force}: o recorte local foi marcado
     * como incerto (fundo parecido com a peça), mas a pessoa conferiu e quer usar mesmo assim.
     */
    @Transactional
    public Map<String, Object> studioDraft(CurrentUser user, UUID draftId, String backdrop, boolean force) {
        PipelineJob draft = ownedDraft(user, draftId);
        return studios().forDraft(user.id(), draftId, draft, backdrop, force);
    }

    /** Gera (ou refaz) a foto de estúdio de uma peça já cadastrada a partir do recorte (em alta, quando guardado). */
    @Transactional
    public Views.PieceView studioPiece(CurrentUser user, UUID id, String backdrop) {
        guard.requireCanCreate(user);
        WardrobeItem w = owned(user, id);
        studios().forPiece(user.id(), id, w, backdrop);
        return Views.piece(w, viewerState(user, w), null);
    }

    /** Leva ao estúdio as peças do usuário que ainda não têm foto de estúdio (até 40 por chamada). */
    @Transactional
    public Map<String, Object> studioAll(CurrentUser user, String backdrop) {
        guard.requireCanCreate(user);
        return studios().forAll(user.id(), backdrop);
    }

    // ================================================================== RF16 — 3D (job assíncrono; ver Model3dService)
    @Transactional
    public Map<String, Object> request3d(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        return model3d.request(owned(user, id));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> status3d(CurrentUser user, UUID id) {
        return model3d.status(owned(user, id));
    }

    // ================================================================== "Adicionar" (copiar peça pública)
    @Transactional
    public Views.PieceView addToWardrobe(CurrentUser user, UUID sourceId) {
        guard.requireCanCreate(user);
        WardrobeItem src = pieces.findById(sourceId).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        if (src.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED && !src.getUser().getId().equals(user.id())) {
            throw ApiException.notFound(Msg.t("common.peca"));
        }
        // privacidade do perfil do dono, bloqueio e moderação valem para copiar, não só para ver
        requireVisiblePiece(user, src);
        if (src.getUser().getId().equals(user.id())) {
            throw ApiException.conflict("JA_E_SUA", Msg.t("wardrobe.esta_peca_ja_esta_no"));
        }
        User owner = users.findById(user.id()).orElseThrow();
        WardrobeItem copy = PieceCopy.of(src, owner);
        pieces.save(copy);
        projections.piece(copy);
        return Views.piece(copy, viewerState(user, copy), null);
    }

    public WardrobeItem owned(CurrentUser user, UUID id) {
        WardrobeItem w = pieces.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        guard.requireOwner(user, w.getUser().getId(), "piece:" + id);
        return w;
    }

    /** Peças elegíveis para composição (RF5.CA07b / RF31.CA02): só as disponíveis do acervo real. */
    public List<WardrobeItem> eligible(UUID userId) {
        return pieces.findByUserIdAndDisponivelOrderByCreatedAtDesc(userId, true).stream()
                .filter(w -> w.getAvailabilityStatus() == AvailabilityStatus.AVAILABLE)
                .filter(w -> w.getModerationStatus() != ModerationStatus.REJECTED_POLICY
                        && w.getModerationStatus() != ModerationStatus.REJECTED_NOT_CLOTHING)
                .toList();
    }

    public Map<String, Object> taxonomy() {
        return WardrobeTaxonomyCatalog.build(assets, brands);
    }

    // ------------------------------------------------------------------ compatibilidade: delegações
    // Ficam as que têm chamador fora deste arquivo: produção (MultiPieceService, CopilotService, SchemeService,
    // AutopilotService, DnaService, MirrorService, RoomService) e as delegações anteriores ao lote R02. As regras
    // movidas no R02 que só testes chamavam são testadas direto no colaborador dono.
    static String sealFilter(String raw) {
        return ClosetQuery.sealFilter(raw);
    }

    static boolean stateMatches(WardrobeItem w, String state) {
        return ClosetQuery.stateMatches(w, state);
    }

    static Map<String, Object> studioMeta(Map<String, Object> meta) {
        return StudioVersionMetadata.copyFrom(meta);
    }

    static int studioVersion(Map<String, Object> cur, WardrobeItem w) {
        return StudioVersionMetadata.version(cur, () -> w.getStudioImageUrl());
    }

    static boolean studioApproved(Map<String, Object> cur, WardrobeItem w) {
        return StudioVersionMetadata.approved(cur, w.getStudioImageUrl());
    }

    static Map<String, Object> studioSummary(Map<String, Object> info, int version, boolean approved) {
        return StudioVersionMetadata.summary(info, version, approved);
    }

    /**
     * Taxonomia CATEGORY → SUBCATEGORY → VARIATION + dimensões (docs/taxonomia, seções C e H): variações por subcategoria
     * (CORE primeiro), catálogo de variações com rótulos e descrição, dimensões com escopo e valores (sem os de legado),
     * subcategorias LEGACY com o equivalente novo e os rótulos dos códigos novos em pt-BR/en/es.
     */
    static Map<String, Object> taxonomyV2() {
        return br.com.fashionai.application.taxonomy.TaxonomyView.extended();
    }

    static final String MODERATION_SYSTEM = PieceAnalyzerPrompts.MODERATION_SYSTEM;

    LocalVision.ModerationVerdict parseModeration(String text) {
        return PieceAnalysisParser.parseModeration(text);
    }

    static String brandName(String raw) {
        return PieceAnalysisParser.brandName(raw);
    }

    static String oneOf(String value, java.util.Collection<String> allowed) {
        return AiResponseJson.oneOf(value, allowed);
    }

    static List<String> strings(Object o) {
        return AiResponseJson.strings(o);
    }

    static Map<String, Object> extractJson(String text) {
        return AiResponseJson.extractJson(text);
    }

    static String str(Object o) {
        return AiResponseJson.str(o);
    }

    static String label(String code) {
        return PiecePrefill.label(code);
    }

    static String humanize(String code) {
        return PiecePrefill.humanize(code);
    }

    // ------------------------------------------------------------------ util
    static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    static boolean contains(String hay, String needle) {
        return hay != null && needle != null && hay.toLowerCase(Locale.ROOT).contains(needle.toLowerCase(Locale.ROOT));
    }

    static <K, V> Map<K, V> enumMap(Class<K> k) {
        return new LinkedHashMap<>();
    }

    static Map<ReactionType, Long> emptyReactions() {
        return new EnumMap<>(ReactionType.class);
    }

    static List<UUID> ids(List<WardrobeItem> items) {
        return items.stream().map(WardrobeItem::getId).filter(Objects::nonNull).toList();
    }

    static PageRequest page(int page, int size) {
        return PageRequest.of(Math.max(0, page), Math.max(1, Math.min(60, size)), Sort.by(Sort.Direction.DESC, "createdAt"));
    }
}
