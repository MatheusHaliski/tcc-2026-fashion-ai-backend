package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.service.FaiPointsService.Level;
import br.com.fashionai.application.service.GlassAccess.WardrobeLevel;
import br.com.fashionai.domain.model.FlairChallenge;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Glass Empire — bloqueio por nível: limiares dos pontos vitalícios (299/300 e 899/900), faixas do guarda-roupa
 * (299/300, 959/960, score nulo), visitante nunca "pode jogar", e os 403 com código e detalhes.
 */
class GlassAccessTest {
    private FaiPointsService points;
    private InventoryScoreService inventory;
    private GlassAccess access;
    private final UUID ana = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        points = mock(FaiPointsService.class);
        inventory = mock(InventoryScoreService.class);
        access = new GlassAccess(points, inventory);
    }

    static FlairChallenge game(String tier, String wardrobe) {
        FlairChallenge g = new FlairChallenge();
        g.setSlug("a01-espelho-partido");
        g.setSeries("A");
        g.setRequiredLevel(tier);
        g.setRequiredWardrobeLevel(wardrobe);
        return g;
    }

    static InventoryScoreService.Result score(Integer score, boolean eligible) {
        return new InventoryScoreService.Result(UUID.randomUUID(), eligible, 12, 1.0, score, "x", Map.of(), Map.of(), List.of(), Instant.now());
    }

    void lifetime(long pts, Integer score) {
        when(points.level(ana)).thenReturn(Level.of(pts));
        when(inventory.compute(ana, true)).thenReturn(score(score, score != null));
    }

    // ------------------------------------------------------------------ nível FAI (pontos vitalícios)
    @Test
    void limiaresDoNivelFai299e300e899e900() {
        lifetime(299, 0);
        assertThat(access.me(ana).tier()).isEqualTo(Level.ESTREIA);
        lifetime(300, 0);
        assertThat(access.me(ana).tier()).isEqualTo(Level.STUDIO);
        lifetime(899, 0);
        assertThat(access.me(ana).tier()).isEqualTo(Level.STUDIO);
        lifetime(900, 0);
        assertThat(access.me(ana).tier()).isEqualTo(Level.LOFT);
    }

    @Test
    void meLeNivelEGuardaRoupaUmaVezCada() {
        lifetime(950, 700);
        GlassAccess.Me me = access.me(ana);
        assertThat(me).isEqualTo(new GlassAccess.Me(Level.LOFT, WardrobeLevel.BEM_CURADO, 700));
        verify(points).level(ana);
        verify(inventory).compute(ana, true);
    }

    // ------------------------------------------------------------------ faixas do guarda-roupa
    @Test
    void faixasDoGuardaRoupa299e300e959e960eNulo() {
        assertThat(WardrobeLevel.of(299)).isEqualTo(WardrobeLevel.EM_MONTAGEM);
        assertThat(WardrobeLevel.of(300)).isEqualTo(WardrobeLevel.ORGANIZADO);
        assertThat(WardrobeLevel.of(499)).isEqualTo(WardrobeLevel.ORGANIZADO);
        assertThat(WardrobeLevel.of(500)).isEqualTo(WardrobeLevel.VERSATIL);
        assertThat(WardrobeLevel.of(649)).isEqualTo(WardrobeLevel.VERSATIL);
        assertThat(WardrobeLevel.of(650)).isEqualTo(WardrobeLevel.BEM_CURADO);
        assertThat(WardrobeLevel.of(799)).isEqualTo(WardrobeLevel.BEM_CURADO);
        assertThat(WardrobeLevel.of(800)).isEqualTo(WardrobeLevel.CLOSET_INTELIGENTE);
        assertThat(WardrobeLevel.of(899)).isEqualTo(WardrobeLevel.CLOSET_INTELIGENTE);
        assertThat(WardrobeLevel.of(900)).isEqualTo(WardrobeLevel.CLOSET_ASSINATURA);
        assertThat(WardrobeLevel.of(959)).isEqualTo(WardrobeLevel.CLOSET_ASSINATURA);
        assertThat(WardrobeLevel.of(960)).isEqualTo(WardrobeLevel.MAISON_CLOSET);
        assertThat(WardrobeLevel.of(1000)).isEqualTo(WardrobeLevel.MAISON_CLOSET);
        assertThat(WardrobeLevel.of(null)).isEqualTo(WardrobeLevel.EM_MONTAGEM);
        assertThat(WardrobeLevel.of(-5)).isEqualTo(WardrobeLevel.EM_MONTAGEM);
    }

    @Test
    void guardaRoupaInelegivelOuSemAvaliacaoEhEmMontagem() {
        when(points.level(ana)).thenReturn(Level.STUDIO);
        when(inventory.compute(ana, true)).thenReturn(score(850, false));
        assertThat(access.me(ana)).isEqualTo(new GlassAccess.Me(Level.STUDIO, WardrobeLevel.EM_MONTAGEM, null));
        when(inventory.compute(ana, true)).thenReturn(null);
        assertThat(access.me(ana).wardrobe()).isEqualTo(WardrobeLevel.EM_MONTAGEM);
    }

    // ------------------------------------------------------------------ check / require
    @Test
    void visitanteVeOsMotivosMasNuncaPodeJogar() {
        GlassAccess.Me me = access.me(null);
        verifyNoInteractions(points, inventory);
        GlassAccess.Access a = access.check(game("ESTREIA", "EM_MONTAGEM"), me, false);
        assertThat(a.tierOk()).isTrue();
        assertThat(a.wardrobeOk()).isTrue();
        assertThat(a.allowed()).isFalse();
        assertThat(a.toMap()).containsEntry("requiredTier", "ESTREIA").containsEntry("currentTier", "ESTREIA")
                .containsEntry("requiredWardrobeLevel", "EM_MONTAGEM").containsEntry("currentWardrobeLevel", "EM_MONTAGEM");
    }

    @Test
    void checkInformaCadaRequisitoSeparado() {
        GlassAccess.Me me = new GlassAccess.Me(Level.LOFT, WardrobeLevel.ORGANIZADO, 320);
        GlassAccess.Access a = access.check(game("STUDIO", "VERSATIL"), me, true);
        assertThat(a.tierOk()).isTrue();
        assertThat(a.wardrobeOk()).isFalse();
        assertThat(a.allowed()).isFalse();
        assertThat(access.check(game("LOFT", "ORGANIZADO"), me, true).allowed()).isTrue();
    }

    @Test
    void requireDevolve403ComCodigoEDetalhesDoNivel() {
        GlassAccess.Me me = new GlassAccess.Me(Level.STUDIO, WardrobeLevel.MAISON_CLOSET, 990);
        assertThatThrownBy(() -> access.require(game("LOFT", "EM_MONTAGEM"), me))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(403);
                    assertThat(e.code()).isEqualTo("FAI_LEVEL_REQUIRED");
                    assertThat(e.details()).containsEntry("requiredTier", "LOFT").containsEntry("currentTier", "STUDIO");
                });
    }

    @Test
    void requireDevolve403ComCodigoEDetalhesDoGuardaRoupa() {
        GlassAccess.Me me = new GlassAccess.Me(Level.LOFT, WardrobeLevel.ORGANIZADO, 310);
        assertThatThrownBy(() -> access.require(game("ESTREIA", "BEM_CURADO"), me))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(403);
                    assertThat(e.code()).isEqualTo("WARDROBE_LEVEL_REQUIRED");
                    assertThat(e.details()).containsEntry("requiredWardrobeLevel", "BEM_CURADO").containsEntry("currentWardrobeLevel", "ORGANIZADO");
                });
        access.require(game("ESTREIA", "ORGANIZADO"), me);   // no limite exato passa
    }

    @Test
    void nivelExigidoInvalidoNoCatalogoEhErroClaroNaoJogoAberto() {
        assertThatThrownBy(() -> GlassAccess.requiredTier(game("PENTHOUSE", "EM_MONTAGEM")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("a01-espelho-partido").hasMessageContaining("PENTHOUSE");
        assertThatThrownBy(() -> GlassAccess.requiredWardrobe(game("LOFT", "ARRUMADO")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("ARRUMADO");
        assertThat(GlassAccess.requiredTier(game(null, null))).isEqualTo(Level.ESTREIA);
        assertThat(GlassAccess.requiredWardrobe(game(null, null))).isEqualTo(WardrobeLevel.EM_MONTAGEM);
        when(points.level(any())).thenReturn(null);
        when(inventory.compute(any(), eq(true))).thenReturn(null);
        assertThat(access.me(ana).tier()).isEqualTo(Level.ESTREIA);
    }
}
