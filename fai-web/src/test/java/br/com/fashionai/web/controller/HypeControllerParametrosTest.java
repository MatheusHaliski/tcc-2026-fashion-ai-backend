package br.com.fashionai.web.controller;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Parâmetros do Hype: sinônimos do tipo (peça/look) e lista de ids tolerante a ids malformados. */
class HypeControllerParametrosTest {

    @Test
    void tipoAceitaSinonimosEmQualquerCaixa() {
        for (String t : new String[]{"piece", " PIECES ", "peca", "PECAS"}) {
            assertThat(HypeController.type(t)).isEqualTo(HypeEntityType.PIECE);
        }
        for (String t : new String[]{"scheme", "Schemes", "look", "LOOKS"}) {
            assertThat(HypeController.type(t)).isEqualTo(HypeEntityType.SCHEME);
        }
    }

    @Test
    void tipoDesconhecidoOuAusenteEh400() {
        assertThatThrownBy(() -> HypeController.type(null)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.code()).isEqualTo("TIPO_INVALIDO"));
        assertThatThrownBy(() -> HypeController.type("brand")).isInstanceOf(ApiException.class);
    }

    @Test
    void idsIgnoraMalformadosENuloViraVazio() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        assertThat(HypeController.ids(null)).isEmpty();
        assertThat(HypeController.ids(a + ", x ," + b)).containsExactly(a, b);
    }

    @Test
    void idsParaNoLimiteDoLote() {
        StringBuilder csv = new StringBuilder();
        for (int i = 0; i < br.com.fashionai.application.hype.HypeQueryService.MAX_BATCH + 5; i++) {
            csv.append(UUID.randomUUID()).append(',');
        }
        assertThat(HypeController.ids(csv.toString())).hasSize(br.com.fashionai.application.hype.HypeQueryService.MAX_BATCH);
    }
}
