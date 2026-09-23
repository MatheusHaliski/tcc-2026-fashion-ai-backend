package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.assets.AssetCatalogService;
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
    private final AiEngine ai;
    private final MediaService media;
    private final AssetCatalogService assets;
    private final ProjectionService projections;
    private final NotificationService notifications;
    private final JobQueuePort queue;
    private final List<ImageProviderPorts.Model3dPort> model3d;
    private final Guard guard;
    private final Audit audit;
    private final boolean feature3d;
    private final ApplicationEventPublisher events;

    public WardrobeService(WardrobeItemRepository pieces, UserRepository users, BrandRepository brands,
                           PipelineJobRepository jobs, ProcessingJobLogRepository processingLogs,
                           QualityScoreRepository qualityScores, ModerationQueueRepository moderationQueue,
                           SchemeItemRepository schemeItems, SchemeRepository schemes, ReactionRepository reactions,
                           SavedItemRepository saved, PhotoRepository photos, FlatLayPipeline flatLay, AiEngine ai,
                           MediaService media, AssetCatalogService assets, ProjectionService projections,
                           NotificationService notifications, JobQueuePort queue,
                           List<ImageProviderPorts.Model3dPort> model3d, Guard guard, Audit audit,
                           @Value("${fashionai.features.rf16-3d:false}") boolean feature3d,
                           ApplicationEventPublisher events) {
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
        this.ai = ai;
        this.media = media;
        this.assets = assets;
        this.projections = projections;
        this.notifications = notifications;
        this.queue = queue;
        this.model3d = model3d;
        this.guard = guard;
        this.audit = audit;
        this.feature3d = feature3d;
        this.events = events;
    }

    // ================================================================== RF4 — análise da foto (rascunho)
    public record Prefill(String name, String category, String subcategory, String color, String material, String brand,
                          String sex, List<String> occasion, List<String> style, List<String> seals,
                          Map<String, Double> confidence, double overall, boolean manualFillRequired, String warning) {
    }

    public record Draft(UUID draftId, String processedUrl, String flatLayUrl, String thumbnailUrl, String originalUrl,
                        Prefill prefill, Map<String, Object> quality, Map<String, Object> moderation,
                        List<FlatLayPipeline.Stage> stages, BigDecimal costUsd, long totalMs, boolean backgroundRemoved,
                        boolean reprocessPending, AiOutcome.Explanation explanation, String aiMessage,
                        AiOutcome.Quota quota) {
    }

    /** RF4.CA01–CA03/CA06: valida, padroniza (Flat Lay), modera e pré-preenche; nada vai ao acervo ainda. */
    @Transactional
    public Draft analyze(CurrentUser user, byte[] bytes) {
        guard.requireCanCreate(user);
        ImageOps.requireAcceptedImage(bytes);
        User owner = users.findById(user.id()).orElseThrow(() -> ApiException.notFound("Usuário"));
        AiOutcome<FlatLayPipeline.Result> pipeline = ai.execute(user.id(), AiCapability.FLAT_LAY_STANDARDIZER,
                List.of("foto enviada (" + bytes.length / 1024 + " KB)"), null, null,
                List.of(new AiEngine.RemoteStep<>() {
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
                }), () -> flatLay.run(bytes, false));
        FlatLayPipeline.Result r = pipeline.value();
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

        // Moderação (#2) — nunca aprova por omissão.
        ImageOps.Cutout cutout = r.cutout();
        LocalVision.ModerationVerdict localVerdict = LocalVision.moderate(r.original(), cutout);
        AiOutcome<LocalVision.ModerationVerdict> moderation = ai.text(new AiEngine.TextCall<>(user.id(),
                AiCapability.CONTENT_MODERATOR, MODERATION_SYSTEM, "Classifique a imagem anexada.",
                List.of(new AiRequest.AiImage(ImageOps.jpeg(ImageOps.scaleToFit(r.original(), 768, 768), 0.85f), "image/jpeg")),
                400, List.of("foto da peça (reduzida a 768 px)"), this::parseModeration, () -> localVerdict, null));
        LocalVision.ModerationVerdict verdict = moderation.value();

        // Detecção (#1) — pré-preenchimento só com confiança suficiente (RF4.CA02/CA03).
        LocalVision.PieceGuess localGuess = LocalVision.analyzePiece(cutout);
        AiOutcome<LocalVision.PieceGuess> analysis = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.PIECE_ANALYZER,
                ANALYZER_SYSTEM, "Analise a peça de roupa da imagem anexada e responda só com o JSON.",
                List.of(new AiRequest.AiImage(ImageOps.png(ImageOps.scaleToFit(ImageOps.composeCentered(
                        ImageOps.crop(cutout.image(), ImageOps.alphaBounds(cutout.image())), 768, 0.06, java.awt.Color.WHITE, false), 768, 768)), "image/png")),
                600, List.of("foto padronizada da peça", "vocabulário da taxonomia v3.7"), this::parseAnalysis, () -> localGuess, null));
        Prefill prefill = prefill(analysis.value());

        Map<String, Object> quality = new LinkedHashMap<>();
        quality.put("metrics", r.quality().metrics());
        quality.put("overall", r.quality().overall());
        quality.put("accepted", r.quality().accepted());
        quality.put("threshold", br.com.fashionai.application.imaging.QualityMetrics.ACCEPTANCE_THRESHOLD);
        quality.put("issues", r.quality().issues());
        quality.put("recommendations", r.quality().recommendations());
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
        result.put("flatLayMetadata", r.metadata());
        result.put("quality", quality);
        result.put("moderation", mod);
        result.put("prefill", prefill);
        result.put("aiInferences", List.of(pipeline.inferenceId(), moderation.inferenceId(), analysis.inferenceId()));
        job.setResultJson(Json.write(result));
        job.setStagesJson(Json.write(r.stages()));
        job.setQualityScore(BigDecimal.valueOf(r.quality().overall()));
        job.setTotalCostUsd(r.totalCostUsd().add(moderation.costUsd()).add(analysis.costUsd()));
        job.setTotalTimeMs((int) r.totalMs());
        job.setFallbackUsed(r.fallbackUsed() || analysis.fallbackUsed());
        job.setOutputUrl(processed.url());
        job.setFinishedAt(Instant.now());
        String message = analysis.userMessage() != null ? analysis.userMessage() : pipeline.userMessage();
        return new Draft(job.getId(), processed.url(), white.url(), thumb.url(), original.url(), prefill, quality, mod,
                r.stages(), job.getTotalCostUsd(), r.totalMs(), r.backgroundRemoved(), !r.backgroundRemoved(),
                analysis.explanation(), message, analysis.quota());
    }

    /** RF4.CA05 — várias fotos: um rascunho por foto, revisáveis antes de confirmar o lote. */
    public List<Draft> analyzeBatch(CurrentUser user, List<byte[]> files) {
        if (files == null || files.isEmpty()) {
            throw ApiException.badRequest("SEM_FOTOS", "Envie ao menos uma foto.");
        }
        if (files.size() > 12) {
            throw ApiException.badRequest("LOTE_GRANDE", "Envie no máximo 12 fotos por lote.");
        }
        List<Draft> drafts = new ArrayList<>();
        for (byte[] f : files) {
            drafts.add(analyze(user, f));
        }
        return drafts;
    }

    static final String ANALYZER_SYSTEM = """
            Você é o Piece Analyzer do Fashion AI. Identifique a peça de roupa da imagem e responda SOMENTE com JSON:
            {"name": string, "category": one of [upper_piece, lower_piece, shoes_piece, accessory_piece, full_body_piece],
             "subcategory": string (código da taxonomia, ex.: t_shirt, jeans, casual_sneakers, handbag, dress),
             "color": código da paleta (ex.: black, white, navy, denim, beige, red, olive, multicolor, print),
             "material": one of [COTTON, POLYESTER, WOOL, SILK, LEATHER, SYNTHETIC, BLEND],
             "brand": string ou null (só se o logotipo for legível), "sex": one of [MASCULINO, FEMININO, UNISSEX],
             "occasion": até 2 códigos, "style": até 2 códigos,
             "confidence": {"category": 0-1, "subcategory": 0-1, "color": 0-1, "material": 0-1, "brand": 0-1}}
            Nunca descreva pessoas. Se não houver peça de roupa, devolva confidence 0 em tudo.""";

    static final String MODERATION_SYSTEM = """
            Você é o Content Moderator do Fashion AI. Avalie a imagem e responda SOMENTE com JSON:
            {"isClothing": boolean, "safe": boolean, "categories": [strings de violação, ex.: nudity, violence, hate, minor],
             "confidence": 0-1}. Em dúvida, safe=false.""";

    LocalVision.PieceGuess parseAnalysis(String text) {
        Map<String, Object> m = extractJson(text);
        if (m.isEmpty()) {
            return null;
        }
        String category = str(m.get("category"));
        String sub = str(m.get("subcategory"));
        if (sub != null && Taxonomy.categoryOf(sub) != null) {
            category = Taxonomy.categoryOf(sub);
        } else if (!Taxonomy.isValidCategory(category)) {
            category = null;
            sub = null;
        } else {
            sub = null;
        }
        String color = Taxonomy.COLORS.containsKey(str(m.get("color"))) ? str(m.get("color")) : null;
        String material = Taxonomy.MATERIALS.contains(str(m.get("material"))) ? str(m.get("material")) : null;
        String sex = Taxonomy.SEXES.contains(str(m.get("sex"))) ? str(m.get("sex")) : null;
        Map<String, Double> conf = new LinkedHashMap<>();
        Object c = m.get("confidence");
        if (c instanceof Map<?, ?> cm) {
            cm.forEach((k, v) -> conf.put(String.valueOf(k), v instanceof Number n ? n.doubleValue() : 0.0));
        }
        double overall = conf.values().stream().mapToDouble(Double::doubleValue).average().orElse(0.5);
        LocalVision.PieceGuess g = new LocalVision.PieceGuess(category, sub, color, material, str(m.get("brand")), sex, conf,
                Math.round(overall * 100) / 100.0, List.of());
        return new LocalVision.PieceGuess(g.category(), g.subcategory(), g.color(), g.material(), g.brand(), g.sex(),
                g.confidence(), g.overall(), List.of());
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
                    conf, cats.isEmpty() ? List.of("conteúdo possivelmente impróprio") : cats, true);
        }
        if (!clothing) {
            return new LocalVision.ModerationVerdict(conf >= 0.85 ? ModerationStatus.REJECTED_NOT_CLOTHING : ModerationStatus.PENDING,
                    conf, List.of("a imagem não parece ser uma peça de roupa"), true);
        }
        return new LocalVision.ModerationVerdict(conf >= 0.6 ? ModerationStatus.APPROVED : ModerationStatus.PENDING, conf,
                List.of("peça de roupa, sem violação"), conf < 0.6);
    }

    private Prefill prefill(LocalVision.PieceGuess g) {
        Map<String, Double> c = g.confidence() == null ? Map.of() : g.confidence();
        boolean manual = g.overall() < LocalVision.PREFILL_CONFIDENCE;
        String category = keep(g.category(), c.get("category"));
        String sub = keep(g.subcategory(), c.get("subcategory"));
        String color = keep(g.color(), c.get("color"));
        String material = keep(g.material(), c.get("material"));
        String brand = keep(g.brand(), c.get("brand"));
        String name = sub == null ? null : humanize(sub) + (color == null ? "" : " " + humanize(color));
        return new Prefill(manual ? null : name, manual ? null : category, manual ? null : sub, color, manual ? null : material,
                brand, manual ? null : g.sex(), List.of(), List.of(), List.of(), c, g.overall(), manual,
                manual ? "A IA não reconheceu a peça com confiança suficiente. Preencha os campos manualmente." : null);
    }

    private static String keep(String value, Double confidence) {
        return value != null && confidence != null && confidence >= LocalVision.PREFILL_CONFIDENCE ? value : null;
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
                            Boolean forSale) {
    }

    @Transactional
    public Views.PieceView create(CurrentUser user, PieceForm form) {
        guard.requireCanCreate(user);
        User owner = users.findById(user.id()).orElseThrow(() -> ApiException.notFound("Usuário"));
        validate(form);
        WardrobeItem w = new WardrobeItem();
        w.setUser(owner);
        apply(w, form, true);
        w.setVisibility(form.visibility() != null ? form.visibility() : AccountService.defaultVisibility(owner));
        PipelineJob draft = form.draftId() == null ? null : jobs.findById(form.draftId()).orElse(null);
        if (draft != null && !draft.getUser().getId().equals(owner.getId())) {
            throw guard.deny(user, "draft:" + form.draftId(), "Rascunho de outro usuário.");
        }
        if (draft == null && !form.useDefaultImage()) {
            throw ApiException.badRequest("FOTO_OBRIGATORIA", "Envie uma foto ou escolha usar a imagem padrão da peça.");
        }
        if (draft == null) {
            // imagem padrão da peça (/public/assets_pecas) quando o usuário deixa a foto vazia.
            String url = assets.defaultPieceImage(w.getCategory(), w.getSubcategory());
            w.setImageUrl(url);
            w.setThumbnailUrl(url);
            w.setOriginalImageUrl(null);
            w.setDefaultImage(true);
            w.setModerationStatus(ModerationStatus.APPROVED);
            w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
            pieces.save(w);
        } else {
            Map<String, Object> r = Json.map(draft.getResultJson());
            Map<?, ?> mod = (Map<?, ?>) r.getOrDefault("moderation", Map.of());
            Object modStatus = mod.get("status");
            ModerationStatus moderation = ModerationStatus.valueOf(modStatus == null ? "PENDING" : String.valueOf(modStatus));
            if (moderation == ModerationStatus.REJECTED_POLICY) {
                throw ApiException.badRequest("CONTEUDO_BLOQUEADO", "A foto viola a política de conteúdo e não pode ser usada.");
            }
            boolean bgRemoved = Boolean.TRUE.equals(r.get("backgroundRemoved"));
            w.setImageUrl(bgRemoved ? (String) r.get("processedUrl") : (String) r.get("originalUrl"));
            w.setOriginalImageUrl((String) r.get("originalUrl"));
            w.setThumbnailUrl((String) r.get("thumbnailUrl"));
            w.setDefaultImage(false);
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
                "Peça adicionada ao guarda-roupa", w.getName() + " já está no seu Closet Digital.", null);
        audit.log(user, AuditActions.CADASTRO_PECA, "piece:" + w.getId(), Map.of("category", w.getCategory(),
                "defaultImage", w.isDefaultImage()));
        // RF32.CA02 (endereço automático), RF35 (pontos), RF34 (histórico de disponibilidade)
        events.publishEvent(new DomainEvents.PieceCreated(owner.getId(), w.getId(), InventoryScoreService.catalogReady(w)));
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
        ProcessingJobLog log = new ProcessingJobLog();
        log.setId(UUID.randomUUID());
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
        Taxonomy.requirePiece(f.category(), f.subcategory(), f.sex(), f.color(), f.material(), f.size(), f.occasion(), f.style());
        Map<String, Object> errors = new LinkedHashMap<>();
        if (f.name() == null || f.name().isBlank()) {
            errors.put("name", "Informe o nome da peça.");
        }
        if (f.price() == null || f.price().signum() < 0) {
            errors.put("price", "Informe o preço (USD).");
        }
        if (f.seals() != null && f.seals().size() > 2) {
            errors.put("seals", "Máximo de 2 selos sugeridos por peça.");
        }
        if (!Taxonomy.isValidMarket(f.market())) {
            errors.put("market", "Mercado inválido (estação_gênero, ex.: summer_female).");
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", "Corrija os campos destacados.", errors);
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
        w.setOccasionTags(Json.csv(f.occasion()));
        w.setStyleTags(Json.csv(f.style()));
        w.setSealIdsJson(Json.write(f.seals() == null ? List.of() : f.seals()));
        w.setPrice(f.price());
        w.setTags(Json.csv(f.tags()));
        w.setNotes(InputSanitizer.clean(f.notes(), 1000));
        w.setCondition(f.condition() == null ? (creating ? ItemCondition.GOOD : w.getCondition()) : f.condition());
        w.setPurchaseDate(f.purchaseDate());
        w.setPurchaseLocation(InputSanitizer.clean(f.purchaseLocation(), 160));
        w.setSku(InputSanitizer.clean(f.sku(), 80));
        w.setCareInstructions(InputSanitizer.clean(f.careInstructions(), 500));
        if (f.forSale() != null) {
            w.setForSale(f.forSale());
        }
        resolveBrand(w, f.brandId(), f.brandName());
    }

    /** Brand Resolver (#9): brandId → match fuzzy local → texto livre. Nunca cria Brand por omissão. */
    private void resolveBrand(WardrobeItem w, UUID brandId, String brandName) {
        if (brandId != null) {
            Brand b = brands.findById(brandId).orElseThrow(() -> ApiException.badRequest("MARCA_INVALIDA", "Marca não encontrada."));
            w.setBrand(b);
            w.setBrandName(b.getName());
            w.setBrandProfile(b.getBrandProfile());
            return;
        }
        if (brandName == null || brandName.isBlank()) {
            w.setBrand(null);
            w.setBrandName(null);
            return;
        }
        LocalAdvisors.BrandResolution res = LocalAdvisors.resolveBrand(brandName, brands.findAllByOrderByName());
        if (res.match() != null) {
            w.setBrand(res.match());
            w.setBrandName(res.match().getName());
            w.setBrandProfile(res.match().getBrandProfile());
        } else {
            w.setBrand(null);
            w.setBrandName(InputSanitizer.clean(brandName, 80));
        }
    }

    // ================================================================== RF6 — Closet Digital
    public record ClosetFilter(String category, String color, String season, String occasion, String style, String state,
                               String q, String sort, int page, int size) {
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
        Comparator<WardrobeItem> order = switch (f.sort() == null ? "recent" : f.sort()) {
            case "hype" -> Comparator.comparing((WardrobeItem w) -> w.getHypeScore() == null ? BigDecimal.ZERO : w.getHypeScore()).reversed();
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

    private static boolean stateMatches(WardrobeItem w, String state) {
        if (blank(state) || "todos".equalsIgnoreCase(state)) {
            return true;
        }
        return switch (state.toLowerCase(Locale.ROOT)) {
            case "favoritos", "favorites" -> w.isFavorite();
            case "disponivel", "available" -> w.isDisponivel();
            case "indisponivel", "unavailable" -> !w.isDisponivel();
            case "venda", "for_sale" -> w.isForSale();
            default -> true;
        };
    }

    // ================================================================== RF7 — detalhe
    @Transactional
    public Map<String, Object> detail(CurrentUser viewer, UUID id, UUID fromSchemeId) {
        WardrobeItem w = pieces.findById(id).orElseThrow(() -> ApiException.notFound("Peça"));
        boolean owner = viewer != null && viewer.id().equals(w.getUser().getId());
        Map<String, Object> out = new LinkedHashMap<>();
        if (w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED && !owner) {
            // RF7.CA03 — snapshot do momento da publicação, marcado como "não mais disponível".
            SchemeItem snap = fromSchemeId == null ? null : schemeItems.findBySchemeIdOrderBySortOrder(fromSchemeId).stream()
                    .filter(si -> si.getWardrobeItem().getId().equals(id)).findFirst().orElse(null);
            out.put("notAvailableAnymore", true);
            out.put("snapshot", snap == null ? Views.snapshot(w) : Json.map(snap.getSnapshotJson()));
            out.put("fromSchemeId", fromSchemeId);
            return out;
        }
        guard.requireView(viewer, w.getUser().getId(), effectiveVisibility(w), "piece:" + id);
        // Atualização direta (sem @Version): o detalhe é aberto em paralelo (ex.: antes/depois de a sessão carregar)
        // e mexer na entidade gerava conflito de versão (409) num simples GET.
        pieces.touchView(w.getId(), owner ? 0 : 1, Instant.now());
        out.put("piece", Views.piece(w, viewerState(viewer, w), reactionCounts(TargetType.PIECE, w.getId())));
        out.put("fromSchemeId", fromSchemeId);
        out.put("wearstyles", Taxonomy.wearstylesOf(w.getCategory(), Json.csv(w.getOccasionTags())));
        // RF19.CA14 — "retornar": esquemas de origem que usaram esta peça.
        List<Map<String, Object>> origins = new ArrayList<>();
        for (SchemeItem si : schemeItems.findByWardrobeItemId(id)) {
            Scheme s = si.getScheme();
            if (guard.canView(viewer, s.getUser().getId(), s.getVisibility()) && s.getStatus() != SchemeStatus.ARCHIVED) {
                origins.add(Map.of("schemeId", s.getId(), "title", s.getTitle(), "coverImageUrl", String.valueOf(s.getCoverImageUrl())));
            }
        }
        out.put("originSchemes", origins);
        out.put("canEdit", owner);
        return out;
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

    // ================================================================== RF31 — toggles da faixa superior
    @Transactional
    public Views.PieceView toggles(CurrentUser user, UUID id, Boolean favorite, Boolean disponivel, Boolean forSale) {
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
        if (forSale != null) {
            w.setForSale(forSale);
        }
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
                "message", uses.isEmpty() ? "A peça não está em nenhum esquema."
                        : "A peça está em " + uses.stream().map(si -> si.getScheme().getId()).distinct().count()
                        + " esquema(s). Os já publicados mantêm o histórico da peça (snapshot).");
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
        events.publishEvent(new DomainEvents.PieceDeleted(user.id(), id));
        audit.log(user, AuditActions.EXCLUSAO_PECA, "piece:" + id, Map.of("schemesAffected", impact.get("schemesAffected")));
        return impact;
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
        w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
        audit.log(user, AuditActions.EDICAO_PECA, "piece:" + id, Map.of("field", "image"));
        return Views.piece(w, viewerState(user, w), null);
    }

    /** RF18.CA05 / RF15.CA01 — remoção de fundo sob demanda (falha é informada sem travar as demais ferramentas). */
    @Transactional
    public Map<String, Object> removeBackground(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        WardrobeItem w = owned(user, id);
        byte[] bytes = media.read(w.getOriginalImageUrl() != null ? w.getOriginalImageUrl() : w.getImageUrl())
                .orElseThrow(() -> new ApiException(422, "SEM_IMAGEM", "Esta peça não tem foto armazenada para remover o fundo."));
        FlatLayPipeline.Result r = flatLay.run(bytes, true);
        if (!r.backgroundRemoved()) {
            return Map.of("ok", false, "message", "Não foi possível remover o fundo agora; a sobreposição fica aproximada.",
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
            if (w == null || !flatLay.externalAvailable()) {
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
                FlatLayPipeline.Result r = flatLay.run(bytes, true);
                if (r.backgroundRemoved()) {
                    String base = "users/" + w.getUser().getId() + "/pieces/" + w.getId() + "/reprocessed";
                    w.setImageUrl(media.put(base + ".png", r.processedPng(), "image/png").url());
                    w.setThumbnailUrl(media.put(base + "-thumb.png", r.thumbnailPng(), "image/png").url());
                    w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
                    w.setFlatLayMetadataJson(Json.write(r.metadata()));
                    job.setStatus(PipelineJobStatus.COMPLETED);
                    notifications.notify(w.getUser().getId(), null, NotificationType.AI_JOB_FINISHED, "PIECE", w.getId(),
                            "Foto da peça padronizada", "O fundo de " + w.getName() + " foi removido.", null);
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

    // ================================================================== RF16 — 3D (tema futuro, feature flag)
    @Transactional
    public Map<String, Object> request3d(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        WardrobeItem w = owned(user, id);
        if (!feature3d) {
            throw new ApiException(409, "RECURSO_FUTURO",
                    "A geração 3D (RF16) é tema futuro e está desligada nesta versão. A peça continua em 2D.");
        }
        boolean retryFree = w.getModel3dStatus() == Model3dStatus.FAILED;
        PipelineJob job = new PipelineJob();
        job.setUser(w.getUser());
        job.setType(PipelineJobType.THREE_D_GENERATION);
        job.setStatus(PipelineJobStatus.PENDING);
        job.setInputResourceId(id);
        job.setTargetType("PIECE");
        job.setQueuedAt(Instant.now());
        job.setRetryCount(retryFree ? 1 : 0);
        jobs.save(job);
        w.setModel3dStatus(Model3dStatus.QUEUED);
        Optional<ImageProviderPorts.Model3dPort> port = model3d.stream().filter(ImageProviderPorts.Model3dPort::available).findFirst();
        if (port.isPresent()) {
            media.read(w.getImageUrl()).flatMap(b -> port.get().submit(b)).ifPresent(ext -> {
                job.setExternalJobId(ext);
                job.setStatus(PipelineJobStatus.RUNNING);
                w.setModel3dStatus(Model3dStatus.PROCESSING);
            });
        }
        return Map.of("jobId", job.getId(), "status", w.getModel3dStatus(), "freeRetry", retryFree);
    }

    public Map<String, Object> status3d(CurrentUser user, UUID id) {
        WardrobeItem w = owned(user, id);
        return Map.of("status", String.valueOf(w.getModel3dStatus()), "modelUrl", String.valueOf(w.getModel3dUrl()),
                "featureEnabled", feature3d);
    }

    // ================================================================== "Adicionar" (copiar peça pública)
    @Transactional
    public Views.PieceView addToWardrobe(CurrentUser user, UUID sourceId) {
        guard.requireCanCreate(user);
        WardrobeItem src = pieces.findById(sourceId).orElseThrow(() -> ApiException.notFound("Peça"));
        guard.requireView(user, src.getUser().getId(), src.getVisibility(), "piece:" + sourceId);
        if (src.getUser().getId().equals(user.id())) {
            throw ApiException.conflict("JA_E_SUA", "Esta peça já está no seu guarda-roupa.");
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
        WardrobeItem w = pieces.findById(id).orElseThrow(() -> ApiException.notFound("Peça"));
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
        out.put("pieceSeals", List.of("premium", "eco-friendly", "trending", "limited-edition", "exclusive", "budget-friendly",
                "luxury", "casual-chic"));
        out.put("schemeSeals", List.of("affordable-chic", "premium-look", "eco-conscious", "trendy-combo", "casual-elegance"));
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
