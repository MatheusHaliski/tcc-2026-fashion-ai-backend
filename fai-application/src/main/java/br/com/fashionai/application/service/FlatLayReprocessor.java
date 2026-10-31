package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.PipelineJobStatus;
import br.com.fashionai.domain.model.enums.PipelineJobType;
import br.com.fashionai.domain.repository.PipelineJobRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.Instant;
import java.util.List;

/**
 * Job (RF4.CA06): reprocessa peças salvas com a foto original quando a remoção de fundo volta — pelo motor de IA (cota
 * do dono + teto de gasto), até 3 tentativas por job. Roda dentro da transação do {@link WardrobeService#reprocessPending}.
 */
final class FlatLayReprocessor {
    private final PipelineJobRepository jobs;
    private final WardrobeItemRepository pieces;
    private final FlatLayPipeline flatLay;
    private final AiEngine ai;
    private final MediaService media;
    private final NotificationService notifications;
    private final PieceImageEdits edits;

    FlatLayReprocessor(PipelineJobRepository jobs, WardrobeItemRepository pieces, FlatLayPipeline flatLay, AiEngine ai,
                       MediaService media, NotificationService notifications, PieceImageEdits edits) {
        this.jobs = jobs;
        this.pieces = pieces;
        this.flatLay = flatLay;
        this.ai = ai;
        this.media = media;
        this.notifications = notifications;
        this.edits = edits;
    }

    int run() {
        int done = 0;
        for (PipelineJob job : jobs.findByStatusOrderByQueuedAtAsc(PipelineJobStatus.PENDING)) {
            if (job.getType() != PipelineJobType.FLAT_LAY_STANDARDIZATION || job.getInputResourceId() == null) {
                continue;
            }
            WardrobeItem w = pieces.findById(job.getInputResourceId()).orElse(null);
            // sem provedor, com a IA remota desligada ou com o teto de gasto estourado, o item espera a próxima rodada
            if (w == null || !flatLay.externalAvailable() || !ai.remoteAllowed(w.getUser().getId(), AiCapability.FLAT_LAY_STANDARDIZER)) {
                continue;
            }
            job.setStatus(PipelineJobStatus.RUNNING);
            job.setAttempts(job.getAttempts() + 1);
            job.setStartedAt(Instant.now());
            try {
                byte[] bytes = media.read(w.getOriginalImageUrl()).orElse(null);
                if (bytes == null) {
                    job.setStatus(PipelineJobStatus.FAILED);
                    job.setErrorCode("SEM_ORIGINAL");
                    continue;
                }
                // pelo motor (cota do dono + teto de gasto): sem resposta remota não há recorte novo e o job segue pendente
                FlatLayPipeline.Result r = ai.execute(w.getUser().getId(), AiCapability.FLAT_LAY_STANDARDIZER,
                        List.of(Msg.t("wardrobe.foto_enviada_kb", bytes.length / 1024)), null, null, List.of(new FlatLayRemoteStep(flatLay, bytes)),
                        () -> (FlatLayPipeline.Result) null).value();
                if (r != null && r.backgroundRemoved()) {
                    edits.reprocessed(w, r);
                    job.setStatus(PipelineJobStatus.COMPLETED);
                    notifications.notify(w.getUser().getId(), null, NotificationType.AI_JOB_FINISHED, "PIECE", w.getId(),
                            Msg.k("wardrobe.foto_da_peca_padronizada"), Msg.k("wardrobe.o_fundo_de_foi_removido", w.getName()), null);
                    done++;
                } else {
                    job.setStatus(job.getAttempts() >= 3 ? PipelineJobStatus.FAILED : PipelineJobStatus.PENDING);
                }
            } catch (RuntimeException ex) {
                job.setStatus(job.getAttempts() >= 3 ? PipelineJobStatus.FAILED : PipelineJobStatus.PENDING);
                job.setErrorMessage(ex.getMessage());
            }
            job.setFinishedAt(Instant.now());
        }
        return done;
    }
}
