package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.repository.LensDetectionRepository;
import br.com.fashionai.domain.repository.LensScanRepository;

import java.util.List;
import java.util.UUID;

/**
 * Acesso privado ao scan: só o dono o enxerga (qualquer outra pessoa recebe 404, nunca 403), as peças dele e a imagem
 * gravada em {@code restricted/}.
 */
final class LensScanAccess {
    private final LensScanRepository scans;
    private final LensDetectionRepository detections;
    private final MediaStoragePort storage;

    LensScanAccess(LensScanRepository scans, LensDetectionRepository detections, MediaStoragePort storage) {
        this.scans = scans;
        this.detections = detections;
        this.storage = storage;
    }

    /** O scan do dono, ou 404 para qualquer outra pessoa (nunca 403: não revela que existe). */
    LensScan owned(CurrentUser user, UUID id) {
        requireUser(user);
        if (id == null) {
            throw ApiException.notFound(Msg.t("lens.scan"));
        }
        return scans.findByIdAndUserId(id, user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("lens.scan")));
    }

    LensDetection ownedDetection(LensScan scan, UUID detectionId) {
        if (detectionId == null) {
            throw ApiException.notFound(Msg.t("lens.deteccao"));
        }
        return detections.findByIdAndScanId(detectionId, scan.getId())
                .orElseThrow(() -> ApiException.notFound(Msg.t("lens.deteccao")));
    }

    /** Sem {@code detectionId}, as peças ativas do scan; com ele, só essa peça do scan (senão 404). */
    List<LensDetection> targets(LensScan scan, UUID detectionId) {
        return detectionId == null ? active(scan.getId()) : List.of(ownedDetection(scan, detectionId));
    }

    List<LensDetection> active(UUID scanId) {
        return detections.findByScanIdOrderByOrdinalAsc(scanId).stream().filter(d -> d.getDismissedAt() == null).toList();
    }

    List<LensDetection> all(LensScan scan) {
        return detections.findByScanIdOrderByOrdinalAsc(scan.getId());
    }

    /** Imagem gravada do scan; {@code thumb} = miniatura. Ausente ou ilegível no storage: 404. */
    byte[] image(LensScan scan, boolean thumb) {
        String key = thumb && scan.getThumbKey() != null ? scan.getThumbKey() : scan.getImageKey();
        if (key == null) {
            throw ApiException.notFound(Msg.t("lens.imagem"));
        }
        try {
            byte[] bytes = storage.get(key);
            if (bytes == null) {
                throw ApiException.notFound(Msg.t("lens.imagem"));
            }
            return bytes;
        } catch (ApiException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw ApiException.notFound(Msg.t("lens.imagem"));
        }
    }

    static void requireUser(CurrentUser user) {
        if (user == null) {
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
    }
}
