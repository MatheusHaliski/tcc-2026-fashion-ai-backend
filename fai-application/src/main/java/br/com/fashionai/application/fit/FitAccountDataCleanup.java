package br.com.fashionai.application.fit;

import br.com.fashionai.application.privacy.AccountDataCleanup;
import br.com.fashionai.domain.repository.fit.FitFeedbackRepository;
import br.com.fashionai.domain.repository.fit.FitMeasurementProfileRepository;
import br.com.fashionai.domain.repository.fit.SizeRecommendationRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Account deletion must erase personal fit data even when new fit operations are disabled. */
@Component
public class FitAccountDataCleanup implements AccountDataCleanup {
    private final FitFeedbackRepository feedback;
    private final SizeRecommendationRepository recommendations;
    private final FitMeasurementProfileRepository profiles;
    public FitAccountDataCleanup(FitFeedbackRepository feedback, SizeRecommendationRepository recommendations, FitMeasurementProfileRepository profiles) {
        this.feedback = feedback; this.recommendations = recommendations; this.profiles = profiles;
    }
    @Override @Transactional
    public void purge(UUID ownerId) {
        feedback.deleteByOwnerId(ownerId); recommendations.deleteByOwnerId(ownerId); profiles.deleteByOwnerId(ownerId);
    }
}
