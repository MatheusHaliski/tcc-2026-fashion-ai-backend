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
        // a prévia das vantagens do deck segue a mesma regra do jogo
        assertThatThrownBy(() -> service.preview(user, java.util.List.of(UUID.randomUUID())))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Loft");
    }

    /** Prévia: as cartas de todos os looks escolhidos formam o deck; looks de outra pessoa são recusados. */
    @Test
    void previewSomaAsCartasDosLooksEscolhidosERecusaLookAlheio() {
        var points = mock(FaiPointsService.class);
        when(points.level(org.mockito.ArgumentMatchers.any())).thenReturn(FaiPointsService.Level.LOFT);
        var flair = mock(FlairService.class);
        var guard = mock(br.com.fashionai.application.security.Guard.class);
        var mine = UUID.randomUUID();
        var other = UUID.randomUUID();
        var card = br.com.fashionai.application.flair.AfterpartyModsTest.card("casual_sneakers", "#111111", java.util.List.of("minimalist", "sporty"), java.util.List.of("casual"), "COTTON", "STANDARD",
                br.com.fashionai.application.flair.AfterpartyModsTest.stats(40, 20, 40, 55, 100));
        var deck = new br.com.fashionai.application.flair.FlairEngine.Deck(mine.toString(), "Look preto", java.util.List.of(card, card), java.util.List.of(), 1, null, 0, 0, java.util.Map.of(), java.util.List.of());
        var user = new CurrentUser(UUID.randomUUID(), "player", "USER", null, true, null, null, null);
        when(flair.decks(user)).thenReturn(java.util.List.of(deck));
        var service = new FlairAdventureService(null, flair, guard, null, null, null, points);
        var mods = (br.com.fashionai.application.flair.AfterpartyMods.Mods) service.preview(user, java.util.List.of(mine)).get("mods");
        org.assertj.core.api.Assertions.assertThat(mods.light()).isEqualTo("PENUMBRA");
        org.assertj.core.api.Assertions.assertThat(mods.speedMul()).isGreaterThan(1);
        assertThatThrownBy(() -> service.preview(user, java.util.List.of(mine, other))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.preview(user, java.util.List.of())).isInstanceOf(ApiException.class);
    }
}
