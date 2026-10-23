package br.com.fashionai.application.fit;

import static br.com.fashionai.application.fit.FitContracts.*;
import static org.assertj.core.api.Assertions.assertThat;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class FitEngineTest {
    private final FitEngine engine = new FitEngine();
    private final Instant now = Instant.parse("2026-10-22T00:00:00Z");
    private ChartData chart(ChartType type, SizeOption... options) {
        return new ChartData(type, "TSHIRT", "BR", "Reviewed manufacturer", "https://manufacturer.example/chart", "2026-1", now.minusSeconds(86400), now.plusSeconds(86400), true, List.of(options));
    }
    private SizeOption option(String label, int order, Protocol protocol, double min, double max) {
        return new SizeOption(label, order, List.of(new Dimension(Region.CHEST, protocol, min, max, null)));
    }
    private List<Measurement> body(double value) { return List.of(new Measurement(Region.CHEST, Protocol.BODY_CIRCUMFERENCE_V1, value, "CM")); }
    @Test void noChartAbstainsWithoutInventingCandidates() {
        var result = engine.evaluate(null, null, body(95), 0L, Preference.REGULAR, now);
        assertThat(result.status()).isEqualTo(Status.NO_CHART); assertThat(result.recommendedSize()).isNull(); assertThat(result.candidates()).isEmpty();
    }
    @Test void missingMeasurementAbstains() {
        var result = engine.evaluate(chart(ChartType.BODY_RANGE, option("M", 2, Protocol.BODY_CIRCUMFERENCE_V1, 90, 100)), 1, List.of(), null, Preference.REGULAR, now);
        assertThat(result.status()).isEqualTo(Status.INSUFFICIENT_MEASUREMENTS);
        assertThat(result.candidates().getFirst().regions().getFirst().reason()).isEqualTo(Reason.MISSING_MEASUREMENT);
    }
    @Test void usesSourceOrderAndNeverGuessesRegionalLabels() {
        var result = engine.evaluate(chart(ChartType.BODY_RANGE, option("40 EU", 2, Protocol.BODY_CIRCUMFERENCE_V1, 90, 100), option("S US", 1, Protocol.BODY_CIRCUMFERENCE_V1, 80, 89)), 1, body(95), 2L, Preference.LOOSE, now);
        assertThat(result.status()).isEqualTo(Status.RECOMMENDED); assertThat(result.recommendedSize()).isEqualTo("40 EU");
        assertThat(result.candidates()).extracting(Candidate::sizeLabel).containsExactly("S US", "40 EU");
        assertThat(result.preferenceApplied()).isFalse();
    }
    @Test void overlappingRangesDoNotForceARecommendation() {
        var result = engine.evaluate(chart(ChartType.BODY_RANGE, option("M", 1, Protocol.BODY_CIRCUMFERENCE_V1, 90, 100), option("L", 2, Protocol.BODY_CIRCUMFERENCE_V1, 95, 105)), 1, body(98), 0L, Preference.REGULAR, now);
        assertThat(result.status()).isEqualTo(Status.AMBIGUOUS); assertThat(result.recommendedSize()).isNull();
    }
    @Test void flatWidthNeverBecomesBodyCircumference() {
        var result = engine.evaluate(chart(ChartType.GARMENT_MEASUREMENT, option("M", 1, Protocol.GARMENT_FLAT_WIDTH_V1, 48, 50)), 1, body(98), 0L, Preference.REGULAR, now);
        assertThat(result.status()).isEqualTo(Status.INCOMPATIBLE_PROTOCOL); assertThat(result.recommendedSize()).isNull();
    }
    @Test void garmentCanUseMatchingReferenceProtocol() {
        var measurements = List.of(new Measurement(Region.CHEST, Protocol.GARMENT_FLAT_WIDTH_V1, 49d, "CM"));
        var result = engine.evaluate(chart(ChartType.GARMENT_MEASUREMENT, option("M", 1, Protocol.GARMENT_FLAT_WIDTH_V1, 48, 50)), 1, measurements, 0L, Preference.REGULAR, now);
        assertThat(result.status()).isEqualTo(Status.RECOMMENDED); assertThat(result.preferenceApplied()).isFalse();
    }
    @Test void missingEaseRulesAbstainInsteadOfInventingStretch() {
        var result = engine.evaluate(chart(ChartType.GARMENT_MEASUREMENT, option("M", 1, Protocol.GARMENT_CIRCUMFERENCE_V1, 104, 104)), 1, body(98), 0L, Preference.REGULAR, now);
        assertThat(result.status()).isEqualTo(Status.INCOMPATIBLE_PROTOCOL);
        assertThat(result.candidates().getFirst().regions().getFirst().reason()).isEqualTo(Reason.MISSING_EASE_RULE);
    }
    @Test void explicitlyDeclaredEaseUsesPreference() {
        var dimension = new Dimension(Region.CHEST, Protocol.GARMENT_CIRCUMFERENCE_V1, 104d, 104d, Map.of(Preference.REGULAR, new Range(4d, 8d)));
        var result = engine.evaluate(chart(ChartType.GARMENT_MEASUREMENT, new SizeOption("M", 1, List.of(dimension))), 2, body(98), 4L, Preference.REGULAR, now);
        assertThat(result.status()).isEqualTo(Status.RECOMMENDED); assertThat(result.preferenceApplied()).isTrue();
        assertThat(result.rulesVersion()).isEqualTo(FitEngine.RULES_VERSION);
    }
    @Test void expiredChartDoesNotRecommend() {
        var data = chart(ChartType.BODY_RANGE, option("M", 1, Protocol.BODY_CIRCUMFERENCE_V1, 90, 100));
        assertThat(engine.evaluate(data, 1, body(98), 0L, Preference.REGULAR, now.plusSeconds(86401)).status()).isEqualTo(Status.CHART_EXPIRED);
    }
    @Test void jeansCanExplainTightThighWithoutInventingUnlistedRegions() {
        var dimensions = List.of(new Dimension(Region.WAIST, Protocol.BODY_CIRCUMFERENCE_V1, 78d, 84d, null),
            new Dimension(Region.THIGH, Protocol.BODY_CIRCUMFERENCE_V1, 48d, 54d, null));
        var measurements = List.of(new Measurement(Region.WAIST, Protocol.BODY_CIRCUMFERENCE_V1, 80d, "CM"),
            new Measurement(Region.THIGH, Protocol.BODY_CIRCUMFERENCE_V1, 58d, "CM"));
        var result = engine.evaluate(chart(ChartType.BODY_RANGE, new SizeOption("40", 1, dimensions)), 1, measurements, 0L, Preference.REGULAR, now);
        assertThat(result.status()).isEqualTo(Status.NO_COMPATIBLE_SIZE);
        assertThat(result.candidates().getFirst().regions()).anySatisfy(reason -> {
            assertThat(reason.region()).isEqualTo(Region.THIGH); assertThat(reason.reason()).isEqualTo(Reason.TIGHT);
        });
        assertThat(result.candidates().getFirst().regions()).extracting(RegionReason::region).doesNotContain(Region.INSEAM);
    }
    @Test void lengthUsesOnlyCompatibleLengthProtocolAndReportsMissingInformation() {
        var data = chart(ChartType.BODY_RANGE, new SizeOption("Long", 1, List.of(new Dimension(Region.INSEAM, Protocol.BODY_LENGTH_V1, 76d, 80d, null))));
        var incompatible = List.of(new Measurement(Region.INSEAM, Protocol.GARMENT_LENGTH_V1, 78d, "CM"));
        var result = engine.evaluate(data, 1, incompatible, 0L, Preference.REGULAR, now);
        assertThat(result.status()).isEqualTo(Status.INCOMPATIBLE_PROTOCOL);
        assertThat(result.missingInformation()).containsExactly(new MissingInformation(Region.INSEAM, Reason.INCOMPATIBLE_PROTOCOL, Protocol.BODY_LENGTH_V1));
        assertThat(result.qualitativeEvidence()).isEqualTo("INSUFFICIENT_EVIDENCE");
    }

}
