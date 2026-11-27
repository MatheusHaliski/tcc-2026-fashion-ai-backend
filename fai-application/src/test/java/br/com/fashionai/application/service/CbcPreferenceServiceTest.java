package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.CbcChallengeScenario;
import br.com.fashionai.domain.model.CbcChallengeScenarioId;
import br.com.fashionai.domain.model.CbcPreference;
import br.com.fashionai.domain.model.CbcPreferenceId;
import br.com.fashionai.domain.model.CbcScenario;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.repository.CbcChallengeScenarioRepository;
import br.com.fashionai.domain.repository.CbcPreferenceRepository;
import br.com.fashionai.domain.repository.CbcScenarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Exercício 16 — cenário preferido por pessoa e desafio: só entra cenário permitido naquele desafio, a escolha de uma
 * pessoa não aparece para a outra e o desafio (cenário oficial, pontos, vagas, entregas) nunca é alterado.
 */
class CbcPreferenceServiceTest {
    private final FlairChallengeService challenges = mock(FlairChallengeService.class);
    private final CbcScenarioRepository scenarios = mock(CbcScenarioRepository.class);
    private final CbcChallengeScenarioRepository allowed = mock(CbcChallengeScenarioRepository.class);
    private final CbcPreferenceRepository preferences = mock(CbcPreferenceRepository.class);
    private final CbcPreferenceService service = new CbcPreferenceService(challenges, scenarios, allowed, preferences);
    private final Map<CbcPreferenceId, CbcPreference> saved = new HashMap<>();
    private final List<CbcChallengeScenarioId> links = new ArrayList<>();
    private FlairChallenge gala;
    private CbcScenario cenarioGala;
    private CbcScenario livre;
    private CbcScenario paris;
    private CbcScenario desativado;
    private CurrentUser ana;
    private CurrentUser bia;

    @BeforeEach
    void setUp() {
        gala = new FlairChallenge();
        ReflectionTestUtils.setField(gala, "id", UUID.randomUUID());
        gala.setScenario("gala");
        cenarioGala = cenario("gala", "Gala", true);
        livre = cenario("livre", "Livre", true);
        paris = cenario("paris", "Paris", true);
        desativado = cenario("popup", "Pop-up", false);
        ana = Kit.as(pessoa("ana"));
        bia = Kit.as(pessoa("bia"));
        when(challenges.visible(any(), eq("noite-de-gala"))).thenReturn(gala);
        when(challenges.visible(any(), eq("privado"))).thenThrow(ApiException.notFound("Desafio de Montagem"));
        when(scenarios.findByCodigo("gala")).thenReturn(Optional.of(cenarioGala));
        when(scenarios.findAllById(any())).thenAnswer(inv -> {
            List<CbcScenario> out = new ArrayList<>();
            for (UUID id : inv.<Iterable<UUID>>getArgument(0)) {
                List.of(cenarioGala, livre, paris, desativado).stream().filter(s -> s.getId().equals(id)).forEach(out::add);
            }
            return out;
        });
        links.add(new CbcChallengeScenarioId(gala.getId(), livre.getId()));
        links.add(new CbcChallengeScenarioId(gala.getId(), desativado.getId()));
        when(allowed.findByIdChallengeId(gala.getId())).thenAnswer(inv -> links.stream().map(CbcChallengeScenario::new).toList());
        when(allowed.existsById(any())).thenAnswer(inv -> links.contains(inv.<CbcChallengeScenarioId>getArgument(0)));
        when(allowed.save(any())).thenAnswer(inv -> {
            links.add(inv.<CbcChallengeScenario>getArgument(0).getId());
            return inv.getArgument(0);
        });
        when(preferences.findById(any())).thenAnswer(inv -> Optional.ofNullable(saved.get(inv.<CbcPreferenceId>getArgument(0))));
        when(preferences.save(any())).thenAnswer(inv -> {
            CbcPreference p = inv.getArgument(0);
            saved.put(p.getId(), p);
            return p;
        });
        when(preferences.findByIdUserId(any())).thenAnswer(inv -> saved.values().stream().filter(p -> p.getId().getUserId().equals(inv.getArgument(0))).toList());
    }

    private CbcScenario cenario(String codigo, String nome, boolean ativo) {
        CbcScenario s = new CbcScenario();
        ReflectionTestUtils.setField(s, "id", UUID.randomUUID());
        s.setCodigo(codigo);
        s.setNome(nome);
        s.setAtivo(ativo);
        when(scenarios.findById(s.getId())).thenReturn(Optional.of(s));
        return s;
    }

    private static br.com.fashionai.domain.model.User pessoa(String username) {
        br.com.fashionai.domain.model.User u = Kit.user(username);
        ReflectionTestUtils.setField(u, "id", UUID.randomUUID());
        return u;
    }

