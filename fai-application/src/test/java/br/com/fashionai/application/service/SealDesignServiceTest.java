package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SealDesignServiceTest {
    @Test
    void circularSealWithTransparentCornersIsDetected() {
        BufferedImage img = new BufferedImage(256, 256, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.ORANGE);
        g.fillOval(0, 0, 256, 256);
        g.dispose();
        assertThat(SealDesignService.cornersClear(img)).isTrue();
    }

    @Test
    void opaqueSquareIsNotCircular() {
        BufferedImage img = new BufferedImage(256, 256, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.ORANGE);
        g.fillRect(0, 0, 256, 256);
        g.dispose();
        assertThat(SealDesignService.cornersClear(img)).isFalse();
    }

    // ---------------------------------------------------------------- núcleo do selo (imagem do centro/emblema)
    private final UUID ownerId = UUID.randomUUID();
    private final MediaStoragePort media = mock(MediaStoragePort.class);
    private final UserRepository users = mock(UserRepository.class);
    private final SealDesignService service = new SealDesignService(media, users);

    private CurrentUser as(ProfileType type) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", ownerId);
        u.setProfileType(type);
        when(users.findById(ownerId)).thenReturn(Optional.of(u));
        when(media.put(anyString(), any(), anyString())).thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 1, "image/png"));
        return new CurrentUser(ownerId, "marca", "USER", type, true, AccountStatus.ACTIVE, null, null);
    }

    private static byte[] png(int w, int h) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.BLUE);
        g.fillRect(0, 0, w, h);
        g.dispose();
        return ImageOps.png(img);
    }

    @Test
    void coreImageAcceptsAnyReasonableRatioAndIsStoredInTheOwnersFolder() {
        Map<String, Object> r = service.uploadCore(as(ProfileType.MARCA), png(1200, 600));
        assertThat(r).containsEntry("width", 640).containsEntry("height", 320);
        assertThat(String.valueOf(r.get("url"))).startsWith("/media/users/" + ownerId + "/seals/core-");
        verify(media).put(startsWith("users/" + ownerId + "/seals/core-"), any(), anyString());
    }

    @Test
    void coreImageRejectsTinyStripesAndPersonalProfiles() {
        CurrentUser brand = as(ProfileType.MARCA);
        assertThatThrownBy(() -> service.uploadCore(brand, png(40, 40))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("NUCLEO_PEQUENO"));
        assertThatThrownBy(() -> service.uploadCore(brand, png(1000, 200))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("NUCLEO_PROPORCAO"));
        assertThatThrownBy(() -> service.uploadCore(as(ProfileType.PESSOAL), png(300, 300))).isInstanceOf(ApiException.class);
        verify(media, never()).put(anyString(), any(), anyString());
    }
}
