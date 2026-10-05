package br.com.fashionai.web.security;

import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.insights.InsightService;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.web.config.SecurityConfig;
import br.com.fashionai.web.config.WebConfig;
import br.com.fashionai.web.controller.InsightsController;
import br.com.fashionai.web.error.ErrorWriter;
import br.com.fashionai.web.error.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** GET /api/insights: visitante lê os contextos públicos do Explorador; os pessoais exigem login (401). */
@WebMvcTest(InsightsController.class)
@Import({InsightsController.class, SecurityConfig.class, FashionAuthorization.class, AuditAccessDeniedHandler.class, AuditAuthenticationEntryPoint.class,
        ErrorWriter.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserResolver.class})
class InsightsAccessTest {
    static final UUID USER_ID = UUID.randomUUID();
    /** Quem chegou ao serviço (contexto e se havia usuário): o 401 dos pessoais acontece antes. */
    static final List<String> calls = new ArrayList<>();

    @Autowired
    private MockMvc mockMvc;

    /** Serviço de mentira (fai-web não tem Mockito): devolve a resposta do contrato e registra a chamada. */
    static class StubInsights extends InsightService {
        StubInsights() {
            super(new HypeQueryService(HypeScoreConfig.defaults(), null, null, null, null, null, null, null, null, null, null),
                    null, null, null, null, null, null, null, null, null, null, null);
        }

        @Override
        public Map<String, Object> insights(CurrentUser viewer, String context, Integer window, String region, String category, String subcategory,
                                            boolean withAi) {
            calls.add(context + ":" + (viewer == null ? "anon" : "user"));
            return Map.of("context", context, "source", "local", "algorithmVersion", "HYPE_V2", "items", List.of());
        }
    }

    @Test
    void anonymousGetsThePublicExplorerContexts() throws Exception {
        calls.clear();
        for (String ctx : List.of("EXPLORER_RUNWAY", "EXPLORER_TRENDING", "EXPLORER_RANKING", "EXPLORER_MAP", "EXPLORER_BRANDS", "EXPLORER_GLOBAL")) {
            mockMvc.perform(get("/api/insights").param("context", ctx).param("window", "7"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.context").value(ctx));
        }
        assertThat(calls).hasSize(6).allMatch(c -> c.endsWith(":anon"));
    }

    @Test
    void anonymousGets401OnPersonalContexts() throws Exception {
        calls.clear();
        for (String ctx : List.of("CAPSULE", "COPILOT", "AUTOPILOT", "HISTORY", "CLOSET", "LOOKS")) {
            mockMvc.perform(get("/api/insights").param("context", ctx)).andExpect(status().isUnauthorized());
        }
        assertThat(calls).isEmpty();
    }

    @Test
    void signedInUserGetsPersonalContexts() throws Exception {
        calls.clear();
        mockMvc.perform(get("/api/insights").param("context", "CAPSULE")
                        .with(jwt().jwt(t -> t.subject(USER_ID.toString()).claim("user_id", USER_ID.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.context").value("CAPSULE"));
        assertThat(calls).containsExactly("CAPSULE:user");
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
        InsightService insightService() {
            return new StubInsights();
        }

        @Bean
        UserRepository userRepository() {
            User u = new User();
            u.assignId(USER_ID);
            u.setUsername("ana");
            u.setProfileType(br.com.fashionai.domain.model.enums.ProfileType.PESSOAL);
            u.setStatus(AccountStatus.ACTIVE);
            return (UserRepository) Proxy.newProxyInstance(UserRepository.class.getClassLoader(), new Class<?>[]{UserRepository.class}, (proxy, method, args) -> {
                if (method.getName().equals("findById")) {
                    return USER_ID.equals(args[0]) ? Optional.of(u) : Optional.empty();
                }
                if (method.getDeclaringClass() == Object.class) {
                    return switch (method.getName()) {
                        case "hashCode" -> System.identityHashCode(proxy);
                        case "equals" -> proxy == args[0];
                        default -> "UserRepositoryStub";
                    };
                }
                throw new UnsupportedOperationException(method.getName());
            });
        }

        @Bean
        JwtDecoder jwtDecoder() {
            return token -> {
                throw new UnsupportedOperationException("JWT decoding is supplied by spring-security-test");
            };
        }
    }
}
