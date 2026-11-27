package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.CbcScenario;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.CbcChallengeScenarioRepository;
import br.com.fashionai.domain.repository.CbcPreferenceRepository;
import br.com.fashionai.domain.repository.CbcScenarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
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
 * Cenário preferido (exercício 16, V121) num Desafio de Montagem "vestir a cena" (V127): a cena é o próprio desafio
 * (cada vaga é um personagem da imagem), então a V127 não cadastra o cenário vestir-* em cbc_scenarios nem associa
 * outro cenário ao desafio. Resultado: nenhuma opção para escolher e qualquer preferência é recusada, até a "livre".
 */
class CbcPreferenceVestirTest {
    private final FlairChallengeService challenges = mock(FlairChallengeService.class);
    private final CbcScenarioRepository scenarios = mock(CbcScenarioRepository.class);
    private final CbcChallengeScenarioRepository allowed = mock(CbcChallengeScenarioRepository.class);
    private final CbcPreferenceRepository preferences = mock(CbcPreferenceRepository.class);
    private final CbcPreferenceService service = new CbcPreferenceService(challenges, scenarios, allowed, preferences);
    private CbcScenario livre;
    private CurrentUser ana;

    @BeforeEach
    void setUp() {
        FlairChallenge show = new FlairChallenge();
        ReflectionTestUtils.setField(show, "id", UUID.randomUUID());
        show.setSlug("show-no-galpao");
        show.setScenario("vestir-show");
        livre = new CbcScenario();
        ReflectionTestUtils.setField(livre, "id", UUID.randomUUID());
        livre.setCodigo("livre");
        livre.setNome("Livre");
        livre.setAtivo(true);
        User u = Kit.user("ana");
        ReflectionTestUtils.setField(u, "id", UUID.randomUUID());
        ana = Kit.as(u);
        when(challenges.visible(any(), eq("show-no-galpao"))).thenReturn(show);
        when(scenarios.findByCodigo("vestir-show")).thenReturn(Optional.empty());           // a V127 não cadastra vestir-*
        when(scenarios.findById(livre.getId())).thenReturn(Optional.of(livre));
        when(scenarios.findAllById(any())).thenReturn(List.of());
        when(allowed.findByIdChallengeId(show.getId())).thenReturn(List.of());              // nem associa a "livre"
        when(preferences.findById(any())).thenReturn(Optional.empty());
    }

    @Test
    void desafioDeVestirNaoOfereceCenarioERecusaQualquerPreferencia() {
        assertThat(service.scenarios(ana, "show-no-galpao")).isEmpty();
        assertThat(service.preference(ana, "show-no-galpao")).containsEntry("scenario", null).containsEntry("officialScenario", "vestir-show");
        ApiException e = catchThrowableOfType(() -> service.save(ana, "show-no-galpao", livre.getId()), ApiException.class);
        assertThat(e.status()).isEqualTo(400);
        assertThat(e.code()).isEqualTo("CBC_CENARIO_NAO_PERMITIDO");
        verify(preferences, never()).save(any());
        verify(allowed, never()).save(any());
    }
}
