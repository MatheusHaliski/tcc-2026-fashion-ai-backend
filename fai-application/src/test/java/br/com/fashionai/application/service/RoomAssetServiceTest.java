package br.com.fashionai.application.service;

import br.com.fashionai.application.common.*;
import br.com.fashionai.application.imaging.*;
import br.com.fashionai.application.ports.*;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.*;
import org.springframework.transaction.TransactionStatus;
import java.awt.image.BufferedImage;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.Consumer;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class RoomAssetServiceTest {
    static class Env {
        final User owner = new User();
        final UserRepository users = mock(UserRepository.class);
        final Guard guard = mock(Guard.class);
        final PipelineJobRepository jobs = mock(PipelineJobRepository.class);
        final RoomCatalogItemRepository catalog = mock(RoomCatalogItemRepository.class);
        final MediaStoragePort storage = mock(MediaStoragePort.class);
        final WebFetchPort web = mock(WebFetchPort.class);
        final ImageProviderPorts.Model3dPort meshy = mock(ImageProviderPorts.Model3dPort.class);
        final Map<UUID, PipelineJob> saved = new LinkedHashMap<>();
        final Map<String, byte[]> objects = new HashMap<>();
        final RoomAssetService service;
        final CurrentUser admin;
        @SuppressWarnings("unchecked") Env() {
            owner.assignId(UUID.randomUUID());
            admin = new CurrentUser(owner.getId(), "admin", "ADMIN", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, "", "");
            when(users.lockById(owner.getId())).thenReturn(Optional.of(owner));
            when(meshy.providerId()).thenReturn("meshy"); when(meshy.available()).thenReturn(true);
            when(meshy.submit(any())).thenReturn(Optional.of("meshy-task-1"));
            when(jobs.findByTypeAndInputResourceIdOrderByCreatedAtDesc(any(), any())).thenAnswer(i -> saved.values().stream().filter(j -> j.getInputResourceId().equals(i.getArgument(1))).toList());
            when(jobs.findTop20ByTypeAndStatusInOrderByQueuedAtAsc(any(), any())).thenAnswer(i -> saved.values().stream().filter(j -> ((Collection<?>)i.getArgument(1)).contains(j.getStatus())).toList());
            when(jobs.findByIdForUpdate(any())).thenAnswer(i -> Optional.ofNullable(saved.get(i.getArgument(0))));
            when(jobs.saveAndFlush(any())).thenAnswer(i -> save(i.getArgument(0))); when(jobs.save(any())).thenAnswer(i -> save(i.getArgument(0)));
            when(storage.put(anyString(), any(), anyString())).thenAnswer(i -> { String k = i.getArgument(0); byte[] b = i.getArgument(1); objects.put(k, b); return new MediaStoragePort.StoredObject(k, "https://storage.example/" + k, b.length, i.getArgument(2)); });
            when(storage.get(anyString())).thenAnswer(i -> objects.get(i.getArgument(0)));
            TransactionTemplate tx = mock(TransactionTemplate.class);
            when(tx.execute(any())).thenAnswer(i -> ((TransactionCallback<?>)i.getArgument(0)).doInTransaction(mock(TransactionStatus.class)));
            doAnswer(i -> { ((Consumer<TransactionStatus>)i.getArgument(0)).accept(mock(TransactionStatus.class)); return null; }).when(tx).executeWithoutResult(any());
            service = new RoomAssetService(guard, users, jobs, catalog, storage, web, List.of(meshy), tx);
        }
        PipelineJob save(PipelineJob j) { if (j.getId() == null) j.assignId(UUID.randomUUID()); saved.put(j.getId(), j); return j; }
        PipelineJob create(UUID request) {
            service.create(admin, new RoomAssetService.Command(request, "Tapete FAI", "RUG", "TAP-RND", 0, 100, "ESTREIA", null), png());
            return saved.values().iterator().next();
        }
        PipelineJob complete() {
            PipelineJob j = create(UUID.randomUUID()); service.tick();
            byte[] glb = ReliefModelGenerator.generate(ImageOps.decode(png()), .5).glb();
            when(meshy.poll("meshy-task-1")).thenReturn(Optional.of(new ImageProviderPorts.TaskStatus("SUCCEEDED", 100, "https://provider.example/model.glb", null)));
            when(web.get(anyString(), anyInt(), isNull())).thenReturn(Optional.of(new WebFetchPort.Fetched("https://provider.example/model.glb", "model/gltf-binary", glb)));
            service.tick(); return j;
        }
    }
    static byte[] png() { BufferedImage img = new BufferedImage(32, 32, BufferedImage.TYPE_INT_ARGB); var g = img.createGraphics(); g.setColor(java.awt.Color.BLUE); g.fillRect(2, 2, 28, 28); g.dispose(); return ImageOps.png(img); }

    @Test void duplicateRequestOnlyQueuesAndSubmitsOnce() {
        Env e = new Env(); UUID request = UUID.randomUUID(); e.create(request); e.create(request);
        assertThat(e.saved).hasSize(1); verify(e.meshy, never()).submit(any());
        e.service.tick(); e.service.tick(); verify(e.meshy, times(1)).submit(any());
    }
    @Test void importsExistingMeshyTaskWithoutSubmittingAgainAndStillRequiresReview() {
        Env e = new Env(); String task = "01a12de8-3441-760d-b984-f7268bf1f493";
        var command = new RoomAssetService.Command(UUID.randomUUID(), "Cama FAI", "BED", "BED-DBL", 280, 650, "ESTREIA", null);
        e.service.importMeshy(e.admin, command, png(), task); e.service.importMeshy(e.admin, command, png(), task);
        byte[] glb = ReliefModelGenerator.generate(ImageOps.decode(png()), .5).glb();
        when(e.meshy.poll(task)).thenReturn(Optional.of(new ImageProviderPorts.TaskStatus("SUCCEEDED", 100, "https://provider.example/bed.glb", null)));
        when(e.web.get(anyString(), anyInt(), isNull())).thenReturn(Optional.of(new WebFetchPort.Fetched("https://provider.example/bed.glb", "model/gltf-binary", glb)));
        e.service.tick(); PipelineJob j = e.saved.values().iterator().next();
        assertThat(j.getStatus()).isEqualTo(PipelineJobStatus.COMPLETED); assertThat(e.saved).hasSize(1);
        verify(e.meshy, never()).submit(any());
        assertThatThrownBy(() -> e.service.publish(e.admin, j.getId())).isInstanceOf(ApiException.class).extracting("code").isEqualTo("ASSET_REVIEW_REQUIRED");
        assertThatThrownBy(() -> e.service.create(e.admin, command, png())).isInstanceOf(ApiException.class).extracting("code").isEqualTo("ASSET_REQUEST_CHANGED");
    }
    @Test void reusedRequestWithChangedParametersCannotConsumeAnotherGeneration() {
        Env e = new Env(); UUID request = UUID.randomUUID(); e.create(request);
        assertThatThrownBy(() -> e.service.create(e.admin,
                new RoomAssetService.Command(request, "Outro tapete", "RUG", "TAP-RND", 0, 100, "ESTREIA", null), png()))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("ASSET_REQUEST_CHANGED");
        assertThat(e.saved).hasSize(1);
        verify(e.meshy, never()).submit(any());
    }
    @Test void completionStoresGlbAndRequiresReviewBeforePublishing() {
        Env e = new Env(); PipelineJob j = e.complete();
        assertThat(j.getStatus()).isEqualTo(PipelineJobStatus.COMPLETED);
        assertThat(j.getOutputUrl()).startsWith("https://storage.example/room-assets/models/");
        assertThatThrownBy(() -> e.service.publish(e.admin, j.getId())).isInstanceOf(ApiException.class).extracting("code").isEqualTo("ASSET_REVIEW_REQUIRED");
        verify(e.catalog, never()).saveAndFlush(any());
        e.service.review(e.admin, j.getId(), true); e.service.publish(e.admin, j.getId()); e.service.publish(e.admin, j.getId());
        var captor = org.mockito.ArgumentCaptor.forClass(RoomCatalogItem.class); verify(e.catalog, times(1)).saveAndFlush(captor.capture());
        RoomCatalogItem item = captor.getValue(); assertThat(item.getPricePoints()).isEqualTo(100);
        assertThat(Json.map(item.getFinishJson()).get("model3dUrl")).isEqualTo(j.getOutputUrl());
        e.service.tick(); verify(e.meshy, times(1)).submit(any());
    }
    @Test void rejectedModelCannotBePublished() {
        Env e = new Env(); PipelineJob j = e.complete(); e.service.review(e.admin, j.getId(), false);
        assertThatThrownBy(() -> e.service.publish(e.admin, j.getId())).isInstanceOf(ApiException.class);
        verify(e.catalog, never()).saveAndFlush(any());
    }
    @Test void ambiguousSubmitIsNeverAutomaticallyRetried() {
        Env e = new Env(); PipelineJob j = e.create(UUID.randomUUID()); when(e.meshy.submit(any())).thenReturn(Optional.empty());
        e.service.tick(); e.service.tick(); assertThat(j.getErrorCode()).isEqualTo("MESHY_SUBMISSION_UNCONFIRMED"); verify(e.meshy, times(1)).submit(any());
    }
    @Test void secondWorkerCannotSubmitOrPollWhileLeaseIsHeld() {
        Env e = new Env(); PipelineJob j = e.create(UUID.randomUUID());
        j.setStatus(PipelineJobStatus.RENDERING); j.setResultJson(Json.write(Map.of("lease", UUID.randomUUID().toString(), "leaseUntil", java.time.Instant.now().plusSeconds(120).toString())));
        e.service.tick(); verify(e.meshy, never()).submit(any()); verify(e.meshy, never()).poll(any());
    }
    @Test void expiredSubmissionLeaseFailsWithoutAnotherPaidTask() {
        Env e = new Env(); PipelineJob j = e.create(UUID.randomUUID()); j.setStatus(PipelineJobStatus.RENDERING);
        j.setResultJson(Json.write(Map.of("leaseUntil", java.time.Instant.now().minusSeconds(1).toString())));
        e.service.tick(); assertThat(j.getStatus()).isEqualTo(PipelineJobStatus.FAILED); verify(e.meshy, never()).submit(any());
    }
    @Test void missingProviderAndIncompatibleMetadataDoNotQueuePaidWork() {
        Env e = new Env(); when(e.meshy.available()).thenReturn(false);
        assertThatThrownBy(() -> e.create(UUID.randomUUID())).isInstanceOf(ApiException.class); assertThat(e.saved).isEmpty();
        when(e.meshy.available()).thenReturn(true);
        assertThatThrownBy(() -> e.service.create(e.admin, new RoomAssetService.Command(UUID.randomUUID(), "Ilha", "ISLAND", "ILH-BAN", 120, 100, "ESTREIA", null), png())).isInstanceOf(ApiException.class);
        assertThat(e.saved).isEmpty();
    }
    @Test void adminGuardRunsBeforeAnyUploadOrPaidCall() {
        Env e = new Env(); doThrow(ApiException.forbidden("denied")).when(e.guard).requireAdmin(e.admin);
        assertThatThrownBy(() -> e.create(UUID.randomUUID())).isInstanceOf(ApiException.class);
        verifyNoInteractions(e.storage); verify(e.meshy, never()).submit(any());
    }
    @Test void glbMustBeSelfContainedWithExactLength() {
        byte[] good = ReliefModelGenerator.generate(ImageOps.decode(png()), .5).glb(); RoomAssetService.validateGlb(good);
        assertThatThrownBy(() -> RoomAssetService.validateGlb(Arrays.copyOf(good, good.length - 1))).isInstanceOf(ApiException.class);
        byte[] json = "{\"asset\":{\"version\":\"2.0\"},\"meshes\":[{}],\"images\":[{\"uri\":\"https://external.example/texture.png\"}]}".getBytes(StandardCharsets.UTF_8);
        int n = (json.length + 3) & ~3; ByteBuffer b = ByteBuffer.allocate(20 + n).order(ByteOrder.LITTLE_ENDIAN);
        b.putInt(0x46546C67).putInt(2).putInt(20 + n).putInt(n).putInt(0x4E4F534A).put(json); while (b.hasRemaining()) b.put((byte)' ');
        assertThatThrownBy(() -> RoomAssetService.validateGlb(b.array())).isInstanceOf(ApiException.class).extracting("code").isEqualTo("GLB_EXTERNAL_RESOURCE");
    }
}
