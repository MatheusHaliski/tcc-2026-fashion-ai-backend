package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SchemeRulesTest {
    @Test
    void combinationKeyIsOrderIndependent() {
        UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID();
        assertThat(SchemeService.combinationKey(List.of(a, b, c))).isEqualTo(SchemeService.combinationKey(List.of(c, a, b)));
        assertThat(SchemeService.combinationKey(List.of(a, b))).isNotEqualTo(SchemeService.combinationKey(List.of(a, c)));
    }

    @Test
    void moreRestrictiveVisibilityWinsAndNullIsIgnored() {
        assertThat(SchemeService.moreRestrictive(Visibility.PUBLIC, Visibility.PRIVATE)).isEqualTo(Visibility.PRIVATE);
        assertThat(SchemeService.moreRestrictive(Visibility.FOLLOWERS, Visibility.PUBLIC)).isEqualTo(Visibility.FOLLOWERS);
        assertThat(SchemeService.moreRestrictive(null, Visibility.PUBLIC)).isEqualTo(Visibility.PUBLIC);
        assertThat(SchemeService.moreRestrictive(Visibility.PRIVATE, null)).isEqualTo(Visibility.PRIVATE);
    }

    @Test
    void feedCursorRoundTripsAndOrders() {
        Instant at = Instant.parse("2026-09-23T12:00:00Z");
        UUID id = UUID.fromString("00000000-0000-0000-0000-000000000005");
        SearchService.Cursor cursor = new SearchService.Cursor(at, id);
        SearchService.Cursor parsed = SearchService.Cursor.parse(cursor.encode());
        assertThat(parsed).isEqualTo(cursor);
        assertThat(parsed.before(at.minusSeconds(1), UUID.randomUUID())).isTrue();
        assertThat(parsed.before(at, UUID.fromString("00000000-0000-0000-0000-000000000001"))).isTrue();
        assertThat(parsed.before(at, UUID.fromString("00000000-0000-0000-0000-000000000009"))).isFalse();
        assertThat(parsed.before(at.plusSeconds(1), id)).isFalse();
        assertThat(SearchService.Cursor.parse(null)).isNull();
        assertThatThrownBy(() -> SearchService.Cursor.parse("nao-e-um-cursor")).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("CURSOR_INVALIDO"));
    }

    private static WardrobeItem piece(String name, String category) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setName(name);
        w.setCategory(category);
        return w;
    }

    /** RF5: um look nunca tem duas peças do mesmo tipo — nem no modo IA, quando o modelo repete o tipo. */
    @Test
    void lookKeepsOnePiecePerType() {
        WardrobeItem blusa = piece("Blusa", "upper_piece"), jaqueta = piece("Jaqueta", "upper_piece");
        WardrobeItem calca = piece("Calça", "lower_piece"), vestido = piece("Vestido", "full_body_piece");
        WardrobeItem tenis = piece("Tênis", "shoes_piece"), bota = piece("Bota", "shoes_piece");
        WardrobeItem bolsa = piece("Bolsa", "accessory_piece"), colar = piece("Colar", "accessory_piece");

        assertThat(LocalSchemeComposer.onePerType(List.of(blusa, jaqueta, calca, tenis, bota, bolsa, colar)))
                .containsExactly(blusa, calca, tenis, bolsa);
        // a peça inteira ocupa cima e baixo
        assertThat(LocalSchemeComposer.onePerType(List.of(vestido, blusa, calca, tenis))).containsExactly(vestido, tenis);
        assertThat(LocalSchemeComposer.onePerType(List.of(calca, vestido, blusa))).containsExactly(calca, blusa);
    }
}
