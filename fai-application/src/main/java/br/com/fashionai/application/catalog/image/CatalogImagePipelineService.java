package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonSegmentationPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.WebFetchPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogSource;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogSourceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Worker e operação do pipeline de imagens da Busca Catalogada (docs/catalogo/PIPELINE_IMAGENS_CATALOGO.md).
 * Desligado por padrão ({@code fashionai.catalog.image-pipeline.enabled}); cada tick pega um lote de imagens PENDING
 * (ou de versão anterior do pipeline), baixa com o {@link WebFetchPort} (só https, só IP público, redirecionamento
 * revalidado a cada salto, limite de bytes), roda o {@link CatalogImagePipeline} e grava só metadados — ou, quando a
 * fonte permite persistência, também o master no storage. Depois reclassifica as fotos do produto e escolhe a canônica.
 */
@Service
public class CatalogImagePipelineService {
    private static final Logger log = LoggerFactory.getLogger(CatalogImagePipelineService.class);
    static final Set<String> DONE = Set.of("APPROVED", "NEEDS_REPROCESSING", "REJECTED");
    public static final Set<String> ACTIONS = Set.of("APPROVE", "REPROCESS", "SELECT_ALTERNATE_IMAGE", "REJECT");

    private final CatalogImageRepository images;
    private final CatalogProductRepository products;
    private final CatalogSourceRepository sources;
    private final WebFetchPort web;
    private final MediaStoragePort storage;
    private final Guard guard;
    private final TransactionTemplate tx;
    private final CatalogImagePipeline pipeline;
    private final ImageCandidateRanker ranker = new ImageCandidateRanker();
    private final boolean enabled;
    private final int batch;
    private final int maxAttempts;

    public CatalogImagePipelineService(CatalogImageRepository images, CatalogProductRepository products, CatalogSourceRepository sources,
                                       WebFetchPort web, MediaStoragePort storage, Guard guard, TransactionTemplate tx,
                                       ObjectProvider<PersonSegmentationPort> persons,
                                       @Value("${fashionai.catalog.image-pipeline.enabled:false}") boolean enabled,
                                       @Value("${fashionai.catalog.image-pipeline.batch:8}") int batch,
                                       @Value("${fashionai.catalog.image-pipeline.max-attempts:3}") int maxAttempts) {
        this.images = images;
        this.products = products;
        this.sources = sources;
        this.web = web;
        this.storage = storage;
        this.guard = guard;
        this.tx = tx;
        this.pipeline = new CatalogImagePipeline(SemanticRegionRegistry.get(), persons.getIfAvailable());
        this.enabled = enabled;
        this.batch = Math.max(1, batch);
        this.maxAttempts = Math.max(1, maxAttempts);
    }

    @Scheduled(fixedDelayString = "${fashionai.catalog.image-pipeline.poll-ms:15000}", initialDelay = 20000)
    public void tick() {
        if (!enabled) {
            return;
        }
        for (UUID id : claim(batch)) {
            try {
                process(id);
            } catch (RuntimeException e) {
                log.warn("event=catalog_image_failed imageId={} error={}", id, e.getClass().getSimpleName());
                tx.executeWithoutResult(s -> images.findById(id).ifPresent(i -> {
                    i.setProcessingStatus("FAILED");
                    i.setGateReasons("PIPELINE_ERROR");
                    images.save(i);
                }));
            }
        }
    }

    /** Marca o lote como DOWNLOADING numa transação curta (um tick não pega o que outro já pegou). */
    List<UUID> claim(int size) {
        List<UUID> ids = tx.execute(s -> {
            List<UUID> out = new ArrayList<>();
            for (CatalogImage i : images.pipelineQueue(CatalogImagePipeline.VERSION, maxAttempts,
                    Instant.now().minus(java.time.Duration.ofMinutes(15)), PageRequest.of(0, size))) {
                i.setProcessingStatus("DOWNLOADING");
                i.setAttempts(i.getAttempts() + 1);
                images.save(i);
                out.add(i.getId());
            }
            return out;
        });
        return ids == null ? List.of() : ids;
    }

