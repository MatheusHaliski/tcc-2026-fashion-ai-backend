package br.com.fashionai.application.view;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.EstadoConservacao;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.TipoLavagem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ItemCondition;
import br.com.fashionai.domain.model.enums.ProfileType;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class PieceReferenceViewsTest {
    @Test
    void fullAndCompactViewsExposeReferencesAlongsideLegacyFields() {
        WardrobeItem piece = piece();
        Views.PieceView full = Views.piece(piece, Views.ViewerState.NONE, Map.of());
        assertThat(full.condition()).isEqualTo("WORN");
        assertThat(full.careInstructions()).isEqualTo(piece.getCareInstructions());
        assertReferences(full.estadoConservacao(), full.tipoLavagem(), piece);

        SchemeItem item = new SchemeItem();
        item.setWardrobeItem(piece);
        Views.PieceRow row = Views.row(item);
        assertThat(row.condition()).isEqualTo(full.condition());
        assertThat(row.careInstructions()).isEqualTo(full.careInstructions());
        assertReferences(row.estadoConservacao(), row.tipoLavagem(), piece);
        assertThat(Json.map(Json.write(full)).get("estadoConservacao"))
                .isEqualTo(Map.of("id", piece.getEstadoConservacao().getId().toString(), "codigo", "SEMINOVA", "nome", "Sem marcas de uso"));
    }

    @Test
    void snapshotsPreserveReferencesAndCareAfterTheOriginalPieceDisappears() {
        WardrobeItem piece = piece();
        SchemeItem item = new SchemeItem();
        item.setSnapshotJson(Json.write(Views.snapshot(piece)));
        Views.PieceRow deleted = Views.row(item);
        assertThat(deleted.notAvailableAnymore()).isTrue();
        assertThat(deleted.condition()).isEqualTo("WORN");
        assertThat(deleted.careInstructions()).isEqualTo(piece.getCareInstructions());
        assertReferences(deleted.estadoConservacao(), deleted.tipoLavagem(), piece);

        piece.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        piece.getEstadoConservacao().setNome("Nome posterior");
        item.setWardrobeItem(piece);
        assertThat(Views.row(item).estadoConservacao().nome()).isEqualTo("Sem marcas de uso");
    }

    @Test
    void oldSnapshotsAndLegacyOnlyPiecesDoNotInventReferences() {
        WardrobeItem piece = piece();
        piece.setEstadoConservacao(null);
        piece.setTipoLavagem(null);
        Views.PieceView full = Views.piece(piece, null, null);
        assertThat(full.estadoConservacao()).isNull();
        assertThat(full.tipoLavagem()).isNull();
        assertThat(full.condition()).isEqualTo("WORN");
        assertThat(full.careInstructions()).isEqualTo(piece.getCareInstructions());

        SchemeItem item = new SchemeItem();
        item.setSnapshotJson("{\"name\":\"Peça antiga\",\"condition\":\"GOOD\",\"careInstructions\":\"Lavar a frio\"}");
        Views.PieceRow old = Views.row(item);
        assertThat(old.estadoConservacao()).isNull();
        assertThat(old.tipoLavagem()).isNull();
        assertThat(old.condition()).isEqualTo("GOOD");
        assertThat(old.careInstructions()).isEqualTo("Lavar a frio");
    }

    private static void assertReferences(Views.ReferenceOptionView state, Views.ReferenceOptionView washing, WardrobeItem piece) {
        assertThat(state).isEqualTo(new Views.ReferenceOptionView(piece.getEstadoConservacao().getId(), "SEMINOVA", piece.getEstadoConservacao().getNome()));
        assertThat(washing).isEqualTo(new Views.ReferenceOptionView(piece.getTipoLavagem().getId(), "MANUAL", "Lavar à mão"));
    }

    private static WardrobeItem piece() {
        User owner = new User();
        owner.assignId(UUID.randomUUID());
        owner.setProfileType(ProfileType.PESSOAL);
        WardrobeItem piece = new WardrobeItem();
        piece.assignId(UUID.randomUUID());
        piece.setUser(owner);
        piece.setName("Camiseta");
        piece.setColor("white");
        piece.setCondition(ItemCondition.WORN);
        piece.setCareInstructions("Secar à sombra; não alvejar.");
        EstadoConservacao state = new EstadoConservacao();
        state.assignId(UUID.randomUUID());
        state.setCodigo("SEMINOVA");
        state.setNome("Sem marcas de uso");
        piece.setEstadoConservacao(state);
        TipoLavagem washing = new TipoLavagem();
        washing.assignId(UUID.randomUUID());
        washing.setCodigo("MANUAL");
        washing.setNome("Lavar à mão");
        piece.setTipoLavagem(washing);
        return piece;
    }
}
