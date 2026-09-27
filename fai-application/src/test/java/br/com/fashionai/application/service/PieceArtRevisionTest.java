package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** RF11 · arte do card da peça: cada gravação ganha revisão e o editor nunca sobrescreve em silêncio uma versão mais nova. */
class PieceArtRevisionTest {
    @Test
    void firstSaveStartsAtRevisionOneAndDropsBaseRev() {
        @SuppressWarnings("unchecked")
        Map<String, Object> out = (Map<String, Object>) BackgroundStudioService.withRevision(null, Map.of("v", 2, "baseRev", 0, "skin", "atelier"));
        assertThat(out).containsEntry("rev", 1).containsEntry("v", 2).containsEntry("skin", "atelier").doesNotContainKey("baseRev");
    }

    @Test
    void saveOnTopOfTheRevisionItReadIncrements() {
        @SuppressWarnings("unchecked")
        Map<String, Object> out = (Map<String, Object>) BackgroundStudioService.withRevision("{\"v\":2,\"rev\":4}", Map.of("v", 2, "baseRev", 4));
        assertThat(out).containsEntry("rev", 5);
    }

    @Test
    void staleEditorIsRefusedInsteadOfOverwriting() {
        assertThatThrownBy(() -> BackgroundStudioService.withRevision("{\"v\":2,\"rev\":5}", Map.of("v", 2, "baseRev", 4)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void legacyClientsWithoutBaseRevStillSave() {
        @SuppressWarnings("unchecked")
        Map<String, Object> out = (Map<String, Object>) BackgroundStudioService.withRevision("{\"anatomy\":\"BENTO\",\"rev\":2}", Map.of("anatomy", "LEGO"));
        assertThat(out).containsEntry("anatomy", "LEGO").containsEntry("rev", 3);
        assertThat(BackgroundStudioService.withRevision("{}", null)).isNull();
    }
}
