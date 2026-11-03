package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.repository.UserRepository;

import java.awt.image.BufferedImage;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Foto do look (como a foto de um post): envio pelo pipeline de mídia e aplicação como capa a partir do config. */
final class SchemeLookPhoto {
    private final Guard guard;
    private final UserRepository users;
    private final MediaService media;

    SchemeLookPhoto(Guard guard, UserRepository users, MediaService media) {
        this.guard = guard;
        this.users = users;
        this.media = media;
    }

    static final List<String> PHOTO_PIPELINE = List.of(Msg.k("scheme.formato_validado_jpeg_png_webp"), Msg.k("scheme.tamanho_minimo_400_400_px"),
            Msg.k("scheme.proporcao_de_post_entre_1"), Msg.k("scheme.redimensionada_para_no_maximo_1600"), Msg.k("scheme.metadados_removidos_exif_gps"),
            Msg.k("scheme.registrada_na_moderacao_de_midia"), Msg.k("scheme.filtros_aplicados_na_exibicao_sem"));

    /**
     * RF5 — a foto do conjunto é enviada pelo usuário, como a foto de um post. Passa pelo pipeline (validação, redimensionamento,
     * reencode sem metadados, registro na moderação); os filtros escolhidos (brilho, contraste, saturação, matiz, desfoque)
     * ficam no config e são aplicados na exibição. A arte do Background Studio nunca é aplicada sobre ela (RF11).
     */
    Map<String, Object> uploadLookPhoto(CurrentUser user, byte[] bytes) {
        guard.requireCanCreate(user);
        ImageOps.requireAcceptedImage(bytes);
        BufferedImage img = ImageOps.decode(bytes);
        if (img.getWidth() < 400 || img.getHeight() < 400) {
            throw ApiException.badRequest("IMAGEM_PEQUENA", Msg.t("scheme.a_foto_do_look_precisa"));
        }
        double ratio = img.getWidth() / (double) img.getHeight();
        if (ratio > 2.0 || ratio < 0.5) {
            throw ApiException.badRequest("PROPORCAO_INVALIDA", Msg.t("scheme.use_uma_foto_com_proporcao"));
        }
        BufferedImage normalized = ImageOps.scaleToFit(img, 1600, 1600);
        byte[] jpeg = ImageOps.jpeg(normalized, 0.88f);
        User owner = users.findById(user.id()).orElseThrow();
        MediaStoragePort.StoredObject stored = media.put("users/" + user.id() + "/looks/photo-" + UUID.randomUUID() + ".jpg", jpeg, "image/jpeg");
        media.register(owner, PhotoOrigin.SCHEME, null, stored, null, null, bytes, normalized.getWidth(), normalized.getHeight(), null,
                ModerationStatus.APPROVED, Map.of("kind", "look_photo"));
        return Map.of("url", stored.url(), "width", normalized.getWidth(), "height", normalized.getHeight(), "pipeline", PHOTO_PIPELINE);
    }

    /** Aplica a foto do look vinda do config ({@code scheme.photo.url}); sem foto própria, a capa volta para a primeira peça. */
    void applyLookPhoto(CurrentUser user, Scheme s, Map<String, Object> background, List<SchemeItem> items) {
        if (background == null) {
            return;
        }
        Object inner = background.get("scheme") instanceof Map<?, ?> m ? m : background;
        if (!(inner instanceof Map<?, ?> scheme) || !scheme.containsKey("photo")) {
            return;
        }
        String url = scheme.get("photo") instanceof Map<?, ?> p && p.get("url") instanceof String u && !u.isBlank() ? u : null;
        if (url == null) {
            s.setCoverImageUrl(items.isEmpty() ? null : items.get(0).getWardrobeItem().getImageUrl());
            return;
        }
        if (!url.contains("/users/" + user.id() + "/looks/")) {
            throw ApiException.badRequest("FOTO_INVALIDA", Msg.t("scheme.envie_a_foto_do_look"));
        }
        s.setCoverImageUrl(url);
        media.linkSource(user.id(), url, s.getId());
    }
}
