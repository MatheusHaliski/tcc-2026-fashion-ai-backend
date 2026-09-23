package br.com.fashionai.application.ports;

import java.net.URI;

public interface MediaStoragePort {
    URI createUploadUrl(String objectKey, String contentType);

    URI publicUrl(String objectKey);
}
