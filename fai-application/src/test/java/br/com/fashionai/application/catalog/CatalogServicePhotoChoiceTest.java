package br.com.fashionai.application.catalog;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.enums.BrandSource;
import br.com.fashionai.domain.model.enums.CatalogImageType;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceType;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogVariantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Caracterização da escolha da foto do card/ficha (lote 05): camadas principal › canônica › mais antiga, recusa de
 * foto REJECTED/sem URL, identidade de variante (SKU e cor da mesma {@link CatalogVariant}) e a ordem de preferência
 * READY › canônica › principal › id. Escrita e aprovada no código original, antes da extração de {@code CatalogPhotoChoice}.
 */
class CatalogServicePhotoChoiceTest {
    private Kit kit;
    private CatalogService catalog;
    private CatalogImageRepository images;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        CatalogIngestService ingest = kit.real(CatalogIngestService.class);
        kit.dep(BrandRepository.class).save(new Brand("Nike", CatalogNormalizer.get().brandSlug("Nike"), BrandSource.SEEDED));
        CatalogProductRepository products = kit.dep(CatalogProductRepository.class);
        lenient().when(products.candidates(any(), any(), any(), any())).thenAnswer(i -> MemoryRepository.rows(products));
        lenient().when(products.candidatesWithColor(any(), any(), any(), any(), any())).thenAnswer(i -> MemoryRepository.rows(products));
        ingest.upsert(new CatalogIngestService.ProductInput("Nike", null, "casual_sneakers", "Nike Air Force 1", "Air Force 1", "AF1-W", "AF1-W",
                null, null, null, "white", "white", "cotton", null, "unissex", "https://nike.com.br/p/AF1-W", null,
                List.of(new CatalogIngestService.ImageInput("https://nike.com.br/img/AF1-W.jpg", "packshot")), List.of("air force 1"),
                List.of(new CatalogIngestService.VariantInput("white", "white", "AF1-W-V", null, null))), CatalogIngestionStatus.VALIDATED, false);
        catalog = kit.build(CatalogService.class);
        images = kit.dep(CatalogImageRepository.class);
    }

    private CatalogProduct product() {
        return MemoryRepository.<CatalogProduct>rows(kit.dep(CatalogProductRepository.class)).getFirst();
    }

    private static CatalogImage image(UUID productId, String id, String url) {
        CatalogImage i = new CatalogImage();
        if (id != null) i.assignId(UUID.fromString(id));
        i.setProductId(productId);
        i.setImageUrl(url);
        i.setImageType(CatalogImageType.PACKSHOT);
        i.setSourceType(CatalogSourceType.OFFICIAL_BRAND);
        i.setUsageStatus(CatalogImageUsage.PERSISTED);
        return i;
    }

    /** Prova CATALOG_PHOTO_SET_V2 com o status pedido (READY exige derivados e preflight válidos). */
    private static void photoSet(CatalogImage image, CatalogProduct p, String status, String sha) {
        image.setSourceSha256(sha);
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("version", "CATALOG_PHOTO_SET_V2"); state.put("status", status);
        state.put("sourceUrl", image.getImageUrl()); state.put("sourceSha256", sha);
        state.put("category", p.getCategory()); state.put("subcategory", p.getSubcategory()); state.put("color", p.getColor());
        state.put("defaultAssetUrl", "/api/catalog/default-asset?category=" + p.getCategory());
        state.put("wholeUrl", "https://media.example/" + sha.charAt(0) + "-whole.png");
        state.put("fabricUrl", "https://media.example/" + sha.charAt(0) + "-fabric.png");
        state.put("metrics", Map.of("preflight", Map.of("version", "CATALOG_SOURCE_PREFLIGHT_V1", "status", "PASS",
                "sourceGarmentHeightFraction", .5, "measurementReliable", true, "complete", true, "occluded", false,
                "isolationVerified", true, "humanAssessmentComplete", true)));
        image.setAssetsJson(Json.write(Map.of("photoSet", state)));
    }

    @Test
    void mainImagesLayersPrimaryCanonicalAndOldestUsableOnlyForMissingProducts() {
        UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID();
        CatalogImage aPrimary = image(a, null, "https://x/a-primary.jpg");
        CatalogImage aCanonical = image(a, null, "https://x/a-canonical.jpg");
        CatalogImage bRejectedPrimary = image(b, null, "https://x/b-rejected.jpg");
        bRejectedPrimary.setUsageStatus(CatalogImageUsage.REJECTED);
        CatalogImage bNewer = image(b, null, "https://x/b-newer.jpg");
        bNewer.markCreatedAt(Instant.parse("2026-01-02T00:00:00Z"));
        CatalogImage bOlder = image(b, null, "https://x/b-older.jpg");
        bOlder.markCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        CatalogImage cBlank = image(c, null, " ");
        cBlank.markCreatedAt(Instant.parse("2020-01-01T00:00:00Z"));
        CatalogImage cZ = image(c, null, "https://x/c-z.jpg");
        CatalogImage cA = image(c, null, "https://x/c-a.jpg");
        when(images.findByProductIdInAndPrimaryTrue(anyList())).thenReturn(List.of(aPrimary, bRejectedPrimary));
        when(images.findByProductIdInAndCanonicalTrue(anyList())).thenReturn(List.of(aCanonical));
        List<Object> asked = new java.util.ArrayList<>();
        when(images.findByProductIdIn(anyList())).thenAnswer(i -> {
            asked.add(i.getArgument(0));
            return List.of(bNewer, cBlank, cZ, bOlder, cA);
        });

        Map<UUID, CatalogImage> main = catalog.mainImages(List.of(a, b, c));

        assertThat(main).containsEntry(a, aCanonical).containsEntry(b, bOlder).containsEntry(c, cA).hasSize(3);
        assertThat(asked).containsExactly(List.of(b, c));
    }

    @Test
    void mainImagesSkipsTheThirdQueryWhenEveryProductHasAPhoto() {
        UUID a = UUID.randomUUID();
        CatalogImage aPrimary = image(a, null, "https://x/a-primary.jpg");
        CatalogImage reviewRejectedCanonical = image(a, null, "https://x/a-review.jpg");
        reviewRejectedCanonical.setReviewStatus("REJECTED");
        when(images.findByProductIdInAndPrimaryTrue(anyList())).thenReturn(List.of(aPrimary));
        when(images.findByProductIdInAndCanonicalTrue(anyList())).thenReturn(List.of(reviewRejectedCanonical));
        List<Object> asked = new java.util.ArrayList<>();
        when(images.findByProductIdIn(anyList())).thenAnswer(i -> {
            asked.add(i.getArgument(0));
            return List.of();
        });
        assertThat(catalog.mainImages(List.of(a))).containsExactly(Map.entry(a, aPrimary));
        assertThat(asked).isEmpty();
    }

    @Test
    void foreignVariantMainIsDroppedAndFallbackPrefersCanonicalThenPrimaryThenId() {
        CatalogProduct p = product();
        CatalogImage orphan = image(p.getId(), "00000000-0000-0000-0000-000000000009", "https://x/orphan.jpg");
        orphan.setVariantId(UUID.randomUUID());
        orphan.setPrimary(true);
        CatalogImage plain2 = image(p.getId(), "00000000-0000-0000-0000-000000000002", "https://x/plain2.jpg");
        CatalogImage plain1 = image(p.getId(), "00000000-0000-0000-0000-000000000001", "https://x/plain1.jpg");
        CatalogImage primary = image(p.getId(), "00000000-0000-0000-0000-000000000003", "https://x/primary.jpg");
        primary.setPrimary(true);
        CatalogImage canonical = image(p.getId(), "00000000-0000-0000-0000-000000000004", "https://x/canonical.jpg");
        canonical.setCanonical(true);
        when(images.findByProductIdInAndPrimaryTrue(anyList())).thenReturn(List.of(orphan));

        when(images.findByProductIdIn(anyList())).thenReturn(List.of(orphan, plain2, primary, canonical, plain1));
        assertThat(catalog.mainImagesFor(List.of(p))).containsExactly(Map.entry(p.getId(), canonical));
        when(images.findByProductIdIn(anyList())).thenReturn(List.of(orphan, plain2, primary, plain1));
        assertThat(catalog.mainImagesFor(List.of(p))).containsExactly(Map.entry(p.getId(), primary));
        when(images.findByProductIdIn(anyList())).thenReturn(List.of(orphan, plain2, plain1));
        assertThat(catalog.mainImagesFor(List.of(p))).containsExactly(Map.entry(p.getId(), plain1));
        when(images.findByProductIdIn(anyList())).thenReturn(List.of(orphan));
        assertThat(catalog.mainImagesFor(List.of(p))).isEmpty();
    }

    @Test
    void readyAlternativeBeatsCanonicalButNeverReplacesAReadyMain() {
        CatalogProduct p = product();
        CatalogImage canonical = image(p.getId(), "00000000-0000-0000-0000-000000000001", "https://x/canonical.jpg");
        canonical.setCanonical(true);
        photoSet(canonical, p, "REVIEW", "a".repeat(64));
        CatalogImage ready = image(p.getId(), "00000000-0000-0000-0000-000000000002", "https://x/ready.jpg");
        photoSet(ready, p, "READY", "b".repeat(64));
        CatalogImage ready2 = image(p.getId(), "00000000-0000-0000-0000-000000000003", "https://x/ready2.jpg");
        photoSet(ready2, p, "READY", "c".repeat(64));
        when(images.findByProductIdInAndCanonicalTrue(anyList())).thenReturn(List.of(canonical));
        when(images.findByProductIdIn(anyList())).thenReturn(List.of(canonical, ready2, ready));
        assertThat(catalog.mainImagesFor(List.of(p))).containsExactly(Map.entry(p.getId(), ready));

        when(images.findByProductIdInAndCanonicalTrue(anyList())).thenReturn(List.of(ready2));
        assertThat(catalog.mainImagesFor(List.of(p))).containsExactly(Map.entry(p.getId(), ready2));
    }

    @Test
    void requestedVariantKeepsSkuAndColorTogetherAndPicksItsOwnPhotoByPreference() {
        CatalogProduct p = product();
        CatalogVariantRepository variants = kit.dep(CatalogVariantRepository.class);
        CatalogVariant red = new CatalogVariant();
        red.setProductId(p.getId()); red.setVariantKey("red"); red.setColor("red"); red.setColorName("Vermelho");
        red.setSku("AF1-R-42"); red.setVariantCode("AF1-R");
        red = variants.save(red);
        CatalogImage redPrimary = image(p.getId(), null, "https://nike.com.br/red-primary.jpg");
        redPrimary.setVariantId(red.getId()); redPrimary.setPrimary(true);
        CatalogImage redCanonical = image(p.getId(), null, "https://nike.com.br/red-canonical.jpg");
        redCanonical.setVariantId(red.getId()); redCanonical.setCanonical(true);
        CatalogImage redRejected = image(p.getId(), null, "https://nike.com.br/red-rejected.jpg");
        redRejected.setVariantId(red.getId()); redRejected.setCanonical(true); redRejected.setReviewStatus("REJECTED");
        images.save(redPrimary); images.save(redRejected); images.save(redCanonical);

        Map<String, Object> response = catalog.product(p.getId(), red.getId(), null);

        assertThat(response).containsEntry("color", "red").containsEntry("colorName", "Vermelho");
        assertThat(map(response.get("selectedVariant"))).containsEntry("id", red.getId()).containsEntry("color", "red")
                .containsEntry("sku", "AF1-R-42").containsEntry("code", "AF1-R");
        assertThat(map(response.get("imageSource"))).containsEntry("imageUrl", "https://nike.com.br/red-canonical.jpg");
        // a busca com a cor pedida pré-seleciona a mesma variante (cor e SKU juntos) e a foto dela
        Map<String, Object> found = ((List<?>) catalog.search(new CatalogService.SearchRequest(p.getCategory(), p.getSubcategory(), "Nike",
                p.getModelName(), "red", 24)).get("results")).stream().map(br.com.fashionai.application.testkit.World::map)
                .filter(m -> p.getId().equals(m.get("id"))).findFirst().orElseThrow();
        assertThat(map(found.get("selectedVariant"))).containsEntry("id", red.getId()).containsEntry("sku", "AF1-R-42");
        assertThat(map(found.get("imageSource"))).containsEntry("imageUrl", "https://nike.com.br/red-canonical.jpg");
    }
}
