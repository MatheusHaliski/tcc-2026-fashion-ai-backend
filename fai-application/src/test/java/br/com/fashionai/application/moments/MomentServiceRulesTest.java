package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.FlairTeamMember;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.MomentVote;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentScope;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.FlairTeamMemberRepository;
import br.com.fashionai.domain.repository.FlairTeamRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.MomentParticipationRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.MomentSubmissionRepository;
import br.com.fashionai.domain.repository.MomentVoteRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Momentos §28, §39, §45, §54 — privacidade de Momento de grupo, voto no próprio look, envio fora do período e o job
 * de status, com repositórios simulados (mesmo estilo de FaiPointsGamesTest: sem contexto Spring).
 */
class MomentServiceRulesTest {
    private final List<Moment> momentRows = new ArrayList<>();
    private final List<MomentParticipation> partRows = new ArrayList<>();
    private final List<MomentSubmission> subRows = new ArrayList<>();
    private final List<MomentVote> voteRows = new ArrayList<>();
    private final List<FlairTeamMember> memberRows = new ArrayList<>();
    private final List<User> userRows = new ArrayList<>();
    private MomentService service;
    private final Instant now = Instant.parse("2026-10-25T12:00:00Z");
    private final UUID teamId = UUID.randomUUID();
    private final CurrentUser ana = user("ana", "USER");
    private final CurrentUser bia = user("bia", "USER");
    private final CurrentUser admin = user("root", "ADMIN");

