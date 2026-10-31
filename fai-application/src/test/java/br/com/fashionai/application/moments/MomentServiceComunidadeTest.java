package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.MomentVote;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.UserAchievement;
import br.com.fashionai.domain.model.enums.FlairMomentMode;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.MomentVoteDimension;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.application.testkit.MemoryRepository;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.isNull;

/** MomentService: votar, feed, ranking, em alta, badge e flair (separado de MomentServiceAcoesTest por tema). */
class MomentServiceComunidadeTest extends MomentServiceFixture {
    // ------------------------------------------------------------------ comunidade
    @Test
    void votarAlternaVotoEAtualizaContagem() {
        Moment m = active("votos");
        MomentSubmission s = submission(m, w.rival, w.looksOf(w.rival).get(0), 0, 50);

        Map<String, Object> first = svc.vote(me, "votos", new MomentService.VoteRequest(s.getId(), "creative"));
        assertThat(first).containsEntry("voted", true).containsEntry("votes", 1).containsEntry("dimension", "CREATIVE");
        assertThat(MemoryRepository.<MomentVote>rows(votes)).hasSize(1);
        Map<String, Object> second = svc.vote(me, "votos", new MomentService.VoteRequest(s.getId(), "CREATIVE"));
        assertThat(second).containsEntry("voted", false).containsEntry("votes", 0);
        assertThat(MemoryRepository.<MomentVote>rows(votes)).isEmpty();
    }

    @Test
    void votoProprioLookPrivadoEDimensaoInvalida() {
        Moment m = active("regras");
        MomentSubmission minha = submission(m, w.me, w.looksOf(w.me).get(0), 0, 50);
        assertThatThrownBy(() -> svc.vote(me, "regras", new MomentService.VoteRequest(minha.getId(), "CREATIVE")))
                .satisfies(e -> assertThat(code(e, "VOTO_PROPRIO")).isEqualTo(409));
        Scheme privado = w.looksOf(w.rival).get(1);
        privado.setVisibility(Visibility.PRIVATE);
        MomentSubmission oculta = submission(m, w.rival, privado, 0, 50);
        assertThatThrownBy(() -> svc.vote(me, "regras", new MomentService.VoteRequest(oculta.getId(), "CREATIVE")))
                .extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        MomentSubmission dela = submission(m, w.rival, w.looksOf(w.rival).get(0), 0, 50);
        assertThatThrownBy(() -> svc.vote(me, "regras", new MomentService.VoteRequest(dela.getId(), null)))
                .satisfies(e -> assertThat(code(e, "VALOR_INVALIDO")).isEqualTo(400));
        dela.setWithdrawn(true);
        assertThatThrownBy(() -> svc.vote(me, "regras", new MomentService.VoteRequest(dela.getId(), "CREATIVE")))
                .extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        MomentSubmission semLook = submission(m, w.rival, w.looksOf(w.rival).get(2), 0, 50);
        semLook.setSchemeId(UUID.randomUUID());
        assertThatThrownBy(() -> svc.vote(me, "regras", new MomentService.VoteRequest(semLook.getId(), "CREATIVE")))
                .extracting(e -> ((ApiException) e).status()).isEqualTo(404);
    }

    @Test
    void votoSoEmMomentoCompetitivoAtivoEDeMembro() {
        Moment coop = active("coop");
        coop.setFlairMode(FlairMomentMode.COOPERATIVE);
        moments.save(coop);
        assertThatThrownBy(() -> svc.vote(me, "coop", new MomentService.VoteRequest(UUID.randomUUID(), "CREATIVE")))
                .satisfies(e -> assertThat(code(e, "SEM_VOTACAO")).isEqualTo(409));
        moment("depois", NOW.plus(Duration.ofDays(1)), NOW.plus(Duration.ofDays(2)), MomentStatus.SCHEDULED);
        assertThatThrownBy(() -> svc.vote(me, "depois", new MomentService.VoteRequest(UUID.randomUUID(), "CREATIVE")))
                .satisfies(e -> assertThat(code(e, "MOMENTO_FORA_DO_PERIODO")).isEqualTo(409));
        Moment grupo = groupMoment("grupo", team("Outro", w.friend));
        grupo.setCreatedByUserId(w.me.getId());
        moments.save(grupo);
        assertThatThrownBy(() -> svc.vote(me, "grupo", new MomentService.VoteRequest(UUID.randomUUID(), "CREATIVE")))
                .extracting(e -> ((ApiException) e).status()).isEqualTo(403);
    }

