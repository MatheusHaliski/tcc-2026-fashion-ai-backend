package br.com.fashionai.web.security;

import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.lens.LensService;
import br.com.fashionai.application.lens.LensViews;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.web.config.SecurityConfig;
import br.com.fashionai.web.config.WebConfig;
import br.com.fashionai.web.controller.LensController;
import br.com.fashionai.web.error.ErrorWriter;
import br.com.fashionai.web.error.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * RF54 · Rotas do FashionAI Lens: tudo exige login (401 para visitante); o scan é do dono e outra pessoa recebe 404
 * (nunca 403); a imagem sai como JPEG com cache só do navegador; o multipart chega ao serviço com os campos do contrato.
 */
@WebMvcTest(LensController.class)
@Import({LensController.class, SecurityConfig.class, FashionAuthorization.class, AuditAccessDeniedHandler.class, AuditAuthenticationEntryPoint.class,
        ErrorWriter.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserResolver.class})
class LensAccessTest {
    static final UUID OWNER = UUID.randomUUID();
    static final UUID OTHER = UUID.randomUUID();
    static final UUID SCAN = UUID.randomUUID();
    static final List<LensService.CreateCommand> creates = new ArrayList<>();

    @Autowired
    private MockMvc mockMvc;

    /** Serviço de mentira (fai-web não tem Mockito): o scan SCAN é de OWNER; para qualquer outra pessoa, 404. */
    static class StubLens extends LensService {
        StubLens() {
            super(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        }

        static LensViews.ScanView view() {
            LensViews.ReadingView reading = new LensViews.ReadingView(List.of(), List.of(), List.of(), null, null,
                    new LensViews.Trend("INSUFFICIENT_DATA", null, null, null, null, null, 0), new LensViews.Impact(0, 0, 0));
            return new LensViews.ScanView(SCAN, "READY", null, "CAMERA", "IDENTIFY", Instant.now(), Instant.now(), null, 10, 10, 0,
                    "ia", "LENS_V1", "m", List.of(), reading);
        }

        private static void requireOwner(CurrentUser user) {
            if (user == null || !OWNER.equals(user.id())) {
                throw ApiException.notFound("Scan do Lens");
            }
        }

        @Override
        public LensViews.ScanView get(CurrentUser user, UUID id) {
            requireOwner(user);
            return view();
        }

        @Override
        public byte[] image(CurrentUser user, UUID id, boolean thumb) {
            requireOwner(user);
            return new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
        }

        @Override
        public void delete(CurrentUser user, UUID id) {
            requireOwner(user);
        }

        @Override
        public LensViews.ScanView create(CurrentUser user, CreateCommand cmd, byte[] bytes) {
            creates.add(cmd);
            return view();
        }
    }

    static RequestPostProcessor as(UUID id) {
        return jwt().jwt(t -> t.subject(id.toString()).claim("user_id", id.toString()));
    }

    @Test
    void visitanteRecebe401() throws Exception {
        mockMvc.perform(get("/api/lens/scans/{id}", SCAN)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/lens/scans/{id}/image", SCAN)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/me/lens/scans")).andExpect(status().isUnauthorized());
    }

    @Test
    void outraPessoaRecebe404NuncaForbidden() throws Exception {
        mockMvc.perform(get("/api/lens/scans/{id}", SCAN).with(as(OTHER))).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/lens/scans/{id}/image", SCAN).with(as(OTHER))).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/lens/scans/{id}", SCAN).with(as(OTHER))).andExpect(status().isNotFound());
    }

    @Test
    void donoLeOScanEAImagemPrivada() throws Exception {
        mockMvc.perform(get("/api/lens/scans/{id}", SCAN).with(as(OWNER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(SCAN.toString()))
                .andExpect(jsonPath("$.algorithmVersion").value("LENS_V1"))
                .andExpect(jsonPath("$.savedAt").isEmpty())
                .andExpect(jsonPath("$.reading.trend.status").value("INSUFFICIENT_DATA"));
        mockMvc.perform(get("/api/lens/scans/{id}/image", SCAN).with(as(OWNER)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("private")));
        mockMvc.perform(delete("/api/lens/scans/{id}", SCAN).with(as(OWNER))).andExpect(status().isNoContent());
    }

    @Test
    void multipartChegaComOsCamposDoContrato() throws Exception {
        creates.clear();
        MockMultipartFile image = new MockMultipartFile("image", "lens.jpg", "image/jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, 1, 2});
        mockMvc.perform(multipart("/api/lens/scans").file(image).param("source", "CAMERA").param("intent", "IDENTIFY")
                        .param("facesRedacted", "2").param("redactionConfirmed", "false").with(as(OWNER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"));
        assertThat(creates).containsExactly(new LensService.CreateCommand("CAMERA", "IDENTIFY", 2, false));
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
        LensService lensService() {
            return new StubLens();
        }

        @Bean
        UserRepository userRepository() {
            return (UserRepository) Proxy.newProxyInstance(UserRepository.class.getClassLoader(), new Class<?>[]{UserRepository.class}, (proxy, method, args) -> {
                if (method.getName().equals("findById")) {
                    UUID id = (UUID) args[0];
                    if (!OWNER.equals(id) && !OTHER.equals(id)) {
                        return Optional.empty();
                    }
                    User u = new User();
                    u.assignId(id);
                    u.setUsername(OWNER.equals(id) ? "dona" : "outra");
                    u.setProfileType(ProfileType.PESSOAL);
                    u.setStatus(AccountStatus.ACTIVE);
                    u.setEmailVerified(true);
                    return Optional.of(u);
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
