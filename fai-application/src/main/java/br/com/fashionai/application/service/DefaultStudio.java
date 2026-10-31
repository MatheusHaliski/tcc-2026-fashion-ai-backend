package br.com.fashionai.application.service;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.awt.image.BufferedImage;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.service.PieceStudioHints.currentFeedVersion;
import static br.com.fashionai.application.service.PieceStudioHints.studioKind;

/** Foto de estúdio da imagem padrão da peça (arte de {@code /public/assets_pecas}), gerada uma vez e reaproveitada. */
final class DefaultStudio {
    private final WardrobeItemRepository pieces;
    private final AssetCatalogService assets;
    private final StudioShots shots;
    private final StudioVersionFlow versions;

    DefaultStudio(WardrobeItemRepository pieces, AssetCatalogService assets, StudioShots shots, StudioVersionFlow versions) {
        this.pieces = pieces;
        this.assets = assets;
        this.shots = shots;
        this.versions = versions;
    }

    /**
     * RF4 · Estúdio da peça sem foto: a imagem padrão de {@code /public/assets_pecas} (arte da peça com o logo FAI) passa
     * pelo mesmo estúdio das fotos enviadas — a peça ocupa o quadro inteiro e o logo ganha a foto de detalhe. O resultado
     * é o mesmo para todas as peças que usam o arquivo, então é gerado uma vez e reaproveitado. Nunca usa a foto de
     * referência do estúdio como imagem padrão.
     */
    void defaultStudio(WardrobeItem w) {
        if (!w.isDefaultImage() || w.getImageUrl() == null) {
            return;
        }
        var done = pieces.findFirstByImageUrlAndDefaultImageTrueAndStudioImageUrlIsNotNull(w.getImageUrl());
        if (done.isPresent() && !done.get().getId().equals(w.getId()) && currentFeedVersion(done.get())) {
            WardrobeItem src = done.get();
            w.setStudioImageUrl(src.getStudioImageUrl());
            w.setStudioBackdrop(src.getStudioBackdrop());
            w.setStudioDetailUrl(src.getStudioDetailUrl());
            Map<String, Object> meta = new LinkedHashMap<>(Json.map(w.getFlatLayMetadataJson()));
            Object st = Json.map(src.getFlatLayMetadataJson()).get("studio");
            if (st != null) {
                meta.put("studio", st);
            }
            w.setFlatLayMetadataJson(Json.write(meta));
            return;
        }
        BufferedImage art;
        try {
            var file = assets.publicFile(w.getImageUrl());
            art = file.isEmpty() ? null : javax.imageio.ImageIO.read(file.get().toFile());
        } catch (java.io.IOException e) {
            art = null;
        }
        if (art == null) {
            return;
        }
        String stem = w.getImageUrl().replaceAll("^.*/", "").replaceAll("\\.[a-zA-Z]+$", "").replaceAll("[^A-Za-z0-9_-]", "_");
        Map<String, Object> info = shots.studioShot(w.getUser().getId(), art, "auto", "defaults/studio/" + stem + "/",
                new br.com.fashionai.application.imaging.StudioPipeline.Hints(studioKind(w.getCategory(), w.getSubcategory()), Set.of(),
                        assets.defaultPieceLogo(w.getImageUrl()).orElse(null), "catalogo",
                        br.com.fashionai.application.imaging.FeedFraming.template(w.getCategory(), w.getSubcategory(), null),
                        w.getCategory(), w.getSubcategory()));
        if (info != null) {
            versions.applyStudio(w, info, true);                         // arte padrão do catálogo: não há foto da pessoa a aprovar
        }
    }
}
