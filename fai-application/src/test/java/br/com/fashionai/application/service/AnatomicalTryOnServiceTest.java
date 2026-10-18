package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.AnatomicalTryOnPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.List;
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
    private final CatalogProductRepository products = mock(CatalogProductRepository.class);
    private final CatalogImageRepository catalogImages = mock(CatalogImageRepository.class);
    private final AnatomicalTryOnService service = new AnatomicalTryOnService(worker, wardrobe, legacy, media, guard, products, catalogImages);
    private byte[] image;

    @BeforeEach void prepare() throws Exception {
        image = png(32, 40);
        when(user.id()).thenReturn(userId);
        when(piece.getId()).thenReturn(pieceId);
        when(piece.getCategory()).thenReturn("upper_piece");
        when(wardrobe.owned(user, pieceId)).thenReturn(piece);
        when(media.requireOwnedMedia(userId, photo, Set.of(MediaService.MediaScope.OWNER, MediaService.MediaScope.PRIVATE_TRY_ON), "personMediaUrl"))
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

    @Test void lookIsDressedOnePieceAtATimeBottomThenTopOverThePreviousResult() throws Exception {
        UUID bottomId = UUID.randomUUID(), shoesId = UUID.randomUUID();
        WardrobeItem bottom = mock(WardrobeItem.class), shoes = mock(WardrobeItem.class);
        when(bottom.getId()).thenReturn(bottomId); when(bottom.getCategory()).thenReturn("lower_piece");
        when(shoes.getId()).thenReturn(shoesId); when(shoes.getCategory()).thenReturn("shoes_piece");
        when(wardrobe.owned(user, bottomId)).thenReturn(bottom); when(wardrobe.owned(user, shoesId)).thenReturn(shoes);
        when(legacy.imageBytes(bottom)).thenReturn(image);
        output(image);
        String step1 = "/media/users/" + userId + "/tryon/step-1.png", step2 = "/media/users/" + userId + "/tryon/step-2.png";
        when(media.put(anyString(), any(), eq("image/png"))).thenReturn(
                new MediaStoragePort.StoredObject("users/" + userId + "/tryon/step-1.png", step1, image.length, "image/png"),
                new MediaStoragePort.StoredObject("users/" + userId + "/tryon/step-2.png", step2, image.length, "image/png"));
        when(media.requireOwnedMedia(userId, step1, Set.of(MediaService.MediaScope.OWNER, MediaService.MediaScope.PRIVATE_TRY_ON), "personMediaUrl"))
                .thenReturn(new MediaService.OwnedMedia("users/" + userId + "/tryon/step-1.png", step1));
        when(media.read(step1)).thenReturn(Optional.of(image));

        var result = service.renderLook(user, new AnatomicalTryOnService.LookRequest(List.of(pieceId, shoesId, bottomId), photo, true));

        assertThat(result).containsEntry("status", "READY").containsEntry("url", step2).containsEntry("skipped", List.of(shoesId.toString()));
        var order = inOrder(worker);
        order.verify(worker).render(eq("piece:" + bottomId), eq(image), eq(image), eq("lower_piece"), isNull(), eq(false));
        order.verify(worker).render(eq("piece:" + pieceId), eq(image), eq(image), eq("upper_piece"), isNull(), eq(false));
        verify(media).requireOwnedMedia(userId, step1, Set.of(MediaService.MediaScope.OWNER, MediaService.MediaScope.PRIVATE_TRY_ON), "personMediaUrl");   // a 2ª etapa parte do resultado da 1ª
        verify(media, never()).put(eq("users/" + userId + "/photo.png"), any(), any());                       // a foto original fica
    }

    @Test void lookWithoutGarmentsTheModelCanWearIsRejectedBeforeAnyWorkerCall() {
        UUID shoesId = UUID.randomUUID(); WardrobeItem shoes = mock(WardrobeItem.class);
        when(shoes.getCategory()).thenReturn("shoes_piece"); when(wardrobe.owned(user, shoesId)).thenReturn(shoes);
        assertThatThrownBy(() -> service.renderLook(user, new AnatomicalTryOnService.LookRequest(List.of(shoesId), photo, true)))
                .isInstanceOf(ApiException.class).hasFieldOrPropertyWithValue("status", 422);
        assertThatThrownBy(() -> service.renderLook(user, new AnatomicalTryOnService.LookRequest(List.of(pieceId), photo, false)))
                .isInstanceOf(ApiException.class);
        verifyNoInteractions(worker);
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

    // ---- peças das lojas do catálogo -------------------------------------------------------------------------------

    private CatalogProduct product(UUID id, String category) {
        CatalogProduct product = new CatalogProduct();
        product.setCategory(category);
        when(products.findById(id)).thenReturn(Optional.of(product));
        return product;
    }

    /** Foto canônica aprovada, gravada com autorização; {@code metrics} decide se há pessoa. */
    private CatalogImage catalogPhoto(UUID productId, String metrics, String assets) {
        CatalogImage photo = new CatalogImage();
        photo.setProductId(productId);
        photo.setCanonical(true);
        photo.setProcessingStatus("APPROVED");
        photo.setUsageStatus(CatalogImageUsage.PERSISTED);
        photo.setStoredUrl("/media/catalog/" + productId + "/master.png");
        photo.setMetricsJson(metrics);
        photo.setAssetsJson(assets);
        when(catalogImages.findByProductIdInAndCanonicalTrue(List.of(productId))).thenReturn(List.of(photo));
        when(media.read(photo.getStoredUrl())).thenReturn(Optional.of(image));
        return photo;
    }

    private static final String SEM_PESSOA = "{\"debug\":{\"sourceHumanEvidence\":0.0,\"productFrame\":{\"model\":false}}}";

    @Test void storePieceIsDressedWithItsProductPhotoWithoutAPerson() {
        UUID productId = UUID.randomUUID();
        product(productId, "upper_piece");
        catalogPhoto(productId, SEM_PESSOA, null);
        output(image);
        when(media.put(anyString(), any(), eq("image/png"))).thenAnswer(invocation ->
                new MediaStoragePort.StoredObject(invocation.getArgument(0), "/media/store-result.png", image.length, "image/png"));

        var result = service.renderLook(user, new AnatomicalTryOnService.LookRequest(List.of(), List.of(productId), photo, true));

        assertThat(result).containsEntry("status", "READY").containsEntry("url", "/media/store-result.png");
        verify(worker).render(eq("catalog:" + productId), eq(image), eq(image), eq("upper_piece"), isNull(), eq(false));
        verify(media).put(startsWith("users/" + userId + "/tryon/anatomical-"), eq(image), eq("image/png"));
        verifyNoInteractions(wardrobe);
    }

    @Test void storePhotoWithAModelOrWithoutThePersonCheckNeverReachesTheGpu() {
        UUID worn = UUID.randomUUID(), unmeasured = UUID.randomUUID(), forced = UUID.randomUUID();
        product(worn, "upper_piece");
        catalogPhoto(worn, "{\"debug\":{\"sourceHumanEvidence\":0.0,\"productFrame\":{\"model\":true}}}", null);
        product(unmeasured, "upper_piece");
        catalogPhoto(unmeasured, "{\"debug\":{}}", null);
        product(forced, "upper_piece");
        catalogPhoto(forced, SEM_PESSOA, "{\"persistenceDecision\":{\"mode\":\"FORCED_CATEGORY_FRAME\"}}");

        for (UUID id : List.of(worn, unmeasured, forced)) {
            assertThatThrownBy(() -> service.renderLook(user, new AnatomicalTryOnService.LookRequest(List.of(), List.of(id), photo, true)))
                    .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("VTON_CATALOG_IMAGE_UNAVAILABLE"));
        }
        verifyNoInteractions(worker);
    }

    @Test void lookMixesWardrobeBottomAndStoreTopInTheModelOrder() throws Exception {
        UUID bottomId = UUID.randomUUID(), productId = UUID.randomUUID();
        WardrobeItem bottom = mock(WardrobeItem.class);
        when(bottom.getId()).thenReturn(bottomId); when(bottom.getCategory()).thenReturn("lower_piece");
        when(wardrobe.owned(user, bottomId)).thenReturn(bottom);
        when(legacy.imageBytes(bottom)).thenReturn(image);
        product(productId, "upper_piece");
        catalogPhoto(productId, SEM_PESSOA, null);
        output(image);
        String step1 = "/media/users/" + userId + "/tryon/step-1.png", step2 = "/media/users/" + userId + "/tryon/step-2.png";
        when(media.put(anyString(), any(), eq("image/png"))).thenReturn(
                new MediaStoragePort.StoredObject("users/" + userId + "/tryon/step-1.png", step1, image.length, "image/png"),
                new MediaStoragePort.StoredObject("users/" + userId + "/tryon/step-2.png", step2, image.length, "image/png"));
        when(media.requireOwnedMedia(userId, step1, Set.of(MediaService.MediaScope.OWNER, MediaService.MediaScope.PRIVATE_TRY_ON), "personMediaUrl"))
                .thenReturn(new MediaService.OwnedMedia("users/" + userId + "/tryon/step-1.png", step1));
        when(media.read(step1)).thenReturn(Optional.of(image));

        var result = service.renderLook(user, new AnatomicalTryOnService.LookRequest(List.of(bottomId), List.of(productId), photo, true));

        assertThat(result).containsEntry("status", "READY").containsEntry("url", step2);
        @SuppressWarnings("unchecked") var steps = (List<Map<String, Object>>) result.get("steps");
        assertThat(steps).extracting(step -> step.get("source")).containsExactly("wardrobe", "catalog");
        var order = inOrder(worker);
        order.verify(worker).render(eq("piece:" + bottomId), eq(image), eq(image), eq("lower_piece"), isNull(), eq(false));
        order.verify(worker).render(eq("catalog:" + productId), eq(image), eq(image), eq("upper_piece"), isNull(), eq(false));
    }
}
