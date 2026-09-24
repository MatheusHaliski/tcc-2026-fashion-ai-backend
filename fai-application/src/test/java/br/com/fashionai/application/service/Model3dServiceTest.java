package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.WebFetchPort;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.enums.PipelineJobStatus;
import br.com.fashionai.domain.model.enums.PipelineJobType;
import br.com.fashionai.domain.repository.PipelineJobRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** RF16 — estados do job, falha legível e reprocessamento grátis (uma vez, fora da cota). */
class Model3dServiceTest {

    private static final class Env {
        final List<PipelineJob> saved = new ArrayList<>();
        final List<UUID> quotaUsers = new ArrayList<>();
        final WardrobeItem piece = new WardrobeItem();
        final Map<String, byte[]> storage = new java.util.HashMap<>();
        Model3dService service;
    }

    private static byte[] jacketPng() {
        BufferedImage img = new BufferedImage(240, 300, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(0xE8DFCF));
        g.fillRoundRect(40, 20, 160, 260, 40, 40);
        g.dispose();
        return ImageOps.png(img);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Env env() {
        Env e = new Env();
        User owner = new User();
        owner.assignId(UUID.randomUUID());
        e.piece.assignId(UUID.randomUUID());
        e.piece.setUser(owner);
        e.piece.setName("Jaqueta");
        e.piece.setCategory("upper_piece");
        e.piece.setSubcategory("jacket");
        e.piece.setImageUrl("http://localhost:8080/media/p.png");
        e.storage.put(e.piece.getImageUrl(), jacketPng());

        WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
        when(pieces.findById(e.piece.getId())).thenReturn(Optional.of(e.piece));
        PipelineJobRepository jobs = mock(PipelineJobRepository.class);
        when(jobs.save(any())).thenAnswer(inv -> {
            PipelineJob j = inv.getArgument(0);
            if (j.getId() == null) {
                j.assignId(UUID.randomUUID());
                e.saved.add(0, j);                     // mais recente primeiro, como a consulta real
            }
            return j;
        });
        when(jobs.findById(any())).thenAnswer(inv -> e.saved.stream().filter(j -> j.getId().equals(inv.getArgument(0))).findFirst());
        when(jobs.findByTypeAndInputResourceIdOrderByCreatedAtDesc(eq(PipelineJobType.THREE_D_GENERATION), any())).thenAnswer(inv -> List.copyOf(e.saved));
        when(jobs.findByStatusOrderByQueuedAtAsc(any())).thenAnswer(inv -> e.saved.stream().filter(j -> j.getStatus() == inv.getArgument(0)).toList());
        MediaService media = mock(MediaService.class);
        when(media.read(any())).thenAnswer(inv -> Optional.ofNullable(e.storage.get((String) inv.getArgument(0))));
        when(media.put(anyString(), any(), anyString())).thenAnswer(inv -> new MediaStoragePort.StoredObject(inv.getArgument(0),
                "http://localhost:8080/media/" + inv.getArgument(0), 1, inv.getArgument(2)));
        AiEngine ai = mock(AiEngine.class);
        when(ai.execute(any(), any(), any(), any(), any(), any(), any())).thenAnswer(inv -> {
            e.quotaUsers.add(inv.getArgument(0));
            Object v = ((Supplier) inv.getArgument(6)).get();
            return new AiOutcome<>(v, null, AiCallResult.FALLBACK_LOCAL, true, "local", "local", 0, BigDecimal.ZERO, null, null, null);
        });
        TransactionTemplate tx = new TransactionTemplate() {
            @Override
            public <T> T execute(TransactionCallback<T> action) {
                return action.doInTransaction(null);
            }
        };
        WebFetchPort web = (url, max, accept) -> Optional.empty();
        e.service = new Model3dService(pieces, jobs, media, List.of(), web, ai, mock(FaiPointsService.class),
                mock(NotificationService.class), tx, true, 10);
        return e;
    }

    @Test
    void jobGoesFromQueuedToCompletedWithAValidGlb() {
        Env e = env();
        Map<String, Object> queued = e.service.request(e.piece);
        assertThat(queued.get("status")).isEqualTo("QUEUED");
        assertThat(queued.get("label")).isEqualTo("enfileirado");
        // pedir de novo com o job na fila não cria outro (CA04: o estado é o do servidor)
        e.service.request(e.piece);
        assertThat(e.saved).hasSize(1);

        e.service.tick();
        Map<String, Object> done = e.service.status(e.piece);
        assertThat(done.get("status")).isEqualTo("COMPLETED");
        assertThat(e.piece.getModel3dUrl()).endsWith(".glb");
        assertThat(e.saved.get(0).getStatus()).isEqualTo(PipelineJobStatus.COMPLETED);
        List<String> stages = Json.list(e.saved.get(0).getStagesJson()).stream().map(m -> String.valueOf(((Map<?, ?>) m).get("name"))).toList();
        assertThat(stages).contains("FOTO", "SILHUETA", "MALHA", "TEXTURA", "ARMAZENAMENTO");
        assertThat(e.quotaUsers).containsExactly(e.piece.getUser().getId());   // pedido normal consome cota
    }

    @Test
    void failureIsReadableAndOnlyTheFirstRetryIsFree() {
        Env e = env();
        byte[] png = e.storage.remove(e.piece.getImageUrl());               // a foto sumiu do armazenamento
        e.service.request(e.piece);
        e.service.tick();
        Map<String, Object> failed = e.service.status(e.piece);
        assertThat(failed.get("status")).isEqualTo("FAILED");
        assertThat((String) failed.get("error")).contains("não foi encontrada");
        assertThat(failed.get("canRetryFree")).isEqualTo(true);

        e.storage.put(e.piece.getImageUrl(), png);
        Map<String, Object> retry = e.service.request(e.piece);
        assertThat(retry.get("freeRetry")).isEqualTo(true);
        e.service.tick();
        assertThat(e.piece.getModel3dStatus()).isEqualTo(Model3dStatus.COMPLETED);
        assertThat(e.quotaUsers).containsExactly((UUID) null);                 // o grátis não entra na cota

        // o pedido seguinte já não é grátis, e uma nova falha não oferece outro reprocessamento sem custo
        Map<String, Object> again = e.service.request(e.piece);
        assertThat(again.get("freeRetry")).isEqualTo(false);
        e.service.tick();
        assertThat(e.quotaUsers).containsExactly(null, e.piece.getUser().getId());
        e.storage.clear();
        e.service.request(e.piece);
        e.service.tick();
        assertThat(e.service.status(e.piece).get("canRetryFree")).isEqualTo(false);
    }
}
