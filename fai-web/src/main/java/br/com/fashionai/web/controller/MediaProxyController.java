package br.com.fashionai.web.controller;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

/**
 * Bucket privado (Railway Storage Buckets não têm leitura pública): a API entrega a mídia em /media/** lendo do bucket.
 * As regras de acesso são as mesmas do armazenamento local: /media/restricted/** só para ADMIN (SecurityConfig).
 */
@RestController
@ConditionalOnProperty(name = "fashionai.storage.s3.serve-through-api", havingValue = "true")
public class MediaProxyController {
    private static final String PREFIX = "/media/";
    private final MediaStoragePort storage;

    public MediaProxyController(MediaStoragePort storage) {
        this.storage = storage;
    }

    @GetMapping("/media/**")
    public ResponseEntity<byte[]> media(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        String key = URLDecoder.decode(path.substring(PREFIX.length()), StandardCharsets.UTF_8);
        if (key.isBlank() || key.startsWith("/") || key.contains("..") || key.contains("\\")) {
            throw ApiException.notFound("Arquivo");
        }
        CacheControl cache = key.startsWith("restricted/") ? CacheControl.noStore() : CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic();
        return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(key).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .cacheControl(cache)
                .body(storage.get(key));
    }
}
