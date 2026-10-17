package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.AnatomicalTryOnPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AnatomicalTryOnServiceTest {
    private final UUID userId = UUID.randomUUID();
    private final UUID pieceId = UUID.randomUUID();
    private final String photo = "/media/users/" + userId + "/photo.png";
    private final AnatomicalTryOnPort worker = mock(AnatomicalTryOnPort.class);
    private final WardrobeService wardrobe = mock(WardrobeService.class);
    private final TryOnService legacy = mock(TryOnService.class);
    private final MediaService media = mock(MediaService.class);
    private final Guard guard = mock(Guard.class);
    private final CurrentUser user = mock(CurrentUser.class);
    private final WardrobeItem piece = mock(WardrobeItem.class);
    private final AnatomicalTryOnService service = new AnatomicalTryOnService(worker, wardrobe, legacy, media, guard);
    private byte[] image;

    @BeforeEach void prepare() throws Exception {
        image = png(32, 40);
        when(user.id()).thenReturn(userId);
        when(piece.getId()).thenReturn(pieceId);
        when(piece.getCategory()).thenReturn("upper_piece");
        when(wardrobe.owned(user, pieceId)).thenReturn(piece);
        when(media.requireOwnedMedia(userId, photo, Set.of(MediaService.MediaScope.OWNER), "personMediaUrl"))
                .thenReturn(new MediaService.OwnedMedia("users/"+userId+"/photo.png", photo));
        when(worker.available()).thenReturn(true);
        when(legacy.imageBytes(piece)).thenReturn(image);
        when(media.read(photo)).thenReturn(Optional.of(image));
    }

    private AnatomicalTryOnService.Request request(boolean consent) {
        return new AnatomicalTryOnService.Request(pieceId, photo, null, false, consent);
    }

    private static byte[] png(int width, int height) throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), "PNG", bytes);
        return bytes.toByteArray();
    }

    private void output(byte[] png) {
        when(worker.render(anyString(), any(), any(), anyString(), any(), anyBoolean())).thenReturn(
                Map.of("status", "READY", "image_png", Base64.getEncoder().encodeToString(png)));
    }

    @Test void consentIsRequiredBeforeReadingOrSendingAnyPhoto() {
        assertThatThrownBy(() -> service.render(user, request(false)))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("VTON_CONSENT_REQUIRED"));
        verifyNoInteractions(worker, wardrobe, media, legacy);
    }

    @Test void anotherUsersPieceIsRejectedBeforeAnyWorkerCall() {
        when(wardrobe.owned(user, pieceId)).thenThrow(ApiException.forbidden("Not owned"));
        assertThatThrownBy(() -> service.render(user, request(true))).isInstanceOf(ApiException.class);
        verifyNoInteractions(worker, media, legacy);
    }

    @Test void anotherUsersPhotoIsRejectedBeforeAnyWorkerCall() {
        when(media.requireOwnedMedia(any(), anyString(), anySet(), anyString())).thenThrow(ApiException.forbidden("Not owned"));
        assertThatThrownBy(() -> service.render(user, request(true))).isInstanceOf(ApiException.class);
        verifyNoInteractions(worker, legacy);
    }

    @Test void missingWorkerDoesNotReadPhotoBytes() {
        when(worker.available()).thenReturn(false);
        assertThatThrownBy(() -> service.render(user, request(true)))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status()).isEqualTo(503));
        verify(media, never()).read(anyString());
        verifyNoInteractions(legacy);
    }

    @Test void pendingAnnotationDoesNotSaveAnImage() {
        when(worker.render(anyString(), any(), any(), anyString(), any(), anyBoolean())).thenReturn(Map.of("status", "PENDING"));
        assertThat(service.render(user, request(true))).containsEntry("status", "PENDING");
        verify(media, never()).put(anyString(), any(), anyString());
    }

    @Test void validatedResultIsSavedUnderNewOwnerKeyWithoutReplacingOriginal() {
        output(image);
        when(media.put(anyString(), any(), eq("image/png"))).thenAnswer(invocation ->
                new MediaStoragePort.StoredObject(invocation.getArgument(0), "/media/new-result.png", image.length, "image/png"));
        assertThat(service.render(user, request(true))).containsEntry("url", "/media/new-result.png")
                .containsEntry("physicalFitCertified", false);
        verify(media).put(startsWith("users/"+userId+"/tryon/anatomical-"), eq(image), eq("image/png"));
        verify(worker).render(eq("piece:"+pieceId), eq(image), eq(image), eq("upper_piece"), isNull(), eq(false));
        verify(wardrobe).owned(user, pieceId);
        verifyNoMoreInteractions(wardrobe);
    }

    @Test void pngSignatureAloneIsNotAcceptedAsAnImage() {
        output(new byte[]{(byte)137,80,78,71,13,10,26,10});
        assertThatThrownBy(() -> service.render(user, request(true)))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("VTON_INVALID_IMAGE"));
        verify(media, never()).put(anyString(), any(), anyString());
    }

    @Test void oversizedDimensionsAreRejectedBeforeSaving() throws Exception {
        output(png(1600, 20));
        assertThatThrownBy(() -> service.render(user, request(true)))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status()).isEqualTo(502));
        verify(media, never()).put(anyString(), any(), anyString());
    }
    @Test void poseProbeRequiresConsentBeforeReadingPhoto() {
        assertThatThrownBy(() -> service.probe(user, new AnatomicalTryOnService.PersonRequest(photo,false)))
                .isInstanceOf(ApiException.class);
        verifyNoInteractions(worker, media);
    }

    @Test void poseProbeNeverAcceptsAnotherUsersPhoto() {
        when(media.requireOwnedMedia(any(), anyString(), anySet(), anyString())).thenThrow(ApiException.forbidden("Not owned"));
        assertThatThrownBy(() -> service.probe(user, new AnatomicalTryOnService.PersonRequest(photo,true)))
                .isInstanceOf(ApiException.class);
        verifyNoInteractions(worker);
    }

    @Test void poseProbeReturnsPartialEvidenceWithoutClaimingCompleteFit() {
        when(worker.probePerson(image)).thenReturn(Map.of("status","POSE_ONLY","physicalFitCertified",false));
        assertThat(service.probe(user, new AnatomicalTryOnService.PersonRequest(photo,true)))
                .containsEntry("status","POSE_ONLY").containsEntry("physicalFitCertified",false);
        verify(media, never()).put(anyString(), any(), anyString());
    }

}
