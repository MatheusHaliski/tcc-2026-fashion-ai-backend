package br.com.fashionai.application.scheme;

import java.awt.image.BufferedImage;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import br.com.fashionai.application.ai.*;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.imaging.*;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.application.service.*;
import br.com.fashionai.application.service.SchemeService.*;

public final class SchemePhotos {
    private final Guard guard;
    private final UserRepository users;
    private final MediaService media;

    public SchemePhotos(Guard guard, UserRepository users, MediaService media) {
        this.guard = guard;
        this.users = users;
        this.media = media;
    }

    /**
     * RF5 — a foto do conjunto é enviada pelo usuário, como a foto de um post. Passa pelo pipeline (validação, redimensionamento,
     * reencode sem metadados, registro na moderação); os filtros escolhidos (brilho, contraste, saturação, matiz, desfoque)
     * ficam no config e são aplicados na exibição. A arte do Background Studio nunca é aplicada sobre ela (RF11).
     */
    public Map<String, Object> uploadLookPhoto(CurrentUser user, byte[] bytes) {
        guard.requireCanCreate(user);
        BufferedImage normalized = SchemeLookPhoto.normalized(bytes);
        byte[] jpeg = ImageOps.jpeg(normalized, 0.88f);
        User owner = users.findById(user.id()).orElseThrow();
        MediaStoragePort.StoredObject stored = media.put("users/" + user.id() + "/looks/photo-" + UUID.randomUUID() + ".jpg", jpeg, "image/jpeg");
        media.register(owner, PhotoOrigin.SCHEME, null, stored, null, null, bytes, normalized.getWidth(), normalized.getHeight(), null,
                ModerationStatus.APPROVED, Map.of("kind", "look_photo"));
        return Map.of("url", stored.url(), "width", normalized.getWidth(), "height", normalized.getHeight(), "pipeline", SchemeLookPhoto.PIPELINE);
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
