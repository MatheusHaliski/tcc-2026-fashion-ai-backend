package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.imaging.PhotoAcceptance;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.WardrobeService.CaptureAnalysis;
import br.com.fashionai.application.service.WardrobeService.Draft;
import br.com.fashionai.application.service.WardrobeService.Prefill;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.PipelineJobStatus;
import br.com.fashionai.domain.model.enums.PipelineJobType;
import br.com.fashionai.domain.repository.PipelineJobRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * RF4 — guarda o rascunho da análise: o job do Flat Lay, as imagens (original, recorte, fundo branco, miniatura, fonte do
 * estúdio), a foto de estúdio (nunca trava o cadastro) e o resultado que o cadastro da peça lê depois.
 */
final class DraftRecorder {
    private final PipelineJobRepository jobs;
    private final MediaService media;
    private final StudioShots shots;

    DraftRecorder(PipelineJobRepository jobs, MediaService media, StudioShots shots) {
        this.jobs = jobs;
        this.media = media;
        this.shots = shots;
    }

    CaptureAnalysis record(CurrentUser user, byte[] bytes, PieceDraftAnalyzer.Detection d) {
        User owner = d.owner();
        AiOutcome<FlatLayPipeline.Result> pipeline = d.pipeline();
        FlatLayPipeline.Result r = pipeline.value();
        AiOutcome<LocalVision.ModerationVerdict> moderation = d.moderation();
        LocalVision.ModerationVerdict verdict = moderation.value();
        AiOutcome<LocalVision.PieceGuess> analysis = d.analysis();
        List<PhotoAcceptance.Check> checks = d.checks();
        List<PhotoAcceptance.Check> failed = d.failed();
        Prefill prefill = d.prefill();
        double[] logoRel = d.logoRel();
        String logoSource = d.logoSource();
        PipelineJob job = new PipelineJob();
        job.setUser(owner);
        job.setType(PipelineJobType.FLAT_LAY_STANDARDIZATION);
        job.setStatus(PipelineJobStatus.COMPLETED);
        job.setTargetType("PIECE_DRAFT");
        job.setProvider(pipeline.provider());
        job.setQueuedAt(Instant.now());
        job.setStartedAt(Instant.now());
        jobs.save(job);
        String base = "users/" + owner.getId() + "/drafts/" + job.getId() + "/";
        byte[] originalClean = r.mimeType().equals("image/png") ? ImageOps.png(r.original()) : ImageOps.jpeg(r.original(), 0.95f);
        MediaStoragePort.StoredObject original = media.put(base + "original." + (r.mimeType().equals("image/png") ? "png" : "jpg"),
                originalClean, r.mimeType().equals("image/png") ? "image/png" : "image/jpeg");
        MediaStoragePort.StoredObject processed = media.put(base + "processed.png", r.processedPng(), "image/png");
        MediaStoragePort.StoredObject white = media.put(base + "flatlay.jpg", r.processedWhiteJpeg(), "image/jpeg");
        MediaStoragePort.StoredObject thumb = media.put(base + "thumb.png", r.thumbnailPng(), "image/png");

        // RF4 · Estúdio: foto de produto a partir da fonte em alta resolução, com o tipo da peça (manequim invisível),
        // os lados que a foto cortou (sangria) e o logo (foco) — nunca trava o cadastro (RNF8)
        String studioSourceUrl = null;
        Map<String, Object> studioInfo = null;
        if (r.backgroundRemoved()) {
            studioSourceUrl = media.put(base + "studio-source.png", ImageOps.png(r.studioSource()), "image/png").url();
            studioInfo = shots.studioShot(user.id(), r.studioSource(), "auto", base, new br.com.fashionai.application.imaging.StudioPipeline.Hints(
                    PieceStudioHints.studioKind(prefill.category(), prefill.subcategory()), r.truncated(), logoRel, logoSource,
                    br.com.fashionai.application.imaging.FeedFraming.template(prefill.category(), prefill.subcategory(), null),
                    prefill.category(), prefill.subcategory()));
        }

        Map<String, Object> quality = new LinkedHashMap<>();
        quality.put("metrics", r.quality().metrics());
        quality.put("overall", r.quality().overall());
        quality.put("accepted", r.quality().accepted());
        quality.put("threshold", br.com.fashionai.application.imaging.QualityMetrics.ACCEPTANCE_THRESHOLD);
        quality.put("issues", r.quality().issues());
        quality.put("recommendations", r.quality().recommendations());
        quality.put("acceptance", new PhotoAcceptance.Report(failed.isEmpty(), checks).toMap());
        Map<String, Object> mod = new LinkedHashMap<>();
        mod.put("status", verdict.status().name());
        mod.put("confidence", verdict.confidence());
        mod.put("reasons", verdict.reasons());
        mod.put("humanReview", verdict.needsHumanReview());
        mod.put("provider", moderation.provider());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("processedUrl", processed.url());
        result.put("flatLayUrl", white.url());
        result.put("thumbnailUrl", thumb.url());
        result.put("originalUrl", original.url());
        result.put("originalKey", original.key());
        result.put("mime", r.mimeType());
        result.put("width", r.originalWidth());
        result.put("height", r.originalHeight());
        result.put("bytes", bytes.length);
        result.put("hash", Hashing.sha256(bytes));
        result.put("backgroundRemoved", r.backgroundRemoved());
        if (r.cutout().warning() != null) {
            result.put("backgroundWarning", r.cutout().warning());
        }
        result.put("flatLayMetadata", r.metadata());
        result.put("quality", quality);
        result.put("moderation", mod);
        result.put("prefill", prefill);
        result.put("aiInferences", List.of(pipeline.inferenceId(), moderation.inferenceId(), analysis.inferenceId()));
        if (studioInfo != null) {
            result.put("studio", studioInfo);
        }
        if (studioSourceUrl != null) {
            result.put("studioSourceUrl", studioSourceUrl);
        }
        job.setResultJson(Json.write(result));
        job.setStagesJson(Json.write(r.stages()));
        job.setQualityScore(BigDecimal.valueOf(r.quality().overall()));
        job.setTotalCostUsd(r.totalCostUsd().add(moderation.costUsd()).add(analysis.costUsd()));
        job.setTotalTimeMs((int) r.totalMs());
        job.setFallbackUsed(r.fallbackUsed() || analysis.fallbackUsed());
        job.setOutputUrl(processed.url());
        job.setFinishedAt(Instant.now());
        String message = analysis.userMessage() != null ? analysis.userMessage() : pipeline.userMessage();
        Draft draftOut = new Draft(job.getId(), processed.url(), white.url(), thumb.url(), original.url(), prefill, quality, mod,
                r.stages(), job.getTotalCostUsd(), r.totalMs(), r.backgroundRemoved(), !r.backgroundRemoved(),
                analysis.explanation(), message, analysis.quota(), studioInfo, r.cutout().warning(), null);
        double rotation = r.metadata().get("perspective_correction_degrees") instanceof Number n ? n.doubleValue() : 0;
        return new CaptureAnalysis(draftOut, r.studioSource(), r.truncated(), logoRel, logoSource, d.guess(), d.ocr(), failed,
                List.copyOf(checks), rotation, r.cutout().confidence(), r.originalWidth(), r.originalHeight(), d.aiRan());
    }

    /** Recorte do rascunho para refazer estúdio ou marca: a fonte em alta resolução ou, sem ela, o recorte processado. */
    static byte[] cutout(MediaService media, Map<String, Object> r) {
        byte[] png = r.get("studioSourceUrl") == null ? null : media.read(String.valueOf(r.get("studioSourceUrl"))).orElse(null);
        if (png == null) {
            png = media.read((String) r.get("processedUrl")).orElseThrow(() -> ApiException.notFound(Msg.t("wardrobe.recorte_do_rascunho")));
        }
        return png;
    }
}
