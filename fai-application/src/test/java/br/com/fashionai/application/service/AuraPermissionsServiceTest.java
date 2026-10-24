package br.com.fashionai.application.service;

import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuraPermissionsServiceTest {
    @Test
    void hypeUnlocksAtStudioAndMetamorphoseAndImpersonationAtLoft() {
        var ledger = mock(FaiPointsLedgerEntryRepository.class);
        var userId = UUID.randomUUID();
        when(ledger.lifetime(userId)).thenReturn(300L, 899L, 899L, 900L, 900L);
        var permissions = new AuraPermissionsService(ledger);

        assertThat(permissions.canUserEquipAura(userId, AuraPermissionsService.AuraType.AURA_DYNAMIC)).isTrue();
        assertThat(permissions.canUserEquipAura(userId, AuraPermissionsService.AuraType.AURA_METAMORPHOSE)).isFalse();
        assertThat(permissions.canUserEquipAura(userId, AuraPermissionsService.AuraType.AURA_IMPERSONATION)).isFalse();
        assertThat(permissions.canUserEquipAura(userId, AuraPermissionsService.AuraType.AURA_METAMORPHOSE)).isTrue();
        assertThat(permissions.canUserEquipAura(userId, AuraPermissionsService.AuraType.AURA_IMPERSONATION)).isTrue();
    }
    @Test
    void hypeFinishChecksLifetimeXpInsteadOfSpendableBalance() {
        var ledger=mock(FaiPointsLedgerEntryRepository.class);var owner=UUID.randomUUID();
        var permission=new AuraPermissionsService(ledger);
        when(ledger.lifetime(owner)).thenReturn(299L);
        permission.requireHypeFinish(owner,"COMMON");
        org.assertj.core.api.Assertions.assertThatThrownBy(()->permission.requireHypeFinish(owner,"RARE")).isInstanceOf(br.com.fashionai.application.common.ApiException.class);
        when(ledger.lifetime(owner)).thenReturn(300L);
        permission.requireHypeFinish(owner,"RARE");
        org.assertj.core.api.Assertions.assertThatThrownBy(()->permission.requireHypeFinish(owner,"LEGENDARY")).isInstanceOf(br.com.fashionai.application.common.ApiException.class);
        when(ledger.lifetime(owner)).thenReturn(900L);
        permission.requireHypeFinish(owner,"LEGENDARY");permission.requireHypeFinish(owner,"COLLAB_DROP");
    }
}
