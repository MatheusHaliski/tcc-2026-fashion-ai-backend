package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FlairAdventureLevelGateTest {
    @Test
    void rejectsAdventureAccessBelowLoftBeforeLoadingGameState() {
        var points = mock(FaiPointsService.class);
        when(points.level(org.mockito.ArgumentMatchers.any())).thenReturn(FaiPointsService.Level.STUDIO);
        var service = new FlairAdventureService(null, null, null, null, null, null, points);
        var user = new CurrentUser(UUID.randomUUID(), "player", "USER", null, true, null, null, null);

        assertThatThrownBy(() -> service.active(user))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Loft");
    }
}
