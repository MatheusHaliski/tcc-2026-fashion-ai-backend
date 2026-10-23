package br.com.fashionai.web.security;

import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.domain.model.EstadoConservacao;
import br.com.fashionai.domain.model.TipoLavagem;
import br.com.fashionai.domain.repository.EstadoConservacaoRepository;
import br.com.fashionai.domain.repository.TipoLavagemRepository;
import br.com.fashionai.web.config.SecurityConfig;
import br.com.fashionai.web.controller.PieceReferenceController;
import br.com.fashionai.web.error.ErrorWriter;
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
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PieceReferenceController.class)
@Import({PieceReferenceController.class, SecurityConfig.class, FashionAuthorization.class,
        AuditAccessDeniedHandler.class, AuditAuthenticationEntryPoint.class, ErrorWriter.class})
class PieceReferenceAccessTest {
    private static final UUID STATE_ID = UUID.fromString("a32ea7a1-b97c-4ff9-b47d-72c219667453");
    private static final UUID WASH_ID = UUID.fromString("3333666f-6b13-4cc9-913f-c7e5d529eb79");

    @Autowired
    private MockMvc mvc;

    @Test
    void anonymousCanReadOnlyTheCatalogFields() throws Exception {
        mvc.perform(get("/api/estados-conservacao")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(STATE_ID.toString()))
                .andExpect(jsonPath("$[0].codigo").value("SEMINOVA"))
                .andExpect(jsonPath("$[0].nome").value("Sem marcas de uso"))
                .andExpect(jsonPath("$[0].createdAt").doesNotExist());
        mvc.perform(get("/api/tipos-lavagem")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(WASH_ID.toString()))
                .andExpect(jsonPath("$[0].codigo").value("MANUAL"))
                .andExpect(jsonPath("$[0].nome").value("Lavar à mão"))
                .andExpect(jsonPath("$[0].createdBy").doesNotExist());
    }

    @Test
    void anonymousMutationsAndUnrelatedRoutesRemainProtected() throws Exception {
        for (String path : List.of("/api/estados-conservacao", "/api/tipos-lavagem")) {
            mvc.perform(post(path)).andExpect(status().isUnauthorized());
            mvc.perform(put(path)).andExpect(status().isUnauthorized());
            mvc.perform(patch(path)).andExpect(status().isUnauthorized());
            mvc.perform(delete(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path + "/private")).andExpect(status().isUnauthorized());
        }
        mvc.perform(get("/api/me/closet")).andExpect(status().isUnauthorized());
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class TestApplication {
        @Bean
        EstadoConservacaoRepository estados() {
            EstadoConservacao state = new EstadoConservacao();
            state.assignId(STATE_ID);
            state.setCodigo("SEMINOVA");
            state.setNome("Sem marcas de uso");
            return repository(EstadoConservacaoRepository.class, List.of(state));
        }

        @Bean
        TipoLavagemRepository lavagens() {
            TipoLavagem washing = new TipoLavagem();
            washing.assignId(WASH_ID);
            washing.setCodigo("MANUAL");
            washing.setNome("Lavar à mão");
            return repository(TipoLavagemRepository.class, List.of(washing));
        }

        @Bean
        AuditService auditService() { return event -> {}; }

        @Bean
        JwtDecoder jwtDecoder() {
            return token -> { throw new UnsupportedOperationException("Anonymous catalog tests do not decode JWTs"); };
        }

        private static <T> T repository(Class<T> type, List<?> rows) {
            return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (proxy, method, args) -> {
                if (method.getName().equals("findAllByOrderByNomeAsc")) return rows;
                if (method.getDeclaringClass() == Object.class) return switch (method.getName()) {
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == args[0];
                    default -> type.getSimpleName() + "Stub";
                };
                throw new UnsupportedOperationException(method.getName());
            }));
        }
    }
}
