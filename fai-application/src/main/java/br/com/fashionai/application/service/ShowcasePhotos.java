package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeGrouping;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.SchemeGroupingRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.ShowcaseService.MANNEQUIN_PHOTO_CATEGORIES;

/**
 * Fotos com o manequim (RF4 · RF5): a peça ou o look inteiro vestindo o manequim, renderizados no navegador e enviados
 * aqui (o servidor valida, recodifica e guarda), a remoção da foto, e a capa da era/coleção enviada pelo dono.
 */
final class ShowcasePhotos {
    private final WardrobeItemRepository pieces;
    private final SchemeGroupingRepository groupings;
    private final SchemeService schemeService;
    private final Guard guard;
    private final MediaService media;

    ShowcasePhotos(WardrobeItemRepository pieces, SchemeGroupingRepository groupings, SchemeService schemeService, Guard guard,
                   MediaService media) {
        this.pieces = pieces;
        this.groupings = groupings;
        this.schemeService = schemeService;
        this.guard = guard;
        this.media = media;
    }

    /**
     * RF4 — a foto da peça vestindo o manequim da pessoa (rosto 3D a partir da foto de perfil) ou o manequim padrão
     * masc./fem. quando não há foto. A imagem é renderizada no navegador (Three.js, mesmo manequim da Passarela) e
     * enviada aqui; o servidor valida, recodifica e guarda.
     */
    Map<String, Object> pieceMannequinPhoto(CurrentUser user, UUID id, byte[] bytes) {
        guard.requireCanCreate(user);
        WardrobeItem w = pieces.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        guard.requireOwner(user, w.getUser().getId(), "piece:" + id);
        if (!MANNEQUIN_PHOTO_CATEGORIES.contains(w.getCategory())) {
            throw new ApiException(422, "SEM_FOTO_NO_MANEQUIM", Msg.t("showcase.a_foto_com_manequim_e"));
        }
        String url = storeMannequinPhoto(user, "pieces/" + id, bytes);
        w.setMannequinImageUrl(url);
        w.setMannequinImageFace(faceOf(w.getUser()));
        return Map.of("url", url, "face", w.getMannequinImageFace());
    }

    /** RF5 — o look inteiro (todas as peças do esquema) no manequim; opcionalmente vira a foto do post (capa). */
    Map<String, Object> schemeMannequinPhoto(CurrentUser user, UUID id, byte[] bytes, boolean asCover) {
        guard.requireCanCreate(user);
        Scheme s = schemeService.owned(user, id);
        String url = storeMannequinPhoto(user, "schemes/" + id, bytes);
        s.setMannequinImageUrl(url);
        s.setMannequinImageFace(faceOf(s.getUser()));
        if (asCover) {
            s.setCoverImageUrl(url);
        }
        return Map.of("url", url, "face", s.getMannequinImageFace(), "cover", asCover);
    }

    void deleteMannequinPhoto(CurrentUser user, String kind, UUID id) {
        if ("scheme".equals(kind)) {
            Scheme s = schemeService.owned(user, id);
            if (s.getMannequinImageUrl() != null && s.getMannequinImageUrl().equals(s.getCoverImageUrl())) {
                s.setCoverImageUrl(null);
            }
            s.setMannequinImageUrl(null);
            s.setMannequinImageFace(null);
        } else {
            WardrobeItem w = pieces.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            guard.requireOwner(user, w.getUser().getId(), "piece:" + id);
            w.setMannequinImageUrl(null);
            w.setMannequinImageFace(null);
        }
    }

    private String storeMannequinPhoto(CurrentUser user, String base, byte[] bytes) {
        br.com.fashionai.application.imaging.ImageOps.requireAcceptedImage(bytes);
        java.awt.image.BufferedImage img = br.com.fashionai.application.imaging.ImageOps.scaleToFit(
                br.com.fashionai.application.imaging.ImageOps.decode(bytes), 1600, 1600);
        byte[] jpeg = br.com.fashionai.application.imaging.ImageOps.jpeg(img, 0.92f);
        return media.put("users/" + user.id() + "/" + base + "/mannequin-" + System.currentTimeMillis() + ".jpg", jpeg, "image/jpeg").url();
    }

    private static String faceOf(User u) {
        return u.getAvatarUrl() != null && u.getProfileType() != ProfileType.MARCA ? "FOTO" : "PADRAO";
    }

    /** Foto da era / arte da coleção (header da busca e vitrine da mini loja 3D): só o dono do agrupamento envia. */
    Map<String, Object> groupingCover(CurrentUser user, UUID id, byte[] bytes) {
        guard.requireCanCreate(user);
        SchemeGrouping g = groupings.findById(id).orElseThrow(() -> ApiException.notFound("Agrupamento"));
        guard.requireOwner(user, g.getOwner().getId(), "grouping:" + id);
        br.com.fashionai.application.imaging.ImageOps.requireAcceptedImage(bytes);
        java.awt.image.BufferedImage img = br.com.fashionai.application.imaging.ImageOps.scaleToFit(
                br.com.fashionai.application.imaging.ImageOps.decode(bytes), 1800, 1200);
        byte[] jpeg = br.com.fashionai.application.imaging.ImageOps.jpeg(img, 0.9f);
        String url = media.put("users/" + user.id() + "/groupings/" + id + "/cover-" + System.currentTimeMillis() + ".jpg", jpeg, "image/jpeg").url();
        g.setCoverUrl(url);
        return Map.of("id", g.getId(), "coverUrl", url);
    }
}