    /** Uma imagem: download seguro → cache por hash → pipeline → metadados (+ master no nível B) → canônica do produto. */
    public void process(UUID imageId) {
        CatalogImage img = images.findById(imageId).orElseThrow(() -> ApiException.notFound("catalog image"));
        CatalogProduct product = products.findById(img.getProductId()).orElse(null);
        long t0 = System.nanoTime();
        Optional<WebFetchPort.Fetched> fetched = web.get(img.getImageUrl(), (int) ImageOps.MAX_UPLOAD_BYTES, "image/");
        if (fetched.isEmpty()) {
            finish(img, "FAILED", List.of("FETCH_FAILED"), null);
            log.info("event=catalog_image_processed imageId={} productId={} status=FAILED reason=FETCH_FAILED", img.getId(), img.getProductId());
            return;
        }
        byte[] bytes = fetched.get().body();
        String sha = CatalogImagePipeline.sha256(bytes);
        boolean persist = product != null && allowsPersistence(product, img);
        Optional<CatalogImage> cached = persist ? Optional.empty()
                : images.findFirstBySourceSha256AndPipelineVersionAndProcessingStatusIn(sha, CatalogImagePipeline.VERSION, DONE)
                .filter(c -> !c.getId().equals(img.getId()))
                .filter(c -> sameContext(c, img, product));
        if (cached.isPresent()) {
            copyAnalysis(cached.get(), img);
        } else {
            CatalogImagePipeline.Analysis a = pipeline.run(new CatalogImagePipeline.Request(bytes,
                    product == null ? null : product.getCategory(), product == null ? null : product.getSubcategory(),
                    img.getImageType() == null ? null : img.getImageType().name(), persist));
            apply(img, a, persist);
        }
        tx.executeWithoutResult(s -> {
            images.save(img);
            rerank(img.getProductId());
        });
        log.info("event=catalog_image_processed imageId={} productId={} status={} quality={} reasons={} persisted={} cached={} ms={} version={}",
                img.getId(), img.getProductId(), img.getProcessingStatus(), img.getQualityScore(), img.getGateReasons(), persist,
                cached.isPresent(), (System.nanoTime() - t0) / 1_000_000, CatalogImagePipeline.VERSION);
    }

    /**
     * O pipeline usa categoria, subcategoria e tipo de vista para decidir peça, foco, recorte e detailView: os mesmos
     * bytes em outro contexto não podem herdar a análise — sem contexto igual, roda o pipeline de novo.
     */
    boolean sameContext(CatalogImage cached, CatalogImage img, CatalogProduct product) {
        if (cached.getImageType() != img.getImageType()) {
            return false;
        }
        if (cached.getProductId() != null && cached.getProductId().equals(img.getProductId())) {
            return true;
        }
        CatalogProduct other = cached.getProductId() == null ? null : products.findById(cached.getProductId()).orElse(null);
        String category = product == null ? null : product.getCategory(), subcategory = product == null ? null : product.getSubcategory();
        return other == null ? category == null && subcategory == null
                : Objects.equals(other.getCategory(), category) && Objects.equals(other.getSubcategory(), subcategory);
    }

    void apply(CatalogImage img, CatalogImagePipeline.Analysis a, boolean persist) {
        img.setMime(a.mime());
        img.setWidth(dimension(a.width()));
        img.setHeight(dimension(a.height()));
        img.setSourceSha256(a.sha256());
        img.setPhash(a.phash());
        img.setCropJson(cropJson(a));
        img.setMetricsJson(metricsJson(a));
        if (persist && a.rendered() != null && a.outcome() != CatalogImageValidator.Outcome.REJECTED) {
            Map<String, Object> assets = store(img, a.rendered());
            img.setAssetsJson(Json.write(assets));
            img.setStoredUrl(String.valueOf(assets.get("master")));
            img.setUsageStatus(CatalogImageUsage.PERSISTED);
        }
        finish(img, a.outcome().name(), a.reasons(), a.qualityScore());
    }

    private void finish(CatalogImage img, String status, List<String> reasons, Double quality) {
        img.setProcessingStatus(status);
        img.setGateReasons(gateReasons(reasons));
        img.setQualityScore(qualityScore(quality));
        img.setPipelineVersion(CatalogImagePipeline.VERSION);
        img.setProcessedAt(Instant.now());
        if ("NEEDS_REPROCESSING".equals(status) && !"APPROVED".equals(img.getReviewStatus())) {
            img.setReviewStatus("PENDING");
        }
        if ("FAILED".equals(status)) {
            images.save(img);
        }
    }

    // ── colunas do nível A: o que apply()/finish() gravam a partir da Analysis; também usadas pelo
    //    CatalogImageBatchCli (lote local), para o lote gravar no banco exatamente o que a API gravaria ──

    /** width/height: 0 (foto rejeitada antes do decode) vira NULL. */
    public static Integer dimension(int px) {
        return px == 0 ? null : px;
    }

    /** crop_json: recorte 4:5 em coordenadas normalizadas da foto original; NULL quando não houve REFRAMING. */
    public static String cropJson(CatalogImagePipeline.Analysis a) {
        return a.crop() == null ? null : Json.write(a.cropJson());
    }

