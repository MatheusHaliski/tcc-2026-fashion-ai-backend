package br.com.fashionai.application.demo;

import br.com.fashionai.application.common.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Trava do Demo/Test Data Pipeline: desligado por padrão (FASHIONAI_DEMO_ENABLED=false) e, em ambiente de produção
 * (RAILWAY_ENVIRONMENT_NAME ou APP_ENV = production), exige também FASHIONAI_DEMO_ALLOW_PRODUCTION=true.
 */
@Component
public class DemoEnvironmentGuard {
    private final boolean enabled;
    private final boolean allowProduction;
    private final String environment;

    public DemoEnvironmentGuard(@Value("${fashionai.demo.enabled:false}") boolean enabled,
                                @Value("${fashionai.demo.allow-production:false}") boolean allowProduction,
                                @Value("${RAILWAY_ENVIRONMENT_NAME:${APP_ENV:local}}") String environment) {
        this.enabled = enabled;
        this.allowProduction = allowProduction;
        this.environment = environment == null ? "local" : environment.trim().toLowerCase(Locale.ROOT);
    }

    public boolean production() {
        return environment.equals("production") || environment.equals("prod");
    }

    public String environment() {
        return environment;
    }

    public void requireEnabled() {
        if (!enabled) {
            throw new ApiException(403, "DEMO_DESLIGADO", "Demo/Test Data Pipeline desligado neste ambiente (FASHIONAI_DEMO_ENABLED=false).");
        }
        if (production() && !allowProduction) {
            throw new ApiException(403, "DEMO_BLOQUEADO_EM_PRODUCAO",
                    "Demo/Test Data Pipeline bloqueado em produção (use o ambiente staging ou FASHIONAI_DEMO_ALLOW_PRODUCTION=true).");
        }
    }
}
