package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.BodyMeasurementPort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Medida do corpo na GPU: consentimento, foto só em memória, só proporções dentro das faixas do avatar voltam. */
class AvatarBodyScanServiceTest {
    private final UUID userId = UUID.randomUUID();
    private final BodyMeasurementPort gpu = mock(BodyMeasurementPort.class);
    private final RateLimitPort rateLimit = mock(RateLimitPort.class);
    private final Audit audit = mock(Audit.class);
    private final Guard guard = mock(Guard.class);
    private final CurrentUser user = mock(CurrentUser.class);
    private final AvatarBodyScanService service = new AvatarBodyScanService(gpu, rateLimit, audit, guard);
    private final AtomicReference<byte[]> sentCopy = new AtomicReference<>();
    private final AtomicReference<byte[]> sentArray = new AtomicReference<>();

    @BeforeEach void prepare() {
        when(user.id()).thenReturn(userId);
        when(gpu.available()).thenReturn(true);
        when(rateLimit.tryAcquire(eq(userId), eq("avatar-body-scan"), eq(AvatarBodyScanService.HOURLY_LIMIT), eq(Duration.ofHours(1)))).thenReturn(true);
    }

    private void gpuReturns(Map<String, Object> result) {
        when(gpu.measureBody(any())).thenAnswer(call -> {
            byte[] bytes = call.getArgument(0);
            sentArray.set(bytes);
            sentCopy.set(bytes.clone());
            return result;
        });
    }

    private static byte[] png(int width, int height) throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), "PNG", bytes);
        return bytes.toByteArray();
    }

    private static Map<String, Object> ready(Map<String, Object> ratios, Map<String, Object> refused, List<Object> warnings) {
        return Map.of("status", "READY", "ratios", ratios, "refused", refused, "warnings", warnings,
                "diagnostics", Map.of("engine", "SAM_3D_BODY_DINOV3", "device", "cuda:0", "modelRevision", "a".repeat(40)));
    }

    @Test void withoutConsentNothingIsDecodedOrSent() throws Exception {
        assertThatThrownBy(() -> service.measure(user, png(600, 900), false))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("CONSENTIMENTO_OBRIGATORIO"));
        verifyNoInteractions(gpu, rateLimit, audit);
    }

    @Test void photoGoesAsFreshJpegWithinTheGpuLimitAndIsWipedFromMemoryAfterwards() throws Exception {
        gpuReturns(ready(Map.of("waistW", 0.16, "hipW", 0.2, "legLen", 0.5), Map.of(), List.of()));
        var out = service.measure(user, png(1800, 2400), true);
        assertThat(out).containsEntry("status", "READY").containsEntry("photoStored", false).containsEntry("source", "observed");
        byte[] sent = sentCopy.get();
        assertThat(sent[0] & 0xFF).isEqualTo(0xFF);
        assertThat(sent[1] & 0xFF).isEqualTo(0xD8);
        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(sent));
        assertThat(Math.max(decoded.getWidth(), decoded.getHeight())).isEqualTo(AvatarBodyScanService.MAX_SIDE);
        // a cópia enviada à GPU some da memória do processo assim que a resposta chega
        assertThat(sentArray.get()).containsOnly((byte) 0);
    }

    @Test void onlyKnownProportionsInsideTheAvatarRangesComeBack() throws Exception {
        gpuReturns(ready(Map.of("waistW", 0.16, "hipW", 0.9, "legLen", "0.5", "mesh", List.of(1, 2, 3)),
                Map.of("chestW", "SLICE_WITHOUT_TORSO", "chestD", "data:image/png;base64,AAAA", "other", "X_CODE"),
                List.of("ARMS_CLOSE_TO_BODY", "not a code", 7)));
        var out = service.measure(user, png(600, 900), true);
        assertThat(out.get("ratios")).isEqualTo(Map.of("waistW", 0.16));
        assertThat(out.get("refused")).isEqualTo(Map.of("chestW", "SLICE_WITHOUT_TORSO", "hipW", "OUT_OF_ADULT_RANGE", "legLen", "OUT_OF_ADULT_RANGE"));
        assertThat(out.get("warnings")).isEqualTo(List.of("ARMS_CLOSE_TO_BODY"));
        assertThat(out).containsEntry("modelRevision", "a".repeat(40)).doesNotContainKey("mesh");
        @SuppressWarnings("unchecked") ArgumentCaptor<Map<String, Object>> details = ArgumentCaptor.forClass(Map.class);
        verify(audit).log(eq(user), eq("AVATAR3D_MEDIDA_GPU"), eq("avatar3d:" + userId), details.capture());
        assertThat(details.getValue().toString()).doesNotContain("0.16");
    }

    @Test void gpuRefusalKeepsOnlyTheShortReasonForTheScreen() throws Exception {
        when(gpu.measureBody(any())).thenThrow(new ApiException(422, "VTON_WORKER_REJECTED", "x", Map.of("reason", "FULL_BODY_NOT_VISIBLE")));
        assertThatThrownBy(() -> service.measure(user, png(600, 900), true)).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.code()).isEqualTo("MEDIDA_GPU_RECUSADA");
            assertThat(e.status()).isEqualTo(422);
            assertThat(e.details()).containsEntry("reason", "FULL_BODY_NOT_VISIBLE");
        });
    }

    @Test void nothingReliableMeasuredIsAnErrorNotAnEmptyAvatar() throws Exception {
        gpuReturns(ready(Map.of(), Map.of("waistW", "SLICE_WITHOUT_TORSO"), List.of()));
        assertThatThrownBy(() -> service.measure(user, png(600, 900), true))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("MEDIDA_GPU_SEM_MEDIDAS"));
    }

    @Test void gpuOffOrHourlyLimitStopBeforeTheGpu() throws Exception {
        when(gpu.available()).thenReturn(false);
        assertThatThrownBy(() -> service.measure(user, png(600, 900), true))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(503));
        verifyNoInteractions(rateLimit);
        when(gpu.available()).thenReturn(true);
        when(rateLimit.tryAcquire(any(), any(), anyInt(), any())).thenReturn(false);
        assertThatThrownBy(() -> service.measure(user, png(600, 900), true))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("MEDIDA_GPU_LIMITE"));
        verify(gpu, never()).measureBody(any());
    }

    @Test void tinyOrNonImageUploadsAreRefused() throws Exception {
        assertThatThrownBy(() -> service.measure(user, png(120, 200), true))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("FOTO_PEQUENA"));
        assertThatThrownBy(() -> service.measure(user, "not an image at all".getBytes(), true)).isInstanceOf(ApiException.class);
        verify(gpu, never()).measureBody(any());
    }
}
