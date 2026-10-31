package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.enums.FlairMomentMode;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.MomentVoteDimension;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** MomentService: job de status/lembretes e encerramento com ranking, prêmios, meta e Memória (separado de MomentServiceGrupoAdminTest por tema). */
class MomentServiceJobTest extends MomentServiceFixture {
    // ------------------------------------------------------------------ job
    @Test
    void tickIniciaEncerraLembraEAvisaPrazo() {
        Moment comecou = moment("comecou", NOW.minus(Duration.ofHours(1)), NOW.plus(Duration.ofDays(1)), MomentStatus.SCHEDULED);
        Moment acabou = moment("acabou", NOW.minus(Duration.ofDays(3)), NOW.minus(Duration.ofHours(1)), MomentStatus.ACTIVE);
        Moment semana = moment("semana", NOW.plus(Duration.ofDays(3)), NOW.plus(Duration.ofDays(6)), MomentStatus.SCHEDULED);
        MomentParticipation lembrar = part(semana, w.me, MomentParticipationStatus.INTERESTED);
        lembrar.setRemind(true);
        MomentParticipation jaLembrado = part(semana, w.rival, MomentParticipationStatus.INTERESTED);
        jaLembrado.setRemind(true);
        jaLembrado.setRemindSent(true);
        MomentParticipation prazo = part(comecou, w.me, MomentParticipationStatus.JOINED);
        MomentParticipation jaAvisado = part(comecou, w.rival, MomentParticipationStatus.JOINED);
        jaAvisado.setDeadlineNotified(true);

        Map<String, Integer> out = svc.tick();

        assertThat(out).containsEntry("started", 1).containsEntry("ended", 1).containsEntry("reminded", 1).containsEntry("deadlines", 1);
        assertThat(comecou.getStatus()).isEqualTo(MomentStatus.ACTIVE);
        assertThat(acabou.getStatus()).isEqualTo(MomentStatus.ENDED);
        assertThat(lembrar.isRemindSent()).isTrue();
        assertThat(prazo.isDeadlineNotified()).isTrue();
        verify(notifications).notify(eq(w.me.getId()), any(), eq(NotificationType.MOMENT_STARTING), any(), eq(semana.getId()), any(), any(), any());
        verify(notifications).notify(eq(w.me.getId()), any(), eq(NotificationType.MOMENT_DEADLINE), any(), eq(comecou.getId()), any(), any(), any());
    }

    @Test
    void encerrarMomentoCompetitivoDaRankingPremiosEMemoria() {
        Moment m = active("final");
        m.setSettingsJson("{\"prizes\":[100,50,0]}");
        moments.save(m);
        var pa = part(m, w.me, MomentParticipationStatus.COMPLETED);
        var pb = part(m, w.rival, MomentParticipationStatus.SUBMITTED);
        var pc = part(m, w.friend, MomentParticipationStatus.SUBMITTED);
        MomentSubmission a = submission(m, w.me, w.looksOf(w.me).get(0), 5, 80);
        submission(m, w.me, w.looksOf(w.me).get(1), 1, 99);
        MomentSubmission b = submission(m, w.rival, w.looksOf(w.rival).get(0), 3, 70);
        MomentSubmission b2 = submission(m, w.rival, w.looksOf(w.rival).get(1), 3, 90);
        MomentSubmission c = submission(m, w.friend, w.looksOf(w.friend).get(0), 1, null);
        var privado = w.looksOf(w.friend).get(1);
        privado.setVisibility(Visibility.PRIVATE);
        submission(m, w.friend, privado, 9, 99);
        var semDono = w.person("zeca", 1);
        submission(m, semDono, w.looksOf(semDono).get(0), 0, 10);
        vote(m, a, w.rival, MomentVoteDimension.CREATIVE);
        vote(m, a, w.friend, MomentVoteDimension.CREATIVE);
        vote(m, b2, w.me, MomentVoteDimension.ELEGANT);

        svc.end(m);

        assertThat(m.getStatus()).isEqualTo(MomentStatus.ENDED);
        assertThat(pa.getRanking()).isEqualTo(1);
        assertThat(pb.getRanking()).isEqualTo(2);
        assertThat(pc.getRanking()).isEqualTo(3);
        assertThat(pa.getPercentile()).isEqualTo(25);
        assertThat(pa.getPointsEarned()).isEqualTo(10);
        verify(points).award(eq(w.me.getId()), eq("MOMENT_PRIZE"), eq("MOMENT"), eq(m.getId() + ":prize"), eq(100));
        verify(points).award(eq(w.rival.getId()), eq("MOMENT_PRIZE"), eq("MOMENT"), eq(m.getId() + ":prize"), eq(50));
        Map<String, Object> memory = Json.map(m.getMemoryJson());
        assertThat(map(memory.get("winner"))).containsEntry("submissionId", a.getId().toString());
        assertThat(map(memory.get("mostCreative"))).containsEntry("submissionId", a.getId().toString());
        assertThat(map(memory.get("mostElegant"))).containsEntry("submissionId", b2.getId().toString());
        assertThat(memory.get("mostTrend")).isNull();
        assertThat(memory.get("looks")).isEqualTo(7);
        assertThat(memory.get("goalReached")).isEqualTo(false);
        assertThat(b.getId()).isNotNull();
        assertThat(c.getId()).isNotNull();
    }

