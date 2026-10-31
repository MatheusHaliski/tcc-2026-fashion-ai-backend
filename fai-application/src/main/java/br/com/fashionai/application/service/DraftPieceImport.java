package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.JobQueuePort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.service.WardrobeService.PieceForm;
import br.com.fashionai.domain.model.ModerationQueueItem;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.ProcessingJobLog;
import br.com.fashionai.domain.model.QualityScore;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ModerationQueueStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;
import br.com.fashionai.domain.model.enums.PipelineJobStatus;
import br.com.fashionai.domain.model.enums.PipelineJobType;
import br.com.fashionai.domain.repository.ModerationQueueRepository;
import br.com.fashionai.domain.repository.PipelineJobRepository;
import br.com.fashionai.domain.repository.ProcessingJobLogRepository;
import br.com.fashionai.domain.repository.QualityScoreRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * RF4 — peça criada a partir do rascunho da foto: imagens, moderação e metadados guardados na análise vão para a peça,
 * com o registro de qualidade, a foto em "Minhas Fotos", a fila de moderação (pendente) e o reprocessamento do fundo
 * (RF4.CA06). Roda dentro da transação do {@link WardrobeService#create}; não autoriza nada sozinho.
 */
final class DraftPieceImport {
    private final WardrobeItemRepository pieces;
    private final PipelineJobRepository jobs;
    private final QualityScoreRepository qualityScores;
    private final ProcessingJobLogRepository processingLogs;
    private final ModerationQueueRepository moderationQueue;
    private final MediaService media;
    private final JobQueuePort queue;

    DraftPieceImport(WardrobeItemRepository pieces, PipelineJobRepository jobs, QualityScoreRepository qualityScores,
                     ProcessingJobLogRepository processingLogs, ModerationQueueRepository moderationQueue, MediaService media,
                     JobQueuePort queue) {
        this.pieces = pieces;
        this.jobs = jobs;
        this.qualityScores = qualityScores;
        this.processingLogs = processingLogs;
        this.moderationQueue = moderationQueue;
        this.media = media;
        this.queue = queue;
    }

    /** Recusa conteúdo bloqueado (400 CONTEUDO_BLOQUEADO) antes de gravar qualquer coisa. */
    void importDraft(User owner, WardrobeItem w, PipelineJob draft, PieceForm form) {
        Map<String, Object> r = Json.map(draft.getResultJson());
        Map<?, ?> mod = (Map<?, ?>) r.getOrDefault("moderation", Map.of());
        Object modStatus = mod.get("status");
        ModerationStatus moderation = ModerationStatus.valueOf(modStatus == null ? "PENDING" : String.valueOf(modStatus));
        if (moderation == ModerationStatus.REJECTED_POLICY) {
            throw ApiException.badRequest("CONTEUDO_BLOQUEADO", Msg.t("wardrobe.a_foto_viola_a_politica"));
        }
        // recorte incerto que a pessoa conferiu e mandou ao estúdio mesmo assim ("usar mesmo assim") vale como recorte
        boolean forcedCut = r.get("studio") instanceof Map<?, ?> fs && Boolean.TRUE.equals(fs.get("forced"))
                && !Boolean.FALSE.equals(form.studio());
        boolean bgRemoved = Boolean.TRUE.equals(r.get("backgroundRemoved")) || forcedCut;
        w.setImageUrl(bgRemoved ? (String) r.get("processedUrl") : (String) r.get("originalUrl"));
        w.setOriginalImageUrl((String) r.get("originalUrl"));
        w.setThumbnailUrl((String) r.get("thumbnailUrl"));
        if (r.get("studio") instanceof Map<?, ?> st && st.get("url") != null && !Boolean.FALSE.equals(form.studio())) {
            w.setStudioImageUrl(String.valueOf(st.get("url")));
            w.setStudioBackdrop(st.get("backdrop") == null ? null : String.valueOf(st.get("backdrop")));
            w.setStudioDetailUrl(st.get("detailUrl") == null ? null : String.valueOf(st.get("detailUrl")));
        }
        w.setDefaultImage(false);
        w.setAiGeneratedImage(Boolean.TRUE.equals(r.get("aiGenerated")));
        w.setImageHash((String) r.get("hash"));
        w.setImageMimetype((String) r.get("mime"));
        w.setImageFileSize(r.get("bytes") instanceof Number n ? n.longValue() : null);
        w.setModerationStatus(moderation);
        w.setModerationConfidence(mod.get("confidence") instanceof Number n ? BigDecimal.valueOf(n.doubleValue()) : null);
        w.setModerationReasonsJson(Json.write(mod.get("reasons")));
        w.setPhotoProcessingStatus(bgRemoved ? PhotoProcessingStatus.COMPLETED : PhotoProcessingStatus.PROCESSING);
        w.setPhotoQualityScoresJson(Json.write(r.get("quality")));
        Map<String, Object> flatMeta = new LinkedHashMap<>(r.get("flatLayMetadata") instanceof Map<?, ?> fm
                ? Json.map(Json.write(fm)) : Map.of());
        // RF34 §5 — guarda a detecção da IA (valores + confiança) para o antifraude da Catalogação.
        if (r.get("prefill") instanceof Map<?, ?> pf) {
            flatMeta.put("detected", pf);
        }
        if (r.get("studioSourceUrl") != null) {
            flatMeta.put("studio_source_url", r.get("studioSourceUrl"));        // refazer o estúdio em alta depois
        }
        if (r.get("studio") instanceof Map<?, ?> st && !Boolean.FALSE.equals(form.studio())) {
            // a pessoa revisou a foto no cadastro e salvou: é a versão 1, aprovada
            Map<String, Object> info = new LinkedHashMap<>();
            st.forEach((k, v) -> info.put(String.valueOf(k), v));
            flatMeta.put("studio", StudioVersionMetadata.summary(info, 1, true));
        }
        w.setFlatLayMetadataJson(Json.write(flatMeta));
        w.setProcessingJobId(draft.getId());
        w.setProcessingTimeMs(draft.getTotalTimeMs());
        pieces.save(w);
        draft.setInputResourceId(w.getId());
        draft.setTargetType("PIECE");
        registerQuality(w, draft, r);
        registerPhotos(owner, w, r);
        if (moderation == ModerationStatus.PENDING) {
            ModerationQueueItem q = new ModerationQueueItem();
            q.setTargetType("PIECE");
            q.setTargetId(w.getId());
            q.setUserId(owner.getId());
            q.setContentExcerpt(w.getName());
            q.setCategoriesJson(Json.write(mod.get("reasons")));
            q.setConfidence(w.getModerationConfidence());
            q.setStatus(ModerationQueueStatus.PENDING_REVIEW);
            moderationQueue.save(q);
        }
        if (!bgRemoved) {
            // RF4.CA06 — salva com a original e enfileira reprocessamento.
            PipelineJob reprocess = new PipelineJob();
            reprocess.setUser(owner);
            reprocess.setType(PipelineJobType.FLAT_LAY_STANDARDIZATION);
            reprocess.setStatus(PipelineJobStatus.PENDING);
            reprocess.setTargetType("PIECE_REPROCESS");
            reprocess.setInputResourceId(w.getId());
            reprocess.setInputJson(Json.write(Map.of("originalKey", String.valueOf(r.get("originalKey")))));
            reprocess.setQueuedAt(Instant.now());
            jobs.save(reprocess);
            queue.enqueue("flatlay-reprocess", reprocess.getId());
        }
    }

    private void registerQuality(WardrobeItem w, PipelineJob draft, Map<String, Object> r) {
        Map<?, ?> q = (Map<?, ?>) r.getOrDefault("quality", Map.of());
        QualityScore qs = new QualityScore();
        qs.setWardrobeItemId(w.getId());
        qs.setPipelineJobId(draft.getId());
        qs.setMetricsJson(Json.write(q.get("metrics")));
        qs.setOverall(q.get("overall") instanceof Number n ? BigDecimal.valueOf(n.doubleValue()) : BigDecimal.ZERO);
        qs.setAccepted(Boolean.TRUE.equals(q.get("accepted")));
        qs.setAcceptanceThreshold(BigDecimal.valueOf(br.com.fashionai.application.imaging.QualityMetrics.ACCEPTANCE_THRESHOLD));
        qs.setIssuesJson(Json.write(q.get("issues")));
        qs.setRecommendationsJson(Json.write(q.get("recommendations")));
        qualityScores.save(qs);
        ProcessingJobLog log = new ProcessingJobLog();   // id gerado pelo JPA (atribuir à mão vira merge e falha no Hibernate 6.6+)
        log.setPipelineJobId(draft.getId());
        log.setWardrobeItemId(w.getId());
        log.setUserId(w.getUser().getId());
        log.setJobType("FLAT_LAY_STANDARDIZATION");
        log.setStatus("COMPLETED");
        log.setTotalProcessingTimeMs(draft.getTotalTimeMs());
        log.setStageTimesJson(draft.getStagesJson());
        log.setFinalQualityScore(qs.getOverall());
        log.setTotalCostUsd(draft.getTotalCostUsd());
        log.setAccepted(qs.isAccepted());
        log.setFallbackUsed(draft.isFallbackUsed());
        log.setCreatedAt(draft.getQueuedAt() == null ? Instant.now() : draft.getQueuedAt());
        log.setCompletedAt(Instant.now());
        processingLogs.save(log);
    }

    private void registerPhotos(User owner, WardrobeItem w, Map<String, Object> r) {
        String originalUrl = (String) r.get("originalUrl");
        media.read(originalUrl).ifPresent(bytes -> {
            MediaStoragePort.StoredObject stored = new MediaStoragePort.StoredObject((String) r.get("originalKey"), originalUrl,
                    bytes.length, (String) r.get("mime"));
            media.register(owner, PhotoOrigin.WARDROBE_ITEM, w.getId(), stored, originalUrl, (String) r.get("thumbnailUrl"), bytes,
                    r.get("width") instanceof Number n ? n.intValue() : null, r.get("height") instanceof Number n2 ? n2.intValue() : null,
                    w.getPhotoQualityScoresJson() == null ? null : BigDecimal.valueOf(((Number) ((Map<?, ?>) r.get("quality")).get("overall")).doubleValue()),
                    w.getModerationStatus(), Map.of("kind", "original", "pieceName", w.getName()));
        });
    }
}
