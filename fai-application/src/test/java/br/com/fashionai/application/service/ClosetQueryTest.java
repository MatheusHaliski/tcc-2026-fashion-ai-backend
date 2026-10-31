package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Unidade pura extraída do closet (RF6): sem Spring, repositório nem Guard. */
class ClosetQueryTest {

    static WardrobeItem item(String name, String category, String color, int wear, long createdAt) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setName(name);
        w.setCategory(category);
        w.setSubcategory("t_shirt");
        w.setColor(color);
        w.setWearCount(wear);
        w.markCreatedAt(Instant.ofEpochSecond(createdAt));
        return w;
    }

    static WardrobeService.ClosetFilter filter(String category, String color, String state, String q) {
        return new WardrobeService.ClosetFilter(category, color, null, null, null, state, q, null, 0, 0, null, null);
    }

    static HypeScoreCurrent score(Double s) {
        HypeScoreCurrent h = new HypeScoreCurrent();
        h.setScore(s == null ? null : BigDecimal.valueOf(s));
        return h;
    }

    @Test
    void janelaLimitaTamanhoEPagina() {
        assertThat(ClosetQuery.window(0, 0, 12)).isEqualTo(new ClosetQuery.Window(0, 30, 0, 12));
        assertThat(ClosetQuery.window(-2, 500, 100)).isEqualTo(new ClosetQuery.Window(0, 60, 0, 60));
        assertThat(ClosetQuery.window(2, 5, 12)).isEqualTo(new ClosetQuery.Window(2, 5, 10, 12));
        assertThat(ClosetQuery.window(9, 5, 12)).isEqualTo(new ClosetQuery.Window(9, 5, 12, 12));
        assertThat(ClosetQuery.window(0, 5, 12).hasMore(12)).isTrue();
        assertThat(ClosetQuery.window(2, 5, 12).hasMore(12)).isFalse();
    }

    @Test
    void chaveDeOrdenacaoEDependenciaDoHype() {
        assertThat(ClosetQuery.sortKey(null)).isEqualTo("recent");
        assertThat(ClosetQuery.sortKey("preco")).isEqualTo("price");
        assertThat(ClosetQuery.sortKey("PRECO")).isEqualTo("PRECO");
        assertThat(ClosetQuery.needsHype("rarity", null, null)).isTrue();
        assertThat(ClosetQuery.needsHype("recent", "hot", null)).isTrue();
        assertThat(ClosetQuery.needsHype("recent", " ", "any")).isTrue();
        assertThat(ClosetQuery.needsHype("recent", null, "brand")).isFalse();
        assertThat(ClosetQuery.needsHype("name", null, null)).isFalse();
    }

    @Test
    void faixaMinimaArredondaESemScoreFicaFora() {
        assertThat(ClosetQuery.belowMinimum(score(59.6), 60)).isFalse();
        assertThat(ClosetQuery.belowMinimum(score(59.4), 60)).isTrue();
        assertThat(ClosetQuery.belowMinimum(score(null), 0)).isTrue();
        assertThat(ClosetQuery.belowMinimum(null, 0)).isTrue();
    }

    @Test
    void filtroDeSelo() {
        assertThat(ClosetQuery.keepForSeal("hype", true, false)).isTrue();
        assertThat(ClosetQuery.keepForSeal("hype", false, true)).isFalse();
        assertThat(ClosetQuery.keepForSeal("brand", false, true)).isTrue();
        assertThat(ClosetQuery.keepForSeal("any", false, false)).isFalse();
        assertThat(ClosetQuery.keepForSeal("any", true, false)).isTrue();
        assertThat(ClosetQuery.sealFilter(" Celebrity ")).isEqualTo("brand");
    }

    @Test
    void filtrosDeAtributo() {
        WardrobeItem w = item("Camiseta Lisa", "upper_piece", "white", 0, 1);
        w.setBrandName("Marca X");
        assertThat(ClosetQuery.matches(w, filter(null, null, null, null))).isTrue();
        assertThat(ClosetQuery.matches(w, filter("lower_piece", null, null, null))).isFalse();
        assertThat(ClosetQuery.matches(w, filter(null, "white", null, null))).isTrue();
        assertThat(ClosetQuery.matches(w, filter(null, "blue", null, null))).isFalse();
        assertThat(ClosetQuery.matches(w, filter(null, null, "favoritos", null))).isFalse();
        assertThat(ClosetQuery.matches(w, filter(null, null, null, "marca x"))).isTrue();
        assertThat(ClosetQuery.matches(w, filter(null, null, null, "T_SHIRT"))).isTrue();
        assertThat(ClosetQuery.matches(w, filter(null, null, null, "jaqueta"))).isFalse();
    }

    @Test
    void estrategiasDeOrdenacao() {
        WardrobeItem a = item("beta", "c", "red", 2, 10);
        WardrobeItem b = item("Alfa", "c", "red", 0, 20);
        WardrobeItem c = item("gama", "c", "red", 0, 5);
        List<WardrobeItem> list = new ArrayList<>(List.of(a, b, c));
        LocalDate today = LocalDate.of(2026, 1, 1);
        list.sort(ClosetQuery.order("recent", Map.of(), today));
        assertThat(list).containsExactly(b, a, c);
        list.sort(ClosetQuery.order("desconhecida", Map.of(), today));
        assertThat(list).containsExactly(b, a, c);
        list.sort(ClosetQuery.order("name", Map.of(), today));
        assertThat(list).containsExactly(b, a, c);
        list.sort(ClosetQuery.order("least_worn", Map.of(), today));
        assertThat(list).containsExactly(c, b, a);
        list.sort(ClosetQuery.order("worn", Map.of(), today));
        assertThat(list.get(0)).isEqualTo(a);
        Map<UUID, HypeScoreCurrent> hype = Map.of(a.getId(), score(10.0), c.getId(), score(80.0));
        list.sort(ClosetQuery.order("hype", hype, today));
        assertThat(list).containsExactly(c, a, b);
        list.sort(ClosetQuery.order("hype_asc", hype, today));
        assertThat(list).containsExactly(a, c, b);
    }
}
