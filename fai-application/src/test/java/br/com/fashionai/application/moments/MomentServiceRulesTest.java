package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Momentos §28, §39, §45, §54 — privacidade de Momento de grupo, voto no próprio look, envio fora do período e o job
 * de status, com repositórios simulados (mesmo estilo de FaiPointsGamesTest: sem contexto Spring).
 */
class MomentServiceRulesTest extends MomentServiceRulesFixture {
    @Test
    void momentoDeGrupoSoApareceParaMembros() {
        Moment pub = moment("halloween-2026", MomentVisibility.PUBLIC, null, MomentStatus.ACTIVE);
        Moment priv = moment("halloween-turma-si", MomentVisibility.GROUP, teamId, MomentStatus.ACTIVE);
        assertThat(service.canSee(null, pub)).isTrue();
        assertThat(service.canSee(null, priv)).isFalse();
        assertThat(service.canSee(bia, priv)).isFalse();
        assertThat(service.canSee(ana, priv)).isTrue();
        assertThat(service.canSee(admin, priv)).isTrue();
        // descoberta pública (home) nunca lista o privado para quem não é membro
        List<Moment> forBia = service.visibleLive(bia, null);
        assertThat(forBia).containsExactly(pub);
        assertThat(service.visibleLive(ana, null)).containsExactlyInAnyOrder(pub, priv);
    }

    @Test
    void naoVotaNoProprioLookNemForaDoPeriodo() {
        Moment m = moment("halloween-2026", MomentVisibility.PUBLIC, null, MomentStatus.ACTIVE);
        MomentSubmission own = submit(m, ana, "Meu look", Visibility.PUBLIC, 0, 80);
        assertThatThrownBy(() -> service.vote(ana, m.getSlug(), new MomentService.VoteRequest(own.getId(), "creative")))
                .isInstanceOf(ApiException.class).hasMessageContaining("próprio");
        Map<String, Object> r = service.vote(bia, m.getSlug(), new MomentService.VoteRequest(own.getId(), "creative"));
        assertThat(r.get("voted")).isEqualTo(true);
        assertThat(own.getVoteCount()).isEqualTo(1);
        // votar de novo na mesma dimensão desfaz (nunca acumula)
        assertThat(service.vote(bia, m.getSlug(), new MomentService.VoteRequest(own.getId(), "creative")).get("voted")).isEqualTo(false);
        assertThat(own.getVoteCount()).isZero();
        Moment ended = moment("primavera-2025", MomentVisibility.PUBLIC, null, MomentStatus.ACTIVE);
        ended.setStartAt(Instant.parse("2025-09-22T03:00:00Z"));
        ended.setEndAt(Instant.parse("2025-12-21T02:59:59Z"));
        assertThatThrownBy(() -> service.vote(bia, ended.getSlug(), new MomentService.VoteRequest(own.getId(), "trend"))).isInstanceOf(ApiException.class);
    }

    @Test
    void entrarESairNaoReiniciaAParticipacao() {
        Moment m = moment("denim-week", MomentVisibility.PUBLIC, null, MomentStatus.ACTIVE);
        service.join(ana, m.getSlug(), new MomentService.JoinRequest("MY_STYLE", true));
        MomentParticipation p = partRows.get(0);
        Instant firstJoin = p.getJoinedAt();
        assertThat(m.getParticipantCount()).isEqualTo(1);
        service.leave(ana, m.getSlug());
        assertThat(p.getStatus()).isEqualTo(MomentParticipationStatus.LEFT);
        service.join(ana, m.getSlug(), null);
        assertThat(p.getJoinedAt()).isEqualTo(firstJoin);
        assertThat(p.getJoinCount()).isEqualTo(2);
        assertThat(m.getParticipantCount()).isEqualTo(1);   // reentrar não conta de novo
        Moment ended = moment("verao-2025", MomentVisibility.PUBLIC, null, MomentStatus.ACTIVE);
        ended.setStartAt(Instant.parse("2025-12-21T03:00:00Z"));
        ended.setEndAt(Instant.parse("2026-03-21T02:59:59Z"));
        assertThatThrownBy(() -> service.join(ana, ended.getSlug(), null)).isInstanceOf(ApiException.class);
    }

    @Test
    void jobAtivaEEncerraPeloRelogioEGravaMemoria() {
        Moment future = moment("denim-week-2026", MomentVisibility.PUBLIC, null, MomentStatus.SCHEDULED);
        future.setStartAt(Instant.parse("2026-11-09T03:00:00Z"));
        future.setEndAt(Instant.parse("2026-11-16T02:59:59Z"));
        Moment running = moment("halloween-2026", MomentVisibility.PUBLIC, null, MomentStatus.SCHEDULED);
        Moment over = moment("primavera-2025", MomentVisibility.PUBLIC, null, MomentStatus.ACTIVE);
        over.setStartAt(Instant.parse("2025-09-22T03:00:00Z"));
        over.setEndAt(Instant.parse("2025-12-21T02:59:59Z"));
        Map<String, Integer> r = service.tick();
        assertThat(r.get("started")).isEqualTo(1);
        assertThat(r.get("ended")).isEqualTo(1);
        assertThat(future.getStatus()).isEqualTo(MomentStatus.SCHEDULED);
        assertThat(running.getStatus()).isEqualTo(MomentStatus.ACTIVE);
        assertThat(over.getStatus()).isEqualTo(MomentStatus.ENDED);
        assertThat(over.getMemoryJson()).contains("\"looks\":0").contains("\"participants\":0");
        // ENDED nunca some: continua visível e vira histórico
        assertThat(service.canSee(null, over)).isTrue();
    }

    @Test
    void calendarioDoGrupoSoParaMembros() {
        moment("halloween-turma-si", MomentVisibility.GROUP, teamId, MomentStatus.ACTIVE);
        assertThatThrownBy(() -> service.groupMoments(bia, teamId)).isInstanceOf(ApiException.class);
        Map<String, Object> g = service.groupMoments(ana, teamId);
        assertThat((List<?>) g.get("active")).hasSize(1);
        assertThat(g.get("name")).isEqualTo("Turma SI");
    }
}
