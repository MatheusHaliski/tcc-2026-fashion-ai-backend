package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Envios do formulário de cadastro antes de a conta existir ({@code pending/}, documentos em {@code restricted/pending/}):
 * recebimento limitado por IP, conferência do envio no cadastro, cópia para a conta e o job que apaga os abandonados.
 */
final class IdentityPreUploads {
    /** Mesma categoria de log de antes da extração (IdentityService). */
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(IdentityService.class);
    private final MediaStoragePort storage;
    private final RateLimitPort rateLimit;
    private final UserRepository users;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;

    IdentityPreUploads(MediaStoragePort storage, RateLimitPort rateLimit, UserRepository users, BrandProfileRepository brands,
                       CelebrityProfileRepository celebrities) {
        this.storage = storage;
        this.rateLimit = rateLimit;
        this.users = users;
        this.brands = brands;
        this.celebrities = celebrities;
    }

    /** Tipos de arquivo que o formulário de cadastro envia antes de a conta existir. */
    private static final Map<String, Integer> PRE_UPLOAD_SIZE = Map.of("avatar", 640, "logo", 640, "official-photo", 1024,
            "identity", 1600, "activity-proof", 1600);

    /**
     * RF1 — foto de perfil (e logo/foto oficial/documentos de marca e celebridade) enviada pelo formulário de cadastro,
     * antes de existir conta. Limite por IP; imagem validada pelo conteúdo e recodificada em JPEG (tira EXIF/GPS).
     * Documentos ficam em {@code restricted/}, que só administradores leem.
     */
    Map<String, Object> preRegistrationUpload(byte[] bytes, String kind, String ip) {
        Integer size = PRE_UPLOAD_SIZE.get(kind == null ? "" : kind);
        if (size == null) {
            throw ApiException.badRequest("TIPO_INVALIDO", Msg.t("identity.tipo_de_arquivo_invalido"), Map.of("allowed", PRE_UPLOAD_SIZE.keySet()));
        }
        if (bytes.length > 8L * 1024 * 1024) {
            throw ApiException.badRequest("ARQUIVO_GRANDE", Msg.t("identity.a_imagem_deve_ter_ate"));
        }
        UUID bucketOwner = UUID.nameUUIDFromBytes(("pre-upload:" + (ip == null ? "?" : ip)).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        if (!rateLimit.tryAcquire(bucketOwner, "pre-registration-upload", 30, Duration.ofHours(1))) {
            throw new ApiException(429, "LIMITE_ENVIOS", Msg.t("identity.muitos_envios_em_pouco_tempo"));
        }
        ImageOps.requireAcceptedImage(bytes);
        java.awt.image.BufferedImage img = ImageOps.decode(bytes);
        if ("avatar".equals(kind)) {
            img = ImageOps.centerSquare(img);                  // avatar: recorte quadrado (círculo no header do perfil)
        }
        img = ImageOps.scaleToFit(img, size, size);
        byte[] jpeg = ImageOps.jpeg(img, 0.9f);
        boolean sensitive = "identity".equals(kind) || "activity-proof".equals(kind);
        String key = (sensitive ? "restricted/" : "") + "pending/" + UUID.randomUUID() + "/" + kind + ".jpg";
        MediaStoragePort.StoredObject stored = storage.put(key, jpeg, "image/jpeg");
        return Map.of("url", stored.url(), "kind", kind, "width", img.getWidth(), "height", img.getHeight());
    }

    /** Envios do cadastro abandonados (a conta nunca foi criada) somem depois disso. */
    static final Duration PENDING_TTL = Duration.ofHours(24);
    static final Set<MediaService.MediaScope> PENDING_SCOPES =
            Set.of(MediaService.MediaScope.PENDING, MediaService.MediaScope.PENDING_RESTRICTED);

    /**
     * URL aceita no cadastro: só um envio deste formulário ({@code POST /api/auth/uploads}) do tipo certo para o campo —
     * nunca uma URL externa nem uma chave qualquer do storage (o cadastro copia o arquivo para a conta nova).
     */
    Optional<MediaService.OwnedMedia> pendingUpload(String url, String kind) {
        return MediaService.ownedMedia(storage, null, url, PENDING_SCOPES)
                .filter(m -> kind.equals(MediaService.pendingKind(m.key())));
    }

    /**
     * Job de hora em hora: apaga envios do cadastro com mais de 24 h. Os usados num cadastro já foram copiados para a
     * conta; os que ainda aparecem em alguma conta são de cadastros anteriores a essa cópia e ficam.
     */
    int purgeStalePendingUploads() {
        Instant cutoff = Instant.now().minus(PENDING_TTL);
        int removed = 0;
        for (String prefix : List.of("pending/", "restricted/pending/")) {
            for (String key : storage.listOlderThan(prefix, cutoff, 2_000)) {
                if (pendingReferenced(key)) {
                    continue;
                }
                try {
                    storage.delete(key);
                    removed++;
                } catch (RuntimeException ex) {
                    log.warn("Envio de cadastro {} não apagado: {}", key, ex.getMessage());
                }
            }
        }
        if (removed > 0) {
            log.info("Envios de cadastro abandonados apagados: {}", removed);
        }
        return removed;
    }

    private boolean pendingReferenced(String key) {
        String suffix = key.startsWith("restricted/") ? key.substring("restricted/".length()) : key;
        return users.existsByAvatarUrlEndingWithOrCoverUrlEndingWith(suffix, suffix)
                || brands.existsByLogoUrlEndingWithOrActivityProofUrlEndingWith(suffix, suffix)
                || celebrities.existsByAvatarUrlEndingWithOrIdentityProofUrlEndingWith(suffix, suffix);
    }

    byte[] readQuietly(String key) {
        try {
            return storage.get(key);
        } catch (RuntimeException ex) {
            return null;                                   // envio apagado (mais de 24 h) ou inexistente
        }
    }

    /**
     * Copia o envio do cadastro para a conta: foto, logo e foto oficial em {@code users/{id}/profile/}; documentos em
     * {@code restricted/users/{id}/documents/} (só ADMIN lê). O original em pending/ sai no job de limpeza.
     */
    String claimPendingUpload(UUID userId, String pendingKey, byte[] bytes) {
        String kind = MediaService.pendingKind(pendingKey);
        String folder = pendingKey.startsWith("restricted/") ? "restricted/users/" + userId + "/documents/" : "users/" + userId + "/profile/";
        return storage.put(folder + kind + "-" + System.currentTimeMillis() + ".jpg", bytes, "image/jpeg").url();
    }
}
