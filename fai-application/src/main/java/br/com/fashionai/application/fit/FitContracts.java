package br.com.fashionai.application.fit;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Wire contracts deliberately exclude owner identifiers and avatar-derived estimates. */
public final class FitContracts {
    private FitContracts() {}
    public enum ChartType { BODY_RANGE, GARMENT_MEASUREMENT }
    public enum Preference { SLIM, REGULAR, LOOSE }
    public enum Protocol { BODY_CIRCUMFERENCE_V1, GARMENT_CIRCUMFERENCE_V1, GARMENT_FLAT_WIDTH_V1, BODY_LENGTH_V1, GARMENT_LENGTH_V1 }
    public enum Region { CHEST, WAIST, HIP, THIGH, INSEAM }
    public enum Status { RECOMMENDED, AMBIGUOUS, NO_CHART, CHART_EXPIRED, INCOMPATIBLE_CHART, INSUFFICIENT_MEASUREMENTS, INCOMPATIBLE_PROTOCOL, NO_COMPATIBLE_SIZE }
    public enum Reason { WITHIN_RANGE, TIGHT, LOOSE, MISSING_MEASUREMENT, INCOMPATIBLE_PROTOCOL, MISSING_EASE_RULE }
    public enum Rating { TIGHT, COMFORTABLE, LOOSE }
    public record Range(Double min, Double max) {}
    public record Dimension(Region region, Protocol protocol, Double min, Double max, Map<Preference, Range> easeByPreference) {}
    public record SizeOption(String label, int order, List<Dimension> measurements) {}
    public record ChartData(ChartType type, String family, String market, String sourceName, String sourceUrl,
                            String sourceRevision, Instant sourceDate, Instant validUntil, boolean sourceAuthorized,
                            List<SizeOption> options) {}
    public record ChartWrite(Long expectedVersion, ChartData chart) {}
    public record ChartView(UUID productId, long version, int revision, ChartData chart, boolean canEdit) {}
    public record Measurement(Region region, Protocol protocol, Double value, String unit) {}
    public record ProfileWrite(Long expectedVersion, Instant measuredAt, List<Measurement> measurements) {}
    public record ProfileView(long version, Instant measuredAt, String source, List<Measurement> measurements) {}
    public record Recommend(Preference preference, String requestKey) {}
    public record RegionReason(Region region, Reason reason, Protocol chartProtocol, Protocol inputProtocol) {}
    public record Candidate(String sizeLabel, int order, boolean compatible, List<RegionReason> regions) {}
    public record Result(Status status, String recommendedSize, List<Candidate> candidates, Preference preference,
                         boolean preferenceApplied, String preferenceExplanation, String rulesVersion,
                         Integer chartRevision, Long profileVersion, String sourceName, String sourceRevision,
                         Instant sourceDate, Instant expiresAt, String qualitativeEvidence, List<MissingInformation> missingInformation) {}
    public record MissingInformation(Region region, Reason reason, Protocol requiredProtocol) {}
    public record FeedbackInsight(String sizeLabel, Map<Region, Rating> regions, Instant recordedAt, int chartRevision, String explanation) {}
    public record RecommendationView(UUID id, UUID productId, Result result, boolean stale, List<FeedbackView> feedback, List<FeedbackInsight> priorExperience) {}
    public record FeedbackWrite(String experienceKey, String triedSize, Map<Region, Rating> regions) {}
    public record FeedbackView(UUID id, String triedSize, Map<Region, Rating> regions, String source, long version) {}
}
