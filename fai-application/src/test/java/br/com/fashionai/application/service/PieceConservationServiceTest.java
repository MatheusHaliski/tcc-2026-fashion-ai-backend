package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.EstadoConservacao;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ItemCondition;
import br.com.fashionai.domain.repository.EstadoConservacaoRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PieceConservationServiceTest {
    @ParameterizedTest
    @ValueSource(strings = {"NOVA", "EXCELENTE", "BOA", "DESGASTADA", "DANIFICADA"})
    void savesEveryActiveChoiceAndReadsItThroughThePieceDto(String code) {
        Kit kit = new Kit();
        EstadoConservacao state = state(code);
        kit.dep(EstadoConservacaoRepository.class).save(state);
        var service = kit.build(PieceConservationService.class);
        WardrobeItem piece = Kit.piece(Kit.user("ana"), "Camisa", "upper_piece", "shirt", "blue");
        service.apply(piece, state.getId(), false);
        assertThat(Views.piece(piece, null, null).estadoConservacao().codigo()).isEqualTo(code);
        assertThat(Views.piece(piece, null, null).estadoConservacao().id()).isEqualTo(state.getId());
    }

    @Test
    void rejectsMissingInactiveAndConflictingChoicesWithoutChangingThePiece() {
        Kit kit = new Kit();
        var service = kit.build(PieceConservationService.class);
        var piece = new WardrobeItem();
        var inactive = state("BOA");
        inactive.setAtivo(false);
        kit.dep(EstadoConservacaoRepository.class).save(inactive);
        for (UUID id : new UUID[]{UUID.randomUUID(), inactive.getId()}) {
            assertThatThrownBy(() -> service.apply(piece, id, false)).isInstanceOfSatisfying(ApiException.class,
                    e -> { assertThat(e.status()).isEqualTo(400); assertThat(e.details()).containsKey("estadoConservacaoId"); });
        }
        assertThatThrownBy(() -> service.apply(piece, inactive.getId(), true)).isInstanceOf(ApiException.class);
        assertThat(piece.getEstadoConservacao()).isNull();
    }

    @Test
    void absentChoiceNeverBackfillsGoodAndExplicitClearDoesNotExposeAnOldEnum() {
        var service = new PieceConservationService(mock(EstadoConservacaoRepository.class));
        var piece = new WardrobeItem();
        piece.setCondition(ItemCondition.GOOD);
        service.apply(piece, null, false);
        assertThat(piece.getEstadoConservacao()).isNull();
        assertThat(piece.getCondition()).isEqualTo(ItemCondition.GOOD);
        piece.setEstadoConservacao(state("EXCELENTE"));
        service.apply(piece, null, false);
        assertThat(piece.getEstadoConservacao().getCodigo()).isEqualTo("EXCELENTE");
        service.apply(piece, null, true);
        assertThat(piece.getEstadoConservacao()).isNull();
        assertThat(piece.getCondition()).isNull();
    }

    @Test
    void otherUsersCannotReachTheConservationMutation() {
        Kit kit = new Kit();
        Guard guard = kit.dep(Guard.class);
        doCallRealMethod().when(guard).requireOwner(any(), any(), anyString());
        when(guard.deny(any(), anyString(), anyString())).thenReturn(ApiException.forbidden("Owner only"));
        User owner = Kit.user("owner");
        User visitor = Kit.user("visitor");
        WardrobeItem piece = Kit.piece(owner, "Camisa", "upper_piece", "shirt", "blue");
        kit.dep(WardrobeItemRepository.class).save(piece);
        WardrobeService wardrobe = kit.build(WardrobeService.class);
        PieceConservationService conservation = mock(PieceConservationService.class);
        wardrobe.setConservation(conservation);
        var form = Json.read(Json.write(Map.of("estadoConservacaoId", UUID.randomUUID())), WardrobeService.PieceForm.class);
        assertThatThrownBy(() -> wardrobe.update(Kit.as(visitor), piece.getId(), form))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        verifyNoInteractions(conservation);
        assertThat(piece.getEstadoConservacao()).isNull();
    }

    @Test
    void ownerUpdateReturnsAndPersistsTheExplicitFk() {
        Kit kit = new Kit();
        var state = state("EXCELENTE");
        kit.dep(EstadoConservacaoRepository.class).save(state);
        var owner = Kit.user("ana");
        var piece = Kit.piece(owner, "Camisa", "upper_piece", "shirt", "blue");
        kit.dep(WardrobeItemRepository.class).save(piece);
        var wardrobe = kit.build(WardrobeService.class);
        wardrobe.setConservation(kit.build(PieceConservationService.class));
        var body = new java.util.LinkedHashMap<String, Object>();
        body.putAll(Map.of("name", "Camisa", "category", "upper_piece", "subcategory", "shirt", "sex", "UNISSEX",
                "color", "blue", "material", "COTTON", "size", "m", "occasion", java.util.List.of("casual"),
                "style", java.util.List.of("basic"), "price", 100));
        body.put("estadoConservacaoId", state.getId());
        var result = wardrobe.update(Kit.as(owner), piece.getId(), Json.read(Json.write(body), WardrobeService.PieceForm.class));
        assertThat(result.estadoConservacao().id()).isEqualTo(state.getId());
        assertThat(kit.dep(WardrobeItemRepository.class).findById(piece.getId()).orElseThrow().getEstadoConservacao()).isSameAs(state);
    }

    private static EstadoConservacao state(String code) {
        var state = new EstadoConservacao();
        state.assignId(UUID.randomUUID());
        state.setCodigo(code);
        state.setNome(code);
        return state;
    }
}