    /** metrics_json: métricas do QUALITY CHECK + tipo de peça, detalhe, confiança, revisão, estágios e depuração. */
    public static String metricsJson(CatalogImagePipeline.Analysis a) {
        Map<String, Object> metrics = new LinkedHashMap<>(a.metrics());
        metrics.put("pieceType", a.pieceType() == null ? null : a.pieceType().name());
        metrics.put("detailView", a.detailView());
        metrics.put("confidence", a.confidence());
        metrics.put("manualReview", a.manualReview());
        metrics.put("stages", a.stages().stream().map(CatalogImagePipeline.Stage::toMap).toList());
        metrics.put("debug", a.debug());
        return Json.write(metrics);
    }

    /** gate_reasons: motivos separados por vírgula, cortados em 500 caracteres (tamanho da coluna); NULL sem motivo. */
    public static String gateReasons(List<String> reasons) {
        if (reasons.isEmpty()) {
            return null;
        }
        String joined = String.join(",", reasons);
        return joined.substring(0, Math.min(500, joined.length()));
    }

    /** quality_score: DECIMAL com 4 casas, arredondamento HALF_UP. */
    public static BigDecimal qualityScore(Double quality) {
        return quality == null ? null : BigDecimal.valueOf(quality).setScale(4, RoundingMode.HALF_UP);
    }

    /** Mesmo conteúdo em outra URL: reaproveita a análise (sourceImageHash), sem baixar o pipeline de novo. */
    static void copyAnalysis(CatalogImage from, CatalogImage to) {
        to.setMime(from.getMime());
        to.setWidth(from.getWidth());
        to.setHeight(from.getHeight());
        to.setSourceSha256(from.getSourceSha256());
        to.setPhash(from.getPhash());
        to.setCropJson(from.getCropJson());
        to.setMetricsJson(from.getMetricsJson());
        to.setQualityScore(from.getQualityScore());
        to.setGateReasons(from.getGateReasons());
        to.setProcessingStatus(from.getProcessingStatus());
        to.setPipelineVersion(CatalogImagePipeline.VERSION);
        to.setProcessedAt(Instant.now());
        if ("NEEDS_REPROCESSING".equals(to.getProcessingStatus())) {
            to.setReviewStatus("PENDING");
        }
    }

    /** Nível B só quando a fonte oficial do domínio da foto declara allows_image_persistence (RN47.03). */
    boolean allowsPersistence(CatalogProduct product, CatalogImage img) {
        String host = host(img.getImageUrl()), sourceDomain = img.getSourceDomain();
        for (CatalogSource s : sources.findByBrandIdAndActiveTrue(product.getBrandId())) {
            if (!s.isAllowsImagePersistence() || s.getDomain() == null) {
                continue;
            }
            String d = s.getDomain().toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
            if ((host != null && (host.equals(d) || host.endsWith("." + d))) || d.equalsIgnoreCase(sourceDomain)) {
                return true;
            }
        }
        return false;
    }

