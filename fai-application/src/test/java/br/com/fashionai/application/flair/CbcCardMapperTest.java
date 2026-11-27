package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização do mapeamento carta FLAIR → carta do motor (extraído de {@code FlairChallengeService.models}): tags
 * do retrato ou da peça, Hype numérico do retrato, "entrou em" = menor entre cadastro e compra, última vez usada.
 */
class CbcCardMapperTest {
    static final Instant CREATED = Instant.parse("2026-09-01T00:00:00Z");
    static final Function<WardrobeItem, Map<String, Object>> TAGS_OF = w -> {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("styles", w == null ? List.of() : Json.csv(w.getStyleTags()));
        t.put("colors", w == null || w.getColor() == null ? List.of() : List.of(w.getColor()));
        t.put("occasions", w == null ? List.of() : Json.csv(w.getOccasionTags()));
        t.put("materials", w == null || w.getMaterial() == null ? List.of() : List.of(w.getMaterial().toLowerCase()));
        return t;
    };

    final User ana = Kit.user("ana");

    WardrobeItem piece(String color) {
        WardrobeItem w = Kit.piece(ana, "peça " + color, "upper_piece", "t_shirt", color);
        w.markCreatedAt(CREATED);
        w.setStyleTags("edgy,grunge");
        w.setOccasionTags("night");
        w.setMaterial("Leather");
        w.setLastWornDate(LocalDate.of(2026, 10, 20));
        return w;
    }

    FlairCardInstance card(String originType, UUID originId, String tagsJson, String hypeJson) {
        FlairCardInstance c = new FlairCardInstance();
        c.assignId(UUID.randomUUID());
        c.setOwnerId(ana.getId());
        c.setOriginType(originType);
        c.setOriginId(originId);
        c.setSeason("SPRING");
        c.setTier("OURO");
        c.setOvr(81);
        c.setPosition("SUP");
        c.setName("Jaqueta");
        c.setBrandName("Norte");
        c.setCategory("upper_piece");
        c.setSubcategory("jacket");
        c.setTagsJson(tagsJson);
        c.setHypeJson(hypeJson);
        return c;
    }

    @Test
    void cartaComRetratoUsaAsTagsDoRetratoEOsNumerosDeHype() {
        WardrobeItem w = piece("black");
        FlairCardInstance c = card("PIECE", w.getId(), "{\"styles\":[\"romantic\"],\"colors\":[\"pink\"],\"occasions\":[\"party\"],\"materials\":[\"silk\"]}",
                "{\"HYP\":72.4,\"POP\":10,\"note\":\"x\"}");

        CbcRules.Card m = CbcCardMapper.model(c, w, TAGS_OF);

        assertThat(m.id()).isEqualTo(c.getId());
        assertThat(m.position()).isEqualTo("SUP");
        assertThat(m.tier()).isEqualTo("OURO");
        assertThat(m.ovr()).isEqualTo(81);
        assertThat(m.brand()).isEqualTo("Norte");
        assertThat(m.originType()).isEqualTo("PIECE");
        assertThat(m.styles()).containsExactly("romantic");
        assertThat(m.colors()).containsExactly("pink");
        assertThat(m.occasions()).containsExactly("party");
        assertThat(m.materials()).containsExactly("silk");
        assertThat(m.hype()).containsEntry("HYP", 72.4).containsEntry("POP", 10.0).doesNotContainKey("note");
        assertThat(m.pieceAddedAt()).isEqualTo(CREATED);
        assertThat(m.pieceLastWorn()).isEqualTo(LocalDate.of(2026, 10, 20));
        assertThat(m.category()).isEqualTo("upper_piece");
        assertThat(m.subcategory()).isEqualTo("jacket");
    }

    @Test
    void cartaAntigaSemRetratoCaiNasTagsDaPecaEACompraAnteriorValeComoEntrada() {
        WardrobeItem w = piece("red");
        w.setPurchaseDate(LocalDate.of(2026, 1, 15));
        FlairCardInstance c = card("PIECE", w.getId(), null, null);

        CbcRules.Card m = CbcCardMapper.model(c, w, TAGS_OF);

        assertThat(m.styles()).containsExactlyInAnyOrder("edgy", "grunge");
        assertThat(m.colors()).containsExactly("red");
        assertThat(m.occasions()).containsExactly("night");
        assertThat(m.materials()).containsExactly("leather");
        assertThat(m.hype()).isEmpty();
        assertThat(m.pieceAddedAt()).isEqualTo(Instant.parse("2026-01-15T00:00:00Z"));
    }

    @Test
    void cartaSemPecaVivaNaoTemDatasEModelsPreservaAOrdemEUmaLeituraDasPecas() {
        Kit kit = new Kit();
        WardrobeItem w = kit.save(WardrobeItemRepository.class, piece("black"));
        FlairCardInstance look = card("LOOK", UUID.randomUUID(), "{\"styles\":[\"basic\"]}", null);
        FlairCardInstance removed = card("PIECE", UUID.randomUUID(), "{\"colors\":[\"blue\"]}", null);
        FlairCardInstance alive = card("PIECE", w.getId(), null, null);

        Map<UUID, CbcRules.Card> models = CbcCardMapper.models(List.of(look, removed, alive), kit.dep(WardrobeItemRepository.class), TAGS_OF);

        assertThat(models.keySet()).containsExactly(look.getId(), removed.getId(), alive.getId());
        assertThat(models.get(look.getId()).pieceAddedAt()).isNull();
        assertThat(models.get(look.getId()).pieceLastWorn()).isNull();
        assertThat(models.get(removed.getId()).colors()).containsExactly("blue");
        assertThat(models.get(removed.getId()).pieceAddedAt()).isNull();
        assertThat(models.get(alive.getId()).pieceAddedAt()).isEqualTo(CREATED);
        assertThat(CbcCardMapper.pieces(List.of(look, removed, alive), kit.dep(WardrobeItemRepository.class))).containsOnlyKeys(w.getId());
    }

    @Test
    void stringsAceitaListaOuTextoUnico() {
        assertThat(CbcCardMapper.strings(List.of("a", "b"))).containsExactly("a", "b");
        assertThat(CbcCardMapper.strings("solo")).containsExactly("solo");
        assertThat(CbcCardMapper.strings(" ")).isEmpty();
        assertThat(CbcCardMapper.strings(null)).isEmpty();
    }
}
