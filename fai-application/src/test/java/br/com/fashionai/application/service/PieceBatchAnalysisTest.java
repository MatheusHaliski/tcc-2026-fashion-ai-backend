package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

class PieceBatchAnalysisTest {
    @Test
    void rejectsEmptyAndOversizedBatches() {
        WardrobeService service = mock(WardrobeService.class, CALLS_REAL_METHODS);
        assertThatThrownBy(() -> service.analyzeBatch(null, null, null))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("SEM_FOTOS"));
        assertThatThrownBy(() -> service.analyzeBatch(null, Collections.nCopies(13, new byte[0]), null))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("LOTE_GRANDE"));
    }

    @Test
    void continuesAfterRejectedPhotoInTheOriginalOrder() {
        WardrobeService service = mock(WardrobeService.class, CALLS_REAL_METHODS);
        CurrentUser user = mock(CurrentUser.class);
        byte[] first = {1};
        byte[] second = {2};
        WardrobeService.Draft accepted = WardrobeService.Draft.rejected(new PhotoRejectedException("accepted", List.of(), "upper_piece"));
        doThrow(new PhotoRejectedException("recusada", List.of(), "upper_piece"))
                .when(service).analyze(user, first, "upper_piece");
        doReturn(accepted).when(service).analyze(user, second, "upper_piece");

        List<WardrobeService.Draft> result = service.analyzeBatch(user, List.of(first, second), "upper_piece");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).rejection()).containsEntry("message", "recusada");
        assertThat(result.get(1)).isSameAs(accepted);
    }
}
