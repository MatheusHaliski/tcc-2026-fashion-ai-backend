package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.repository.PhotoRepository;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Object Storage + acervo "Minhas Fotos" (RF12). Toda imagem gravada por um RF vira uma Photo com a origem
 * (peça, esquema, provador, DNA, perfil, Background Studio, editor), para o agrupamento do RF12.CA01.
 */
@Service
public class MediaService {
    private final MediaStoragePort storage;
    private final PhotoRepository photos;

    public MediaService(MediaStoragePort storage, PhotoRepository photos) {
        this.storage = storage;
        this.photos = photos;
    }

    public MediaStoragePort.StoredObject put(String key, byte[] bytes, String contentType) {
        return storage.put(key, bytes, contentType);
    }

    public Optional<byte[]> read(String url) {
        if (url == null) {
            return Optional.empty();
        }
        return storage.keyOf(url).map(key -> {
            try {
                return storage.get(key);
            } catch (RuntimeException ex) {
                return null;
            }
        });
    }

    public Optional<BufferedImage> readImage(String url) {
        return read(url).map(bytes -> {
            try {
                return ImageOps.decode(bytes);
            } catch (ApiException ex) {
                return null;
            }
        });
    }

    public void deleteUrl(String url) {
        if (url != null) {
            storage.keyOf(url).ifPresent(key -> {
                try {
                    storage.delete(key);
                } catch (RuntimeException ignored) {
                    // objeto já removido: idempotente
                }
            });
        }
    }

    public static String ext(String mime) {
        return switch (mime == null ? "" : mime) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/jpeg" -> "jpg";
            case "application/json" -> "json";
            default -> "bin";
        };
    }

    /** Registra a foto no acervo do usuário (RF12). */
    public Photo register(User owner, PhotoOrigin origin, UUID sourceEntityId, MediaStoragePort.StoredObject stored,
                          String originalUrl, String thumbnailUrl, byte[] bytes, Integer width, Integer height,
                          BigDecimal quality, ModerationStatus moderation, Map<String, Object> metadata) {
        Photo p = new Photo();
        p.setUser(owner);
        p.setOrigin(origin);
        p.setSourceEntityId(sourceEntityId);
        p.setStorageKey(stored.key());
        p.setPublicUrl(stored.url());
        p.setOriginalUrl(originalUrl == null ? stored.url() : originalUrl);
        p.setThumbnailUrl(thumbnailUrl == null ? stored.url() : thumbnailUrl);
        p.setContentHash(bytes == null ? null : Hashing.sha256(bytes));
        p.setMimeType(stored.contentType());
        p.setWidth(width);
        p.setHeight(height);
        p.setBytesSize(stored.size());
        p.setQualityScore(quality);
        p.setModerationStatus(moderation == null ? ModerationStatus.APPROVED : moderation);
        p.setMetadataJson(metadata == null ? null : Json.write(metadata));
        return photos.save(p);
    }

    /** Liga a foto enviada antes de a entidade existir (ex.: foto do look, RF5) ao seu dono, para a exclusão em cascata. */
    public void linkSource(UUID userId, String publicUrl, UUID sourceEntityId) {
        if (publicUrl == null || sourceEntityId == null) {
            return;
        }
        for (Photo p : photos.findByUserIdAndPublicUrlAndDeletedAtIsNull(userId, publicUrl)) {
            if (p.getSourceEntityId() == null) {
                p.setSourceEntityId(sourceEntityId);
            }
        }
    }

    /**
     * RF12.CA13 — ao excluir uma peça ou um look, as fotos dele saem do acervo junto (integridade referencial): nada fica
     * órfão em "Minhas Fotos". A baixa é lógica, como na exclusão manual (CA03); os arquivos continuam no armazenamento
     * porque os looks antigos guardam um retrato da peça excluída e ainda o exibem.
     */
    public int retire(UUID userId, UUID sourceEntityId, Set<PhotoOrigin> origins, Collection<String> urls) {
        Set<Photo> found = new LinkedHashSet<>();
        if (sourceEntityId != null) {
            photos.findByUserIdAndSourceEntityIdAndDeletedAtIsNull(userId, sourceEntityId).stream()
                    .filter(p -> origins.contains(p.getOrigin())).forEach(found::add);
        }
        if (urls != null) {
            for (String url : urls) {
                if (url != null && !url.isBlank()) {
                    photos.findByUserIdAndPublicUrlAndDeletedAtIsNull(userId, url).stream()
                            .filter(p -> origins.contains(p.getOrigin())).forEach(found::add);
                }
            }
        }
        Instant now = Instant.now();
        found.forEach(p -> p.setDeletedAt(now));
        return found.size();
    }
}
