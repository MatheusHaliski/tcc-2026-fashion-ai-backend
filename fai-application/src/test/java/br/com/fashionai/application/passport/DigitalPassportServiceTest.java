package br.com.fashionai.application.passport;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.fit.SizeOptionsService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.model.fit.ProductSizeChart;
import br.com.fashionai.domain.model.passport.GarmentPassport;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.domain.repository.fit.ProductSizeChartRepository;
import br.com.fashionai.domain.repository.passport.GarmentPassportRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** RF — passaporte digital da peça e opções de tamanho com procedência explícita. */
@SuppressWarnings("unchecked")
class DigitalPassportServiceTest {
    WardrobeItemRepository pieces = MemoryRepository.of(WardrobeItemRepository.class);
    CatalogProductRepository products = MemoryRepository.of(CatalogProductRepository.class);
    BrandRepository brands = MemoryRepository.of(BrandRepository.class);
    GarmentPassportRepository passports = MemoryRepository.of(GarmentPassportRepository.class);
    ProductSizeChartRepository charts = MemoryRepository.of(ProductSizeChartRepository.class);
    PhysicalStoreListingRepository listings = MemoryRepository.of(PhysicalStoreListingRepository.class);
    PhysicalStoreVariantRepository variants = MemoryRepository.of(PhysicalStoreVariantRepository.class);
    GarmentAsset3dRepository assets = MemoryRepository.of(GarmentAsset3dRepository.class);
    Guard guard = mock(Guard.class);
    DigitalPassportService service;
    SizeOptionsService sizes;
    User ana, bia;
    WardrobeItem piece;
    CatalogProduct product;
    CurrentUser actor(User u) { return CurrentUser.of(u, "127.0.0.1", "test"); }
    Map<String, Object> f(Map<String, Object> sheet, String section, String key) { return (Map<String, Object>) ((Map<String, Object>) sheet.get(section)).get(key); }

    @BeforeEach void setUp() {
        sizes = new SizeOptionsService(pieces, products, charts, listings, variants, assets);
        service = new DigitalPassportService(pieces, products, brands, passports, sizes, guard);
        ana = new User("ana", "Ana", "a@x.invalid", "h1", "p", ProfileType.PESSOAL); ana.assignId(UUID.randomUUID()); ana.setStatus(AccountStatus.ACTIVE);
        bia = new User("bia", "Bia", "b@x.invalid", "h2", "p", ProfileType.PESSOAL); bia.assignId(UUID.randomUUID()); bia.setStatus(AccountStatus.ACTIVE);
        Brand brand = new Brand(); brand.setName("Marca X"); brand.setSlug("marca-x"); brands.save(brand);
        product = new CatalogProduct(); product.setProductName("Camisa"); product.setCategory("upper_piece"); product.setBrandId(brand.getId()); product.setOfficialProductUrl("https://marca.example/camisa"); product.setMaterial("Algodão"); product.setLastVerifiedAt(Instant.parse("2026-10-01T00:00:00Z")); product.markCreatedAt(Instant.parse("2026-10-01T00:00:00Z")); products.save(product);
        piece = new WardrobeItem(); piece.setUser(ana); piece.setName("Camisa branca"); piece.setCategory("upper_piece"); piece.setSubcategory("shirt"); piece.setMaterial("Algodão"); piece.setSizeLabel("M");
        piece.setCatalogProductId(product.getId()); piece.setVisibility(Visibility.PUBLIC); piece.setImageUrl("/media/x.jpg"); piece.setImageOrigin(ImageOrigin.USER_PHOTO); piece.setNotes("PRIVATE NOTES"); piece.setPurchaseLocation("SECRET SHOP");
        piece.setModel3dStatus(Model3dStatus.COMPLETED); piece.setModel3dUrl("/media/model.glb"); piece.markCreatedAt(Instant.parse("2026-10-02T00:00:00Z")); pieces.save(piece);
    }

    @Test void sheetHasStableIdentifierProvenanceAndNotInformedMarkers() {
        var sheet = service.sheet(actor(ana), piece.getId());
        assertThat(sheet).containsEntry("identifier", "FAI-PIECE-" + piece.getId()).containsEntry("access", "OWNER");
        assertThat(f(sheet, "identification", "brand")).containsEntry("value", "Marca X").containsEntry("provenance", "SOURCE_DECLARED");
        assertThat(f(sheet, "identification", "gtin")).containsEntry("informed", false).containsEntry("provenance", "NOT_INFORMED");
        assertThat(f(sheet, "images", "sourceUrl")).containsEntry("value", "https://marca.example/camisa");
        assertThat(f(sheet, "materials", "composition")).containsEntry("provenance", "SOURCE_DECLARED");
        var model = (Map<String, Object>) sheet.get("model3d");
        assertThat(model).containsEntry("kind", "SHOWCASE_GLB").containsEntry("provenance", "ESTIMATED").containsEntry("tryOnApproved", false).containsEntry("displayAllowed", true);
        assertThat((List<String>) sheet.get("notices")).contains("ESTIMATED_IS_NOT_CERTIFICATION");
        assertThat(sheet.get("lastUpdated")).isNotNull();
        assertThat(Json.write(sheet)).doesNotContain("PRIVATE NOTES", "SECRET SHOP", "certif");
    }

