package br.com.fashionai.web.config;

import io.swagger.v3.oas.models.OpenAPI;
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
                        .description("Backend Java do Fashion AI. Cada endpoint usa o RF de origem no summary."));
    }
}
