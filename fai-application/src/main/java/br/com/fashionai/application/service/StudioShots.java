package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.StudioPipeline;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.WardrobeItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.awt.image.BufferedImage;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Geração da foto de estúdio (RF4) na governança de IA e os arquivos dela no storage: a fonte em alta resolução da peça
 * e a foto principal, miniatura, variante do feed, detalhe do logo e recorte realçado. Sem transação nem autorização:
 * quem chama é o {@link WardrobeService}.
 */
final class StudioShots {
    private static final Logger log = LoggerFactory.getLogger(WardrobeService.class);
    private final AiEngine ai;
    private final StudioPipeline studio;
    private final MediaService media;

    StudioShots(AiEngine ai, StudioPipeline studio, MediaService media) {
        this.ai = ai;
        this.studio = studio;
        this.media = media;
    }

    /** Metadados do Flat Lay refeito + a nova fonte do estúdio em alta resolução; a detecção da IA (logo) é mantida. */
    Map<String, Object> withStudioSource(WardrobeItem w, FlatLayPipeline.Result r, String base) {
        Map<String, Object> meta = new LinkedHashMap<>(r.metadata());
        Map<String, Object> old = Json.map(w.getFlatLayMetadataJson());
        Object detected = old.get("detected");
        if (detected != null) {
            meta.put("detected", detected);
        }
        if (old.get("studio") != null) {
            meta.put("studio", old.get("studio"));                       // versões e aprovação da foto de estúdio
        }
        meta.put("studio_source_url", media.put(base + "-studio-source.png", ImageOps.png(r.studioSource()), "image/png").url());
        return meta;
    }

    /** Fonte do estúdio da peça: o recorte em alta resolução guardado no cadastro ou, sem ele, a imagem atual. */
    BufferedImage studioSource(WardrobeItem w) {
        Object url = Json.map(w.getFlatLayMetadataJson()).get("studio_source_url");
        byte[] png = url == null ? null : media.read(String.valueOf(url)).orElse(null);
        if (png == null) {
            png = media.read(w.getImageUrl()).orElse(null);
        }
        return png == null ? null : ImageOps.decode(png);
    }

    /**
     * Roda o pipeline de estúdio na governança de IA (Photoroom/Stability → local) e guarda: foto principal (quadro
     * adaptado à peça), miniatura 640 px ({@code .thumb.jpg}), foto de detalhe do logo e recorte realçado.
     */
    Map<String, Object> studioShot(UUID userId, BufferedImage cutout, String backdrop, String basePath,
                                   br.com.fashionai.application.imaging.StudioPipeline.Hints hints) {
        try {
            AiOutcome<br.com.fashionai.application.imaging.StudioPipeline.Result> out = ai.execute(userId, AiCapability.STUDIO_ENHANCER,
                    List.of(Msg.t("common.recorte_da_peca_png_sem"), Msg.t("wardrobe.cor_de_fundo", backdrop)), null, null,
                    List.of(new AiEngine.RemoteStep<>() {
                        public String provider() {
                            return "photoroom/stability";
                        }

                        public String model() {
                            return "studio-hybrid";
                        }

                        public boolean available() {
                            return studio.externalAvailable();
                        }

                        public AiEngine.RemoteResult<br.com.fashionai.application.imaging.StudioPipeline.Result> call() {
                            var res = studio.run(cutout, backdrop, true, hints);
                            return new AiEngine.RemoteResult<>(res, res.costUsd(), Msg.t("wardrobe.estudio", res.backdrop().id()));
                        }
                    }), () -> studio.run(cutout, backdrop, false, hints));
            var res = out.value();
            long stamp = System.currentTimeMillis();
            String name = basePath + "studio-" + res.backdrop().id() + "-" + stamp;
            MediaStoragePort.StoredObject shot = media.put(name + ".jpg", res.studioJpeg(), "image/jpeg");
            media.put(name + ".thumb.jpg", res.thumbJpeg(), "image/jpeg");       // miniatura: mesma URL com ".thumb.jpg"
            media.put(name + ".feed.jpg", res.feedJpeg(), "image/jpeg");         // feed 4:5 por template: ".feed.jpg"
            String detailUrl = res.detailJpeg() == null ? null : media.put(name + ".detail.jpg", res.detailJpeg(), "image/jpeg").url();
            MediaStoragePort.StoredObject enhanced = media.put(basePath + "enhanced-" + stamp + ".png", res.enhancedPng(), "image/png");
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("url", shot.url());
            info.put("thumbUrl", Views.studioThumb(shot.url()));
            info.put("feedUrl", Views.studioFeed(shot.url()));
            info.put("feed", res.feed());
            info.put("detailUrl", detailUrl);
            info.put("enhancedUrl", enhanced.url());
            info.put("backdrop", res.backdrop().id());
            info.put("backdropLabel", res.backdrop().label());
            info.put("stages", res.stages());
            info.put("metrics", res.metrics());
            info.put("framing", res.framing());
            info.put("logo", res.logo());
            info.put("ghost", res.ghost());
            info.put("provider", out.provider());
            info.put("fallbackUsed", out.fallbackUsed() || res.fallbackUsed());
            info.put("costUsd", res.costUsd());
            return info;
        } catch (RuntimeException e) {
            log.warn("estúdio falhou (segue só com o Flat Lay): {}", e.toString());
            return null;
        }
    }
}
