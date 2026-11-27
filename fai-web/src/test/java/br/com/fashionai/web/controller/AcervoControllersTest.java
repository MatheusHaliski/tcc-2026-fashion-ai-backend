package br.com.fashionai.web.controller;

import br.com.fashionai.application.acervo.AcervoConsultaService;
import br.com.fashionai.application.acervo.AcervoIluminacaoService;
import br.com.fashionai.application.acervo.AcervoPecasService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ACERVO — os controllers só delegam (dublês escritos à mão, como em Flair3dControllersTest): toda rota fica em
 * /api/me/acervo, recebe a pessoa autenticada e repassa os mesmos argumentos ao serviço.
 */
class AcervoControllersTest {
    static final CurrentUser ANA = new CurrentUser(UUID.randomUUID(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    static final Map<String, Object> RESPOSTA = Map.of("via", "servico");

    static final class Luz extends AcervoIluminacaoService {
        final List<Object> args = new ArrayList<>();

        Luz() {
            super(null, null, null);
        }

        @Override
        public Map<String, Object> iluminar(CurrentUser user, UUID ambienteId, LuzForm form) {
            args.addAll(Arrays.asList(user, ambienteId, form));
            return RESPOSTA;
        }
    }

    static final class Pecas extends AcervoPecasService {
        final List<Object> args = new ArrayList<>();

        Pecas() {
            super(null, null);
        }

        @Override
        public Map<String, Object> arvore(CurrentUser user) {
            args.add(user);
            return RESPOSTA;
        }

        @Override
        public Map<String, Object> mover(CurrentUser user, MoverForm form) {
            args.addAll(Arrays.asList(user, form));
            return RESPOSTA;
        }

        @Override
        public Map<String, Object> previa(CurrentUser user, PreviaForm form) {
            args.addAll(Arrays.asList("previa", user, form));
            return RESPOSTA;
        }

        @Override
        public Map<String, Object> confirmar(CurrentUser user, ConfirmarForm form) {
            args.addAll(Arrays.asList("confirmar", user, form));
            return RESPOSTA;
        }
    }

    static final class Consulta extends AcervoConsultaService {
        final List<Object> args = new ArrayList<>();

        Consulta() {
            super(null, null, null);
        }

        @Override
        public Map<String, Object> financeiro(CurrentUser user, List<UUID> selecao) {
            args.addAll(Arrays.asList(user, selecao));
            return RESPOSTA;
        }

        @Override
        public Map<String, Object> busca(CurrentUser user, String texto) {
            args.addAll(Arrays.asList(user, texto));
            return RESPOSTA;
        }
    }

    static List<String> rotas(Class<?> controller) {
        List<String> out = new ArrayList<>();
        for (Method m : controller.getDeclaredMethods()) {
            GetMapping get = m.getAnnotation(GetMapping.class);
            PostMapping post = m.getAnnotation(PostMapping.class);
            PutMapping put = m.getAnnotation(PutMapping.class);
            DeleteMapping delete = m.getAnnotation(DeleteMapping.class);
            String rota = get != null ? "GET " + get.value()[0]
                    : post != null ? "POST " + post.value()[0]
                    : put != null ? "PUT " + put.value()[0]
                    : delete != null ? "DELETE " + delete.value()[0]
                    : null;
            if (rota == null) {
                continue;
            }
            assertThat(m.getParameterTypes()[0]).as(rota + " recebe a pessoa autenticada").isEqualTo(CurrentUser.class);
            out.add(rota);
        }
        return out;
    }

    @Test
    void todasAsRotasFicamEmApiMeAcervoERecebemAPessoaAutenticada() {
        List<String> todas = new ArrayList<>(rotas(AcervoController.class));
        todas.addAll(rotas(AcervoPecasController.class));

        assertThat(todas).hasSize(26).doesNotHaveDuplicates().allSatisfy(r -> assertThat(r.split(" ")[1]).startsWith("/api/me/acervo"));
        assertThat(new TreeSet<>(todas)).contains("GET /api/me/acervo", "POST /api/me/acervo/ambientes", "PUT /api/me/acervo/moveis/{id}",
                "DELETE /api/me/acervo/compartimentos/{id}", "POST /api/me/acervo/pecas/mover", "POST /api/me/acervo/arrumacao/previa",
                "POST /api/me/acervo/arrumacao/confirmar", "GET /api/me/acervo/financeiro", "GET /api/me/acervo/busca", "GET /api/me/acervo/uso",
                "GET /api/me/acervo/pecas/{id}/looks", "GET /api/me/acervo/desejos", "DELETE /api/me/acervo/desejos/{id}",
                "PUT /api/me/acervo/ambientes/{id}/luz");
    }

    @Test
    void criarRespondeCriadoEApagarRespondeSemConteudo() throws Exception {
        Method criar = AcervoController.class.getMethod("criarAmbiente", CurrentUser.class,
                br.com.fashionai.application.acervo.AcervoEstruturaService.NomeForm.class);
        Method apagar = AcervoPecasController.class.getMethod("apagarDesejo", CurrentUser.class, UUID.class);

        assertThat(criar.getAnnotation(ResponseStatus.class).value()).isEqualTo(HttpStatus.CREATED);
        assertThat(apagar.getAnnotation(ResponseStatus.class).value()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void pecasEConsultasRepassamOsArgumentos() {
        Pecas pecas = new Pecas();
        Consulta consulta = new Consulta();
        AcervoController estrutura = new AcervoController(null, pecas, null);
        AcervoPecasController controller = new AcervoPecasController(pecas, consulta, null);
        UUID peca = UUID.randomUUID();
        UUID gaveta = UUID.randomUUID();
        AcervoPecasService.MoverForm mover = new AcervoPecasService.MoverForm(List.of(peca), gaveta);
        AcervoPecasService.ConfirmarForm confirmar = new AcervoPecasService.ConfirmarForm(List.of(new AcervoPecasService.Movimento(peca, gaveta)));

        assertThat(estrutura.arvore(ANA)).isSameAs(RESPOSTA);
        assertThat(controller.mover(ANA, mover)).isSameAs(RESPOSTA);
        assertThat(controller.previa(ANA, null)).isSameAs(RESPOSTA);
        assertThat(controller.confirmar(ANA, confirmar)).isSameAs(RESPOSTA);
        assertThat(controller.financeiro(ANA, List.of(peca))).isSameAs(RESPOSTA);
        assertThat(controller.busca(ANA, "camisa branca M")).isSameAs(RESPOSTA);

        assertThat(pecas.args).containsExactly(ANA, ANA, mover, "previa", ANA, null, "confirmar", ANA, confirmar);
        assertThat(consulta.args).containsExactly(ANA, List.of(peca), ANA, "camisa branca M");
    }

    @Test
    void luzDoAmbienteRepassaDonoAmbienteEFormulario() {
        Luz luz = new Luz();
        AcervoController controller = new AcervoController(null, null, luz);
        UUID ambiente = UUID.randomUUID();
        AcervoIluminacaoService.LuzForm form = new AcervoIluminacaoService.LuzForm(UUID.randomUUID(), 3000, false, false);

        assertThat(controller.iluminarAmbiente(ANA, ambiente, form)).isSameAs(RESPOSTA);
        assertThat(luz.args).containsExactly(ANA, ambiente, form);
    }
}
