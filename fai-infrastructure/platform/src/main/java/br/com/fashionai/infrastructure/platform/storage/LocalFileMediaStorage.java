package br.com.fashionai.infrastructure.platform.storage;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

/**
 * Armazenamento de mídia no sistema de arquivos (padrão em desenvolvimento e na demonstração).
 * Os objetos ficam em {@code fashionai.storage.local-dir} e são servidos pela própria API em {@code /media/**}.
 * Em produção troque por S3/MinIO com {@code fashionai.storage.type=s3}.
 */
@Component
@ConditionalOnProperty(name = "fashionai.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalFileMediaStorage implements MediaStoragePort {
    private static final Logger log = LoggerFactory.getLogger(LocalFileMediaStorage.class);
    private final Path root;
    private final String publicBase;

    public LocalFileMediaStorage(@Value("${fashionai.storage.local-dir:./data/media}") String dir,
                                 @Value("${fashionai.app.base-url:http://localhost:8080}") String baseUrl) throws IOException {
        this.root = Path.of(dir).toAbsolutePath().normalize();
        this.publicBase = baseUrl.replaceAll("/+$", "") + "/media/";
        Files.createDirectories(root);
        log.info("Mídia local em {} (servida em {})", root, publicBase);
    }

    public Path root() {
        return root;
    }

    private Path resolve(String objectKey) {
        String clean = objectKey.replace('\\', '/').replaceAll("^/+", "");
        Path p = root.resolve(clean).normalize();
        if (!p.startsWith(root) || clean.isBlank()) {
            throw ApiException.badRequest("CHAVE_INVALIDA", "Chave de mídia inválida.");
        }
        return p;
    }

    @Override
    public URI createUploadUrl(String objectKey, String contentType) {
        // Uploads passam pela API (multipart); a URL devolvida é a de leitura após o envio.
        return publicUrl(objectKey);
    }

    @Override
    public URI publicUrl(String objectKey) {
        return URI.create(publicBase + objectKey.replaceAll("^/+", ""));
    }

    @Override
    public StoredObject put(String objectKey, byte[] content, String contentType) {
        Path p = resolve(objectKey);
        try {
            Files.createDirectories(p.getParent());
            Files.write(p, content);
        } catch (IOException e) {
            throw new ApiException(500, "ARMAZENAMENTO", "Não foi possível salvar o arquivo agora. Tente de novo.");
        }
        return new StoredObject(objectKey, publicUrl(objectKey).toString(), content.length, contentType);
    }

    @Override
    public byte[] get(String objectKey) {
        Path p = resolve(objectKey);
        try {
            return Files.readAllBytes(p);
        } catch (IOException e) {
            throw ApiException.notFound("Arquivo");
        }
    }

    @Override
    public void delete(String objectKey) {
        try {
            Files.deleteIfExists(resolve(objectKey));
        } catch (IOException e) {
            log.warn("Falha ao apagar {}: {}", objectKey, e.getMessage());
        }
    }

    @Override
    public Optional<String> keyOf(String url) {
        if (url == null) {
            return Optional.empty();
        }
        if (url.startsWith(publicBase)) {
            return Optional.of(url.substring(publicBase.length()));
        }
        int i = url.indexOf("/media/");
        return i >= 0 ? Optional.of(url.substring(i + "/media/".length())) : Optional.empty();
    }
}
