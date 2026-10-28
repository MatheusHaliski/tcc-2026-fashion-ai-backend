package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomInventoryItem;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/** RF35.CA05 — um módulo mostra um item só, e retirar do quarto nunca tira o item do inventário. */
class RoomInventoryApplyTest {
    private final UUID owner = UUID.randomUUID();
    private final CurrentUser me = new CurrentUser(owner, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private RoomInventoryItemRepository inventory;
    private RoomCatalogItemRepository catalog;
    private FaiPointsService.RoomLayoutAccess layouts;
    private FaiPointsService service;
    private final RoomLayout layout = new RoomLayout();

    @BeforeEach
    void setUp() {
        inventory = mock(RoomInventoryItemRepository.class);
        catalog = mock(RoomCatalogItemRepository.class);
        layouts = mock(FaiPointsService.RoomLayoutAccess.class);
        when(layouts.layout(owner)).thenReturn(layout);
        service = new FaiPointsService(null, null, catalog, inventory, layouts, null, null);
    }

    private RoomCatalogItem sku(String code) {
        RoomCatalogItem c = new RoomCatalogItem();
        c.setSku(code);
        c.setKind("COMPONENT");
        when(catalog.findById(code)).thenReturn(Optional.of(c));
        return c;
    }

    private RoomInventoryItem unit(String code, String module) {
        RoomInventoryItem i = new RoomInventoryItem();
        i.setId(UUID.randomUUID());
        i.setUserId(owner);
        i.setSku(code);
        i.setAppliedModule(module);
        when(inventory.findById(i.getId())).thenReturn(Optional.of(i));
        return i;
    }

    @Test
    void applyingToAnOccupiedModuleReleasesThePreviousUnit() {
        RoomCatalogItem gold = sku("GOLD");
        sku("SILVER");
        RoomInventoryItem old = unit("SILVER", "door:1");
        RoomInventoryItem elsewhere = unit("SILVER", "door:2");
        RoomInventoryItem fresh = unit("GOLD", null);
        when(layouts.compatibleModules(owner, gold)).thenReturn(List.of("door:1", "door:2"));
        when(inventory.findByUserId(owner)).thenReturn(List.of(old, elsewhere, fresh));
        layout.setModulesJson(Json.write(List.of(Map.of("id", "door:1", "sku", "GOLD"), Map.of("id", "door:2", "sku", "SILVER"))));

        service.apply(me, fresh.getId(), "door:1");

        assertThat(fresh.getAppliedModule()).isEqualTo("door:1");
        assertThat(old.getAppliedModule()).isNull();                // voltou para a caixa, continua no inventário
        assertThat(elsewhere.getAppliedModule()).isEqualTo("door:2");
    }

    @Test
    void removingFromRoomResetsTheModuleAndKeepsOwnership() {
        RoomCatalogItem gold = sku("GOLD");
        RoomInventoryItem mounted = unit("GOLD", "door:1");

        Map<String, Object> out = service.unapply(me, mounted.getId());

        verify(layouts).resetFinish(owner, "door:1", gold);
        assertThat(mounted.getAppliedModule()).isNull();
        assertThat(out).containsEntry("applied", false).containsEntry("inventoryId", mounted.getId());
        verify(inventory, never()).delete(any(RoomInventoryItem.class));
    }

    @Test
    void cannotRemoveSomeoneElsesOrAnUnappliedItem() {
        sku("GOLD");
        RoomInventoryItem boxed = unit("GOLD", null);
        assertThatThrownBy(() -> service.unapply(me, boxed.getId())).isInstanceOf(ApiException.class);

        RoomInventoryItem foreign = unit("GOLD", "door:1");
        foreign.setUserId(UUID.randomUUID());
        assertThatThrownBy(() -> service.unapply(me, foreign.getId())).isInstanceOf(ApiException.class);
        verify(layouts, never()).resetFinish(any(), any(), any());
    }
}
