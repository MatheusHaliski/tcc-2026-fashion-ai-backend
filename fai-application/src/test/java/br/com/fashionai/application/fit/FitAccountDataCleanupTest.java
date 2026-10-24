package br.com.fashionai.application.fit;

import static org.mockito.Mockito.*;
import br.com.fashionai.domain.repository.fit.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FitAccountDataCleanupTest {
    @Test void purgesOnlyTheAccountDataInDependencyOrderWithoutAFeatureFlag() {
        var feedback = mock(FitFeedbackRepository.class); var recommendations = mock(SizeRecommendationRepository.class); var profiles = mock(FitMeasurementProfileRepository.class);
        UUID owner = UUID.randomUUID(); new FitAccountDataCleanup(feedback, recommendations, profiles).purge(owner);
        var order = inOrder(feedback, recommendations, profiles);
        order.verify(feedback).deleteByOwnerId(owner); order.verify(recommendations).deleteByOwnerId(owner); order.verify(profiles).deleteByOwnerId(owner);
        verifyNoMoreInteractions(feedback, recommendations, profiles);
    }
}
