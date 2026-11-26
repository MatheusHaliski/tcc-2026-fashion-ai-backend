package br.com.fashionai.web.opcoes;

import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.domain.model.AreaArtistica;
import br.com.fashionai.domain.model.CategoriaMarca;
import br.com.fashionai.domain.repository.AreaArtisticaRepository;
import br.com.fashionai.domain.repository.CategoriaMarcaRepository;
import br.com.fashionai.web.config.JsonCompatConfig;
import br.com.fashionai.web.config.SecurityConfig;
import br.com.fashionai.web.controller.InstitutionalReferenceController;
import br.com.fashionai.web.error.ErrorWriter;
import br.com.fashionai.web.security.AuditAccessDeniedHandler;
import br.com.fashionai.web.security.AuditAuthenticationEntryPoint;
import br.com.fashionai.web.security.FashionAuthorization;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercícios 09 e 10: as opções de categoria de marca e de área artística são catálogos públicos de leitura sob
 * /api/opcoes/** (só id, código e nome das ativas); gravar a escolha continua exigindo a sessão do dono do perfil.
 */
@WebMvcTest(InstitutionalReferenceController.class)
@Import({InstitutionalReferenceController.class, SecurityConfig.class, FashionAuthorization.class, AuditAccessDeniedHandler.class,
        AuditAuthenticationEntryPoint.class, ErrorWriter.class})
class InstitutionalReferenceAccessTest {
    private static final UUID CASUAL_ID = UUID.fromString("0f6c1c9e-2b7a-4a55-9b0e-5d3f6a7b8c01");
    private static final UUID MUSICA_ID = UUID.fromString("7a1e2d3c-4b5f-4a6e-8c7d-9e0f1a2b3c02");

    @Autowired
    private MockMvc mvc;

    @Test
    void anonimoLeAsOpcoesAtivasSoComIdCodigoENome() throws Exception {
        mvc.perform(get("/api/opcoes/categorias-marca")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(CASUAL_ID.toString()))
                .andExpect(jsonPath("$[0].codigo").value("CASUAL"))
                .andExpect(jsonPath("$[0].nome").value("Casual"))
                .andExpect(jsonPath("$[0].ativo").doesNotExist())
                .andExpect(jsonPath("$[0].createdAt").doesNotExist());
        mvc.perform(get("/api/opcoes/areas-artisticas")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(MUSICA_ID.toString()))
                .andExpect(jsonPath("$[0].codigo").value("MUSICA"))
                .andExpect(jsonPath("$[0].nome").value("Música"))
                .andExpect(jsonPath("$[0].createdBy").doesNotExist());
    }

    @Test
    void escreverNasOpcoesOuNoPerfilSemSessaoEh401() throws Exception {
        for (String path : List.of("/api/opcoes/categorias-marca", "/api/opcoes/areas-artisticas")) {
            mvc.perform(post(path)).andExpect(status().isUnauthorized());
            mvc.perform(delete(path)).andExpect(status().isUnauthorized());
        }
        mvc.perform(patch("/api/me/brand-profile")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/me/celebrity-profile")).andExpect(status().isUnauthorized());
    }

    /** O PATCH da marca recebe Map<String, String>: o booleano de limpar chega como "true" e o null é preservado. */
    @Test
    void corpoDoPatchDaMarcaChegaComoOWriterEspera() throws Exception {
        ObjectMapper json = JsonMapper.builder().addModule(new JsonCompatConfig().jsonCompatModule()).build();

        Map<String, String> limpar = json.readValue("{\"clearCategoriaMarca\":true}", new TypeReference<Map<String, String>>() { });
        Map<String, String> nulo = json.readValue("{\"categoriaMarcaId\":null,\"bio\":\"x\"}", new TypeReference<Map<String, String>>() { });

        assertThat(limpar).containsEntry("clearCategoriaMarca", "true");
        assertThat(nulo).containsKey("categoriaMarcaId").containsEntry("categoriaMarcaId", null);
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class TestApplication {
        @Bean
        CategoriaMarcaRepository categorias() {
            CategoriaMarca casual = new CategoriaMarca();
            casual.assignId(CASUAL_ID);
            casual.setCodigo("CASUAL");
            casual.setNome("Casual");
            return ativos(CategoriaMarcaRepository.class, List.of(casual));
        }

        @Bean
        AreaArtisticaRepository areas() {
            AreaArtistica musica = new AreaArtistica();
            musica.assignId(MUSICA_ID);
            musica.setCodigo("MUSICA");
            musica.setNome("Música");
            return ativos(AreaArtisticaRepository.class, List.of(musica));
        }

        @Bean
        AuditService auditService() {
            return event -> { };
        }

        @Bean
        JwtDecoder jwtDecoder() {
            return token -> {
                throw new UnsupportedOperationException("Os testes anônimos de catálogo não decodificam JWT");
            };
        }

        /** Repositório que só responde à consulta das opções ativas: o controller não pode usar outra leitura. */
        private static <T> T ativos(Class<T> type, List<?> rows) {
            return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (proxy, method, args) -> {
                if (method.getName().equals("findAllByAtivoTrueOrderByNomeAsc")) {
                    return rows;
                }
                if (method.getDeclaringClass() == Object.class) {
                    return switch (method.getName()) {
                        case "hashCode" -> System.identityHashCode(proxy);
                        case "equals" -> proxy == args[0];
                        default -> type.getSimpleName() + "Stub";
                    };
                }
                throw new UnsupportedOperationException(method.getName());
            }));
        }
    }
}
