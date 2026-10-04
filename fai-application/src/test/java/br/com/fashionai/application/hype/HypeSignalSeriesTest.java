package br.com.fashionai.application.hype;

import br.com.fashionai.domain.model.HypeSignalDaily;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class HypeSignalSeriesTest {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private final LocalDate today = LocalDate.of(2026, 10, 4);

    static HypeSignalDaily row(UUID id, HypeSignalType t, LocalDate day, int count, double weighted) {
        HypeSignalDaily r = new HypeSignalDaily();
        r.setEntityType(HypeEntityType.PIECE);
        r.setEntityId(id);
        r.setSignalType(t);
        r.setSignalDate(day);
        r.setEventCount(count);
        r.setWeightedCount(BigDecimal.valueOf(weighted));
        return r;
    }

    @Test
    void buildsDailySeriesWindowsAndAppliesSignalWeights() {
        UUID id = UUID.randomUUID();
        List<HypeSignalDaily> rows = List.of(
                row(id, HypeSignalType.LIKE_CREATED, today, 3, 3),
                row(id, HypeSignalType.SHARE_CREATED, today.minusDays(1), 1, 1),
                row(id, HypeSignalType.SAVE_CREATED, today.minusDays(8), 2, 1),          // conta nova: peso 0,5 cada
                row(id, HypeSignalType.PIECE_VIEWED, today.minusDays(2), 40, 40),
                row(id, HypeSignalType.LIKE_CREATED, today.minusDays(200), 9, 9));       // fora do horizonte
        HypeSignalSeries s = HypeSignalSeries.build(rows, today, config).get(id);
        assertThat(s.activity()).hasSize(config.horizonDays());
        assertThat(s.activity()[0]).isEqualTo(3.0);                 // 3 curtidas × peso 1
        assertThat(s.activity()[1]).isEqualTo(3.0);                 // 1 compartilhamento × peso 3
        assertThat(s.activity()[8]).isEqualTo(2.0);                 // ponderado 1 × peso 2 (save)
        assertThat(s.activity()[2]).isEqualTo(4.0);                 // 40 visualizações × 0,1
        assertThat(s.views()[2]).isEqualTo(40.0);
        assertThat(s.interactions()[2]).isZero();                   // visualização não é interação
        assertThat(s.windows().get(HypeSignalType.LIKE_CREATED)).containsExactly(3.0, 0.0);
        assertThat(s.windows().get(HypeSignalType.SAVE_CREATED)).containsExactly(0.0, 2.0);
        assertThat(s.totalEvents()).isEqualTo(46.0);
        assertThat(s.daysSinceLastActivity()).isZero();
    }

    @Test
    void entitiesWithoutRowsAreAbsent() {
        Map<UUID, HypeSignalSeries> m = HypeSignalSeries.build(List.of(), today, config);
        assertThat(m).isEmpty();
        assertThat(HypeSignalSeries.empty(84).totalEvents()).isZero();
    }
}
