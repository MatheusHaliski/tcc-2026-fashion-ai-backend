package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/**
 * P3-16 — painel do Look do Dia só em v2: o número de todas as versões visuais é o v2 do look, "sem dados" chega como
 * status (nunca 0), a dica sempre existe e parte das dimensões v2, e o GET não grava nada (o cálculo v1, as colunas
 * {@code hype_score} e a tabela {@code hype_score_metrics} saíram).
 */
class DailyLookPanelV2Test {
    final HypeScoreConfig cfg = HypeScoreConfig.defaults();
    DailyLookRepository dailyLooks;
    HypeScoreCurrentRepository hypeRepo;
    AiEngine ai;
    HypeScoreService service;
    DailyLook today;
    Scheme look;

    @BeforeEach
    void setUp() {
        dailyLooks = mock(DailyLookRepository.class);
        hypeRepo = mock(HypeScoreCurrentRepository.class);
        ai = mock(AiEngine.class);
        service = new HypeScoreService(dailyLooks, ai, hypeRepo, cfg);
        User u = new User("ana", "Ana", "ana@x.com", "h", "p", ProfileType.PESSOAL);
        u.assignId(UUID.randomUUID());
        look = new Scheme();
        look.assignId(UUID.randomUUID());
        look.setUser(u);
        look.setTitle("Look de hoje");
        today = new DailyLook();
        today.assignId(UUID.randomUUID());
        today.setUser(u);
        today.setScheme(look);
        today.setLookDate(LocalDate.of(2026, 10, 5));
        when(dailyLooks.findFirstByUserIdAndLookDateBeforeOrderByLookDateDesc(any(), any())).thenReturn(Optional.empty());
    }

    private void v2(HypeStatus status, Double score, HypeLevel level, Double engagement, Double trend) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(HypeEntityType.SCHEME);
        c.setEntityId(look.getId());
        c.setAlgorithmVersion(cfg.algorithmVersion());
        c.setStatus(status);
        c.setScore(score == null ? null : BigDecimal.valueOf(score));
        c.setLevel(level);
        c.getDimensions().setEngagement(engagement == null ? null : BigDecimal.valueOf(engagement));
        c.getDimensions().setTrend(trend == null ? null : BigDecimal.valueOf(trend));
        c.setCalculatedAt(Instant.now());
        when(hypeRepo.findByEntityTypeAndEntityIdAndAlgorithmVersion(eq(HypeEntityType.SCHEME), eq(look.getId()), eq(cfg.algorithmVersion())))
                .thenReturn(Optional.of(c));
    }

    @Test
    @SuppressWarnings("unchecked")
    void panelShowsOnlyV2AndUnlocksTheMagazineCoverFromTrending() {
        v2(HypeStatus.AVAILABLE, 82.0, HypeLevel.TRENDING, 70.0, 88.0);

        Map<String, Object> panel = service.panel(today, false);

        assertThat((Map<String, Object>) panel.get("v2")).containsEntry("status", "AVAILABLE").containsEntry("score", 82.0).containsEntry("level", "TRENDING");
        assertThat((Map<String, Object>) panel.get("magazineCover")).containsEntry("unlocked", true);
        assertThat(panel.get("tip")).isInstanceOf(String.class);
        // nenhum campo do v1 (faixas de juízo, Top X% semanal, E_norm/T_norm, fórmula 0,65/0,35)
        assertThat(panel).doesNotContainKeys("hypeScore", "band", "bands", "engagement", "trend", "weeklyTopPercent",
                "weeklyRankingText", "globalHypeScore", "hypeGroupId", "formula", "calibratedAt", "seals");
        verifyNoInteractions(ai);
    }

    @Test
    @SuppressWarnings("unchecked")
    void withoutV2TheNumberIsAStatusNeverZeroAndTheTipStillExists() {
        Map<String, Object> notCalculated = service.panel(today, false);
        assertThat((Map<String, Object>) notCalculated.get("v2")).containsEntry("status", "NOT_CALCULATED").containsEntry("score", null);
        assertThat((Map<String, Object>) notCalculated.get("magazineCover")).containsEntry("unlocked", false);
        assertThat(notCalculated.get("tip")).isInstanceOf(String.class);

        v2(HypeStatus.INSUFFICIENT_DATA, null, null, null, null);
        Map<String, Object> insufficient = service.panel(today, false);
        assertThat((Map<String, Object>) insufficient.get("v2")).containsEntry("status", "INSUFFICIENT_DATA").containsEntry("score", null).containsEntry("level", null);
    }

    @Test
    void lowV2TrendPointsTheTipAtTrendsAndNeutralDimensionsDoNot() {
        v2(HypeStatus.AVAILABLE, 30.0, HypeLevel.NICHE, 60.0, 20.0);
        String lowTrend = (String) service.panel(today, false).get("tip");
        assertThat(lowTrend).isEqualTo(HypeScoreService.localTip(look, Map.of("ENGAGEMENT", 60.0, "TREND", 20.0)));
        // dimensão sem base = neutra (50), nunca 0: não vira "fora das tendências"
        assertThat(HypeScoreService.localTip(look, Map.of())).isNotEqualTo(lowTrend);
    }

    @Test
    void panelOnlyReadsItNeverWrites() {
        v2(HypeStatus.AVAILABLE, 64.0, HypeLevel.HOT, 50.0, 50.0);
        service.panel(today, false);
        verify(hypeRepo).findByEntityTypeAndEntityIdAndAlgorithmVersion(HypeEntityType.SCHEME, look.getId(), cfg.algorithmVersion());
        verifyNoMoreInteractions(hypeRepo);
        verify(dailyLooks).findFirstByUserIdAndLookDateBeforeOrderByLookDateDesc(today.getUser().getId(), today.getLookDate());
        verifyNoMoreInteractions(dailyLooks);
    }
}
