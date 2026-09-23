package br.com.fashionai.application.ports;

import java.net.URI;

/** Object Storage (S3/MinIO em dev, S3/Vercel Blob em produção) — no banco fica só a chave/URL. */
public interface MediaStoragePort {
    URI createUploadUrl(String objectKey, String contentType);

    URI publicUrl(String objectKey);

    StoredObject put(String objectKey, byte[] content, String contentType);

    byte[] get(String objectKey);

    void delete(String objectKey);

    /** Chave de objeto a partir de uma URL pública emitida por este storage (vazio se for URL externa). */
    java.util.Optional<String> keyOf(String url);

    record StoredObject(String key, String url, long size, String contentType) {
    }
}
