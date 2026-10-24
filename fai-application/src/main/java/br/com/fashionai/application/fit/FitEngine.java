package br.com.fashionai.application.fit;

import static br.com.fashionai.application.fit.FitContracts.*;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Component;

/** Deterministic comparisons only: no inferred body circumference, stretch, or confidence percentages. */
@Component
public class FitEngine {
    public static final String RULES_VERSION = "fit-adult-v1";
    public Result evaluate(ChartData chart, Integer chartRevision, List<Measurement> measurements, Long profileVersion,
                           Preference preference, Instant now) {
        Instant expires = now.plusSeconds(30L * 86400);
        if (chart != null && chart.validUntil().isBefore(expires)) expires = chart.validUntil();
        if (chart == null) return result(Status.NO_CHART, null, List.of(), preference, false, null, chartRevision, profileVersion, expires);
        if (!chart.validUntil().isAfter(now)) return result(Status.CHART_EXPIRED, null, List.of(), preference, false, chart, chartRevision, profileVersion, expires);
        List<Candidate> candidates = new ArrayList<>();
        boolean missing = false, incompatible = false, easeApplied = false;
        for (SizeOption option : chart.options().stream().sorted(Comparator.comparingInt(SizeOption::order)).toList()) {
            List<RegionReason> reasons = new ArrayList<>();
            for (Dimension dimension : option.measurements()) {
                Measurement input = measurements.stream().filter(m -> m.region() == dimension.region() && m.protocol() == dimension.protocol()).findFirst().orElse(null);
                boolean bodyToGarment = false;
                if (input == null && chart.type() == ChartType.GARMENT_MEASUREMENT && dimension.protocol() == Protocol.GARMENT_CIRCUMFERENCE_V1) {
                    input = measurements.stream().filter(m -> m.region() == dimension.region() && m.protocol() == Protocol.BODY_CIRCUMFERENCE_V1).findFirst().orElse(null);
                    bodyToGarment = input != null;
                }
                Reason reason;
                if (input == null) {
                    boolean regionPresent = measurements.stream().anyMatch(m -> m.region() == dimension.region());
                    reason = regionPresent ? Reason.INCOMPATIBLE_PROTOCOL : Reason.MISSING_MEASUREMENT;
                    missing |= !regionPresent; incompatible |= regionPresent;
                } else if (bodyToGarment) {
                    Range ease = dimension.easeByPreference() == null ? null : dimension.easeByPreference().get(preference);
                    if (ease == null) { reason = Reason.MISSING_EASE_RULE; incompatible = true; }
                    else {
                        // Entire source measurement interval must satisfy its explicitly declared ease interval.
                        double minEase = dimension.min() - input.value(), maxEase = dimension.max() - input.value();
                        reason = minEase < ease.min() ? Reason.TIGHT : maxEase > ease.max() ? Reason.LOOSE : Reason.WITHIN_RANGE;
                        easeApplied = true;
                    }
                } else {
                    reason = input.value() < dimension.min() ? Reason.LOOSE : input.value() > dimension.max() ? Reason.TIGHT : Reason.WITHIN_RANGE;
                }
                reasons.add(new RegionReason(dimension.region(), reason, dimension.protocol(), input == null ? null : input.protocol()));
            }
            candidates.add(new Candidate(option.label(), option.order(), reasons.stream().allMatch(r -> r.reason() == Reason.WITHIN_RANGE), reasons));
        }
        var matching = candidates.stream().filter(Candidate::compatible).toList();
        Status status = missing ? Status.INSUFFICIENT_MEASUREMENTS : incompatible ? Status.INCOMPATIBLE_PROTOCOL
            : matching.size() == 1 ? Status.RECOMMENDED : matching.size() > 1 ? Status.AMBIGUOUS : Status.NO_COMPATIBLE_SIZE;
        return result(status, status == Status.RECOMMENDED ? matching.getFirst().sizeLabel() : null, candidates, preference, easeApplied, chart, chartRevision, profileVersion, expires);
    }
    public Result incompatibleChart(ChartData chart, Integer chartRevision, Long profileVersion, Preference preference, Instant now) {
        return result(Status.INCOMPATIBLE_CHART, null, List.of(), preference, false, chart, chartRevision, profileVersion, now);
    }
    private Result result(Status status, String size, List<Candidate> candidates, Preference preference, boolean applied,
                          ChartData chart, Integer chartRevision, Long profileVersion, Instant expires) {
        return new Result(status, size, candidates, preference, applied, applied ? "SOURCE_EASE_RULE" : "PREFERENCE_NOT_SUPPORTED_BY_SOURCE",
            RULES_VERSION, chartRevision, profileVersion, chart == null ? null : chart.sourceName(), chart == null ? null : chart.sourceRevision(),
            chart == null ? null : chart.sourceDate(), expires,
            status == Status.RECOMMENDED ? "SOURCE_MATCH" : status == Status.AMBIGUOUS ? "AMBIGUOUS_SOURCE_MATCH" : "INSUFFICIENT_EVIDENCE",
            candidates.stream().flatMap(c -> c.regions().stream()).filter(r -> r.reason() == Reason.MISSING_MEASUREMENT || r.reason() == Reason.INCOMPATIBLE_PROTOCOL || r.reason() == Reason.MISSING_EASE_RULE)
                .map(r -> new MissingInformation(r.region(), r.reason(), r.chartProtocol())).distinct().toList());
    }
}
