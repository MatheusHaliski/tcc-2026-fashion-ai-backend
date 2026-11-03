package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonSegmentationPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.WebFetchPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogSourceRepository;
import br.com.fashionai.domain.repository.CatalogVariantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Worker e operação do pipeline de imagens da Busca Catalogada (docs/catalogo/PIPELINE_IMAGENS_CATALOGO.md).
 * Ligado por padrão ({@code fashionai.catalog.image-pipeline.enabled}); cada tick pega um lote de imagens PENDING
 * (ou de versão anterior do pipeline), baixa com o {@link WebFetchPort} (só https, só IP público, redirecionamento
 * revalidado a cada salto, limite de bytes), roda o {@link CatalogImagePipeline} e grava só metadados — ou, quando a
 * fonte permite persistência, também o master no storage. Depois reclassifica as fotos do produto e escolhe a canônica.
 */
@Service
public class CatalogImagePipelineService {
    private static final Logger log = LoggerFactory.getLogger(CatalogImagePipelineService.class);
    static final Set<String> DONE = Set.of("APPROVED", "NEEDS_REPROCESSING", "REJECTED");
    public static final Set<String> ACTIONS = Set.of("APPROVE", "REPROCESS", "SELECT_ALTERNATE_IMAGE", "REJECT");
    public static final String PREVIEW_CACHE_VERSION = "CATALOG_PREVIEW_FRAMES_V2";
    /** Versão do Total frame: a interface encaixa a caixa da peça num quadro 3:4 com margem uniforme. */
    public static final String WHOLE_FRAME_VERSION = "WHOLE_FRAME_V1";
    /** Versão da Peça inteira processada (lote process_whole_frames): a peça recortada sem pessoa, 900×1200. */
    public static final String WHOLE_PROCESSED_VERSION = "WHOLE_FRAME_V3";

    private final Guard guard;
    private final boolean enabled;
    private final int batch;
    private final CatalogImageBindings bindings;
    private final CatalogImageWorker worker;
    private final CatalogFrameSelection selection;
    private final CatalogTextureTransport textures;
    private final CatalogImageReview review;

