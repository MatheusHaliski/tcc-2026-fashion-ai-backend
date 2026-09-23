package br.com.fashionai.infrastructure.s3;

import br.com.fashionai.application.ports.MediaStoragePort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;

@Component
public class S3MediaStorageAdapter implements MediaStoragePort {
    private final String publicBaseUrl;

    public S3MediaStorageAdapter(@Value("${fashionai.storage.public-base-url:http://localhost:9000/fashionai-media}") String publicBaseUrl) {
        this.publicBaseUrl = publicBaseUrl;
    }

    @Override
    public URI createUploadUrl(String objectKey, String contentType) {
        return URI.create(publicBaseUrl + "/" + objectKey);
    }

    @Override
    public URI publicUrl(String objectKey) {
        return URI.create(publicBaseUrl + "/" + objectKey);
    }
}
