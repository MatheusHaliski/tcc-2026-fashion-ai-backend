package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensFeedback;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.model.enums.ConsentPurpose;
import br.com.fashionai.domain.model.enums.LensFeedbackKind;
import br.com.fashionai.domain.repository.LensFeedbackRepository;
import br.com.fashionai.domain.repository.UserConsentRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Registro das correções em {@code lens_feedback}: antes/depois da peça e o consentimento de treino de quem corrigiu. */
final class LensFeedbackLog {
    private final LensFeedbackRepository feedback;
    private final UserConsentRepository consents;

    LensFeedbackLog(LensFeedbackRepository feedback, UserConsentRepository consents) {
        this.feedback = feedback;
        this.consents = consents;
    }

    boolean trainingConsent(UUID userId) {
        return consents.findByUserIdAndPurpose(userId, ConsentPurpose.AI_MODEL_TRAINING).map(c -> c.isGranted()).orElse(false);
    }

    void recordFeedback(LensScan scan, LensDetection d, UUID userId, LensFeedbackKind kind, Map<String, Object> before,
                        Map<String, Object> after, boolean consent) {
        LensFeedback f = new LensFeedback();
        f.setScanId(scan.getId());
        f.setDetectionId(d.getId());
        f.setUserId(userId);
        f.setKind(kind);
        f.setBeforeJson(before == null ? null : Json.write(before));
        f.setAfterJson(after == null ? null : Json.write(after));
        f.setTrainingConsent(consent);
        feedback.save(f);
    }

    static Map<String, Object> snapshot(LensDetection d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("box", Json.map(d.getBoxJson()));
        m.put("category", d.getCategory());
        m.put("subcategory", d.getSubcategory());
        List<LensViews.ColorShare> colors = LensDetectionFields.colors(d);
        m.put("color", colors.isEmpty() ? null : colors.get(0).name());
        m.put("material", d.getMaterial());
        m.put("pattern", d.getPattern());
        m.put("styles", Json.csv(d.getStyleTags()));
        m.put("dismissed", d.getDismissedAt() != null);
        return m;
    }
}
