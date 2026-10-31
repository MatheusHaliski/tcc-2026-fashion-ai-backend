package br.com.fashionai.web.controller;

import br.com.fashionai.application.service.SealService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Caracterização (R60a): GET /api/pieces/seals lê ids=a,b,c tolerando ids malformados e para no limite do lote. */
class SealControllerPieceSealsTest {

    static List<Object> idsRepassados() {
        Fk.Call call = Fk.calls.get(Fk.calls.size() - 1);
        assertThat(call.method()).isEqualTo("pieceSeals");
        return List.copyOf((List<?>) call.args()[1]);
    }

    static SealController controller() throws ReflectiveOperationException {
        return (SealController) ControllerDelegacaoTest.controller(SealController.class);
    }

    @Test
    void idsMalformadosSaoIgnoradosEAusenteViraListaVazia() throws Exception {
        SealController seals = controller();
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        Fk.reset();
        seals.pieceSeals(ControllerDelegacaoTest.ADMIN, a + ", x ," + b + ",");
        assertThat(idsRepassados()).containsExactly(a, b);
        Fk.reset();
        seals.pieceSeals(ControllerDelegacaoTest.ADMIN, null);
        assertThat(idsRepassados()).isEmpty();
    }

    @Test
    void loteParaNoLimiteDoServico() throws Exception {
        StringBuilder csv = new StringBuilder();
        for (int i = 0; i < SealService.MAX_PIECE_SEALS + 5; i++) {
            csv.append(UUID.randomUUID()).append(',');
        }
        Fk.reset();
        controller().pieceSeals(ControllerDelegacaoTest.ADMIN, csv.toString());
        assertThat(idsRepassados()).hasSize(SealService.MAX_PIECE_SEALS);
    }
}
