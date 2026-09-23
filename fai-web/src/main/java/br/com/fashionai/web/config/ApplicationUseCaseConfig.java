package br.com.fashionai.web.config;

import br.com.fashionai.application.ai.AiProviderPort;
import br.com.fashionai.application.rf.Rf24AiEngineUseCase;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ApplicationUseCaseConfig {
    @Bean
    Rf24AiEngineUseCase rf24AiEngineUseCase(AiProviderPort aiProviderPort) {
        return new Rf24AiEngineUseCase(aiProviderPort);
    }
}
