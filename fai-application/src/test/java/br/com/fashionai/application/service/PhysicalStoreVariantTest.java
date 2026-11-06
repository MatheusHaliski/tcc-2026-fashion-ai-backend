package br.com.fashionai.application.service;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** RF-PESQ-01 — resgate por SKU, cor e tamanho com estoque por variante. */
class PhysicalStoreVariantTest {
    PhysicalStoreListingRepository listings = MemoryRepository.of(PhysicalStoreListingRepository.class);
    PhysicalStoreOrderRepository orders = MemoryRepository.of(PhysicalStoreOrderRepository.class);
    PhysicalStoreVariantRepository variants = MemoryRepository.of(PhysicalStoreVariantRepository.class);
    CatalogVariantRepository catalogVariants = MemoryRepository.of(CatalogVariantRepository.class);
    FaiPointsLedgerEntryRepository ledger = MemoryRepository.of(FaiPointsLedgerEntryRepository.class);
    UserRepository users = MemoryRepository.of(UserRepository.class);
    Guard guard = mock(Guard.class);
    PhysicalStoreService store;
    PhysicalStoreVariantService service;
    User seller, buyer;
    PhysicalStoreListing listing;
    CatalogProduct product, otherProduct;
    PhysicalStoreService.OrderForm address(UUID variant) {
        return new PhysicalStoreService.OrderForm(new PhysicalStoreService.ShippingAddress("Ana", "119", "01000", "SP", "SP", "Centro", "Rua", "1", null), variant);
    }
    CurrentUser actor(User u) { return CurrentUser.of(u, "127.0.0.1", "test"); }

    @BeforeEach void setUp() {
        seller = new User("marca", "Marca", "m@example.invalid", "h1", "p", ProfileType.MARCA); seller.setStatus(AccountStatus.ACTIVE); seller.setEmailVerified(true); users.save(seller);
        buyer = new User("ana", "Ana", "a@example.invalid", "h2", "p", ProfileType.PESSOAL); buyer.setStatus(AccountStatus.ACTIVE); buyer.setEmailVerified(true); users.save(buyer);
        product = new CatalogProduct(); product.assignId(UUID.randomUUID()); product.setCategory("upper_piece");
        otherProduct = new CatalogProduct(); otherProduct.assignId(UUID.randomUUID());
        listing = new PhysicalStoreListing(); listing.setProduct(product); listing.setSellerUserId(seller.getId()); listing.setPricePoints(100);
        listing.setRequiredLevel("ESTREIA"); listing.setStockQuantity(0); listing.setActive(true); listings.save(listing);
        when(guard.deny(any(), any(), any())).thenReturn(ApiException.forbidden("denied"));
        when(listings.lockById(any())).thenAnswer(inv -> listings.findById(inv.getArgument(0)));
        when(variants.lockById(any())).thenAnswer(inv -> variants.findById(inv.getArgument(0)));
        when(ledger.lockOwner(any())).thenAnswer(inv -> users.findById(inv.getArgument(0)));
        when(ledger.lifetime(any())).thenReturn(500L);
        when(ledger.balance(any())).thenReturn(1000L);
        CatalogService catalog = mock(CatalogService.class);
        when(catalog.product(any())).thenReturn(Map.of("id", product.getId()));
        WardrobeCreatorService creator = mock(WardrobeCreatorService.class);
        when(creator.identity(any())).thenReturn(Map.of("name", "Marca"));
        store = new PhysicalStoreService(listings, orders, variants, MemoryRepository.of(CatalogProductRepository.class), MemoryRepository.of(BrandRepository.class), ledger, users, guard, catalog, creator);
        service = new PhysicalStoreVariantService(listings, variants, catalogVariants, guard);
    }
    Map<String, Object> variant(String color, String size, int stock) {
        return service.save(actor(seller), listing.getId(), null, new PhysicalStoreVariantService.VariantForm(null, null, color, size, stock, true, null));
    }

    @Test void checkoutListsOnlyThisListingAndDistinguishesMissingFromSoldOut() {
        var empty = service.checkout(actor(buyer), listing.getId());
        assertThat(empty).containsEntry("variantInfo", "MISSING").containsEntry("variantRequired", false);
        variant("Azul", "M", 2); variant("Azul", "G", 0);
        PhysicalStoreListing other = new PhysicalStoreListing(); other.setProduct(product); other.setSellerUserId(seller.getId()); other.setPricePoints(5); listings.save(other);
        service.save(actor(seller), other.getId(), null, new PhysicalStoreVariantService.VariantForm(null, null, "Vermelho", "P", 9, true, null));
        var view = service.checkout(actor(buyer), listing.getId());
        @SuppressWarnings("unchecked") var rows = (List<Map<String, Object>>) view.get("variants");
        assertThat(view).containsEntry("variantInfo", "PRESENT").containsEntry("variantRequired", true);
        assertThat(rows).extracting(r -> r.get("sizeLabel")).containsExactlyInAnyOrder("M", "G");
        assertThat(rows).extracting(r -> r.get("availability")).containsExactlyInAnyOrder("AVAILABLE", "SOLD_OUT");
        assertThat(rows.getFirst()).doesNotContainKeys("stock", "reserved");
    }

