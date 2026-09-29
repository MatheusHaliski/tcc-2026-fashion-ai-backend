package br.com.fashionai.infrastructure.platform.storage;

import br.com.fashionai.application.service.MediaService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Serve os arquivos do armazenamento local em /media/** (somente leitura). Cache por tipo de conteúdo:
 * {@code restricted/} nunca fica em cache (só ADMIN lê, SecurityConfig); fotos de pessoas ({@code users/},
 * {@code pending/}, {@code challenges/}) só no cache do navegador ({@code private}); catálogo e marcas, cache público.
 */
@Configuration
@ConditionalOnBean(LocalFileMediaStorage.class)
public class LocalMediaWebConfig implements WebMvcConfigurer {
    /** Prefixos com dados de pessoas: CDN/proxy compartilhado não guarda cópia. */
    public static final List<String> PRIVATE_PREFIXES = MediaService.PERSONAL_PREFIXES;

    private final LocalFileMediaStorage storage;

    public LocalMediaWebConfig(LocalFileMediaStorage storage) {
        this.storage = storage;
    }

    /** Cache-Control da chave servida em /media/** (o mesmo para o storage local e para o proxy do bucket). */
    public static CacheControl cacheFor(String key) {
        if (key.startsWith("restricted/")) {
            return CacheControl.noStore();
        }
        if (PRIVATE_PREFIXES.stream().anyMatch(key::startsWith)) {
            return CacheControl.maxAge(1, TimeUnit.DAYS).cachePrivate();
        }
        return CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic();
    }

    /** Exportações LGPD antigas (antes de irem para restricted/) só saem pelo endpoint autenticado do dono. */
    static boolean servable(String key) {
        return !key.matches("^users/[^/]+/exports/.*");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String root = storage.root().toUri().toString();
        String location = root.endsWith("/") ? root : root + "/";
        PathResourceResolver resolver = new PathResourceResolver() {
            @Override
            protected Resource getResource(String resourcePath, Resource location) throws IOException {
                return servable(resourcePath) ? super.getResource(resourcePath, location) : null;
            }
        };
        registry.addResourceHandler("/media/restricted/**")
                .addResourceLocations(location + "restricted/")
                .setCacheControl(CacheControl.noStore());
        for (String prefix : PRIVATE_PREFIXES) {
            registry.addResourceHandler("/media/" + prefix + "**")
                    .addResourceLocations(location + prefix)
                    .setCacheControl(cacheFor(prefix))
                    .resourceChain(false)
                    .addResolver(prefix.equals("users/") ? new PathResourceResolver() {
                        @Override
                        protected Resource getResource(String resourcePath, Resource location) throws IOException {
                            return servable("users/" + resourcePath) ? super.getResource(resourcePath, location) : null;
                        }
                    } : new PathResourceResolver());
        }
        registry.addResourceHandler("/media/**")
                .addResourceLocations(location)
                .setCacheControl(cacheFor(""))
                .resourceChain(false)
                .addResolver(resolver);
    }
}
