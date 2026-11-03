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
import br.com.fashionai.domain.repository.CatalogVariantRepository;
import br.com.fashionai.domain.model.CatalogVariant;
import org.junit.jupiter.api.BeforeEach;
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

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Estado em memória compartilhado pelos testes do {@link CatalogImagePipelineService}: repositórios, download,
 * storage, transação e guarda falsos, mais os construtores de fotos, provas de photo set e variantes.
 */
abstract class CatalogImagePipelineServiceFixture {
    final Map<UUID, CatalogImage> db = new LinkedHashMap<>();
    final Map<String, byte[]> web = new HashMap<>();
    final Map<String, byte[]> stored = new HashMap<>();
    final List<CatalogSource> sources = new ArrayList<>();
    final List<CatalogVariant> productVariants = new ArrayList<>();
    CatalogImagePipelineService service;
    CatalogProduct product;
    CatalogProductRepository products;
    CatalogVariantRepository variants;
    final CurrentUser admin = new CurrentUser(UUID.randomUUID(), "admin", "ADMIN", null, true, null, null, null);

    /** Id do produto, das fotos e das variantes criadas pela fixture; o retrato troca por ids fixos. */
    UUID newId() {
        return UUID.randomUUID();
    }

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
        variants = mock(CatalogVariantRepository.class);
        when(variants.findByProductIdOrderByVariantKey(any())).thenAnswer(inv->productVariants.stream().filter(v->v.getProductId().equals(inv.getArgument(0))).toList());
        product = new CatalogProduct();
        product.assignId(newId());
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
        service = new CatalogImagePipelineService(images, products, sourceRepo, variants, fetch, storage, guard, tx, none, true, 8, 3);
    }

    CatalogImage image(String url, CatalogImageType type, byte[] body) {
        CatalogImage i = new CatalogImage();
        i.assignId(newId());
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

    static Map<String, Object> sourcePreflight() {
        return new LinkedHashMap<>(Map.of("version", "CATALOG_SOURCE_PREFLIGHT_V1", "status", "PASS",
                "measurementReliable", true, "sourceGarmentHeightFraction", .25, "complete", true,
                "occluded", false, "isolationVerified", true, "humanAssessmentComplete", true));
    }

    Map<String, Object> photoEvidence(CatalogImage image, String status) {
        Map<String,Object> state = new LinkedHashMap<>();
        state.put("version", "CATALOG_PHOTO_SET_V2"); state.put("sourceUrl", image.getImageUrl());
        state.put("variantId",image.getVariantId());state.put("imageId",image.getId());
        state.put("sourceSha256", image.getSourceSha256()); state.put("category", product.getCategory());
        String color=productVariants.stream().filter(v->v.getId().equals(image.getVariantId())).map(CatalogVariant::getColor)
                .filter(java.util.Objects::nonNull).findFirst().orElse(product.getColor());
        state.put("subcategory", product.getSubcategory()); state.put("color", color); state.put("status", status);
        state.put("wholeUrl", "https://media.fashion-ai.app/whole.png"); state.put("fabricUrl", "https://media.fashion-ai.app/fabric.png");
        state.put("defaultAssetUrl", "/api/catalog/default-asset?category=upper_piece");
        state.put("metrics", Map.of("preflight", sourcePreflight()));
        return state;
    }

    CatalogVariant variant(String color) {
        CatalogVariant variant=new CatalogVariant();variant.assignId(newId());variant.setProductId(product.getId());variant.setColor(color);
        when(variants.findById(variant.getId())).thenReturn(Optional.of(variant));productVariants.add(variant);return variant;
    }

    CatalogImage isolated(CatalogVariant variant,String name,byte[] pixels) {
        CatalogImage image=image("https://img.brand.com/"+name+".png",CatalogImageType.FRONT,null);
        image.setVariantId(variant.getId());image.setSourceSha256(CatalogImagePipeline.sha256(pixels));
        Map<String,Object> ready=photoEvidence(image,"READY");
        ready.put("wholeUrl","https://media.fashion-ai.app/"+name+"-whole.png");
        ready.put("fabricUrl","https://media.fashion-ai.app/"+name+"-fabric.png");
        image.setAssetsJson(Json.write(Map.of("photoSet",ready)));stored.put(name+"-whole.png",pixels);return image;
    }
}
