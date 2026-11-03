package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogSource;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.enums.CatalogImageType;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;

import static br.com.fashionai.application.catalog.image.CatalogPhotos.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Caracterização do {@link CatalogImagePipelineService} (lote R93): com ids fixos, o mesmo cenário passa por worker,
 * cache por hash, nível B (storage), fila do admin, enquadramento sob demanda, textura do provador e leitura de card,
 * e o retrato — linhas de catalog_images, chaves e SHA-256 dos bytes gravados, respostas e erros — tem de continuar
 * idêntico ao gravado no código original em {@code catalog/image/service-retrato.txt}.
 */
class CatalogImagePipelineServiceRetratoTest extends CatalogImagePipelineServiceFixture {
    private long ids;
    private final CatalogImageRetrato r = CatalogImageRetrato.start();

    @Override
    UUID newId() {
        return new UUID(0x9300L, ++ids);
    }

    private void rows(String label) {
        for (CatalogImage i : db.values()) {
            r.line(label + " row " + i.getImageUrl(), CatalogImageRetrato.row(i));
        }
        Map<String, String> files = new TreeMap<>();
        stored.forEach((k, v) -> files.put(k, CatalogImageRetrato.sha(v)));
        r.line(label + " stored", files);
    }

    private void reads(String label, CatalogImage i) {
        r.call(label + " cardImage(1)", () -> CatalogImagePipelineService.cardImage(i));
        r.call(label + " cardImage(2)", () -> CatalogImagePipelineService.cardImage(i, product));
        r.call(label + " cardImage(3)", () -> CatalogImagePipelineService.cardImage(i, product, productVariants));
        r.call(label + " photoSet(2)", () -> CatalogImagePipelineService.photoSet(i, product));
        r.call(label + " photoSet(3)", () -> CatalogImagePipelineService.photoSet(i, product, productVariants));
        r.call(label + " wholeFrame", () -> CatalogImagePipelineService.wholeFrame(i));
        r.call(label + " vtonGarment", () -> CatalogImagePipelineService.vtonGarment(i));
        r.call(label + " viewRank", () -> CatalogImagePipelineService.viewRank(i));
        r.call(label + " view", () -> service.view(i));
    }

    private void texture(String label, boolean isolated, UUID variantId, UUID imageId,
                         CatalogImagePipelineService.TextureView view) {
        r.call(label, () -> {
            var photo = service.texturePhoto(admin, product.getId(), isolated, variantId, imageId, view);
            return Map.of("sha", CatalogImageRetrato.sha(photo.bytes()), "mime", photo.mime());
        });
    }

    private CatalogSource allowBrand() {
        CatalogSource source = new CatalogSource();
        source.setDomain("brand.com");
        source.setAllowsImagePersistence(true);
        sources.add(source);
        return source;
    }

    private void workerAndQueue() {
        byte[] body = jpeg(tee(200, 200, 1.0));
        CatalogImage front = image("https://img.brand.com/front.jpg", CatalogImageType.FRONT, body);
        image("https://img.brand.com/front-copy.jpg?w=2000", CatalogImageType.FRONT, body);
        image("https://img.brand.com/detail.jpg", CatalogImageType.DETAIL, body);
        CatalogImage model = image("https://img.brand.com/model.jpg", CatalogImageType.FRONT, jpeg(teeOnPerson()));
        image("https://img.brand.com/404.jpg", CatalogImageType.FRONT, null);
        CatalogImage back = image("https://img.brand.com/back.jpg", CatalogImageType.BACK, null);
        back.setProcessingStatus("NEEDS_REPROCESSING");
        r.line("claim", service.claim(2).size());
        rows("claim");
        db.values().forEach(i -> {
            if ("DOWNLOADING".equals(i.getProcessingStatus())) {
                i.setProcessingStatus("PENDING");
            }
        });
        service.tick();
        rows("tick");
        reads("front", front);
        reads("model", model);
        CurrentUser user = new CurrentUser(UUID.randomUUID(), "u", "USER", null, true, null, null, null);
        r.call("reviewQueue user", () -> service.reviewQueue(user, 10));
        r.call("reviewQueue", () -> service.reviewQueue(admin, 0));
        r.call("metrics", () -> service.metrics(admin));
        r.call("debug", () -> service.debug(admin, model.getId()));
        r.call("decide null", () -> service.decide(admin, model.getId(), null));
        r.call("decide sem alternativa", () -> service.decide(admin, model.getId(),
                new CatalogImagePipelineService.ReviewCommand("select_alternate_image", null, null)));
        r.call("decide approve", () -> service.decide(admin, model.getId(), new CatalogImagePipelineService.ReviewCommand("approve", null, null)));
        r.call("decide alternativa", () -> service.decide(admin, model.getId(),
                new CatalogImagePipelineService.ReviewCommand("SELECT_ALTERNATE_IMAGE", back.getId(), "frente com pessoa")));
        r.call("decide reprocess", () -> service.decide(admin, front.getId(), new CatalogImagePipelineService.ReviewCommand("REPROCESS", null, null)));
        r.call("decide reject", () -> service.decide(admin, model.getId(), new CatalogImagePipelineService.ReviewCommand("REJECT", null, null)));
        rows("decide");
        r.call("enqueueProduct", () -> service.enqueueProduct(admin, product.getId()));
        service.tick();
        rows("retick");
    }

