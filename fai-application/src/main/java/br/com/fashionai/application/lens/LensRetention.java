package br.com.fashionai.application.lens;

import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensFeedback;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.repository.LensDetectionRepository;
import br.com.fashionai.domain.repository.LensFeedbackRepository;
import br.com.fashionai.domain.repository.LensScanRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Retenção do Lens: salvar como inspiração tira o prazo; sem salvar, o scan vence em 30 dias. Apagar remove imagem,
 * miniatura, peças detectadas e correções (scan, vencidos ou a conta inteira).
 */
final class LensRetention {
    private final LensScanRepository scans;
    private final LensDetectionRepository detections;
    private final LensFeedbackRepository feedback;
    private final MediaStoragePort storage;
    private final LensConfig config;

    LensRetention(LensScanRepository scans, LensDetectionRepository detections, LensFeedbackRepository feedback,
                  MediaStoragePort storage, LensConfig config) {
        this.scans = scans;
        this.detections = detections;
        this.feedback = feedback;
        this.storage = storage;
        this.config = config;
    }

    /** {@code saved} nulo não muda nada; salvar tira o prazo, desfazer devolve os 30 dias a partir de agora. */
    void setSaved(LensScan scan, Boolean saved) {
        if (saved != null) {
            if (saved && scan.getSavedAt() == null) {
                scan.setSavedAt(Instant.now());
                scan.setExpiresAt(null);
            } else if (!saved && scan.getSavedAt() != null) {
                scan.setSavedAt(null);
                scan.setExpiresAt(Instant.now().plus(Duration.ofDays(config.retentionDays())));
            }
            scans.save(scan);
        }
    }

    int purgeExpired(Instant now) {
        int count = 0;
        for (int round = 0; round < 50; round++) {
            List<LensScan> batch = scans.findTop200BySavedAtIsNullAndExpiresAtBefore(now);
            if (batch.isEmpty()) {
                break;
            }
            for (LensScan s : batch) {
                purge(s);
                count++;
            }
        }
        return count;
    }

    void deleteAllFor(UUID userId) {
        scans.findByUserId(userId).forEach(this::purge);
    }

    void purge(LensScan s) {
        deleteQuietly(s.getImageKey());
        deleteQuietly(s.getThumbKey());
        List<LensFeedback> fb = feedback.findByScanId(s.getId());
        if (!fb.isEmpty()) {
            feedback.deleteAll(fb);
        }
        List<LensDetection> ds = detections.findByScanIdOrderByOrdinalAsc(s.getId());
        if (!ds.isEmpty()) {
            detections.deleteAll(ds);
        }
        scans.delete(s);
    }

    private void deleteQuietly(String key) {
        if (key == null) {
            return;
        }
        try {
            storage.delete(key);
        } catch (RuntimeException ignored) {
            // objeto já ausente: idempotente
        }
    }
}