    @Test
    void membroDeGrupoVotaEmLookPrivado() {
        FlairTeam t = team("Turma", w.me, w.rival);
        Moment m = groupMoment("turma", t);
        Scheme privado = w.looksOf(w.rival).get(0);
        privado.setVisibility(Visibility.PRIVATE);
        MomentSubmission s = submission(m, w.rival, privado, 0, 50);
        assertThat(svc.vote(me, "turma", new MomentService.VoteRequest(s.getId(), "TREND"))).containsEntry("voted", true);
    }

    @Test
    void feedEscondeLookPrivadoDeOutrosEMarcaMeusVotos() {
        Moment m = active("feed");
        MomentSubmission publica = submission(m, w.rival, w.looksOf(w.rival).get(0), 3, 60);
        Scheme privado = w.looksOf(w.rival).get(1);
        privado.setVisibility(Visibility.PRIVATE);
        submission(m, w.rival, privado, 1, 40);
        MomentSubmission minha = submission(m, w.me, w.looksOf(w.me).get(0), 0, 30);
        MomentSubmission semLook = submission(m, w.friend, w.looksOf(w.friend).get(0), 0, 30);
        semLook.setSchemeId(UUID.randomUUID());
        vote(m, publica, w.me, MomentVoteDimension.CREATIVE);
        hypeOf(publica.getSchemeId(), w.rival.getId(), 70, true);

        Map<String, Object> out = svc.feed(me, "feed");

        List<Map<String, Object>> items = list(out.get("items"));
        assertThat(items).extracting(i -> i.get("id")).containsExactlyInAnyOrder(publica.getId(), minha.getId());
        Map<String, Object> pub = items.stream().filter(i -> i.get("id").equals(publica.getId())).findFirst().orElseThrow();
        assertThat(pub.get("votedByMe")).isEqualTo(true);
        assertThat(pub.get("hype")).isEqualTo(70);
        assertThat(pub.get("contextualHype")).isEqualTo(75);
        assertThat(items.stream().filter(i -> i.get("id").equals(minha.getId())).findFirst().orElseThrow().get("mine")).isEqualTo(true);
        assertThat((List<?>) out.get("dimensions")).hasSize(MomentVoteDimension.values().length);

        Map<String, Object> anon = svc.feed(null, "feed");
        assertThat(list(anon.get("items"))).hasSize(2);
    }

    @Test
    void rankingCompetitivoOrdenaPorVotosEMatch() {
        Moment m = active("rank");
        MomentSubmission a = submission(m, w.rival, w.looksOf(w.rival).get(0), 5, 50);
        MomentSubmission b = submission(m, w.friend, w.looksOf(w.friend).get(0), 5, 90);
        MomentSubmission c = submission(m, w.me, w.looksOf(w.me).get(0), 1, null);
        vote(m, a, w.me, MomentVoteDimension.ELEGANT);

        Map<String, Object> out = svc.leaderboard(me, "rank");

        List<Map<String, Object>> items = list(out.get("items"));
        assertThat(items).extracting(i -> i.get("submissionId")).containsExactly(b.getId(), a.getId(), c.getId());
        assertThat(items.get(1).get("byDimension")).isEqualTo(Map.of("ELEGANT", 1));
        assertThat(items.get(2).get("you")).isEqualTo(true);
        assertThat(items.get(0).get("user")).isNotNull();
        assertThat(out.get("competitive")).isEqualTo(true);
    }

    @Test
    void rankingAnonimoEmMomentoNaoDescobrivelEsconeOutrosNomes() {
        FlairTeam t = team("Anon", w.me, w.rival);
        Moment m = groupMoment("anon", t);
        submission(m, w.rival, w.looksOf(w.rival).get(0), 2, 50);
        submission(m, w.me, w.looksOf(w.me).get(0), 1, 50);
        List<Map<String, Object>> items = list(svc.leaderboard(me, "anon").get("items"));
        assertThat(items.get(0).get("user")).isNull();
        assertThat(items.get(1).get("user")).isNotNull();
    }

