package br.com.fashionai.application.service;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.PhysicalStoreListing;
import br.com.fashionai.domain.model.PhysicalStoreOrder;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.PhysicalStoreListingRepository;
import br.com.fashionai.domain.repository.PhysicalStoreOrderRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Loja física: o mesmo pedido repetido (reenvio depois de um timeout) não cria outro pedido nem cobra duas vezes. */
class PhysicalStorePurchaseTest {
    private final UUID buyer = UUID.randomUUID();
    private final UUID seller = UUID.randomUUID();
    private final CurrentUser me = new CurrentUser(buyer, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private final List<FaiPointsLedgerEntry> ledgerRows = new ArrayList<>();
    private final List<PhysicalStoreOrder> created = new ArrayList<>();
    private FaiPointsLedgerEntryRepository ledger;
    private PhysicalStoreService store;
    private PhysicalStoreListing listing;
    private final PhysicalStoreService.OrderForm form = new PhysicalStoreService.OrderForm(new PhysicalStoreService.ShippingAddress(
            "Ana Teste", "11999990000", "01000-000", "SP", "São Paulo", "Centro", "Rua A", "10", null));

    @BeforeEach
    void setUp() {
        ledger = mock(FaiPointsLedgerEntryRepository.class);
        PhysicalStoreListingRepository listings = mock(PhysicalStoreListingRepository.class);
        PhysicalStoreOrderRepository orders = mock(PhysicalStoreOrderRepository.class);
        UserRepository users = mock(UserRepository.class);
        listing = new PhysicalStoreListing();
        listing.assignId(UUID.randomUUID());
        br.com.fashionai.domain.model.CatalogProduct product = new br.com.fashionai.domain.model.CatalogProduct();
        product.assignId(UUID.randomUUID());
        listing.setProduct(product);
        listing.setSellerUserId(seller);
        listing.setPricePoints(100);
        listing.setRequiredLevel("ESTREIA");
        listing.setStockQuantity(5);
        listing.setActive(true);
        UUID listingId = UUID.randomUUID();
        when(listings.findById(listingId)).thenReturn(Optional.of(listing));
        when(listings.lockById(any())).thenReturn(Optional.of(listing));
        User sellerUser = new User(); sellerUser.assignId(seller); sellerUser.setStatus(AccountStatus.ACTIVE); sellerUser.setProfileType(ProfileType.MARCA);
        when(users.findById(seller)).thenReturn(Optional.of(sellerUser));
        when(ledger.lockOwner(any())).thenAnswer(inv -> { User u = new User(); u.assignId(inv.getArgument(0)); return Optional.of(u); });
        when(ledger.lifetime(buyer)).thenReturn(500L);
        when(ledger.balance(buyer)).thenReturn(150L);
        when(ledger.save(any(FaiPointsLedgerEntry.class))).thenAnswer(inv -> { ledgerRows.add(inv.getArgument(0)); return inv.getArgument(0); });
        when(ledger.findByIdempotencyKey(anyString())).thenAnswer(inv -> ledgerRows.stream()
                .filter(e -> e.getIdempotencyKey().equals(inv.getArgument(0))).findFirst());
        when(orders.save(any())).thenAnswer(inv -> { PhysicalStoreOrder o = inv.getArgument(0); o.assignId(UUID.randomUUID()); created.add(o); return o; });
        when(orders.findById(any())).thenAnswer(inv -> created.stream().filter(o -> o.getId().equals(inv.getArgument(0))).findFirst());
        store = new PhysicalStoreService(listings, orders, mock(CatalogProductRepository.class), mock(BrandRepository.class), ledger, users,
                mock(Guard.class), mock(CatalogService.class), mock(WardrobeCreatorService.class));
        this.listingId = listingId;
    }

    private UUID listingId;

    @Test
    void reenvioComAMesmaChaveDevolveOPedidoJaCriado() {
        String key = "0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9";
        var first = store.buy(me, listingId, form, key);
        var again = store.buy(me, listingId, form, key);
        assertThat(again).containsEntry("id", first.get("id")).containsEntry("repeated", true);
        assertThat(created).hasSize(1);
        assertThat(listing.getStockQuantity()).isEqualTo(4);
        assertThat(ledgerRows).extracting(FaiPointsLedgerEntry::getDelta).containsExactly(-100, 100);
        store.buy(me, listingId, form, "1b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9");   // outra compra de verdade
        assertThat(created).hasSize(2);
    }

    @Test
    void recusaPorSaldoVemTraduzidaENaoCobraNada() {
        when(ledger.balance(buyer)).thenReturn(40L);
        assertThatThrownBy(() -> store.buy(me, listingId, form, null)).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.code()).isEqualTo("SALDO_INSUFICIENTE");
            assertThat(e.getMessage()).doesNotContain("You do not have").contains("40").contains("100");
        });
        assertThat(ledgerRows).isEmpty();
        assertThat(created).isEmpty();
    }
}
