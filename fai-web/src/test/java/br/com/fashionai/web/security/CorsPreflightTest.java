package br.com.fashionai.web.security;

import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.identity.PasswordHasherPort;
import br.com.fashionai.application.service.IdentityService;
import br.com.fashionai.web.config.SecurityConfig;
import br.com.fashionai.web.controller.AuthController;
import br.com.fashionai.web.error.ErrorWriter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CORS/preflight em /api/auth/password-reset/request (RF2.CA06). Reproduz o incidente de produção: a origem do
 * frontend precisa constar em {@code fashionai.cors.allowed-origins} (Railway: {@code APP_CORS_ALLOWED_ORIGINS}) —
 * sem isso o {@code DefaultCorsProcessor} do Spring recusa o preflight com 403 e o POST nunca chega ao controller.
 * O Dev Gate (X-Dev-Gate) não entra nessa causa: {@link br.com.fashionai.web.support.DevGateFilter#shouldNotFilter}
 * já ignora OPTIONS, então o filtro do gate nunca chega a rodar no preflight.
 */
@WebMvcTest(AuthController.class)
@Import({AuthController.class, SecurityConfig.class, FashionAuthorization.class, AuditAccessDeniedHandler.class, AuditAuthenticationEntryPoint.class, ErrorWriter.class})
@TestPropertySource(properties = "fashionai.cors.allowed-origins=https://fashion-ai-tcc-2026.vercel.app,https://fai-network.com")
class CorsPreflightTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void preflightDeOrigemPermitidaPassaComOsCabecalhosDoDevGate() throws Exception {
        mockMvc.perform(options("/api/auth/password-reset/request")
                        .header("Origin", "https://fai-network.com")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type,x-dev-gate"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://fai-network.com"))
                .andExpect(header().string("Access-Control-Allow-Methods", org.hamcrest.Matchers.containsString("POST")))
                .andExpect(header().string("Access-Control-Allow-Headers", org.hamcrest.Matchers.containsStringIgnoringCase("x-dev-gate")));
    }

    @Test
    void preflightDaOrigemVercelContinuaPermitido() throws Exception {
        mockMvc.perform(options("/api/auth/password-reset/request")
                        .header("Origin", "https://fashion-ai-tcc-2026.vercel.app")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type,x-dev-gate"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://fashion-ai-tcc-2026.vercel.app"));
    }

    @Test
    void preflightDeOrigemForaDaAllowlistERecusado() throws Exception {
        mockMvc.perform(options("/api/auth/password-reset/request")
                        .header("Origin", "https://site-nao-autorizado.com")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type,x-dev-gate"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void postRealDeOrigemPermitidaExecutaEDevolveOCabecalhoCors() throws Exception {
        mockMvc.perform(post("/api/auth/password-reset/request")
                        .header("Origin", "https://fai-network.com")
                        .contentType("application/json")
                        .content("{\"email\":\"pessoa@example.com\"}"))
                .andExpect(status().isAccepted())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://fai-network.com"));
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class TestApplication {
        @Bean
        IdentityService identityService() {
            return new NoopIdentityService();
        }

        @Bean
        AuditService auditService() {
            return event -> {
            };
        }

        @Bean
        JwtDecoder jwtDecoder() {
            return token -> {
                throw new UnsupportedOperationException("sem JWT nestes testes: só o preflight/POST público de CORS");
            };
        }
    }

    /** IdentityService real (não um mock — fai-web exclui Mockito de propósito), só com requestPasswordReset neutra. */
    static class NoopIdentityService extends IdentityService {
        NoopIdentityService() {
            super(null, null, null, null, null, null, new PasswordHasherPort() {
                @Override
                public String hash(String rawPassword) {
                    return "hash";
                }

                @Override
                public boolean matches(String rawPassword, String encodedPassword) {
                    return false;
                }
            }, null, null, null, null, null, null, "http://localhost:3000");
        }

        @Override
        public void requestPasswordReset(String email, String ip, String userAgent) {
            // no-op: o teste só verifica CORS, não a lógica de redefinição de senha
        }
    }
}
