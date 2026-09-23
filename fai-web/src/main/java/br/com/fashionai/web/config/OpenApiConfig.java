package br.com.fashionai.web.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI fashionAiOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Fashion AI API")
                        .version("0.1.0")
                        .description("""
                                API REST do Fashion AI (TCC 2026). Cada endpoint indica o RF de origem no summary.
                                Autentique com `POST /api/auth/login` e envie `Authorization: Bearer <accessToken>`.
                                Erros sempre voltam como `{status, code, message, details, path, timestamp, correlationId}`.
                                """))
                .components(new Components().addSecuritySchemes("bearer", new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearer"));
    }
}
