package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomInventoryItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF35 — compra na loja do quarto sem gasto duplo: o saldo (soma do ledger) só é lido depois de travar a linha do
 * comprador, e o estoque de edição limitada depois de travar a do item (FOR UPDATE), sempre nessa ordem.
 */
class FaiPointsShopTest {
    private final UUID buyer = UUID.randomUUID();
    private final CurrentUser me = new CurrentUser(buyer, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private FaiPointsLedgerEntryRepository ledger;
    private RoomCatalogItemRepository catalog;
    private RoomInventoryItemRepository inventory;
    private WardrobeCreatorService creator;
    private FaiPointsService service;
    private RoomCatalogItem item;

    @BeforeEach
    void setUp() {
        ledger = mock(FaiPointsLedgerEntryRepository.class);
        catalog = mock(RoomCatalogItemRepository.class);
        inventory = mock(RoomInventoryItemRepository.class);
        creator = mock(WardrobeCreatorService.class);
        User u = new User();
        u.assignId(buyer);
        when(ledger.lockOwner(buyer)).thenReturn(Optional.of(u));
        when(ledger.lifetime(buyer)).thenReturn(500L);
        item = new RoomCatalogItem();
        item.setSku("BRD-X-1");
        item.setPricePoints(100);
        item.setRequiredLevel("ESTREIA");
        item.setStockLimit(1);
        when(catalog.lockBySku("BRD-X-1")).thenReturn(Optional.of(item));
        when(inventory.save(any())).thenAnswer(inv -> {
            RoomInventoryItem saved = inv.getArgument(0);
            saved.setId(UUID.randomUUID());                    // o @PrePersist do JPA faria isso
            return saved;
        });
        service = new FaiPointsService(ledger, null, catalog, inventory, null, null, creator);
    }

    @Test
    void travaCompradorDepoisItemAntesDeLerSaldoEEstoque() {
        when(ledger.balance(buyer)).thenReturn(150L);
        service.buy(me, "BRD-X-1");

        InOrder order = inOrder(ledger, catalog);
        order.verify(ledger).lockOwner(buyer);
        order.verify(catalog).lockBySku("BRD-X-1");
        order.verify(ledger).balance(buyer);
        order.verify(ledger).save(any(FaiPointsLedgerEntry.class));
        verify(catalog, never()).findById(anyString());            // nada de leitura sem trava
        assertThat(item.getSoldCount()).isEqualTo(1);
    }

    @Test
    void segundaCompraSerializadaVeOSaldoJaDebitadoEOEstoqueEsgotado() {
        when(ledger.balance(buyer)).thenReturn(150L, 50L);
        service.buy(me, "BRD-X-1");
        // a segunda compra só lê saldo/estoque depois de a primeira liberar as travas: vê o débito e o item esgotado
        assertThatThrownBy(() -> service.buy(me, "BRD-X-1")).isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("ESGOTADO");

        item.setStockLimit(null);
        assertThatThrownBy(() -> service.buy(me, "BRD-X-1")).isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("SALDO_INSUFICIENTE");
        verify(inventory, org.mockito.Mockito.times(1)).save(any(RoomInventoryItem.class));
    }

    @Test
    void itemDeCriadorComPerfilPendenteNaoAparecePraCompra() {
        when(creator.blocker(any(), any())).thenReturn("Item fora da loja.");
        when(ledger.balance(buyer)).thenReturn(150L);
        assertThatThrownBy(() -> service.buy(me, "BRD-X-1")).isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("CONDICAO_DE_COMPRA");
        verify(ledger, never()).save(any());
    }
}
