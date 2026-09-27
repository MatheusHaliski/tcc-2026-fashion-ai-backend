package br.com.fashionai.application.moderation;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.service.MediaService;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.domain.model.ModerationQueueItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ModerationQueueStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.ModerationQueueRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Quarentena: a foto retida só sai de restricted/ pela decisão do admin, e a pessoa é avisada. */
class UploadQuarantineTest {
    private final Map<String, byte[]> bucket = new HashMap<>();
    private final MediaStoragePort storage = new MediaStoragePort() {
        public URI createUploadUrl(String objectKey, String contentType) {
            return URI.create("http://local/" + objectKey);
        }

        public URI publicUrl(String objectKey) {
            return URI.create("http://local/media/" + objectKey);
        }

        public StoredObject put(String objectKey, byte[] content, String contentType) {
            bucket.put(objectKey, content);
            return new StoredObject(objectKey, "http://local/media/" + objectKey, content.length, contentType);
        }

        public byte[] get(String objectKey) {
            return bucket.get(objectKey);
        }

        public void delete(String objectKey) {
            bucket.remove(objectKey);
        }

        public Optional<String> keyOf(String url) {
            return Optional.empty();
        }
    };
    private final MediaService media = mock(MediaService.class);
    private final ModerationQueueRepository queue = mock(ModerationQueueRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final UploadQuarantine q = new UploadQuarantine(storage, media, queue, users, notifications);
    private final User user = new User("ana", "Ana", "ana@example.test", "h", "p", ProfileType.PESSOAL);

    UploadQuarantineTest() {
        user.assignId(UUID.randomUUID());
        when(users.findById(user.getId())).thenReturn(Optional.of(user));
        when(queue.save(any())).thenAnswer(a -> {
            ModerationQueueItem i = a.getArgument(0);
            if (i.getId() == null) {
                i.assignId(UUID.randomUUID());
            }
            return i;
        });
        when(media.put(anyString(), any(), anyString())).thenAnswer(a -> storage.put(a.getArgument(0), a.getArgument(1), a.getArgument(2)));
    }

    private static byte[] jpeg() {
        return ImageOps.jpeg(new BufferedImage(300, 300, BufferedImage.TYPE_INT_RGB), 0.9f);
    }

    private ModerationQueueItem held(String path) {
        ImageSafety.Verdict v = new ImageSafety.Verdict(ImageSafety.Decision.REVIEW, "segmentacao-local", List.of("muita pele"), Map.of("bodySkin", 0.55));
        q.hold(user.getId(), jpeg(), path, v);
        org.mockito.ArgumentCaptor<ModerationQueueItem> c = org.mockito.ArgumentCaptor.forClass(ModerationQueueItem.class);
        verify(queue).save(c.capture());
        return c.getValue();
    }

    @Test
    void fotoRetidaFicaEmRestrictedNaFila() {
        ModerationQueueItem item = held("/api/me/avatar");
        assertEquals(UploadQuarantine.TARGET, item.getTargetType());
        assertEquals(ModerationQueueStatus.PENDING_REVIEW, item.getStatus());
        String key = String.valueOf(Json.map(item.getCategoriesJson()).get("key"));
        assertTrue(key.startsWith("restricted/moderation/" + user.getId() + "/"), key);
        assertTrue(bucket.containsKey(key));
        assertEquals(List.of("muita pele"), UploadQuarantine.reasons(item));
        assertNull(user.getAvatarUrl(), "a foto em revisão não é aplicada ao perfil");
    }

    @Test
    void aprovadaViraFotoDePerfilESaiDaQuarentena() {
        ModerationQueueItem item = held("/api/me/avatar");
        String key = String.valueOf(Json.map(item.getCategoriesJson()).get("key"));
        q.decide(item, UUID.randomUUID(), true);
        assertFalse(bucket.containsKey(key));
        assertTrue(user.getAvatarUrl().contains("/users/" + user.getId() + "/profile/avatar-"), user.getAvatarUrl());
        verify(media).register(eq(user), eq(PhotoOrigin.PROFILE), any(), any(), any(), any(), any(), any(), any(), any(), any(), anyMap());
        verify(notifications).notify(eq(user.getId()), any(), eq(NotificationType.CONTENT_REVIEW), eq("UPLOAD"), any(), anyString(), anyString(), anyMap());
    }

    @Test
    void recusadaEApagadaSemPublicar() {
        ModerationQueueItem item = held("/api/schemes/photos");
        String key = String.valueOf(Json.map(item.getCategoriesJson()).get("key"));
        q.decide(item, UUID.randomUUID(), false);
        assertFalse(bucket.containsKey(key));
        assertTrue(bucket.keySet().stream().noneMatch(k -> k.startsWith("users/")), "nada publicado");
        verify(media, never()).register(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), anyMap());
        verify(notifications).notify(eq(user.getId()), any(), eq(NotificationType.CONTENT_REVIEW), eq("UPLOAD"), any(), anyString(), anyString(), anyMap());
    }
}
