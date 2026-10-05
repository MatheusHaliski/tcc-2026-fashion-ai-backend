package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.assets.PieceReferenceCatalog;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.ImageProviderPorts;
import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.imaging.BrandRegions;
import br.com.fashionai.application.imaging.PhotoAcceptance;
import br.com.fashionai.application.imaging.Silhouette;
import br.com.fashionai.application.imaging.SubtypeReferences;
import br.com.fashionai.application.ports.JobQueuePort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.ModerationQueueItem;
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.ProcessingJobLog;
import br.com.fashionai.domain.model.QualityScore;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ItemCondition;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.enums.ModerationQueueStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;
import br.com.fashionai.domain.model.enums.PipelineJobStatus;
import br.com.fashionai.domain.model.enums.PipelineJobType;
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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import br.com.fashionai.application.events.DomainEvents;
import org.springframework.context.ApplicationEventPublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
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
    private static final Logger log = LoggerFactory.getLogger(WardrobeService.class);
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
                          List<Map<String, Object>> photoChecks) {
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
        ImageOps.requireAcceptedImage(bytes);
        String chosen = category == null || category.isBlank() ? null : category.trim();
        if (chosen != null && !Taxonomy.isValidCategory(chosen)) {
            throw ApiException.badRequest("CATEGORIA_INVALIDA", Msg.t("taxonomy.categoria_invalida"), Map.of("category", Msg.t("taxonomy.categoria_invalida")));
        }
        User owner = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        AiOutcome<FlatLayPipeline.Result> pipeline = ai.execute(user.id(), AiCapability.FLAT_LAY_STANDARDIZER,
                List.of(Msg.t("wardrobe.foto_enviada_kb", bytes.length / 1024)), null, null,
                List.of(flatLayStep(bytes)), () -> flatLay.run(bytes, false));
        FlatLayPipeline.Result r = pipeline.value();

        // Critérios de aceite (locais, antes de qualquer IA paga): fundo separado, peça inteira, enquadramento,
        // alinhamento, câmera a 90° (simetria), uma peça por foto, nitidez e luz
        PhotoAcceptance.Report acceptance = PhotoAcceptance.evaluate(chosen, r.originalWidth(), r.originalHeight(), r.cutout(),
                r.truncated(), r.quality());
        if (!acceptance.accepted() && !lenient) {
            throw rejection(acceptance.checks());
        }
        ImageOps.Cutout cutout = r.cutout();
        // a peça endireitada e justa na caixa (alta resolução): base da comparação com as referências e das zonas da marca
        BufferedImage piece = r.studioSource();
        SubtypeReferences refs = pieceReferences.get();
        Silhouette.Descriptor shape = Silhouette.of(piece);
        List<SubtypeReferences.Match> ranking = refs.rank(chosen, shape);
        LocalVision.PieceGuess localGuess = localGuess(LocalVision.analyzePiece(cutout), chosen, ranking);
        String zonesCategory = chosen != null ? chosen : localGuess.category();
        List<BrandRegions.Zone> zones = BrandRegions.zones(piece, zonesCategory);

        // Moderação (#2) — nunca aprova por omissão.
        LocalVision.ModerationVerdict localVerdict = LocalVision.moderate(r.original(), cutout);
        AiOutcome<LocalVision.ModerationVerdict> moderation = ai.text(new AiEngine.TextCall<>(user.id(),
                AiCapability.CONTENT_MODERATOR, MODERATION_SYSTEM, Msg.t("wardrobe.classifique_a_imagem_anexada"),
                List.of(new AiRequest.AiImage(ImageOps.jpeg(ImageOps.scaleToFit(r.original(), 768, 768), 0.85f), "image/jpeg")),
                400, List.of(Msg.t("wardrobe.foto_da_peca_reduzida_a")), this::parseModeration, () -> localVerdict, null));
        LocalVision.ModerationVerdict verdict = moderation.value();

        // Detecção (#1): peça inteira + folha de referências do tipo escolhido + zonas da marca ampliadas
        byte[] sheet = chosen == null ? null : refs.contactSheet(chosen);
        List<AiRequest.AiImage> images = new ArrayList<>();
        images.add(new AiRequest.AiImage(ImageOps.png(ImageOps.composeCentered(piece, 768, 0.06, java.awt.Color.WHITE, false)), "image/png"));
        if (sheet != null) {
            images.add(new AiRequest.AiImage(sheet, "image/png"));
        }
        for (BrandRegions.Zone z : zones) {
            images.add(new AiRequest.AiImage(ImageOps.jpeg(BrandRegions.crop(piece, z), 0.92f), "image/jpeg"));
        }
        AiOutcome<LocalVision.PieceGuess> analysis = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.PIECE_ANALYZER,
                ANALYZER_SYSTEM, analyzerPrompt(chosen, sheet == null ? List.of() : refs.sheetLegend(chosen), zones, ranking),
                images, 1200, List.of(Msg.t("wardrobe.foto_padronizada_da_peca"), Msg.t("wardrobe.vocabulario_da_taxonomia_v3_7")),
                text -> parseAnalysis(text, chosen), () -> localGuess, null));
        LocalVision.PieceGuess guess = analysis.value();
        boolean aiRan = analysis.value() != localGuess;

        // Critérios que dependem da análise: tipo/formato identificável, peça inteira e de frente aos olhos da IA, conteúdo
        List<PhotoAcceptance.Check> checks = new ArrayList<>(acceptance.checks());
        LocalVision.Insights seen = guess.insights();
        String categoryLabel = Msg.t("taxonomy." + (chosen != null ? chosen : guess.category() == null ? "upper_piece" : guess.category()));
        String detectedLabel = seen.detectedCategory() == null ? null : Msg.t("taxonomy." + seen.detectedCategory());
        double categoryConfidence = guess.confidence() == null ? 0 : guess.confidence().getOrDefault("category", 0.0);
        // categoria que a foto parece ter, quando difere da escolhida: a tela oferece "Usar <categoria detectada>"
        String detectedCode = seen.detectedCategory() != null && Taxonomy.isValidCategory(seen.detectedCategory())
                && !seen.detectedCategory().equals(chosen) ? seen.detectedCategory() : null;
        if (chosen != null) {
            // sem referências carregadas (ambiente sem /public) a silhueta não tem com o que comparar: não reprova por ela
            Map<String, Double> bestBy = refs.isEmpty() ? Map.of() : refs.bestByCategory(shape);
            Map.Entry<String, Double> other = bestBy.entrySet().stream().filter(e -> !e.getKey().equals(chosen))
                    .max(Map.Entry.comparingByValue()).orElse(null);
            double bestLocal = bestBy.getOrDefault(chosen, 1.0);
            if (detectedCode == null && other != null && other.getValue() - bestLocal >= PhotoAcceptance.LOCAL_OTHER_MARGIN) {
                detectedCode = other.getKey();
            }
            String seenLabel = detectedLabel != null ? detectedLabel : other == null ? null : Msg.t("taxonomy." + other.getKey());
            checks.add(PhotoAcceptance.shapeCheck(categoryLabel, aiRan ? seen.matchesCategory() : null, categoryConfidence, seenLabel,
                    bestLocal, other == null ? 0 : other.getValue()));
        }
        if (aiRan) {
            checks.addAll(PhotoAcceptance.aiPhotoChecks(seen.fullyVisible(), seen.viewAngle(), seen.singlePiece(), seen.photoConfidence(),
                    zonesCategory));
        }
        if (verdict.status() == ModerationStatus.REJECTED_NOT_CLOTHING || verdict.status() == ModerationStatus.REJECTED_POLICY) {
            checks.add(new PhotoAcceptance.Check("conteudo", false, verdict.confidence(), 0.85,
                    verdict.status() == ModerationStatus.REJECTED_POLICY ? Msg.t("wardrobe.a_foto_viola_a_politica") : Msg.t("photoAcceptance.nao_roupa")));
        }
        List<PhotoAcceptance.Check> failed = checks.stream().filter(c -> !c.ok()).toList();
        // modo lenient: só conteúdo (política / não é roupa) continua recusado; o resto vira orientação
        if (!failed.isEmpty() && (!lenient || failed.stream().anyMatch(c -> "conteudo".equals(c.id())))) {
            throw rejection(checks, failed.stream().anyMatch(c -> "formato".equals(c.id())) ? detectedCode : null);
        }

        // Marca: logo apontado pela IA na imagem 1 (0–1000) → caixa relativa à peça; sem IA, o detector local diz onde está
        double[] logoRel = logoRelative(guess.logoBox(), piece.getWidth(), piece.getHeight());
        String logoSource = logoRel == null ? null : "ia";
        if (logoRel == null) {
            logoRel = BrandRegions.detectLogo(piece);
            logoSource = logoRel == null ? null : "local";
        }
        // Marca não lida pela IA (ou IA fora do ar): o servidor lê o texto do logo (OCR local) na peça e nas zonas
        br.com.fashionai.application.imaging.BrandReader.Found ocr = null;
        if ((guess.brand() == null || guess.brand().isBlank()) && brandReader != null && brandReader.available()) {
            List<BrandRegions.Zone> where = new ArrayList<>(zones);
            if (logoRel != null) {
                where.add(0, new BrandRegions.Zone("logo", logoRel));
            }
            ocr = brandReader.find(piece, where).orElse(null);
            if (ocr != null && ocr.confirmed()) {
                guess = guess.withBrand(ocr.brand());
                if (logoRel == null) {
                    logoRel = ocr.box();
                    logoSource = "ocr";
                }
            }
        }
        Map<String, Object> logo = logoRel == null ? null : Map.of("box", java.util.Arrays.stream(logoRel).boxed().toList(), "source", logoSource);
        Map<String, Object> brandSearch = brandSearch(zones, guess, logoRel, logoSource);
        if (ocr != null) {
            applyOcr(brandSearch, ocr, zones);
        }
        List<Map<String, Object>> candidates = candidates(seen.ranking().isEmpty() ? ranking : seen.ranking(), chosen != null ? chosen : guess.category());
        Prefill prefill = prefill(guess.withInsights(seen.withRanking(seen.ranking().isEmpty() ? ranking : seen.ranking())), logo, candidates,
                brandSearch, checks.stream().map(c -> Map.<String, Object>of("id", c.id(), "value", c.value(), "threshold", c.threshold())).toList());

        PipelineJob job = new PipelineJob();
        job.setUser(owner);
        job.setType(PipelineJobType.FLAT_LAY_STANDARDIZATION);
        job.setStatus(PipelineJobStatus.COMPLETED);
        job.setTargetType("PIECE_DRAFT");
        job.setProvider(pipeline.provider());
        job.setQueuedAt(Instant.now());
        job.setStartedAt(Instant.now());
        jobs.save(job);
        String base = "users/" + owner.getId() + "/drafts/" + job.getId() + "/";
        byte[] originalClean = r.mimeType().equals("image/png") ? ImageOps.png(r.original()) : ImageOps.jpeg(r.original(), 0.95f);
        MediaStoragePort.StoredObject original = media.put(base + "original." + (r.mimeType().equals("image/png") ? "png" : "jpg"),
                originalClean, r.mimeType().equals("image/png") ? "image/png" : "image/jpeg");
        MediaStoragePort.StoredObject processed = media.put(base + "processed.png", r.processedPng(), "image/png");
        MediaStoragePort.StoredObject white = media.put(base + "flatlay.jpg", r.processedWhiteJpeg(), "image/jpeg");
        MediaStoragePort.StoredObject thumb = media.put(base + "thumb.png", r.thumbnailPng(), "image/png");

        // RF4 · Estúdio: foto de produto a partir da fonte em alta resolução, com o tipo da peça (manequim invisível),
        // os lados que a foto cortou (sangria) e o logo (foco) — nunca trava o cadastro (RNF8)
        String studioSourceUrl = null;
        Map<String, Object> studioInfo = null;
        if (r.backgroundRemoved()) {
            studioSourceUrl = media.put(base + "studio-source.png", ImageOps.png(r.studioSource()), "image/png").url();
            studioInfo = studioShot(user.id(), r.studioSource(), "auto", base, new br.com.fashionai.application.imaging.StudioPipeline.Hints(
                    studioKind(prefill.category(), prefill.subcategory()), r.truncated(), logoRel, logoSource,
                    br.com.fashionai.application.imaging.FeedFraming.template(prefill.category(), prefill.subcategory(), null)));
        }

        Map<String, Object> quality = new LinkedHashMap<>();
        quality.put("metrics", r.quality().metrics());
        quality.put("overall", r.quality().overall());
        quality.put("accepted", r.quality().accepted());
        quality.put("threshold", br.com.fashionai.application.imaging.QualityMetrics.ACCEPTANCE_THRESHOLD);
        quality.put("issues", r.quality().issues());
        quality.put("recommendations", r.quality().recommendations());
        quality.put("acceptance", new PhotoAcceptance.Report(failed.isEmpty(), checks).toMap());
        Map<String, Object> mod = new LinkedHashMap<>();
        mod.put("status", verdict.status().name());
        mod.put("confidence", verdict.confidence());
        mod.put("reasons", verdict.reasons());
        mod.put("humanReview", verdict.needsHumanReview());
        mod.put("provider", moderation.provider());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("processedUrl", processed.url());
        result.put("flatLayUrl", white.url());
        result.put("thumbnailUrl", thumb.url());
        result.put("originalUrl", original.url());
        result.put("originalKey", original.key());
        result.put("mime", r.mimeType());
        result.put("width", r.originalWidth());
        result.put("height", r.originalHeight());
        result.put("bytes", bytes.length);
        result.put("hash", Hashing.sha256(bytes));
        result.put("backgroundRemoved", r.backgroundRemoved());
        if (r.cutout().warning() != null) {
            result.put("backgroundWarning", r.cutout().warning());
        }
        result.put("flatLayMetadata", r.metadata());
        result.put("quality", quality);
        result.put("moderation", mod);
        result.put("prefill", prefill);
        result.put("aiInferences", List.of(pipeline.inferenceId(), moderation.inferenceId(), analysis.inferenceId()));
        if (studioInfo != null) {
            result.put("studio", studioInfo);
        }
        if (studioSourceUrl != null) {
            result.put("studioSourceUrl", studioSourceUrl);
        }
        job.setResultJson(Json.write(result));
        job.setStagesJson(Json.write(r.stages()));
        job.setQualityScore(BigDecimal.valueOf(r.quality().overall()));
        job.setTotalCostUsd(r.totalCostUsd().add(moderation.costUsd()).add(analysis.costUsd()));
        job.setTotalTimeMs((int) r.totalMs());
        job.setFallbackUsed(r.fallbackUsed() || analysis.fallbackUsed());
        job.setOutputUrl(processed.url());
        job.setFinishedAt(Instant.now());
        String message = analysis.userMessage() != null ? analysis.userMessage() : pipeline.userMessage();
        Draft draftOut = new Draft(job.getId(), processed.url(), white.url(), thumb.url(), original.url(), prefill, quality, mod,
                r.stages(), job.getTotalCostUsd(), r.totalMs(), r.backgroundRemoved(), !r.backgroundRemoved(),
                analysis.explanation(), message, analysis.quota(), studioInfo, r.cutout().warning(), null);
        double rotation = r.metadata().get("perspective_correction_degrees") instanceof Number n ? n.doubleValue() : 0;
        return new CaptureAnalysis(draftOut, r.studioSource(), r.truncated(), logoRel, logoSource, guess, ocr, failed,
                List.copyOf(checks), rotation, r.cutout().confidence(), r.originalWidth(), r.originalHeight(), aiRan);
    }

    /** Recusa com a primeira orientação como mensagem principal e todos os critérios no detalhe. */
    static PhotoRejectedException rejection(List<PhotoAcceptance.Check> checks) {
        return rejection(checks, null);
    }

    static PhotoRejectedException rejection(List<PhotoAcceptance.Check> checks, String detectedCategory) {
        String first = checks.stream().filter(c -> !c.ok()).map(PhotoAcceptance.Check::message).findFirst().orElse("");
        return new PhotoRejectedException(Msg.t("photoAcceptance.recusada", first), checks, detectedCategory);
    }

    /**
     * Palpite local (sem IA): cor pela paleta; tipo = o escolhido pela pessoa; subtipo = a referência mais parecida
     * (similaridade de silhueta), com confiança pela similaridade e pela folga para o segundo colocado.
     */
    static LocalVision.PieceGuess localGuess(LocalVision.PieceGuess base, String chosen, List<SubtypeReferences.Match> ranking) {
        String category = chosen != null ? chosen : base.category();
        String sub = base.subcategory();
        double subConf = base.confidence().getOrDefault("subcategory", 0.0);
        List<SubtypeReferences.Match> inCategory = ranking.stream()
                .filter(m -> category != null && Taxonomy.SUBCATEGORIES.getOrDefault(category, List.of()).contains(m.subcategory())).toList();
        if (!inCategory.isEmpty()) {
            sub = inCategory.get(0).subcategory();
            double gap = inCategory.size() > 1 ? inCategory.get(0).score() - inCategory.get(1).score() : 0.1;
            subConf = Math.min(0.9, Math.max(0, (inCategory.get(0).score() - 0.6) * 1.2 + gap * 3));
        } else if (chosen != null && (sub == null || !Taxonomy.SUBCATEGORIES.get(chosen).contains(sub))) {
            sub = Taxonomy.SUBCATEGORIES.get(chosen).get(0);
            subConf = 0.2;
        }
        Map<String, Double> conf = new LinkedHashMap<>(base.confidence());
        conf.put("category", chosen != null ? 1.0 : conf.getOrDefault("category", 0.0));
        conf.put("subcategory", Math.round(subConf * 100) / 100.0);
        double overall = Math.round((conf.get("category") + conf.get("subcategory") + conf.getOrDefault("color", 0.0)) / 3 * 100) / 100.0;
        return new LocalVision.PieceGuess(category, sub, base.color(), base.material(), base.brand(), base.sex(), conf, overall,
                base.palette(), null, LocalVision.Insights.NONE.withRanking(inCategory.isEmpty() ? ranking : inCategory));
    }

    /** Subtipos candidatos para a tela ({code, score}), só da categoria, os 3 primeiros. */
    static List<Map<String, Object>> candidates(List<SubtypeReferences.Match> ranking, String category) {
        return ranking.stream()
                .filter(m -> category == null || Taxonomy.SUBCATEGORIES.getOrDefault(category, List.of()).contains(m.subcategory()))
                .limit(3).map(m -> Map.<String, Object>of("code", m.subcategory(), "score", m.score())).toList();
    }

    /** Resumo da busca da marca: as zonas olhadas, onde achou (zona da IA ou a zona do logo) e quem achou. */
    static Map<String, Object> brandSearch(List<BrandRegions.Zone> zones, LocalVision.PieceGuess guess, double[] logoRel, String logoSource) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("zones", zones.stream().map(BrandRegions.Zone::id).toList());
        String brand = guess.brand() == null || guess.brand().isBlank() ? null : guess.brand();
        String zone = guess.insights().brandZone();
        if (zone == null || zones.stream().noneMatch(z -> z.id().equals(guess.insights().brandZone()))) {
            zone = BrandRegions.zoneOf(zones, logoRel);
        }
        out.put("brand", brand);
        out.put("foundIn", brand != null || logoRel != null ? zone : null);
        out.put("logoSource", logoSource);
        out.put("evidence", guess.insights().brandEvidence());
        return out;
    }

    /** Resultado do OCR local no resumo da busca da marca: onde leu, o texto visto e se é marca do catálogo. */
    static void applyOcr(Map<String, Object> brandSearch, br.com.fashionai.application.imaging.BrandReader.Found ocr, List<BrandRegions.Zone> zones) {
        String zone = zones.stream().anyMatch(z -> z.id().equals(ocr.region())) ? ocr.region() : BrandRegions.zoneOf(zones, ocr.box());
        if (ocr.confirmed()) {
            brandSearch.put("brand", ocr.brand());
            brandSearch.put("foundIn", zone != null ? zone : ocr.region());
            brandSearch.put("logoSource", "ocr");
        } else {
            brandSearch.put("suggestion", ocr.brand());
            if (brandSearch.get("foundIn") == null) {
                brandSearch.put("foundIn", zone != null ? zone : ocr.region());
            }
        }
        brandSearch.put("evidence", ocr.evidence());
        brandSearch.put("certainty", ocr.confirmed() ? "confirmada" : "possivel");
    }

    static final String BRAND_TILES_SYSTEM = """
            Você lê a MARCA de uma peça de roupa. Cada imagem é um recorte ampliado da mesma peça (a legenda diz de onde).
            Procure o nome da marca escrito (logo, etiqueta, bordado, estampa) em qualquer recorte. Responda SOMENTE com JSON:
            {"brand": "nome exato da marca ou null", "image": número da imagem onde leu ou null, "text": "texto que você leu",
             "confidence": 0-1}. Não invente: sem nome legível, brand = null.""";

    /**
     * RF4 — nova tentativa de ler a marca de um rascunho: a peça é dividida numa grade de sub-retângulos sobrepostos (e a
     * região do logo em quatro), cada um ampliado. Primeiro o OCR local lê todos; se não achar marca do catálogo, a IA
     * de visão recebe os recortes. A cada nova tentativa a grade fica mais fina (3×3 → 4×4 → 5×5).
     */
    @Transactional
    public Map<String, Object> retryBrand(CurrentUser user, UUID draftId, int grid) {
        PipelineJob draft = jobs.findById(draftId).orElseThrow(() -> ApiException.notFound("Rascunho"));
        if (!draft.getUser().getId().equals(user.id())) {
            throw guard.deny(user, "draft:" + draftId, Msg.t("wardrobe.rascunho_de_outro_usuario"));
        }
        Map<String, Object> r = new LinkedHashMap<>(Json.map(draft.getResultJson()));
        byte[] png = r.get("studioSourceUrl") == null ? null : media.read(String.valueOf(r.get("studioSourceUrl"))).orElse(null);
        if (png == null) {
            png = media.read((String) r.get("processedUrl")).orElseThrow(() -> ApiException.notFound(Msg.t("wardrobe.recorte_do_rascunho")));
        }
        BufferedImage piece = ImageOps.toArgb(ImageOps.decode(png));
        Map<String, Object> pf = r.get("prefill") instanceof Map<?, ?> m ? new LinkedHashMap<>(Json.map(Json.write(m))) : new LinkedHashMap<>();
        double[] logoRel = boxOf(pf.get("logo"));
        int g = Math.max(3, Math.min(5, grid));
        List<BrandRegions.Zone> tiles = BrandRegions.tiles(piece, logoRel, g);
        br.com.fashionai.application.imaging.BrandReader.Found found = brandReader == null ? null : brandReader.find(piece, tiles).orElse(null);
        String source = found == null ? null : "ocr";
        if (found == null || !found.confirmed()) {
            List<BrandRegions.Zone> sent = tiles.stream().filter(z -> !z.id().startsWith("logo_q")).limit(12).toList();
            List<AiRequest.AiImage> images = sent.stream()
                    .map(z -> new AiRequest.AiImage(ImageOps.jpeg(BrandRegions.crop(piece, z, 640), 0.9f), "image/jpeg")).toList();
            StringBuilder legend = new StringBuilder(Msg.t("wardrobe.recortes_da_peca_legenda"));
            for (int i = 0; i < sent.size(); i++) {
                legend.append("\n").append(i + 1).append(": ").append(sent.get(i).id());
            }
            AiOutcome<Map<String, Object>> out = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.PIECE_ANALYZER, BRAND_TILES_SYSTEM,
                    legend.toString(), images, 300, List.of(Msg.t("wardrobe.recortes_da_peca")), WardrobeService::parseBrandTiles, () -> null, null));
            Map<String, Object> v = out.value();
            if (v != null && v.get("brand") instanceof String b) {
                int idx = v.get("image") instanceof Number n ? n.intValue() - 1 : -1;
                BrandRegions.Zone z = idx >= 0 && idx < sent.size() ? sent.get(idx) : sent.get(0);
                double conf = v.get("confidence") instanceof Number n ? n.doubleValue() : 0.7;
                found = new br.com.fashionai.application.imaging.BrandReader.Found(b, z.id(), String.valueOf(v.getOrDefault("text", b)), conf, true, z.box());
                source = "ia";
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("grid", g);
        result.put("regions", tiles.size());
        result.put("source", source);
        result.put("ocrAvailable", brandReader != null && brandReader.available());
        if (found != null) {
            result.put("brand", found.brand());
            result.put("region", found.region());
            result.put("evidence", found.evidence());
            result.put("certainty", found.confirmed() ? "confirmada" : "possivel");
            result.put("box", java.util.Arrays.stream(found.box()).boxed().toList());
            BrandRegions.Zone at = new BrandRegions.Zone(found.region(), found.box());
            MediaStoragePort.StoredObject crop = media.put("users/" + user.id() + "/drafts/" + draftId + "/marca-" + System.currentTimeMillis() + ".jpg",
                    ImageOps.jpeg(BrandRegions.crop(piece, at, 640), 0.9f), "image/jpeg");
            result.put("regionUrl", crop.url());
            Map<String, Object> bs = pf.get("brandSearch") instanceof Map<?, ?> m ? new LinkedHashMap<>(Json.map(Json.write(m))) : new LinkedHashMap<>();
            if (found.confirmed()) {
                pf.put("brand", found.brand());
                bs.put("brand", found.brand());
                bs.remove("suggestion");
            } else {
                bs.put("suggestion", found.brand());
            }
            bs.put("foundIn", found.region());
            bs.put("evidence", found.evidence());
            bs.put("certainty", result.get("certainty"));
            bs.put("logoSource", source);
            pf.put("brandSearch", bs);
            if (logoRel == null) {
                pf.put("logo", Map.of("box", result.get("box"), "source", source));
            }
            r.put("prefill", pf);
            draft.setResultJson(Json.write(r));
        }
        return result;
    }

    static double[] boxOf(Object logo) {
        if (logo instanceof Map<?, ?> m && m.get("box") instanceof List<?> l && l.size() == 4) {
            double[] b = new double[4];
            for (int i = 0; i < 4; i++) {
                if (!(l.get(i) instanceof Number n)) {
                    return null;
                }
                b[i] = n.doubleValue();
            }
            return b;
        }
        return null;
    }

    /** Resposta da IA sobre os recortes → {brand, image, text, confidence}; marca vazia ou fraca = sem marca. */
    static Map<String, Object> parseBrandTiles(String text) {
        Map<String, Object> m = extractJson(text);
        if (m.isEmpty()) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>(m);
        String b = brandName(str(m.get("brand")));
        double conf = m.get("confidence") instanceof Number n ? n.doubleValue() : 0.7;
        out.put("brand", b != null && conf >= 0.5 ? b : null);
        return out;
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

    static final String ANALYZER_SYSTEM = """
            Você é o Piece Analyzer do Fashion AI. Você recebe fotos de UMA peça (roupa, calçado ou acessório) e responde
            SOMENTE com JSON. A mensagem diz quais imagens vieram e em que ordem:
            - Imagem 1: a peça inteira, recortada do fundo e endireitada.
            - Folha de referências (quando vier): grade numerada com a imagem de referência de cada subtipo do tipo escolhido
              pela pessoa. Compare o FORMATO da peça (silhueta, comprimento, gola, mangas, cano, abertura, bolsos) com cada
              referência e escolha o subtipo mais parecido. Ignore cores, estampas e o selo "FAI" das referências: elas são
              só modelos de formato.
            - Zonas de marca (quando vierem): recortes ampliados dos lugares onde a marca costuma estar. Peça de cima:
              · fundo da gola (etiqueta interna, vista pelo decote);
              · peito esquerdo de quem veste (fica à DIREITA da foto);
              · peito direito de quem veste (fica à ESQUERDA da foto);
              · centro do peito.
              Leia logotipos, bordados, estampas e etiquetas. Só informe a marca se conseguir ler o nome ou reconhecer o
              logotipo com segurança; nunca invente.
            JSON:
            {"name": nome curto da peça em português (ex.: "Camiseta branca lisa"),
             "matchesCategory": boolean (a foto é mesmo do tipo escolhido pela pessoa?),
             "detectedCategory": um de [upper_piece, lower_piece, shoes_piece, accessory_piece, full_body_piece],
             "subcategory": código da lista de subtipos, "subcategoryRanking": [{"code": código, "similarity": 0-1}] (os 3 mais parecidos),
             "color": código da paleta, "material": um de [COTTON, POLYESTER, WOOL, SILK, LEATHER, SYNTHETIC, BLEND],
             "sex": um de [MASCULINO, FEMININO, UNISSEX], "occasion": até 2 códigos da lista de ocasiões,
             "style": até 2 códigos da lista de estilos,
             "brand": nome da marca ou null, "brandZone": id da zona em que a marca foi lida (ou "outra") ou null,
             "brandEvidence": o que foi lido ou visto (ex.: "texto NIKE bordado no peito") ou null,
             "photo": {"fullyVisible": a peça aparece inteira, sem partes cortadas pela borda da foto?,
                       "viewAngle": "frontal_90" (câmera a 90°, de frente/de cima) | "angulo" | "lateral" | "dobrada",
                       "singlePiece": há uma peça só (par de calçados conta como uma)?},
             "confidence": {"category": 0-1, "subcategory": 0-1, "color": 0-1, "material": 0-1, "brand": 0-1, "photo": 0-1},
             "logo": {"visible": boolean, "box": [x0, y0, x1, y1]} caixa do logotipo/etiqueta de marca NA IMAGEM 1, em
                     0–1000 relativos à imagem inteira, ou null. Frases, palavras decorativas e estampas gráficas
                     (ex.: "THE BEST PLAN" no peito) NÃO são logo: devolva null}
            Nunca descreva pessoas. Se não houver peça, devolva matchesCategory false e confidence 0 em tudo.""";

    /** Mensagem do analisador: tipo escolhido, vocabulário permitido e o que é cada imagem anexada (na ordem). */
    static String analyzerPrompt(String chosen, List<String> sheetLegend, List<BrandRegions.Zone> zones, List<SubtypeReferences.Match> ranking) {
        StringBuilder p = new StringBuilder();
        String category = chosen == null ? null : chosen;
        if (category != null) {
            p.append("Tipo escolhido pela pessoa: ").append(category).append(".\n");
            p.append("Subtipos possíveis desse tipo: ").append(String.join(", ", Taxonomy.SUBCATEGORIES.get(category))).append(".\n");
        } else {
            p.append("Tipo não informado: descubra pela foto. Subtipos por tipo: ").append(Taxonomy.SUBCATEGORIES).append(".\n");
        }
        p.append("Ocasiões permitidas: ").append(String.join(", ", Taxonomy.allowedOccasions(category))).append(".\n");
        p.append("Estilos: ").append(String.join(", ", Taxonomy.STYLES)).append(".\n");
        p.append("Cores (códigos): ").append(String.join(", ", Taxonomy.COLORS.keySet())).append(".\n");
        int n = 1;
        p.append("Imagens anexadas: ").append(n++).append(" = peça inteira");
        if (!sheetLegend.isEmpty()) {
            p.append("; ").append(n++).append(" = folha de referências (").append(String.join(", ", sheetLegend)).append(")");
        }
        for (BrandRegions.Zone z : zones) {
            p.append("; ").append(n++).append(" = zona de marca \"").append(z.id()).append("\"");
        }
        p.append(".\n");
        if (!ranking.isEmpty()) {
            p.append("Similaridade de silhueta medida localmente (0–1, só uma pista; decida pela comparação visual): ")
                    .append(String.join(", ", ranking.stream().limit(5).map(m -> m.subcategory() + " " + m.score()).toList())).append(".\n");
        }
        p.append("Analise e responda só com o JSON.");
        return p.toString();
    }

    static final String MODERATION_SYSTEM = """
            Você é o Content Moderator do Fashion AI. Avalie a imagem e responda SOMENTE com JSON:
            {"isClothing": boolean, "safe": boolean, "categories": [strings de violação, ex.: nudity, violence, hate, minor],
             "confidence": 0-1}. Em dúvida, safe=false.""";

    static LocalVision.PieceGuess parseAnalysis(String text) {
        return parseAnalysis(text, null);
    }

    /**
     * Resposta do analisador → palpite validado pela taxonomia: nada fora do vocabulário entra. Com o tipo escolhido pela
     * pessoa, a categoria é a dela e o subtipo só vale se for desse tipo (senão, o primeiro do ranking da IA que for).
     */
    static LocalVision.PieceGuess parseAnalysis(String text, String chosen) {
        Map<String, Object> m = extractJson(text);
        if (m.isEmpty()) {
            return null;
        }
        String category = str(m.get("category"));
        String sub = str(m.get("subcategory"));
        String detected = Taxonomy.isValidCategory(str(m.get("detectedCategory"))) ? str(m.get("detectedCategory"))
                : Taxonomy.isValidCategory(category) ? category : null;
        List<SubtypeReferences.Match> ranking = new ArrayList<>();
        if (m.get("subcategoryRanking") instanceof List<?> rl) {
            for (Object o : rl) {
                if (o instanceof Map<?, ?> rm && str(rm.get("code")) != null && Taxonomy.categoryOf(str(rm.get("code"))) != null) {
                    double sim = rm.get("similarity") instanceof Number n ? Math.max(0, Math.min(1, n.doubleValue())) : 0;
                    ranking.add(new SubtypeReferences.Match(str(rm.get("code")), Math.round(sim * 1000) / 1000.0));
                }
            }
        }
        if (chosen != null) {
            category = chosen;
            List<String> allowed = Taxonomy.SUBCATEGORIES.get(chosen);
            ranking.removeIf(x -> !allowed.contains(x.subcategory()));
            if (sub == null || !allowed.contains(sub)) {
                sub = ranking.isEmpty() ? null : ranking.get(0).subcategory();
            }
        } else if (sub != null && Taxonomy.categoryOf(sub) != null) {
            category = Taxonomy.categoryOf(sub);
        } else if (!Taxonomy.isValidCategory(category)) {
            category = null;
            sub = null;
        } else {
            sub = null;
        }
        // campo ausente ou null na resposta não pode derrubar o parser: List.of(...).contains(null) lança NPE, o motor
        // tomava a resposta inteira por falha do provedor e caía no motor local (que não lê marca)
        String color = oneOf(str(m.get("color")), Taxonomy.COLORS.keySet());
        String material = oneOf(str(m.get("material")), Taxonomy.MATERIALS);
        String sex = oneOf(str(m.get("sex")), Taxonomy.SEXES);
        Map<String, Double> conf = new LinkedHashMap<>();
        Object c = m.get("confidence");
        if (c instanceof Map<?, ?> cm) {
            cm.forEach((k, v) -> conf.put(String.valueOf(k), v instanceof Number n ? n.doubleValue() : 0.0));
        }
        double photoConf = conf.getOrDefault("photo", 0.0);
        conf.remove("photo");
        double overall = conf.values().stream().mapToDouble(Double::doubleValue).average().orElse(0.5);
        Map<?, ?> photo = m.get("photo") instanceof Map<?, ?> pm ? pm : Map.of();
        String name = str(m.get("name"));
        LocalVision.Insights insights = new LocalVision.Insights(
                name == null || name.isBlank() ? null : InputSanitizer.clean(name, 80),
                Taxonomy.keepAllowed(strings(m.get("occasion")), Taxonomy.allowedOccasions(category), 2),
                Taxonomy.keepAllowed(strings(m.get("style")), Taxonomy.STYLES, 2),
                str(m.get("brandZone")), str(m.get("brandEvidence")),
                m.get("matchesCategory") instanceof Boolean b ? b : null, detected,
                photo.get("fullyVisible") instanceof Boolean b ? b : null, str(photo.get("viewAngle")),
                photo.get("singlePiece") instanceof Boolean b ? b : null, photoConf, ranking);
        return new LocalVision.PieceGuess(category, sub, color, material, brandName(str(m.get("brand"))), sex, conf,
                Math.round(overall * 100) / 100.0, List.of(), logoBox(m.get("logo")), insights);
    }

    /** O valor, se for um dos permitidos (null-safe). */
    static String oneOf(String value, java.util.Collection<String> allowed) {
        return value != null && allowed.contains(value) ? value : null;
    }

    /** Nome de marca da IA: "null", "none", "sem marca" e afins não são marca; texto limpo e curto. */
    static String brandName(String raw) {
        if (raw == null) {
            return null;
        }
        String b = raw.trim();
        if (b.isEmpty() || b.length() > 60 || Set.of("null", "none", "n/a", "desconhecida", "unknown", "nenhuma", "generic", "genérica")
                .contains(b.toLowerCase(Locale.ROOT)) || isNoBrandPlaceholder(b)) {
            return null;
        }
        return InputSanitizer.clean(b, 60);
    }

    static List<String> strings(Object o) {
        if (o instanceof List<?> l) {
            return l.stream().filter(java.util.Objects::nonNull).map(String::valueOf).toList();
        }
        return o instanceof String s && !s.isBlank() ? List.of(s) : List.of();
    }

    /** Caixa do logo devolvida pela IA (0–1000), validada: 4 números em ordem, com área mínima. */
    static double[] logoBox(Object logo) {
        if (!(logo instanceof Map<?, ?> lm) || Boolean.FALSE.equals(lm.get("visible")) || !(lm.get("box") instanceof List<?> b) || b.size() != 4) {
            return null;
        }
        double[] v = new double[4];
        for (int i = 0; i < 4; i++) {
            if (!(b.get(i) instanceof Number n)) {
                return null;
            }
            v[i] = Math.max(0, Math.min(1000, n.doubleValue()));
        }
        return v[2] - v[0] >= 8 && v[3] - v[1] >= 8 ? v : null;
    }

    LocalVision.ModerationVerdict parseModeration(String text) {
        Map<String, Object> m = extractJson(text);
        if (m.isEmpty()) {
            return null;
        }
        boolean clothing = Boolean.TRUE.equals(m.get("isClothing"));
        boolean safe = Boolean.TRUE.equals(m.get("safe"));
        double conf = m.get("confidence") instanceof Number n ? n.doubleValue() : 0.5;
        List<String> cats = m.get("categories") instanceof List<?> l ? l.stream().map(String::valueOf).toList() : List.of();
        if (!safe) {
            return new LocalVision.ModerationVerdict(conf >= 0.85 ? ModerationStatus.REJECTED_POLICY : ModerationStatus.PENDING,
                    conf, cats.isEmpty() ? List.of(Msg.t("wardrobe.conteudo_possivelmente_improprio")) : cats, true);
        }
        if (!clothing) {
            return new LocalVision.ModerationVerdict(conf >= 0.85 ? ModerationStatus.REJECTED_NOT_CLOTHING : ModerationStatus.PENDING,
                    conf, List.of(Msg.t("wardrobe.a_imagem_nao_parece_ser")), true);
        }
        return new LocalVision.ModerationVerdict(conf >= 0.6 ? ModerationStatus.APPROVED : ModerationStatus.PENDING, conf,
                List.of(Msg.t("wardrobe.peca_de_roupa_sem_violacao")), conf < 0.6);
    }

    /**
     * RF4 — "Analisar peça" preenche TODOS os campos, sem exceção: o que a IA reconheceu com confiança entra como está;
     * o resto entra com o melhor palpite dela ou com o padrão da taxonomia (categoria pela subcategoria, ocasião e
     * estilo pelo tipo da peça, tamanho M, preço estimado pelo tipo). Nada fica em branco; a pessoa confere antes de salvar.
     * Ocasião e estilo saem sempre de dentro da taxonomia — o que a IA sugeriu (já filtrado) ou o padrão do tipo.
     */
    static Prefill prefill(LocalVision.PieceGuess g, Map<String, Object> logo) {
        return prefill(g, logo, List.of(), null, List.of());
    }

    static Prefill prefill(LocalVision.PieceGuess g, Map<String, Object> logo, List<Map<String, Object>> candidates,
                           Map<String, Object> brandSearch, List<Map<String, Object>> photoChecks) {
        Map<String, Double> c = g.confidence() == null ? Map.of() : g.confidence();
        boolean manual = g.overall() < LocalVision.PREFILL_CONFIDENCE;
        String sub = firstNonBlank(keep(g.subcategory(), c.get("subcategory")), g.subcategory());
        String category = firstNonBlank(keep(g.category(), c.get("category")), g.category(), sub == null ? null : Taxonomy.categoryOf(sub));
        if (category == null || !Taxonomy.SUBCATEGORIES.containsKey(category)) {
            category = "upper_piece";
        }
        if (sub == null || !Taxonomy.SUBCATEGORIES.get(category).contains(sub)) {
            sub = Taxonomy.SUBCATEGORIES.get(category).get(0);
        }
        String color = firstNonBlank(keep(g.color(), c.get("color")), g.color(),
                g.palette() == null || g.palette().isEmpty() ? null : g.palette().get(0), "black");
        if (!Taxonomy.COLORS.containsKey(color)) {
            color = "black";
        }
        String material = firstNonBlank(keep(g.material(), c.get("material")), g.material(), defaultMaterial(category, sub));
        String brand = firstNonBlank(keep(g.brand(), c.get("brand")), g.brand(), Msg.t("wardrobe.sem_marca"));
        String sex = g.sex() != null && Taxonomy.SEXES.contains(g.sex()) ? g.sex() : "UNISSEX";
        LocalVision.Insights seen = g.insights();
        String name = firstNonBlank(seen.name(), pieceName(sub, color));
        List<String> allowedOccasions = Taxonomy.allowedOccasions(category);
        List<String> occasion = Taxonomy.keepAllowed(seen.occasion(), allowedOccasions, 2);
        if (occasion.isEmpty()) {
            occasion = List.of(allowedOccasions.get(0));
        }
        List<String> style = Taxonomy.keepAllowed(seen.style(), Taxonomy.STYLES, 2);
        if (style.isEmpty()) {
            style = List.of(defaultStyle(sub));
        }
        return new Prefill(name, category, sub, color, material, brand, sex, occasion, style, List.of(), c, g.overall(), manual,
                manual ? Msg.t("wardrobe.a_ia_nao_reconheceu_a") : null, logo, "m", estimatedPrice(category, sub),
                candidates == null ? List.of() : candidates, brandSearch, photoChecks == null ? List.of() : photoChecks);
    }

    static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return null;
    }

    private static final Set<String> SPORTY = Set.of("running_shoes", "training_shoes", "basketball_shoes", "skate_shoes", "sweatpants",
            "jogger_pants", "leggings", "sweatshirt", "hoodie", "tank_top", "cap", "socks");
    private static final Set<String> CLASSIC = Set.of("blazer", "shirt", "tailored_pants", "chino_pants", "loafers", "oxford_shoes",
            "derby_shoes", "moccasins", "tie", "bow_tie", "coat", "watch", "belt", "dress", "heels", "flats");
    private static final Set<String> STREET = Set.of("cargo_pants", "denim_shorts", "high_top_sneakers", "casual_sneakers", "bermuda_shorts",
            "windbreaker", "beanie", "backpack", "parka");

    /**
     * Estilo mais provável pelo tipo da peça (quando a IA não o reconhece). Sempre um código de {@link Taxonomy#STYLES}:
     * "casual" é ocasião, não estilo — devolvê-lo aqui fazia o cadastro falhar com "Valor fora da taxonomia: casual".
     */
    static String defaultStyle(String sub) {
        if (SPORTY.contains(sub)) {
            return "sporty";
        }
        if (STREET.contains(sub)) {
            return "streetwear";
        }
        // "casual" é OCASIÃO, não estilo: a peça do dia a dia sem estilo marcado é "basic" (taxonomia §01, estilos)
        return CLASSIC.contains(sub) ? "classic" : "basic";
    }

    static String defaultMaterial(String category, String sub) {
        if ("shoes_piece".equals(category)) {
            return Set.of("sandals", "flip_flops", "espadrilles").contains(sub) ? "SYNTHETIC" : "LEATHER";
        }
        if ("accessory_piece".equals(category)) {
            return Set.of("scarf", "beanie", "socks", "gloves", "cap", "hat", "tie", "bow_tie").contains(sub) ? "COTTON" : "SYNTHETIC";
        }
        return Set.of("jeans", "denim_shorts").contains(sub) ? "COTTON" : Set.of("sweater", "cardigan", "coat").contains(sub) ? "WOOL"
                : Set.of("blazer", "tailored_pants", "parka", "windbreaker", "leggings").contains(sub) ? "POLYESTER" : "COTTON";
    }

    /** Preço estimado (R$) por tipo da peça — só um ponto de partida que a pessoa confere. */
    static BigDecimal estimatedPrice(String category, String sub) {
        Map<String, Integer> bySub = Map.ofEntries(Map.entry("t_shirt", 79), Map.entry("shirt", 149), Map.entry("blouse", 129),
                Map.entry("blazer", 349), Map.entry("jacket", 299), Map.entry("coat", 449), Map.entry("hoodie", 179), Map.entry("sweater", 199),
                Map.entry("jeans", 199), Map.entry("tailored_pants", 229), Map.entry("shorts", 99), Map.entry("skirt", 139),
                Map.entry("casual_sneakers", 299), Map.entry("running_shoes", 399), Map.entry("heels", 249), Map.entry("ankle_boots", 349),
                Map.entry("handbag", 249), Map.entry("backpack", 199), Map.entry("watch", 399), Map.entry("sunglasses", 199),
                Map.entry("dress", 249), Map.entry("jumpsuit", 229));
        Integer v = bySub.get(sub);
        if (v == null) {
            v = switch (category) {
                case "lower_piece" -> 169;
                case "shoes_piece" -> 249;
                case "accessory_piece" -> 99;
                case "full_body_piece" -> 229;
                default -> 129;
            };
        }
        return BigDecimal.valueOf(v);
    }

    private static String keep(String value, Double confidence) {
        return value != null && confidence != null && confidence >= LocalVision.PREFILL_CONFIDENCE ? value : null;
    }

    /** Nome da peça sem IA, no idioma de quem cadastra: "Camiseta azul", "Calça jeans azul-marinho". */
    static String pieceName(String sub, String color) {
        return label(sub) + " " + label(color).toLowerCase(Msg.locale());
    }

    /** Rótulo da taxonomia no idioma corrente (catálogo i18n); sem rótulo, o código legível. */
    static String label(String code) {
        String t = Msg.t("taxonomy." + code);
        return t.equals("taxonomy." + code) ? humanize(code) : t;
    }

    static String humanize(String code) {
        String s = code.replace('_', ' ');
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    // ================================================================== RF4 — salvar
    public record PieceForm(UUID draftId, boolean useDefaultImage, String name, String category, String subcategory,
                            String sex, UUID brandId, String brandName, String color, String material, String size,
                            String market, List<String> occasion, List<String> style, List<String> seals, BigDecimal price,
                            Visibility visibility, List<String> tags, String notes, ItemCondition condition,
                            LocalDate purchaseDate, String purchaseLocation, String sku, String careInstructions,
                            Boolean forSale, Boolean studio, String brandLogoUrl, String brandSource, String brandRef,
                            Map<String, Object> background, UUID captureSessionId) {
        /** Ocasião e estilo chegam da tela como listas de códigos: espaços, maiúsculas e repetidos não derrubam o cadastro. */
        public PieceForm {
            occasion = Taxonomy.normalizeTags(occasion);
            style = Taxonomy.normalizeTags(style);
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
     */
    public record CatalogPick(UUID productId, UUID variantId, String imageUrl) {
    }

    @Transactional
    public Views.PieceView createFromCatalog(CurrentUser user, PieceForm form, CatalogPick pick) {
        return createInternal(user, form, Objects.requireNonNull(pick));
    }

    private Views.PieceView createInternal(CurrentUser user, PieceForm form, CatalogPick pick) {
        guard.requireCanCreate(user);
        User owner = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        validate(form);
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
        apply(w, form, true);
        w.setVisibility(form.visibility() != null ? form.visibility() : AccountService.defaultVisibility(owner));
        if (draft == null && !form.useDefaultImage() && pick == null) {
            throw ApiException.badRequest("FOTO_OBRIGATORIA", Msg.t("wardrobe.envie_uma_foto_ou_escolha"));
        }
        if (draft == null && pick != null) {
            w.setCatalogProductId(pick.productId());
            w.setCatalogVariantId(pick.variantId());
            boolean hasImage = pick.imageUrl() != null && !pick.imageUrl().isBlank();
            String url = hasImage ? pick.imageUrl() : assets.defaultPieceImage(w.getCategory(), w.getSubcategory());
            w.setImageUrl(url);
            w.setThumbnailUrl(url);
            w.setOriginalImageUrl(null);
            w.setDefaultImage(!hasImage);
            w.setImageOrigin(hasImage ? br.com.fashionai.domain.model.enums.ImageOrigin.CATALOG
                    : br.com.fashionai.domain.model.enums.ImageOrigin.DEFAULT);
            w.setModerationStatus(ModerationStatus.APPROVED);
            w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
            pieces.save(w);
        } else if (draft == null) {
            // imagem padrão da peça (/public/assets_pecas) quando o usuário deixa a foto vazia.
            String url = assets.defaultPieceImage(w.getCategory(), w.getSubcategory());
            w.setImageUrl(url);
            w.setThumbnailUrl(url);
            w.setOriginalImageUrl(null);
            w.setDefaultImage(true);
            w.setModerationStatus(ModerationStatus.APPROVED);
            w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
            pieces.save(w);
            defaultStudio(w);                       // a imagem padrão também sai de estúdio: quadro cheio, foco no logo FAI
        } else {
            Map<String, Object> r = Json.map(draft.getResultJson());
            Map<?, ?> mod = (Map<?, ?>) r.getOrDefault("moderation", Map.of());
            Object modStatus = mod.get("status");
            ModerationStatus moderation = ModerationStatus.valueOf(modStatus == null ? "PENDING" : String.valueOf(modStatus));
            if (moderation == ModerationStatus.REJECTED_POLICY) {
                throw ApiException.badRequest("CONTEUDO_BLOQUEADO", Msg.t("wardrobe.a_foto_viola_a_politica"));
            }
            // recorte incerto que a pessoa conferiu e mandou ao estúdio mesmo assim ("usar mesmo assim") vale como recorte
            boolean forcedCut = r.get("studio") instanceof Map<?, ?> fs && Boolean.TRUE.equals(fs.get("forced"))
                    && !Boolean.FALSE.equals(form.studio());
            boolean bgRemoved = Boolean.TRUE.equals(r.get("backgroundRemoved")) || forcedCut;
            w.setImageUrl(bgRemoved ? (String) r.get("processedUrl") : (String) r.get("originalUrl"));
            w.setOriginalImageUrl((String) r.get("originalUrl"));
            w.setThumbnailUrl((String) r.get("thumbnailUrl"));
            if (r.get("studio") instanceof Map<?, ?> st && st.get("url") != null && !Boolean.FALSE.equals(form.studio())) {
                w.setStudioImageUrl(String.valueOf(st.get("url")));
                w.setStudioBackdrop(st.get("backdrop") == null ? null : String.valueOf(st.get("backdrop")));
                w.setStudioDetailUrl(st.get("detailUrl") == null ? null : String.valueOf(st.get("detailUrl")));
            }
            w.setDefaultImage(false);
            w.setAiGeneratedImage(Boolean.TRUE.equals(r.get("aiGenerated")));
            w.setImageHash((String) r.get("hash"));
            w.setImageMimetype((String) r.get("mime"));
            w.setImageFileSize(r.get("bytes") instanceof Number n ? n.longValue() : null);
            w.setModerationStatus(moderation);
            w.setModerationConfidence(mod.get("confidence") instanceof Number n ? BigDecimal.valueOf(n.doubleValue()) : null);
            w.setModerationReasonsJson(Json.write(mod.get("reasons")));
            w.setPhotoProcessingStatus(bgRemoved ? PhotoProcessingStatus.COMPLETED : PhotoProcessingStatus.PROCESSING);
            w.setPhotoQualityScoresJson(Json.write(r.get("quality")));
            Map<String, Object> flatMeta = new LinkedHashMap<>(r.get("flatLayMetadata") instanceof Map<?, ?> fm
                    ? Json.map(Json.write(fm)) : Map.of());
            // RF34 §5 — guarda a detecção da IA (valores + confiança) para o antifraude da Catalogação.
            if (r.get("prefill") instanceof Map<?, ?> pf) {
                flatMeta.put("detected", pf);
            }
            if (r.get("studioSourceUrl") != null) {
                flatMeta.put("studio_source_url", r.get("studioSourceUrl"));        // refazer o estúdio em alta depois
            }
            if (r.get("studio") instanceof Map<?, ?> st && !Boolean.FALSE.equals(form.studio())) {
                // a pessoa revisou a foto no cadastro e salvou: é a versão 1, aprovada
                Map<String, Object> info = new LinkedHashMap<>();
                st.forEach((k, v) -> info.put(String.valueOf(k), v));
                flatMeta.put("studio", studioSummary(info, 1, true));
            }
            w.setFlatLayMetadataJson(Json.write(flatMeta));
            w.setProcessingJobId(draft.getId());
            w.setProcessingTimeMs(draft.getTotalTimeMs());
            pieces.save(w);
            draft.setInputResourceId(w.getId());
            draft.setTargetType("PIECE");
            registerQuality(w, draft, r);
            registerPhotos(owner, w, r);
            if (moderation == ModerationStatus.PENDING) {
                ModerationQueueItem q = new ModerationQueueItem();
                q.setTargetType("PIECE");
                q.setTargetId(w.getId());
                q.setUserId(owner.getId());
                q.setContentExcerpt(w.getName());
                q.setCategoriesJson(Json.write(mod.get("reasons")));
                q.setConfidence(w.getModerationConfidence());
                q.setStatus(ModerationQueueStatus.PENDING_REVIEW);
                moderationQueue.save(q);
            }
            if (!bgRemoved) {
                // RF4.CA06 — salva com a original e enfileira reprocessamento.
                PipelineJob reprocess = new PipelineJob();
                reprocess.setUser(owner);
                reprocess.setType(PipelineJobType.FLAT_LAY_STANDARDIZATION);
                reprocess.setStatus(PipelineJobStatus.PENDING);
                reprocess.setTargetType("PIECE_REPROCESS");
                reprocess.setInputResourceId(w.getId());
                reprocess.setInputJson(Json.write(Map.of("originalKey", String.valueOf(r.get("originalKey")))));
                reprocess.setQueuedAt(Instant.now());
                jobs.save(reprocess);
                queue.enqueue("flatlay-reprocess", reprocess.getId());
            }
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

    private void registerQuality(WardrobeItem w, PipelineJob draft, Map<String, Object> r) {
        Map<?, ?> q = (Map<?, ?>) r.getOrDefault("quality", Map.of());
        QualityScore qs = new QualityScore();
        qs.setWardrobeItemId(w.getId());
        qs.setPipelineJobId(draft.getId());
        qs.setMetricsJson(Json.write(q.get("metrics")));
        qs.setOverall(q.get("overall") instanceof Number n ? BigDecimal.valueOf(n.doubleValue()) : BigDecimal.ZERO);
        qs.setAccepted(Boolean.TRUE.equals(q.get("accepted")));
        qs.setAcceptanceThreshold(BigDecimal.valueOf(br.com.fashionai.application.imaging.QualityMetrics.ACCEPTANCE_THRESHOLD));
        qs.setIssuesJson(Json.write(q.get("issues")));
        qs.setRecommendationsJson(Json.write(q.get("recommendations")));
        qualityScores.save(qs);
        ProcessingJobLog log = new ProcessingJobLog();   // id gerado pelo JPA (atribuir à mão vira merge e falha no Hibernate 6.6+)
        log.setPipelineJobId(draft.getId());
        log.setWardrobeItemId(w.getId());
        log.setUserId(w.getUser().getId());
        log.setJobType("FLAT_LAY_STANDARDIZATION");
        log.setStatus("COMPLETED");
        log.setTotalProcessingTimeMs(draft.getTotalTimeMs());
        log.setStageTimesJson(draft.getStagesJson());
        log.setFinalQualityScore(qs.getOverall());
        log.setTotalCostUsd(draft.getTotalCostUsd());
        log.setAccepted(qs.isAccepted());
        log.setFallbackUsed(draft.isFallbackUsed());
        log.setCreatedAt(draft.getQueuedAt() == null ? Instant.now() : draft.getQueuedAt());
        log.setCompletedAt(Instant.now());
        processingLogs.save(log);
    }

    private void registerPhotos(User owner, WardrobeItem w, Map<String, Object> r) {
        String originalUrl = (String) r.get("originalUrl");
        media.read(originalUrl).ifPresent(bytes -> {
            MediaStoragePort.StoredObject stored = new MediaStoragePort.StoredObject((String) r.get("originalKey"), originalUrl,
                    bytes.length, (String) r.get("mime"));
            media.register(owner, PhotoOrigin.WARDROBE_ITEM, w.getId(), stored, originalUrl, (String) r.get("thumbnailUrl"), bytes,
                    r.get("width") instanceof Number n ? n.intValue() : null, r.get("height") instanceof Number n2 ? n2.intValue() : null,
                    w.getPhotoQualityScoresJson() == null ? null : BigDecimal.valueOf(((Number) ((Map<?, ?>) r.get("quality")).get("overall")).doubleValue()),
                    w.getModerationStatus(), Map.of("kind", "original", "pieceName", w.getName()));
        });
    }

    private void validate(PieceForm f) {
        // uma resposta com TODOS os campos a corrigir (antes: primeiro a taxonomia, depois nome e preço, em duas rodadas)
        Map<String, Object> errors = new LinkedHashMap<>(Taxonomy.pieceErrors(f.category(), f.subcategory(), f.sex(), f.color(),
                f.material(), f.size(), f.occasion(), f.style()));
        if (f.name() == null || f.name().isBlank()) {
            errors.put("name", Msg.t("wardrobe.informe_o_nome_da_peca"));
        }
        if (f.price() == null || f.price().signum() < 0) {
            errors.put("price", Msg.t("wardrobe.informe_o_preco_usd"));
        }
        if (f.seals() != null && f.seals().size() > 2) {
            errors.put("seals", Msg.t("wardrobe.maximo_de_2_selos_sugeridos"));
        }
        if (!Taxonomy.isValidMarket(f.market())) {
            errors.put("market", Msg.t("wardrobe.mercado_invalido_estacao_genero_ex"));
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), errors);
        }
    }

    private void apply(WardrobeItem w, PieceForm f, boolean creating) {
        w.setName(InputSanitizer.moderated("name", f.name(), 120));
        w.setCategory(f.category());
        w.setSubcategory(f.subcategory());
        w.setSex(f.sex());
        w.setColor(f.color());
        w.setMaterial(f.material());
        w.setSizeLabel(f.size());
        w.setMarket(f.market());
        w.setOccasionTags(Json.csv(Taxonomy.canonicalTags(f.occasion())));
        w.setStyleTags(Json.csv(Taxonomy.canonicalTags(f.style())));
        w.setSealIdsJson(Json.write(f.seals() == null ? List.of() : f.seals()));
        w.setPrice(f.price());
        w.setTags(Json.csv(f.tags()));
        w.setNotes(InputSanitizer.clean(f.notes(), 1000));
        w.setCondition(f.condition() == null ? (creating ? ItemCondition.GOOD : w.getCondition()) : f.condition());
        w.setPurchaseDate(f.purchaseDate());
        w.setPurchaseLocation(InputSanitizer.clean(f.purchaseLocation(), 160));
        w.setSku(InputSanitizer.clean(f.sku(), 80));
        w.setCareInstructions(InputSanitizer.clean(f.careInstructions(), 500));
        // arte de fundo da peça (RF4 · etapa "Arte de fundo": aura, material, skin, anatomia) — mesmo formato do look
        if (f.background() != null) {
            w.setBackgroundConfigJson(f.background().isEmpty() ? null : Json.write(f.background()));
        }
        if (f.forSale() != null) {
            w.setForSale(f.forSale());
        }
        String previousBrand = w.getBrandName();
        resolveBrand(w, f.brandId(), f.brandName());
        brandFromWebSearch(w, f, previousBrand);
    }

    /**
     * RF12.CA03 — a foto que era a imagem da peça foi excluída: a peça volta para a imagem padrão da subcategoria
     * (image_url é obrigatório; a peça nunca fica sem imagem).
     */
    public void useDefaultImageAfterPhotoDeletion(WardrobeItem w) {
        String url = assets.defaultPieceImage(w.getCategory(), w.getSubcategory());
        w.setImageUrl(url);
        w.setThumbnailUrl(url);
        w.setStudioImageUrl(null);
        w.setStudioDetailUrl(null);
        w.setDefaultImage(true);
    }

    /**
     * Marca da peça (RF4): {@code brandId} só quando o cliente aponta uma marca já ligada; fora isso, o nome vem do
     * buscador web (ou texto livre) e <b>não depende de catálogo pré-cadastrado</b>. Se o nome for de uma marca com
     * perfil aprovado na plataforma (conta MARCA), a peça é ligada a esse perfil (selos, cupons, página da marca).
     */
    private void resolveBrand(WardrobeItem w, UUID brandId, String brandName) {
        if (brandId != null) {
            Brand b = brands.findById(brandId).orElseThrow(() -> ApiException.badRequest("MARCA_INVALIDA", Msg.t("wardrobe.marca_nao_encontrada")));
            w.setBrand(b);
            w.setBrandName(b.getName());
            w.setBrandProfile(b.getBrandProfile());
            return;
        }
        w.setBrand(null);
        if (brandName == null || brandName.isBlank() || isNoBrandPlaceholder(brandName)) {
            w.setBrandName(null);
            w.setBrandProfile(null);
            return;
        }
        String name = InputSanitizer.clean(brandName, 80);
        w.setBrandName(name);
        String key = BrandLogoService.keyOf(name);
        w.setBrandProfile(brandProfiles.findByApprovalStatus(br.com.fashionai.domain.model.enums.ApprovalStatus.APROVADO).stream()
                .filter(bp -> key.equals(BrandLogoService.keyOf(bp.getNomeFantasia())) || key.equals(BrandLogoService.keyOf(bp.getBrandName())))
                .findFirst().orElse(null));
    }

    /**
     * Etapa remota do Flat Lay (rembg → remove.bg + Cloudinary) dentro do motor de IA: toda remoção de fundo que pode
     * cair num provedor pago passa pela cota diária da capacidade, pelo teto de gasto e pelo registro da inferência.
     */
    public AiEngine.RemoteStep<FlatLayPipeline.Result> flatLayStep(byte[] bytes) {
        return new AiEngine.RemoteStep<>() {
            @Override
            public String provider() {
                return "rembg/remove.bg+cloudinary";
            }

            @Override
            public String model() {
                return "flat-lay-hybrid";
            }

            @Override
            public boolean available() {
                return flatLay.externalAvailable();
            }

            @Override
            public AiEngine.RemoteResult<FlatLayPipeline.Result> call() {
                FlatLayPipeline.Result r = flatLay.run(bytes, true);
                return new AiEngine.RemoteResult<>(r, r.totalCostUsd(), "qualidade " + r.quality().overall());
            }
        };
    }

    /** Remoção de fundo sob demanda pelo motor de IA (cota + teto de gasto); sem provedor ou fora da cota, o recorte é local. */
    public FlatLayPipeline.Result governedFlatLay(UUID userId, byte[] bytes) {
        return ai.execute(userId, AiCapability.FLAT_LAY_STANDARDIZER, List.of(Msg.t("wardrobe.foto_enviada_kb", bytes.length / 1024)),
                null, null, List.of(flatLayStep(bytes)), () -> flatLay.run(bytes, false)).value();
    }

    /**
     * "Sem marca" é o que a análise escreve no campo quando não acha marca na gola nem no peito: o campo nunca fica em
     * branco na tela, mas a peça é salva sem marca (nada de uma marca fictícia chamada "Sem marca" no card).
     */
    static boolean isNoBrandPlaceholder(String name) {
        String n = name.trim();
        return java.util.stream.Stream.of(Locale.forLanguageTag("pt-BR"), Locale.ENGLISH, Locale.forLanguageTag("es"))
                .anyMatch(l -> n.equalsIgnoreCase(Msg.t(l, "wardrobe.sem_marca")));
    }

    static final java.util.Set<String> WEB_BRAND_SOURCES = java.util.Set.of("WIKIDATA", "SIMPLE_ICONS", "IA_BUSCA_WEB");

    /**
     * RF4 — marca escolhida no buscador web: a peça guarda o logo já filtrado (fundo branco, letras pretas) e a fonte.
     * Só aceita logo que esteja no storage próprio (a URL vem do próprio buscador, nunca de terceiros) e seja do catálogo
     * de logos ou um arquivo do próprio dono. O logo vale para esta peça; o logo global da marca só muda se o arquivo for
     * o que o próprio servidor buscou em catálogo aberto (ver {@link BrandLogoService#acceptWebLogo}). Sem logo da web, a
     * marca fica como texto livre (monograma) ou ligada à marca cadastrada na plataforma.
     */
    private void brandFromWebSearch(WardrobeItem w, PieceForm f, String previousBrand) {
        if (w.getBrandName() == null) {
            w.setBrandLogoUrl(null);
            w.setBrandSource(null);
            w.setBrandRef(null);
            return;
        }
        String logo = f.brandLogoUrl() == null ? null : f.brandLogoUrl().trim();
        if (f.brandSource() == null && w.getBrandName().equals(previousBrand)
                && (logo == null || logo.isEmpty() || logo.equals(w.getBrandLogoUrl()))) {
            return;                                   // edição sem mexer na marca: mantém logo e fonte
        }
        String source = f.brandSource() == null ? null : f.brandSource().trim().toUpperCase(Locale.ROOT);
        if (logo != null && !logo.isEmpty() && ownMedia.accepts(w.getUser().getId(), logo, true) && media.read(logo).isPresent()) {
            w.setBrandLogoUrl(logo);
            w.setBrandSource(source != null && WEB_BRAND_SOURCES.contains(source) ? source : "WEB");
            w.setBrandRef(f.brandRef() == null ? null : InputSanitizer.clean(f.brandRef(), 255));
            brandLogos.acceptWebLogo(w.getBrandName(), logo, w.getBrandSource(), null, w.getBrandRef());
        } else if (w.getBrandProfile() != null || w.getBrand() != null) {
            w.setBrandLogoUrl(null);
            w.setBrandSource("PLATAFORMA");
            w.setBrandRef(w.getBrandProfile() != null ? w.getBrandProfile().getSlug() : w.getBrand().getId().toString());
        } else {
            w.setBrandLogoUrl(null);
            w.setBrandSource("TEXTO_LIVRE");
            w.setBrandRef(null);
        }
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

    /** RF53 — valor do filtro "com selo": hype, brand ou any (nulo = sem filtro; valor desconhecido é ignorado). */
    static String sealFilter(String raw) {
        if (blank(raw)) {
            return null;
        }
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "hype" -> "hype";
            case "brand", "marca", "celebrity", "celebridade" -> "brand";
            case "any", "qualquer", "all" -> "any";
            default -> null;
        };
    }

    static final java.util.Set<String> HYPE_SORTS = java.util.Set.of("hype", "hype_desc", "hype_asc", "growth", "rarity");
    /** nomes em português que telas antigas enviavam (antes caíam no padrão e a ordenação era ignorada) */
    static final Map<String, String> SORT_ALIASES = Map.of("recentes", "recent", "mais_usadas", "worn", "menos_usadas", "least_worn",
            "nome", "name", "preco", "price", "mais_tempo_sem_uso", "idle");

    /** Score v2 de cada peça (nulo = sem Hype: dados insuficientes ou ainda não calculado — sempre por último). */
    private Map<UUID, br.com.fashionai.domain.model.HypeScoreCurrent> hypeOf(List<WardrobeItem> list) {
        if (hypeScores == null || hypeConfig == null || list.isEmpty()) {
            return Map.of();
        }
        return hypeScores.findByEntityTypeAndEntityIdInAndAlgorithmVersion(br.com.fashionai.domain.model.enums.HypeEntityType.PIECE,
                        list.stream().map(WardrobeItem::getId).toList(), hypeConfig.algorithmVersion()).stream()
                .collect(Collectors.toMap(br.com.fashionai.domain.model.HypeScoreCurrent::getEntityId, h -> h, (a, b) -> a));
    }

    private static Comparator<WardrobeItem> nullsLast(java.util.function.Function<WardrobeItem, BigDecimal> key, boolean desc) {
        Comparator<BigDecimal> cmp = desc ? Comparator.<BigDecimal>reverseOrder() : Comparator.<BigDecimal>naturalOrder();
        return Comparator.comparing(key, Comparator.nullsLast(cmp));
    }

    @Transactional(readOnly = true)
    public Views.Page<Views.PieceView> closet(CurrentUser viewer, UUID ownerId, ClosetFilter f) {
        UUID owner = ownerId == null ? viewer.id() : ownerId;
        boolean self = viewer != null && viewer.id().equals(owner);
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(owner).stream()
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> self || guard.canView(viewer, owner, effectiveVisibility(w)))
                .filter(w -> self || w.getModerationStatus() == ModerationStatus.APPROVED)
                .filter(w -> blank(f.category()) || f.category().equals(w.getCategory()))
                .filter(w -> blank(f.color()) || f.color().equals(w.getColor())
                        || f.color().equalsIgnoreCase(Taxonomy.COLOR_FAMILY.get(w.getColor())))
                .filter(w -> blank(f.season()) || (w.getMarket() != null && w.getMarket().startsWith(f.season().toLowerCase(Locale.ROOT))))
                .filter(w -> blank(f.occasion()) || Json.csv(w.getOccasionTags()).contains(f.occasion()))
                .filter(w -> blank(f.style()) || Json.csv(w.getStyleTags()).contains(f.style()))
                .filter(w -> stateMatches(w, f.state()))
                .filter(w -> blank(f.q()) || contains(w.getName(), f.q()) || contains(w.getBrandName(), f.q())
                        || contains(w.getSubcategory(), f.q()))
                .collect(Collectors.toCollection(ArrayList::new));
        String sort = SORT_ALIASES.getOrDefault(f.sort() == null ? "recent" : f.sort(), f.sort() == null ? "recent" : f.sort());
        String seal = sealFilter(f.seal());
        Map<UUID, br.com.fashionai.domain.model.HypeScoreCurrent> hype = HYPE_SORTS.contains(sort) || !blank(f.hypeLevel())
                || (seal != null && !"brand".equals(seal)) ? hypeOf(all) : Map.of();
        if (!blank(f.hypeLevel()) && hypeConfig != null) {
            int min = hypeMinimum(f.hypeLevel());
            all.removeIf(w -> hype.get(w.getId()) == null || hype.get(w.getId()).getScore() == null || hype.get(w.getId()).getScore().doubleValue() < min - 0.5);
        }
        if (seal != null) {
            // RF53 — selo de Hype: derivado do Hype atual (peça privada não tem: só item público elegível); selo de marca:
            // vínculo APROVADO de tier PEÇA vindo de um look que quem vê consegue ver
            Set<UUID> branded = "hype".equals(seal) ? Set.of()
                    : SealService.approvedPieceBonds(all.stream().map(WardrobeItem::getId).toList(), schemeItems, sealBonds,
                    sc -> SealService.canViewScheme(guard, viewer, sc)).keySet();
            all.removeIf(w -> {
                boolean hasHype = !br.com.fashionai.application.hype.HypeSeals.of(hype.get(w.getId())).isEmpty();
                boolean hasBrand = branded.contains(w.getId());
                return switch (seal) {
                    case "hype" -> !hasHype;
                    case "brand" -> !hasBrand;
                    default -> !hasHype && !hasBrand;
                };
            });
        }
        java.util.function.Function<WardrobeItem, BigDecimal> score = w -> hype.containsKey(w.getId()) ? hype.get(w.getId()).getScore() : null;
        LocalDate today = LocalDate.now(br.com.fashionai.application.hype.HypeSignalRecorder.ZONE);
        Comparator<WardrobeItem> order = switch (sort) {
            case "hype", "hype_desc" -> nullsLast(score, true);
            case "hype_asc" -> nullsLast(score, false);
            case "growth" -> nullsLast(w -> hype.containsKey(w.getId()) ? hype.get(w.getId()).getDeltaPoints() : null, true)
                    .thenComparing(nullsLast(w -> hype.containsKey(w.getId()) ? hype.get(w.getId()).getDimensions().getTrend() : null, true));
            case "rarity" -> nullsLast(w -> hype.containsKey(w.getId()) ? hype.get(w.getId()).getDimensions().getRarity() : null, true);
            case "least_worn" -> Comparator.comparingInt(WardrobeItem::getWearCount).thenComparing(WardrobeItem::getCreatedAt);
            case "idle" -> Comparator.comparingLong((WardrobeItem w) -> br.com.fashionai.application.hype.HypeQueryService.idleDays(w, today)).reversed();
            case "worn" -> Comparator.comparingInt(WardrobeItem::getWearCount).reversed();
            case "name" -> Comparator.comparing(w -> w.getName().toLowerCase(Locale.ROOT));
            case "price" -> Comparator.comparing((WardrobeItem w) -> w.getPrice() == null ? BigDecimal.ZERO : w.getPrice()).reversed();
            default -> Comparator.comparing(WardrobeItem::getCreatedAt).reversed();
        };
        all.sort(order);
        int size = Math.max(1, Math.min(60, f.size() <= 0 ? 30 : f.size()));
        int page = Math.max(0, f.page());
        int from = Math.min(all.size(), page * size);
        int to = Math.min(all.size(), from + size);
        List<Views.PieceView> items = all.subList(from, to).stream().map(w -> Views.piece(w, viewerState(viewer, w), null)).toList();
        return new Views.Page<>(items, page, size, all.size(), to < all.size());
    }

    /** Faixa mínima de Hype → score mínimo (limiares centralizados no HypeScoreConfig). */
    int hypeMinimum(String level) {
        int[] t = hypeConfig.levelThresholds();
        return switch (level.toUpperCase(Locale.ROOT)) {
            case "NICHE" -> t[0];
            case "RELEVANT" -> t[1];
            case "HOT" -> t[2];
            case "TRENDING" -> t[3];
            case "VIRAL" -> t[4];
            default -> 0;
        };
    }

    static boolean stateMatches(WardrobeItem w, String state) {
        if (blank(state) || "todos".equalsIgnoreCase(state)) {
            return true;
        }
        return switch (state.toLowerCase(Locale.ROOT)) {
            case "favoritos", "favorites" -> w.isFavorite();
            case "disponivel", "disponiveis", "available" -> w.isDisponivel();
            case "indisponivel", "indisponiveis", "unavailable" -> !w.isDisponivel();
            case "venda", "a_venda", "for_sale", "forsale" -> w.isForSale();
            case "doar", "para_doar", "doacao", "for_donation", "donation" -> w.isForDonation();
            default -> true;
        };
    }

    // ================================================================== RF7 — detalhe
    @Transactional
    public Map<String, Object> detail(CurrentUser viewer, UUID id, UUID fromSchemeId) {
        WardrobeItem w = pieces.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        boolean owner = viewer != null && viewer.id().equals(w.getUser().getId());
        Map<String, Object> out = new LinkedHashMap<>();
        // visibilidade (peça, perfil do dono, bloqueio) e moderação antes de qualquer dado — inclusive do retrato arquivado
        requireVisiblePiece(viewer, w);
        if (w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED && !owner) {
            // RF7.CA03 — snapshot do momento da publicação, marcado como "não mais disponível"; só de um look que quem
            // pede também consegue ver
            SchemeItem snap = fromSchemeId == null ? null : schemeItems.findBySchemeIdOrderBySortOrder(fromSchemeId).stream()
                    .filter(si -> si.getWardrobeItem().getId().equals(id) && schemeVisible(viewer, si.getScheme()))
                    .findFirst().orElse(null);
            out.put("notAvailableAnymore", true);
            out.put("snapshot", snap == null ? Views.snapshot(w) : Json.map(snap.getSnapshotJson()));
            out.put("fromSchemeId", fromSchemeId);
            return out;
        }
        // Atualização direta (sem @Version): o detalhe é aberto em paralelo (ex.: antes/depois de a sessão carregar)
        // e mexer na entidade gerava conflito de versão (409) num simples GET.
        pieces.touchView(w.getId(), owner ? 0 : 1, Instant.now());
        if (!owner && viewer != null) {
            events.publishEvent(new DomainEvents.HypeSignal(HypeSignalType.PIECE_VIEWED, HypeEntityType.PIECE, id, viewer.id(), w.getUser().getId()));
        }
        out.put("piece", Views.piece(w, viewerState(viewer, w), reactionCounts(TargetType.PIECE, w.getId())));
        out.put("fromSchemeId", fromSchemeId);
        out.put("wearstyles", Taxonomy.wearstylesOf(w.getCategory(), Json.csv(w.getOccasionTags())));
        // RF19.CA14 — "retornar": esquemas de origem que usaram esta peça.
        List<Map<String, Object>> origins = new ArrayList<>();
        for (SchemeItem si : schemeItems.findByWardrobeItemId(id)) {
            Scheme s = si.getScheme();
            if (schemeVisible(viewer, s)) {
                origins.add(Map.of("schemeId", s.getId(), "title", s.getTitle(), "coverImageUrl", String.valueOf(s.getCoverImageUrl())));
            }
        }
        out.put("originSchemes", origins);
        out.put("canEdit", owner);
        return out;
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
        if (viewer == null) {
            return Views.ViewerState.NONE;
        }
        List<String> mine = reactions.findByActorIdAndTargetTypeAndTargetId(viewer.id(), TargetType.PIECE, w.getId()).stream()
                .map(r -> r.getReactionType().name()).toList();
        boolean saved = this.saved.findByUserIdAndTargetTypeAndTargetId(viewer.id(), TargetType.PIECE, w.getId()).isPresent();
        return new Views.ViewerState(mine.contains("LIKE"), mine.stream().filter(r -> !r.equals("LIKE")).toList(), saved,
                viewer.id().equals(w.getUser().getId()), false);
    }

    public Map<String, Long> reactionCounts(TargetType type, UUID id) {
        Map<String, Long> m = new LinkedHashMap<>();
        for (ReactionType t : ReactionType.values()) {
            m.put(t.name(), reactions.countByTargetTypeAndTargetIdAndReactionType(type, id, t));
        }
        return m;
    }

    // ================================================================== RF9.CA07 — edição
    @Transactional
    public Views.PieceView update(CurrentUser user, UUID id, PieceForm form) {
        guard.requireCanCreate(user);
        WardrobeItem w = owned(user, id);
        validate(form);
        apply(w, form, false);
        if (form.visibility() != null) {
            w.setVisibility(form.visibility());
        }
        projections.piece(w);
        audit.log(user, AuditActions.EDICAO_PECA, "piece:" + id, Map.of());
        events.publishEvent(new DomainEvents.PieceUpdated(user.id(), id, InventoryScoreService.completeness(w)));
        return Views.piece(w, viewerState(user, w), null);
    }

    /** "À venda" e "para doar" são exclusivos: marcar um desmarca o outro; desmarcar não mexe no outro. */
    static void applyListing(WardrobeItem w, Boolean forSale, Boolean forDonation) {
        if (forSale != null) {
            w.setForSale(forSale);
            if (forSale) {
                w.setForDonation(false);
            }
        }
        if (forDonation != null) {
            w.setForDonation(forDonation);
            if (forDonation) {
                w.setForSale(false);
            }
        }
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
        applyListing(w, forSale, forDonation);
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
        String mime = ImageOps.requireAcceptedImage(bytes);
        BufferedImage img = ImageOps.decode(bytes);
        String base = "users/" + user.id() + "/pieces/" + id + "/edit-" + System.currentTimeMillis();
        MediaStoragePort.StoredObject stored = media.put(base + ".png", ImageOps.png(img), "image/png");
        BufferedImage thumbImg = ImageOps.composeCentered(ImageOps.crop(img, ImageOps.alphaBounds(img).empty()
                ? new ImageOps.Box(0, 0, img.getWidth(), img.getHeight()) : ImageOps.alphaBounds(img)), FlatLayPipeline.THUMB, 0.06,
                java.awt.Color.WHITE, false);
        MediaStoragePort.StoredObject thumb = media.put(base + "-thumb.png", ImageOps.png(thumbImg), "image/png");
        Photo p = media.register(w.getUser(), PhotoOrigin.EDITOR, id, stored, w.getOriginalImageUrl(), thumb.url(), bytes,
                img.getWidth(), img.getHeight(), null, ModerationStatus.APPROVED, Map.of("sourceMime", mime));
        p.setEditedFromPhotoId(editedFromPhotoId);
        // a original continua preservada em "Minhas Fotos" (RF15.CA02).
        w.setImageUrl(stored.url());
        w.setThumbnailUrl(thumb.url());
        w.setDefaultImage(false);
        // foto nova enviada pela pessoa tira o selo de IA; edição de uma foto existente (editedFromPhotoId) o mantém
        if (editedFromPhotoId == null) {
            w.setAiGeneratedImage(false);
        }
        w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
        // a foto de estúdio acompanha a imagem nova (recorte com transparência) ou sai (foto opaca não vai ao estúdio)
        Map<String, Object> editedMeta = new LinkedHashMap<>(Json.map(w.getFlatLayMetadataJson()));
        editedMeta.remove("studio_source_url");                                  // a fonte agora é a imagem editada
        w.setFlatLayMetadataJson(Json.write(editedMeta));
        if (hasTransparency(img)) {
            refreshStudio(w, img, false, false);
        } else {
            applyStudio(w, null, false);
        }
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
        if (!r.backgroundRemoved()) {
            return Map.of("ok", false, "message", Msg.t("wardrobe.nao_foi_possivel_remover_o"),
                    "stages", r.stages());
        }
        String base = "users/" + user.id() + "/pieces/" + id + "/processed-" + System.currentTimeMillis();
        MediaStoragePort.StoredObject processed = media.put(base + ".png", r.processedPng(), "image/png");
        MediaStoragePort.StoredObject thumb = media.put(base + "-thumb.png", r.thumbnailPng(), "image/png");
        w.setImageUrl(processed.url());
        w.setThumbnailUrl(thumb.url());
        w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
        w.setFlatLayMetadataJson(Json.write(r.metadata()));
        w.setPhotoQualityScoresJson(Json.write(Map.of("overall", r.quality().overall(), "metrics", r.quality().metrics())));
        w.setFlatLayMetadataJson(Json.write(withStudioSource(w, r, base)));
        refreshStudio(w, r.studioSource(), false, true);
        return Map.of("ok", true, "imageUrl", processed.url(), "thumbnailUrl", thumb.url(), "stages", r.stages());
    }

    /** Job (RF4.CA06): reprocessa peças salvas com a foto original quando a remoção de fundo volta. */
    @Transactional
    public int reprocessPending() {
        int done = 0;
        for (PipelineJob job : jobs.findByStatusOrderByQueuedAtAsc(PipelineJobStatus.PENDING)) {
            if (job.getType() != PipelineJobType.FLAT_LAY_STANDARDIZATION || job.getInputResourceId() == null) {
                continue;
            }
            WardrobeItem w = pieces.findById(job.getInputResourceId()).orElse(null);
            // sem provedor, com a IA remota desligada ou com o teto de gasto estourado, o item espera a próxima rodada
            if (w == null || !flatLay.externalAvailable() || !ai.remoteAllowed(w.getUser().getId(), AiCapability.FLAT_LAY_STANDARDIZER)) {
                continue;
            }
            job.setStatus(PipelineJobStatus.RUNNING);
            job.setAttempts(job.getAttempts() + 1);
            job.setStartedAt(Instant.now());
            try {
                byte[] bytes = media.read(w.getOriginalImageUrl()).orElse(null);
                if (bytes == null) {
                    job.setStatus(PipelineJobStatus.FAILED);
                    job.setErrorCode("SEM_ORIGINAL");
                    continue;
                }
                // pelo motor (cota do dono + teto de gasto): sem resposta remota não há recorte novo e o job segue pendente
                FlatLayPipeline.Result r = ai.execute(w.getUser().getId(), AiCapability.FLAT_LAY_STANDARDIZER,
                        List.of(Msg.t("wardrobe.foto_enviada_kb", bytes.length / 1024)), null, null, List.of(flatLayStep(bytes)),
                        () -> (FlatLayPipeline.Result) null).value();
                if (r != null && r.backgroundRemoved()) {
                    String base = "users/" + w.getUser().getId() + "/pieces/" + w.getId() + "/reprocessed";
                    w.setImageUrl(media.put(base + ".png", r.processedPng(), "image/png").url());
                    w.setThumbnailUrl(media.put(base + "-thumb.png", r.thumbnailPng(), "image/png").url());
                    w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
                    w.setFlatLayMetadataJson(Json.write(r.metadata()));
                    w.setFlatLayMetadataJson(Json.write(withStudioSource(w, r, base)));
                    refreshStudio(w, r.studioSource(), true, true);                 // agora com recorte: ganha o estúdio
                    job.setStatus(PipelineJobStatus.COMPLETED);
                    notifications.notify(w.getUser().getId(), null, NotificationType.AI_JOB_FINISHED, "PIECE", w.getId(),
                            Msg.k("wardrobe.foto_da_peca_padronizada"), Msg.k("wardrobe.o_fundo_de_foi_removido", w.getName()), null);
                    done++;
                } else {
                    job.setStatus(job.getAttempts() >= 3 ? PipelineJobStatus.FAILED : PipelineJobStatus.PENDING);
                }
            } catch (RuntimeException ex) {
                job.setStatus(job.getAttempts() >= 3 ? PipelineJobStatus.FAILED : PipelineJobStatus.PENDING);
                job.setErrorMessage(ex.getMessage());
            }
            job.setFinishedAt(Instant.now());
        }
        return done;
    }

    // ================================================================== RF4 · Estúdio (foto de produto)
    /** Metadados do Flat Lay refeito + a nova fonte do estúdio em alta resolução; a detecção da IA (logo) é mantida. */
    private Map<String, Object> withStudioSource(WardrobeItem w, FlatLayPipeline.Result r, String base) {
        Map<String, Object> meta = new LinkedHashMap<>(r.metadata());
        Map<String, Object> old = Json.map(w.getFlatLayMetadataJson());
        Object detected = old.get("detected");
        if (detected != null) {
            meta.put("detected", detected);
        }
        if (old.get("studio") != null) {
            meta.put("studio", old.get("studio"));                       // versões e aprovação da foto de estúdio
        }
        meta.put("studio_source_url", media.put(base + "-studio-source.png", ImageOps.png(r.studioSource()), "image/png").url());
        return meta;
    }

    /** Tipo da peça para o estúdio (manequim invisível só em peças com gola): categoria/subcategoria → slot. */
    static String studioKind(String category, String subcategory) {
        if (category == null) {
            return null;
        }
        return switch (category) {
            case "upper_piece" -> java.util.Set.of("jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono")
                    .contains(subcategory) ? "OUTERWEAR" : "TOP";
            case "lower_piece" -> "BOTTOM";
            case "shoes_piece" -> "SHOES";
            case "full_body_piece" -> "FULL_BODY";
            case "accessory_piece" -> "ACCESSORY";
            default -> null;
        };
    }

    /**
     * Caixa do logo devolvida pela IA sobre a imagem enviada (768 px, peça centralizada com margem de 6%) → caixa
     * relativa à peça, que vale para o recorte em qualquer resolução.
     */
    static double[] logoRelative(double[] box1000, int cw, int ch) {
        if (box1000 == null || cw <= 0 || ch <= 0) {
            return null;
        }
        int size = 768, inner = (int) Math.round(size * (1 - 2 * 0.06));
        double sc = Math.min(inner / (double) cw, inner / (double) ch);
        int gw = (int) Math.round(cw * sc), gh = (int) Math.round(ch * sc);
        int x0 = (size - gw) / 2, y0 = (size - gh) / 2;
        double[] out = new double[4];
        for (int i = 0; i < 4; i++) {
            double px = box1000[i] * size / 1000.0;
            out[i] = Math.max(0, Math.min(1, i % 2 == 0 ? (px - x0) / gw : (px - y0) / gh));
        }
        return out[2] - out[0] >= 0.01 && out[3] - out[1] >= 0.01 ? out : null;
    }

    /** Dicas do estúdio a partir do que já foi guardado: lados cortados (Flat Lay) e logo apontado pela IA. */
    static br.com.fashionai.application.imaging.StudioPipeline.Hints studioHints(String category, String subcategory, Object truncatedSides, Object logo) {
        String kind = studioKind(category, subcategory);
        java.util.Set<String> truncated = truncatedSides instanceof List<?> l
                ? l.stream().map(String::valueOf).collect(Collectors.toCollection(java.util.LinkedHashSet::new)) : null;
        double[] box = null;
        if (logo instanceof Map<?, ?> lm && lm.get("box") instanceof List<?> b && b.size() == 4
                && b.stream().allMatch(v -> v instanceof Number)) {
            box = b.stream().mapToDouble(v -> ((Number) v).doubleValue()).toArray();
        }
        return new br.com.fashionai.application.imaging.StudioPipeline.Hints(kind, truncated, box, box == null ? null : "ia",
                br.com.fashionai.application.imaging.FeedFraming.template(category, subcategory, kind));
    }

    br.com.fashionai.application.imaging.StudioPipeline.Hints studioHints(WardrobeItem w) {
        Map<String, Object> meta = Json.map(w.getFlatLayMetadataJson());
        Object logo = meta.get("detected") instanceof Map<?, ?> d ? d.get("logo") : null;
        return studioHints(w.getCategory(), w.getSubcategory(), meta.get("truncated_sides"), logo);
    }

    /** Fonte do estúdio da peça: o recorte em alta resolução guardado no cadastro ou, sem ele, a imagem atual. */
    private BufferedImage studioSource(WardrobeItem w) {
        Object url = Json.map(w.getFlatLayMetadataJson()).get("studio_source_url");
        byte[] png = url == null ? null : media.read(String.valueOf(url)).orElse(null);
        if (png == null) {
            png = media.read(w.getImageUrl()).orElse(null);
        }
        return png == null ? null : ImageOps.decode(png);
    }

    /** Grava o resultado do estúdio na peça (foto, fundo, detalhe do logo) e o resumo nos metadados. */
    /** Coloca uma foto de estúdio no ar (nova versão; {@code approved} diz se a pessoa já aprovou). {@code null} tira o estúdio. */
    private void applyStudio(WardrobeItem w, Map<String, Object> info, boolean approved) {
        Map<String, Object> meta = new LinkedHashMap<>(Json.map(w.getFlatLayMetadataJson()));
        Map<String, Object> cur = studioMeta(meta);
        w.setStudioImageUrl(info == null ? null : String.valueOf(info.get("url")));
        w.setStudioBackdrop(info == null ? null : String.valueOf(info.get("backdrop")));
        w.setStudioDetailUrl(info == null || info.get("detailUrl") == null ? null : String.valueOf(info.get("detailUrl")));
        if (info == null) {
            meta.remove("studio");
        } else {
            Map<String, Object> summary = studioSummary(info, studioVersion(cur, w) + 1, approved);
            if (cur != null && cur.get("url") != null) {
                summary.put("previous", studioRef(cur));
            }
            meta.put("studio", summary);
        }
        w.setFlatLayMetadataJson(Json.write(meta));
    }

    // ================================================================== RF4 · versões e aprovação da foto de estúdio
    // A foto de estúdio aprovada nunca é trocada em silêncio por um processamento novo: com uma aprovada no ar, o
    // resultado novo fica em flatLayMetadata.studio.pending (com a própria versão e todos os derivados: foto inteira,
    // miniatura, variante do feed, detalhe do logo, recorte realçado, enquadramento e marcos para ajuste manual) até a
    // pessoa aprovar (POST /studio/approve) ou descartar (DELETE /studio/pending). Peças antigas sem esses campos
    // contam como versão 1 aprovada.
    private static final List<String> STUDIO_KEYS = List.of("url", "thumbUrl", "feedUrl", "detailUrl", "enhancedUrl", "backdrop",
            "stages", "metrics", "framing", "feed", "logo", "provider");

    @SuppressWarnings("unchecked")
    static Map<String, Object> studioMeta(Map<String, Object> meta) {
        return meta.get("studio") instanceof Map<?, ?> m ? new LinkedHashMap<>((Map<String, Object>) m) : null;
    }

    static int studioVersion(Map<String, Object> cur, WardrobeItem w) {
        if (cur != null && cur.get("version") instanceof Number n) {
            return n.intValue();
        }
        return w.getStudioImageUrl() != null ? 1 : 0;
    }

    /** Aprovada: marcada como tal ou legada (sem o campo). */
    static boolean studioApproved(Map<String, Object> cur, WardrobeItem w) {
        return w.getStudioImageUrl() != null && (cur == null || !Boolean.FALSE.equals(cur.get("approved")));
    }

    static Map<String, Object> studioSummary(Map<String, Object> info, int version, boolean approved) {
        Map<String, Object> s = new LinkedHashMap<>();
        for (String k : STUDIO_KEYS) {
            if (info.get(k) != null) {
                s.put(k, "provider".equals(k) ? String.valueOf(info.get(k)) : info.get(k));
            }
        }
        String now = java.time.Instant.now().toString();
        s.put("version", version);
        s.put("approved", approved);
        s.put("createdAt", now);
        if (approved) {
            s.put("approvedAt", now);
        }
        return s;
    }

    /** O que fica da versão anterior (histórico curto): versão e as URLs, sem a versão anterior dela. */
    private static Map<String, Object> studioRef(Map<String, Object> cur) {
        Map<String, Object> ref = new LinkedHashMap<>();
        for (String k : List.of("version", "url", "feedUrl", "backdrop", "approvedAt")) {
            if (cur.get(k) != null) {
                ref.put(k, cur.get(k));
            }
        }
        return ref;
    }

    /**
     * Resultado novo do estúdio. Com uma foto APROVADA no ar e a mesma foto de origem, ele fica pendente (a aprovada
     * continua no feed). Sem aprovada, ou quando a pessoa trocou a foto de origem (a aprovada é de outra imagem), ele
     * entra no ar marcado "aguardando aprovação". Devolve "pending", "applied" ou "failed".
     */
    String offerStudio(WardrobeItem w, Map<String, Object> info, boolean sourceChanged) {
        if (info == null) {
            if (sourceChanged) {
                applyStudio(w, null, false);                    // estúdio de outra imagem é pior que nenhum
            }
            return "failed";
        }
        Map<String, Object> meta = new LinkedHashMap<>(Json.map(w.getFlatLayMetadataJson()));
        Map<String, Object> cur = studioMeta(meta);
        if (!sourceChanged && studioApproved(cur, w)) {
            if (cur == null) {                                  // legado: a aprovada ganha o resumo mínimo
                cur = new LinkedHashMap<>(Map.of("url", w.getStudioImageUrl(), "version", 1, "approved", true));
            }
            dropPendingMedia(cur);
            cur.put("pending", studioSummary(info, Math.max(studioVersion(cur, w), pendingVersion(cur)) + 1, false));
            meta.put("studio", cur);
            w.setFlatLayMetadataJson(Json.write(meta));
            return "pending";
        }
        applyStudio(w, info, false);
        return "applied";
    }

    private static int pendingVersion(Map<String, Object> cur) {
        return cur.get("pending") instanceof Map<?, ?> p && p.get("version") instanceof Number n ? n.intValue() : 0;
    }

    /** Apaga os arquivos de uma versão pendente que não vai ao ar (melhor esforço: arquivo que sobrar não quebra nada). */
    private void dropPendingMedia(Map<String, Object> cur) {
        if (!(cur.get("pending") instanceof Map<?, ?> p)) {
            return;
        }
        for (String k : List.of("url", "thumbUrl", "feedUrl", "detailUrl", "enhancedUrl")) {
            if (p.get(k) != null) {
                try {
                    media.deleteUrl(String.valueOf(p.get(k)));
                } catch (RuntimeException e) {
                    log.debug("não apagou {}: {}", p.get(k), e.toString());
                }
            }
        }
    }

    /** Aprova a foto de estúdio: a pendente vai ao ar (a anterior fica no histórico) ou a atual é marcada como aprovada. */
    @Transactional
    public Views.PieceView approveStudio(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        WardrobeItem w = owned(user, id);
        Map<String, Object> meta = new LinkedHashMap<>(Json.map(w.getFlatLayMetadataJson()));
        Map<String, Object> cur = studioMeta(meta);
        String now = java.time.Instant.now().toString();
        if (cur != null && cur.get("pending") instanceof Map<?, ?> pm) {
            Map<String, Object> next = new LinkedHashMap<>();
            pm.forEach((k, v) -> next.put(String.valueOf(k), v));
            next.put("approved", true);
            next.put("approvedAt", now);
            if (w.getStudioImageUrl() != null) {
                Map<String, Object> prev = new LinkedHashMap<>(cur);
                prev.putIfAbsent("url", w.getStudioImageUrl());
                next.put("previous", studioRef(prev));
            }
            w.setStudioImageUrl(String.valueOf(next.get("url")));
            w.setStudioBackdrop(next.get("backdrop") == null ? null : String.valueOf(next.get("backdrop")));
            w.setStudioDetailUrl(next.get("detailUrl") == null ? null : String.valueOf(next.get("detailUrl")));
            meta.put("studio", next);
        } else if (w.getStudioImageUrl() != null && cur != null && Boolean.FALSE.equals(cur.get("approved"))) {
            cur.put("approved", true);
            cur.put("approvedAt", now);
            meta.put("studio", cur);
        } else {
            throw ApiException.conflict("NADA_A_APROVAR", Msg.t("wardrobe.nenhuma_foto_de_estudio_aguardando"));
        }
        w.setFlatLayMetadataJson(Json.write(meta));
        audit.log(user, AuditActions.EDICAO_PECA, "piece:" + id, Map.of("field", "studio", "action", "approve"));
        return Views.piece(w, viewerState(user, w), null);
    }

    /** Descarta a versão pendente: a aprovada continua no ar e os arquivos da pendente são apagados. */
    @Transactional
    public Views.PieceView discardStudio(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        WardrobeItem w = owned(user, id);
        Map<String, Object> meta = new LinkedHashMap<>(Json.map(w.getFlatLayMetadataJson()));
        Map<String, Object> cur = studioMeta(meta);
        if (cur == null || !(cur.get("pending") instanceof Map<?, ?>)) {
            throw ApiException.conflict("NADA_A_DESCARTAR", Msg.t("wardrobe.nenhuma_foto_de_estudio_aguardando"));
        }
        dropPendingMedia(cur);
        cur.remove("pending");
        meta.put("studio", cur);
        w.setFlatLayMetadataJson(Json.write(meta));
        audit.log(user, AuditActions.EDICAO_PECA, "piece:" + id, Map.of("field", "studio", "action", "discard"));
        return Views.piece(w, viewerState(user, w), null);
    }

    /**
     * Refaz a foto de estúdio quando a imagem da peça muda (mesmo fundo de antes). {@code createIfMissing}: peça que não
     * tinha estúdio passa a ter. {@code sameSource}: a foto de origem é a mesma (logo e cortes continuam valendo); numa
     * imagem editada eles são recalculados. Se o estúdio falhar numa imagem nova, a foto antiga sai — estúdio de outra
     * imagem é pior que nenhum. Veja {@link #offerStudio}: um reprocessamento da mesma foto nunca troca a aprovada sozinho.
     */
    void refreshStudio(WardrobeItem w, BufferedImage cutout, boolean createIfMissing, boolean sameSource) {
        if (w.getStudioImageUrl() == null && !createIfMissing) {
            return;
        }
        var hints = sameSource ? studioHints(w) : studioHints(w.getCategory(), w.getSubcategory(), null, null);
        Map<String, Object> info = studioShot(w.getUser().getId(), cutout, w.getStudioBackdrop() == null ? "auto" : w.getStudioBackdrop(),
                "users/" + w.getUser().getId() + "/pieces/" + w.getId() + "/", hints);
        // mesma foto de origem (reprocessamento): com uma aprovada no ar, a nova espera a aprovação
        offerStudio(w, info, !sameSource);
    }

    private static boolean hasTransparency(BufferedImage img) {
        if (!img.getColorModel().hasAlpha()) {
            return false;
        }
        for (int y = 0; y < img.getHeight(); y += 4) {
            if ((img.getRGB(0, y) >>> 24) < 16 || (img.getRGB(img.getWidth() - 1, y) >>> 24) < 16) {
                return true;
            }
        }
        for (int x = 0; x < img.getWidth(); x += 4) {
            if ((img.getRGB(x, 0) >>> 24) < 16 || (img.getRGB(x, img.getHeight() - 1) >>> 24) < 16) {
                return true;
            }
        }
        return false;
    }

    /**
     * Roda o pipeline de estúdio na governança de IA (Photoroom/Stability → local) e guarda: foto principal (quadro
     * adaptado à peça), miniatura 640 px ({@code .thumb.jpg}), foto de detalhe do logo e recorte realçado.
     */
    Map<String, Object> studioShot(UUID userId, BufferedImage cutout, String backdrop, String basePath,
                                   br.com.fashionai.application.imaging.StudioPipeline.Hints hints) {
        try {
            AiOutcome<br.com.fashionai.application.imaging.StudioPipeline.Result> out = ai.execute(userId, AiCapability.STUDIO_ENHANCER,
                    List.of(Msg.t("common.recorte_da_peca_png_sem"), Msg.t("wardrobe.cor_de_fundo", backdrop)), null, null,
                    List.of(new AiEngine.RemoteStep<>() {
                        public String provider() {
                            return "photoroom/stability";
                        }

                        public String model() {
                            return "studio-hybrid";
                        }

                        public boolean available() {
                            return studio.externalAvailable();
                        }

                        public AiEngine.RemoteResult<br.com.fashionai.application.imaging.StudioPipeline.Result> call() {
                            var res = studio.run(cutout, backdrop, true, hints);
                            return new AiEngine.RemoteResult<>(res, res.costUsd(), Msg.t("wardrobe.estudio", res.backdrop().id()));
                        }
                    }), () -> studio.run(cutout, backdrop, false, hints));
            var res = out.value();
            long stamp = System.currentTimeMillis();
            String name = basePath + "studio-" + res.backdrop().id() + "-" + stamp;
            MediaStoragePort.StoredObject shot = media.put(name + ".jpg", res.studioJpeg(), "image/jpeg");
            media.put(name + ".thumb.jpg", res.thumbJpeg(), "image/jpeg");       // miniatura: mesma URL com ".thumb.jpg"
            media.put(name + ".feed.jpg", res.feedJpeg(), "image/jpeg");         // feed 4:5 por template: ".feed.jpg"
            String detailUrl = res.detailJpeg() == null ? null : media.put(name + ".detail.jpg", res.detailJpeg(), "image/jpeg").url();
            MediaStoragePort.StoredObject enhanced = media.put(basePath + "enhanced-" + stamp + ".png", res.enhancedPng(), "image/png");
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("url", shot.url());
            info.put("thumbUrl", Views.studioThumb(shot.url()));
            info.put("feedUrl", Views.studioFeed(shot.url()));
            info.put("feed", res.feed());
            info.put("detailUrl", detailUrl);
            info.put("enhancedUrl", enhanced.url());
            info.put("backdrop", res.backdrop().id());
            info.put("backdropLabel", res.backdrop().label());
            info.put("stages", res.stages());
            info.put("metrics", res.metrics());
            info.put("framing", res.framing());
            info.put("logo", res.logo());
            info.put("ghost", res.ghost());
            info.put("provider", out.provider());
            info.put("fallbackUsed", out.fallbackUsed() || res.fallbackUsed());
            info.put("costUsd", res.costUsd());
            return info;
        } catch (RuntimeException e) {
            log.warn("estúdio falhou (segue só com o Flat Lay): {}", e.toString());
            return null;
        }
    }

    /**
     * RF4 · Estúdio da peça sem foto: a imagem padrão de {@code /public/assets_pecas} (arte da peça com o logo FAI) passa
     * pelo mesmo estúdio das fotos enviadas — a peça ocupa o quadro inteiro e o logo ganha a foto de detalhe. O resultado
     * é o mesmo para todas as peças que usam o arquivo, então é gerado uma vez e reaproveitado. Nunca usa a foto de
     * referência do estúdio como imagem padrão.
     */
    void defaultStudio(WardrobeItem w) {
        if (!w.isDefaultImage() || w.getImageUrl() == null) {
            return;
        }
        var done = pieces.findFirstByImageUrlAndDefaultImageTrueAndStudioImageUrlIsNotNull(w.getImageUrl());
        if (done.isPresent() && !done.get().getId().equals(w.getId())) {
            WardrobeItem src = done.get();
            w.setStudioImageUrl(src.getStudioImageUrl());
            w.setStudioBackdrop(src.getStudioBackdrop());
            w.setStudioDetailUrl(src.getStudioDetailUrl());
            Map<String, Object> meta = new LinkedHashMap<>(Json.map(w.getFlatLayMetadataJson()));
            Object st = Json.map(src.getFlatLayMetadataJson()).get("studio");
            if (st != null) {
                meta.put("studio", st);
            }
            w.setFlatLayMetadataJson(Json.write(meta));
            return;
        }
        BufferedImage art;
        try {
            var file = assets.publicFile(w.getImageUrl());
            art = file.isEmpty() ? null : javax.imageio.ImageIO.read(file.get().toFile());
        } catch (java.io.IOException e) {
            art = null;
        }
        if (art == null) {
            return;
        }
        String stem = w.getImageUrl().replaceAll("^.*/", "").replaceAll("\\.[a-zA-Z]+$", "").replaceAll("[^A-Za-z0-9_-]", "_");
        Map<String, Object> info = studioShot(w.getUser().getId(), art, "auto", "defaults/studio/" + stem + "/",
                new br.com.fashionai.application.imaging.StudioPipeline.Hints(studioKind(w.getCategory(), w.getSubcategory()), Set.of(),
                        assets.defaultPieceLogo(w.getImageUrl()).orElse(null), "catalogo",
                        br.com.fashionai.application.imaging.FeedFraming.template(w.getCategory(), w.getSubcategory(), null)));
        if (info != null) {
            applyStudio(w, info, true);                         // arte padrão do catálogo: não há foto da pessoa a aprovar
        }
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
        List<Map<String, Object>> out = new ArrayList<>();
        out.add(Map.of("id", "auto", "label", Msg.t("wardrobe.automatico_contraste_com_a_peca")));
        for (var b : br.com.fashionai.application.imaging.StudioPipeline.BACKDROPS) {
            out.add(Map.of("id", b.id(), "label", b.label(), "hex", b.hex(), "edge", String.format("#%06X", b.edge())));
        }
        return out;
    }

    /**
     * Refaz o estúdio do rascunho com outro fundo (antes de salvar a peça). {@code force}: o recorte local foi marcado
     * como incerto (fundo parecido com a peça), mas a pessoa conferiu e quer usar mesmo assim.
     */
    @Transactional
    public Map<String, Object> studioDraft(CurrentUser user, UUID draftId, String backdrop, boolean force) {
        PipelineJob draft = jobs.findById(draftId).orElseThrow(() -> ApiException.notFound("Rascunho"));
        if (!draft.getUser().getId().equals(user.id())) {
            throw guard.deny(user, "draft:" + draftId, Msg.t("wardrobe.rascunho_de_outro_usuario"));
        }
        Map<String, Object> r = new LinkedHashMap<>(Json.map(draft.getResultJson()));
        if (!Boolean.TRUE.equals(r.get("backgroundRemoved")) && !force) {
            throw new ApiException(422, "SEM_RECORTE", r.get("backgroundWarning") != null
                    ? Msg.t("wardrobe.o_recorte_automatico_ficou_incerto", r.get("backgroundWarning"))
                    : Msg.t("wardrobe.o_estudio_precisa_do_fundo"));
        }
        byte[] png = r.get("studioSourceUrl") == null ? null : media.read(String.valueOf(r.get("studioSourceUrl"))).orElse(null);
        if (png == null) {
            png = media.read((String) r.get("processedUrl")).orElseThrow(() -> ApiException.notFound(Msg.t("wardrobe.recorte_do_rascunho")));
        }
        Map<?, ?> pf = r.get("prefill") instanceof Map<?, ?> m ? m : Map.of();
        Map<?, ?> flat = r.get("flatLayMetadata") instanceof Map<?, ?> m ? m : Map.of();
        var hints = studioHints(pf.get("category") == null ? null : String.valueOf(pf.get("category")),
                pf.get("subcategory") == null ? null : String.valueOf(pf.get("subcategory")), flat.get("truncated_sides"), pf.get("logo"));
        Map<String, Object> info = studioShot(user.id(), ImageOps.decode(png), backdrop == null ? "auto" : backdrop,
                "users/" + user.id() + "/drafts/" + draftId + "/", hints);
        if (info == null) {
            throw new ApiException(503, "ESTUDIO_INDISPONIVEL", Msg.t("wardrobe.nao_deu_para_gerar_o"));
        }
        if (!Boolean.TRUE.equals(r.get("backgroundRemoved"))) {
            info.put("forced", true);
        }
        r.put("studio", info);
        draft.setResultJson(Json.write(r));
        return info;
    }

    /** Gera (ou refaz) a foto de estúdio de uma peça já cadastrada a partir do recorte (em alta, quando guardado). */
    @Transactional
    public Views.PieceView studioPiece(CurrentUser user, UUID id, String backdrop) {
        guard.requireCanCreate(user);
        WardrobeItem w = owned(user, id);
        if (w.isDefaultImage() || w.getImageUrl() == null || w.getPhotoProcessingStatus() != PhotoProcessingStatus.COMPLETED) {
            throw new ApiException(422, "SEM_RECORTE", Msg.t("wardrobe.a_peca_precisa_de_uma"));
        }
        BufferedImage source = studioSource(w);
        if (source == null) {
            throw ApiException.notFound(Msg.t("wardrobe.foto_da_peca"));
        }
        Map<String, Object> info = studioShot(user.id(), source, backdrop == null ? "auto" : backdrop,
                "users/" + user.id() + "/pieces/" + id + "/", studioHints(w));
        if (info == null) {
            throw new ApiException(503, "ESTUDIO_INDISPONIVEL", Msg.t("wardrobe.nao_deu_para_gerar_o_2"));
        }
        offerStudio(w, info, false);                            // aprovada no ar → a nova fica pendente
        return Views.piece(w, viewerState(user, w), null);
    }

    /** Leva ao estúdio as peças do usuário que ainda não têm foto de estúdio (até 40 por chamada). */
    @Transactional
    public Map<String, Object> studioAll(CurrentUser user, String backdrop) {
        guard.requireCanCreate(user);
        int done = 0, skipped = 0;
        for (WardrobeItem w : pieces.findByUserIdOrderByCreatedAtDesc(user.id())) {
            if (done >= 40) {
                break;
            }
            if (w.getStudioImageUrl() != null || w.getPhotoProcessingStatus() != PhotoProcessingStatus.COMPLETED
                    || w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED) {
                skipped++;
                continue;
            }
            if (w.isDefaultImage()) {
                defaultStudio(w);
                if (w.getStudioImageUrl() != null) {
                    done++;
                } else {
                    skipped++;
                }
                continue;
            }
            BufferedImage source = studioSource(w);
            Map<String, Object> info = source == null ? null : studioShot(user.id(), source, backdrop == null ? "auto" : backdrop,
                    "users/" + user.id() + "/pieces/" + w.getId() + "/", studioHints(w));
            if (info == null) {
                skipped++;
                continue;
            }
            offerStudio(w, info, false);                        // sem estúdio antes: entra no ar aguardando aprovação
            done++;
        }
        return Map.of("generated", done, "skipped", skipped);
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
        WardrobeItem copy = new WardrobeItem();
        copy.setUser(owner);
        copy.setName(src.getName());
        copy.setCategory(src.getCategory());
        copy.setSubcategory(src.getSubcategory());
        copy.setSex(src.getSex());
        copy.setBrand(src.getBrand());
        copy.setBrandName(src.getBrandName());
        copy.setColor(src.getColor());
        copy.setMaterial(src.getMaterial());
        copy.setSizeLabel(src.getSizeLabel());
        copy.setMarket(src.getMarket());
        copy.setOccasionTags(src.getOccasionTags());
        copy.setStyleTags(src.getStyleTags());
        copy.setPrice(src.getPrice());
        copy.setImageUrl(src.getImageUrl());
        copy.setThumbnailUrl(src.getThumbnailUrl());
        copy.setStudioImageUrl(src.getStudioImageUrl());
        copy.setStudioBackdrop(src.getStudioBackdrop());
        copy.setStudioDetailUrl(src.getStudioDetailUrl());
        copy.setDefaultImage(src.isDefaultImage());
        copy.setModerationStatus(src.getModerationStatus());
        copy.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
        copy.setVisibility(AccountService.defaultVisibility(owner));
        copy.setRemixedFromPieceId(src.getId());
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
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("subcategories", Taxonomy.SUBCATEGORIES);
        out.put("colors", Taxonomy.COLORS);
        out.put("colorFamilies", Taxonomy.COLOR_FAMILY);
        out.put("materials", Taxonomy.MATERIALS);
        out.put("sizes", Taxonomy.SIZES);
        out.put("sexes", Taxonomy.SEXES);
        out.put("occasions", Taxonomy.OCCASIONS);
        out.put("styles", Taxonomy.STYLES);
        out.put("marketSeasons", Taxonomy.MARKET_SEASONS);
        out.put("marketGenders", Taxonomy.MARKET_GENDERS);
        Map<String, Object> allowed = new LinkedHashMap<>();
        Taxonomy.SUBCATEGORIES.keySet().forEach(c -> allowed.put(c, Taxonomy.allowedOccasions(c)));
        out.put("allowedOccasionsByCategory", allowed);
        out.put("wearstylesByPart", Taxonomy.WEARSTYLES_BY_PART);
        out.put("wearstyleGroups", Taxonomy.WEARSTYLE_GROUPS);
        // selos nunca são rótulos padronizados: vêm da análise da IA (marca/celebridade com peça semelhante — SealService)
        Map<String, String> defaults = new LinkedHashMap<>();
        defaults.put("generic", assets.defaultPieceImage(null, null));
        Taxonomy.SUBCATEGORIES.keySet().forEach(c -> defaults.put(c, assets.defaultPieceImage(c, null)));
        out.put("defaultImages", defaults);
        // imagem-asset de cada subtipo: a prévia do card troca a imagem ao escolher a subcategoria (peça ainda sem foto)
        Map<String, String> bySub = new LinkedHashMap<>();
        Taxonomy.SUBCATEGORIES.forEach((c, subs) -> subs.forEach(sub -> bySub.putIfAbsent(sub, assets.defaultPieceImage(c, sub))));
        out.put("defaultImagesBySubcategory", bySub);
        out.put("brands", brands.findAllByOrderByName().stream().map(b -> Map.of("id", b.getId(), "name", b.getName(),
                "slug", b.getSlug(), "logoUrl", String.valueOf(b.getLogoUrl()))).toList());
        return out;
    }

    // ------------------------------------------------------------------ util
    @SuppressWarnings("unchecked")
    static Map<String, Object> extractJson(String text) {
        if (text == null) {
            return Map.of();
        }
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return Map.of();
        }
        Map<String, Object> m = Json.map(text.substring(start, end + 1));
        return m == null ? Map.of() : m;
    }

    static String str(Object o) {
        return o == null ? null : String.valueOf(o).trim();
    }

    static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    static boolean contains(String hay, String needle) {
        return hay != null && needle != null && hay.toLowerCase(Locale.ROOT).contains(needle.toLowerCase(Locale.ROOT));
    }

    static <K, V> Map<K, V> enumMap(Class<K> k) {
        return new LinkedHashMap<>();
    }

    static final Set<String> UNUSED = Set.of();

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