    private static CurrentUser user(String name, String role) {
        return new CurrentUser(UUID.randomUUID(), name, role, ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, java.util.function.BiFunction<String, Object[], Object> body) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type},
                (p, m, a) -> m.getDeclaringClass() == Object.class ? m.invoke(new Object(), a) : body.apply(m.getName(), a));
    }

    @BeforeEach
    void setUp() {
        MomentRepository moments = proxy(MomentRepository.class, (n, a) -> switch (n) {
            case "findById" -> momentRows.stream().filter(m -> m.getId().equals(a[0])).findFirst();
            case "findBySlug" -> momentRows.stream().filter(m -> m.getSlug().equals(a[0])).findFirst();
            case "findByStatusIn" -> momentRows.stream().filter(m -> ((Collection<?>) a[0]).contains(m.getStatus())).toList();
            case "findByIdIn" -> momentRows.stream().filter(m -> ((Collection<?>) a[0]).contains(m.getId())).toList();
            case "findByGroupIdOrderByStartAtDesc" -> momentRows.stream().filter(m -> a[0].equals(m.getGroupId())).toList();
            case "save" -> {
                Moment m = (Moment) a[0];
                if (m.getId() == null) {
                    m.assignId(UUID.randomUUID());
                }
                if (!momentRows.contains(m)) {
                    momentRows.add(m);
                }
                yield m;
            }
            default -> throw new UnsupportedOperationException(n);
        });
        MomentParticipationRepository parts = proxy(MomentParticipationRepository.class, (n, a) -> switch (n) {
            case "findByMomentIdAndUserId" -> partRows.stream().filter(p -> p.getMomentId().equals(a[0]) && p.getUserId().equals(a[1])).findFirst();
            case "findByMomentId" -> partRows.stream().filter(p -> p.getMomentId().equals(a[0])).toList();
            case "findByMomentIdAndStatusIn" -> partRows.stream().filter(p -> p.getMomentId().equals(a[0]) && ((Collection<?>) a[1]).contains(p.getStatus())).toList();
            case "countByMomentIdAndStatusIn" -> partRows.stream().filter(p -> p.getMomentId().equals(a[0]) && ((Collection<?>) a[1]).contains(p.getStatus())).count();
            case "findByUserIdOrderByCreatedAtDesc" -> partRows.stream().filter(p -> p.getUserId().equals(a[0])).toList();
            case "findByMomentIdInAndUserId" -> partRows.stream().filter(p -> ((Collection<?>) a[0]).contains(p.getMomentId()) && p.getUserId().equals(a[1])).toList();
            case "save" -> {
                MomentParticipation p = (MomentParticipation) a[0];
                if (p.getId() == null) {
                    p.assignId(UUID.randomUUID());
                }
                if (!partRows.contains(p)) {
                    partRows.add(p);
                }
                yield p;
            }
            default -> throw new UnsupportedOperationException(n);
        });
        MomentSubmissionRepository subs = proxy(MomentSubmissionRepository.class, (n, a) -> switch (n) {
            case "findById" -> subRows.stream().filter(s -> s.getId().equals(a[0])).findFirst();
            case "findByMomentIdAndWithdrawnFalseOrderBySubmittedAtDesc" -> subRows.stream().filter(s -> s.getMomentId().equals(a[0])).toList();
            case "countByMomentIdAndWithdrawnFalse" -> subRows.stream().filter(s -> s.getMomentId().equals(a[0])).count();
            case "findByMomentIdAndUserIdAndWithdrawnFalse" -> subRows.stream().filter(s -> s.getMomentId().equals(a[0]) && s.getUserId().equals(a[1])).toList();
            case "save" -> a[0];
            default -> throw new UnsupportedOperationException(n);
        });
        MomentVoteRepository votes = proxy(MomentVoteRepository.class, (n, a) -> switch (n) {
            case "findBySubmissionIdAndVoterIdAndDimension" -> voteRows.stream().filter(v -> v.getSubmissionId().equals(a[0]) && v.getVoterId().equals(a[1]) && v.getDimension() == a[2]).findFirst();
            case "findByMomentId" -> voteRows.stream().filter(v -> v.getMomentId().equals(a[0])).toList();
            case "save" -> {
                voteRows.add((MomentVote) a[0]);
                yield a[0];
            }
            case "delete" -> {
                voteRows.remove((MomentVote) a[0]);
                yield null;
            }
            default -> throw new UnsupportedOperationException(n);
        });
        FlairTeamMemberRepository members = proxy(FlairTeamMemberRepository.class, (n, a) -> switch (n) {
            case "findByUserId" -> memberRows.stream().filter(m -> m.getUser().getId().equals(a[0])).findFirst();
            case "findByTeamIdOrderByCreatedAtAsc" -> memberRows.stream().filter(m -> m.getTeam().getId().equals(a[0])).toList();
            case "countByTeamId" -> (long) memberRows.size();
            default -> throw new UnsupportedOperationException(n);
        });
        FlairTeamRepository teams = proxy(FlairTeamRepository.class, (n, a) -> {
            if ("findById".equals(n)) {
                FlairTeam t = new FlairTeam();
                t.assignId(teamId);
                t.setName("Turma SI");
                t.setCode("SI");
                return Optional.of(t);
            }
            throw new UnsupportedOperationException(n);
        });
        UserRepository users = proxy(UserRepository.class, (n, a) -> switch (n) {
            case "findById" -> userRows.stream().filter(u -> u.getId().equals(a[0])).findFirst();
            case "findAllById" -> userRows.stream().filter(u -> {
                for (Object id : (Iterable<?>) a[0]) {
                    if (id.equals(u.getId())) {
                        return true;
                    }
                }
                return false;
            }).toList();
            default -> throw new UnsupportedOperationException(n);
        });
        Guard guard = new Guard(null, null) {
            @Override
            public void requireCanCreate(CurrentUser user) {
            }

            @Override
            public ApiException deny(CurrentUser user, String resource, String message) {
                return ApiException.forbidden(message);
            }
        };
        service = new MomentService(moments, null, parts, subs, votes, null, null, null, users, teams, members, null, null, null, null, guard, null, null);
        service.useClock(Clock.fixed(now, ZoneOffset.UTC));
        member(ana.id());
    }

    private void member(UUID userId) {
        FlairTeam t = new FlairTeam();
        t.assignId(teamId);
        User u = new User();
        u.assignId(userId);
        FlairTeamMember m = new FlairTeamMember();
        m.setTeam(t);
        m.setUser(u);
        memberRows.add(m);
        userRows.add(u);
    }

    private Moment moment(String slug, MomentVisibility vis, UUID groupId, MomentStatus status) {
        Moment m = new Moment();
        m.assignId(UUID.randomUUID());
        m.setSlug(slug);
        m.setName(slug);
        m.setType(groupId == null ? MomentType.CULTURAL : MomentType.PRIVATE_GROUP);
        m.setNature(groupId == null ? MomentNature.CULTURAL : MomentNature.PRIVATE);
        m.setStatus(status);
        m.setVisibility(vis);
        m.setScope(groupId == null ? MomentScope.GLOBAL : MomentScope.GROUP);
        m.setGroupId(groupId);
        m.setStartAt(Instant.parse("2026-10-20T03:00:00Z"));
        m.setEndAt(Instant.parse("2026-11-01T02:59:59Z"));
        momentRows.add(m);
        return m;
    }

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
        MomentSubmission own = new MomentSubmission();
        own.assignId(UUID.randomUUID());
        own.setMomentId(m.getId());
        own.setUserId(ana.id());
        own.setSchemeId(UUID.randomUUID());
        own.setSubmittedAt(now);
        subRows.add(own);
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

    /** O Hype vem do estado v2 gravado pelo job: sem dados suficientes = nulo; de terceiros, só o público elegível. */
    @Test
    void hypeVemDoEstadoV2ERespeitaAPrivacidade() {
        HypeScoreConfig config = HypeScoreConfig.defaults();
        HypeScoreCurrentRepository current = mock(HypeScoreCurrentRepository.class);
        MomentService withHype = new MomentService(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, current, config);
        UUID personal = UUID.randomUUID(), open = UUID.randomUUID(), thin = UUID.randomUUID();
        when(current.findByEntityTypeAndEntityIdAndAlgorithmVersion(HypeEntityType.SCHEME, personal, config.algorithmVersion()))
                .thenReturn(Optional.of(row(HypeStatus.AVAILABLE, 72, false)));
        when(current.findByEntityTypeAndEntityIdAndAlgorithmVersion(HypeEntityType.SCHEME, open, config.algorithmVersion()))
                .thenReturn(Optional.of(row(HypeStatus.AVAILABLE, 55, true)));
        when(current.findByEntityTypeAndEntityIdAndAlgorithmVersion(HypeEntityType.SCHEME, thin, config.algorithmVersion()))
                .thenReturn(Optional.of(row(HypeStatus.INSUFFICIENT_DATA, null, true)));
        assertThat(withHype.hypeOf(HypeEntityType.SCHEME, personal, true)).isEqualTo(72.0);
        assertThat(withHype.hypeOf(HypeEntityType.SCHEME, personal, false)).as("Hype pessoal não vaza para terceiros").isNull();
        assertThat(withHype.hypeOf(HypeEntityType.SCHEME, open, false)).isEqualTo(55.0);
        assertThat(withHype.hypeOf(HypeEntityType.SCHEME, thin, true)).as("sem dados nunca vira 0").isNull();
        assertThat(withHype.hypeOf(HypeEntityType.SCHEME, UUID.randomUUID(), true)).isNull();
    }

    private static HypeScoreCurrent row(br.com.fashionai.domain.model.enums.HypeStatus status, Integer score, boolean publicEligible) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setStatus(status);
        c.setScore(score == null ? null : BigDecimal.valueOf(score));
        c.setPublicEligible(publicEligible);
        return c;
    }
}
