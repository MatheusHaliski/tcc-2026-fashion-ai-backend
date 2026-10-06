package br.com.fashionai.application.lens;

import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.hype.RecommendationScoring;
import br.com.fashionai.application.hype.StyleCompatibility;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.MediaService;
import br.com.fashionai.application.service.MultiPieceService;
import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.vision.analysis.GarmentEmbedder;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.GarmentEmbedding;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensFeedback;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.model.PieceImage;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ConsentPurpose;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.LensDetectionStatus;
import br.com.fashionai.domain.model.enums.LensFeedbackKind;
import br.com.fashionai.domain.model.enums.LensIntent;
import br.com.fashionai.domain.model.enums.LensScanStatus;
import br.com.fashionai.domain.model.enums.LensSource;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.GarmentEmbeddingRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.LensDetectionRepository;
import br.com.fashionai.domain.repository.LensFeedbackRepository;
import br.com.fashionai.domain.repository.LensScanRepository;
import br.com.fashionai.domain.repository.PieceImageRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserConsentRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * RF54 · FashionAI Lens (docs/novos-rf/RF54_FashionAI_Lens.md). Transforma uma foto de moda numa decisão de estilo
 * pessoal: lê as peças ({@link MultiPieceService#detectPieces}, o mesmo núcleo do cadastro de várias peças, pelo
 * {@code AiEngine} — consentimento, cota, orçamento e fallback local), e liga cada uma ao guarda-roupa, ao DNA, ao Hype
 * do grupo e ao plano "Recriar".
 * <ul>
 *   <li><b>Privado:</b> todo scan é do dono; qualquer outra pessoa recebe 404 (nunca 403, não revela que existe). A
 *       imagem fica em {@code restricted/users/{id}/lens/…}, regravada em JPEG sem metadados, e só sai por
 *       {@link #image}.</li>
 *   <li><b>Camada viva calculada na leitura:</b> correspondências, compatibilidade, Hype do grupo e plano são
 *       recalculados a cada pedido (refletem o guarda-roupa, o DNA e o Hype de agora). Nada disso é gravado.</li>
 *   <li><b>Nunca gera Hype:</b> este serviço não publica eventos nem escreve em {@code hype_signal_daily}; só lê
 *       {@code hype_scores} públicos.</li>
 *   <li><b>Retenção:</b> sem salvar como inspiração, o scan expira em 30 dias ({@link #purgeExpired}); excluir a conta
 *       apaga tudo ({@link #deleteAllFor}).</li>
 * </ul>
 */
@Service
public class LensService {
    private static final Logger log = LoggerFactory.getLogger(LensService.class);
    static final String QUOTA_BUCKET = "lens:scan";
    /** Leitura local porque a foto chegou sem a confirmação de que os rostos foram protegidos (não foi à IA externa). */
    static final String REDACTION_UNCONFIRMED = "REDACTION_UNCONFIRMED";
    private static final DateTimeFormatter HOUR = DateTimeFormatter.ofPattern("dd/MM HH:mm").withZone(ZoneId.of("America/Sao_Paulo"));
    static final Set<String> PATTERNS = Set.of("solid", "striped", "checked", "printed");
    /** Lado menor mínimo (em %) de uma caixa marcada pela pessoa — a mesma regra do detector de várias peças. */
    static final double MIN_BOX_PCT = 3.0;
    /** Cores que não são uma cor (estampa, multicolor): não entram no ΔE. */
    private static final Set<String> NOT_A_HUE = Set.of("multicolor", "print");
    /** Slots do plano "Recriar" (chaves aceitas em {@code locked}, além do id da peça detectada). */
    static final Set<String> SLOTS = Set.of("TOP", "BOTTOM", "FULL", "SHOES", "ACCESSORY");

    private final LensScanRepository scans;
    private final LensDetectionRepository detections;
    private final LensFeedbackRepository feedback;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final StyleDnaRepository dnas;
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;
    private final GarmentEmbeddingRepository embeddings;
    private final PieceImageRepository pieceImages;
    private final UserConsentRepository consents;
    private final MultiPieceService multiPiece;
    private final MediaStoragePort storage;
    private final MediaService media;
    private final RateLimitPort rateLimit;
    private final WardrobeService wardrobe;
    private final Guard guard;
    private final LensConfig config;

    public LensService(LensScanRepository scans, LensDetectionRepository detections, LensFeedbackRepository feedback,
                       WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                       StyleDnaRepository dnas, HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig,
                       GarmentEmbeddingRepository embeddings, PieceImageRepository pieceImages,
                       UserConsentRepository consents, MultiPieceService multiPiece, MediaStoragePort storage,
                       MediaService media, RateLimitPort rateLimit, WardrobeService wardrobe, Guard guard, LensConfig config) {
        this.scans = scans;
        this.detections = detections;
        this.feedback = feedback;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dnas = dnas;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
        this.embeddings = embeddings;
        this.pieceImages = pieceImages;
        this.consents = consents;
        this.multiPiece = multiPiece;
        this.storage = storage;
        this.media = media;
        this.rateLimit = rateLimit;
        this.wardrobe = wardrobe;
        this.guard = guard;
        this.config = config;
    }

    // ================================================================== comandos

    /** Partes do multipart do {@code POST /api/lens/scans}. */
    public record CreateCommand(String source, String intent, Integer facesRedacted, Boolean redactionConfirmed) {
    }

    public record FromAppCommand(String type, UUID id) {
    }

    public record BoxInput(Double x, Double y, Double w, Double h) {
    }

    public record AddDetectionCommand(BoxInput box, String category, String subcategory, String color) {
    }

    public record CorrectionCommand(String category, String subcategory, String color, String material, String pattern,
                                    List<String> styles, Boolean dismissed) {
    }

    public record RecreateCommand(String mode, UUID focus, Map<String, String> locked) {
    }

    // ================================================================== criar

    /**
     * Scan de uma foto enviada (câmera, galeria ou arquivo). A foto já chega com os rostos borrados no aparelho e passou
     * pela moderação do upload ({@code UploadSafetyInterceptor}); aqui é orientada (EXIF), reduzida a 2048 px e regravada
     * sem metadados antes de ser lida e guardada. Síncrono no MVP: devolve o scan pronto.
     */
    @Transactional
    public LensViews.ScanView create(CurrentUser user, CreateCommand cmd, byte[] bytes) {
        guard.requireCanCreate(user);
        LensSource source = parseEnum(LensSource.class, cmd == null ? null : cmd.source(), LensSource.UPLOAD, "source");
        if (source.inApp()) {
            throw ApiException.badRequest("ORIGEM_INVALIDA", Msg.t("lens.origem_invalida"), Map.of("field", "source"));
        }
        LensIntent intent = parseEnum(LensIntent.class, cmd == null ? null : cmd.intent(), LensIntent.IDENTIFY, "intent");
        if (bytes == null || bytes.length == 0) {
            throw ApiException.badRequest("ARQUIVO_VAZIO", Msg.t("uploads.envie_uma_imagem"));
        }
        ImageOps.requireAcceptedImage(bytes);
        BufferedImage photo = ImageOps.scaleToFit(ImageOps.decode(bytes), LensConfig.IMAGE_MAX_SIDE, LensConfig.IMAGE_MAX_SIDE);
        int faces = cmd == null || cmd.facesRedacted() == null ? 0 : Math.max(0, Math.min(500, cmd.facesRedacted()));
        boolean confirmed = cmd != null && Boolean.TRUE.equals(cmd.redactionConfirmed());
        acquireQuota(user);
        return process(user, source, null, intent, photo, faces, confirmed);
    }

    /**
     * "Ver no Lens": scan da foto de uma peça ou look do app — só se quem pede pode ver o original (dono, ou visibilidade
     * efetiva e moderação aprovada, sem bloqueio). Qualquer outro caso é 404, sem revelar que existe. Nada é registrado
     * como visualização (o Lens nunca gera sinal de Hype).
     */
    @Transactional
    public LensViews.ScanView fromApp(CurrentUser user, FromAppCommand cmd) {
        guard.requireCanCreate(user);
        if (cmd == null || cmd.id() == null || cmd.type() == null) {
            throw ApiException.badRequest("TIPO_INVALIDO", Msg.t("lens.tipo_invalido"), Map.of("field", "type"));
        }
        String type = cmd.type().trim().toUpperCase(Locale.ROOT);
        List<String> urls;
        LensSource source;
        if ("PIECE".equals(type)) {
            WardrobeItem w = pieces.findById(cmd.id()).filter(p -> visiblePiece(user, p))
                    .orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            source = LensSource.IN_APP_PIECE;
            urls = new ArrayList<>();
            if (!w.isDefaultImage()) {
                urls.add(w.getStudioImageUrl());
                urls.add(w.getImageUrl());
                urls.add(w.getOriginalImageUrl());
            }
        } else if ("LOOK".equals(type)) {
            Scheme s = schemes.findById(cmd.id()).filter(x -> visibleScheme(user, x))
                    .orElseThrow(() -> ApiException.notFound(Msg.t("lens.look")));
            source = LensSource.IN_APP_LOOK;
            urls = new ArrayList<>();
            urls.add(s.getCoverImageUrl());
        } else {
            throw ApiException.badRequest("TIPO_INVALIDO", Msg.t("lens.tipo_invalido"), Map.of("field", "type"));
        }
        BufferedImage photo = null;
        for (String url : urls) {
            Optional<byte[]> bytes = url == null ? Optional.empty() : media.read(url);
            if (bytes.isPresent()) {
                try {
                    photo = ImageOps.decode(bytes.get());
                    break;
                } catch (ApiException ex) {
                    // formato que o servidor não lê: tenta a próxima versão da foto
                }
            }
        }
        if (photo == null) {
            throw new ApiException(422, "LENS_SEM_IMAGEM", Msg.t("lens.sem_imagem"));
        }
        acquireQuota(user);
        return process(user, source, cmd.id(), LensIntent.IDENTIFY,
                ImageOps.scaleToFit(photo, LensConfig.IMAGE_MAX_SIDE, LensConfig.IMAGE_MAX_SIDE), 0, false);
    }

    /** Cota diária por pessoa (RateLimitPort): estourada, 429 QUOTA com o horário de volta; nada é gravado. */
    void acquireQuota(CurrentUser user) {
        int limit = config.dailyScans();
        Duration day = Duration.ofDays(1);
        if (!rateLimit.tryAcquire(user.id(), QUOTA_BUCKET, limit, day)) {
            RateLimitPort.QuotaStatus st = rateLimit.status(user.id(), QUOTA_BUCKET, limit, day);
            Instant reset = st == null || st.resetAt() == null ? Instant.now().plus(day) : st.resetAt();
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("limit", limit);
            details.put("used", st == null ? limit : st.used());
            details.put("resetAt", reset.toString());
            throw new ApiException(429, "QUOTA", Msg.t("lens.cota_diaria", limit, HOUR.format(reset)), details);
        }
    }

    /**
     * Detecta, lê cada recorte, grava a imagem limpa e as peças; o scan sai pronto (MVP síncrono).
     * <p>
     * Só vai para a IA externa a foto cujo cliente confirmou a proteção dos rostos ({@code redactionConfirmed}: o borrão
     * rodou no aparelho ou a pessoa confirmou que a foto não mostra rostos). Sem isso — cliente antigo, chamada direta ou
     * "Ver no Lens" (o servidor ainda não borra rostos) — a leitura é só local e a imagem não sai do servidor; o scan
     * avisa o motivo ({@value #REDACTION_UNCONFIRMED}).
     */
    LensViews.ScanView process(CurrentUser user, LensSource source, UUID refId, LensIntent intent, BufferedImage photo,
                               int faces, boolean redactionConfirmed) {
        MultiPieceService.PieceDetection det = null;
        if (!redactionConfirmed) {
            det = new MultiPieceService.PieceDetection(List.of(MultiPieceService.localPiece()), "local", null);
        } else {
            try {
                det = multiPiece.detectPieces(user.id(), photo);
            } catch (RuntimeException ex) {
                log.warn("Lens: detecção falhou ({})", ex.toString());
            }
        }
        AiOutcome<?> outcome = det == null ? null : det.outcome();

        LensScan scan = new LensScan();
        scan.setUserId(user.id());
        scan.setSource(source);
        scan.setSourceRefId(refId);
        scan.setIntent(intent);
        scan.setWidth(photo.getWidth());
        scan.setHeight(photo.getHeight());
        scan.setFacesRedacted(faces);
        scan.setRedactionConfirmed(redactionConfirmed);
        scan.setAiSource(det == null ? "local" : det.source());
        scan.setAlgorithmVersion(LensConfig.ALGORITHM_VERSION);
        scan.setModelVersion(modelVersion(outcome));
        scan.setAiInferenceId(outcome == null ? null : outcome.inferenceId());
        scan.setExpiresAt(Instant.now().plus(Duration.ofDays(config.retentionDays())));
        scan.setProcessedAt(Instant.now());
        List<MultiPieceService.DetectedPiece> found = det == null ? List.of() : det.pieces();
        if (det == null) {
            scan.setStatus(LensScanStatus.FAILED);
            scan.setErrorCode("FAILED");
        } else if (found.isEmpty()) {
            scan.setStatus(LensScanStatus.NO_FASHION_FOUND);
            scan.setErrorCode("NO_FASHION_FOUND");
        } else {
            scan.setStatus(LensScanStatus.READY);
            scan.setErrorCode(redactionConfirmed ? degradedReason(det) : REDACTION_UNCONFIRMED);
        }
        scans.save(scan);

        String base = "restricted/users/" + user.id() + "/lens/" + scan.getId();
        storage.put(base + ".jpg", ImageOps.jpeg(photo, 0.9f), "image/jpeg");
        storage.put(base + "-thumb.jpg", ImageOps.jpeg(ImageOps.scaleToFit(photo, LensConfig.THUMB_MAX_SIDE,
                LensConfig.THUMB_MAX_SIDE), 0.85f), "image/jpeg");
        scan.setImageKey(base + ".jpg");
        scan.setThumbKey(base + "-thumb.jpg");
        scans.save(scan);

        // ordem de leitura: de cima para baixo, depois da esquerda para a direita
        List<MultiPieceService.DetectedPiece> ordered = new ArrayList<>(found);
        ordered.sort(Comparator.comparingDouble((MultiPieceService.DetectedPiece p) -> p.box().y())
                .thenComparingDouble(p -> p.box().x()));
        List<LensDetection> saved = new ArrayList<>();
        for (int i = 0; i < ordered.size(); i++) {
            saved.add(detections.save(fromDetected(scan.getId(), i, ordered.get(i), photo)));
        }
        if (det == null) {
            rateLimit.release(user.id(), QUOTA_BUCKET);          // falha nossa não consome a cota da pessoa
        }
        return view(new Ctx(user), scan, saved);
    }

    /** Por que a leitura ficou local (a UI explica): consentimento ou cota da IA. Nulo quando não há o que explicar. */
    static String degradedReason(MultiPieceService.PieceDetection det) {
        if (det == null || !"local".equals(det.source()) || det.outcome() == null) {
            return null;
        }
        AiCallResult r = det.outcome().result();
        return r == AiCallResult.CONSENT_DENIED ? "CONSENT_REQUIRED" : r == AiCallResult.RATE_LIMITED ? "QUOTA" : null;
    }

    static String modelVersion(AiOutcome<?> outcome) {
        String detector = outcome == null || outcome.provider() == null ? "local"
                : "local".equals(outcome.provider()) ? "local" : outcome.provider() + ":" + outcome.model();
        String v = "multi-piece-detector@" + detector + "+" + GarmentEmbedder.MODEL.key();
        return v.length() > 160 ? v.substring(0, 160) : v;
    }

    /** Peça do detector → linha do scan, com a leitura local do recorte (cores, padrão, embedding). */
    static LensDetection fromDetected(UUID scanId, int ordinal, MultiPieceService.DetectedPiece p, BufferedImage photo) {
        LensViews.Box box = new LensViews.Box(p.box().x(), p.box().y(), p.box().width(), p.box().height());
        LensImageAnalysis.Reading read = LensImageAnalysis.read(photo, box, p.color());
        LensDetection d = new LensDetection();
        d.setScanId(scanId);
        d.setOrdinal(ordinal);
        d.setBoxJson(Json.write(box));
        d.setCategory(p.category());
        d.setSubcategory(p.subcategory());
        d.setMaterial(p.material());
        d.setSex(p.sex());
        d.setLabel(p.name() != null && !p.name().isBlank() ? p.name() : defaultLabel(p.category(), p.subcategory()));
        d.setColorsJson(Json.write(read.colors()));
        d.setPattern(read.pattern());
        d.setStyleTags(Json.csv(p.style()));
        d.setOccasionTags(Json.csv(p.occasion()));
        d.setConfidence(BigDecimal.valueOf(p.confidence()).setScale(3, RoundingMode.HALF_UP));
        Map<String, Object> conf = new LinkedHashMap<>();
        conf.put("detection", p.confidence());
        conf.put("pattern", Math.round(read.patternConfidence() * 100) / 100.0);
        d.setAttributeConfidenceJson(Json.write(conf));
        d.setEmbeddingJson(Json.write(round4(read.embedding())));
        d.setEmbeddingModel(GarmentEmbedder.MODEL.key());
        d.setStatus(LensDetectionStatus.DETECTED);
        return d;
    }

    // ================================================================== ler

    @Transactional(readOnly = true)
    public LensViews.ScanView get(CurrentUser user, UUID id) {
        LensScan scan = owned(user, id);
        return view(new Ctx(user), scan, detections.findByScanIdOrderByOrdinalAsc(scan.getId()));
    }

    /** Imagem gravada (sem EXIF/GPS, rostos já borrados no aparelho): só para o dono. {@code thumb} = miniatura. */
    @Transactional(readOnly = true)
    public byte[] image(CurrentUser user, UUID id, boolean thumb) {
        LensScan scan = owned(user, id);
        String key = thumb && scan.getThumbKey() != null ? scan.getThumbKey() : scan.getImageKey();
        if (key == null) {
            throw ApiException.notFound(Msg.t("lens.imagem"));
        }
        try {
            byte[] bytes = storage.get(key);
            if (bytes == null) {
                throw ApiException.notFound(Msg.t("lens.imagem"));
            }
            return bytes;
        } catch (ApiException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw ApiException.notFound(Msg.t("lens.imagem"));
        }
    }

    /**
     * Histórico e inspirações: {@code saved} filtra salvos/não salvos; {@code wanted} só scans com alguma peça "Quero"
     * (filtro feito na consulta, antes de paginar: página, total e "tem mais" valem só para esses scans).
     */
    @Transactional(readOnly = true)
    public Views.Page<LensViews.ScanCard> history(CurrentUser user, Boolean saved, Boolean wanted, int page, int size) {
        requireUser(user);
        int sz = Math.max(1, Math.min(50, size <= 0 ? 12 : size));
        int pg = Math.max(0, page);
        PageRequest req = PageRequest.of(pg, sz);
        Page<LensScan> result = Boolean.TRUE.equals(wanted) ? scans.findWantedByUserId(user.id(), saved, req)
                : saved == null ? scans.findByUserIdOrderByCreatedAtDesc(user.id(), req)
                : saved ? scans.findByUserIdAndSavedAtIsNotNullOrderByCreatedAtDesc(user.id(), req)
                : scans.findByUserIdAndSavedAtIsNullOrderByCreatedAtDesc(user.id(), req);
        List<LensScan> rows = result.getContent();
        Map<UUID, List<LensDetection>> byScan = rows.isEmpty() ? Map.of()
                : detections.findByScanIdIn(rows.stream().map(LensScan::getId).toList()).stream()
                .filter(d -> d.getDismissedAt() == null)
                .collect(Collectors.groupingBy(LensDetection::getScanId));
        Ctx ctx = new Ctx(user);
        List<LensViews.ScanCard> items = new ArrayList<>();
        for (LensScan s : rows) {
            List<LensDetection> ds = byScan.getOrDefault(s.getId(), List.of()).stream()
                    .sorted(Comparator.comparingInt(LensDetection::getOrdinal)).toList();
            int owned = 0, gaps = 0;
            for (LensDetection d : ds) {
                if (closetMatches(ctx, d).isEmpty()) {
                    gaps++;
                } else {
                    owned++;
                }
            }
            List<LensViews.StyleShare> st = LensReading.styles(ds.stream().map(LensService::readingPiece).toList());
            items.add(new LensViews.ScanCard(s.getId(), s.getCreatedAt(), s.getSavedAt(), s.getStatus().name(), ds.size(),
                    st.isEmpty() ? null : st.get(0).key(), owned, gaps));
        }
        return new Views.Page<>(items, pg, sz, result.getTotalElements(), result.hasNext());
    }

    /**
     * Correspondências de uma peça no escopo: MY_CLOSET (peças próprias, piso 55) ou COMMUNITY (só peças públicas e
     * elegíveis de outras pessoas, piso 65). Top 12, ordenado só pela semelhança. Sem {@code detection}, junta as peças
     * do look (cada alvo com a melhor semelhança).
     */
    @Transactional(readOnly = true)
    public LensViews.Matches matches(CurrentUser user, UUID id, UUID detectionId, String scopeRaw) {
        LensScan scan = owned(user, id);
        LensSimilarity.Scope scope = parseEnum(LensSimilarity.Scope.class, scopeRaw, LensSimilarity.Scope.MY_CLOSET, "scope");
        List<LensDetection> targets = detectionId == null ? active(scan.getId()) : List.of(ownedDetection(scan, detectionId));
        Ctx ctx = new Ctx(user);
        Map<UUID, LensSimilarity.Ranked<WardrobeItem>> best = new LinkedHashMap<>();
        for (LensDetection d : targets) {
            List<LensSimilarity.Ranked<WardrobeItem>> ranked = scope == LensSimilarity.Scope.COMMUNITY
                    ? communityMatches(ctx, d) : closetMatches(ctx, d);
            for (LensSimilarity.Ranked<WardrobeItem> r : ranked) {
                best.merge(r.target().getId(), r, (a, b) -> a.score().similarity() >= b.score().similarity() ? a : b);
            }
        }
        List<LensViews.MatchView> items = best.values().stream()
                .sorted(Comparator.comparingInt((LensSimilarity.Ranked<WardrobeItem> r) -> r.score().similarity()).reversed())
                .limit(LensConfig.TOP_N)
                .map(r -> new LensViews.MatchView(scope.name(), "PIECE", r.target().getId(), r.score().similarity(),
                        new LensViews.Components(r.score().visual(), r.score().attributes(), r.score().color()),
                        r.score().reasons(), pieceView(user, r.target())))
                .toList();
        return new LensViews.Matches(items);
    }

    /** Leitura do look inteiro (sem {@code detection}) ou de uma peça: estilo, paleta, DNA, Hype do grupo e impacto. */
    @Transactional(readOnly = true)
    public LensViews.ReadingView reading(CurrentUser user, UUID id, UUID detectionId) {
        LensScan scan = owned(user, id);
        List<LensDetection> ds = detectionId == null ? active(scan.getId()) : List.of(ownedDetection(scan, detectionId));
        return reading(new Ctx(user), ds);
    }

    // ================================================================== agir

    @Transactional
    public LensViews.ScanView setSaved(CurrentUser user, UUID id, Boolean saved) {
        LensScan scan = owned(user, id);
        if (saved != null) {
            if (saved && scan.getSavedAt() == null) {
                scan.setSavedAt(Instant.now());
                scan.setExpiresAt(null);
            } else if (!saved && scan.getSavedAt() != null) {
                scan.setSavedAt(null);
                scan.setExpiresAt(Instant.now().plus(Duration.ofDays(config.retentionDays())));
            }
            scans.save(scan);
        }
        return view(new Ctx(user), scan, detections.findByScanIdOrderByOrdinalAsc(scan.getId()));
    }

    /** Apaga o scan inteiro: imagem, miniatura, peças detectadas e correções. */
    @Transactional
    public void delete(CurrentUser user, UUID id) {
        purge(owned(user, id));
    }

    /**
     * Correção de atributos (chips) ou "não é roupa" ({@code dismissed}). Grava o antes/depois em {@code lens_feedback},
     * marca a peça como corrigida e devolve a peça com a correspondência recalculada na hora.
     */
    @Transactional
    public LensViews.DetectionView correct(CurrentUser user, UUID id, UUID detectionId, CorrectionCommand cmd) {
        LensScan scan = owned(user, id);
        LensDetection d = ownedDetection(scan, detectionId);
        if (cmd == null) {
            return detectionView(new Ctx(user), d);
        }
        Map<String, Object> before = snapshot(d);
        Set<LensFeedbackKind> kinds = new LinkedHashSet<>();

        String category = d.getCategory(), subcategory = d.getSubcategory();
        if (cmd.subcategory() != null) {
            String sub = blankToNull(cmd.subcategory());
            if (sub != null && Taxonomy.categoryOf(sub) == null) {
                throw invalid("subcategory");
            }
            subcategory = sub;
            if (sub != null) {
                category = Taxonomy.categoryOf(sub);
            }
        }
        if (cmd.category() != null && cmd.subcategory() == null) {
            String cat = blankToNull(cmd.category());
            if (cat != null && !Taxonomy.isValidCategory(cat)) {
                throw invalid("category");
            }
            category = cat;
            if (subcategory != null && (cat == null || !cat.equals(Taxonomy.categoryOf(subcategory)))) {
                subcategory = null;
            }
        }
        if (!eq(category, d.getCategory()) || !eq(subcategory, d.getSubcategory())) {
            d.setCategory(category);
            d.setSubcategory(subcategory);
            d.setLabel(defaultLabel(category, subcategory));
            d.setOccasionTags(Json.csv(Taxonomy.keepAllowed(Json.csv(d.getOccasionTags()), Taxonomy.allowedOccasions(category),
                    Taxonomy.MAX_PIECE_TAGS)));
            kinds.add(LensFeedbackKind.WRONG_CATEGORY);
        }
        if (cmd.color() != null) {
            String color = blankToNull(cmd.color());
            if (color != null && !Taxonomy.COLORS.containsKey(color)) {
                throw invalid("color");
            }
            List<LensViews.ColorShare> colors = colors(d);
            String main = colors.isEmpty() ? null : colors.get(0).name();
            if (!eq(color, main)) {
                d.setColorsJson(Json.write(withMainColor(colors, color)));
                kinds.add(LensFeedbackKind.WRONG_COLOR);
            }
        }
        if (cmd.material() != null) {
            String material = blankToNull(cmd.material());
            material = material == null ? null : material.toUpperCase(Locale.ROOT);
            if (material != null && !Taxonomy.MATERIALS.contains(material)) {
                throw invalid("material");
            }
            if (!eq(material, d.getMaterial())) {
                d.setMaterial(material);
                kinds.add(LensFeedbackKind.WRONG_ATTRIBUTE);
            }
        }
        if (cmd.pattern() != null) {
            String pattern = blankToNull(cmd.pattern());
            pattern = pattern == null ? null : pattern.toLowerCase(Locale.ROOT);
            if (pattern != null && !PATTERNS.contains(pattern)) {
                throw invalid("pattern");
            }
            if (!eq(pattern, d.getPattern())) {
                d.setPattern(pattern);
                kinds.add(LensFeedbackKind.WRONG_ATTRIBUTE);
            }
        }
        if (cmd.styles() != null) {
            List<String> styles = Taxonomy.canonicalTags(cmd.styles());
            if (styles.size() > Taxonomy.MAX_PIECE_TAGS || !Taxonomy.STYLES.containsAll(styles)) {
                throw invalid("styles");
            }
            if (!new HashSet<>(styles).equals(new HashSet<>(Json.csv(d.getStyleTags())))) {
                d.setStyleTags(Json.csv(styles));
                kinds.add(LensFeedbackKind.WRONG_ATTRIBUTE);
            }
        }
        if (!kinds.isEmpty() && d.getStatus() == LensDetectionStatus.DETECTED) {
            d.setStatus(LensDetectionStatus.CORRECTED);
        }
        if (Boolean.TRUE.equals(cmd.dismissed()) && d.getDismissedAt() == null) {
            d.setDismissedAt(Instant.now());
            kinds.add(LensFeedbackKind.NOT_CLOTHING);
        } else if (Boolean.FALSE.equals(cmd.dismissed())) {
            d.setDismissedAt(null);
        }
        detections.save(d);
        if (!kinds.isEmpty()) {
            boolean consent = trainingConsent(user.id());
            Map<String, Object> after = snapshot(d);
            for (LensFeedbackKind k : kinds) {
                recordFeedback(scan, d, user.id(), k, before, after, consent);
            }
        }
        return detectionView(new Ctx(user), d);
    }

    /** A pessoa marca uma peça que o detector não viu: caixa em % + categoria (status ADDED_BY_USER). */
    @Transactional
    public LensViews.DetectionView add(CurrentUser user, UUID id, AddDetectionCommand cmd) {
        LensScan scan = owned(user, id);
        LensViews.Box box = box(cmd == null ? null : cmd.box());
        String sub = blankToNull(cmd.subcategory());
        String category = blankToNull(cmd.category());
        if (sub != null) {
            if (Taxonomy.categoryOf(sub) == null) {
                throw invalid("subcategory");
            }
            category = Taxonomy.categoryOf(sub);
        }
        if (!Taxonomy.isValidCategory(category)) {
            throw invalid("category");
        }
        String color = blankToNull(cmd.color());
        if (color != null && !Taxonomy.COLORS.containsKey(color)) {
            throw invalid("color");
        }
        List<LensDetection> all = detections.findByScanIdOrderByOrdinalAsc(scan.getId());
        LensDetection d = new LensDetection();
        d.setScanId(scan.getId());
        d.setOrdinal(all.stream().mapToInt(LensDetection::getOrdinal).max().orElse(-1) + 1);
        d.setBoxJson(Json.write(box));
        d.setCategory(category);
        d.setSubcategory(sub);
        d.setLabel(defaultLabel(category, sub));
        d.setConfidence(BigDecimal.ONE.setScale(3, RoundingMode.HALF_UP));
        d.setStatus(LensDetectionStatus.ADDED_BY_USER);
        BufferedImage photo = storedImage(scan);
        if (photo != null) {
            LensImageAnalysis.Reading read = LensImageAnalysis.read(photo, box, color);
            d.setColorsJson(Json.write(read.colors()));
            d.setPattern(read.pattern());
            d.setEmbeddingJson(Json.write(round4(read.embedding())));
            d.setEmbeddingModel(GarmentEmbedder.MODEL.key());
        } else if (color != null) {
            d.setColorsJson(Json.write(List.of(new LensViews.ColorShare(color, Taxonomy.hex(color), 1.0))));
        }
        detections.save(d);
        if (scan.getStatus() == LensScanStatus.NO_FASHION_FOUND) {
            scan.setStatus(LensScanStatus.READY);
            scan.setErrorCode(null);
            scans.save(scan);
        }
        recordFeedback(scan, d, user.id(), LensFeedbackKind.MISSING_PIECE, null, snapshot(d), trainingConsent(user.id()));
        return detectionView(new Ctx(user), d);
    }

    /** "Quero": marca/desmarca a peça na lista de desejos das inspirações. */
    @Transactional
    public LensViews.DetectionView want(CurrentUser user, UUID id, UUID detectionId, Boolean wanted) {
        LensScan scan = owned(user, id);
        LensDetection d = ownedDetection(scan, detectionId);
        boolean on = Boolean.TRUE.equals(wanted);
        if (on && d.getWantedAt() == null) {
            d.setWantedAt(Instant.now());
        } else if (!on) {
            d.setWantedAt(null);
        }
        detections.save(d);
        return detectionView(new Ctx(user), d);
    }

    /**
     * "Eu tenho": com {@code itemId}, liga a peça detectada a uma peça do próprio guarda-roupa (outra pessoa ou peça
     * arquivada = 404); sem, devolve o link do cadastro pré-preenchido. A foto da peça nunca é o recorte desta imagem.
     */
    @Transactional
    public LensViews.OwnResult own(CurrentUser user, UUID id, UUID detectionId, UUID itemId) {
        LensScan scan = owned(user, id);
        LensDetection d = ownedDetection(scan, detectionId);
        String href;
        if (itemId != null) {
            WardrobeItem w = pieces.findById(itemId).filter(p -> ownPiece(user, p))
                    .orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            d.setOwnedItemId(w.getId());
            detections.save(d);
            href = "/pieces/" + w.getId();
        } else {
            href = prefillHref(scan.getId(), d);
        }
        return new LensViews.OwnResult(detectionView(new Ctx(user), d), href);
    }

    /** {@code /pieces/new} pré-preenchido com a leitura (categoria, subtipo, cor, material, estilos e o nome). */
    static String prefillHref(UUID scanId, LensDetection d) {
        Map<String, String> q = new LinkedHashMap<>();
        q.put("category", d.getCategory());
        q.put("subcategory", d.getSubcategory());
        List<LensViews.ColorShare> colors = colors(d);
        q.put("color", colors.isEmpty() ? null : colors.get(0).name());
        q.put("material", d.getMaterial());
        q.put("styles", blankToNull(d.getStyleTags()));
        q.put("q", d.getLabel());
        q.put("from", "lens");
        q.put("scan", scanId.toString());
        q.put("detection", d.getId() == null ? null : d.getId().toString());
        String query = q.entrySet().stream().filter(e -> e.getValue() != null && !e.getValue().isBlank())
                .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
        return "/pieces/new?" + query;
    }

    // ================================================================== recriar

    /**
     * Plano "Recriar" com as peças da pessoa: um slot por peça detectada (topo, base, peça única, calçado, acessório).
     * Cada slot é {@code own} (peça sua parecida da mesma subcategoria), {@code alternative} (peça sua parecida de outra
     * subcategoria) ou {@code gap} (lacuna, com as próprias mais próximas como alternativas). O modo pesa a escolha pelo
     * {@code RecommendationScoring}; slots fixados ({@code locked}) não mudam. Os seis números são os mesmos do Copilot.
     */
    @Transactional(readOnly = true)
    public LensViews.RecreatePlan recreate(CurrentUser user, UUID id, RecreateCommand cmd) {
        LensScan scan = owned(user, id);
        RecommendationScoring.Mode mode = RecommendationScoring.Mode.SAFE;
        if (cmd != null && cmd.mode() != null && !cmd.mode().isBlank()) {
            mode = RecommendationScoring.Mode.parse(cmd.mode());
            if (mode == null) {
                throw ApiException.badRequest("MODO_INVALIDO", Msg.t("lens.modo_invalido"), Map.of("field", "mode"));
            }
        }
        List<LensDetection> ds = new ArrayList<>(active(scan.getId()));
        if (cmd != null && cmd.focus() != null) {
            LensDetection focus = ds.stream().filter(d -> d.getId().equals(cmd.focus())).findFirst()
                    .orElseThrow(() -> ApiException.notFound(Msg.t("lens.deteccao")));
            ds.remove(focus);
            ds.add(0, focus);
        }
        ds.removeIf(d -> LensReading.slotOf(d.getCategory()) == null);

        Ctx ctx = new Ctx(user);
        Map<String, WardrobeItem> locked = resolveLocked(ctx, cmd == null ? null : cmd.locked());
        Map<UUID, HypeScoreCurrent> hype = hypeOf(ctx.closet().stream().map(WardrobeItem::getId).toList());
        LocalDate today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        double simWeight = LensConfig.RECREATE_SIMILARITY_WEIGHT.getOrDefault(mode.name(), 0.6);

        Set<UUID> used = new HashSet<>();
        locked.values().forEach(w -> used.add(w.getId()));
        Set<String> lockedSlotsTaken = new HashSet<>();
        List<LensViews.SlotView> slots = new ArrayList<>();
        List<WardrobeItem> chosen = new ArrayList<>();
        for (LensDetection d : ds) {
            String slot = LensReading.slotOf(d.getCategory());
            LensSimilarity.Features f = features(d);
            List<LensSimilarity.Ranked<WardrobeItem>> sameCategory = LensSimilarity.rank(f,
                    ctx.closet().stream().filter(w -> d.getCategory().equals(w.getCategory())).toList(),
                    w -> features(ctx, w), 1, Integer.MAX_VALUE);
            WardrobeItem lockedPiece = locked.get(d.getId().toString());
            if (lockedPiece == null && !lockedSlotsTaken.contains(slot) && locked.containsKey(slot)) {
                lockedPiece = locked.get(slot);
                lockedSlotsTaken.add(slot);
            }
            if (lockedPiece != null) {
                WardrobeItem lp = lockedPiece;
                chosen.add(lp);
                List<Views.PieceView> alts = sameCategory.stream().map(LensSimilarity.Ranked::target)
                        .filter(w -> !w.getId().equals(lp.getId()) && !used.contains(w.getId()))
                        .limit(LensConfig.RECREATE_ALTERNATIVES).map(w -> pieceView(user, w)).toList();
                slots.add(new LensViews.SlotView(slot, d.getId(), "own", pieceView(user, lp), alts));
                continue;
            }
            int floor = LensConfig.FLOOR_MY_CLOSET;
            RecommendationScoring.Mode m = mode;
            Function<LensSimilarity.Ranked<WardrobeItem>, Double> pick = r -> simWeight * r.score().similarity()
                    + (1 - simWeight) * RecommendationScoring.rankValue(m, pieceScores(ctx, r.target(), hype, today));
            List<LensSimilarity.Ranked<WardrobeItem>> eligible = sameCategory.stream()
                    .filter(r -> r.score().similarity() >= floor && !used.contains(r.target().getId()))
                    .sorted(Comparator.comparingDouble(pick::apply).reversed()).toList();
            if (!eligible.isEmpty()) {
                WardrobeItem best = eligible.get(0).target();
                used.add(best.getId());
                chosen.add(best);
                boolean sameSub = d.getSubcategory() == null || d.getSubcategory().equals(best.getSubcategory());
                List<Views.PieceView> alts = new ArrayList<>();
                eligible.stream().skip(1).limit(LensConfig.RECREATE_ALTERNATIVES).forEach(r -> alts.add(pieceView(user, r.target())));
                slots.add(new LensViews.SlotView(slot, d.getId(), sameSub ? "own" : "alternative", pieceView(user, best), alts));
            } else {
                List<Views.PieceView> alts = sameCategory.stream().map(LensSimilarity.Ranked::target)
                        .filter(w -> !used.contains(w.getId())).limit(LensConfig.RECREATE_ALTERNATIVES)
                        .map(w -> pieceView(user, w)).toList();
                slots.add(new LensViews.SlotView(slot, d.getId(), "gap", null, alts));
            }
        }
        List<UUID> ids = chosen.stream().map(WardrobeItem::getId).toList();
        RecommendationScoring.Scores scores = lookScores(ctx, chosen, hype, today, slots.size());
        String href = ids.isEmpty() ? "/schemes/new"
                : "/schemes/new?pieces=" + ids.stream().map(UUID::toString).collect(Collectors.joining(","));
        return new LensViews.RecreatePlan(mode.name(), slots, ids, scores, href);
    }

    /** Slots fixados: chave = slot (TOP…) ou id da peça detectada; valor = peça do próprio guarda-roupa (senão 404). */
    private Map<String, WardrobeItem> resolveLocked(Ctx ctx, Map<String, String> raw) {
        Map<String, WardrobeItem> out = new LinkedHashMap<>();
        if (raw == null) {
            return out;
        }
        Map<UUID, WardrobeItem> mine = ctx.closet().stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w, (a, b) -> a));
        for (Map.Entry<String, String> e : raw.entrySet()) {
            if (e.getKey() == null || e.getValue() == null || e.getValue().isBlank()) {
                continue;
            }
            UUID pieceId;
            try {
                pieceId = UUID.fromString(e.getValue().trim());
            } catch (IllegalArgumentException ex) {
                throw ApiException.notFound(Msg.t("common.peca"));
            }
            WardrobeItem w = mine.get(pieceId);
            if (w == null) {
                throw ApiException.notFound(Msg.t("common.peca"));
            }
            String key = e.getKey().trim();
            String upper = key.toUpperCase(Locale.ROOT);
            out.put(SLOTS.contains(upper) ? upper : key, w);
        }
        return out;
    }

    /** Seis números de uma peça sozinha (o modo decide o peso de cada um na escolha do slot). */
    private RecommendationScoring.Scores pieceScores(Ctx ctx, WardrobeItem w, Map<UUID, HypeScoreCurrent> hype, LocalDate today) {
        Integer compat = null;
        StyleCompatibility.Profile dna = ctx.dna();
        if (dna != null) {
            Map<String, Object> c = StyleCompatibility.score(dna, HypeQueryService.profileOf(w));
            compat = c == null ? null : ((Number) c.get("score")).intValue();
        }
        HypeScoreCurrent h = hype.get(w.getId());
        Integer hypeScore = h == null || h.getScore() == null ? null : (int) Math.round(h.getScore().doubleValue());
        List<Integer> wears = List.of(w.getWearCount());
        return new RecommendationScoring.Scores(compat, hypeScore, null,
                RecommendationScoring.reuse(List.of(HypeQueryService.idleDays(w, today))),
                RecommendationScoring.usage(wears), RecommendationScoring.sustainability(wears, 1, 1));
    }

    /** Os seis números do look recriado, no mesmo cálculo do Copilot ({@code CopilotService.scoreLooks}). */
    private RecommendationScoring.Scores lookScores(Ctx ctx, List<WardrobeItem> look, Map<UUID, HypeScoreCurrent> hype,
                                                    LocalDate today, int slots) {
        Integer compat = null;
        StyleCompatibility.Profile dna = ctx.dna();
        if (dna != null && !look.isEmpty()) {
            Set<String> styles = new LinkedHashSet<>(), colors = new LinkedHashSet<>(), occasions = new LinkedHashSet<>();
            look.forEach(w -> {
                styles.addAll(Json.csv(w.getStyleTags()));
                colors.addAll(HypeQueryService.colorsOf(w));
                occasions.addAll(Json.csv(w.getOccasionTags()));
            });
            Map<String, Object> c = StyleCompatibility.score(dna, StyleCompatibility.profile(styles, colors, occasions));
            compat = c == null ? null : ((Number) c.get("score")).intValue();
        }
        List<Double> hypes = look.stream().map(w -> hype.get(w.getId())).filter(h -> h != null && h.getScore() != null)
                .map(h -> h.getScore().doubleValue()).toList();
        List<UUID> ids = look.stream().map(WardrobeItem::getId).toList();
        List<Integer> wears = look.stream().map(WardrobeItem::getWearCount).toList();
        return new RecommendationScoring.Scores(compat,
                hypes.isEmpty() ? null : (int) Math.round(hypes.stream().mapToDouble(Double::doubleValue).average().orElse(0)),
                RecommendationScoring.novelty(ids, ctx.seenPairs()),
                RecommendationScoring.reuse(look.stream().map(w -> HypeQueryService.idleDays(w, today)).toList()),
                RecommendationScoring.usage(wears),
                RecommendationScoring.sustainability(wears, look.size(), Math.max(slots, look.size())));
    }

    // ================================================================== retenção e conta

    /** Job diário (LensRetentionJob): scans não salvos vencidos somem com imagem, peças e correções. */
    @Transactional
    public int purgeExpired(Instant now) {
        int count = 0;
        for (int round = 0; round < 50; round++) {
            List<LensScan> batch = scans.findTop200BySavedAtIsNullAndExpiresAtBefore(now);
            if (batch.isEmpty()) {
                break;
            }
            for (LensScan s : batch) {
                purge(s);
                count++;
            }
        }
        return count;
    }

    /** Exclusão da conta: todos os scans da pessoa (salvos ou não), sem usuário logado. */
    @Transactional
    public void deleteAllFor(UUID userId) {
        scans.findByUserId(userId).forEach(this::purge);
    }

    private void purge(LensScan s) {
        deleteQuietly(s.getImageKey());
        deleteQuietly(s.getThumbKey());
        List<LensFeedback> fb = feedback.findByScanId(s.getId());
        if (!fb.isEmpty()) {
            feedback.deleteAll(fb);
        }
        List<LensDetection> ds = detections.findByScanIdOrderByOrdinalAsc(s.getId());
        if (!ds.isEmpty()) {
            detections.deleteAll(ds);
        }
        scans.delete(s);
    }

    private void deleteQuietly(String key) {
        if (key == null) {
            return;
        }
        try {
            storage.delete(key);
        } catch (RuntimeException ignored) {
            // objeto já ausente: idempotente
        }
    }

    // ================================================================== visões

    private LensViews.ScanView view(Ctx ctx, LensScan scan, List<LensDetection> all) {
        List<LensDetection> active = all.stream().filter(d -> d.getDismissedAt() == null)
                .sorted(Comparator.comparingInt(LensDetection::getOrdinal)).toList();
        List<LensViews.DetectionView> ds = active.stream().map(d -> detectionView(ctx, d)).toList();
        return new LensViews.ScanView(scan.getId(), scan.getStatus().name(), scan.getErrorCode(), scan.getSource().name(),
                scan.getIntent().name(), scan.getCreatedAt(), scan.getSavedAt() == null ? scan.getExpiresAt() : null,
                scan.getSavedAt(), scan.getWidth(), scan.getHeight(), scan.getFacesRedacted(), scan.getAiSource(),
                scan.getAlgorithmVersion(), scan.getModelVersion(), ds, reading(ctx, active));
    }

    private LensViews.DetectionView detectionView(Ctx ctx, LensDetection d) {
        double conf = d.getConfidence() == null ? 0 : d.getConfidence().doubleValue();
        LensViews.TopMatch top = null;
        if (d.getDismissedAt() == null) {
            List<LensSimilarity.Ranked<WardrobeItem>> m = closetMatches(ctx, d);
            top = m.isEmpty() ? null : new LensViews.TopMatch(m.get(0).target().getId(), m.get(0).score().similarity());
        }
        String status = d.getDismissedAt() != null ? LensDetectionStatus.DISMISSED.name() : d.getStatus().name();
        return new LensViews.DetectionView(d.getId(), d.getOrdinal(), box(d), d.getLabel() == null ? defaultLabel(d.getCategory(),
                d.getSubcategory()) : d.getLabel(), d.getCategory(), d.getSubcategory(), colors(d), d.getMaterial(), d.getPattern(),
                Json.csv(d.getStyleTags()), Json.csv(d.getOccasionTags()), Math.round(conf * 100) / 100.0,
                LensConfig.confidenceBand(conf), status, d.getWantedAt() != null, d.getOwnedItemId(), top);
    }

    private LensViews.ReadingView reading(Ctx ctx, List<LensDetection> ds) {
        List<LensReading.Piece> ps = ds.stream().map(LensService::readingPiece).toList();
        LensViews.Fit fit = null;
        StyleCompatibility.Profile dna = ctx.dna();
        if (dna != null && !ps.isEmpty()) {
            Set<String> styles = new LinkedHashSet<>(), occasions = new LinkedHashSet<>();
            ps.forEach(p -> {
                styles.addAll(p.styles());
                occasions.addAll(p.occasions());
            });
            Map<String, Object> c = StyleCompatibility.score(dna,
                    StyleCompatibility.profile(styles, LensReading.colorsWithFamily(ps), occasions));
            if (c != null) {
                @SuppressWarnings("unchecked") Map<String, Object> parts = (Map<String, Object>) c.get("parts");
                fit = new LensViews.Fit((Number) c.get("score"), parts);
            }
        }
        // Hype do grupo: a peça maior com grupo disponível; sem nenhuma, "dados insuficientes" com o maior grupo visto
        LensViews.Trend trend = new LensViews.Trend("INSUFFICIENT_DATA", null, null, null, null, null, 0);
        List<LensReading.Piece> byArea = ps.stream().sorted(Comparator.comparingDouble(LensReading.Piece::area).reversed()).toList();
        for (LensReading.Piece p : byArea) {
            LensViews.Trend t = groupTrend(ctx, p);
            if ("AVAILABLE".equals(t.status())) {
                trend = t;
                break;
            }
            if (t.items() > trend.items()) {
                trend = t;
            }
        }
        Set<UUID> owned = new HashSet<>(), redundant = new HashSet<>();
        int gaps = 0;
        for (LensDetection d : ds) {
            List<LensSimilarity.Ranked<WardrobeItem>> m = closetMatches(ctx, d);
            if (m.isEmpty()) {
                gaps++;
            }
            m.forEach(r -> {
                owned.add(r.target().getId());
                if (r.score().similarity() >= LensConfig.REDUNDANT_AT) {
                    redundant.add(r.target().getId());
                }
            });
        }
        return new LensViews.ReadingView(LensReading.styles(ps), LensReading.palette(ps), LensReading.occasions(ps),
                LensReading.season(ps), fit, trend, new LensViews.Impact(owned.size(), gaps, redundant.size()));
    }

    /** Hype do grupo de peças públicas e elegíveis com o mesmo par de atributos (≥ 5 itens), como no §10.1. */
    private LensViews.Trend groupTrend(Ctx ctx, LensReading.Piece p) {
        List<String> keys = LensReading.groupKeys(p.category(), p.mainColor(), p.material(), p.styles());
        if (keys.isEmpty()) {
            return new LensViews.Trend("INSUFFICIENT_DATA", null, null, null, null, null, 0);
        }
        return LensReading.trend(keys, ctx.publicGroup(p.category()), score -> hypeConfig.level(score).name(),
                hypeConfig.stablePoints());
    }

    private Views.PieceView pieceView(CurrentUser user, WardrobeItem w) {
        return Views.piece(w, wardrobe.viewerState(user, w), null);
    }

    // ================================================================== correspondências

    /** Peças próprias parecidas (piso 55, top 12), da mesma categoria quando a peça detectada tem categoria. */
    private List<LensSimilarity.Ranked<WardrobeItem>> closetMatches(Ctx ctx, LensDetection d) {
        LensSimilarity.Features f = features(d);
        List<WardrobeItem> candidates = ctx.closet().stream()
                .filter(w -> d.getCategory() == null || d.getCategory().equals(w.getCategory())).toList();
        return LensSimilarity.rank(f, candidates, w -> features(ctx, w), config.floor(LensSimilarity.Scope.MY_CLOSET), LensConfig.TOP_N);
    }

    /**
     * Comunidade: só peças com {@code hype_scores.public_eligible} (as mesmas regras do ranking), nunca do próprio dono,
     * e conferidas de novo na leitura (visibilidade efetiva, bloqueio, moderação aprovada, não arquivada). Piso 65.
     */
    private List<LensSimilarity.Ranked<WardrobeItem>> communityMatches(Ctx ctx, LensDetection d) {
        LensSimilarity.Features f = features(d);
        List<WardrobeItem> candidates = ctx.community(d.getCategory());
        return LensSimilarity.rank(f, candidates, w -> features(null, w), config.floor(LensSimilarity.Scope.COMMUNITY), LensConfig.TOP_N);
    }

    static LensSimilarity.Features features(LensDetection d) {
        List<LensViews.ColorShare> colors = colors(d);
        String main = colors.isEmpty() ? null : colors.get(0).name();
        return new LensSimilarity.Features(d.getCategory(), d.getSubcategory(), d.getMaterial(), d.getPattern(),
                Json.csv(d.getStyleTags()), hexOf(main), embedding(d.getEmbeddingJson()));
    }

    /** Peça do app como alvo: estampa vira padrão "printed"; embedding só quando o guarda-roupa já tem (backfill). */
    static LensSimilarity.Features features(Ctx ctx, WardrobeItem w) {
        String pattern = "print".equals(w.getColor()) ? "printed" : null;
        return new LensSimilarity.Features(w.getCategory(), w.getSubcategory(), w.getMaterial(), pattern,
                Json.csv(w.getStyleTags()), hexOf(w.getColor()), ctx == null ? null : ctx.embeddingOf(w.getId()));
    }

    static String hexOf(String color) {
        return color == null || NOT_A_HUE.contains(color) ? null : Taxonomy.COLORS.get(color);
    }

    // ================================================================== contexto de um pedido

    /** Carrega sob demanda e uma vez por pedido o que a camada viva precisa (guarda-roupa, DNA, Hype público…). */
    final class Ctx {
        private final CurrentUser user;
        private List<WardrobeItem> closet;
        private Map<UUID, float[]> closetEmbeddings;
        private StyleCompatibility.Profile dna;
        private boolean dnaLoaded;
        private Set<String> seenPairs;
        private final Map<String, List<LensReading.Member>> groups = new HashMap<>();
        private final Map<String, List<WardrobeItem>> community = new HashMap<>();

        Ctx(CurrentUser user) {
            this.user = user;
        }

        List<WardrobeItem> closet() {
            if (closet == null) {
                closet = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                        .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
            }
            return closet;
        }

        /** Embeddings visuais das peças próprias (garment_embeddings do mesmo modelo), quando o backfill já existe. */
        float[] embeddingOf(UUID pieceId) {
            if (closetEmbeddings == null) {
                closetEmbeddings = new HashMap<>();
                try {
                    List<GarmentEmbedding> rows = embeddings.findByUserId(user.id()).stream()
                            .filter(e -> GarmentEmbedder.MODEL.key().equals(e.getModelVersion())).toList();
                    if (!rows.isEmpty()) {
                        Set<UUID> mine = closet().stream().map(WardrobeItem::getId).collect(Collectors.toSet());
                        Map<UUID, UUID> imageToPiece = new HashMap<>();
                        pieceImages.findAllById(rows.stream().map(GarmentEmbedding::getImageId).toList())
                                .forEach(img -> imageToPiece.put(img.getId(), img.getPieceId()));
                        for (GarmentEmbedding e : rows) {
                            UUID piece = mine.contains(e.getImageId()) ? e.getImageId() : imageToPiece.get(e.getImageId());
                            float[] v = embedding(e.getVectorJson());
                            if (piece != null && v != null) {
                                closetEmbeddings.putIfAbsent(piece, v);
                            }
                        }
                    }
                } catch (RuntimeException ex) {
                    log.debug("Lens: embeddings do guarda-roupa indisponíveis ({})", ex.toString());
                }
            }
            return closetEmbeddings.get(pieceId);
        }

        StyleCompatibility.Profile dna() {
            if (!dnaLoaded) {
                dna = dnas.findByUserId(user.id()).map(HypeQueryService::profileOf).filter(p -> !p.empty()).orElse(null);
                dnaLoaded = true;
            }
            return dna;
        }

        /** Pares de peças que a pessoa já combinou em looks (novidade do plano). */
        Set<String> seenPairs() {
            if (seenPairs == null) {
                seenPairs = new HashSet<>();
                List<Scheme> mine = schemes.findByUserIdOrderByCreatedAtDesc(user.id());
                if (!mine.isEmpty()) {
                    schemeItems.findBySchemeIdIn(mine.stream().map(Scheme::getId).toList()).stream()
                            .filter(si -> si.getWardrobeItem() != null)
                            .collect(Collectors.groupingBy(si -> si.getScheme().getId(),
                                    Collectors.mapping(si -> si.getWardrobeItem().getId(), Collectors.toList())))
                            .values().forEach(ids -> {
                                for (int a = 0; a < ids.size(); a++) {
                                    for (int b = a + 1; b < ids.size(); b++) {
                                        seenPairs.add(RecommendationScoring.pair(ids.get(a), ids.get(b)));
                                    }
                                }
                            });
                }
            }
            return seenPairs;
        }

        /** Peças públicas com Hype disponível na categoria, com as chaves de atributo de cada uma. */
        List<LensReading.Member> publicGroup(String category) {
            return groups.computeIfAbsent(category == null ? "" : category, c -> {
                if (c.isEmpty()) {
                    return List.of();
                }
                List<HypeScoreCurrent> rows = hypeScores.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(
                                HypeEntityType.PIECE, hypeConfig.algorithmVersion(), HypeStatus.AVAILABLE).stream()
                        .filter(r -> r.getScore() != null && c.equals(r.getCategory())).toList();
                if (rows.isEmpty()) {
                    return List.of();
                }
                Map<UUID, WardrobeItem> byId = pieces.findByIdIn(rows.stream().map(HypeScoreCurrent::getEntityId).toList())
                        .stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w, (a, b) -> a));
                List<LensReading.Member> out = new ArrayList<>();
                for (HypeScoreCurrent r : rows) {
                    WardrobeItem w = byId.get(r.getEntityId());
                    if (w == null) {
                        continue;
                    }
                    Set<String> keys = new HashSet<>(LensReading.groupKeys(w.getCategory(), w.getColor(), w.getMaterial(),
                            Json.csv(w.getStyleTags())));
                    out.add(new LensReading.Member(keys, r.getScore().doubleValue(),
                            r.getDeltaPoints() == null ? null : r.getDeltaPoints().doubleValue()));
                }
                return out;
            });
        }

        /** Candidatas da comunidade (públicas e elegíveis, de outras pessoas, visíveis para quem pede agora). */
        List<WardrobeItem> community(String category) {
            return community.computeIfAbsent(category == null ? "" : category, c -> {
                List<HypeScoreCurrent> rows = new ArrayList<>();
                for (HypeStatus st : HypeStatus.values()) {
                    rows.addAll(hypeScores.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(
                            HypeEntityType.PIECE, hypeConfig.algorithmVersion(), st));
                }
                List<UUID> ids = rows.stream()
                        .filter(r -> r.isPublicEligible() && !user.id().equals(r.getOwnerId()))
                        .filter(r -> c.isEmpty() || r.getCategory() == null || c.equals(r.getCategory()))
                        .map(HypeScoreCurrent::getEntityId).distinct().toList();
                if (ids.isEmpty()) {
                    return List.of();
                }
                return pieces.findByIdIn(ids).stream()
                        .filter(w -> w.getUser() != null && !user.id().equals(w.getUser().getId()))
                        .filter(w -> c.isEmpty() || c.equals(w.getCategory()))
                        .filter(w -> w.getModerationStatus() == ModerationStatus.APPROVED)
                        .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                        .filter(w -> WardrobeService.effectiveVisibility(w) == br.com.fashionai.domain.model.enums.Visibility.PUBLIC)
                        .filter(w -> guard.canView(user, w.getUser().getId(), WardrobeService.effectiveVisibility(w)))
                        .toList();
            });
        }
    }

    // ================================================================== apoio

    private Map<UUID, HypeScoreCurrent> hypeOf(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return hypeScores.findByEntityTypeAndEntityIdInAndAlgorithmVersion(HypeEntityType.PIECE, new HashSet<>(ids),
                        hypeConfig.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, h -> h, (a, b) -> a));
    }

    /** O scan do dono, ou 404 para qualquer outra pessoa (nunca 403: não revela que existe). */
    private LensScan owned(CurrentUser user, UUID id) {
        requireUser(user);
        if (id == null) {
            throw ApiException.notFound(Msg.t("lens.scan"));
        }
        return scans.findByIdAndUserId(id, user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("lens.scan")));
    }

    private LensDetection ownedDetection(LensScan scan, UUID detectionId) {
        if (detectionId == null) {
            throw ApiException.notFound(Msg.t("lens.deteccao"));
        }
        return detections.findByIdAndScanId(detectionId, scan.getId())
                .orElseThrow(() -> ApiException.notFound(Msg.t("lens.deteccao")));
    }

    private List<LensDetection> active(UUID scanId) {
        return detections.findByScanIdOrderByOrdinalAsc(scanId).stream().filter(d -> d.getDismissedAt() == null).toList();
    }

    private static void requireUser(CurrentUser user) {
        if (user == null) {
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
    }

    /** Peça visível para quem pede: dono, ou aprovada, não arquivada e visível (peça × perfil, sem bloqueio). */
    private boolean visiblePiece(CurrentUser user, WardrobeItem w) {
        if (w.getUser() == null) {
            return false;
        }
        if (user.id().equals(w.getUser().getId())) {
            return true;
        }
        return w.getModerationStatus() == ModerationStatus.APPROVED && w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED
                && guard.canView(user, w.getUser().getId(), WardrobeService.effectiveVisibility(w));
    }

    /** Look visível para quem pede: dono, ou não arquivado e visível (look × perfil do autor, sem bloqueio). */
    private boolean visibleScheme(CurrentUser user, Scheme s) {
        if (s.getUser() == null) {
            return false;
        }
        if (user.id().equals(s.getUser().getId())) {
            return true;
        }
        return s.getStatus() != SchemeStatus.ARCHIVED && guard.canView(user, s.getUser().getId(),
                SchemeService.moreRestrictive(s.getVisibility(), s.getUser().getProfileVisibility()));
    }

    private static boolean ownPiece(CurrentUser user, WardrobeItem w) {
        return w.getUser() != null && user.id().equals(w.getUser().getId()) && w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED;
    }

    private boolean trainingConsent(UUID userId) {
        return consents.findByUserIdAndPurpose(userId, ConsentPurpose.AI_MODEL_TRAINING).map(c -> c.isGranted()).orElse(false);
    }

    private void recordFeedback(LensScan scan, LensDetection d, UUID userId, LensFeedbackKind kind, Map<String, Object> before,
                                Map<String, Object> after, boolean consent) {
        LensFeedback f = new LensFeedback();
        f.setScanId(scan.getId());
        f.setDetectionId(d.getId());
        f.setUserId(userId);
        f.setKind(kind);
        f.setBeforeJson(before == null ? null : Json.write(before));
        f.setAfterJson(after == null ? null : Json.write(after));
        f.setTrainingConsent(consent);
        feedback.save(f);
    }

    private static Map<String, Object> snapshot(LensDetection d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("box", Json.map(d.getBoxJson()));
        m.put("category", d.getCategory());
        m.put("subcategory", d.getSubcategory());
        List<LensViews.ColorShare> colors = colors(d);
        m.put("color", colors.isEmpty() ? null : colors.get(0).name());
        m.put("material", d.getMaterial());
        m.put("pattern", d.getPattern());
        m.put("styles", Json.csv(d.getStyleTags()));
        m.put("dismissed", d.getDismissedAt() != null);
        return m;
    }

    static LensReading.Piece readingPiece(LensDetection d) {
        LensViews.Box b = box(d);
        return new LensReading.Piece(d.getId(), d.getCategory(), d.getSubcategory(), d.getMaterial(), Json.csv(d.getStyleTags()),
                Json.csv(d.getOccasionTags()), colors(d), Math.max(0, b.w()) * Math.max(0, b.h()) / 10000.0);
    }

    static LensViews.Box box(LensDetection d) {
        Map<String, Object> m = Json.map(d.getBoxJson());
        return new LensViews.Box(num(m.get("x")), num(m.get("y")), num(m.get("w")), num(m.get("h")));
    }

    /** Caixa marcada pela pessoa: os quatro números, presa dentro da imagem e com lado mínimo de 3%. */
    static LensViews.Box box(BoxInput in) {
        if (in == null || in.x() == null || in.y() == null || in.w() == null || in.h() == null) {
            throw ApiException.badRequest("CAIXA_INVALIDA", Msg.t("lens.caixa_invalida"), Map.of("field", "box"));
        }
        double x0 = clamp100(in.x()), y0 = clamp100(in.y());
        double x1 = clamp100(in.x() + in.w()), y1 = clamp100(in.y() + in.h());
        if (x1 - x0 < MIN_BOX_PCT || y1 - y0 < MIN_BOX_PCT) {
            throw ApiException.badRequest("CAIXA_INVALIDA", Msg.t("lens.caixa_invalida"), Map.of("field", "box"));
        }
        return new LensViews.Box(round1(x0), round1(y0), round1(x1 - x0), round1(y1 - y0));
    }

    static List<LensViews.ColorShare> colors(LensDetection d) {
        List<LensViews.ColorShare> out = new ArrayList<>();
        for (Map<String, Object> m : Json.list(d.getColorsJson())) {
            Object name = m.get("name");
            if (name instanceof String n && !n.isBlank()) {
                out.add(new LensViews.ColorShare(n, m.get("hex") instanceof String h ? h : Taxonomy.COLORS.get(n), num(m.get("share"))));
            }
        }
        return out;
    }

    /** Cor corrigida vira a principal (com a fração da antiga principal); a repetida sai das secundárias. */
    static List<LensViews.ColorShare> withMainColor(List<LensViews.ColorShare> colors, String color) {
        List<LensViews.ColorShare> out = new ArrayList<>();
        if (color == null) {
            return colors.size() > 1 ? new ArrayList<>(colors.subList(1, colors.size())) : out;
        }
        double share = colors.isEmpty() ? 1.0 : colors.get(0).share();
        out.add(new LensViews.ColorShare(color, Taxonomy.hex(color), share <= 0 ? 1.0 : share));
        colors.stream().skip(1).filter(c -> !c.name().equals(color)).forEach(out::add);
        return out;
    }

    static String defaultLabel(String category, String subcategory) {
        if (subcategory != null) {
            return Taxonomy.label(subcategory);
        }
        if (category != null) {
            return Taxonomy.label(category);
        }
        return Msg.t("lens.peca");
    }

    private BufferedImage storedImage(LensScan scan) {
        if (scan.getImageKey() == null) {
            return null;
        }
        try {
            byte[] bytes = storage.get(scan.getImageKey());
            return bytes == null ? null : ImageOps.decode(bytes);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    static float[] embedding(String json) {
        List<Double> v = Json.doubles(json);
        if (v.isEmpty()) {
            return null;
        }
        float[] out = new float[v.size()];
        for (int i = 0; i < out.length; i++) {
            out[i] = v.get(i) == null ? 0f : v.get(i).floatValue();
        }
        return out;
    }

    private static List<Double> round4(float[] v) {
        List<Double> out = new ArrayList<>(v == null ? 0 : v.length);
        if (v != null) {
            for (float f : v) {
                out.add(Math.round(f * 10000) / 10000.0);
            }
        }
        return out;
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String raw, E fallback, String field) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("VALOR_INVALIDO", Msg.t("lens.valor_invalido", field), Map.of("field", field));
        }
    }

    private static ApiException invalid(String field) {
        return ApiException.badRequest("VALOR_INVALIDO", Msg.t("lens.valor_invalido", field), Map.of("field", field));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static boolean eq(String a, String b) {
        return a == null ? b == null : a.equals(b);
    }

    private static double num(Object o) {
        return o instanceof Number n ? n.doubleValue() : 0;
    }

    private static double clamp100(double v) {
        return Math.max(0, Math.min(100, v));
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }
}