    @Test
    void rankingNaoCompetitivoECooperativo() {
        Moment coop = active("coop");
        coop.setFlairMode(FlairMomentMode.COOPERATIVE);
        coop.setCooperativeGoal(5);
        moments.save(coop);
        submission(coop, w.me, w.looksOf(w.me).get(0), 0, 10);
        Map<String, Object> out = svc.leaderboard(me, "coop");
        assertThat(out.get("competitive")).isEqualTo(false);
        assertThat(map(out.get("cooperative"))).containsEntry("goal", 5).containsEntry("looks", 1L);

        coop.setCooperativeGoal(null);
        assertThat(map(svc.leaderboard(me, "coop").get("cooperative"))).containsEntry("goal", 0);

        Moment calmo = active("calmo");
        calmo.setFlairMode(FlairMomentMode.MOMENT);
        moments.save(calmo);
        assertThat(svc.leaderboard(me, "calmo")).doesNotContainKey("cooperative").containsEntry("competitive", false);
    }

    @Test
    void emAltaContaEstilosCoresInterpretacoesELooks() {
        Moment m = active("alta");
        Scheme la = w.looksOf(w.rival).get(0);
        Scheme lb = w.looksOf(w.friend).get(0);
        submission(m, w.rival, la, 4, 50);
        MomentSubmission semInterp = submission(m, w.friend, lb, 4, 50);
        semInterp.setMatchJson(null);
        hypeOf(lb.getId(), w.friend.getId(), 80, true);

        Map<String, Object> out = svc.trending(me, "alta", 3);

        assertThat(out.get("basis")).isEqualTo(2);
        assertThat(list(out.get("styles"))).extracting(s -> s.get("key")).contains("streetwear");
        assertThat(list(out.get("colors"))).isNotEmpty();
        assertThat(list(out.get("interpretations"))).extracting(s -> s.get("key")).containsExactly("dark");
        assertThat(list(out.get("looks"))).extracting(l -> l.get("schemeId")).containsExactly(lb.getId(), la.getId());
    }

    @Test
    void submissaoSemCacheLeOLookEHypeDoRepositorio() {
        Moment m = active("view");
        Scheme s = w.looksOf(w.me).get(0);
        MomentSubmission sub = submission(m, w.me, s, 0, 60);
        hypeOf(s.getId(), w.me.getId(), 40, false);
        Map<String, Object> v = svc.submissionView(sub, me, Map.of(), false);
        assertThat(v.get("hype")).isEqualTo(40);
        assertThat(v.get("scheme")).isNotNull();
        sub.setSchemeId(UUID.randomUUID());
        assertThat(svc.submissionView(sub, null, Map.of(), false)).doesNotContainKey("scheme").containsEntry("mine", false);
    }

    @Test
    void lookPublicamenteListado() {
        Moment m = active("pl");
        Scheme s = w.looksOf(w.me).get(0);
        assertThat(MomentService.publiclyListed(m, null)).isFalse();
        assertThat(MomentService.publiclyListed(m, s)).isTrue();
        s.setVisibility(Visibility.PRIVATE);
        assertThat(MomentService.publiclyListed(m, s)).isFalse();
        m.setVisibility(MomentVisibility.FRIENDS);
        assertThat(MomentService.publiclyListed(m, s)).isTrue();
        m.setVisibility(MomentVisibility.PUBLIC);
        m.setGroupId(UUID.randomUUID());
        assertThat(MomentService.publiclyListed(m, s)).isTrue();
    }

    @Test
    void badgeNaoDuplica() {
        svc.grantBadge(w.me.getId(), "MOMENT_X");
        svc.grantBadge(w.me.getId(), "MOMENT_X");
        assertThat(MemoryRepository.<UserAchievement>rows(kit.dep(UserAchievementRepository.class))).hasSize(1);
    }

    @Test
    void flairPeloTipoOuPeloGrupo() {
        Moment m = active("flair");
        assertThat(svc.isFlair(m)).isFalse();
        m.setType(MomentType.PRIVATE_GROUP);
        assertThat(svc.isFlair(m)).isTrue();
        m.setType(MomentType.COMMUNITY);
        m.setGroupId(UUID.randomUUID());
        assertThat(svc.isFlair(m)).isTrue();
    }
}