    static String host(String url) {
        try {
            String h = URI.create(url).getHost();
            return h == null ? null : h.toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Map<String, Object> store(CatalogImage img, BackgroundNormalizer.Rendered r) {
        String base = "catalog/" + img.getProductId() + "/" + img.getId() + "/" + CatalogImagePipeline.VERSION.toLowerCase(Locale.ROOT) + "/";
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("master", put(base + "master.png", ImageOps.png(r.transparent()), "image/png"));
        out.put("white", put(base + "white.jpg", ImageOps.jpeg(r.white(), 0.92f), "image/jpeg"));
        out.put("neutral", put(base + "neutral.jpg", ImageOps.jpeg(r.neutral(), 0.92f), "image/jpeg"));
        out.put("card", put(base + "card.jpg", ImageOps.jpeg(r.card(), 0.9f), "image/jpeg"));
        out.put("thumbnail", put(base + "thumb.jpg", ImageOps.jpeg(r.thumbnail(), 0.85f), "image/jpeg"));
        out.put("width", r.width());
        out.put("height", r.height());
        return out;
    }

    private String put(String key, byte[] body, String type) {
        storage.put(key, body, type);
        return storage.publicUrl(key).toString();
    }

    /** Reclassifica as fotos do produto: canônica = melhor APROVADA de vista principal; detalhe nunca é master. */
    void rerank(UUID productId) {
        List<CatalogImage> all = images.findByProductIdOrderByPrimaryDescCreatedAtAsc(productId).stream()
                .filter(i -> DONE.contains(i.getProcessingStatus())).toList();
        if (all.isEmpty()) {
            return;
        }
        Map<String, CatalogImage> byId = new LinkedHashMap<>();
        List<ImageCandidateRanker.Candidate> cands = new ArrayList<>();
        for (CatalogImage i : all) {
            byId.put(i.getId().toString(), i);
            CatalogImageValidator.Outcome outcome = "APPROVED".equals(i.getReviewStatus()) ? CatalogImageValidator.Outcome.APPROVED
                    : "REJECTED".equals(i.getReviewStatus()) ? CatalogImageValidator.Outcome.REJECTED
                    : CatalogImageValidator.Outcome.valueOf(i.getProcessingStatus());
            Map<String, Object> m = i.getMetricsJson() == null ? Map.of() : Json.map(i.getMetricsJson());
            cands.add(new ImageCandidateRanker.Candidate(i.getId().toString(), i.getImageType() == null ? null : i.getImageType().name(),
                    outcome, i.getQualityScore() == null ? 0 : i.getQualityScore().doubleValue(), Boolean.TRUE.equals(m.get("detailView")),
                    i.getPhash()));
        }
        PieceType type = products.findById(productId).map(p -> PieceType.of(p.getCategory())).orElse(null);
        List<ImageCandidateRanker.Ranked> ranked = ranker.rank(cands, type);
        boolean manualCanonical = all.stream().anyMatch(i -> i.isCanonical() && "APPROVED".equals(i.getReviewStatus()));
        for (ImageCandidateRanker.Ranked r : ranked) {
            CatalogImage i = byId.get(r.candidate().id());
            i.setViewRole(r.role().name());
            if (!manualCanonical) {
                i.setCanonical(r.role() == ImageCandidateRanker.Role.CANONICAL);
            }
            images.save(i);
        }
    }

    // ── administração: CatalogImageReviewQueue, métricas e depuração visual ──

    public Map<String, Object> reviewQueue(CurrentUser user, int limit) {
        guard.requireAdmin(user);
        List<Map<String, Object>> items = images.findByReviewStatusOrderByProcessedAtAsc("PENDING", PageRequest.of(0, Math.min(100, Math.max(1, limit))))
                .stream().map(this::view).toList();
        return Map.of("items", items, "pending", images.countByReviewStatus("PENDING"), "actions", ACTIONS);
    }

    public record ReviewCommand(String action, UUID alternateImageId, String note) {
    }

    public Map<String, Object> decide(CurrentUser user, UUID imageId, ReviewCommand cmd) {
        guard.requireAdmin(user);
        String action = cmd == null || cmd.action() == null ? "" : cmd.action().toUpperCase(Locale.ROOT);
        if (!ACTIONS.contains(action)) {
            throw ApiException.badRequest("ACAO_INVALIDA", "Ação deve ser uma de " + ACTIONS);
        }
        return tx.execute(s -> {
            CatalogImage img = images.findById(imageId).orElseThrow(() -> ApiException.notFound("catalog image"));
            switch (action) {
                case "APPROVE" -> {
                    img.setReviewStatus("APPROVED");
                    img.setProcessingStatus("APPROVED");
                }
                case "REJECT" -> {
                    img.setReviewStatus("REJECTED");
                    img.setProcessingStatus("REJECTED");
                    img.setCanonical(false);
                }
                case "REPROCESS" -> {
                    img.setReviewStatus("NONE");
                    img.setProcessingStatus("PENDING");
                    img.setAttempts(0);
                    img.setCanonical(false);
                }
                default -> {                                   // SELECT_ALTERNATE_IMAGE
                    if (cmd.alternateImageId() == null) {
                        throw ApiException.badRequest("ALTERNATIVA_OBRIGATORIA", "Informe alternateImageId (outra foto oficial do mesmo produto)");
                    }
                    CatalogImage alt = images.findById(cmd.alternateImageId()).orElseThrow(() -> ApiException.notFound("catalog image"));
                    if (!alt.getProductId().equals(img.getProductId())) {
                        throw ApiException.badRequest("ALTERNATIVA_DE_OUTRO_PRODUTO", "A foto alternativa precisa ser do mesmo produto");
                    }
                    images.findByProductIdOrderByPrimaryDescCreatedAtAsc(img.getProductId()).forEach(o -> {
                        o.setCanonical(false);
                        images.save(o);
                    });
                    img.setReviewStatus("REJECTED");
                    alt.setReviewStatus("APPROVED");
                    alt.setCanonical(true);
                    if (!DONE.contains(alt.getProcessingStatus())) {
                        alt.setProcessingStatus("APPROVED");
                    }
                    images.save(alt);
                }
            }
            images.save(img);
            rerank(img.getProductId());
            log.info("event=catalog_image_review imageId={} action={} admin={}", imageId, action, user.id());
            return view(img);
        });
    }

    public Map<String, Object> metrics(CurrentUser user) {
        guard.requireAdmin(user);
        Map<String, Object> byStatus = new LinkedHashMap<>();
        images.countByStatus().forEach(r -> byStatus.put(String.valueOf(r[0]), r[1]));
        List<Map<String, Object>> reasons = images.topReasons(PageRequest.of(0, 10)).stream()
                .map(r -> Map.<String, Object>of("reasons", String.valueOf(r[0]), "count", r[1])).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pipelineVersion", CatalogImagePipeline.VERSION);
        m.put("enabled", enabled);
        m.put("byStatus", byStatus);
        m.put("canonical", images.countByCanonicalTrue());
        m.put("reviewPending", images.countByReviewStatus("PENDING"));
        m.put("averageQuality", images.averageQuality());
        m.put("topRejectionReasons", reasons);
        return m;
    }

    /** Antes/depois e depuração visual (bbox, máscara, foco, regiões críticas, candidatos, recorte final): só admin. */
    public Map<String, Object> debug(CurrentUser user, UUID imageId) {
        guard.requireAdmin(user);
        return view(images.findById(imageId).orElseThrow(() -> ApiException.notFound("catalog image")));
    }

    /** Reprocessa todas as fotos de um produto (ou uma nova versão do pipeline pega tudo sozinha pelo pipeline_version). */
    public Map<String, Object> enqueueProduct(CurrentUser user, UUID productId) {
        guard.requireAdmin(user);
        Integer n = tx.execute(s -> {
            List<CatalogImage> list = images.findByProductIdOrderByPrimaryDescCreatedAtAsc(productId);
            list.forEach(i -> {
                i.setProcessingStatus("PENDING");
                i.setAttempts(0);
                images.save(i);
            });
            return list.size();
        });
        return Map.of("productId", productId, "queued", n == null ? 0 : n);
    }

    Map<String, Object> view(CatalogImage i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", i.getId());
        m.put("productId", i.getProductId());
        m.put("sourceUrl", i.getImageUrl());
        m.put("processedUrl", i.getStoredUrl());
        m.put("viewType", i.getImageType() == null ? null : i.getImageType().name());
        m.put("viewRole", i.getViewRole());
        m.put("canonical", i.isCanonical());
        m.put("processingStatus", i.getProcessingStatus());
        m.put("reviewStatus", i.getReviewStatus());
        m.put("qualityScore", i.getQualityScore());
        m.put("reasons", i.getGateReasons() == null ? List.of() : List.of(i.getGateReasons().split(",")));
        m.put("usageStatus", i.getUsageStatus() == null ? null : i.getUsageStatus().name());
        m.put("width", i.getWidth());
        m.put("height", i.getHeight());
        m.put("crop", i.getCropJson() == null ? null : Json.map(i.getCropJson()));
        m.put("metrics", i.getMetricsJson() == null ? null : Json.map(i.getMetricsJson()));
        m.put("assets", i.getAssetsJson() == null ? null : Json.map(i.getAssetsJson()));
        m.put("pipelineVersion", i.getPipelineVersion());
        m.put("processedAt", i.getProcessedAt());
        return m;
    }

    /**
     * Imagem que o card deve mostrar e como: master processado (nível B) ou URL original com o recorte semântico (nível A).
     * null = sem canônica aprovada (o card segue com a foto principal, inteira).
     */
    public static Map<String, Object> cardImage(CatalogImage canonical) {
        if (canonical == null || !canonical.isCanonical()) {
            return null;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        if (canonical.getAssetsJson() != null) {
            Map<String, Object> assets = Json.map(canonical.getAssetsJson());
            m.put("url", assets.getOrDefault("card", canonical.getStoredUrl()));
            m.put("thumbnailUrl", assets.get("thumbnail"));
            m.put("mode", "PROCESSED");
        } else {
            m.put("url", canonical.getImageUrl());
            m.put("mode", "SEMANTIC_CROP");
            if (canonical.getCropJson() != null) {
                Map<String, Object> crop = Json.map(canonical.getCropJson());
                m.put("crop", crop.get("crop"));
                m.put("background", crop.get("background"));
                m.put("aspect", crop.get("aspect"));
            }
        }
        if (canonical.getCropJson() != null) m.put("aspect", Json.map(canonical.getCropJson()).get("aspect"));
        m.put("imageId", canonical.getId());
        m.put("qualityScore", canonical.getQualityScore());
        m.put("pipelineVersion", canonical.getPipelineVersion());
        return m;
    }
}