    @Test void serverRejectsForeignMissingAndSoldOutVariantsBeforeCharging() {
        var m = variant("Azul", "M", 1); variant("Azul", "G", 0);
        PhysicalStoreListing other = new PhysicalStoreListing(); other.setProduct(product); other.setSellerUserId(seller.getId()); other.setPricePoints(5); listings.save(other);
        var foreign = service.save(actor(seller), other.getId(), null, new PhysicalStoreVariantService.VariantForm(null, null, "Vermelho", "P", 9, true, null));
        UUID soldOut = variants.findByListingIdAndVariantKey(listing.getId(), "azul|g").orElseThrow().getId();
        assertThatThrownBy(() -> store.buy(actor(buyer), listing.getId(), address(null), null)).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("VARIANTE_OBRIGATORIA"));
        assertThatThrownBy(() -> store.buy(actor(buyer), listing.getId(), address((UUID) foreign.get("id")), null)).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("VARIANTE_DE_OUTRA_OFERTA"));
        assertThatThrownBy(() -> store.buy(actor(buyer), listing.getId(), address(UUID.randomUUID()), null)).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("VARIANTE_INEXISTENTE"));
        assertThatThrownBy(() -> store.buy(actor(buyer), listing.getId(), address(soldOut), null)).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("VARIANTE_ESGOTADA"));
        assertThat(MemoryRepository.rows(ledger)).isEmpty();
        assertThat(MemoryRepository.rows(orders)).isEmpty();
        assertThat((UUID) m.get("id")).isNotNull();
    }

    @Test void lastUnitIsSoldOnceAndRepeatingTheKeyReturnsTheSameOrder() {
        var m = variant("Azul", "M", 1);
        UUID id = (UUID) m.get("id");
        var first = store.buy(actor(buyer), listing.getId(), address(id), "0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9");
        var again = store.buy(actor(buyer), listing.getId(), address(id), "0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9");
        assertThat(again).containsEntry("id", first.get("id")).containsEntry("repeated", true);
        assertThatThrownBy(() -> store.buy(actor(buyer), listing.getId(), address(id), "1b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("VARIANTE_ESGOTADA"));
        assertThat(MemoryRepository.rows(orders)).hasSize(1);
        assertThat(variants.findById(id).orElseThrow().getStockQuantity()).isZero();
        @SuppressWarnings("unchecked") var chosen = (Map<String, Object>) first.get("variant");
        assertThat(chosen).containsEntry("sizeLabel", "M").containsEntry("colorName", "Azul");
        assertThat(first).containsEntry("variantInfo", "PRESENT");
    }

    @Test void orderKeepsTheSkuSnapshotEvenAfterTheVariantChanges() {
        var m = variant("Azul", "M", 3);
        UUID id = (UUID) m.get("id");
        store.buy(actor(buyer), listing.getId(), address(id), null);
        service.save(actor(seller), listing.getId(), id, new PhysicalStoreVariantService.VariantForm(null, "SKU-NEW", "Azul", "M", 5, true, null));
        var mine = store.myOrders(actor(buyer));
        @SuppressWarnings("unchecked") var chosen = (Map<String, Object>) mine.getFirst().get("variant");
        assertThat(chosen).containsEntry("sizeLabel", "M").containsEntry("sku", null);
        var admin = new User("adm", "Adm", "adm@example.invalid", "h3", "p", ProfileType.ADMIN); admin.setRole("ADMIN"); admin.setStatus(AccountStatus.ACTIVE); users.save(admin);
        assertThat(store.adminOrders(actor(admin)).getFirst()).containsKey("variant");
    }

    @Test void catalogVariantMustBelongToTheListingProductAndDuplicatesAreRejected() {
        CatalogVariant foreign = new CatalogVariant(); foreign.setProductId(otherProduct.getId()); foreign.setVariantKey("x"); catalogVariants.save(foreign);
        CatalogVariant own = new CatalogVariant(); own.setProductId(product.getId()); own.setVariantKey("blue"); own.setColorName("Azul marinho"); own.setSku("SKU-1"); catalogVariants.save(own);
        assertThatThrownBy(() -> service.save(actor(seller), listing.getId(), null, new PhysicalStoreVariantService.VariantForm(foreign.getId(), null, null, "M", 1, true, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("VARIANTE_DE_OUTRO_PRODUTO"));
        var created = service.save(actor(seller), listing.getId(), null, new PhysicalStoreVariantService.VariantForm(own.getId(), null, null, "M", 1, true, null));
        assertThat(created).containsEntry("colorName", "Azul marinho").containsEntry("sku", "SKU-1");
        assertThatThrownBy(() -> variant("azul marinho", "m", 1)).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("VARIANTE_DUPLICADA"));
        assertThatThrownBy(() -> service.list(actor(buyer), listing.getId())).isInstanceOf(ApiException.class);
    }
}
