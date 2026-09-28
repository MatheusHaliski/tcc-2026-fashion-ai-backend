package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Object Storage + acervo "Minhas Fotos" (RF12). Toda imagem gravada por um RF vira uma Photo com a origem
 * (peça, esquema, provador, DNA, perfil, Background Studio, editor), para o agrupamento do RF12.CA01.
 */
@Service
public class MediaService {
    /**
     * Onde uma URL de mídia enviada pelo cliente pode apontar (ver {@link #ownedMedia}). Nunca {@code restricted/} fora
     * dos documentos do cadastro, nunca {@code ..}, nunca URL externa.
     */
    public enum MediaScope {
        /** {@code users/{dono}/…}: arquivos que a própria pessoa enviou ou gerou. */
        OWNER,
        /** {@code pending/{uuid}/{avatar|logo|official-photo}.jpg}: envio do formulário de cadastro (POST /api/auth/uploads). */
        PENDING,
        /** {@code restricted/pending/{uuid}/{identity|activity-proof}.jpg}: documentos do cadastro (só ADMIN lê). */
        PENDING_RESTRICTED,
        /** Caminho relativo de um asset do catálogo que o próprio app serve de /public (nunca lido do storage). */
        CATALOG
    }

    /** Chave validada e a URL canônica emitida pelo storage (é ela que se grava, nunca o texto do cliente). */
    public record OwnedMedia(String key, String url) {
    }

    /** Prefixos com fotos de pessoas: servidos com cache só do navegador ({@code private}), nunca de CDN compartilhada. */
    public static final java.util.List<String> PERSONAL_PREFIXES = java.util.List.of("users/", "pending/", "challenges/");

    static final Pattern PENDING_KEY = Pattern.compile("^pending/[0-9a-f-]{36}/(avatar|logo|official-photo)\\.jpg$");
    static final Pattern PENDING_RESTRICTED_KEY = Pattern.compile("^restricted/pending/[0-9a-f-]{36}/(identity|activity-proof)\\.jpg$");
    private static final Pattern SAFE_KEY = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._/-]*$");
    private static final Pattern CATALOG_PATH = Pattern.compile("^/(?!media/)[A-Za-z0-9_][A-Za-z0-9._/-]*\\.(png|jpe?g|webp|svg|gif|avif)$",
            Pattern.CASE_INSENSITIVE);

    private final MediaStoragePort storage;
    private final PhotoRepository photos;

    public MediaService(MediaStoragePort storage, PhotoRepository photos) {
        this.storage = storage;
        this.photos = photos;
    }

    public MediaStoragePort.StoredObject put(String key, byte[] bytes, String contentType) {
        return storage.put(key, bytes, contentType);
    }

    /**
     * Valida uma URL (ou chave) de mídia vinda do cliente antes de ela ser gravada como mídia da pessoa ou lida pelo
     * servidor. Sem isso, apontar o avatar para {@code /media/restricted/…} e pedir "girar a foto" republicava em
     * {@code users/} o documento de outra pessoa. Vazio quando a URL não está em nenhum dos escopos aceitos.
     */
    public Optional<OwnedMedia> ownedMedia(UUID owner, String url, Set<MediaScope> scopes) {
        return ownedMedia(storage, owner, url, scopes);
    }

    /** {@link #ownedMedia(UUID, String, Set)} com o storage explícito (serviços que só têm a porta). */
    public static Optional<OwnedMedia> ownedMedia(MediaStoragePort storage, UUID owner, String url, Set<MediaScope> scopes) {
        if (url == null || url.isBlank()) {
            return Optional.empty();
        }
        String value = url.trim();
        if (scopes.contains(MediaScope.CATALOG) && CATALOG_PATH.matcher(value).matches() && !value.contains("..")
                && !value.contains("//")) {
            return Optional.of(new OwnedMedia(null, value));
        }
        Optional<String> key = storage.keyOf(value).or(() -> SAFE_KEY.matcher(value).matches() ? Optional.of(value) : Optional.empty());
        if (key.isEmpty() || !safeKey(key.get())) {
            return Optional.empty();
        }
        String k = key.get();
        boolean ok = scopes.contains(MediaScope.OWNER) && owner != null && k.startsWith("users/" + owner + "/")
                || scopes.contains(MediaScope.PENDING) && PENDING_KEY.matcher(k).matches()
                || scopes.contains(MediaScope.PENDING_RESTRICTED) && PENDING_RESTRICTED_KEY.matcher(k).matches();
        return ok ? Optional.of(new OwnedMedia(k, storage.publicUrl(k).toString())) : Optional.empty();
    }

    /** Como {@link #ownedMedia}, mas recusa com 400 MIDIA_INVALIDA (campo nos detalhes). */
    public OwnedMedia requireOwnedMedia(UUID owner, String url, Set<MediaScope> scopes, String field) {
        return ownedMedia(owner, url, scopes).orElseThrow(() -> ApiException.badRequest("MIDIA_INVALIDA",
                Msg.t("media.url_nao_permitida"), Map.of("field", field)));
    }

    /** Tipo do envio de cadastro ({@code avatar}, {@code logo}, {@code identity}…) pela chave, ou null. */
    public static String pendingKind(String key) {
        if (key == null) {
            return null;
        }
        Matcher m = PENDING_KEY.matcher(key);
        if (m.matches()) {
            return m.group(1);
        }
        m = PENDING_RESTRICTED_KEY.matcher(key);
        return m.matches() ? m.group(1) : null;
    }

    static boolean safeKey(String key) {
        return SAFE_KEY.matcher(key).matches() && !key.contains("..") && !key.contains("//");
    }

    /** Chave que o servidor pode ler por URL gravada: fora de {@code restricted/} e sem sair da raiz do storage. */
    static boolean readableKey(String key) {
        return !key.isBlank() && !key.startsWith("/") && !key.startsWith("restricted/") && !key.contains("..") && !key.contains("\\");
    }

    /**
     * Lê um arquivo do storage pela URL gravada. Nunca devolve {@code restricted/} (documentos, quarentena, textura do
     * rosto 3D): quem precisa deles lê pela chave, no fluxo que confere o acesso.
     */
    public Optional<byte[]> read(String url) {
        if (url == null) {
            return Optional.empty();
        }
        return storage.keyOf(url).filter(MediaService::readableKey).map(key -> {
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
