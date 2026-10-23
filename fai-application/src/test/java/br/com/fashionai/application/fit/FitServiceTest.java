package br.com.fashionai.application.fit;

import static br.com.fashionai.application.fit.FitContracts.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.model.fit.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.domain.repository.fit.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class FitServiceTest {
    final ProductSizeChartRepository charts = mock(ProductSizeChartRepository.class);
    final FitMeasurementProfileRepository profiles = mock(FitMeasurementProfileRepository.class);
    final SizeRecommendationRepository recommendations = mock(SizeRecommendationRepository.class);
    final FitFeedbackRepository feedback = mock(FitFeedbackRepository.class);
    final CatalogProductRepository products = mock(CatalogProductRepository.class);
    final BrandRepository brands = mock(BrandRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final Guard guard = mock(Guard.class);
    final ObjectMapper json = new ObjectMapper();
    final CurrentUser user = new CurrentUser(UUID.randomUUID(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    final UUID productId = UUID.randomUUID();
    FitService service;
    @BeforeEach void setup() {
        service = new FitService(charts, profiles, recommendations, feedback, products, brands, users, guard, json, new FitEngine(), true);
        when(users.lockById(user.id())).thenReturn(Optional.of(new User()));
        var product = new CatalogProduct(); product.assignId(productId); product.setIngestionStatus(CatalogIngestionStatus.VALIDATED); product.setAgeGroup("ADULT"); product.setCategory("upper_piece"); product.setSubcategory("t_shirt");
        when(products.findById(productId)).thenReturn(Optional.of(product));
    }
    @Test void cannotReadRecommendationOwnedByAnotherUserIncludingAdmin() {
        UUID recommendationId = UUID.randomUUID();
        CurrentUser admin = new CurrentUser(UUID.randomUUID(), "admin", "ADMIN", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        assertThatThrownBy(() -> service.recommendation(admin, recommendationId)).isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.status()).isEqualTo(404));
        verify(recommendations).findByIdAndOwnerId(recommendationId, admin.id());
        verify(recommendations, never()).findById(any());
    }
    @Test void profileAlwaysQueriesAuthenticatedOwner() {
        assertThat(service.profile(user)).isNull(); verify(profiles).findByOwnerId(user.id());
        assertThatThrownBy(() -> service.profile(null)).isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.status()).isEqualTo(401));
    }
    @Test void regularUserCannotWriteProductChart() {
        when(guard.deny(eq(user), anyString(), anyString())).thenReturn(ApiException.forbidden("denied"));
        assertThatThrownBy(() -> service.saveChart(user, productId, new ChartWrite(null, null))).isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.status()).isEqualTo(403));
        verify(charts, never()).saveAndFlush(any());
    }
    @Test void wrongBrandCannotWriteProductChart() {
        CurrentUser brandUser = new CurrentUser(UUID.randomUUID(), "brand", "USER", ProfileType.MARCA, true, AccountStatus.ACTIVE, null, null);
        Brand other = new Brand(); other.assignId(UUID.randomUUID()); when(brands.findByBrandProfile_Owner_Id(brandUser.id())).thenReturn(Optional.of(other));
        when(guard.deny(eq(brandUser), anyString(), anyString())).thenReturn(ApiException.forbidden("denied"));
        assertThatThrownBy(() -> service.saveChart(brandUser, productId, new ChartWrite(null, null))).isInstanceOf(ApiException.class);
        verify(charts, never()).saveAndFlush(any());
    }
    @Test void noChartProducesHonestPersistedAbstentionWithoutMeasurementsInResult() {
        when(recommendations.saveAndFlush(any())).thenAnswer(invocation -> { SizeRecommendation entry = invocation.getArgument(0); entry.assignId(UUID.randomUUID()); return entry; });
        var response = service.recommend(user, productId, new Recommend(Preference.REGULAR, "test-request-1"));
        assertThat(response.result().status()).isEqualTo(Status.NO_CHART); assertThat(response.result().recommendedSize()).isNull();
        var capture = org.mockito.ArgumentCaptor.forClass(SizeRecommendation.class); verify(recommendations).saveAndFlush(capture.capture());
        assertThat(capture.getValue().getResultJson()).doesNotContain("measurements", "ownerId", "confidence");
    }
    @Test void feedbackRequiresRecommendationOwner() {
        UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> service.saveFeedback(user, id, new FeedbackWrite("experience-1", "M", Map.of(Region.CHEST, Rating.COMFORTABLE))))
            .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.status()).isEqualTo(404));
        verify(feedback, never()).saveAndFlush(any());
    }
    @Test void changingProfileRequiresVersionAndConvertsInches() {
        String oldKey = System.getProperty("DATA_ENCRYPTION_KEY");
        if (oldKey == null && System.getenv("DATA_ENCRYPTION_KEY") == null) System.setProperty("DATA_ENCRYPTION_KEY", Base64.getEncoder().encodeToString(new byte[32]));
        try {
            when(profiles.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
            var result = service.saveProfile(user, new ProfileWrite(null, Instant.now().minusSeconds(10), List.of(new Measurement(Region.CHEST, Protocol.BODY_CIRCUMFERENCE_V1, 40d, "IN"))));
            assertThat(result.measurements().getFirst().value()).isCloseTo(101.6, within(0.0001)); assertThat(result.measurements().getFirst().unit()).isEqualTo("CM");
            var existing = new FitMeasurementProfile(); existing.setOwnerId(user.id()); when(profiles.findByOwnerId(user.id())).thenReturn(Optional.of(existing));
            assertThatThrownBy(() -> service.saveProfile(user, new ProfileWrite(null, Instant.now().minusSeconds(10), result.measurements())))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.status()).isEqualTo(409));
        } finally { if (oldKey == null) System.clearProperty("DATA_ENCRYPTION_KEY"); else System.setProperty("DATA_ENCRYPTION_KEY", oldKey); }
    }
    @Test void deletingMeasurementsAlsoDeletesPrivateRecommendationAndFeedbackHistory() {
        var profile = new FitMeasurementProfile(); profile.setOwnerId(user.id()); when(profiles.findByOwnerId(user.id())).thenReturn(Optional.of(profile));
        service.deleteProfile(user, 0); verify(feedback).deleteByOwnerId(user.id()); verify(recommendations).deleteByOwnerId(user.id()); verify(profiles).delete(profile);
    }
    @Test void priorFeedbackIsScopedToOwnerProductAndChartRevisionAndExplained() {
        UUID id = UUID.randomUUID();
        var data = new ChartData(ChartType.BODY_RANGE, "TSHIRT", "BR", "Manufacturer", "https://example.com/chart", "r2", Instant.now().minusSeconds(10), Instant.now().plusSeconds(86400), true,
            List.of(new SizeOption("M", 1, List.of(new Dimension(Region.CHEST, Protocol.BODY_CIRCUMFERENCE_V1, 90d, 100d, null)))));
        var result = new FitEngine().evaluate(data, 2, List.of(new Measurement(Region.CHEST, Protocol.BODY_CIRCUMFERENCE_V1, 98d, "CM")), 0L, Preference.REGULAR, Instant.now());
        var recommendation = new SizeRecommendation(); recommendation.assignId(id); recommendation.setOwnerId(user.id()); recommendation.setProductId(productId);
        recommendation.setChartRevision(2); recommendation.setProfileVersion(0L); recommendation.setResultJson(json.writeValueAsString(result)); recommendation.setExpiresAt(result.expiresAt());
        when(recommendations.findByIdAndOwnerId(id, user.id())).thenReturn(Optional.of(recommendation));
        var historical = new FitFeedback(); historical.setOwnerId(user.id()); historical.markCreatedAt(Instant.now().minusSeconds(300));
        historical.setFeedbackJson(json.writeValueAsString(new FeedbackWrite("previous-try-1", "M", Map.of(Region.CHEST, Rating.TIGHT))));
        when(feedback.findOwnHistory(eq(user.id()), eq(productId), eq(2), any())).thenReturn(List.of(historical));
        var view = service.recommendation(user, id);
        assertThat(view.priorExperience()).hasSize(1); assertThat(view.priorExperience().getFirst().regions()).containsEntry(Region.CHEST, Rating.TIGHT);
        assertThat(view.priorExperience().getFirst().explanation()).isEqualTo("SAME_PRODUCT_SAME_CHART_SELF_REPORTED");
        assertThat(view.result().recommendedSize()).isEqualTo("M"); // Qualitative warning never silently edits the manufacturer's range.
        verify(feedback).findOwnHistory(eq(user.id()), eq(productId), eq(2), any());
    }

    @Test void refusesChartWhenDeclaredFamilyDoesNotMatchActualCatalogTaxonomy() {
        CurrentUser admin = new CurrentUser(UUID.randomUUID(), "admin", "ADMIN", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        when(users.lockById(admin.id())).thenReturn(Optional.of(new User()));
        var chart = new ChartData(ChartType.BODY_RANGE, "JEANS", "BR", "Manufacturer", "https://example.com/chart", "r1", Instant.now().minusSeconds(10), Instant.now().plusSeconds(86400), true,
            List.of(new SizeOption("40", 1, List.of(new Dimension(Region.WAIST, Protocol.BODY_CIRCUMFERENCE_V1, 78d, 84d, null)))));
        assertThatThrownBy(() -> service.saveChart(admin, productId, new ChartWrite(null, chart)))
            .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.code()).isEqualTo("FIT_INVALID"));
        verify(charts, never()).saveAndFlush(any());
    }
    @Test void legacyChartWithWrongFamilyAbstainsInsteadOfComparing() {
        var data = new ChartData(ChartType.BODY_RANGE, "JEANS", "BR", "Manufacturer", "https://example.com/chart", "r1", Instant.now().minusSeconds(10), Instant.now().plusSeconds(86400), true,
            List.of(new SizeOption("40", 1, List.of(new Dimension(Region.WAIST, Protocol.BODY_CIRCUMFERENCE_V1, 78d, 84d, null)))));
        var chart = new ProductSizeChart(); chart.setProductId(productId); chart.setChartJson(json.writeValueAsString(data)); when(charts.findByProductId(productId)).thenReturn(Optional.of(chart));
        when(recommendations.saveAndFlush(any())).thenAnswer(invocation -> { SizeRecommendation entry = invocation.getArgument(0); entry.assignId(UUID.randomUUID()); return entry; });
        assertThat(service.recommend(user, productId, new Recommend(Preference.REGULAR, "wrong-family-1")).result().status()).isEqualTo(Status.INCOMPATIBLE_CHART);
    }

}
