package br.com.fashionai.web.config;

import br.com.fashionai.web.security.CurrentUserResolver;
import br.com.fashionai.web.support.UploadSafetyInterceptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final CurrentUserResolver currentUserResolver;
    private final ObjectProvider<UploadSafetyInterceptor> uploadSafety;

    public WebConfig(CurrentUserResolver currentUserResolver, ObjectProvider<UploadSafetyInterceptor> uploadSafety) {
        this.currentUserResolver = currentUserResolver;
        this.uploadSafety = uploadSafety;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentUserResolver);
    }

    /** Moderação das fotos enviadas antes de qualquer controller (docs/seguranca/moderacao-de-imagens.md). */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        uploadSafety.ifAvailable(i -> registry.addInterceptor(i).addPathPatterns("/api/**"));
    }
}
