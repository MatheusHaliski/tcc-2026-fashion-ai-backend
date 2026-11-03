package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogSource;
import br.com.fashionai.domain.model.enums.CatalogImageType;
import br.com.fashionai.domain.model.CatalogVariant;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Enquadramento sob demanda: ensurePreview (cache e retry) e verifySelection (regra do produto). */
class CatalogImagePipelineServicePreviewTest extends CatalogImagePipelineServiceFixture {
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
    void variantPreviewAndVerificationNeverReuseOrChangeAnotherColorsCanonical() {
        product.setColor("blue");CatalogVariant blue=variant("blue"),red=variant("red");
        byte[] pixels=CatalogPhotos.png(CatalogPhotos.tee(200,200,1));
        CatalogImage base=image("https://img.brand.com/base-blue.png",CatalogImageType.FRONT,pixels);
        base.setPrimary(true);base.setCanonical(true);
        service.ensurePreview(admin,product.getId(),false,blue.getId(),base.getId());
        String baseCrop=base.getCropJson();
        CatalogImage alternative=image("https://img.brand.com/red.png",CatalogImageType.FRONT,pixels);alternative.setVariantId(red.getId());
        service.ensurePreview(admin,product.getId(),false,red.getId(),alternative.getId());
        assertThat(base.isCanonical()).isTrue();assertThat(base.getCropJson()).isEqualTo(baseCrop);
        assertThat(alternative.isCanonical()).isFalse();assertThat(alternative.getCropJson()).isNotBlank();
        assertThat(CatalogImagePipelineService.cardImage(alternative,product,productVariants)).containsEntry("sourceUrl",alternative.getImageUrl());
        assertThatThrownBy(()->service.verifySelection(admin,product.getId(),red.getId(),base.getId()))
                .isInstanceOfSatisfying(ApiException.class,e->assertThat(e.code()).isEqualTo("CATALOG_IMAGE_VARIANT_MISMATCH"));
        assertThat(base.getCropJson()).isEqualTo(baseCrop);
        // A READY source-bound photo set survives origin outage and does not need a second crop/download.
        CatalogImage ready=isolated(red,"already-isolated",pixels);ready.setCanonical(false);
        service.verifySelection(admin,product.getId(),red.getId(),ready.getId());
        assertThat(ready.getCropJson()).isNull();assertThat(ready.isCanonical()).isFalse();
    }
}