    @Test
    void encerrarMomentoCooperativoPagaMetaAEngajados() {
        FlairTeam t = team("Coop", w.me, w.rival);
        Moment m = groupMoment("coop", t);
        m.setFlairMode(FlairMomentMode.COOPERATIVE);
        m.setCooperativeGoal(1);
        m.setSettingsJson("{\"coopPoints\":500}");
        moments.save(m);
        var dentro = part(m, w.me, MomentParticipationStatus.SUBMITTED);
        part(m, w.rival, MomentParticipationStatus.INTERESTED);
        submission(m, w.me, w.looksOf(w.me).get(0), 0, 50);

        svc.end(m);

        Map<String, Object> memory = Json.map(m.getMemoryJson());
        assertThat(memory.get("goalReached")).isEqualTo(true);
        assertThat(memory.get("winner")).isNull();
        assertThat(dentro.getRanking()).isNull();
        assertThat(dentro.getPointsEarned()).isEqualTo(10);
        verify(points).award(eq(w.me.getId()), eq("MOMENT_COOP_GOAL"), eq("MOMENT"), eq(m.getId() + ":coop"), eq(150));
        verify(points, never()).award(eq(w.rival.getId()), anyString(), anyString(), anyString(), any());
    }

    @Test
    void encerrarSemPontosNaoPagaPremioNemMeta() {
        Moment m = active("sem");
        m.setPointsEnabled(false);
        m.setFlairMode(FlairMomentMode.COOPERATIVE);
        m.setCooperativeGoal(0);
        moments.save(m);
        when(points.award(any(), anyString(), anyString(), anyString(), any())).thenReturn(new FaiPointsService.Award(false, 0, false, null, null, false));
        submission(m, w.me, w.looksOf(w.me).get(0), 0, 50);
        svc.end(m);
        assertThat(Json.map(m.getMemoryJson())).containsEntry("goalReached", true);
        verify(points, never()).award(any(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void lookDaMemoriaSoMostraAutorEmMomentoPublicoOuDeGrupo() {
        Moment m = active("mem");
        MomentSubmission s = submission(m, w.me, w.looksOf(w.me).get(0), 1, 10);
        assertThat(svc.memoryLook(s, m).get("user")).isNotNull();
        m.setVisibility(MomentVisibility.INVITE_ONLY);
        assertThat(svc.memoryLook(s, m)).containsKey("title").containsEntry("user", null);
        s.setSchemeId(UUID.randomUUID());
        assertThat(svc.memoryLook(s, m)).doesNotContainKey("title");
    }

    @Test
    void naturezaSensivelNaoCompeteNoEncerramento() {
        Moment m = active("religioso");
        m.setNature(MomentNature.RELIGIOUS);
        moments.save(m);
        var p = part(m, w.me, MomentParticipationStatus.SUBMITTED);
        submission(m, w.me, w.looksOf(w.me).get(0), 1, 10);
        svc.end(m);
        assertThat(p.getRanking()).isNull();
        assertThat(Json.map(m.getMemoryJson())).containsEntry("winner", null);
    }
}
