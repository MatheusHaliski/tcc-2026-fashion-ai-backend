package br.com.fashionai.web.security;

import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SealDesignService;
import br.com.fashionai.application.service.AutopilotService;
import br.com.fashionai.application.service.CopilotService;
import br.com.fashionai.application.service.SealPolicyCopilot;
import br.com.fashionai.application.service.SealService;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.web.config.JsonCompatConfig;
import br.com.fashionai.web.config.SecurityConfig;
import br.com.fashionai.web.config.WebConfig;
import br.com.fashionai.web.controller.SealController;
import br.com.fashionai.web.controller.AutopilotController;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** MVC/security contracts: stable, specialized and ordinary Copilot routes preserve the same seal chat context. */
@WebMvcTest({SealController.class, AutopilotController.class})
@Import({SealController.class, AutopilotController.class, SecurityConfig.class, WebConfig.class, JsonCompatConfig.class, CurrentUserResolver.class,
        AuditAccessDeniedHandler.class, AuditAuthenticationEntryPoint.class, ErrorWriter.class, GlobalExceptionHandler.class})
class SealCopilotRoutesTest {
    static final UUID USER_ID = UUID.randomUUID();
    @Autowired private MockMvc mvc;
    private static final String BODY = """
            {"tier":"PERFIL","message":"#createsealpolicy Nike","previousPolicy":{"match":"ALL"},
             "conversation":[{"role":"user","text":"#createsealpolicy Camisetas azuis"},
                             {"role":"assistant","text":"Qual marca?"}]}
            """;

    @Test
    void allPostRoutesResolveAndPreserveTheChatPayloadForTheAuthenticatedIssuer() throws Exception {
        for (String route : List.of("/api/seals/draft", "/api/copilot/seal-policy", "/api/copilot/messages")) {
            mvc.perform(post(route).contentType("application/json").content(BODY)
                            .with(jwt().jwt(token -> token.subject(USER_ID.toString()).claim("user_id", USER_ID.toString()))))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.tier").value("PERFIL"))
                    .andExpect(jsonPath("$.conversation[1].text").value("Qual marca?"))
                    .andExpect(jsonPath("$.previousPolicy.match").value("ALL"));
        }
    }

    @Test
    void allRoutesRequireAuthenticationInsteadOfExposingAChatPublicly() throws Exception {
        for (String route : List.of("/api/seals/draft", "/api/copilot/seal-policy", "/api/copilot/messages")) {
            mvc.perform(post(route).contentType("application/json").content(BODY)).andExpect(status().isUnauthorized());
        }
    }

    static class StubSeals extends SealService {
        StubSeals() { super(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null); }
        // Route contract tests intentionally replace business services without starting persistence or a provider.
        @Override public void setSealPolicyContext(br.com.fashionai.domain.repository.AiInferenceLogRepository logs,
                                                   br.com.fashionai.domain.repository.BrandRepository brands,
                                                   br.com.fashionai.application.service.BackgroundStudioService backgrounds) { }
        @Override public Map<String, Object> draft(CurrentUser user, SealTier tier, String message, Map<String, Object> previous,
                                                  List<SealPolicyCopilot.Message> conversation) {
            return Map.of("status", "INCOMPLETE", "userId", user.id(), "tier", tier, "message", message,
                    "previousPolicy", previous, "conversation", SealPolicyCopilot.conversation(conversation));
        }
    }

    static class StubCopilot extends CopilotService {
        private final SealService seals;
        StubCopilot(SealService seals) {
            super(null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null);
            this.seals = seals;
        }
        @Override public Map<String, Object> ask(CurrentUser user, AskRequest request) {
            return seals.draft(user, request.tier(), request.message(), request.previousPolicy(), request.conversation());
        }
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class TestApplication {
        @Bean SealService sealService() { return new StubSeals(); }
        @Bean CopilotService copilotService(SealService seals) { return new StubCopilot(seals); }
        @Bean AutopilotService autopilotService() {
            return new AutopilotService(null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null);
        }
        @Bean SealDesignService sealDesignService() { return new SealDesignService(null, null); }
        @Bean AuditService auditService() { return event -> {}; }
        @Bean JwtDecoder jwtDecoder() { return token -> { throw new UnsupportedOperationException(); }; }
        @Bean UserRepository userRepository() {
            User user = new User(); user.assignId(USER_ID); user.setUsername("nike"); user.setProfileType(ProfileType.MARCA); user.setStatus(AccountStatus.ACTIVE);
            return (UserRepository) Proxy.newProxyInstance(UserRepository.class.getClassLoader(), new Class<?>[]{UserRepository.class}, (proxy, method, args) -> {
                if (method.getName().equals("findById")) return USER_ID.equals(args[0]) ? Optional.of(user) : Optional.empty();
                if (method.getDeclaringClass() == Object.class) return switch (method.getName()) {
                    case "hashCode" -> System.identityHashCode(proxy); case "equals" -> proxy == args[0]; default -> "UserRepositoryStub";
                };
                throw new UnsupportedOperationException(method.getName());
            });
        }
    }
}