    public CatalogImagePipelineService(CatalogImageRepository images, CatalogProductRepository products, CatalogSourceRepository sources, CatalogVariantRepository variants,
                                       WebFetchPort web, MediaStoragePort storage, Guard guard, TransactionTemplate tx,
                                       ObjectProvider<PersonSegmentationPort> persons,
                                       @Value("${fashionai.catalog.image-pipeline.enabled:true}") boolean enabled,
                                       @Value("${fashionai.catalog.image-pipeline.batch:8}") int batch,
                                       @Value("${fashionai.catalog.image-pipeline.max-attempts:3}") int maxAttempts) {
        this.guard = guard;
        CatalogImagePipeline pipeline = new CatalogImagePipeline(SemanticRegionRegistry.get(), persons.getIfAvailable());
        this.enabled = enabled;
        this.batch = Math.min(32, Math.max(1, batch));
        this.bindings = new CatalogImageBindings(images, sources, variants);
        CatalogPreviewWriter writer = new CatalogPreviewWriter(storage, bindings);
        CatalogImageRanking ranking = new CatalogImageRanking(images, products);
        this.worker = new CatalogImageWorker(images, products, web, tx, pipeline, bindings, writer, ranking, Math.max(1, maxAttempts));
        this.selection = new CatalogFrameSelection(images, products, variants, web, tx, pipeline, bindings, writer);
        this.textures = new CatalogTextureTransport(images, products, variants, web, storage, bindings);
        this.review = new CatalogImageReview(images, tx, ranking, enabled);
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
                worker.markFailed(id);
            }
        }
    }

    /** Marca o lote como DOWNLOADING numa transação curta (um tick não pega o que outro já pegou). */
    List<UUID> claim(int size) {
        return worker.claim(size);
    }

    /** Uma imagem: download seguro → cache por hash → pipeline → metadados (+ master no nível B) → canônica do produto. */
    public void process(UUID imageId) {
        worker.process(imageId);
    }

    public void ensurePreview(CurrentUser user, UUID productId) {
        ensurePreview(user, productId, false);
    }

    public record TexturePhoto(byte[] bytes, String mime) { }

    /** Authenticated transport for the approved original, not the display fabric crop or an arbitrary URL. */
    public TexturePhoto texturePhoto(CurrentUser user, UUID productId) {
        return texturePhoto(user, productId, false);
    }

    /** isolated=true never falls back to an unsegmented catalogue/model photograph. */
    public TexturePhoto texturePhoto(CurrentUser user, UUID productId, boolean isolated) {
        return texturePhoto(user,productId,isolated,null,null);
    }

    /** Explicit image/variant selectors are IDs scoped to this product, never arbitrary fetch URLs. */
    public TexturePhoto texturePhoto(CurrentUser user, UUID productId, boolean isolated, UUID variantId, UUID imageId) {
        return texturePhoto(user, productId, isolated, variantId, imageId, null);
    }

    /** Vista da foto pedida pelo provador: a frente (padrão) ou as costas da peça. */
    public enum TextureView { FRONT, BACK;
        public static TextureView of(String raw) {
            return raw == null || raw.isBlank() ? FRONT : "BACK".equalsIgnoreCase(raw.trim()) ? BACK : FRONT;
        }
    }

    /**
     * {@code view=BACK}: só uma foto marcada como costas da mesma peça/variante — nunca a frente no lugar (o provador
     * deixa as costas no tecido medido e registra "sem evidência"). A frente nunca recebe uma foto de costas: o logo da
     * nuca não pode ir parar no peito.
     */
    public TexturePhoto texturePhoto(CurrentUser user, UUID productId, boolean isolated, UUID variantId, UUID imageId, TextureView view) {
        guard.requireCanCreate(user);
        return textures.texturePhoto(productId, isolated, variantId, imageId, view);
    }

    /** An explicit retry rechecks this product's original/alternative photos, without discarding the last valid frame. */
    public void ensurePreview(CurrentUser user, UUID productId, boolean force) {
        ensurePreview(user,productId,force,null,null);
    }

    public void ensurePreview(CurrentUser user, UUID productId, boolean force, UUID variantId, UUID imageId) {
        guard.requireCanCreate(user);
        selection.ensurePreview(productId, force, variantId, imageId, () -> verifySelection(user, productId,variantId,imageId));
    }

    /** Apply the same product framing rule as the worker, using another photo of this product if needed. */
    public void verifySelection(CurrentUser user, UUID productId) {
        verifySelection(user,productId,null,null);
    }

    public void verifySelection(CurrentUser user, UUID productId, UUID variantId, UUID imageId) {
        guard.requireCanCreate(user);
        selection.verifySelection(productId, variantId, imageId);
    }

    boolean sameContext(CatalogImage cached, CatalogImage img, CatalogProduct product) {
        return worker.sameContext(cached, img, product);
    }

    // ── colunas do nível A (documentadas em CatalogImageColumns), também usadas pelo CatalogImageBatchCli ──

    public static Integer dimension(int px) {
        return CatalogImageColumns.dimension(px);
    }

    public static String cropJson(CatalogImagePipeline.Analysis a) {
        return CatalogImageColumns.cropJson(a);
    }

    public static String metricsJson(CatalogImagePipeline.Analysis a) {
        return CatalogImageColumns.metricsJson(a);
    }

    public static String gateReasons(List<String> reasons) {
        return CatalogImageColumns.gateReasons(reasons);
    }

    public static BigDecimal qualityScore(Double quality) {
        return CatalogImageColumns.qualityScore(quality);
    }

    boolean allowsPersistence(CatalogProduct product, CatalogImage img) {
        return bindings.allowsPersistence(product, img);
    }

    // ── administração: CatalogImageReviewQueue, métricas e depuração visual ──

    public Map<String, Object> reviewQueue(CurrentUser user, int limit) {
        guard.requireAdmin(user);
        return review.reviewQueue(limit);
    }

    public record ReviewCommand(String action, UUID alternateImageId, String note) {
    }

    public Map<String, Object> decide(CurrentUser user, UUID imageId, ReviewCommand cmd) {
        guard.requireAdmin(user);
        return review.decide(user, imageId, cmd);
    }

    public Map<String, Object> metrics(CurrentUser user) {
        guard.requireAdmin(user);
        return review.metrics();
    }

    /** Antes/depois e depuração visual (bbox, máscara, foco, regiões críticas, candidatos, recorte final): só admin. */
    public Map<String, Object> debug(CurrentUser user, UUID imageId) {
        guard.requireAdmin(user);
        return review.debug(imageId);
    }

    /** Reprocessa todas as fotos de um produto (ou uma nova versão do pipeline pega tudo sozinha pelo pipeline_version). */
    public Map<String, Object> enqueueProduct(CurrentUser user, UUID productId) {
        guard.requireAdmin(user);
        return review.enqueueProduct(productId);
    }

    /**
     * Imagem que o card deve mostrar e como: master processado (nível B) ou URL original com o recorte semântico (nível A).
     * null = sem enquadramento aprovado; a interface deve mostrar estado de processamento/erro, nunca foto crua.
     */
    public static Map<String, Object> cardImage(CatalogImage canonical) {
        return CatalogCardImage.cardImage(canonical);
    }

    public static Map<String,Object> photoSet(CatalogImage image, CatalogProduct product) {
        return photoSet(image,product,List.of());
    }

    public static Map<String,Object> photoSet(CatalogImage image, CatalogProduct product,List<CatalogVariant> productVariants) {
        return CatalogPhotoEvidence.photoSet(image, product, productVariants);
    }

    /** Product edits invalidate the old derivative without downloading any photograph on a list/read request. */
    public static Map<String, Object> cardImage(CatalogImage canonical, CatalogProduct product) {
        return cardImage(canonical,product,List.of());
    }

    public static Map<String, Object> cardImage(CatalogImage canonical,CatalogProduct product,List<CatalogVariant> productVariants) {
        return CatalogCardImage.cardImage(canonical, product, productVariants);
    }

    /** Foto do catálogo que pode ir à GPU na Prova com IA (canônica aprovada, gravada com autorização, sem pessoa). */
    public static boolean vtonGarment(CatalogImage image) {
        return CatalogPhotoEvidence.vtonGarment(image);
    }
}
