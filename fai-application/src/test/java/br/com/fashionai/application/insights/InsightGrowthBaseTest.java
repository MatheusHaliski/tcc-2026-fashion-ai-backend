package br.com.fashionai.application.insights;

import br.com.fashionai.domain.model.HypeScoreCurrent;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InsightGrowthBaseTest {
    private static HypeScoreCurrent row(double current, double previous) {
        HypeScoreCurrent c = mock(HypeScoreCurrent.class);
        when(c.getSignalsJson()).thenReturn("{\"windowCurrent\":" + current + ",\"windowPrevious\":" + previous + "}");
        return c;
    }

    @Test
    void semBaseNoPeriodoAnteriorNaoHaCrescimentoEmPorcentagem() {
        List<HypeScoreCurrent> rows = List.of(row(9, 0), row(8, 0.5));
        assertThat(InsightMath.growthBy(rows, c -> List.of("upper_piece"), 7, 7, 0.5, 2, 3)).isEmpty();
    }

    @Test
    void comBaseOCrescimentoContinuaSendoCalculado() {
        List<HypeScoreCurrent> rows = List.of(row(6, 3), row(6, 3));
        List<InsightMath.Growth> growth = InsightMath.growthBy(rows, c -> List.of("upper_piece"), 7, 7, 0.5, 2, 3);
        assertThat(growth).hasSize(1);
        assertThat(growth.get(0).percent()).isBetween(90.0, 100.0);
    }
}
