package br.com.fashionai.application.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views.ReferenceOptionView;
import br.com.fashionai.domain.model.CbcChallengeScenario;
import br.com.fashionai.domain.model.CbcChallengeScenarioId;
import br.com.fashionai.domain.model.CbcPreference;
import br.com.fashionai.domain.model.CbcPreferenceId;
import br.com.fashionai.domain.model.CbcScenario;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.repository.CbcChallengeScenarioRepository;
import br.com.fashionai.domain.repository.CbcPreferenceRepository;
import br.com.fashionai.domain.repository.CbcScenarioRepository;

/**
 * Exercício 16 — cenário preferido de cada pessoa em cada Desafio de Montagem. A preferência só troca a cena que a
 * pessoa vê: o desafio ({@code flair_challenges}), o cenário oficial, a janela, os requisitos, os pontos, as vagas e as
 * entregas não são lidos para escrita nem alterados aqui. Só entra cenário permitido naquele desafio
 * ({@code cbc_challenge_scenarios}); o cenário oficial do desafio é sempre permitido.
 */
@Service
public class CbcPreferenceService {
    private final FlairChallengeService challenges;
    private final CbcScenarioRepository scenarios;
    private final CbcChallengeScenarioRepository allowed;
    private final CbcPreferenceRepository preferences;

    public CbcPreferenceService(FlairChallengeService challenges, CbcScenarioRepository scenarios,
                                CbcChallengeScenarioRepository allowed, CbcPreferenceRepository preferences) {
        this.challenges = challenges;
        this.scenarios = scenarios;
        this.allowed = allowed;
        this.preferences = preferences;
    }

    /** Cenários que o desafio permite (só os ativos), em ordem de nome. Desafio que a pessoa não pode ver: 404. */
    @Transactional(readOnly = true)
    public List<ReferenceOptionView> scenarios(CurrentUser viewer, String idOrSlug) {
        FlairChallenge c = challenges.visible(viewer, idOrSlug);
        return permitted(c).stream().filter(CbcScenario::isAtivo).sorted(Comparator.comparing(CbcScenario::getNome)).map(CbcPreferenceService::option).toList();
    }

    /** A preferência da pessoa no desafio; {@code scenario} nulo = nenhuma (vale o cenário oficial). */
    @Transactional(readOnly = true)
    public Map<String, Object> preference(CurrentUser user, String idOrSlug) {
        FlairChallenge c = challenges.visible(user, idOrSlug);
        return view(c, preferences.findById(new CbcPreferenceId(user.id(), c.getId())).orElse(null));
    }

    /** Preferências da pessoa em todos os desafios (para a lista), sem revelar desafio que ela não pode ver. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> mine(CurrentUser user) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (CbcPreference p : preferences.findByIdUserId(user.id())) {
            scenarios.findById(p.getScenarioId()).ifPresent(s -> {
                Map<String, Object> v = new LinkedHashMap<>();
                v.put("challengeId", p.getId().getChallengeId());
                v.put("scenario", option(s));
                out.add(v);
            });
        }
        return out;
    }

    @Transactional
    public Map<String, Object> save(CurrentUser user, String idOrSlug, UUID scenarioId) {
        FlairChallenge c = challenges.visible(user, idOrSlug);
        CbcPreferenceId id = new CbcPreferenceId(user.id(), c.getId());
        CbcPreference current = preferences.findById(id).orElse(null);
        if (scenarioId == null) {
            throw ApiException.badRequest("CBC_CENARIO_INVALIDO", Msg.t("cbc.cenario_invalido"));
        }
        if (current != null && scenarioId.equals(current.getScenarioId())) {
            return view(c, current);                              // a mesma escolha, mesmo que o cenário tenha sido desativado
        }
        CbcScenario scenario = scenarios.findById(scenarioId)
                .orElseThrow(() -> ApiException.badRequest("CBC_CENARIO_INVALIDO", Msg.t("cbc.cenario_invalido")));
        if (!scenario.isAtivo()) {
            throw ApiException.badRequest("CBC_CENARIO_INATIVO", Msg.t("cbc.cenario_inativo"));
        }
        if (permitted(c).stream().noneMatch(s -> s.getId().equals(scenarioId))) {
            throw ApiException.badRequest("CBC_CENARIO_NAO_PERMITIDO", Msg.t("cbc.cenario_nao_permitido"));
        }
        CbcChallengeScenarioId link = new CbcChallengeScenarioId(c.getId(), scenarioId);
        if (!allowed.existsById(link)) {
            allowed.save(new CbcChallengeScenario(link));         // cenário oficial de desafio criado depois da migração
        }
        CbcPreference p = current != null ? current : new CbcPreference();
        p.setId(id);
        p.setScenarioId(scenarioId);
        p.setUpdatedAt(Instant.now());
        return view(c, preferences.save(p));
    }

    /** Volta ao cenário oficial do desafio. */
    @Transactional
    public Map<String, Object> clear(CurrentUser user, String idOrSlug) {
        FlairChallenge c = challenges.visible(user, idOrSlug);
        preferences.deleteById(new CbcPreferenceId(user.id(), c.getId()));
        return view(c, null);
    }

    /** Os cenários associados ao desafio e o cenário oficial dele, quando está cadastrado. */
    private List<CbcScenario> permitted(FlairChallenge c) {
        List<UUID> ids = allowed.findByIdChallengeId(c.getId()).stream().map(a -> a.getId().getScenarioId()).toList();
        List<CbcScenario> out = new ArrayList<>(scenarios.findAllById(ids));
        scenarios.findByCodigo(c.getScenario()).filter(s -> out.stream().noneMatch(x -> x.getId().equals(s.getId()))).ifPresent(out::add);
        return out;
    }

    private Map<String, Object> view(FlairChallenge c, CbcPreference p) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("challengeId", c.getId());
        v.put("officialScenario", c.getScenario());
        v.put("scenario", p == null ? null : scenarios.findById(p.getScenarioId()).map(CbcPreferenceService::option).orElse(null));
        v.put("updatedAt", p == null ? null : p.getUpdatedAt());
        return v;
    }

    private static ReferenceOptionView option(CbcScenario s) {
        return new ReferenceOptionView(s.getId(), s.getCodigo(), s.getNome());
    }
}
