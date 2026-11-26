package br.com.fashionai.web.controller;

import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.service.CopilotService;
import br.com.fashionai.application.service.LookPreviewService;
import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.web.config.JsonCompatConfig;
import br.com.fashionai.web.config.SecurityConfig;
import br.com.fashionai.web.config.WebConfig;
import br.com.fashionai.web.error.ErrorWriter;
import br.com.fashionai.web.error.GlobalExceptionHandler;
import br.com.fashionai.web.security.AuditAccessDeniedHandler;
import br.com.fashionai.web.security.AuditAuthenticationEntryPoint;
import br.com.fashionai.web.security.CurrentUserResolver;
import br.com.fashionai.web.security.FashionAuthorization;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.lang.reflect.Proxy;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercício 06 — estação preferida do look no criar/editar (POST/PUT /api/schemes): os códigos do enum Season valem
 * (SPRING, SUMMER, AUTUMN, WINTER, sem diferença de caixa), vazio e ausente são "sem estação" (null), e qualquer outro
 * texto ("VERAO", "verão", "MONSOON") é recusado com 400 JSON_INVALIDO antes de chegar ao serviço — nunca vira SUMMER.
 */
@WebMvcTest(SchemeController.class)
@Import({SchemeController.class, SecurityConfig.class, FashionAuthorization.class, AuditAccessDeniedHandler.class, AuditAuthenticationEntryPoint.class,
        ErrorWriter.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserResolver.class, JsonCompatConfig.class})
class SchemeSeasonHttpTest {
    static final UUID USER_ID = UUID.randomUUID();
    static final UUID LOOK_ID = UUID.randomUUID();

    @Autowired
    private MockMvc mvc;

    @BeforeEach
    void limpa() {
        Fk.reset();
    }

    private MockHttpServletRequestBuilder signed(MockHttpServletRequestBuilder r, String json) {
        return r.with(jwt().jwt(t -> t.subject(USER_ID.toString()).claim("user_id", USER_ID.toString())))
                .contentType(MediaType.APPLICATION_JSON).content(json);
    }

    private Season seasonSentToService(String method) {
        Fk.Call call = Fk.calls.stream().filter(c -> c.method().equals(method)).findFirst().orElseThrow();
        Object form = call.args()[call.args().length - 1];
        return ((SchemeService.SchemeForm) form).season();
    }

    @Test
    void codigosDoEnumChegamAoServicoSemDiferencaDeCaixa() throws Exception {
        mvc.perform(signed(post("/api/schemes"), "{\"title\":\"Look\",\"season\":\"WINTER\"}")).andExpect(status().isCreated());
        assertThat(seasonSentToService("create")).isEqualTo(Season.WINTER);
        Fk.reset();
        mvc.perform(signed(put("/api/schemes/" + LOOK_ID), "{\"title\":\"Look\",\"season\":\"spring\"}")).andExpect(status().isOk());
        assertThat(seasonSentToService("update")).isEqualTo(Season.SPRING);
    }

    @Test
    void vazioOuAusenteESemEstacaoNuncaSummer() throws Exception {
        for (String body : new String[]{"{\"title\":\"Look\",\"season\":\"\"}", "{\"title\":\"Look\",\"season\":null}", "{\"title\":\"Look\"}"}) {
            Fk.reset();
            mvc.perform(signed(post("/api/schemes"), body)).andExpect(status().isCreated());
            assertThat(seasonSentToService("create")).as(body).isNull();
        }
    }

    @Test
    void textoForaDoEnumDa400JsonInvalidoSemChegarAoServico() throws Exception {
        for (String season : new String[]{"VERAO", "verão", "MONSOON", "SUMMERX"}) {
            String body = "{\"title\":\"Look\",\"season\":\"" + season + "\"}";
            mvc.perform(signed(post("/api/schemes"), body)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("JSON_INVALIDO"));
            mvc.perform(signed(put("/api/schemes/" + LOOK_ID), body)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("JSON_INVALIDO"));
        }
        assertThat(Fk.calls).noneMatch(c -> c.method().equals("create") || c.method().equals("update"));
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
        SchemeService schemeService() {
            return new ServiceFakes.FakeSchemeService();
        }

        /** único campo obrigatório que o Spring injeta no SchemeService (o dublê não usa) */
        @Bean
        br.com.fashionai.application.service.LookTypePreferencesService lookTypePreferencesService() {
            return new br.com.fashionai.application.service.LookTypePreferencesService(null, null, null);
        }

        @Bean
        CopilotService copilotService() {
            return new ServiceFakes.FakeCopilotService();
        }

        @Bean
        LookPreviewService lookPreviewService() {
            return new ServiceFakes.FakeLookPreviewService();
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
