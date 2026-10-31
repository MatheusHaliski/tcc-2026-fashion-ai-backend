package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.ChallengeInstanceRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Caracterização da conclusão de desafios (CA12): divisão da recompensa por modo (equipe, duelo individual, duelo por
 * times, solo/comunidade), piso de 25 %, ordem das chamadas de pontos, chaves do resultado e conclusão uma única vez.
 * Participantes já em CONCLUIU não têm o progresso recalculado, então as frações/recordes postos aqui são os usados.
 */
class ChallengeConclusionRewardTest {
    private Kit kit;
    private World world;
    private ChallengeService challenges;
    private FaiPointsService points;
    private User duda;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        challenges = kit.build(ChallengeService.class);
        points = kit.dep(FaiPointsService.class);
        duda = world.person("duda2", 0);
    }

    private static ChallengeTemplate template(String code, int reward) {
        ChallengeTemplate t = new ChallengeTemplate();
        t.setCode(code);
        t.setName(code);
        t.setRuleText("regra");
        t.setRewardPoints(reward);
        t.setDurationDays(7);
        t.setActive(true);
        return t;
    }

    private ChallengeInstance instance(String code, String mode) {
        ChallengeInstance i = new ChallengeInstance();
        i.setId(UUID.randomUUID());
        i.setTemplateCode(code);
        i.setMode(mode);
        i.setState(ChallengeService.ATIVO);
        i.setCreatedBy(world.me.getId());
        i.setParamsJson("{}");
        return kit.dep(ChallengeInstanceRepository.class).save(i);
    }

    private ChallengeParticipant member(ChallengeInstance i, User u, String team, double fraction, int best) {
        ChallengeParticipant p = new ChallengeParticipant();
        p.setId(UUID.randomUUID());
        p.setInstanceId(i.getId());
        p.setUserId(u.getId());
        p.setStatus(ChallengeService.P_CONCLUIU);
        p.setTeam(team);
        p.setProgressFraction(BigDecimal.valueOf(fraction));
        p.setBestRecord(best);
        return kit.dep(ChallengeParticipantRepository.class).save(p);
    }

    private void left(ChallengeInstance i, User u) {
        ChallengeParticipant p = member(i, u, null, 1.0, 99);
        p.setStatus(ChallengeService.P_SAIU);
    }

    private Map<String, Object> result(ChallengeInstance i) {
        return Json.map(kit.dep(ChallengeInstanceRepository.class).findById(i.getId()).orElseThrow().getResultJson());
    }

    private void awarded(InOrder order, User u, ChallengeInstance i, int pts) {
        order.verify(points).award(u.getId(), "CHALLENGE_COMPLETED", "CHALLENGE", i.getId().toString(), pts);
    }

    @Test
    void equipeDivideOPoteDaMediaIgualmenteEIgnoraQuemSaiu() {
        ChallengeInstance i = instance("CHANEL_WEEK", "EQUIPE");
        member(i, world.me, "A", 1.0, 0);
        member(i, world.rival, "A", 0.5, 0);
        member(i, world.friend, "A", 0.0, 0);
        left(i, duda);
        challenges.conclude(i, template("CHANEL_WEEK", 150));
        Map<String, Object> r = result(i);
        assertThat(List.copyOf(r.keySet())).containsExactly("code", "name", "mode", "concludedAt", "teamFraction", "rewardEach");
        assertThat(r).containsEntry("teamFraction", 0.5).containsEntry("rewardEach", 25).containsEntry("mode", "EQUIPE");
        InOrder order = inOrder(points);
        awarded(order, world.me, i, 25);
        awarded(order, world.rival, i, 25);
        awarded(order, world.friend, i, 25);
        verify(points, never()).award(eq(duda.getId()), anyString(), anyString(), anyString(), anyInt());
        assertThat(kit.dep(ChallengeInstanceRepository.class).findById(i.getId()).orElseThrow().getState()).isEqualTo(ChallengeService.CONCLUIDO);
    }

    @Test
    void equipeAbaixoDoPisoDe25PorCentoNaoGanhaPontos() {
        ChallengeInstance i = instance("CHANEL_WEEK", "EQUIPE");
        member(i, world.me, "A", 0.3, 0);
        member(i, world.rival, "A", 0.1, 0);
        challenges.conclude(i, template("CHANEL_WEEK", 150));
        assertThat(result(i)).containsEntry("teamFraction", 0.2).containsEntry("rewardEach", 0);
        verifyNoInteractions(points);
    }

    @Test
    void equipeArredondaOPoteEDivideComDivisaoInteira() {
        ChallengeInstance i = instance("CHANEL_WEEK", "EQUIPE");
        member(i, world.me, "A", 1.0, 0);
        member(i, world.rival, "A", 0.3333, 0);
        member(i, world.friend, "A", 0.3333, 0);
        challenges.conclude(i, template("CHANEL_WEEK", 100));
        // média 0.5555 → pote round(55.55)=56 → 56/3 = 18
        assertThat(result(i)).containsEntry("teamFraction", 0.56).containsEntry("rewardEach", 18);
    }

    @Test
    void soloRecompensaProporcionalComPisoEFracaoNoResultado() {
        ChallengeInstance i = instance("CHANEL_WEEK", "SOLO");
        member(i, world.me, null, 0.6049, 0);
        challenges.conclude(i, template("CHANEL_WEEK", 150));
        Map<String, Object> r = result(i);
        assertThat(List.copyOf(r.keySet())).containsExactly("code", "name", "mode", "concludedAt", "fraction");
        assertThat(r).containsEntry("fraction", 0.6);
        verify(points).award(world.me.getId(), "CHALLENGE_COMPLETED", "CHALLENGE", i.getId().toString(), 91);

        ChallengeInstance low = instance("CHANEL_WEEK", "COMUNIDADE");
        member(low, world.rival, null, 0.2499, 0);
        member(low, world.friend, null, 1.0, 0);
        challenges.conclude(low, template("CHANEL_WEEK", 150));
        assertThat(result(low)).containsEntry("fraction", 0.25);   // a fração exibida é a do primeiro membro
        verify(points, never()).award(eq(world.rival.getId()), anyString(), anyString(), anyString(), anyInt());
        verify(points).award(world.friend.getId(), "CHALLENGE_COMPLETED", "CHALLENGE", low.getId().toString(), 150);
    }

    @Test
    void soloSemMembrosNaoTemFracao() {
        ChallengeInstance i = instance("CHANEL_WEEK", "SOLO");
        challenges.conclude(i, template("CHANEL_WEEK", 150));
        assertThat(result(i)).doesNotContainKey("fraction");
        verifyNoInteractions(points);
    }

    @Test
    void dueloIndividualEmpateDaVitoriaAAmbosEQuartoDoPremioAosDemais() {
        ChallengeInstance i = instance("MY_SEASON", "DUELO");
        member(i, world.me, null, 0, 5);
        member(i, world.rival, null, 0, 3);
        member(i, world.friend, null, 0, 5);
        challenges.conclude(i, template("MY_SEASON", 150));
        Map<String, Object> r = result(i);
        assertThat(List.copyOf(r.keySet())).containsExactly("code", "name", "mode", "concludedAt", "scoring", "winners", "ranking");
        assertThat(r).containsEntry("scoring", "recorde pessoal").containsEntry("winners", List.of("ana", "caio"));
        assertThat(((List<?>) r.get("ranking")).get(2)).isEqualTo(Map.of("user", "bia", "score", 3.0));
        InOrder order = inOrder(points);
        awarded(order, world.me, i, 150);
        awarded(order, world.rival, i, 37);
        awarded(order, world.friend, i, 150);
    }

    @Test
    void dueloSemPontuacaoNaoTemVencedor() {
        ChallengeInstance i = instance("MY_SEASON", "DUELO");
        member(i, world.me, null, 0, 0);
        member(i, world.rival, null, 0, 0);
        challenges.conclude(i, template("MY_SEASON", 150));
        assertThat(result(i)).containsEntry("winners", List.of());
        verify(points).award(world.me.getId(), "CHALLENGE_COMPLETED", "CHALLENGE", i.getId().toString(), 37);
        verify(points).award(world.rival.getId(), "CHALLENGE_COMPLETED", "CHALLENGE", i.getId().toString(), 37);
    }

    @Test
    void dueloPorTimesUsaAMediaDoTimeESemTimeContaComoA() {
        ChallengeInstance i = instance("MY_SEASON", "DUELO");
        member(i, world.me, null, 0, 4);
        member(i, world.rival, "B", 0, 5);
        member(i, world.friend, "A", 0, 2);
        challenges.conclude(i, template("MY_SEASON", 200));
        Map<String, Object> r = result(i);
        assertThat(List.copyOf(r.keySet())).containsExactly("code", "name", "mode", "concludedAt", "scoring", "teams", "winners", "ranking");
        assertThat(r.get("teams")).isEqualTo(Map.of("A", 3.0, "B", 5.0));
        assertThat(((Map<?, ?>) r.get("teams")).keySet().stream().map(String::valueOf).toList()).containsExactly("A", "B");
        assertThat(r).containsEntry("winners", List.of("bia"));
        InOrder order = inOrder(points);
        awarded(order, world.me, i, 50);
        awarded(order, world.rival, i, 200);
        awarded(order, world.friend, i, 50);
    }

    @Test
    void dueloPorTimesEmpatadosDaVitoriaAOsDois() {
        ChallengeInstance i = instance("MY_SEASON", "DUELO");
        member(i, world.me, "A", 0, 4);
        member(i, world.rival, "B", 0, 4);
        challenges.conclude(i, template("MY_SEASON", 100));
        assertThat(result(i)).containsEntry("winners", List.of("ana", "bia"));
        verify(points).award(world.me.getId(), "CHALLENGE_COMPLETED", "CHALLENGE", i.getId().toString(), 100);
        verify(points).award(world.rival.getId(), "CHALLENGE_COMPLETED", "CHALLENGE", i.getId().toString(), 100);
    }

    @Test
    void conclusaoAconteceUmaSoVez() {
        ChallengeInstance i = instance("CHANEL_WEEK", "SOLO");
        member(i, world.me, null, 1.0, 0);
        ChallengeTemplate t = template("CHANEL_WEEK", 150);
        challenges.conclude(i, t);
        String first = kit.dep(ChallengeInstanceRepository.class).findById(i.getId()).orElseThrow().getResultJson();
        challenges.conclude(i, t);
        verify(points).award(any(), anyString(), anyString(), anyString(), anyInt());
        assertThat(kit.dep(ChallengeInstanceRepository.class).findById(i.getId()).orElseThrow().getResultJson()).isEqualTo(first);
    }
}
