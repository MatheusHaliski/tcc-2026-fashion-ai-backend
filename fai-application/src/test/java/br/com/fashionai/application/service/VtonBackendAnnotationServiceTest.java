package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.enums.AiCallResult;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.Base64;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class VtonBackendAnnotationServiceTest {
    private final AiEngine ai = mock(AiEngine.class);
    private final Guard guard = mock(Guard.class);
    private final CurrentUser user = mock(CurrentUser.class);
    private final VtonBackendAnnotationService service = new VtonBackendAnnotationService(ai, guard, "test-v1");

    private VtonBackendAnnotationService.Request request() throws Exception {
        BufferedImage image = new BufferedImage(32, 32, BufferedImage.TYPE_INT_ARGB);
        image.setRGB(16, 16, 0x80808080);
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(image, "PNG", bytes);
        return new VtonBackendAnnotationService.Request(Base64.getEncoder().encodeToString(bytes.toByteArray()),
                Map.of("type", "object"), null);
    }

    private void outcome(Map<String,Object> value, boolean fallback) {
        doReturn(new AiOutcome<>(value, null, AiCallResult.SUCCESS, fallback, "TEST_ONLY", "TEST_ONLY",
                0, BigDecimal.ZERO, null, null, null)).when(ai).text(any());
    }

    @Test void requiresAdministratorBeforeAccessingAi() {
        doThrow(ApiException.forbidden("Admin required")).when(guard).requireAdmin(user);
        assertThatThrownBy(() -> service.annotate(user, null)).isInstanceOf(ApiException.class);
        verifyNoInteractions(ai);
    }

    @Test void localFallbackIsNotPresentedAsVerifiedLandmarks() throws Exception {
        outcome(Map.of("attributes", Map.of(), "keypoints", Map.of()), true);
        var request = request();
        assertThatThrownBy(() -> service.annotate(user, request))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("VTON_ANNOTATION_UNVERIFIED"));
    }

    @Test void unverifiedProviderResponseIsRejected() throws Exception {
        outcome(Map.of("unverified", true), false);
        var request = request();
        assertThatThrownBy(() -> service.annotate(user, request)).isInstanceOf(ApiException.class);
    }

    @Test void serverComputesMaskWithoutGammaChangingTheAlphaValues() throws Exception {
        outcome(Map.of("attributes", Map.of(), "keypoints", Map.of()), false);
        Map<String,Object> result = service.annotate(user, request());
        byte[] maskBytes = Base64.getDecoder().decode((String)result.get("mask_png"));
        BufferedImage mask = ImageIO.read(new ByteArrayInputStream(maskBytes));
        assertThat(mask.getRaster().getSample(16, 16, 0)).isEqualTo(128);
        assertThat(mask.getRaster().getSample(0, 0, 0)).isZero();
        assertThat(result).containsEntry("model_version", "test-v1").containsEntry("provider", "TEST_ONLY");
        verify(ai).text(any());
    }
}
