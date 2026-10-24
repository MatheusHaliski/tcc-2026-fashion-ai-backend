package br.com.fashionai.application.fit;

import static br.com.fashionai.application.fit.FitContracts.*;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.fit.*;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.domain.repository.fit.*;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
@Transactional(readOnly = true)
public class FitService {
    private final ProductSizeChartRepository charts;
    private final FitMeasurementProfileRepository profiles;
    private final SizeRecommendationRepository recommendations;
    private final FitFeedbackRepository feedback;
    private final CatalogProductRepository products;
    private final BrandRepository brands;
    private final UserRepository users;
    private final Guard guard;
    private final ObjectMapper json;
    private final FitEngine engine;
    private final boolean enabled;
    public FitService(ProductSizeChartRepository charts, FitMeasurementProfileRepository profiles,
                      SizeRecommendationRepository recommendations, FitFeedbackRepository feedback,
                      CatalogProductRepository products, BrandRepository brands, UserRepository users,
                      Guard guard, ObjectMapper json, FitEngine engine, @Value("${fashionai.fit.enabled:true}") boolean enabled) {
        this.charts = charts; this.profiles = profiles; this.recommendations = recommendations; this.feedback = feedback;
        this.products = products; this.brands = brands; this.users = users; this.guard = guard; this.json = json; this.engine = engine; this.enabled = enabled;
    }
    public Map<String, Object> config(CurrentUser user) {
        authenticated(user);
        return Map.of("enabled", enabled, "families", List.of("TSHIRT", "JEANS"), "rulesVersion", FitEngine.RULES_VERSION);
    }
    public ChartView chart(CurrentUser user, UUID productId) {
        available(user); CatalogProduct product = product(productId);
        var chart = charts.findByProductId(productId).orElse(null);
        return chart == null ? new ChartView(productId, 0, 0, null, canEdit(user, product))
            : new ChartView(productId, chart.getVersion(), chart.getRevision(), read(chart.getChartJson(), ChartData.class), canEdit(user, product));
    }
    @Transactional
    public ChartView saveChart(CurrentUser user, UUID productId, ChartWrite request) {
        available(user); guard.requireCanCreate(user); CatalogProduct product = product(productId);
        if (!canEdit(user, product)) throw guard.deny(user, "fit-chart:" + productId, Msg.t("fit.chartForbidden"));
        lockUser(user); // Serializes chart creation and idempotent commands from this actor.
        if (request == null) throw invalid("chart");
        if (!"ADULT".equals(product.getAgeGroup())) throw invalid("adultProductRequired");
        validateChart(request.chart());
        if (!matchesFamily(product, request.chart().family())) throw invalid("productFamily");
        var chart = charts.findByProductId(productId).orElse(null);
        checkVersion(chart == null ? null : chart.getVersion(), request.expectedVersion());
        if (chart == null) { chart = new ProductSizeChart(); chart.setProductId(productId); }
        else chart.setRevision(chart.getRevision() + 1);
        chart.setReviewerId(user.id()); chart.setChartJson(write(request.chart())); charts.saveAndFlush(chart);
        return new ChartView(productId, chart.getVersion(), chart.getRevision(), request.chart(), true);
    }
    public ProfileView profile(CurrentUser user) {
        available(user); return profiles.findByOwnerId(user.id()).map(this::profileView).orElse(null);
    }
    @Transactional
    public ProfileView saveProfile(CurrentUser user, ProfileWrite request) {
        available(user); guard.requireCanCreate(user); lockUser(user);
        if (request == null || request.measuredAt() == null || request.measuredAt().isAfter(Instant.now())
            || request.measurements() == null || request.measurements().isEmpty() || request.measurements().size() > 15) throw invalid("measurements");
        // Exercise the existing key before accepting sensitive data. No new key or plaintext fallback is introduced.
        try { new AesGcmStringConverter().convertToDatabaseColumn("fit-key-check"); }
        catch (IllegalStateException ex) { throw new ApiException(503, "FIT_ENCRYPTION_UNAVAILABLE", Msg.t("fit.encryptionUnavailable")); }
        Set<String> keys = new HashSet<>(); List<Measurement> normalized = new ArrayList<>();
        for (Measurement measurement : request.measurements()) {
            if (measurement == null || measurement.region() == null || measurement.protocol() == null
                || measurement.value() == null || !Double.isFinite(measurement.value()) || !Set.of("CM", "IN").contains(measurement.unit() == null ? "" : measurement.unit())
                || !compatibleRegionProtocol(measurement.region(), measurement.protocol())
                || !keys.add(measurement.region() + ":" + measurement.protocol())) throw invalid("measurement");
            double cm = measurement.value() * ("IN".equals(measurement.unit()) ? 2.54 : 1);
            if (cm < 1 || cm > 350) throw invalid("measurement");
            normalized.add(new Measurement(measurement.region(), measurement.protocol(), cm, "CM"));
        }
        var profile = profiles.findByOwnerId(user.id()).orElse(null);
        checkVersion(profile == null ? null : profile.getVersion(), request.expectedVersion());
        if (profile == null) { profile = new FitMeasurementProfile(); profile.setOwnerId(user.id()); }
        profile.setMeasurementsJson(write(new ProfileWrite(null, request.measuredAt(), normalized)));
        profile.setMeasuredAt(request.measuredAt()); profiles.saveAndFlush(profile);
        return profileView(profile);
    }
    @Transactional
    public void deleteProfile(CurrentUser user, long expectedVersion) {
        available(user); guard.requireCanCreate(user); lockUser(user);
        var profile = profiles.findByOwnerId(user.id()).orElse(null);
        if (profile != null) checkVersion(profile.getVersion(), expectedVersion);
        feedback.deleteByOwnerId(user.id()); recommendations.deleteByOwnerId(user.id());
        if (profile != null) profiles.delete(profile);
    }
    @Transactional
    public RecommendationView recommend(CurrentUser user, UUID productId, Recommend request) {
        available(user); guard.requireCanCreate(user); CatalogProduct product = product(productId); lockUser(user);
        if (request == null || request.preference() == null) throw invalid("preference");
        key(request.requestKey());
        var existing = recommendations.findByOwnerIdAndRequestKey(user.id(), request.requestKey()).orElse(null);
        if (existing != null) {
            if (!existing.getProductId().equals(productId) || read(existing.getResultJson(), Result.class).preference() != request.preference()) throw conflict();
            return recommendationView(existing);
        }
        var chart = charts.findByProductId(productId).orElse(null);
        var profile = profiles.findByOwnerId(user.id()).orElse(null);
        ChartData chartData = chart == null ? null : read(chart.getChartJson(), ChartData.class);
        Result result = chartData != null && !matchesFamily(product, chartData.family())
            ? engine.incompatibleChart(chartData, chart.getRevision(), profile == null ? null : profile.getVersion(), request.preference(), Instant.now())
            : engine.evaluate(chartData, chart == null ? null : chart.getRevision(),
            profile == null ? List.of() : profileView(profile).measurements(), profile == null ? null : profile.getVersion(), request.preference(), Instant.now());
        var recommendation = new SizeRecommendation(); recommendation.setOwnerId(user.id()); recommendation.setProductId(productId);
        recommendation.setChartRevision(result.chartRevision()); recommendation.setProfileVersion(result.profileVersion());
        recommendation.setRequestKey(request.requestKey()); recommendation.setResultJson(write(result)); recommendation.setExpiresAt(result.expiresAt());
        recommendations.saveAndFlush(recommendation); return recommendationView(recommendation);
    }
    public RecommendationView recommendation(CurrentUser user, UUID id) {
        available(user); return recommendationView(ownedRecommendation(user, id));
    }
    @Transactional
    public FeedbackView saveFeedback(CurrentUser user, UUID id, FeedbackWrite request) {
        available(user); guard.requireCanCreate(user); lockUser(user);
        var recommendation = ownedRecommendation(user, id);
        if (request == null) throw invalid("feedback"); key(request.experienceKey());
        Result result = read(recommendation.getResultJson(), Result.class);
        Candidate tried = result.candidates().stream().filter(c -> c.sizeLabel().equals(request.triedSize())).findFirst().orElseThrow(() -> invalid("triedSize"));
        if (request.regions() == null || request.regions().isEmpty() || request.regions().size() > 5
            || request.regions().entrySet().stream().anyMatch(e -> e.getKey() == null || e.getValue() == null || tried.regions().stream().noneMatch(r -> r.region() == e.getKey()))) throw invalid("regions");
        var existing = feedback.findByRecommendationIdAndOwnerIdAndExperienceKey(id, user.id(), request.experienceKey()).orElse(null);
        if (existing != null) {
            if (!read(existing.getFeedbackJson(), FeedbackWrite.class).equals(request)) throw conflict();
            return feedbackView(existing);
        }
        var entry = new FitFeedback(); entry.setOwnerId(user.id()); entry.setRecommendationId(id);
        entry.setExperienceKey(request.experienceKey()); entry.setFeedbackJson(write(request)); feedback.saveAndFlush(entry);
        return feedbackView(entry);
    }
    @Transactional
    public void deleteFeedback(CurrentUser user, UUID id) {
        available(user); guard.requireCanCreate(user);
        feedback.delete(feedback.findByIdAndOwnerId(id, user.id()).orElseThrow(() -> ApiException.notFound("Fit feedback")));
    }
    private SizeRecommendation ownedRecommendation(CurrentUser user, UUID id) {
        return recommendations.findByIdAndOwnerId(id, user.id()).orElseThrow(() -> ApiException.notFound("Size recommendation"));
    }
    private RecommendationView recommendationView(SizeRecommendation entry) {
        var chart = charts.findByProductId(entry.getProductId()).orElse(null);
        var profile = profiles.findByOwnerId(entry.getOwnerId()).orElse(null);
        boolean stale = !entry.getExpiresAt().isAfter(Instant.now()) || !Objects.equals(entry.getChartRevision(), chart == null ? null : chart.getRevision())
            || !Objects.equals(entry.getProfileVersion(), profile == null ? null : profile.getVersion())
            || (chart != null && products.findById(entry.getProductId()).map(p -> !matchesFamily(p, read(chart.getChartJson(), ChartData.class).family())).orElse(true));
        return new RecommendationView(entry.getId(), entry.getProductId(), read(entry.getResultJson(), Result.class), stale,
            feedback.findByRecommendationIdAndOwnerId(entry.getId(), entry.getOwnerId()).stream().map(this::feedbackView).toList(), priorExperience(entry));
    }
    private List<FeedbackInsight> priorExperience(SizeRecommendation entry) {
        if (entry.getChartRevision() == null) return List.of();
        Set<String> labels = read(entry.getResultJson(), Result.class).candidates().stream().map(Candidate::sizeLabel).collect(java.util.stream.Collectors.toSet());
        Map<String, FeedbackInsight> latest = new LinkedHashMap<>();
        for (FitFeedback historical : feedback.findOwnHistory(entry.getOwnerId(), entry.getProductId(), entry.getChartRevision(), org.springframework.data.domain.PageRequest.of(0, 20))) {
            FeedbackWrite data = read(historical.getFeedbackJson(), FeedbackWrite.class);
            if (labels.contains(data.triedSize())) latest.putIfAbsent(data.triedSize(), new FeedbackInsight(data.triedSize(), data.regions(), historical.getCreatedAt(), entry.getChartRevision(), "SAME_PRODUCT_SAME_CHART_SELF_REPORTED"));
        }
        return List.copyOf(latest.values());
    }
    private boolean compatibleRegionProtocol(Region region, Protocol protocol) {
        boolean length = protocol == Protocol.BODY_LENGTH_V1 || protocol == Protocol.GARMENT_LENGTH_V1;
        return (region == Region.INSEAM) == length;
    }
    private FeedbackView feedbackView(FitFeedback entry) {
        var data = read(entry.getFeedbackJson(), FeedbackWrite.class);
        return new FeedbackView(entry.getId(), data.triedSize(), data.regions(), "SELF_REPORTED", entry.getVersion());
    }
    private ProfileView profileView(FitMeasurementProfile profile) {
        return new ProfileView(profile.getVersion(), profile.getMeasuredAt(), "MANUAL", read(profile.getMeasurementsJson(), ProfileWrite.class).measurements());
    }
    private CatalogProduct product(UUID id) {
        return products.findById(id).filter(p -> Set.of(CatalogIngestionStatus.VALIDATED, CatalogIngestionStatus.PERSISTABLE,
            CatalogIngestionStatus.REFERENCE_ONLY).contains(p.getIngestionStatus())).orElseThrow(() -> ApiException.notFound("Catalog product"));
    }
    private boolean matchesFamily(CatalogProduct product, String family) {
        if (!"ADULT".equals(product.getAgeGroup())) return false;
        return "TSHIRT".equals(family) && "upper_piece".equals(product.getCategory()) && "t_shirt".equals(product.getSubcategory())
            || "JEANS".equals(family) && "lower_piece".equals(product.getCategory()) && "jeans".equals(product.getSubcategory());
    }
    private boolean canEdit(CurrentUser user, CatalogProduct product) {
        if (user.admin()) return true;
        if (user.profileType() != br.com.fashionai.domain.model.enums.ProfileType.MARCA
            || user.status() != br.com.fashionai.domain.model.enums.AccountStatus.ACTIVE || !user.emailVerified()) return false;
        return brands.findByBrandProfile_Owner_Id(user.id()).map(brand -> brand.getId().equals(product.getBrandId())).orElse(false);
    }
    private void validateChart(ChartData chart) {
        if (chart == null || chart.type() == null || !Set.of("TSHIRT", "JEANS").contains(chart.family() == null ? "" : chart.family())
            || !text(chart.market(), 20) || !text(chart.sourceName(), 160) || !text(chart.sourceRevision(), 80) || !chart.sourceAuthorized()
            || chart.sourceDate() == null || chart.sourceDate().isAfter(Instant.now()) || chart.validUntil() == null || !chart.validUntil().isAfter(Instant.now())
            || chart.options() == null || chart.options().isEmpty() || chart.options().size() > 40) throw invalid("chart");
        try {
            URI uri = URI.create(chart.sourceUrl());
            if (!Set.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || chart.sourceUrl().length() > 1024) throw invalid("sourceUrl");
        } catch (IllegalArgumentException | NullPointerException ex) { throw invalid("sourceUrl"); }
        Set<String> labels = new HashSet<>(); Set<Integer> orders = new HashSet<>(); Set<String> expected = null;
        for (SizeOption option : chart.options()) {
            if (option == null || !text(option.label(), 40) || !labels.add(option.label()) || option.order() < 0 || !orders.add(option.order())
                || option.measurements() == null || option.measurements().isEmpty() || option.measurements().size() > 5) throw invalid("options");
            Set<String> dimensions = new HashSet<>(); Set<Region> regions = new HashSet<>();
            for (Dimension dimension : option.measurements()) {
                if (dimension == null || dimension.region() == null || dimension.protocol() == null || !range(dimension.min(), dimension.max(), 1, 350)
                    || !regions.add(dimension.region()) || !dimensions.add(dimension.region() + ":" + dimension.protocol())
                    || !compatibleRegionProtocol(dimension.region(), dimension.protocol())
                    || (chart.type() == ChartType.BODY_RANGE) != (dimension.protocol() == Protocol.BODY_CIRCUMFERENCE_V1 || dimension.protocol() == Protocol.BODY_LENGTH_V1)) throw invalid("protocol");
                if (dimension.easeByPreference() != null && dimension.easeByPreference().entrySet().stream().anyMatch(e -> e.getKey() == null || e.getValue() == null
                    || !range(e.getValue().min(), e.getValue().max(), 0, 100))) throw invalid("easeByPreference");
                // Negative ease requires elasticity-specific evidence and is deliberately outside this pilot.
            }
            if (expected == null) expected = dimensions; else if (!expected.equals(dimensions)) throw invalid("dimensions");
        }
    }
    private boolean range(Double min, Double max, double floor, double ceiling) {
        return min != null && max != null && Double.isFinite(min) && Double.isFinite(max) && min >= floor && max >= min && max <= ceiling;
    }
    private boolean text(String value, int max) { return value != null && !value.isBlank() && value.length() <= max; }
    private void key(String key) { if (key == null || !key.matches("[A-Za-z0-9_-]{8,80}")) throw invalid("requestKey"); }
    private void checkVersion(Long actual, Long expected) { if (!Objects.equals(actual, expected)) throw conflict(); }
    private ApiException conflict() { return ApiException.conflict("FIT_VERSION_CONFLICT", Msg.t("fit.conflict")); }
    private ApiException invalid(String field) { return ApiException.badRequest("FIT_INVALID", Msg.t("fit.invalid", field)); }
    private void lockUser(CurrentUser user) { users.lockById(user.id()).orElseThrow(() -> ApiException.notFound("User")); }
    private void authenticated(CurrentUser user) { if (user == null) throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar")); }
    private void available(CurrentUser user) {
        authenticated(user); if (!enabled) throw new ApiException(503, "FIT_PILOT_DISABLED", Msg.t("fit.disabled"));
    }
    private String write(Object value) { return json.writeValueAsString(value); }
    private <T> T read(String value, Class<T> type) { return json.readValue(value, type); }
}
