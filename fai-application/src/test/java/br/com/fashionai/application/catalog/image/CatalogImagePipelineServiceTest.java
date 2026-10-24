package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.WebFetchPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogSource;
import br.com.fashionai.domain.model.enums.CatalogImageType;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogSourceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CatalogImagePipelineServiceTest {
    private final Map<UUID, CatalogImage> db = new LinkedHashMap<>();
    private final Map<String, byte[]> web = new HashMap<>();
    private final Map<String, byte[]> stored = new HashMap<>();
    private final List<CatalogSource> sources = new ArrayList<>();
    private CatalogImagePipelineService service;
    private CatalogProduct product;
    private CatalogProductRepository products;
    private final CurrentUser admin = new CurrentUser(UUID.randomUUID(), "admin", "ADMIN", null, true, null, null, null);

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        CatalogImageRepository images = mock(CatalogImageRepository.class);
        when(images.save(any())).thenAnswer(inv -> {
            CatalogImage i = inv.getArgument(0);
            db.put(i.getId(), i);
            return i;
        });
        when(images.findById(any())).thenAnswer(inv -> Optional.ofNullable(db.get(inv.<UUID>getArgument(0))));
        when(images.findByProductIdOrderByPrimaryDescCreatedAtAsc(any())).thenAnswer(inv ->
                db.values().stream().filter(i -> i.getProductId().equals(inv.getArgument(0))).toList());
        when(images.pipelineQueue(anyString(), anyInt(), any(), any())).thenAnswer(inv ->
                db.values().stream().filter(i -> "PENDING".equals(i.getProcessingStatus())).toList());
        when(images.findFirstBySourceSha256AndPipelineVersionAndProcessingStatusIn(anyString(), anyString(), any())).thenAnswer(inv ->
                db.values().stream().filter(i -> inv.<String>getArgument(0).equals(i.getSourceSha256())
                        && CatalogImagePipelineService.DONE.contains(i.getProcessingStatus())).findFirst());
        when(images.findByReviewStatusOrderByProcessedAtAsc(eq("PENDING"), any())).thenAnswer(inv ->
                db.values().stream().filter(i -> "PENDING".equals(i.getReviewStatus())).toList());
        products = mock(CatalogProductRepository.class);
        product = new CatalogProduct();
        product.assignId(UUID.randomUUID());
        product.setBrandId(UUID.randomUUID());
        product.setCategory("upper_piece");
        product.setSubcategory("t_shirt");
        when(products.findById(product.getId())).thenReturn(Optional.of(product));
        CatalogSourceRepository sourceRepo = mock(CatalogSourceRepository.class);
        when(sourceRepo.findByBrandIdAndActiveTrue(any())).thenAnswer(inv -> sources);
        WebFetchPort fetch = (url, max, accept) -> Optional.ofNullable(web.get(url)).map(b -> new WebFetchPort.Fetched(url, "image/jpeg", b));
        MediaStoragePort storage = mock(MediaStoragePort.class);
        when(storage.put(anyString(), any(), anyString())).thenAnswer(inv -> {
            stored.put(inv.getArgument(0), inv.getArgument(1));
            return null;
        });
        when(storage.publicUrl(anyString())).thenAnswer(inv -> URI.create("https://media.fashion-ai.app/" + inv.getArgument(0)));
        when(storage.keyOf(anyString())).thenAnswer(inv -> {
            String url = inv.getArgument(0), prefix = "https://media.fashion-ai.app/";
            return url.startsWith(prefix) ? Optional.of(url.substring(prefix.length())) : Optional.empty();
        });
        when(storage.get(anyString())).thenAnswer(inv -> stored.get(inv.<String>getArgument(0)));
        TransactionTemplate tx = mock(TransactionTemplate.class);
        when(tx.execute(any())).thenAnswer(inv -> inv.<TransactionCallback<Object>>getArgument(0).doInTransaction(null));
        doAnswer(inv -> {
            inv.<Consumer<Object>>getArgument(0).accept(null);
            return null;
        }).when(tx).executeWithoutResult(any());
        Guard guard = mock(Guard.class);
        doAnswer(inv -> {
            CurrentUser u = inv.getArgument(0);
            if (u == null || !u.admin()) {
                throw ApiException.forbidden("admin");
            }
            return null;
        }).when(guard).requireAdmin(any());
        ObjectProvider<br.com.fashionai.application.moderation.ImageSafetyPorts.PersonSegmentationPort> none = mock(ObjectProvider.class);
        service = new CatalogImagePipelineService(images, products, sourceRepo, fetch, storage, guard, tx, none, true, 8, 3);
    }

    private CatalogImage image(String url, CatalogImageType type, byte[] body) {
        CatalogImage i = new CatalogImage();
        i.assignId(UUID.randomUUID());
        i.setProductId(product.getId());
        i.setImageUrl(url);
        i.setImageUrlHash(CatalogImagePipeline.sha256(url));
        i.setImageType(type);
        i.setSourceDomain("brand.com");
        i.setUsageStatus(CatalogImageUsage.REFERENCE_ONLY);
        i.setRetrievedAt(Instant.now());
        db.put(i.getId(), i);
        if (body != null) {
            web.put(url, body);
        }
        return i;
    }

    private static Map<String, Object> sourcePreflight() {
        return new LinkedHashMap<>(Map.of("version", "CATALOG_SOURCE_PREFLIGHT_V1", "status", "PASS",
                "measurementReliable", true, "sourceGarmentHeightFraction", .25, "complete", true,
                "occluded", false, "isolationVerified", true, "humanAssessmentComplete", true));
    }

    private Map<String, Object> photoEvidence(CatalogImage image, String status) {
        Map<String,Object> state = new LinkedHashMap<>();
        state.put("version", "CATALOG_PHOTO_SET_V2"); state.put("sourceUrl", image.getImageUrl());
        state.put("sourceSha256", image.getSourceSha256()); state.put("category", product.getCategory());
        state.put("subcategory", product.getSubcategory()); state.put("color", product.getColor()); state.put("status", status);
        state.put("wholeUrl", "https://media.fashion-ai.app/whole.png"); state.put("fabricUrl", "https://media.fashion-ai.app/fabric.png");
        state.put("defaultAssetUrl", "/api/catalog/default-asset?category=upper_piece");
        state.put("metrics", Map.of("preflight", sourcePreflight()));
        return state;
    }

    @Test
    void somenteEnquadramentoAprovadoPodeSerExibidoSemFotoCruaEmFalha() {
        CatalogImage photo = image("https://img.brand.com/framed.jpg", CatalogImageType.FRONT,
                CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0)));
        photo.setCanonical(true);
        assertThat(CatalogImagePipelineService.cardImage(photo)).isNull();
        service.process(photo.getId());
        photo.setCanonical(true);
        assertThat(CatalogImagePipelineService.cardImage(photo)).isNotNull();
        photo.setProcessingStatus("FAILED");
        assertThat(CatalogImagePipelineService.cardImage(photo)).isNull();
        photo.setProcessingStatus("APPROVED");photo.setCropJson(null);
        assertThat(CatalogImagePipelineService.cardImage(photo)).isNull();
    }

    @Test
    void totalFrameLegadoSemIsolamentoSemanticoNuncaExpoeFotoOriginal() {
        CatalogImage packshot = new CatalogImage();
        packshot.setImageUrl("https://img.brand.com/shorts.jpg");
        packshot.setWidth(864); packshot.setHeight(1152);
        packshot.setCropJson(Json.write(Map.of("product", Map.of("x", 0.12, "y", 0.19, "w", 0.75, "h", 0.6), "background", "#f4f5f7")));
        packshot.setMetricsJson(Json.write(Map.of("debug", Map.of("productFrame", Map.of("model", false), "sourceHumanEvidence", 0.0, "truncated", List.of()))));
        assertThat(CatalogImagePipelineService.wholeFrame(packshot)).isNull();

        // foto com modelo, com pele de pessoa ou sem fundo de estúdio: o card continua no recorte de sempre
        packshot.setMetricsJson(Json.write(Map.of("debug", Map.of("productFrame", Map.of("model", true)))));
        assertThat(CatalogImagePipelineService.wholeFrame(packshot)).isNull();
        packshot.setMetricsJson(Json.write(Map.of("debug", Map.of("sourceHumanEvidence", 0.02))));
        assertThat(CatalogImagePipelineService.wholeFrame(packshot)).isNull();
        packshot.setMetricsJson(null);
        packshot.setCropJson(Json.write(Map.of("product", Map.of("x", 0.12, "y", 0.19, "w", 0.75, "h", 0.6))));
        assertThat(CatalogImagePipelineService.wholeFrame(packshot)).isNull();
        packshot.setCropJson(Json.write(Map.of("product", Map.of("x", 0.5, "y", 0.5, "w", 0.9, "h", 0.9), "background", "#ffffff")));
        assertThat(CatalogImagePipelineService.wholeFrame(packshot)).isNull();
    }

    @Test
    void pecaInteiraProcessadaValeAteParaFotoComModeloENuncaUsaAFotoOriginal() {
        CatalogImage jeans = new CatalogImage();
        jeans.setImageUrl("https://img.brand.com/jeans-modelo.jpg");
        jeans.setMetricsJson(Json.write(Map.of("debug", Map.of("productFrame", Map.of("model", true), "sourceHumanEvidence", 0.04))));
        assertThat(CatalogImagePipelineService.wholeFrame(jeans)).isNull();

        jeans.setWholeUrl("https://media.fashion-ai.app/catalog/whole/a/b.jpg");
        jeans.setWholeStatus("DONE");
        jeans.setSourceSha256("a".repeat(64));
        jeans.setWholePipelineVersion(CatalogImagePipelineService.WHOLE_PROCESSED_VERSION);
        Map<String,Object> info = new LinkedHashMap<>(Map.of("box", Map.of("x", 0.375, "y", 0.25, "w", 0.25, "h", 0.5),
                "background", "#F4F5F7", "width", 900, "height", 1200, "truncated", List.of(),
                "version", CatalogImagePipelineService.WHOLE_PROCESSED_VERSION, "sourceUrl", jeans.getImageUrl(),
                "sourceSha256", jeans.getSourceSha256(), "preflight", sourcePreflight()));
        jeans.setWholeJson(Json.write(info));
        Map<String, Object> whole = CatalogImagePipelineService.wholeFrame(jeans);
        assertThat(whole).containsEntry("url", "https://media.fashion-ai.app/catalog/whole/a/b.jpg").containsEntry("processed", true)
                .containsEntry("version", CatalogImagePipelineService.WHOLE_PROCESSED_VERSION).containsEntry("width", 900).containsEntry("height", 1200);
        assertThat(whole.get("truncated")).isEqualTo(List.of());

        info.put("truncated", List.of("bottom")); jeans.setWholeJson(Json.write(info));
        assertThat(CatalogImagePipelineService.wholeFrame(jeans)).isNull();
        info.put("truncated", List.of()); jeans.setWholeJson(Json.write(info));
        jeans.setSourceSha256("b".repeat(64));
        assertThat(CatalogImagePipelineService.wholeFrame(jeans)).isNull();
        jeans.setSourceSha256("a".repeat(64));

        // processamento com falha ou caixa inválida: sem Peça inteira (a interface mostra o enquadramento de tecido)
        jeans.setWholeStatus("FAILED");
        assertThat(CatalogImagePipelineService.wholeFrame(jeans)).isNull();
        jeans.setWholeStatus("DONE");
        jeans.setWholeJson(Json.write(Map.of("box", Map.of("x", 0.6, "y", 0.1, "w", 0.6, "h", 0.5))));
        assertThat(CatalogImagePipelineService.wholeFrame(jeans)).isNull();
    }

    @Test
    void previewAutomaticoReutilizaRecorteSemNovoDownload() {
        product.setCategory("upper_piece"); product.setSubcategory("t_shirt");
        CatalogImage front = image("https://img.brand.com/preview.jpg", CatalogImageType.FRONT,
                CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0)));
        service.ensurePreview(admin, product.getId());
        String crop = front.getCropJson();
        web.remove(front.getImageUrl());
        service.ensurePreview(admin, product.getId());
        assertThat(front.getCropJson()).isEqualTo(crop);
        assertThat(stored).isEmpty();
        Map<?, ?> preview = (Map<?, ?>) CatalogImagePipelineService.cardImage(front).get("previewCache");
        assertThat(preview.get("persisted")).isEqualTo(false);
        assertThat(preview.get("status")).isEqualTo("READY");
    }

    @Test
    void textureTransportReadsOnlyTheApprovedOriginalWithoutRenderingOrPersistingAgain() {
        byte[] original = CatalogPhotos.png(CatalogPhotos.tee(200, 200, 1.0));
        CatalogImage front = image("https://img.brand.com/texture.png", CatalogImageType.FRONT, original);
        service.ensurePreview(admin, product.getId());
        var photo = service.texturePhoto(admin, product.getId());
        assertThat(photo.bytes()).isEqualTo(original);
        assertThat(photo.mime()).isEqualTo("image/png");
        assertThatThrownBy(() -> service.texturePhoto(admin, product.getId(), true)).isInstanceOf(ApiException.class)
                .hasMessageContaining("Foto isolada");
        assertThat(stored).isEmpty();
        front.setReviewStatus("REJECTED");
        assertThatThrownBy(() -> service.texturePhoto(admin, product.getId())).isInstanceOf(ApiException.class);
    }

    @Test
    void previewLegadoReutilizaTecidoMasNaoInventaWholeSemPreflight() {
        CatalogSource source = new CatalogSource(); source.setDomain("brand.com"); source.setAllowsImagePersistence(true); sources.add(source);
        CatalogImage front = image("https://img.brand.com/stable.jpg", CatalogImageType.PACKSHOT,
                CatalogPhotos.png(CatalogPhotos.tee(200, 200, 1.0)));
        front.setAssetsJson(Json.write(Map.of("photoSet",Map.of("status","DEFAULT"))));
        service.ensurePreview(admin, product.getId(), true);
        assertThat(Json.map(front.getAssetsJson())).containsKey("photoSet");
        Map<String, Object> card = CatalogImagePipelineService.cardImage(front, product);
        String fabricUrl = card.get("url").toString();
        assertThat(fabricUrl).endsWith("fabric.jpg");
        assertThat(card).doesNotContainKey("whole");
        assertThat(stored).hasSize(1);
        String cached = front.getAssetsJson();
        web.remove(front.getImageUrl());
        service.ensurePreview(admin, product.getId());
        service.ensurePreview(admin, product.getId());
        assertThat(front.getAssetsJson()).isEqualTo(cached);
        assertThat(CatalogImagePipelineService.cardImage(front, product).get("url")).isEqualTo(fabricUrl);
        assertThat(stored).hasSize(1);
        assertThatThrownBy(() -> service.texturePhoto(admin, product.getId(), true)).isInstanceOf(ApiException.class);
    }

    @Test
    void trocaDaCategoriaOuUrlInvalidaCacheDePreviewSemServirArteAntiga() {
        CatalogSource source = new CatalogSource(); source.setDomain("brand.com"); source.setAllowsImagePersistence(true); sources.add(source);
        byte[] bytes = CatalogPhotos.png(CatalogPhotos.tee(200, 200, 1.0));
        CatalogImage front = image("https://img.brand.com/old-source.jpg", CatalogImageType.PACKSHOT, bytes);
        service.ensurePreview(admin, product.getId());
        String oldUrl = CatalogImagePipelineService.cardImage(front, product).get("url").toString();
        product.setSubcategory("shirt");
        assertThat(CatalogImagePipelineService.cardImage(front, product)).isNull();
        service.ensurePreview(admin, product.getId());
        assertThat(CatalogImagePipelineService.cardImage(front, product).get("url")).isNotEqualTo(oldUrl);
        front.setImageUrl("https://img.brand.com/new-source.jpg");
        web.put(front.getImageUrl(), bytes);
        assertThat(CatalogImagePipelineService.cardImage(front, product)).isNull();
        service.ensurePreview(admin, product.getId());
        assertThat(CatalogImagePipelineService.cardImage(front, product)).containsEntry("sourceUrl", front.getImageUrl());
    }

    @Test
    void retryForcadoRecuperaCanonicaEmCacheIndisponivelComAlternativaDoMesmoProduto() {
        CatalogImage front = image("https://img.brand.com/cached.jpg", CatalogImageType.FRONT,
                CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0)));
        service.ensurePreview(admin, product.getId());
        String oldFrame = front.getCropJson();
        web.remove(front.getImageUrl());
        CatalogImage alternate = image("https://img.brand.com/recovered.jpg", CatalogImageType.PACKSHOT,
                CatalogPhotos.jpeg(CatalogPhotos.tee(220, 220, 1.0)));
        service.ensurePreview(admin, product.getId());
        assertThat(front.isCanonical()).isTrue();
        assertThat(alternate.getCropJson()).isNull();
        service.ensurePreview(admin, product.getId(), true);
        assertThat(front.isCanonical()).isFalse();
        assertThat(front.getCropJson()).isEqualTo(oldFrame);
        assertThat(alternate.isCanonical()).isTrue();
        assertThat(CatalogImagePipelineService.cardImage(alternate)).containsEntry("url", alternate.getImageUrl());
    }

    @Test
    void retryForcadoNaoApagaUltimoEnquadramentoQuandoFontesEstaoIndisponiveis() {
        CatalogImage front = image("https://img.brand.com/retry-unavailable.jpg", CatalogImageType.FRONT,
                CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0)));
        service.ensurePreview(admin, product.getId());
        String oldFrame = front.getCropJson();
        web.remove(front.getImageUrl());
        assertThatThrownBy(() -> service.ensurePreview(admin, product.getId(), true))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("CATALOG_IMAGE_FETCH_FAILED"));
        assertThat(front.getCropJson()).isEqualTo(oldFrame);
        assertThat(front.isCanonical()).isTrue();
    }

    @Test
    void selecaoNaoReabilitaFotoRecusadaPelaRevisao() {
        CatalogImage rejected = image("https://brand.com/rejected.png", CatalogImageType.PACKSHOT, CatalogPhotos.png(CatalogPhotos.tee(200, 200, 1.0)));
        rejected.setReviewStatus("REJECTED");
        assertThatThrownBy(() -> service.verifySelection(admin, product.getId())).isInstanceOf(ApiException.class);
        assertThat(rejected.getCropJson()).isNull();
        assertThat(rejected.isCanonical()).isFalse();
        assertThat(stored).isEmpty();
    }

    @Test
    void selecaoRefazARegraDoLoteNaFotoOriginalMesmoComAssetsAntigos() {
        product.setCategory("upper_piece"); product.setSubcategory("t_shirt");
        product.setIngestionStatus(br.com.fashionai.domain.model.enums.CatalogIngestionStatus.VALIDATED);
        CatalogImage front = image("https://img.brand.com/front.jpg", CatalogImageType.FRONT, CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0)));
        front.setAssetsJson(Json.write(Map.of("card", "https://storage.example/old.jpg")));
        front.setStoredUrl("https://storage.example/old.jpg");
        service.verifySelection(admin, product.getId());
        Map<String, Object> first = Json.map(front.getCropJson());
        assertThat(first).containsEntry("aspect", "3:4").containsKey("selectionFrame");
        assertThat(CatalogImagePipelineService.cardImage(front)).containsEntry("mode", "SEMANTIC_CROP")
                .containsEntry("url", front.getImageUrl()).containsEntry("aspect", "3:4");
        assertThat(front.getStoredUrl()).isEqualTo("https://storage.example/old.jpg");
        String sha = front.getSourceSha256();
        web.put(front.getImageUrl(), CatalogPhotos.jpeg(CatalogPhotos.tee(180, 200, 1.0)));
        service.verifySelection(admin, product.getId());
        assertThat(front.getSourceSha256()).isNotEqualTo(sha);
        assertThat(stored).isEmpty();
    }

    @Test
    void selecaoSemFotoOuDownloadNaoConfirmaEnquadramento() {
        assertThatThrownBy(() -> service.verifySelection(admin, product.getId())).isInstanceOf(ApiException.class);
        CatalogImage image = image("https://img.brand.com/missing.jpg", CatalogImageType.FRONT, null);
        assertThatThrownBy(() -> service.verifySelection(admin, product.getId())).isInstanceOf(ApiException.class);
        assertThat(image.getCropJson()).isNull();
        assertThat(image.isCanonical()).isFalse();
    }

    @Test
    void selecaoRecuperaFotoCanonicaIndisponivelComOutraDoMesmoProduto() {
        CatalogImage broken = image("https://img.brand.com/dead.jpg", CatalogImageType.FRONT, null);
        broken.setCanonical(true);
        CatalogImage alternative = image("https://img.brand.com/alternate.jpg", CatalogImageType.PACKSHOT,
                CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0)));
        service.verifySelection(admin, product.getId());
        assertThat(broken.getCropJson()).isNull();
        assertThat(broken.isCanonical()).isFalse();
        assertThat(alternative.isCanonical()).isTrue();
        assertThat(Json.map(alternative.getCropJson())).containsEntry("ruleCompliant", true);
        assertThat(CatalogImagePipelineService.cardImage(alternative)).containsEntry("url", alternative.getImageUrl());
        assertThat(stored).isEmpty();
    }

    @Test
    void selecaoIgnoraBytesInvalidosEAlternativaRecusada() {
        CatalogImage unreadable = image("https://img.brand.com/bad.jpg", CatalogImageType.FRONT, new byte[]{1, 2, 3});
        unreadable.setCanonical(true);
        CatalogImage rejected = image("https://img.brand.com/rejected.jpg", CatalogImageType.FRONT,
                CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0)));
        rejected.setReviewStatus("REJECTED");
        CatalogImage valid = image("https://img.brand.com/valid.jpg", CatalogImageType.FRONT,
                CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0)));
        service.verifySelection(admin, product.getId());
        assertThat(valid.isCanonical()).isTrue();
        assertThat(rejected.getCropJson()).isNull();
        assertThat(unreadable.getCropJson()).isNull();
    }

    @Test
    void selecaoDeCalcadoUsaRegraDoProdutoSemExigirQuadroSoDeTecido() {
        product.setCategory("shoes_piece");
        product.setSubcategory("casual_sneakers");
        CatalogImage shoe = image("https://img.brand.com/sneakers.jpg", CatalogImageType.PACKSHOT,
                CatalogPhotos.jpeg(CatalogPhotos.sneakers()));
        service.verifySelection(admin, product.getId());
        Map<String, Object> crop = Json.map(shoe.getCropJson());
        assertThat(crop).containsEntry("ruleCompliant", true);
        assertThat(((Map<?, ?>) crop.get("selectionFrame")).get("version")).isEqualTo(ProductRuleFrame.VERSION);
        assertThat(shoe.isCanonical()).isTrue();
    }

    @Test
    void nivelAGravaSoMetadadosEEscolheACanonica() {
        CatalogImage front = image("https://img.brand.com/front.jpg", CatalogImageType.FRONT, CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0)));
        service.tick();
        assertThat(front.getProcessingStatus()).isEqualTo("APPROVED");
        assertThat(front.getPipelineVersion()).isEqualTo(CatalogImagePipeline.VERSION);
        assertThat(front.isCanonical()).isTrue();
        assertThat(front.getViewRole()).isEqualTo("CANONICAL");
        assertThat(front.getStoredUrl()).as("nada copiado sem permissão (RN47.03)").isNull();
        assertThat(front.getUsageStatus()).isEqualTo(CatalogImageUsage.REFERENCE_ONLY);
        assertThat(stored).isEmpty();
        assertThat(Json.map(front.getCropJson())).containsKeys("crop", "focus", "background");
        Map<String, Object> card = CatalogImagePipelineService.cardImage(front);
        assertThat(card).containsEntry("mode", "SEMANTIC_CROP").containsEntry("url", front.getImageUrl()).containsKey("crop");
    }

    @Test
    void acervoCrescenteProcessaSomenteFotosNovas() {
        CatalogImage existing = image("https://img.brand.com/first.jpg", CatalogImageType.FRONT,
                CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0)));
        service.tick();
        Instant processed = existing.getProcessedAt();
        int attempts = existing.getAttempts();
        // A foto antiga não pode voltar a ser baixada nem ter metadados alterados.
        web.clear();
        CatalogImage added = image("https://img.brand.com/new.jpg", CatalogImageType.FRONT,
                CatalogPhotos.jpeg(CatalogPhotos.tee(220, 220, 1.0)));
        service.tick();
        assertThat(added.getProcessingStatus()).isEqualTo("APPROVED");
        assertThat(existing.getProcessingStatus()).isEqualTo("APPROVED");
        assertThat(existing.getAttempts()).isEqualTo(attempts);
        assertThat(existing.getProcessedAt()).isEqualTo(processed);
        service.tick();
        assertThat(added.getAttempts()).isEqualTo(1);
    }

    @Test
    void provenienciaNaoAutorizaHostTerceiroOuUserinfo() {
        CatalogSource source = new CatalogSource();
        source.setDomain("www.brand.com.");
        source.setAllowsImagePersistence(true);
        sources.add(source);
        CatalogImage img = new CatalogImage();
        img.setSourceDomain("brand.com");
        for (String url : List.of("https://evil.com?x=.brand.com", "https://evil.com#x=.brand.com",
                "https://brand.com@evil.com", "https://user@img.brand.com", "http://brand.com", "https://brand.com:444")) {
            img.setImageUrl(url);
            assertThat(service.allowsPersistence(product, img)).as(url).isFalse();
        }
        img.setImageUrl("https://IMG.BRAND.COM.:443?x=1");
        assertThat(service.allowsPersistence(product, img)).isTrue();
    }

    @Test
    void fontesComPermissaoGanhamMasterNoStorage() {
        CatalogSource s = new CatalogSource();
        s.setDomain("brand.com");
        s.setAllowsImagePersistence(true);
        sources.add(s);
        CatalogImage front = image("https://img.brand.com/front.jpg", CatalogImageType.FRONT, CatalogPhotos.jpeg(br.com.fashionai.application.imaging.ImageOps.scale(CatalogPhotos.tee(200, 200, 1.0), 2000, 2000)));
        service.tick();
        assertThat(front.getUsageStatus()).isEqualTo(CatalogImageUsage.PERSISTED);
        assertThat(front.getStoredUrl()).endsWith("master.png");
        assertThat(stored.keySet()).anyMatch(k -> k.endsWith("card.jpg")).anyMatch(k -> k.endsWith("thumb.jpg"))
                .anyMatch(k -> k.endsWith("white.jpg")).anyMatch(k -> k.endsWith("neutral.jpg"));
        assertThat(CatalogImagePipelineService.cardImage(front)).containsEntry("mode", "PROCESSED").containsEntry("aspect", "3:4").containsEntry("sourceUrl", front.getImageUrl());
        assertThat(CatalogImagePipelineService.cardImage(front).get("url").toString()).endsWith("fabric.jpg");
    }

    @Test
    void downloadQueFalhaViraFailedSemDerrubarOLote() {
        CatalogImage broken = image("https://img.brand.com/404.jpg", CatalogImageType.FRONT, null);
        CatalogImage ok = image("https://img.brand.com/ok.jpg", CatalogImageType.FRONT, CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0)));
        service.tick();
        assertThat(broken.getProcessingStatus()).isEqualTo("FAILED");
        assertThat(broken.getGateReasons()).isEqualTo("FETCH_FAILED");
        assertThat(ok.getProcessingStatus()).isEqualTo("APPROVED");
    }

    @Test
    void mesmaFotoEmOutraUrlReaproveitaAAnaliseEFicaDuplicada() {
        byte[] body = CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0));
        CatalogImage a = image("https://img.brand.com/a.jpg", CatalogImageType.FRONT, body);
        service.process(a.getId());
        CatalogImage b = image("https://img.brand.com/b.jpg?w=2000", CatalogImageType.FRONT, body);
        service.process(b.getId());
        assertThat(b.getMetricsJson()).isEqualTo(a.getMetricsJson());
        assertThat(List.of(a.getViewRole(), b.getViewRole())).containsExactlyInAnyOrder("CANONICAL", "DUPLICATE");
    }

    @Test
    void mesmosBytesEmOutroContextoRodamOPipelineDeNovo() {
        byte[] body = CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0));
        CatalogImage a = image("https://img.brand.com/a.jpg", CatalogImageType.FRONT, body);
        service.process(a.getId());
        // outro tipo de vista no mesmo produto: detailView/recorte dependem dele
        CatalogImage detail = image("https://img.brand.com/d.jpg", CatalogImageType.DETAIL, body);
        service.process(detail.getId());
        assertThat(Json.map(detail.getMetricsJson())).containsEntry("detailView", true);
        assertThat(Json.map(a.getMetricsJson())).containsEntry("detailView", false);
        // outro produto, de outra categoria: tipo de peça e foco vêm dela
        CatalogProduct shoe = new CatalogProduct();
        shoe.assignId(UUID.randomUUID());
        shoe.setBrandId(product.getBrandId());
        shoe.setCategory("shoes_piece");
        shoe.setSubcategory("sneaker");
        when(products.findById(shoe.getId())).thenReturn(Optional.of(shoe));
        CatalogImage other = image("https://img.brand.com/s.jpg", CatalogImageType.FRONT, body);
        other.setProductId(shoe.getId());
        assertThat(service.sameContext(a, other, shoe)).isFalse();
        CatalogImage sibling = image("https://img.brand.com/s2.jpg", CatalogImageType.FRONT, body);
        assertThat(service.sameContext(a, sibling, product)).isTrue();
        service.process(other.getId());
        assertThat(Json.map(other.getMetricsJson())).containsEntry("pieceType", PieceType.SHOES_PIECE.name());
    }

    @Test
    void fotoComPessoaVaiParaAFilaEOAdminEscolheOutraFotoOficial() {
        CatalogImage model = image("https://img.brand.com/model.jpg", CatalogImageType.FRONT, CatalogPhotos.jpeg(CatalogPhotos.teeOnPerson()));
        CatalogImage back = image("https://img.brand.com/back.jpg", CatalogImageType.BACK, null);
        back.setProcessingStatus("NEEDS_REPROCESSING");
        service.process(model.getId());
        assertThat(model.getProcessingStatus()).isEqualTo("NEEDS_REPROCESSING");
        assertThat(model.getReviewStatus()).isEqualTo("PENDING");
        assertThat(model.isCanonical()).isFalse();
        assertThat((List<?>) service.reviewQueue(admin, 10).get("items")).hasSize(1);

        service.decide(admin, model.getId(), new CatalogImagePipelineService.ReviewCommand("SELECT_ALTERNATE_IMAGE", back.getId(), null));
        assertThat(back.isCanonical()).isTrue();
        assertThat(back.getReviewStatus()).isEqualTo("APPROVED");
        assertThat(model.isCanonical()).isFalse();
        assertThat(model.getReviewStatus()).isEqualTo("REJECTED");
    }

    @Test
    void aprovarReprocessarERejeitarPelaFila() {
        CatalogImage model = image("https://img.brand.com/model.jpg", CatalogImageType.FRONT, CatalogPhotos.jpeg(CatalogPhotos.teeOnPerson()));
        service.process(model.getId());
        service.decide(admin, model.getId(), new CatalogImagePipelineService.ReviewCommand("approve", null, null));
        assertThat(model.isCanonical()).isTrue();
        service.decide(admin, model.getId(), new CatalogImagePipelineService.ReviewCommand("REPROCESS", null, null));
        assertThat(model.getProcessingStatus()).isEqualTo("PENDING");
        assertThat(model.getAttempts()).isZero();
        service.decide(admin, model.getId(), new CatalogImagePipelineService.ReviewCommand("REJECT", null, null));
        assertThat(model.getProcessingStatus()).isEqualTo("REJECTED");
        assertThat(model.isCanonical()).isFalse();
        assertThatThrownBy(() -> service.decide(admin, model.getId(), new CatalogImagePipelineService.ReviewCommand("DELETE", null, null)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void filaEDepuracaoSaoSoDoAdmin() {
        CurrentUser user = new CurrentUser(UUID.randomUUID(), "u", "USER", null, true, null, null, null);
        assertThatThrownBy(() -> service.reviewQueue(user, 10)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.metrics(user)).isInstanceOf(ApiException.class);
    }

    @Test
    void workerDesligadoNaoFazNada() {
        CatalogImage front = image("https://img.brand.com/front.jpg", CatalogImageType.FRONT, CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0)));
        CatalogImagePipelineService off = new CatalogImagePipelineService(mock(CatalogImageRepository.class), mock(CatalogProductRepository.class),
                mock(CatalogSourceRepository.class), (u, m, a) -> Optional.empty(), mock(MediaStoragePort.class), mock(Guard.class),
                mock(TransactionTemplate.class), mock(ObjectProvider.class), false, 8, 3);
        off.tick();
        assertThat(front.getProcessingStatus()).isEqualTo("PENDING");
    }

    /** Enquadramento por categoria gravado pelo lote (CATALOG_FRAME_*) é decisão final: a fila do worker não o refaz. */
    @Test
    void filaDoWorkerNaoRefazFotosEnquadradasPeloLote() throws Exception {
        java.lang.reflect.Method queue = CatalogImageRepository.class.getMethod("pipelineQueue", String.class, int.class,
                Instant.class, org.springframework.data.domain.Pageable.class);
        String jpql = queue.getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        assertThat(jpql).contains("i.pipelineVersion <> :version");
        assertThat(jpql).contains("i.pipelineVersion not like 'CATALOG_FRAME_%'");
    }
    @Test
    void sanitizedPhotoSetIsReusedAndStaleCategoryNeverServesThePreviousGarment() {
        CatalogImage i=image("https://brand.com/photo.png",CatalogImageType.FRONT,CatalogPhotos.png(CatalogPhotos.tee(200,200,1)));
        i.setSourceSha256("a".repeat(64));i.setCanonical(true);
        Map<String,Object> cleaned=photoEvidence(i,"READY");i.setAssetsJson(Json.write(Map.of("photoSet",cleaned)));
        assertThat(CatalogImagePipelineService.cardImage(i,product)).containsEntry("url",cleaned.get("fabricUrl")).containsEntry("mode","PROCESSED");
        i.setReviewStatus("REJECTED");assertThat(CatalogImagePipelineService.photoSet(i,product)).isEmpty();
        i.setReviewStatus("APPROVED");
        CatalogSource source = new CatalogSource(); source.setDomain("brand.com"); source.setAllowsImagePersistence(true); sources.add(source);
        i.setProcessingStatus("APPROVED");
        byte[] whole=CatalogPhotos.png(CatalogPhotos.tee(200,200,1));stored.put("whole.png",whole);
        assertThat(service.texturePhoto(admin,product.getId(),true).bytes()).isEqualTo(whole);
        product.setSubcategory("coat");assertThat(CatalogImagePipelineService.photoSet(i,product)).isEmpty();
        assertThatThrownBy(() -> service.texturePhoto(admin,product.getId(),true)).isInstanceOf(ApiException.class);
    }
    @Test
    void defaultOnlyPhotoSetDoesNotExposeARejectedSourceAsAnApprovedFrame() {
        CatalogImage i=image("https://brand.com/photo.png",CatalogImageType.FRONT,CatalogPhotos.png(CatalogPhotos.tee(200,200,1)));i.setSourceSha256("a".repeat(64));
        Map<String,Object> cleaned=photoEvidence(i,"DEFAULT");i.setAssetsJson(Json.write(Map.of("photoSet",cleaned)));
        assertThat(CatalogImagePipelineService.cardImage(i,product)).containsEntry("mode","DEFAULT").containsEntry("url",cleaned.get("defaultAssetUrl")).doesNotContainKey("whole");
    }

    @Test
    void packshotDoProcessedImageUrlEhOTotalFrameDoCard() {
        CatalogImage i = image("https://brand.com/packshot.png", CatalogImageType.FRONT, null);
        i.setSourceSha256("a".repeat(64));
        // sem enquadramento aprovado: nada no card (nunca a foto crua)
        assertThat(CatalogImagePipelineService.cardImage(i, product)).isNull();

        i.setProcessedImageUrl("https://cdn.fashn.ai/abc/output_0.png");
        Map<String, Object> card = CatalogImagePipelineService.cardImage(i, product);
        assertThat(card).containsEntry("url", "https://cdn.fashn.ai/abc/output_0.png").containsEntry("mode", "PROCESSED")
                .containsEntry("sourceUrl", "https://brand.com/packshot.png");
        @SuppressWarnings("unchecked") Map<String, Object> whole = (Map<String, Object>) card.get("whole");
        assertThat(whole).containsEntry("url", "https://cdn.fashn.ai/abc/output_0.png").containsEntry("rendered", true)
                .containsEntry("version", CatalogImagePipelineService.PACKSHOT_VERSION);

        // o packshot vence a Peça inteira do photoSet e aparece também no card de ilustração padrão
        i.setAssetsJson(Json.write(Map.of("photoSet", photoEvidence(i, "READY"))));
        card = CatalogImagePipelineService.cardImage(i, product);
        assertThat(card).containsEntry("url", "https://media.fashion-ai.app/fabric.png");
        assertThat(((Map<?, ?>) card.get("whole")).get("url")).isEqualTo("https://cdn.fashn.ai/abc/output_0.png");
        i.setAssetsJson(Json.write(Map.of("photoSet", photoEvidence(i, "DEFAULT"))));
        assertThat(((Map<?, ?>) CatalogImagePipelineService.cardImage(i, product).get("whole")).get("url")).isEqualTo("https://cdn.fashn.ai/abc/output_0.png");

        // foto recusada pela revisão não mostra packshot
        i.setAssetsJson(null); i.setReviewStatus("REJECTED");
        assertThat(CatalogImagePipelineService.cardImage(i, product)).isNull();
        i.setReviewStatus("NONE");
    }

    @Test
    void packshotSoComEnderecoHttpsOuDoNossoMedia() {
        CatalogImage i = new CatalogImage();
        for (String bad : List.of("http://cdn.fashn.ai/a.png", "javascript:alert(1)", "data:image/png;base64,AAAA", "//cdn.fashn.ai/a.png",
                "/media/../etc/passwd", "https://user@cdn.fashn.ai/a.png", "https://cdn.fashn.ai/a b.png", "  ", "relative/a.png")) {
            i.setProcessedImageUrl(bad);
            assertThat(CatalogImagePipelineService.packshotWhole(i)).as(bad).isNull();
        }
        i.setProcessedImageUrl(" /media/catalog/packshot/a.jpg ");
        assertThat(CatalogImagePipelineService.packshotWhole(i)).containsEntry("url", "/media/catalog/packshot/a.jpg");
        i.setProcessedImageUrl("https://media.fashion-ai.app/catalog/packshot/a.jpg");
        assertThat(CatalogImagePipelineService.packshotWhole(i)).containsEntry("box", Map.of("x", 0, "y", 0, "w", 1, "h", 1));
        i.setUsageStatus(br.com.fashionai.domain.model.enums.CatalogImageUsage.REJECTED);
        assertThat(CatalogImagePipelineService.packshotWhole(i)).isNull();
    }

    @Test
    void readyRequiresMeasuredCompleteIsolationAtOrAboveExactly25Percent() {
        assertThat(CatalogImagePipelineService.validPreflight(sourcePreflight())).isTrue();
        for (Map.Entry<String,Object> invalid : Map.<String,Object>of("sourceGarmentHeightFraction", .249,
                "measurementReliable", false, "isolationVerified", false, "humanAssessmentComplete", false,
                "complete", false, "occluded", true, "status", "REVIEW").entrySet()) {
            Map<String,Object> evidence=sourcePreflight(); evidence.put(invalid.getKey(),invalid.getValue());
            assertThat(CatalogImagePipelineService.validPreflight(evidence)).as(invalid.getKey()).isFalse();
        }
        CatalogImage i=image("https://brand.com/proof.png",CatalogImageType.FRONT,null);
        i.setSourceSha256("a".repeat(64));
        Map<String,Object> state=photoEvidence(i,"READY");state.remove("metrics");
        i.setAssetsJson(Json.write(Map.of("photoSet",state)));
        assertThat(CatalogImagePipelineService.photoSet(i,product)).isEmpty();
        state.put("version","CATALOG_PHOTO_SET_V1");state.put("metrics",Map.of("preflight",sourcePreflight()));
        i.setAssetsJson(Json.write(Map.of("photoSet",state)));
        assertThat(CatalogImagePipelineService.photoSet(i,product)).isEmpty();
    }

    @Test
    void preflightReviewNeverReachesLegacyRendererUploadOrOriginalTexture() {
        for (String status : List.of("REVIEW","INELIGIBLE","RETRY")) {
            CatalogImage i=image("https://brand.com/"+status+".png",CatalogImageType.FRONT,null);
            i.setSourceSha256("a".repeat(64)); i.setCanonical(true); i.setProcessingStatus("APPROVED");
            i.setAssetsJson(Json.write(Map.of("photoSet",photoEvidence(i,status))));
            assertThatThrownBy(() -> service.texturePhoto(admin,product.getId())).isInstanceOf(ApiException.class);
            service.process(i.getId());
            assertThat(i.getProcessingStatus()).isEqualTo("NEEDS_REPROCESSING");
            assertThat(i.getReviewStatus()).isEqualTo("PENDING"); assertThat(i.getCropJson()).isNull();
            assertThat(CatalogImagePipelineService.cardImage(i,product)).containsEntry("mode","DEFAULT").doesNotContainKey("whole");
        }
        assertThat(stored).isEmpty();
    }
}
