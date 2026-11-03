package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.catalog.image.CatalogImagePipeline.Analysis;
import br.com.fashionai.application.imaging.ImageOps;

import java.awt.image.BufferedImage;
import java.util.List;
import java.util.Optional;

import static br.com.fashionai.application.catalog.image.CatalogImagePipeline.ACCEPTED_MIME;
import static br.com.fashionai.application.catalog.image.CatalogImagePipeline.sha256;
import static br.com.fashionai.application.catalog.image.CatalogImagePipeline.stage;

/**
 * Estágio VALIDATION do pipeline: tipo pelo conteúdo (magic bytes), tetos de bytes e de pixels antes do decode,
 * decode e lado mínimo. Devolve a foto decodificada ou a análise recusada com o motivo.
 */
final class CatalogSourceIntake {
    private CatalogSourceIntake() {
    }

    /** Foto aceita ({@code rejected == null}) ou recusada na validação ({@code image == null}). */
    record Decoded(String mime, String sha, BufferedImage image, Analysis rejected) {
        static Decoded rejected(Analysis analysis) {
            return new Decoded(analysis.mime(), analysis.sha256(), null, analysis);
        }
    }

    static Decoded decode(byte[] bytes, long t) {
        String mime = ImageOps.detectMime(bytes);
        String sha = sha256(bytes);
        if (mime == null || !ACCEPTED_MIME.contains(mime)) {
            return Decoded.rejected(Analysis.rejected("UNSUPPORTED_MIME", mime, 0, 0, sha, List.of(stage("VALIDATION", t, "mime"))));
        }
        if (bytes.length > ImageOps.MAX_UPLOAD_BYTES) {
            return Decoded.rejected(Analysis.rejected("IMAGE_TOO_LARGE", mime, 0, 0, sha, List.of(stage("VALIDATION", t, "bytes"))));
        }
        Optional<ImageOps.Dimensions> dims = ImageOps.dimensions(bytes);
        if (dims.isPresent() && ((long) dims.get().width() * dims.get().height() > ImageOps.maxPixels()
                || Math.max(dims.get().width(), dims.get().height()) > ImageOps.maxSide())) {
            return Decoded.rejected(Analysis.rejected("IMAGE_TOO_LARGE", mime, dims.get().width(), dims.get().height(), sha, List.of(stage("VALIDATION", t, "pixels"))));
        }
        BufferedImage src;
        try {
            src = ImageOps.decode(bytes);
        } catch (RuntimeException e) {
            return Decoded.rejected(Analysis.rejected("UNREADABLE_IMAGE", mime, 0, 0, sha, List.of(stage("VALIDATION", t, "decode"))));
        }
        int w = src.getWidth(), h = src.getHeight();
        if (Math.min(w, h) < ImageQualityAnalyzer.MIN_SOURCE_SIDE) {
            return Decoded.rejected(Analysis.rejected("IMAGE_TOO_SMALL", mime, w, h, sha, List.of(stage("VALIDATION", t, w + "x" + h))));
        }
        return new Decoded(mime, sha, src, null);
    }
}
