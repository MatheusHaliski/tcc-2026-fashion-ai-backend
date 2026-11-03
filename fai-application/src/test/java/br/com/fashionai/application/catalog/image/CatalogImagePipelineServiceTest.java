package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.ports.MediaStoragePort;
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
import br.com.fashionai.domain.repository.CatalogVariantRepository;
import br.com.fashionai.domain.model.CatalogVariant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/** Worker (tick/process), cache por hash, nível B, proveniência e fila de revisão do admin. */
class CatalogImagePipelineServiceTest extends CatalogImagePipelineServiceFixture {
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
    void cachedSiblingAnalysisMustMatchTheCategoryAtAnalysisTime() {
        byte[] body=CatalogPhotos.png(CatalogPhotos.tee(200,200,1));
        CatalogImage first=image("https://img.brand.com/cache-first.png",CatalogImageType.FRONT,body);
        service.process(first.getId());
        CatalogImage sibling=image("https://img.brand.com/cache-second.png",CatalogImageType.FRONT,body);
        assertThat(service.sameContext(first,sibling,product)).isTrue();
        product.setSubcategory("coat");
        assertThat(service.sameContext(first,sibling,product)).isFalse();
        product.setSubcategory("t_shirt");
        first.setImageUrl("https://img.brand.com/changed-source.png");
        assertThat(service.sameContext(first,sibling,product)).isFalse();
    }

    @Test
    void orphanImageVariantNeverProcessesOrServesItsSource() {
        CatalogVariant foreign=variant("red");foreign.setProductId(UUID.randomUUID());
        CatalogImage orphan=image("https://img.brand.com/orphan.png",CatalogImageType.FRONT,
                CatalogPhotos.png(CatalogPhotos.tee(200,200,1)));
        orphan.setVariantId(foreign.getId());orphan.setCanonical(true);
        service.process(orphan.getId());
        assertThat(orphan.getProcessingStatus()).isEqualTo("NEEDS_REPROCESSING");
        assertThat(orphan.getGateReasons()).isEqualTo("CATALOG_IMAGE_VARIANT_MISMATCH");
        assertThat(orphan.getCropJson()).isNull();assertThat(stored).isEmpty();
        assertThatThrownBy(()->service.texturePhoto(admin,product.getId(),true,null,orphan.getId())).isInstanceOf(ApiException.class);
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
                mock(CatalogSourceRepository.class), mock(CatalogVariantRepository.class), (u, m, a) -> Optional.empty(), mock(MediaStoragePort.class), mock(Guard.class),
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
}
