package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.MultiPieceService;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.model.enums.LensIntent;
import br.com.fashionai.domain.model.enums.LensSource;
import br.com.fashionai.domain.repository.LensDetectionRepository;
import br.com.fashionai.domain.repository.LensScanRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.awt.image.BufferedImage;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Gravação de um scan novo: cota diária, detecção das peças, imagem limpa em {@code restricted/} e linhas de peça. */
final class LensScanRecorder {
    private static final Logger log = LoggerFactory.getLogger(LensService.class);
    private static final DateTimeFormatter HOUR = DateTimeFormatter.ofPattern("dd/MM HH:mm").withZone(ZoneId.of("America/Sao_Paulo"));

    private final LensScanRepository scans;
    private final LensDetectionRepository detections;
    private final MultiPieceService multiPiece;
    private final MediaStoragePort storage;
    private final RateLimitPort rateLimit;
    private final LensConfig config;
    private final LensViewAssembler views;
    private final LensRequestContext.Sources live;

    LensScanRecorder(LensScanRepository scans, LensDetectionRepository detections, MultiPieceService multiPiece,
                     MediaStoragePort storage, RateLimitPort rateLimit, LensConfig config, LensViewAssembler views,
                     LensRequestContext.Sources live) {
        this.scans = scans;
        this.detections = detections;
        this.multiPiece = multiPiece;
        this.storage = storage;
        this.rateLimit = rateLimit;
        this.config = config;
        this.views = views;
        this.live = live;
    }

    /** Cota diária por pessoa (RateLimitPort): estourada, 429 QUOTA com o horário de volta; nada é gravado. */
    void acquireQuota(CurrentUser user) {
        int limit = config.dailyScans();
        Duration day = Duration.ofDays(1);
        if (!rateLimit.tryAcquire(user.id(), LensService.QUOTA_BUCKET, limit, day)) {
            RateLimitPort.QuotaStatus st = rateLimit.status(user.id(), LensService.QUOTA_BUCKET, limit, day);
            Instant reset = st == null || st.resetAt() == null ? Instant.now().plus(day) : st.resetAt();
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("limit", limit);
            details.put("used", st == null ? limit : st.used());
            details.put("resetAt", reset.toString());
            throw new ApiException(429, "QUOTA", Msg.t("lens.cota_diaria", limit, HOUR.format(reset)), details);
        }
    }

    /**
     * Detecta, lê cada recorte, grava a imagem limpa e as peças; o scan sai pronto (MVP síncrono). Proveniência, estado
     * e linhas de peça vêm de {@link LensScanProvenance} (puro); aqui ficam a gravação e a devolução da cota.
     */
    LensViews.ScanView process(CurrentUser user, LensSource source, UUID refId, LensIntent intent, BufferedImage photo,
                               int faces, boolean redactionConfirmed) {
        MultiPieceService.PieceDetection det = null;
        try {
            // foto enviada sem a confirmação do borrão de rostos (cliente antigo, direto ou com falha) nunca vai para a IA
            // externa: a leitura fica local. As fotos do próprio app já passaram pelo cadastro e pela moderação.
            det = redactionConfirmed || source.inApp() ? multiPiece.detectPieces(user.id(), photo)
                    : LensScanProvenance.localDetection();
        } catch (RuntimeException ex) {
            log.warn("Lens: detecção falhou ({})", ex.toString());
        }

        LensScan scan = new LensScan();
        scan.setUserId(user.id());
        scan.setSource(source);
        scan.setSourceRefId(refId);
        scan.setIntent(intent);
        scan.setWidth(photo.getWidth());
        scan.setHeight(photo.getHeight());
        scan.setFacesRedacted(faces);
        scan.setRedactionConfirmed(redactionConfirmed);
        scan.setAlgorithmVersion(LensConfig.ALGORITHM_VERSION);
        scan.setExpiresAt(Instant.now().plus(Duration.ofDays(config.retentionDays())));
        scan.setProcessedAt(Instant.now());
        LensScanProvenance.stamp(scan, det);
        scans.save(scan);

        String base = "restricted/users/" + user.id() + "/lens/" + scan.getId();
        storage.put(base + ".jpg", ImageOps.jpeg(photo, 0.9f), "image/jpeg");
        storage.put(base + "-thumb.jpg", ImageOps.jpeg(ImageOps.scaleToFit(photo, LensConfig.THUMB_MAX_SIDE,
                LensConfig.THUMB_MAX_SIDE), 0.85f), "image/jpeg");
        scan.setImageKey(base + ".jpg");
        scan.setThumbKey(base + "-thumb.jpg");
        scans.save(scan);

        List<MultiPieceService.DetectedPiece> ordered = LensScanProvenance.readingOrder(det);
        List<LensDetection> saved = new ArrayList<>();
        for (int i = 0; i < ordered.size(); i++) {
            saved.add(detections.save(LensScanProvenance.fromDetected(scan.getId(), i, ordered.get(i), photo)));
        }
        if (det == null) {
            rateLimit.release(user.id(), LensService.QUOTA_BUCKET);          // falha nossa não consome a cota da pessoa
        }
        return views.view(live.open(user), scan, saved);
    }
}
