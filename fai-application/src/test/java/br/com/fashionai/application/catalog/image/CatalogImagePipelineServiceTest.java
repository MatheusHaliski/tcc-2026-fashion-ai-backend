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
    void fontesComPermissaoGanhamMasterNoStorage() {
        CatalogSource s = new CatalogSource();
        s.setDomain("brand.com");
        s.setAllowsImagePersistence(true);
        sources.add(s);
        CatalogImage front = image("https://img.brand.com/front.jpg", CatalogImageType.FRONT, CatalogPhotos.jpeg(CatalogPhotos.tee(200, 200, 1.0)));
        service.tick();
        assertThat(front.getUsageStatus()).isEqualTo(CatalogImageUsage.PERSISTED);
        assertThat(front.getStoredUrl()).endsWith("master.png");
        assertThat(stored.keySet()).anyMatch(k -> k.endsWith("card.jpg")).anyMatch(k -> k.endsWith("thumb.jpg"))
                .anyMatch(k -> k.endsWith("white.jpg")).anyMatch(k -> k.endsWith("neutral.jpg"));
        assertThat(CatalogImagePipelineService.cardImage(front)).containsEntry("mode", "PROCESSED");
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
}
