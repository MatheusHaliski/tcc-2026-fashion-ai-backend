package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Complementa {@link DashboardHypeV2Test} com bordas da unidade pura extraída no lote 16. */
class DashboardHypeBlocksTest {
    static final HypeScoreConfig CFG = HypeScoreConfig.defaults();

    static Map<String, Object> look(String id, String title, double score, Object level, Object pub) {
        Map<String, Object> m = new HashMap<>();
        m.put("scheme_id", id);
        m.put("title", title);
        m.put("status", "AVAILABLE");
        m.put("score", score);
        m.put("level", level);
        m.put("public_eligible", pub);
        return m;
    }

    @Test
    void truthyAndRound1() {
        assertThat(DashboardHypeBlocks.truthy(true)).isTrue();
        assertThat(DashboardHypeBlocks.truthy(1)).isTrue();
        assertThat(DashboardHypeBlocks.truthy(0)).isFalse();
        assertThat(DashboardHypeBlocks.truthy("TRUE")).isTrue();
        assertThat(DashboardHypeBlocks.truthy("yes")).isFalse();
        assertThat(DashboardHypeBlocks.truthy(null)).isFalse();
        assertThat(DashboardHypeBlocks.round1(2.25)).isEqualTo(2.3);
        assertThat(DashboardHypeBlocks.round1(-2.25)).isEqualTo(-2.3);
    }

    @Test
    @SuppressWarnings("unchecked")
    void topIsLimitedSortedByScoreThenTitleAndFillsMissingLevel() {
        Map<String, Object> h = DashboardHypeBlocks.issuerHype(List.of(
                look("1", "B", 70.0, "HOT", 1), look("2", "A", 70.0, "HOT", "true"),
                look("3", "C", 90.04, null, true), look("4", "D", 10.0, "NICHE", true), look("5", "E", 99.0, "VIRAL", 0)), CFG);
        List<Map<String, Object>> top = (List<Map<String, Object>>) h.get("top");
        assertThat(top).hasSize(DashboardHypeBlocks.ISSUER_TOP);
        assertThat(top).extracting(m -> m.get("schemeId")).containsExactly("3", "2", "1");
        assertThat(top.get(0)).containsEntry("score", 90.0).containsEntry("level", CFG.level(90.04).name());
        assertThat(h).containsEntry("notPublic", 1).containsEntry("withHype", 4).containsEntry("deltaPoints", null)
                .containsEntry("direction", null);
    }

    @Test
    void unparseableJobTimestampIsShownRawAndNotJudgedStale() {
        Map<String, Object> job = DashboardHypeBlocks.hypeJob(Map.of("last_calculated_at", "ontem"), CFG, Instant.now());
        assertThat(job).containsEntry("lastCalculatedAt", "ontem").containsEntry("stale", null);
        assertThat(DashboardHypeBlocks.hypeJob(null, CFG, Instant.now())).containsEntry("rows", 0L);
    }
}