    private void tierBAndPreview() {
        allowBrand();
        CatalogImage big = image("https://img.brand.com/big.jpg", CatalogImageType.PACKSHOT,
                jpeg(br.com.fashionai.application.imaging.ImageOps.scale(tee(200, 200, 1.0), 2000, 2000)));
        service.process(big.getId());
        rows("tierB");
        reads("big", big);
        r.call("ensurePreview", () -> {
            service.ensurePreview(admin, product.getId());
            return "ok";
        });
        r.call("ensurePreview force", () -> {
            service.ensurePreview(admin, product.getId(), true);
            return "ok";
        });
        rows("preview");
        r.call("verifySelection", () -> {
            service.verifySelection(admin, product.getId());
            return "ok";
        });
        rows("verify");
        reads("big-verified", big);
        texture("texture default", false, null, null, null);
        texture("texture isolated", true, null, null, null);
        texture("texture back", true, null, null, CatalogImagePipelineService.TextureView.BACK);
        r.line("TextureView.of", List.of(CatalogImagePipelineService.TextureView.of(null), CatalogImagePipelineService.TextureView.of(" back "),
                CatalogImagePipelineService.TextureView.of("side")));
    }

    private void photoSetsAndVariants() {
        CatalogVariant red = variant("red");
        CatalogVariant blue = variant("blue");
        byte[] redPixels = png(tee(200, 200, 1));
        CatalogImage redFront = isolated(red, "red-front", redPixels);
        redFront.setProcessingStatus("APPROVED");
        CatalogImage redBack = isolated(red, "red-back", png(tee(120, 160, 1)));
        redBack.setImageType(CatalogImageType.BACK);
        redBack.setProcessingStatus("APPROVED");
        Map<String, Object> backProof = photoEvidence(redBack, "READY");
        backProof.put("wholeUrl", "https://media.fashion-ai.app/red-back-whole.png");
        backProof.put("fabricUrl", "https://media.fashion-ai.app/red-back-fabric.png");
        redBack.setAssetsJson(Json.write(Map.of("photoSet", backProof)));
        CatalogImage blueDefault = image("https://img.brand.com/blue-default.png", CatalogImageType.FRONT, png(tee(180, 240, 1)));
        blueDefault.setVariantId(blue.getId());
        blueDefault.setSourceSha256("b".repeat(64));
        blueDefault.setAssetsJson(Json.write(Map.of("photoSet", photoEvidence(blueDefault, "DEFAULT"))));
        CatalogImage review = image("https://img.brand.com/review.png", CatalogImageType.FRONT, null);
        review.setSourceSha256("c".repeat(64));
        review.setAssetsJson(Json.write(Map.of("photoSet", photoEvidence(review, "REVIEW"))));
        reads("redFront", redFront);
        reads("redBack", redBack);
        reads("blueDefault", blueDefault);
        reads("review", review);
        texture("texture red", true, red.getId(), null, null);
        texture("texture red chosen", true, red.getId(), redFront.getId(), null);
        texture("texture red back", true, red.getId(), redFront.getId(), CatalogImagePipelineService.TextureView.BACK);
        texture("texture blue", true, blue.getId(), null, null);
        texture("texture blue non-isolated", false, blue.getId(), null, null);
        texture("texture mismatch", true, blue.getId(), redFront.getId(), null);
        texture("texture unknown variant", true, UUID.randomUUID(), null, null);
        texture("texture unknown image", true, null, UUID.randomUUID(), null);
        r.call("process review", () -> {
            service.process(review.getId());
            return CatalogImageRetrato.row(review);
        });
        r.call("process ready", () -> {
            service.process(redFront.getId());
            return CatalogImageRetrato.row(redFront);
        });
        r.call("ensurePreview red", () -> {
            service.ensurePreview(admin, product.getId(), false, red.getId(), null);
            return "ok";
        });
        r.call("ensurePreview blue", () -> {
            service.ensurePreview(admin, product.getId(), true, blue.getId(), blueDefault.getId());
            return "ok";
        });
        r.call("verifySelection blue", () -> {
            service.verifySelection(admin, product.getId(), blue.getId(), null);
            return "ok";
        });
        rows("variants");
    }

