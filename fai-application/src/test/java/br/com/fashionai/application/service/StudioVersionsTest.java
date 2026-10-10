package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF4 · foto de estúdio com versão e aprovação: um processamento novo nunca troca em silêncio a foto aprovada — fica
 * pendente até o dono aprovar ou descartar; só o dono vê (e decide sobre) a versão pendente.
 */
class StudioVersionsTest {
    WardrobeService service;
    WardrobeItem piece;
    MediaService media;
    CurrentUser owner, stranger;

    @BeforeEach
    void setUp() {
        User u = new User("ana", "Ana", "ana@x.com", "h", "p", ProfileType.PESSOAL);
        u.assignId(UUID.randomUUID());
        owner = new CurrentUser(u.getId(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        stranger = new CurrentUser(UUID.randomUUID(), "bia", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        piece = new WardrobeItem();
        piece.assignId(UUID.randomUUID());
        piece.setUser(u);
        piece.setName("Camiseta The Best Plan");
        piece.setCategory("upper_piece");
        piece.setSubcategory("t_shirt");
        piece.setColor("red");
        piece.setVisibility(Visibility.PUBLIC);
        piece.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        piece.setModerationStatus(ModerationStatus.APPROVED);
        piece.setStudioImageUrl("http://media/v1/studio-royal-1.jpg");         // aprovada (legado: sem metadados)
        piece.setStudioBackdrop("royal");
        piece.setFlatLayMetadataJson(Json.write(Map.of("detected", Map.of("color", "red"))));
        WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
        when(pieces.findById(piece.getId())).thenReturn(Optional.of(piece));
        Guard guard = mock(Guard.class);
        doThrow(ApiException.forbidden("só o dono")).when(guard).requireOwner(eq(stranger), any(), anyString());
        media = mock(MediaService.class);
        service = new WardrobeService(pieces, null, null, null, null, null, null, null, null, mock(ReactionRepository.class),
                mock(SavedItemRepository.class), null, null, null, media, null, null, null, null, null, null, guard, mock(Audit.class),
                null, null, null, null, null, null, null);
    }

    static Map<String, Object> shot(String id) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("url", "http://media/" + id + "/studio.jpg");
        info.put("thumbUrl", "http://media/" + id + "/studio.thumb.jpg");
        info.put("feedUrl", "http://media/" + id + "/studio.feed.jpg");
        info.put("enhancedUrl", "http://media/" + id + "/enhanced.png");
        info.put("backdrop", "grafite");
        info.put("feed", Map.of("template", "UPPER", "landmarks", Map.of("collarY", 0.08)));
        info.put("framing", Map.of("fill", 0.82));
        info.put("provider", "local");
        return info;
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> studio() {
        return (Map<String, Object>) Json.map(piece.getFlatLayMetadataJson()).get("studio");
    }

    @Test
    void cachedDefaultStudioRequiresTheCurrentFabricFramingVersion() {
        assertThat(WardrobeService.currentFeedVersion(piece)).isFalse();
        piece.setFlatLayMetadataJson(Json.write(Map.of("studio", Map.of("feed", Map.of("pipelineVersion", "OLD")))));
        assertThat(WardrobeService.currentFeedVersion(piece)).isFalse();
        piece.setFlatLayMetadataJson(Json.write(Map.of("studio", Map.of("feed", Map.of("pipelineVersion", br.com.fashionai.application.imaging.GarmentCrop.VERSION)))));
        assertThat(WardrobeService.currentFeedVersion(piece)).isTrue();
    }

    @Test
    void reprocessingAnApprovedPhotoBecomesPendingAndTheApprovedOneStaysLive() {
        assertThat(service.offerStudio(piece, shot("v2"), false)).isEqualTo("pending");
        assertThat(piece.getStudioImageUrl()).isEqualTo("http://media/v1/studio-royal-1.jpg");
        assertThat(piece.getStudioBackdrop()).isEqualTo("royal");
        @SuppressWarnings("unchecked") Map<String, Object> pending = (Map<String, Object>) studio().get("pending");
        assertThat(pending).containsEntry("version", 2).containsEntry("approved", false)
                .containsEntry("url", "http://media/v2/studio.jpg").containsEntry("feedUrl", "http://media/v2/studio.feed.jpg")
                .containsEntry("enhancedUrl", "http://media/v2/enhanced.png").containsKey("feed").containsKey("framing");
        assertThat(Json.map(piece.getFlatLayMetadataJson())).containsKey("detected");     // o resto dos metadados fica
    }

    @Test
    void aNewerPendingReplacesTheOlderPendingAndDeletesItsFiles() {
        service.offerStudio(piece, shot("v2"), false);
        service.offerStudio(piece, shot("v3"), false);
        @SuppressWarnings("unchecked") Map<String, Object> pending = (Map<String, Object>) studio().get("pending");
        assertThat(pending).containsEntry("version", 3).containsEntry("url", "http://media/v3/studio.jpg");
        verify(media).deleteUrl("http://media/v2/studio.jpg");
        verify(media).deleteUrl("http://media/v2/studio.feed.jpg");
        verify(media, never()).deleteUrl("http://media/v1/studio-royal-1.jpg");
    }

    @Test
    void approvingPromotesThePendingVersionAndKeepsThePreviousInHistory() {
        service.offerStudio(piece, shot("v2"), false);
        Views.PieceView v = service.approveStudio(owner, piece.getId());
        assertThat(piece.getStudioImageUrl()).isEqualTo("http://media/v2/studio.jpg");
        assertThat(piece.getStudioBackdrop()).isEqualTo("grafite");
        assertThat(studio()).containsEntry("version", 2).containsEntry("approved", true).containsKey("approvedAt").doesNotContainKey("pending");
        @SuppressWarnings("unchecked") Map<String, Object> prev = (Map<String, Object>) studio().get("previous");
        assertThat(prev).containsEntry("url", "http://media/v1/studio-royal-1.jpg");
        assertThat(v.studioImageUrl()).isEqualTo("http://media/v2/studio.jpg");
    }

    @Test
    void discardingKeepsTheApprovedPhotoAndDeletesThePendingFiles() {
        service.offerStudio(piece, shot("v2"), false);
        service.discardStudio(owner, piece.getId());
        assertThat(piece.getStudioImageUrl()).isEqualTo("http://media/v1/studio-royal-1.jpg");
        assertThat(studio()).doesNotContainKey("pending");
        verify(media).deleteUrl("http://media/v2/studio.jpg");
        assertThatThrownBy(() -> service.discardStudio(owner, piece.getId())).isInstanceOf(ApiException.class);
    }

    @Test
    void onlyTheOwnerApprovesOrDiscards() {
        service.offerStudio(piece, shot("v2"), false);
        assertThatThrownBy(() -> service.approveStudio(stranger, piece.getId())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.discardStudio(stranger, piece.getId())).isInstanceOf(ApiException.class);
        assertThat(piece.getStudioImageUrl()).isEqualTo("http://media/v1/studio-royal-1.jpg");
        assertThat(studio()).containsKey("pending");
    }

    @Test
    void aNewSourcePhotoGoesLiveAwaitingApproval() {
        assertThat(service.offerStudio(piece, shot("nova"), true)).isEqualTo("applied");
        assertThat(piece.getStudioImageUrl()).isEqualTo("http://media/nova/studio.jpg");
        assertThat(studio()).containsEntry("approved", false).containsEntry("version", 2);
        service.approveStudio(owner, piece.getId());
        assertThat(studio()).containsEntry("approved", true);
    }

    @Test
    void visitorsNeverSeeThePendingVersion() {
        service.offerStudio(piece, shot("v2"), false);
        Map<String, Object> forVisitor = Views.piece(piece, Views.ViewerState.NONE, null).flatLayMetadata();
        Map<String, Object> forOwner = Views.piece(piece, new Views.ViewerState(false, java.util.List.of(), false, true, false), null).flatLayMetadata();
        assertThat(((Map<?, ?>) forVisitor.get("studio")).containsKey("pending")).isFalse();
        assertThat(((Map<?, ?>) forOwner.get("studio")).containsKey("pending")).isTrue();
    }
}
