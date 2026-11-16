package br.com.fashionai.web.security;

import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.domain.model.Colecao;
import br.com.fashionai.domain.model.EstadoConservacao;
import br.com.fashionai.domain.model.IntensidadeTermica;
import br.com.fashionai.domain.model.TipoLavagem;
import br.com.fashionai.domain.repository.ColecaoRepository;
import br.com.fashionai.domain.repository.EstadoConservacaoRepository;
import br.com.fashionai.domain.repository.IntensidadeTermicaRepository;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PieceReferenceController.class)
@Import({PieceReferenceController.class, SecurityConfig.class, FashionAuthorization.class,
        AuditAccessDeniedHandler.class, AuditAuthenticationEntryPoint.class, ErrorWriter.class,
        PieceReferenceAccessTest.CampoNovo.class})
class PieceReferenceAccessTest {
    private static final UUID STATE_ID = UUID.fromString("a32ea7a1-b97c-4ff9-b47d-72c219667453");
    private static final UUID WASH_ID = UUID.fromString("3333666f-6b13-4cc9-913f-c7e5d529eb79");
    private static final UUID COLLECTION_ID = UUID.fromString("7d0b3a52-6c1e-4f0a-9a43-2f1d5e8c9b10");
    private static final UUID THERMAL_ID = UUID.fromString("c4f1e0d2-8b3a-4e6f-9d21-5a7b8c9d0e11");

    @Autowired
    private MockMvc mvc;

    @Test
    void anonymousCanReadOnlyTheCatalogFields() throws Exception {
        mvc.perform(get("/api/estados-conservacao")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(STATE_ID.toString()))
                .andExpect(jsonPath("$[0].codigo").value("SEMINOVA"))
                .andExpect(jsonPath("$[0].nome").value("Sem marcas de uso"))
                .andExpect(jsonPath("$[0].createdAt").doesNotExist());
        mvc.perform(get("/api/opcoes/estados-conservacao")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].codigo").value("SEMINOVA"));
        mvc.perform(get("/api/tipos-lavagem")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(WASH_ID.toString()))
                .andExpect(jsonPath("$[0].codigo").value("MANUAL"))
                .andExpect(jsonPath("$[0].nome").value("Lavar à mão"))
                .andExpect(jsonPath("$[0].createdBy").doesNotExist());
        mvc.perform(get("/api/colecoes")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(COLLECTION_ID.toString()))
                .andExpect(jsonPath("$[0].codigo").value("VERAO"))
                .andExpect(jsonPath("$[0].nome").value("Verão"))
                .andExpect(jsonPath("$[0].createdAt").doesNotExist());
        mvc.perform(get("/api/intensidades-termicas")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(THERMAL_ID.toString()))
                .andExpect(jsonPath("$[0].codigo").value("ALTA"))
                .andExpect(jsonPath("$[0].nome").value("Alta (dias frios)"))
                .andExpect(jsonPath("$[0].updatedAt").doesNotExist());
    }

    @Test
    void anonymousMutationsAndUnrelatedRoutesRemainProtected() throws Exception {
        for (String path : List.of("/api/estados-conservacao", "/api/opcoes/estados-conservacao", "/api/tipos-lavagem",
                "/api/colecoes", "/api/intensidades-termicas")) {
            mvc.perform(post(path)).andExpect(status().isUnauthorized());
            mvc.perform(put(path)).andExpect(status().isUnauthorized());
            mvc.perform(patch(path)).andExpect(status().isUnauthorized());
            mvc.perform(delete(path)).andExpect(status().isUnauthorized());
            // sob /api/opcoes/** a leitura é pública por convenção: rota inexistente dá 404, sem handler a expor
            mvc.perform(get(path + "/private")).andExpect(path.startsWith("/api/opcoes/") ? status().isNotFound() : status().isUnauthorized());
        }
        mvc.perform(get("/api/me/closet")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/tipo-lavagem")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/tipo-lavagem").with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(WASH_ID.toString()));
    }

    /**
     * Campo novo dos criadores (ex.: Origem): o GET novo não está em PUBLIC_GET e nada em SecurityConfig muda. Com a
     * sessão, que o campo compartilhado dos criadores manda, ele carrega; sem sessão continua 401 (não vira público).
     */
    @Test
    void aNewOptionsEndpointLoadsWithTheSessionWithoutTouchingSecurity() throws Exception {
        mvc.perform(get("/api/exemplo/origens")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/exemplo/origens").with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].codigo").value("HERDADA"));
    }

    /** Convenção /api/opcoes/**: GET público também para páginas sem sessão; escrita continua exigindo sessão. */
    @Test
    void optionsConventionIsPublicOnlyForReads() throws Exception {
        mvc.perform(get("/api/opcoes/exemplo-origens")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].codigo").value("ADQUIRIDA"));
        mvc.perform(delete("/api/opcoes/exemplo-origens")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/opcoes/exemplo-origens")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/opcoes-privadas")).andExpect(status().isUnauthorized());
    }

    /** Endpoints de exemplo de um campo novo, fora de PUBLIC_GET. */
    @RestController
    static class CampoNovo {
        @GetMapping("/api/exemplo/origens")
        List<Map<String, String>> origens() { return List.of(Map.of("codigo", "HERDADA", "nome", "Herdada")); }

        @GetMapping("/api/opcoes/exemplo-origens")
        List<Map<String, String>> origensPorConvencao() { return List.of(Map.of("codigo", "ADQUIRIDA", "nome", "Adquirida")); }

        @DeleteMapping("/api/opcoes/exemplo-origens")
        void apagar() { }

        @GetMapping("/api/opcoes-privadas")
        List<String> fora() { return List.of("privado"); }
    }

    @Test
    void newPrivateModulesDoNotInheritPublicPieceOrShareAccess() throws Exception {
        String id = STATE_ID.toString();
        for (String path : List.of("/api/pieces/" + id + "/passport",
                "/api/passports/" + id + "/my-evidence", "/api/passport-evidence/" + id + "/content",
                "/api/me/passport-transfers", "/api/me/fit-measurements",
                "/api/catalog/products/" + id + "/size-chart", "/api/atelier/projects")) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
        }
        for (String path : List.of("/api/passport-shares/token", "/api/pieces/" + id + "/passport",
                "/api/catalog/products/" + id + "/size-recommendations", "/api/atelier/projects")) {
            mvc.perform(post(path)).andExpect(status().isUnauthorized());
        }
        mvc.perform(get("/api/passport-shares/token/private")).andExpect(status().isUnauthorized());
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
        ColecaoRepository colecoes() {
            Colecao summer = new Colecao();
            summer.assignId(COLLECTION_ID);
            summer.setCodigo("VERAO");
            summer.setNome("Verão");
            return repository(ColecaoRepository.class, List.of(summer));
        }

        @Bean
        IntensidadeTermicaRepository intensidades() {
            IntensidadeTermica high = new IntensidadeTermica();
            high.assignId(THERMAL_ID);
            high.setCodigo("ALTA");
            high.setNome("Alta (dias frios)");
            return repository(IntensidadeTermicaRepository.class, List.of(high));
        }

        @Bean
        AuditService auditService() { return event -> {}; }

        @Bean
        JwtDecoder jwtDecoder() {
            return token -> { throw new UnsupportedOperationException("Anonymous catalog tests do not decode JWTs"); };
        }

        private static <T> T repository(Class<T> type, List<?> rows) {
            return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (proxy, method, args) -> {
                if ((method.getName().equals("findAllByOrderByNomeAsc") || method.getName().equals("findAllByAtivoTrueOrderByNomeAsc"))) return rows;
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
