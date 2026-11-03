package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogSource;
import br.com.fashionai.domain.model.enums.CatalogImageType;
import br.com.fashionai.domain.model.CatalogVariant;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Transporte da textura do provador: frente/costas, foto isolada e identidade de variante/foto. */
class CatalogImagePipelineServiceTextureTest extends CatalogImagePipelineServiceFixture {
    @Test
    void fotoDeFrenteVemAntesDaDeCostasNaTexturaIsolada() {
        CatalogSource source = new CatalogSource(); source.setDomain("brand.com"); source.setAllowsImagePersistence(true); sources.add(source);
        CatalogImage back = image("https://brand.com/back.png", CatalogImageType.BACK, null);
        CatalogImage front = image("https://brand.com/front.png", CatalogImageType.FRONT, null);
        byte[] backWhole = CatalogPhotos.png(CatalogPhotos.tee(120, 160, 1.0)), frontWhole = CatalogPhotos.png(CatalogPhotos.tee(200, 200, 1.0));
        for (var pair : List.of(Map.entry(back, "whole-back.png"), Map.entry(front, "whole-front.png"))) {
            CatalogImage i = pair.getKey(); i.setSourceSha256("a".repeat(64)); i.setCanonical(i == back); i.setProcessingStatus("APPROVED");
            Map<String, Object> state = photoEvidence(i, "READY"); state.put("wholeUrl", "https://media.fashion-ai.app/" + pair.getValue());
            i.setAssetsJson(Json.write(Map.of("photoSet", state)));
        }
        stored.put("whole-back.png", backWhole); stored.put("whole-front.png", frontWhole);
        assertThat(service.texturePhoto(admin, product.getId(), true).bytes()).isEqualTo(frontWhole);
        assertThat(CatalogImagePipelineService.viewRank(front)).isLessThan(CatalogImagePipelineService.viewRank(back));
        assertThat(CatalogImagePipelineService.viewRank(image("https://brand.com/x.png", null, null))).isZero();
        // costas: a foto marcada BACK, mesmo sem ser a canônica e com a frente escolhida explicitamente
        var BACK = CatalogImagePipelineService.TextureView.BACK;
        assertThat(service.texturePhoto(admin, product.getId(), true, null, null, BACK).bytes()).isEqualTo(backWhole);
        assertThat(service.texturePhoto(admin, product.getId(), true, null, front.getId(), BACK).bytes()).isEqualTo(backWhole);
    }

    @Test
    void semFotoDeCostasAsCostasNaoRecebemAFrenteEAFrenteNaoRecebeAsCostas() {
        CatalogSource source = new CatalogSource(); source.setDomain("brand.com"); source.setAllowsImagePersistence(true); sources.add(source);
        CatalogImage back = image("https://brand.com/only-back.png", CatalogImageType.BACK, null);
        back.setSourceSha256("a".repeat(64)); back.setCanonical(true); back.setProcessingStatus("APPROVED");
        Map<String, Object> state = photoEvidence(back, "READY"); state.put("wholeUrl", "https://media.fashion-ai.app/whole-only-back.png");
        back.setAssetsJson(Json.write(Map.of("photoSet", state)));
        stored.put("whole-only-back.png", CatalogPhotos.png(CatalogPhotos.tee(120, 160, 1.0)));
        assertThatThrownBy(() -> service.texturePhoto(admin, product.getId(), true)).isInstanceOf(ApiException.class);

        CatalogImage front = image("https://brand.com/only-front.png", CatalogImageType.FRONT, null);
        db.remove(back.getId());
        front.setSourceSha256("a".repeat(64)); front.setCanonical(true); front.setProcessingStatus("APPROVED");
        Map<String, Object> frontState = photoEvidence(front, "READY"); frontState.put("wholeUrl", "https://media.fashion-ai.app/whole-only-front.png");
        front.setAssetsJson(Json.write(Map.of("photoSet", frontState)));
        stored.put("whole-only-front.png", CatalogPhotos.png(CatalogPhotos.tee(200, 200, 1.0)));
        assertThatThrownBy(() -> service.texturePhoto(admin, product.getId(), true, null, null, CatalogImagePipelineService.TextureView.BACK))
                .isInstanceOf(ApiException.class).hasFieldOrPropertyWithValue("status", 404);
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
    void textureSelectionKeepsVariantAndImageIdentityAcrossStorageAndFallback() {
        CatalogSource source=new CatalogSource();source.setDomain("brand.com");source.setAllowsImagePersistence(true);sources.add(source);
        CatalogVariant red=variant("red"),blue=variant("blue");
        byte[] redPixels=CatalogPhotos.png(CatalogPhotos.tee(200,200,1));
        byte[] bluePixels=CatalogPhotos.png(CatalogPhotos.tee(180,240,1));
        CatalogImage canonical=isolated(blue,"canonical-blue",bluePixels);canonical.setCanonical(true);
        CatalogImage chosen=isolated(red,"chosen-red",redPixels);
        assertThat(service.texturePhoto(admin,product.getId(),true,red.getId(),chosen.getId()).bytes()).isEqualTo(redPixels);
        assertThat(service.texturePhoto(admin,product.getId(),true,blue.getId(),canonical.getId()).bytes()).isEqualTo(bluePixels);
        assertThatThrownBy(()->service.texturePhoto(admin,product.getId(),true,blue.getId(),chosen.getId()))
                .isInstanceOfSatisfying(ApiException.class,e->assertThat(e.code()).isEqualTo("CATALOG_IMAGE_VARIANT_MISMATCH"));
        CatalogVariant foreign=variant("white");foreign.setProductId(UUID.randomUUID());
        assertThatThrownBy(()->service.texturePhoto(admin,product.getId(),true,foreign.getId(),null)).isInstanceOf(ApiException.class);
        chosen.setCanonical(true);stored.remove("chosen-red-whole.png");
        assertThatThrownBy(()->service.texturePhoto(admin,product.getId(),true,red.getId(),null))
                .isInstanceOfSatisfying(ApiException.class,e->assertThat(e.code()).isEqualTo("CATALOG_ISOLATED_PHOTO_UNAVAILABLE"));
        // The valid global canonical is blue and must never replace missing red pixels.
        assertThat(stored).containsKey("canonical-blue-whole.png");
        CatalogImage alternate=isolated(red,"alternate-red",redPixels);
        assertThat(service.texturePhoto(admin,product.getId(),true,red.getId(),null).bytes()).isEqualTo(redPixels);
        CatalogImage otherProduct=isolated(red,"other-product",bluePixels);otherProduct.setProductId(UUID.randomUUID());
        assertThatThrownBy(()->service.texturePhoto(admin,product.getId(),true,null,otherProduct.getId())).isInstanceOf(ApiException.class);
        assertThat(alternate.getAssetsJson()).contains("alternate-red-whole.png");
    }
}
