package br.com.fashionai.application.moderation;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.service.MediaService;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.domain.model.ModerationQueueItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.repository.ModerationQueueRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Quarentena de fotos enviadas (docs/seguranca/moderacao-de-imagens.md §5). A foto que a moderação manda para revisão
 * não entra no fluxo que a recebeu: fica em {@code restricted/moderation/} (só ADMIN lê) e vira um item na fila de
 * moderação ({@code targetType = UPLOAD}). Aprovada, entra em "Minhas Fotos" — e, se era a foto de perfil ou a capa, já
 * é aplicada; recusada, o arquivo é apagado. A pessoa recebe uma notificação nos dois casos.
 */
@Service
public class UploadQuarantine {
    private static final Logger log = LoggerFactory.getLogger(UploadQuarantine.class);
    public static final String TARGET = "UPLOAD";

    public enum Kind { PROFILE_AVATAR, PROFILE_COVER, PHOTO }

    private final MediaStoragePort storage;
    private final MediaService media;
    private final ModerationQueueRepository queue;
    private final UserRepository users;
    private final NotificationService notifications;

    public UploadQuarantine(MediaStoragePort storage, MediaService media, ModerationQueueRepository queue, UserRepository users,
                            NotificationService notifications) {
        this.storage = storage;
        this.media = media;
        this.queue = queue;
        this.users = users;
        this.notifications = notifications;
    }

    public static Kind kindOf(String path) {
        return switch (path == null ? "" : path) {
            case "/api/me/avatar" -> Kind.PROFILE_AVATAR;
            case "/api/me/cover" -> Kind.PROFILE_COVER;
            default -> Kind.PHOTO;
        };
    }

    /** Guarda a foto retida e abre o item de revisão; devolve o id do item. Commita sozinho: a requisição é recusada em seguida. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public UUID hold(UUID userId, byte[] bytes, String path, ImageSafety.Verdict verdict) {
        UUID fileId = UUID.randomUUID();
        String mime = ImageOps.detectMime(bytes);
        String key = "restricted/moderation/" + userId + "/" + fileId + "." + MediaService.ext(mime);
        storage.put(key, bytes, mime == null ? "application/octet-stream" : mime);
        Kind kind = kindOf(path);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("key", key);
        meta.put("kind", kind.name());
        meta.put("path", path);
        meta.put("engine", verdict.engine());
        meta.put("reasons", verdict.reasons());
        meta.put("signals", verdict.signals());
        ModerationQueueItem q = new ModerationQueueItem();
        q.setTargetType(TARGET);
        q.setTargetId(fileId);
        q.setUserId(userId);
        q.setContentExcerpt(kind.name() + " · " + path);
        q.setCategoriesJson(Json.write(meta));
        Object adult = verdict.signals().get("adult");
        Object skin = verdict.signals().get("bodySkin");
        if (adult instanceof Number n) {
            q.setConfidence(BigDecimal.valueOf(Math.min(1, n.doubleValue() / 5.0)));
        } else if (skin instanceof Number n) {
            q.setConfidence(BigDecimal.valueOf(Math.min(1, n.doubleValue())));
        }
        return queue.save(q).getId();
    }

    public static Map<String, Object> meta(ModerationQueueItem q) {
        return Json.map(q.getCategoriesJson());
    }

    /** Motivos legíveis do item (para a fila do admin). */
    @SuppressWarnings("unchecked")
    public static List<String> reasons(ModerationQueueItem q) {
        Object r = meta(q).get("reasons");
        return r instanceof List<?> l ? (List<String>) l : List.of();
    }

    /** Bytes da foto retida (só a tela de moderação do admin chama). */
    public byte[] image(ModerationQueueItem q) {
        Object key = meta(q).get("key");
        if (!(key instanceof String k) || !k.startsWith("restricted/moderation/")) {
            throw ApiException.notFound(Msg.t("entity.arquivo"));
        }
        return storage.get(k);
    }

    /** Decisão do admin (chamada dentro da transação de {@code AdminService.moderate}). */
    public void decide(ModerationQueueItem q, UUID adminId, boolean approve) {
        Map<String, Object> meta = meta(q);
        String key = String.valueOf(meta.get("key"));
        Kind kind = Kind.valueOf(String.valueOf(meta.getOrDefault("kind", Kind.PHOTO.name())));
        User u = users.findById(q.getUserId()).orElse(null);
        if (approve && u != null) {
            publish(u, kind, storage.get(key));
        }
        try {
            storage.delete(key);
        } catch (RuntimeException ex) {
            log.warn("Foto retida {} já removida: {}", key, ex.getMessage());
        }
        if (u != null) {
            notifications.notify(u.getId(), adminId, NotificationType.CONTENT_REVIEW, "UPLOAD", q.getTargetId(),
                    Msg.k(approve ? "imageSafety.aprovada_titulo" : "imageSafety.recusada_titulo"),
                    Msg.k(approve ? (kind == Kind.PHOTO ? "imageSafety.aprovada_foto" : "imageSafety.aprovada_perfil") : "imageSafety.recusada_corpo"),
                    Map.of());
        }
    }

    /** Foto aprovada: vai para "Minhas Fotos"; foto de perfil ou capa, já aplicada. */
    private void publish(User u, Kind kind, byte[] bytes) {
        BufferedImage img = ImageOps.decode(bytes);
        boolean profile = kind != Kind.PHOTO, cover = kind == Kind.PROFILE_COVER;
        BufferedImage fitted = profile ? ImageOps.scaleToFit(img, cover ? 1600 : 512, cover ? 900 : 512) : ImageOps.scaleToFit(img, 2048, 2048);
        byte[] jpeg = ImageOps.jpeg(fitted, 0.9f);
        String key = "users/" + u.getId() + (profile ? "/profile/" + (cover ? "cover" : "avatar") : "/photos/revisada") + "-" + System.currentTimeMillis() + ".jpg";
        MediaStoragePort.StoredObject stored = media.put(key, jpeg, "image/jpeg");
        media.register(u, profile ? PhotoOrigin.PROFILE : PhotoOrigin.LOOSE, profile ? u.getId() : null, stored, null, null, jpeg,
                fitted.getWidth(), fitted.getHeight(), null, ModerationStatus.APPROVED, Map.of("kind", kind.name(), "moderation", "revisao-humana"));
        if (kind == Kind.PROFILE_AVATAR) {
            u.setAvatarUrl(stored.url());
        } else if (cover) {
            u.setCoverUrl(stored.url());
        }
    }
}
