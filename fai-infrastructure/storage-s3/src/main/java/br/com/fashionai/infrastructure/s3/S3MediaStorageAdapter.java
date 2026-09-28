package br.com.fashionai.infrastructure.s3;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Object;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Mídia em S3 ou compatível (MinIO, Cloudflare R2) — ligado com {@code fashionai.storage.type=s3}.
 * URLs públicas vêm de {@code fashionai.storage.public-base-url} (CDN ou o próprio bucket). Chaves {@code restricted/}
 * (documentos do cadastro, quarentena da moderação, textura do rosto 3D) sempre saem pela API
 * ({@code APP_BASE_URL/media/restricted/…}), onde só ADMIN lê — mesmo com S3_SERVE_THROUGH_API=false; o bucket precisa
 * negar leitura pública desse prefixo.
 */
@Component
@ConditionalOnProperty(name = "fashionai.storage.type", havingValue = "s3")
public class S3MediaStorageAdapter implements MediaStoragePort {
    private static final Logger log = LoggerFactory.getLogger(S3MediaStorageAdapter.class);
    private final S3Client s3;
    private final S3Presigner presigner;
    private final String bucket;
    private final String publicBase;
    /** Base da API ({@code APP_BASE_URL/media/}): sempre usada para {@code restricted/}. */
    private final String apiBase;

    public S3MediaStorageAdapter(@Value("${fashionai.storage.s3.endpoint:}") String endpoint,
                                 @Value("${fashionai.storage.s3.region:us-east-1}") String region,
                                 @Value("${fashionai.storage.s3.bucket:fashionai-media}") String bucket,
                                 @Value("${fashionai.storage.s3.access-key:}") String accessKey,
                                 @Value("${fashionai.storage.s3.secret-key:}") String secretKey,
                                 @Value("${fashionai.storage.public-base-url:}") String publicBaseUrl,
                                 @Value("${fashionai.storage.s3.serve-through-api:false}") boolean serveThroughApi,
                                 @Value("${fashionai.storage.s3.path-style:}") String pathStyle,
                                 @Value("${fashionai.app.base-url:http://localhost:8080}") String appBaseUrl) {
        StaticCredentialsProvider credentials = StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
        // MinIO pede path-style; Railway Buckets (Tigris) e AWS usam virtual-hosted: S3_PATH_STYLE decide, padrão pelo endpoint
        boolean pathStyleAccess = pathStyle.isBlank() ? !endpoint.isBlank() : Boolean.parseBoolean(pathStyle.trim());
        S3ClientBuilder builder = S3Client.builder().region(Region.of(region)).credentialsProvider(credentials)
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(pathStyleAccess).build());
        S3Presigner.Builder presignBuilder = S3Presigner.builder().region(Region.of(region)).credentialsProvider(credentials)
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(pathStyleAccess).build());
        if (!endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint));
            presignBuilder.endpointOverride(URI.create(endpoint));
        }
        this.s3 = builder.build();
        this.presigner = presignBuilder.build();
        this.bucket = bucket;
        // bucket privado: a própria API entrega /media/** (MediaProxyController), então a URL pública é a da API
        String base = serveThroughApi ? appBaseUrl.replaceAll("/+$", "") + "/media"
                : publicBaseUrl.isBlank() ? (endpoint.isBlank() ? "https://" + bucket + ".s3." + region + ".amazonaws.com" : endpoint + "/" + bucket)
                : publicBaseUrl;
        this.publicBase = base.replaceAll("/+$", "") + "/";
        this.apiBase = appBaseUrl.replaceAll("/+$", "") + "/media/";
        log.info("Mídia em S3: bucket {} (público em {}; restricted/ em {})", bucket, publicBase, apiBase);
    }

    @Override
    public URI createUploadUrl(String objectKey, String contentType) {
        return URI.create(presigner.presignPutObject(PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(10))
                .putObjectRequest(PutObjectRequest.builder().bucket(bucket).key(objectKey).contentType(contentType).build())
                .build()).url().toString());
    }

    @Override
    public URI publicUrl(String objectKey) {
        return URI.create((objectKey.startsWith("restricted/") ? apiBase : publicBase) + objectKey);
    }

    @Override
    public StoredObject put(String objectKey, byte[] content, String contentType) {
        s3.putObject(PutObjectRequest.builder().bucket(bucket).key(objectKey).contentType(contentType).build(),
                RequestBody.fromBytes(content));
        return new StoredObject(objectKey, publicUrl(objectKey).toString(), content.length, contentType);
    }

    @Override
    public byte[] get(String objectKey) {
        try {
            return s3.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(objectKey).build()).asByteArray();
        } catch (NoSuchKeyException e) {
            throw ApiException.notFound("Arquivo");
        }
    }

    @Override
    public void delete(String objectKey) {
        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(objectKey).build());
    }

    @Override
    public Optional<String> keyOf(String url) {
        if (url == null) {
            return Optional.empty();
        }
        String key = url.startsWith(publicBase) ? url.substring(publicBase.length())
                : url.startsWith(apiBase) ? url.substring(apiBase.length())
                : url.startsWith("/media/") ? url.substring("/media/".length()) : null;
        if (key == null || key.isBlank() || key.startsWith("/") || key.contains("..") || key.contains("\\")) {
            return Optional.empty();
        }
        return Optional.of(key);
    }

    @Override
    public List<String> listOlderThan(String prefix, Instant before, int limit) {
        return s3.listObjectsV2Paginator(ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).build())
                .contents().stream()
                .filter(o -> o.lastModified() != null && o.lastModified().isBefore(before))
                .limit(limit)
                .map(S3Object::key)
                .toList();
    }
}
