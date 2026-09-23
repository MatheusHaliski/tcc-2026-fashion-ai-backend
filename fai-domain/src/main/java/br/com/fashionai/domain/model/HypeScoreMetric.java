package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.HypeScoreBand;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(
        name = "hype_score_metrics",
        uniqueConstraints = @UniqueConstraint(name = "uq_hype_score_metrics_daily_look", columnNames = "daily_look_id")
)
public class HypeScoreMetric extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "daily_look_id", nullable = false)
    private DailyLook dailyLook;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scheme_id", nullable = false)
    private Scheme scheme;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "score_date", nullable = false)
    private LocalDate scoreDate;

    @Column(name = "likes_count", nullable = false)
    private long likesCount;

    @Column(name = "comments_count", nullable = false)
    private long commentsCount;

    @Column(name = "shares_count", nullable = false)
    private long sharesCount;

    @Column(name = "remixes_count", nullable = false)
    private long remixesCount;

    @Column(name = "engagement_raw", precision = 12, scale = 4)
    private BigDecimal engagementRaw;

    @Column(name = "engagement_norm", precision = 6, scale = 2)
    private BigDecimal engagementNorm;

    @Column(name = "trend_raw", precision = 12, scale = 6)
    private BigDecimal trendRaw;

    @Column(name = "trend_norm", precision = 6, scale = 2)
    private BigDecimal trendNorm;

    @Column(name = "hype_score", precision = 6, scale = 2)
    private BigDecimal hypeScore;

    @Column(name = "global_hype_score", precision = 6, scale = 2)
    private BigDecimal globalHypeScore;

    @Column(name = "weekly_top_percent", precision = 6, scale = 2)
    private BigDecimal weeklyTopPercent;

    @Enumerated(EnumType.STRING)
    @Column(name = "band", length = 40)
    private HypeScoreBand band;

    @Column(name = "trendsetter_seal", nullable = false)
    private boolean trendsetterSeal;

    @Column(name = "style_match_seal", nullable = false)
    private boolean styleMatchSeal;

    @Column(name = "ai_suggestion", length = 1024)
    private String aiSuggestion;

    @Column(name = "breakdown_json", columnDefinition = "json")
    private String breakdownJson;

    @Column(name = "calibration_window_days", nullable = false)
    private int calibrationWindowDays = 90;

    @Column(name = "trend_window_days", nullable = false)
    private int trendWindowDays = 30;

    @Column(name = "weekly_window_days", nullable = false)
    private int weeklyWindowDays = 7;

}
