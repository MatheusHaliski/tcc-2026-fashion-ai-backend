package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogSource;
import br.com.fashionai.domain.model.enums.CatalogImageType;
import br.com.fashionai.domain.model.CatalogVariant;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Card, Peça inteira (whole), photo set e preflight: o que pode ser exibido e com qual prova. */
class CatalogImagePipelineServiceCardTest extends CatalogImagePipelineServiceFixture {
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
        assertThat(CatalogPhotoEvidence.wholeFrame(packshot)).isNull();

        // foto com modelo, com pele de pessoa ou sem fundo de estúdio: o card continua no recorte de sempre
        packshot.setMetricsJson(Json.write(Map.of("debug", Map.of("productFrame", Map.of("model", true)))));
        assertThat(CatalogPhotoEvidence.wholeFrame(packshot)).isNull();
        packshot.setMetricsJson(Json.write(Map.of("debug", Map.of("sourceHumanEvidence", 0.02))));
        assertThat(CatalogPhotoEvidence.wholeFrame(packshot)).isNull();
        packshot.setMetricsJson(null);
        packshot.setCropJson(Json.write(Map.of("product", Map.of("x", 0.12, "y", 0.19, "w", 0.75, "h", 0.6))));
        assertThat(CatalogPhotoEvidence.wholeFrame(packshot)).isNull();
        packshot.setCropJson(Json.write(Map.of("product", Map.of("x", 0.5, "y", 0.5, "w", 0.9, "h", 0.9), "background", "#ffffff")));
        assertThat(CatalogPhotoEvidence.wholeFrame(packshot)).isNull();
    }

    @Test
    void pecaInteiraProcessadaValeAteParaFotoComModeloENuncaUsaAFotoOriginal() {
        CatalogImage jeans = new CatalogImage();
        jeans.setImageUrl("https://img.brand.com/jeans-modelo.jpg");
        jeans.setMetricsJson(Json.write(Map.of("debug", Map.of("productFrame", Map.of("model", true), "sourceHumanEvidence", 0.04))));
        assertThat(CatalogPhotoEvidence.wholeFrame(jeans)).isNull();

        jeans.setWholeUrl("https://media.fashion-ai.app/catalog/whole/a/b.jpg");
        jeans.setWholeStatus("DONE");
        jeans.setSourceSha256("a".repeat(64));
        jeans.setWholePipelineVersion(CatalogImagePipelineService.WHOLE_PROCESSED_VERSION);
        Map<String,Object> info = new LinkedHashMap<>(Map.of("box", Map.of("x", 0.375, "y", 0.25, "w", 0.25, "h", 0.5),
                "background", "#F4F5F7", "width", 900, "height", 1200, "truncated", List.of(),
                "version", CatalogImagePipelineService.WHOLE_PROCESSED_VERSION, "sourceUrl", jeans.getImageUrl(),
                "sourceSha256", jeans.getSourceSha256(), "preflight", sourcePreflight()));
        jeans.setWholeJson(Json.write(info));
        Map<String, Object> whole = CatalogPhotoEvidence.wholeFrame(jeans);
        assertThat(whole).containsEntry("url", "https://media.fashion-ai.app/catalog/whole/a/b.jpg").containsEntry("processed", true)
                .containsEntry("version", CatalogImagePipelineService.WHOLE_PROCESSED_VERSION).containsEntry("width", 900).containsEntry("height", 1200);
        assertThat(whole.get("truncated")).isEqualTo(List.of());

        jeans.setWholeUrl(jeans.getImageUrl());
        assertThat(CatalogPhotoEvidence.wholeFrame(jeans)).isNull();
        jeans.setWholeUrl("data:image/png;base64,aGVsbG8=");
        assertThat(CatalogPhotoEvidence.wholeFrame(jeans)).isNull();
        jeans.setWholeUrl("https://media.fashion-ai.app/catalog/whole/a/b.jpg");
        jeans.setSourceSha256("invalid");info.put("sourceSha256","invalid");jeans.setWholeJson(Json.write(info));
        assertThat(CatalogPhotoEvidence.wholeFrame(jeans)).isNull();
        jeans.setSourceSha256("a".repeat(64));info.put("sourceSha256",jeans.getSourceSha256());jeans.setWholeJson(Json.write(info));

        info.put("truncated", List.of("bottom")); jeans.setWholeJson(Json.write(info));
        assertThat(CatalogPhotoEvidence.wholeFrame(jeans)).isNull();
        info.put("truncated", List.of()); jeans.setWholeJson(Json.write(info));
        jeans.setSourceSha256("b".repeat(64));
        assertThat(CatalogPhotoEvidence.wholeFrame(jeans)).isNull();
        jeans.setSourceSha256("a".repeat(64));

        // processamento com falha ou caixa inválida: sem Peça inteira (a interface mostra o enquadramento de tecido)
        jeans.setWholeStatus("FAILED");
        assertThat(CatalogPhotoEvidence.wholeFrame(jeans)).isNull();
        jeans.setWholeStatus("DONE");
        jeans.setWholeJson(Json.write(Map.of("box", Map.of("x", 0.6, "y", 0.1, "w", 0.6, "h", 0.5))));
        assertThat(CatalogPhotoEvidence.wholeFrame(jeans)).isNull();
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
    void readyRequiresMeasuredCompleteIsolationAtOrAboveExactly25Percent() {
        assertThat(CatalogPhotoEvidence.validPreflight(sourcePreflight())).isTrue();
        for (Map.Entry<String,Object> invalid : Map.<String,Object>of("sourceGarmentHeightFraction", .249,
                "measurementReliable", false, "isolationVerified", false, "humanAssessmentComplete", false,
                "complete", false, "occluded", true, "status", "REVIEW").entrySet()) {
            Map<String,Object> evidence=sourcePreflight(); evidence.put(invalid.getKey(),invalid.getValue());
            assertThat(CatalogPhotoEvidence.validPreflight(evidence)).as(invalid.getKey()).isFalse();
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

    @Test
    void sanitizedDerivativesRequireARealDigestAndTheExactOwningProduct() {
        CatalogImage image=image("https://brand.com/identity.png",CatalogImageType.FRONT,null);
        image.setSourceSha256("a".repeat(64));
        Map<String,Object> ready=photoEvidence(image,"READY");
        image.setAssetsJson(Json.write(Map.of("photoSet",ready)));
        assertThat(CatalogImagePipelineService.cardImage(image,product)).containsEntry("url",ready.get("fabricUrl"));
        CatalogProduct stranger=new CatalogProduct();stranger.assignId(UUID.randomUUID());
        stranger.setCategory(product.getCategory());stranger.setSubcategory(product.getSubcategory());stranger.setColor(product.getColor());
        assertThat(CatalogImagePipelineService.photoSet(image,stranger)).isEmpty();
        assertThat(CatalogImagePipelineService.cardImage(image,stranger)).isNull();
        image.setSourceSha256(null);ready.put("sourceSha256",null);image.setAssetsJson(Json.write(Map.of("photoSet",ready)));
        assertThat(CatalogImagePipelineService.photoSet(image,product)).isEmpty();
        image.setSourceSha256("a".repeat(64));ready.put("sourceSha256",image.getSourceSha256());
        ready.put("wholeUrl",image.getImageUrl());image.setAssetsJson(Json.write(Map.of("photoSet",ready)));
        assertThat(CatalogImagePipelineService.photoSet(image,product)).isEmpty();
        ready.put("wholeUrl",ready.get("fabricUrl"));image.setAssetsJson(Json.write(Map.of("photoSet",ready)));
        assertThat(CatalogImagePipelineService.photoSet(image,product)).isEmpty();
    }

    @Test
    void wholeBatchDerivativeCannotSurviveAChangeOfGarmentCategory() {
        CatalogImage image=image("https://img.brand.com/whole-context.png",CatalogImageType.FRONT,
                CatalogPhotos.png(CatalogPhotos.tee(200,200,1)));
        service.process(image.getId());
        image.setAssetsJson(null);image.setCanonical(true);
        image.setWholeUrl("https://media.fashion-ai.app/isolated.png");image.setWholeStatus("DONE");
        image.setWholePipelineVersion(CatalogImagePipelineService.WHOLE_PROCESSED_VERSION);
        Map<String,Object> whole=new LinkedHashMap<>();
        whole.put("version",CatalogImagePipelineService.WHOLE_PROCESSED_VERSION);whole.put("sourceUrl",image.getImageUrl());
        whole.put("sourceSha256",image.getSourceSha256());whole.put("category",product.getCategory());whole.put("subcategory",product.getSubcategory());
        whole.put("box",Map.of("x",.375,"y",.25,"w",.25,"h",.5));whole.put("truncated",List.of());whole.put("preflight",sourcePreflight());
        image.setWholeJson(Json.write(whole));
        assertThat(CatalogImagePipelineService.cardImage(image,product)).containsKey("whole");
        CatalogSource source=new CatalogSource();source.setDomain("brand.com");source.setAllowsImagePersistence(true);sources.add(source);
        byte[] isolatedPixels=CatalogPhotos.png(CatalogPhotos.tee(180,240,1));stored.put("isolated.png",isolatedPixels);
        assertThat(service.texturePhoto(admin,product.getId(),true,null,image.getId()).bytes()).isEqualTo(isolatedPixels);
        product.setSubcategory("coat");
        assertThat(CatalogImagePipelineService.cardImage(image,product)).doesNotContainKey("whole");
        assertThatThrownBy(()->service.texturePhoto(admin,product.getId(),true,null,image.getId())).isInstanceOf(ApiException.class);
    }

    @Test
    void explicitVariantPhotoProofUsesItsOwnColorAndInvalidatesEditedBindings() {
        product.setColor("blue");CatalogVariant red=variant("red"),otherRed=variant("red");
        byte[] pixels=CatalogPhotos.png(CatalogPhotos.tee(200,200,1));
        CatalogImage selected=isolated(red,"red-proof",pixels);
        Map<String,Object> proof=photoEvidence(selected,"READY");
        selected.setAssetsJson(Json.write(Map.of("photoSet",proof)));
        assertThat(CatalogImagePipelineService.photoSet(selected,product,productVariants)).containsEntry("color","red");
        assertThat(CatalogImagePipelineService.photoSet(selected,product)).isEmpty();
        proof.put("color","blue");selected.setAssetsJson(Json.write(Map.of("photoSet",proof)));
        assertThat(CatalogImagePipelineService.photoSet(selected,product,productVariants)).isEmpty();
        proof.put("color","red");selected.setAssetsJson(Json.write(Map.of("photoSet",proof)));
        selected.setVariantId(otherRed.getId());
        assertThat(CatalogImagePipelineService.photoSet(selected,product,productVariants)).isEmpty();
        selected.setVariantId(red.getId());red.setColor("green");
        assertThat(CatalogImagePipelineService.photoSet(selected,product,productVariants)).isEmpty();
        assertThat(CatalogImagePipelineService.cardImage(selected,product,productVariants)).isNull();
        red.setColor("");proof.put("color","");selected.setAssetsJson(Json.write(Map.of("photoSet",proof)));
        assertThat(CatalogImagePipelineService.photoSet(selected,product,productVariants)).containsEntry("color","");
        red.setColor(null);proof.put("color","blue");selected.setAssetsJson(Json.write(Map.of("photoSet",proof)));
        assertThat(CatalogImagePipelineService.photoSet(selected,product,productVariants)).containsEntry("color","blue");
    }
}
