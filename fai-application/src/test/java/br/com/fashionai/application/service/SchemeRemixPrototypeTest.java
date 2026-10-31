package br.com.fashionai.application.service;

import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Unidade pura do remix (Prototype): similaridade, limiar, peça sem repetição, empate e rascunho sem identidade. */
class SchemeRemixPrototypeTest {
    private final User bia = Kit.user("bia");
    private final User ana = Kit.user("ana");

    @Test
    void similaridadeSomaSubcategoriaOuCategoriaComCorOuFamilia() {
        WardrobeItem ref = Kit.piece(bia, "ref", "upper_piece", "polo", "white");
        assertThat(SchemeRemixPrototype.similarity(Kit.piece(ana, "a", "upper_piece", "polo", "white"), ref)).isEqualTo(1.5);
        assertThat(SchemeRemixPrototype.similarity(Kit.piece(ana, "b", "upper_piece", "polo", "ivory"), ref)).isEqualTo(1.25);
        assertThat(SchemeRemixPrototype.similarity(Kit.piece(ana, "c", "upper_piece", "tank_top", "white"), ref)).isEqualTo(1.0);
        assertThat(SchemeRemixPrototype.similarity(Kit.piece(ana, "d", "upper_piece", "tank_top", "cream"), ref)).isEqualTo(0.75);
        assertThat(SchemeRemixPrototype.similarity(Kit.piece(ana, "e", "lower_piece", "jeans", "red"), ref)).isEqualTo(0.0);
    }

    @Test
    void abaixoDoLimiarViraFaltanteEPecaUsadaNaoRepete() {
        Scheme look = Kit.look(bia, "Origem");
        SchemeItem s1 = Kit.slot(look, Kit.piece(bia, "t1", "shoes_piece", "casual_sneakers", "white"), SchemeSlot.SHOES, 0);
        SchemeItem s2 = Kit.slot(look, Kit.piece(bia, "t2", "shoes_piece", "casual_sneakers", "black"), SchemeSlot.ACCESSORY, 1);
        SchemeItem s3 = Kit.slot(look, Kit.piece(bia, "s", "lower_piece", "shorts", "navy"), SchemeSlot.BOTTOM, 2);
        WardrobeItem mine = Kit.piece(ana, "m", "shoes_piece", "casual_sneakers", "red");
        WardrobeItem skirt = Kit.piece(ana, "k", "lower_piece", "skirt", "blue");

        SchemeRemixPrototype.PieceMapping m = SchemeRemixPrototype.mapPieces(List.of(s1, s2, s3), List.of(skirt, mine), false);

        assertThat(m.items()).extracting(SchemeService.ItemForm::wardrobeItemId).containsExactly(mine.getId());
        assertThat(m.items().get(0).slot()).isEqualTo(SchemeSlot.SHOES);
        assertThat(m.missing()).extracting(x -> ((Views.PieceRow) x.get("sourcePiece")).id())
                .containsExactly(s2.getWardrobeItem().getId(), s3.getWardrobeItem().getId());
    }

    @Test
    void empateFicaComOPrimeiroCandidatoEDonoMantemAsPecas() {
        Scheme look = Kit.look(bia, "Origem");
        SchemeItem s1 = Kit.slot(look, Kit.piece(bia, "p", "upper_piece", "polo", "white"), SchemeSlot.TOP, 0);
        WardrobeItem first = Kit.piece(ana, "x", "upper_piece", "polo", "black");
        WardrobeItem second = Kit.piece(ana, "y", "upper_piece", "polo", "red");

        assertThat(SchemeRemixPrototype.mapPieces(List.of(s1), List.of(first, second), false).items())
                .extracting(SchemeService.ItemForm::wardrobeItemId).containsExactly(first.getId());
        assertThat(SchemeRemixPrototype.mapPieces(List.of(s1), List.of(), true).items())
                .extracting(SchemeService.ItemForm::wardrobeItemId).containsExactly(s1.getWardrobeItem().getId());
    }

    @Test
    void rascunhoMarcaOrigemSemCopiarIdentidade() {
        Scheme src = Kit.look(bia, "Origem");
        src.setTags("praia");
        Map<String, Object> p = SchemeRemixPrototype.prefill(src, List.of());
        assertThat(p).containsEntry("remixedFromId", src.getId()).containsEntry("origin", SchemeOrigin.REMIX)
                .containsEntry("items", List.of()).doesNotContainKeys("id", "visibility", "status", "tags", "seals");
    }
}
