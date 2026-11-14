package br.com.fashionai.web.controller;

import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleoService;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.cbc.FlairCbcSquadService;
import br.com.fashionai.application.flair3d.makeup.FlairMakeUpService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * FLAIR 3D — os controllers dos núcleos, do MAKE UP e dos elencos só delegam (dublês escritos à mão, como em
 * FlairGameControllerTest): cada rota chama o método certo do serviço com os mesmos argumentos e devolve a resposta dele.
 */
class Flair3dControllersTest {
    static final CurrentUser ANA = new CurrentUser(UUID.randomUUID(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    static final Map<String, Object> RESPOSTA = Map.of("via", "servico");
    static final Resultado RESULTADO = Resultado.of(80, "APROVADO", List.of(), List.of());

    static final class Nucleos extends Flair3dNucleoService {
        final List<Object> args = new ArrayList<>();

        Nucleos() {
            super(null, null);
        }

        @Override
        public Map<String, Object> lista() {
            args.add("lista");
            return RESPOSTA;
        }

        @Override
        public Definicao definicao(String codigo) {
            args.add(codigo);
            return super.definicao(codigo);
        }

        @Override
        public Map<String, Object> efeitos(CurrentUser user, String codigo, PedidoEfeitos pedido) {
            args.addAll(Arrays.asList(user, codigo, pedido));
            return RESPOSTA;
        }

        @Override
        public Map<String, Object> abrir(CurrentUser user, String codigo, AbrirPartida pedido) {
            args.addAll(Arrays.asList(user, codigo, pedido));
            return RESPOSTA;
        }

        @Override
        public Resultado entregar(CurrentUser user, UUID partidaId, Entrega entrega) {
            args.addAll(Arrays.asList(user, partidaId, entrega));
            return RESULTADO;
        }

        @Override
        public Resultado previa(CurrentUser user, UUID partidaId, Entrega entrega) {
            args.addAll(Arrays.asList("previa", user, partidaId, entrega));
            return RESULTADO;
        }

        @Override
        public Resultado acionar(CurrentUser user, UUID partidaId, Acionamento acionamento) {
            args.addAll(Arrays.asList("acionar", user, partidaId, acionamento));
            return RESULTADO;
        }
    }

    static final class MakeUp extends FlairMakeUpService {
        final List<Object> args = new ArrayList<>();

        MakeUp() {
            super(null, null);
        }

        @Override
        public Map<String, Object> carreira(CurrentUser user) {
            args.add(user);
            return RESPOSTA;
        }

        @Override
        public Map<String, Object> briefs(CurrentUser user) {
            args.add(user);
            return RESPOSTA;
        }

        @Override
        public Map<String, Object> detalhe(String codigo) {
            args.add(codigo);
            return RESPOSTA;
        }

        @Override
        public Map<String, Object> entregar(CurrentUser user, String codigo, Entrega entrega) {
            args.addAll(Arrays.asList(user, codigo, entrega));
            return RESPOSTA;
        }
    }

    static final class Elencos extends FlairCbcSquadService {
        final List<Object> args = new ArrayList<>();

        Elencos() {
            super(null, null, null);
        }

        @Override
        public Map<String, Object> lista(CurrentUser user) {
            args.add(user);
            return RESPOSTA;
        }

        @Override
        public Map<String, Object> formacao(String codigo) {
            args.add(codigo);
            return RESPOSTA;
        }

        @Override
        public Map<String, Object> conferir(CurrentUser user, String codigo, Pedido pedido) {
            args.addAll(Arrays.asList(user, codigo, pedido));
            return RESPOSTA;
        }

        @Override
        public Map<String, Object> entregar(CurrentUser user, String codigo, Pedido pedido) {
            args.addAll(Arrays.asList(user, codigo, pedido));
            return RESPOSTA;
        }
    }

    @Test
    void nucleosDelegamListaDefinicaoEfeitosPartidaEntregaPreviaEAcionamento() {
        Nucleos s = new Nucleos();
        Flair3dNucleoController c = new Flair3dNucleoController(s);
        assertThat(c.lista()).isSameAs(RESPOSTA);
        assertThat(c.definicao("PASSARELA").numero()).isEqualTo(1);
        Flair3dNucleoService.PedidoEfeitos efeitos = new Flair3dNucleoService.PedidoEfeitos(List.of());
        assertThat(c.efeitos(ANA, "PASSARELA", efeitos)).isSameAs(RESPOSTA);
        Flair3dNucleoService.AbrirPartida abrir = new Flair3dNucleoService.AbrirPartida(List.of(), null);
        assertThat(c.abrir(ANA, "PASSARELA", abrir)).isSameAs(RESPOSTA);
        UUID id = UUID.randomUUID();
        Entrega entrega = new Entrega(null, null, null, null);
        assertThat(c.entregar(ANA, id, entrega)).isSameAs(RESULTADO);
        assertThat(c.previa(ANA, id, entrega)).isSameAs(RESULTADO);
        Acionamento acionamento = new Acionamento(UUID.randomUUID(), null);
        assertThat(c.acionar(ANA, id, acionamento)).isSameAs(RESULTADO);
        assertThat(s.args).containsExactly("lista", "PASSARELA", ANA, "PASSARELA", efeitos, ANA, "PASSARELA", abrir, ANA, id, entrega,
                "previa", ANA, id, entrega, "acionar", ANA, id, acionamento);
    }

    @Test
    void makeUpEElencosDelegamComOMesmoUsuario() {
        MakeUp m = new MakeUp();
        FlairMakeUpController mc = new FlairMakeUpController(m);
        Entrega entrega = new Entrega(null, null, null, null);
        assertThat(mc.carreira(ANA)).isSameAs(RESPOSTA);
        assertThat(mc.briefs(ANA)).isSameAs(RESPOSTA);
        assertThat(mc.detalhe("ENTREVISTA")).isSameAs(RESPOSTA);
        assertThat(mc.entregar(ANA, "ENTREVISTA", entrega)).isSameAs(RESPOSTA);
        assertThat(m.args).containsExactly(ANA, ANA, "ENTREVISTA", ANA, "ENTREVISTA", entrega);

        Elencos e = new Elencos();
        FlairCbcSquadController ec = new FlairCbcSquadController(e);
        FlairCbcSquadService.Pedido pedido = new FlairCbcSquadService.Pedido(Map.of());
        assertThat(ec.lista(ANA)).isSameAs(RESPOSTA);
        assertThat(ec.formacao("PRIMEIRO_ELENCO")).isSameAs(RESPOSTA);
        assertThat(ec.conferir(ANA, "PRIMEIRO_ELENCO", pedido)).isSameAs(RESPOSTA);
        assertThat(ec.entregar(ANA, "PRIMEIRO_ELENCO", pedido)).isSameAs(RESPOSTA);
        assertThat(e.args).containsExactly(ANA, "PRIMEIRO_ELENCO", ANA, "PRIMEIRO_ELENCO", pedido, ANA, "PRIMEIRO_ELENCO", pedido);
    }

    @Test
    void rotasDoContrato() throws Exception {
        assertThat(get(Flair3dNucleoController.class, "lista")).isEqualTo("/api/flair/3d/nucleos");
        assertThat(get(Flair3dNucleoController.class, "definicao")).isEqualTo("/api/flair/3d/nucleos/{codigo}");
        assertThat(post(Flair3dNucleoController.class, "efeitos")).isEqualTo("/api/flair/3d/nucleos/{codigo}/efeitos");
        assertThat(post(Flair3dNucleoController.class, "abrir")).isEqualTo("/api/flair/3d/nucleos/{codigo}/partidas");
        assertThat(method(Flair3dNucleoController.class, "abrir").getAnnotation(ResponseStatus.class).value().value()).isEqualTo(201);
        assertThat(post(Flair3dNucleoController.class, "entregar")).isEqualTo("/api/flair/3d/partidas/{id}/entrega");
        assertThat(post(Flair3dNucleoController.class, "previa")).isEqualTo("/api/flair/3d/partidas/{id}/previa");
        assertThat(post(Flair3dNucleoController.class, "acionar")).isEqualTo("/api/flair/3d/partidas/{id}/acionar");
        assertThat(get(FlairMakeUpController.class, "carreira")).isEqualTo("/api/flair/make-up/carreira");
        assertThat(get(FlairMakeUpController.class, "briefs")).isEqualTo("/api/flair/make-up/briefs");
        assertThat(get(FlairMakeUpController.class, "detalhe")).isEqualTo("/api/flair/make-up/briefs/{codigo}");
        assertThat(post(FlairMakeUpController.class, "entregar")).isEqualTo("/api/flair/make-up/briefs/{codigo}/entrega");
        assertThat(get(FlairCbcSquadController.class, "lista")).isEqualTo("/api/flair/elencos");
        assertThat(get(FlairCbcSquadController.class, "formacao")).isEqualTo("/api/flair/elencos/{codigo}");
        assertThat(post(FlairCbcSquadController.class, "conferir")).isEqualTo("/api/flair/elencos/{codigo}/conferir");
        assertThat(post(FlairCbcSquadController.class, "entregar")).isEqualTo("/api/flair/elencos/{codigo}/entrega");
    }

    static Method method(Class<?> type, String name) {
        return Arrays.stream(type.getDeclaredMethods()).filter(m -> m.getName().equals(name)).findFirst().orElseThrow();
    }

    static String get(Class<?> type, String name) {
        return method(type, name).getAnnotation(GetMapping.class).value()[0];
    }

    static String post(Class<?> type, String name) {
        return method(type, name).getAnnotation(PostMapping.class).value()[0];
    }
}