    private void wholeAndHelpers() {
        CatalogImage jeans = image("https://img.brand.com/whole.png", CatalogImageType.FRONT, png(tee(200, 200, 1)));
        service.process(jeans.getId());
        jeans.setCanonical(true);
        jeans.setUsageStatus(CatalogImageUsage.PERSISTED);
        jeans.setStoredUrl("https://media.fashion-ai.app/master.png");
        jeans.setWholeUrl("https://media.fashion-ai.app/isolated.png");
        jeans.setWholeStatus("DONE");
        jeans.setWholePipelineVersion(CatalogImagePipelineService.WHOLE_PROCESSED_VERSION);
        Map<String, Object> whole = new LinkedHashMap<>();
        whole.put("version", CatalogImagePipelineService.WHOLE_PROCESSED_VERSION);
        whole.put("sourceUrl", jeans.getImageUrl());
        whole.put("sourceSha256", jeans.getSourceSha256());
        whole.put("category", product.getCategory());
        whole.put("subcategory", product.getSubcategory());
        whole.put("box", Map.of("x", .375, "y", .25, "w", .25, "h", .5));
        whole.put("truncated", List.of());
        whole.put("preflight", sourcePreflight());
        jeans.setWholeJson(Json.write(whole));
        stored.put("isolated.png", png(tee(180, 240, 1)));
        reads("whole", jeans);
        texture("texture whole", true, null, jeans.getId(), null);
        jeans.setAssetsJson(Json.write(Map.of("persistenceDecision", Map.of("mode", "FORCED_CATEGORY_FRAME"))));
        r.call("vton forced", () -> CatalogImagePipelineService.vtonGarment(jeans));
        jeans.setMetricsJson(Json.write(Map.of("debug", Map.of("sourceHumanEvidence", 0.0, "productFrame", Map.of("model", false)))));
        jeans.setAssetsJson(null);
        jeans.setProcessingStatus("APPROVED");
        r.call("vton clean", () -> CatalogImagePipelineService.vtonGarment(jeans));
        for (String url : List.of("https://IMG.BRAND.COM.:443/x", "http://brand.com", "https://u@brand.com", "https://brand.com:444",
                "nota url", "https://evil.com?x=.brand.com")) {
            CatalogImage probe = new CatalogImage();
            probe.setImageUrl(url);
            r.line("host " + url, String.valueOf(CatalogImagePipelineService.host(url)));
            r.line("allowsPersistence " + url, service.allowsPersistence(product, probe));
        }
        r.line("validPreflight", List.of(CatalogImagePipelineService.validPreflight(sourcePreflight()),
                CatalogImagePipelineService.validPreflight(Map.of()), CatalogImagePipelineService.validPreflight(null)));
        r.line("gateReasons", List.of(String.valueOf(CatalogImagePipelineService.gateReasons(List.of())),
                CatalogImagePipelineService.gateReasons(List.of("A".repeat(300), "B".repeat(300))).length()));
        r.line("qualityScore", String.valueOf(CatalogImagePipelineService.qualityScore(0.123456)));
        r.line("dimension", String.valueOf(CatalogImagePipelineService.dimension(0)));
        CatalogImage copy = new CatalogImage();
        CatalogImagePipelineService.copyAnalysis(jeans, copy);
        r.line("copyAnalysis", CatalogImageRetrato.row(copy));
        CatalogProduct shoe = new CatalogProduct();
        shoe.assignId(newId());
        shoe.setBrandId(product.getBrandId());
        shoe.setCategory("shoes_piece");
        shoe.setSubcategory("sneaker");
        when(products.findById(shoe.getId())).thenReturn(Optional.of(shoe));
        CatalogImage sneaker = image("https://img.brand.com/sneaker.jpg", CatalogImageType.FRONT, jpeg(sneakers()));
        sneaker.setProductId(shoe.getId());
        r.line("sameContext", List.of(service.sameContext(jeans, sneaker, shoe), service.sameContext(jeans, sneaker, product)));
        service.process(sneaker.getId());
        r.line("sneaker", CatalogImageRetrato.row(sneaker));
        CatalogVariant foreign = variant("white");
        foreign.setProductId(UUID.randomUUID());
        CatalogImage orphan = image("https://img.brand.com/orphan.png", CatalogImageType.FRONT, png(tee(200, 200, 1)));
        orphan.setVariantId(foreign.getId());
        service.process(orphan.getId());
        r.line("orphan", CatalogImageRetrato.row(orphan));
        r.line("constantes", List.of(CatalogImagePipelineService.ACTIONS.stream().sorted().toList(),
                CatalogImagePipelineService.DONE.stream().sorted().toList(), CatalogImagePipelineService.PREVIEW_CACHE_VERSION,
                CatalogImagePipelineService.WHOLE_FRAME_VERSION, CatalogImagePipelineService.WHOLE_PROCESSED_VERSION));
    }

    @Test
    void retratoDoServicoComIdsFixos() throws Exception {
        workerAndQueue();
        tierBAndPreview();
        photoSetsAndVariants();
        wholeAndHelpers();
        rows("final");
        assertThat(r.text()).isEqualTo(CatalogImageRetrato.golden(r.text(), "service-retrato.txt"));
    }
}