    private String code(Runnable call) {
        ApiException e = catchThrowableOfType(call::run, ApiException.class);
        assertThat(e).as("deveria recusar com ApiException").isNotNull();
        assertThat(e.status()).isEqualTo(400);
        return e.code();
    }

    @Test
    void opcoesSaoOsCenariosAtivosPermitidosNoDesafioMaisOOficial() {
        assertThat(service.scenarios(ana, "noite-de-gala")).extracting("codigo").containsExactly("gala", "livre");   // sem o desativado e sem Paris
        assertThat(service.preference(ana, "noite-de-gala")).containsEntry("scenario", null).containsEntry("officialScenario", "gala");
        assertThat(service.mine(ana)).isEmpty();
    }

    @Test
    void cenarioPermitidoPassaECadaPessoaTemASuaPreferencia() {
        Map<String, Object> v = service.save(ana, "noite-de-gala", livre.getId());
        assertThat(v).containsEntry("challengeId", gala.getId());
        assertThat(v.get("scenario")).extracting("codigo", "nome").containsExactly("livre", "Livre");
        assertThat(service.preference(ana, "noite-de-gala").get("scenario")).extracting("codigo").isEqualTo("livre");
        assertThat(service.preference(bia, "noite-de-gala")).containsEntry("scenario", null);                       // a da Ana não vale para a Bia
        assertThat(service.mine(ana)).singleElement().satisfies(p -> assertThat(p).containsEntry("challengeId", gala.getId()));
        assertThat(service.mine(bia)).isEmpty();
        assertThat(gala.getScenario()).isEqualTo("gala");                                                           // o desafio continua com o oficial
        assertThat(service.clear(ana, "noite-de-gala")).containsEntry("scenario", null);
        verify(preferences).deleteById(new CbcPreferenceId(ana.id(), gala.getId()));
    }

    @Test
    void cenarioOficialSemLinhaDeAssociacaoGanhaALinhaAntesDaPreferencia() {
        assertThat(links).doesNotContain(new CbcChallengeScenarioId(gala.getId(), cenarioGala.getId()));
        service.save(ana, "noite-de-gala", cenarioGala.getId());
        assertThat(links).contains(new CbcChallengeScenarioId(gala.getId(), cenarioGala.getId()));                   // a FK composta precisa dela
        assertThat(saved.get(new CbcPreferenceId(ana.id(), gala.getId())).getScenarioId()).isEqualTo(cenarioGala.getId());
    }

    @Test
    void cadastradoMasNaoPermitidoInativoInexistenteOuAusenteVoltam400() {
        assertThat(code(() -> service.save(ana, "noite-de-gala", paris.getId()))).isEqualTo("CBC_CENARIO_NAO_PERMITIDO");
        assertThat(code(() -> service.save(ana, "noite-de-gala", desativado.getId()))).isEqualTo("CBC_CENARIO_INATIVO");
        assertThat(code(() -> service.save(ana, "noite-de-gala", UUID.randomUUID()))).isEqualTo("CBC_CENARIO_INVALIDO");
        assertThat(code(() -> service.save(ana, "noite-de-gala", null))).isEqualTo("CBC_CENARIO_INVALIDO");
        verify(preferences, never()).save(any());
        assertThat(saved).isEmpty();
    }

    @Test
    void cenarioDesativadoDepoisDaEscolhaContinuaLidoEReenviarAMesmaEscolhaEhAceito() {
        service.save(ana, "noite-de-gala", livre.getId());
        livre.setAtivo(false);
        assertThat(service.preference(ana, "noite-de-gala").get("scenario")).extracting("codigo").isEqualTo("livre");
        assertThat(service.save(ana, "noite-de-gala", livre.getId()).get("scenario")).extracting("codigo").isEqualTo("livre");
        assertThat(service.scenarios(ana, "noite-de-gala")).extracting("codigo").containsExactly("gala");            // não é mais oferecido
        assertThat(code(() -> service.save(bia, "noite-de-gala", livre.getId()))).isEqualTo("CBC_CENARIO_INATIVO");
    }

    @Test
    void desafioQueAPessoaNaoPodeVerVolta404EmTodasAsRotas() {
        for (Runnable call : List.<Runnable>of(() -> service.scenarios(ana, "privado"), () -> service.preference(ana, "privado"),
                () -> service.save(ana, "privado", livre.getId()), () -> service.clear(ana, "privado"))) {
            assertThat(catchThrowableOfType(call::run, ApiException.class).status()).isEqualTo(404);
        }
        assertThat(saved).isEmpty();
    }
}
