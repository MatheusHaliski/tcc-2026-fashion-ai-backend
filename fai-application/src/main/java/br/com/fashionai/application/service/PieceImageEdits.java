package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;

import java.awt.image.BufferedImage;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Troca da imagem de uma peça já cadastrada: imagem editada no Canvas 2D (RF15.CA02), fundo removido sob demanda
 * (RF18.CA05) e recorte reprocessado (RF4.CA06). Grava os arquivos, ajusta a peça e acompanha a foto de estúdio;
 * autorização, posse, auditoria e transação ficam no {@link WardrobeService}.
 */
final class PieceImageEdits {
    private final MediaService media;
    private final StudioShots shots;
    private final StudioVersionFlow versions;
    private final WardrobeStudio studio;

    PieceImageEdits(MediaService media, StudioShots shots, StudioVersionFlow versions, WardrobeStudio studio) {
        this.media = media;
        this.shots = shots;
        this.versions = versions;
        this.studio = studio;
    }

    /** Imagem editada: a original continua em "Minhas Fotos"; o estúdio acompanha (recorte) ou sai (foto opaca). */
    void replaceImage(UUID userId, UUID id, WardrobeItem w, byte[] bytes, UUID editedFromPhotoId) {
        String mime = ImageOps.requireAcceptedImage(bytes);
        BufferedImage img = ImageOps.decode(bytes);
        String base = "users/" + userId + "/pieces/" + id + "/edit-" + System.currentTimeMillis();
        MediaStoragePort.StoredObject stored = media.put(base + ".png", ImageOps.png(img), "image/png");
        BufferedImage thumbImg = ImageOps.composeCentered(ImageOps.crop(img, ImageOps.alphaBounds(img).empty()
                ? new ImageOps.Box(0, 0, img.getWidth(), img.getHeight()) : ImageOps.alphaBounds(img)), FlatLayPipeline.THUMB, 0.06,
                java.awt.Color.WHITE, false);
        MediaStoragePort.StoredObject thumb = media.put(base + "-thumb.png", ImageOps.png(thumbImg), "image/png");
        Photo p = media.register(w.getUser(), PhotoOrigin.EDITOR, id, stored, w.getOriginalImageUrl(), thumb.url(), bytes,
                img.getWidth(), img.getHeight(), null, ModerationStatus.APPROVED, Map.of("sourceMime", mime));
        p.setEditedFromPhotoId(editedFromPhotoId);
        // a original continua preservada em "Minhas Fotos" (RF15.CA02).
        w.setImageUrl(stored.url());
        w.setThumbnailUrl(thumb.url());
        w.setDefaultImage(false);
        // foto nova enviada pela pessoa tira o selo de IA; edição de uma foto existente (editedFromPhotoId) o mantém
        if (editedFromPhotoId == null) {
            w.setAiGeneratedImage(false);
        }
        w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
        // a foto de estúdio acompanha a imagem nova (recorte com transparência) ou sai (foto opaca não vai ao estúdio)
        Map<String, Object> editedMeta = new LinkedHashMap<>(Json.map(w.getFlatLayMetadataJson()));
        editedMeta.remove("studio_source_url");                                  // a fonte agora é a imagem editada
        w.setFlatLayMetadataJson(Json.write(editedMeta));
        if (PieceStudioHints.hasTransparency(img)) {
            studio.refresh(w, img, false, false);
        } else {
            versions.applyStudio(w, null, false);
        }
    }

    /** Resultado da remoção de fundo sob demanda: falha é informada sem travar as demais ferramentas. */
    Map<String, Object> removedBackground(UUID userId, UUID id, WardrobeItem w, FlatLayPipeline.Result r) {
        if (!r.backgroundRemoved()) {
            return Map.of("ok", false, "message", Msg.t("wardrobe.nao_foi_possivel_remover_o"),
                    "stages", r.stages());
        }
        String base = "users/" + userId + "/pieces/" + id + "/processed-" + System.currentTimeMillis();
        MediaStoragePort.StoredObject processed = media.put(base + ".png", r.processedPng(), "image/png");
        MediaStoragePort.StoredObject thumb = media.put(base + "-thumb.png", r.thumbnailPng(), "image/png");
        w.setImageUrl(processed.url());
        w.setThumbnailUrl(thumb.url());
        w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
        w.setFlatLayMetadataJson(Json.write(r.metadata()));
        w.setPhotoQualityScoresJson(Json.write(Map.of("overall", r.quality().overall(), "metrics", r.quality().metrics())));
        w.setFlatLayMetadataJson(Json.write(shots.withStudioSource(w, r, base)));
        studio.refresh(w, r.studioSource(), false, true);
        return Map.of("ok", true, "imageUrl", processed.url(), "thumbnailUrl", thumb.url(), "stages", r.stages());
    }

    /** Recorte que voltou no reprocessamento: a peça ganha a imagem sem fundo e o estúdio. */
    void reprocessed(WardrobeItem w, FlatLayPipeline.Result r) {
            String base = "users/" + w.getUser().getId() + "/pieces/" + w.getId() + "/reprocessed";
            w.setImageUrl(media.put(base + ".png", r.processedPng(), "image/png").url());
            w.setThumbnailUrl(media.put(base + "-thumb.png", r.thumbnailPng(), "image/png").url());
            w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
            w.setFlatLayMetadataJson(Json.write(r.metadata()));
            w.setFlatLayMetadataJson(Json.write(shots.withStudioSource(w, r, base)));
            studio.refresh(w, r.studioSource(), true, true);                 // agora com recorte: ganha o estúdio
    }
}
