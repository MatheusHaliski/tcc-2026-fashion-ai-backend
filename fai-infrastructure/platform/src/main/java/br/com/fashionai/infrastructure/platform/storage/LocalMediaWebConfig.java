package br.com.fashionai.infrastructure.platform.storage;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.TimeUnit;

/** Serve os arquivos do armazenamento local em /media/** (somente leitura, cache de 1 dia). */
@Configuration
@ConditionalOnBean(LocalFileMediaStorage.class)
public class LocalMediaWebConfig implements WebMvcConfigurer {
    private final LocalFileMediaStorage storage;

    public LocalMediaWebConfig(LocalFileMediaStorage storage) {
        this.storage = storage;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/media/**")
                .addResourceLocations(storage.root().toUri().toString())
                .setCacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic());
    }
}
