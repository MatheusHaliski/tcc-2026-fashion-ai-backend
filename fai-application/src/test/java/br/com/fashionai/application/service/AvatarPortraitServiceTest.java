package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.ports.StylizedPortraitPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Retrato estilizado na GPU: consentimento, foto só em memória e só um retrato conferido chega à tela. */
class AvatarPortraitServiceTest {
    private final UUID userId = UUID.randomUUID();
    private final StylizedPortraitPort gpu = mock(StylizedPortraitPort.class);
    private final RateLimitPort rateLimit = mock(RateLimitPort.class);
    private final Audit audit = mock(Audit.class);
    private final Guard guard = mock(Guard.class);
    private final CurrentUser user = mock(CurrentUser.class);
    private final AvatarPortraitService service = new AvatarPortraitService(gpu, rateLimit, audit, guard);
    private final AtomicReference<byte[]> sentArray = new AtomicReference<>();
    private final AtomicReference<byte[]> sentCopy = new AtomicReference<>();

    @BeforeEach void prepare() {
        when(user.id()).thenReturn(userId);
        when(gpu.available()).thenReturn(true);
        when(rateLimit.tryAcquire(eq(userId), eq("avatar-portrait"), eq(AvatarPortraitService.HOURLY_LIMIT), eq(Duration.ofHours(1)))).thenReturn(true);
    }

    private static byte[] image(String format, int width, int height) throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), format, bytes);
        return bytes.toByteArray();
    }

    private static Map<String, Object> ready(byte[] jpeg, int width, int height, Object similarity) {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "READY");
        result.put("image_jpeg", Base64.getEncoder().encodeToString(jpeg));
        result.put("width", width);
        result.put("height", height);
        result.put("identitySimilarity", similarity);
        result.put("diagnostics", Map.of("engine", "SDXL_INSTANTID_STYLIZED_PORTRAIT"));
        return result;
    }

    private void gpuReturns(Map<String, Object> result) {
        when(gpu.stylizedPortrait(any(), anyInt())).thenAnswer(call -> {
            byte[] bytes = call.getArgument(0);
            sentArray.set(bytes);
            sentCopy.set(bytes.clone());
            return result;
        });
    }

    @Test void portraitComesBackCheckedAndNothingIsStored() throws Exception {
        gpuReturns(ready(image("jpg", 896, 1152), 896, 1152, 0.61234));
        Map<String, Object> out = service.generate(user, image("png", 600, 800), true, 7);
        assertThat(out.get("image").toString()).startsWith("data:image/jpeg;base64,");
        assertThat(out).containsEntry("identitySimilarity", 0.612).containsEntry("width", 896).containsEntry("seed", 7)
                .containsEntry("photoStored", false).containsEntry("portraitStored", false).containsEntry("style", "semi_realistic");
        verify(gpu).stylizedPortrait(any(), eq(7));
        // a GPU recebeu um JPEG novo (sem metadados) e a cópia em memória foi apagada depois da resposta
        assertThat(ImageIO.read(new ByteArrayInputStream(sentCopy.get()))).isNotNull();
        assertThat(sentCopy.get()[0] & 0xFF).isEqualTo(0xFF);
        assertThat(sentArray.get()).containsOnly((byte) 0);
        verify(audit).log(eq(user), eq("AVATAR3D_RETRATO_GPU"), anyString(), eq(Map.of("largura", 896, "altura", 1152)));
    }

    @Test void withoutSeedEachRequestDrawsAnotherPortrait() throws Exception {
        gpuReturns(ready(image("jpg", 896, 1152), 896, 1152, 0.5));
        Object seed = service.generate(user, image("png", 600, 800), true, null).get("seed");
        assertThat(seed).isInstanceOf(Integer.class);
        assertThat((Integer) seed).isNotNegative();
        assertThatThrownBy(() -> service.generate(user, image("png", 600, 800), true, -1))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("SEED_INVALIDO"));
    }

    @Test void consentGpuLimitAndPhotoSizeAreCheckedBeforeTheGpu() throws Exception {
        assertThatThrownBy(() -> service.generate(user, image("png", 600, 800), false, null))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("CONSENTIMENTO_OBRIGATORIO"));
        assertThatThrownBy(() -> service.generate(user, image("png", 200, 800), true, null))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("FOTO_PEQUENA"));
        when(rateLimit.tryAcquire(any(), any(), anyInt(), any())).thenReturn(false);
        assertThatThrownBy(() -> service.generate(user, image("png", 600, 800), true, null))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("RETRATO_GPU_LIMITE"));
        when(gpu.available()).thenReturn(false);
        assertThatThrownBy(() -> service.generate(user, image("png", 600, 800), true, null))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("RETRATO_GPU_INDISPONIVEL"));
        verify(gpu, never()).stylizedPortrait(any(), anyInt());
    }

    @Test void gpuRefusalReachesTheScreenWithTheReason() throws Exception {
        when(gpu.stylizedPortrait(any(), anyInt())).thenThrow(new ApiException(422, "VTON_WORKER_REJECTED", "x", Map.of("reason", "MULTIPLE_FACES_REJECTED")));
        assertThatThrownBy(() -> service.generate(user, image("png", 600, 800), true, 1))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.code()).isEqualTo("RETRATO_GPU_RECUSADO");
                    assertThat(e.details()).containsEntry("reason", "MULTIPLE_FACES_REJECTED");
                });
    }

    @Test void anythingButAJpegOfTheAnnouncedSizeWithAValidSimilarityIsRefused() throws Exception {
        byte[] jpeg = image("jpg", 896, 1152);
        for (Map<String, Object> broken : new Map[]{
                ready(jpeg, 896, 1000, 0.5),
                ready(image("png", 896, 1152), 896, 1152, 0.5),
                ready(jpeg, 896, 1152, Double.NaN),
                ready(jpeg, 896, 1152, 1.5),
                ready(jpeg, 896, 1152, "0.5"),
                Map.of("status", "FAILED")}) {
            assertThatThrownBy(() -> AvatarPortraitService.checked(broken))
                    .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("RETRATO_GPU_INVALIDO"));
        }
        Map<String, Object> notBase64 = ready(jpeg, 896, 1152, 0.5);
        notBase64.put("image_jpeg", "data:image/jpeg;base64,AAAA");
        assertThatThrownBy(() -> AvatarPortraitService.checked(notBase64)).isInstanceOf(ApiException.class);
    }
}
