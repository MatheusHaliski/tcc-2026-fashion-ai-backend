package br.com.fashionai.web.controller;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.service.MediaService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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
 * Mídia do bucket entregue pela API em /media/** (Railway Storage Buckets não têm leitura pública). As regras de acesso
 * são as mesmas do armazenamento local: /media/restricted/** só para ADMIN (SecurityConfig). Com o bucket público
 * (S3_SERVE_THROUGH_API=false) a API entrega só {@code restricted/} — é a única forma de a regra de ADMIN valer, então
 * o adaptador S3 sempre emite URLs da API para essas chaves.
 */
@RestController
@ConditionalOnProperty(name = "fashionai.storage.type", havingValue = "s3")
public class MediaProxyController {
    private static final String PREFIX = "/media/";
    private final MediaStoragePort storage;
    private final boolean serveAll;

    public MediaProxyController(MediaStoragePort storage) {
        this(storage, true);
    }

    @Autowired
    public MediaProxyController(MediaStoragePort storage,
                                @Value("${fashionai.storage.s3.serve-through-api:false}") boolean serveAll) {
        this.storage = storage;
        this.serveAll = serveAll;
    }

    @GetMapping("/media/**")
    public ResponseEntity<byte[]> media(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        String key = URLDecoder.decode(path.substring(PREFIX.length()), StandardCharsets.UTF_8);
        if (key.isBlank() || key.startsWith("/") || key.contains("..") || key.contains("\\")) {
            throw ApiException.notFound("Arquivo");
        }
        boolean restricted = key.startsWith("restricted/");
        if (!serveAll && !restricted || key.matches("^users/[^/]+/exports/.*") || key.startsWith("backups/")) {
            // bucket público serve o resto; exportações LGPD antigas só pelo endpoint autenticado do dono; dumps antigos
            // do banco (antes de restricted/backups/) nunca saem por aqui
            throw ApiException.notFound("Arquivo");
        }
        return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(key).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .cacheControl(cacheFor(key))
                .body(storage.get(key));
    }

    /** {@code restricted/} sem cache; fotos de pessoas só no navegador; catálogo e marcas, cache público. */
    static CacheControl cacheFor(String key) {
        if (key.startsWith("restricted/")) {
            return CacheControl.noStore();
        }
        if (MediaService.PERSONAL_PREFIXES.stream().anyMatch(key::startsWith)) {
            return CacheControl.maxAge(1, TimeUnit.DAYS).cachePrivate();
        }
        return CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic();
    }
}
