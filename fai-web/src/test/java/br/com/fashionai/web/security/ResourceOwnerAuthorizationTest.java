package br.com.fashionai.web.security;

import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.web.config.SecurityConfig;
import br.com.fashionai.web.controller.AccountController;
import br.com.fashionai.web.error.ErrorWriter;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AccountController.class)
@Import({AccountController.class, SecurityConfig.class, FashionAuthorization.class, AuditAccessDeniedHandler.class, AuditAuthenticationEntryPoint.class, ErrorWriter.class})
class ResourceOwnerAuthorizationTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void userAReceives403WhenAccessingUserBResource() throws Exception {
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();

        mockMvc.perform(get("/api/rf3/users/{userId}/privacy-probe", userB)
                        .with(jwt().jwt(token -> token
                                .subject(userA.toString())
                                .claim("user_id", userA.toString()))))
                .andExpect(status().isForbidden());
    }

    @Test
    void ownerCanAccessOwnResource() throws Exception {
        UUID userA = UUID.randomUUID();

        mockMvc.perform(get("/api/rf3/users/{userId}/privacy-probe", userA)
                        .with(jwt().jwt(token -> token
                                .subject(userA.toString())
                                .claim("user_id", userA.toString()))))
                .andExpect(status().isOk());
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class TestApplication {
        @Bean
        AuditService auditService() {
            return event -> {
            };
        }

        @Bean
        JwtDecoder jwtDecoder() {
            return token -> {
                throw new UnsupportedOperationException("JWT decoding is supplied by spring-security-test");
            };
        }
    }
}