    @Test void ownerDeclarationsUpdateTheSheetAndViewersSeeOnlyWhatVisibilityAllows() {
        GarmentPassport p = new GarmentPassport(); p.setPieceId(piece.getId()); p.setOwnerId(ana.getId()); p.setOrigin("GARIMPADA"); p.setComposition("Linho 100%"); p.setCare("Lavar à mão"); p.setStateUpdatedAt(Instant.parse("2026-11-04T00:00:00Z")); passports.save(p);
        var owner = service.sheet(actor(ana), piece.getId());
        assertThat(f(owner, "materials", "composition")).containsEntry("value", "Linho 100%").containsEntry("provenance", "OWNER_DECLARED");
        assertThat(f(owner, "materials", "origin")).containsEntry("value", "GARIMPADA");
        assertThat(owner.get("lastUpdated")).isEqualTo(Instant.parse("2026-11-04T00:00:00Z"));
        when(guard.canView(any(), any(), any())).thenReturn(true);
        var viewer = service.sheet(actor(bia), piece.getId());
        assertThat(viewer).containsEntry("access", "VIEWER");
        assertThat(f(viewer, "materials", "origin")).containsEntry("informed", false);
        assertThat(f(viewer, "materials", "composition")).containsEntry("value", "Algodão");
        when(guard.canView(any(), any(), any())).thenReturn(false);
        assertThatThrownBy(() -> service.sheet(actor(bia), piece.getId())).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
        piece.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        assertThat(service.sheet(actor(ana), piece.getId())).containsEntry("access", "OWNER");
    }

    @Test void sizesDistinguishCommercialAvailabilityMeasurementProvenanceAndVisualApproximation() {
        PhysicalStoreListing listing = new PhysicalStoreListing(); listing.setProduct(product); listing.setSellerUserId(UUID.randomUUID()); listing.setPricePoints(1); listing.setActive(true); listings.save(listing);
        PhysicalStoreVariant m = new PhysicalStoreVariant(); m.setListingId(listing.getId()); m.setVariantKey("|m"); m.setSizeLabel("M"); m.setStockQuantity(2); variants.save(m);
        PhysicalStoreVariant g = new PhysicalStoreVariant(); g.setListingId(listing.getId()); g.setVariantKey("|g"); g.setSizeLabel("G"); g.setStockQuantity(0); variants.save(g);
        ProductSizeChart chart = new ProductSizeChart(); chart.setProductId(product.getId()); chart.setRevision(2); chart.setReviewerId(UUID.randomUUID());
        chart.setChartJson("{\"type\":\"GARMENT_MEASUREMENT\",\"family\":\"TSHIRT\",\"market\":\"BR\",\"sourceName\":\"Tabela oficial\",\"sourceUrl\":\"https://marca.example/tabela\",\"sourceRevision\":\"2026\",\"sourceAuthorized\":true,\"options\":[{\"label\":\"M\",\"order\":1,\"measurements\":[{\"region\":\"CHEST\",\"protocol\":\"GARMENT_FLAT_WIDTH_V1\",\"min\":52,\"max\":54}]}]}");
        charts.save(chart);
        GarmentAsset3d quarantined = new GarmentAsset3d(); quarantined.setPieceId(piece.getId()); quarantined.setStatus(GarmentAssetStatus.IN_REVIEW); quarantined.setRigStandard("FAI_BODY_V1"); quarantined.setSource("GENERATED"); assets.save(quarantined);
        var options = sizes.forPiece(piece);
        var rows = (List<Map<String, Object>>) options.get("sizes");
        Map<String, Object> rowM = rows.stream().filter(r -> "M".equals(r.get("label"))).findFirst().orElseThrow();
        Map<String, Object> rowG = rows.stream().filter(r -> "G".equals(r.get("label"))).findFirst().orElseThrow();
        Map<String, Object> rowXG = rows.stream().filter(r -> "XG".equals(r.get("label"))).findFirst().orElseThrow();
        assertThat(rowM).containsEntry("availability", "AVAILABLE").containsEntry("ownerDeclared", true).containsEntry("representation", "VISUAL_APPROXIMATION");
        assertThat(rowG).containsEntry("availability", "UNAVAILABLE");
        assertThat(rowXG).containsEntry("availability", "UNKNOWN").containsEntry("source", "GRID");
        var measurement = ((List<Map<String, Object>>) rowM.get("measurements")).getFirst();
        assertThat(measurement).containsEntry("unit", "cm").containsEntry("provenance", "OFFICIAL").containsEntry("sourceName", "Tabela oficial").containsEntry("chartRevision", 2);
        var representation = (Map<String, Object>) options.get("representation3d");
        assertThat(representation).containsEntry("kind", "SHOWCASE_GLB").containsEntry("approvedForTryOn", false).containsEntry("quarantine", "IN_REVIEW").containsEntry("sizeVariants", "RELATIVE_VISUAL_APPROXIMATION");
        assertThat(options).containsEntry("fitClaim", "NONE").containsEntry("avatarMeasurementsChanged", false).containsEntry("visualApproximationNote", "SIZES_ON_3D_ARE_RELATIVE_VISUAL_APPROXIMATIONS");
        assertThat(sizes.forProduct(product.getId())).containsEntry("grid", "letter");
    }
}
