package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.TipoLavagem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.TipoLavagemRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PieceWashingTest {
    @Test
    void selectionIsValidatedAndCanBePreservedOrCleared() {
        Kit kit = new Kit();
        ClassificationService service = kit.build(ClassificationService.class);
        TipoLavagem washing = washing();
        kit.dep(TipoLavagemRepository.class).save(washing);
        WardrobeItem piece = new WardrobeItem();

        service.applyWashing(piece, washing.getId(), false);
        assertThat(piece.getTipoLavagem()).isSameAs(washing);
        service.applyWashing(piece, null, false);
        assertThat(piece.getTipoLavagem()).isSameAs(washing);
        assertThatThrownBy(() -> service.applyWashing(piece, UUID.randomUUID(), false))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.details()).containsKey("tipoLavagemId"));
        assertThatThrownBy(() -> service.applyWashing(piece, washing.getId(), true)).isInstanceOf(ApiException.class);
        assertThat(piece.getTipoLavagem()).isSameAs(washing);
        service.applyWashing(piece, null, true);
        assertThat(piece.getTipoLavagem()).isNull();
    }

    @Test
    void ownerCanSaveWashingAndReadItInThePieceView() {
        Kit kit = new Kit();
        TipoLavagem washing = washing();
        kit.dep(TipoLavagemRepository.class).save(washing);
        var owner = Kit.user("ana");
        var piece = Kit.piece(owner, "Camisa", "upper_piece", "shirt", "blue");
        kit.dep(WardrobeItemRepository.class).save(piece);
        var wardrobe = kit.build(WardrobeService.class);
        ReflectionTestUtils.setField(wardrobe, "classification", kit.build(ClassificationService.class));
        Map<String, Object> body = new LinkedHashMap<>(Map.of("name", "Camisa", "category", "upper_piece", "subcategory", "shirt",
                "sex", "UNISSEX", "color", "blue", "material", "COTTON", "size", "m", "occasion", List.of("casual"),
                "style", List.of("basic"), "price", 100));
        body.put("tipoLavagemId", washing.getId());
        var form = Json.read(Json.write(body), PieceForm.class);

        var result = wardrobe.update(Kit.as(owner), piece.getId(), form);

        assertThat(result.tipoLavagem().id()).isEqualTo(washing.getId());
        assertThat(piece.getTipoLavagem()).isSameAs(washing);

        body.remove("tipoLavagemId");
        body.put("clearTipoLavagem", true);
        var clear = Json.read(Json.write(body), PieceForm.class);
        assertThat(wardrobe.update(Kit.as(owner), piece.getId(), clear).tipoLavagem()).isNull();
        assertThat(piece.getTipoLavagem()).isNull();
    }

    @Test
    void legacyTaxonomyKeepsWashingFields() {
        UUID id = UUID.randomUUID();
        var form = Json.read(Json.write(Map.of("subcategory", "bermuda_shorts", "tipoLavagemId", id)), PieceForm.class);
        assertThat(PieceTaxonomyWriter.resolveLegacy(form).tipoLavagemId()).isEqualTo(id);
    }

    private static TipoLavagem washing() {
        TipoLavagem washing = new TipoLavagem();
        washing.assignId(UUID.randomUUID());
        washing.setCodigo("MANUAL");
        washing.setNome("Lavar à mão");
        return washing;
    }
}
