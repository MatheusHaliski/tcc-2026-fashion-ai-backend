package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.DnaScheme;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Unidade pura extraída do {@link SocialService} (lote 07): campo por tipo de alvo e piso em zero. */
class InteractionCountersTest {

    @Test
    void lookMoveOsCincoContadores() {
        Scheme s = new Scheme();
        for (String f : new String[]{"likes", "comments", "shares", "saves", "remixes"}) {
            InteractionCounters.apply(s, f, 3);
        }
        assertThat(new long[]{s.getLikeCount(), s.getCommentCount(), s.getShareCount(), s.getSaveCount(), s.getRemixCount()})
                .containsExactly(3, 3, 3, 3, 3);
        InteractionCounters.apply(s, "likes", -5);
        assertThat(s.getLikeCount()).isZero();
    }

    @Test
    void pecaIgnoraSalvosECampoDesconhecido() {
        WardrobeItem w = new WardrobeItem();
        InteractionCounters.apply(w, "saves", 1);
        InteractionCounters.apply(w, "views", 1);
        assertThat(new long[]{w.getLikesCount(), w.getCommentCount(), w.getSharesCount(), w.getRemixesCount(), w.getViewCount()})
                .containsOnly(0);
        InteractionCounters.apply(w, "likes", 2);
        InteractionCounters.apply(w, "comments", 1);
        InteractionCounters.apply(w, "shares", 1);
        InteractionCounters.apply(w, "remixes", 1);
        InteractionCounters.apply(w, "comments", -4);
        assertThat(new long[]{w.getLikesCount(), w.getCommentCount(), w.getSharesCount(), w.getRemixesCount()})
                .containsExactly(2, 0, 1, 1);
    }

    @Test
    void dnaIgnoraSalvosEPisaEmZero() {
        DnaScheme d = new DnaScheme();
        InteractionCounters.apply(d, "saves", 1);
        InteractionCounters.apply(d, "likes", 1);
        InteractionCounters.apply(d, "comments", 1);
        InteractionCounters.apply(d, "shares", 1);
        InteractionCounters.apply(d, "remixes", 1);
        InteractionCounters.apply(d, "remixes", -2);
        assertThat(new long[]{d.getLikeCount(), d.getCommentCount(), d.getShareCount(), d.getRemixCount()})
                .containsExactly(1, 1, 1, 0);
    }

    @Test
    void entidadeDesconhecidaNaoMudaNadaENuloFalhaComoAntes() {
        InteractionCounters.apply("outro", "likes", 1);   // sem efeito
        assertThatThrownBy(() -> InteractionCounters.apply(null, "likes", 1)).isInstanceOf(NullPointerException.class);
    }
}
