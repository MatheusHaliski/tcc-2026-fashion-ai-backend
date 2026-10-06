package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.FlairTeamMember;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.MomentChallenge;
import br.com.fashionai.domain.model.MomentVote;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentScope;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.FlairTeamMemberRepository;
import br.com.fashionai.domain.repository.FlairTeamRepository;
import br.com.fashionai.domain.repository.MomentChallengeRepository;
import br.com.fashionai.domain.repository.MomentParticipationRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.MomentSubmissionRepository;
import br.com.fashionai.domain.repository.MomentVoteRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
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
    private final List<Scheme> schemeRows = new ArrayList<>();
    private final List<MomentChallenge> challengeRows = new ArrayList<>();
    private MomentService service;
    private final Instant now = Instant.parse("2026-10-25T12:00:00Z");
    private final UUID teamId = UUID.randomUUID();
    private final CurrentUser ana = user("ana", "USER");
    private final CurrentUser bia = user("bia", "USER");
    private final CurrentUser admin = user("root", "ADMIN");
    private final CurrentUser carla = user("carla", "USER");

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
            case "findByMomentIdAndSchemeId" -> subRows.stream().filter(s -> s.getMomentId().equals(a[0]) && s.getSchemeId().equals(a[1])).findFirst();
            default -> throw new UnsupportedOperationException(n);
        });
        MomentVoteRepository votes = proxy(MomentVoteRepository.class, (n, a) -> switch (n) {
            case "findBySubmissionIdAndVoterIdAndDimension" -> voteRows.stream().filter(v -> v.getSubmissionId().equals(a[0]) && v.getVoterId().equals(a[1]) && v.getDimension() == a[2]).findFirst();
            case "findByMomentId" -> voteRows.stream().filter(v -> v.getMomentId().equals(a[0])).toList();
            case "findByMomentIdAndVoterId" -> voteRows.stream().filter(v -> v.getMomentId().equals(a[0]) && v.getVoterId().equals(a[1])).toList();
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
        SchemeRepository schemes = proxy(SchemeRepository.class, (n, a) -> switch (n) {
            case "findById" -> schemeRows.stream().filter(x -> x.getId().equals(a[0])).findFirst();
            case "findByIdIn" -> schemeRows.stream().filter(x -> ((Collection<?>) a[0]).contains(x.getId())).toList();
            default -> throw new UnsupportedOperationException(n);
        });
        SchemeItemRepository schemeItems = proxy(SchemeItemRepository.class, (n, a) -> switch (n) {
            case "findBySchemeIdOrderBySortOrder", "findBySchemeIdIn" -> List.of();
            default -> throw new UnsupportedOperationException(n);
        });
        MomentChallengeRepository challenges = proxy(MomentChallengeRepository.class, (n, a) -> switch (n) {
            case "findByMomentIdOrderBySortOrderAsc" -> challengeRows.stream().filter(c -> c.getMomentId().equals(a[0])).toList();
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

            /** Regra do Guard sem seguidores: dono e administração veem tudo; os demais, só PUBLIC. */
            @Override
            public boolean canView(CurrentUser viewer, UUID ownerId, Visibility visibility) {
                return (viewer != null && (viewer.id().equals(ownerId) || viewer.admin())) || visibility == Visibility.PUBLIC;
            }
        };
        service = new MomentService(moments, challenges, parts, subs, votes, schemes, schemeItems, null, users, teams, members, null, null, null, null, guard, null);
        service.useClock(Clock.fixed(now, ZoneOffset.UTC));
        member(ana.id());
    }

    private void member(UUID userId) {
        FlairTeam t = new FlairTeam();
        t.assignId(teamId);
        User u = new User();
        u.assignId(userId);
        u.setUsername("ana");
        u.setProfileType(ProfileType.PESSOAL);
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

    // ------------------------------------------------------------------ review do PR: looks privados, datas, estação
    private User userOf(CurrentUser c) {
        return userRows.stream().filter(u -> u.getId().equals(c.id())).findFirst().orElseGet(() -> {
            User u = new User();
            u.assignId(c.id());
            u.setUsername(c.username());
            u.setProfileType(ProfileType.PESSOAL);
            userRows.add(u);
            return u;
        });
    }

    private MomentSubmission submit(Moment m, CurrentUser who, String title, Visibility vis, int votes, int match) {
        Scheme sc = new Scheme();
        sc.assignId(UUID.randomUUID());
        sc.setUser(userOf(who));
        sc.setTitle(title);
        sc.setCoverImageUrl("/media/" + title + ".png");
        sc.setVisibility(vis);
        schemeRows.add(sc);
        MomentSubmission s = new MomentSubmission();
        s.assignId(UUID.randomUUID());
        s.setMomentId(m.getId());
        s.setUserId(who.id());
        s.setSchemeId(sc.getId());
        s.setVoteCount(votes);
        s.setMatchScore(match);
        s.setSubmittedAt(now.minusSeconds(votes));
        subRows.add(s);
        return s;
    }

    @Test
    @SuppressWarnings("unchecked")
    void rankingPublicoNaoExpoeLookPrivado() {
        Moment m = moment("halloween-2026", MomentVisibility.PUBLIC, null, MomentStatus.ACTIVE);
        submit(m, bia, "Dark minimal", Visibility.PUBLIC, 3, 80);
        MomentSubmission secret = submit(m, carla, "Look secreto", Visibility.PRIVATE, 9, 95);
        // visitante anônimo (rota pública): só o look público, e nada do privado (título, capa, dono, ids)
        Map<String, Object> anon = service.leaderboard(null, m.getSlug());
        List<Map<String, Object>> items = (List<Map<String, Object>>) anon.get("items");
        assertThat(items).extracting(r -> r.get("title")).containsExactly("Dark minimal");
        assertThat(anon.toString()).doesNotContain("Look secreto").doesNotContain(secret.getSchemeId().toString()).doesNotContain(secret.getId().toString());
        assertThat(items.get(0).get("position")).isEqualTo(1);
        // o mesmo filtro no feed e no trending
        assertThat(service.feed(null, m.getSlug()).toString()).doesNotContain("Look secreto");
        assertThat(service.trending(null, m.getSlug(), 8).toString()).doesNotContain(secret.getSchemeId().toString());
        // a dona vê o próprio look; outra pessoa logada, não
        assertThat((List<Map<String, Object>>) service.leaderboard(carla, m.getSlug()).get("items")).extracting(r -> r.get("title")).contains("Look secreto");
        assertThat(service.leaderboard(bia, m.getSlug()).toString()).doesNotContain("Look secreto");
        // e não dá para votar (nem confirmar a existência) num look que não se pode ver
        assertThatThrownBy(() -> service.vote(bia, m.getSlug(), new MomentService.VoteRequest(secret.getId(), "theme")))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(404));
    }

    @Test
    void memoriaDeMomentoPublicoSoDestacaLooksPublicos() {
        Moment m = moment("primavera-2025", MomentVisibility.PUBLIC, null, MomentStatus.ACTIVE);
        m.setStartAt(Instant.parse("2025-09-22T03:00:00Z"));
        m.setEndAt(Instant.parse("2025-12-21T02:59:59Z"));
        submit(m, bia, "Florais", Visibility.PUBLIC, 2, 70);
        submit(m, carla, "Look secreto", Visibility.PRIVATE, 9, 95);
        service.tick();
        assertThat(m.getStatus()).isEqualTo(MomentStatus.ENDED);
        assertThat(m.getMemoryJson()).contains("Florais").doesNotContain("Look secreto").contains("\"looks\":2");
    }

    @Test
    void momentoDeGrupoGuardaAHoraEscolhidaNoFusoDoPedido() {
        Map<String, Object> created = service.createGroupMoment(ana, teamId, new MomentService.GroupMomentRequest("Halloween Night", null, "Halloween reinterpretado",
                "2026-10-30T18:30", "2026-10-30T23:59", "America/Sao_Paulo", "GROUP", "BATTLE", 1, true, true, true, true, true, true, List.of(150, 100, 50),
                null, List.of(), List.of(), List.of(), null, null));
        Moment m = momentRows.stream().filter(x -> x.getId().equals(created.get("id"))).findFirst().orElseThrow();
        assertThat(m.getStartAt()).isEqualTo(Instant.parse("2026-10-30T21:30:00Z"));   // 18:30 em São Paulo, não 00:00
        assertThat(m.getEndAt()).isEqualTo(Instant.parse("2026-10-31T02:59:00Z"));
        assertThat(m.getTimezone()).isEqualTo("America/Sao_Paulo");
        assertThat(m.getStatus()).isEqualTo(MomentStatus.SCHEDULED);                    // ainda não começou (agora = 25/10)
        assertThat(m.getVisibility()).isEqualTo(MomentVisibility.GROUP);
    }

    @Test
    void parseDeDataHoraRespeitaOffsetOuFusoDoMomento() {
        java.time.ZoneId sp = java.time.ZoneId.of("America/Sao_Paulo");
        assertThat(MomentService.parseInstant("2026-11-09T18:30", "startAt", sp)).isEqualTo(Instant.parse("2026-11-09T21:30:00Z"));
        assertThat(MomentService.parseInstant("2026-11-09T18:30:15", "startAt", sp)).isEqualTo(Instant.parse("2026-11-09T21:30:15Z"));
        assertThat(MomentService.parseInstant("2026-11-09T18:30", "startAt", java.time.ZoneId.of("Asia/Tokyo"))).isEqualTo(Instant.parse("2026-11-09T09:30:00Z"));
        assertThat(MomentService.parseInstant("2026-11-09T18:30:00Z", "startAt", sp)).isEqualTo(Instant.parse("2026-11-09T18:30:00Z"));
        assertThat(MomentService.parseInstant("2026-11-09T18:30-03:00", "startAt", java.time.ZoneId.of("UTC"))).isEqualTo(Instant.parse("2026-11-09T21:30:00Z"));
        assertThat(MomentService.parseInstant("2026-11-09", "startAt", sp)).isEqualTo(Instant.parse("2026-11-09T03:00:00Z"));
        assertThatThrownBy(() -> MomentService.parseInstant("09/11/2026 18:30", "startAt", sp)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> MomentService.parseInstant(" ", "startAt", sp)).isInstanceOf(ApiException.class);
    }

    private MomentService.AdminMomentRequest adminRequest(String season, String start, String end, String tz) {
        return new MomentService.AdminMomentRequest(null, "Denim Week 2027", null, "Jeans que você já tem.", null, "COMMUNITY", "FASHIONAI", null,
                start, end, tz, "GLOBAL", "PUBLIC", "", "", "", season, Map.of("accent", "#2D55C9"), null, null, false, false, "", "", "", true, 20, 1.0,
                null, List.of("streetwear"), List.of(), List.of("blue"), null, null, null, null, null, "", null);
    }

    @Test
    void adminSalvaComEstacaoVaziaELimpaEstacaoExistente() {
        Map<String, Object> created = service.adminSave(admin, null, adminRequest("", "2027-11-08T00:00", "2027-11-15T00:00", "America/Sao_Paulo"));
        Moment m = momentRows.stream().filter(x -> x.getId().equals(created.get("id"))).findFirst().orElseThrow();
        assertThat(m.getSeason()).isNull();
        assertThat(m.getStartAt()).isEqualTo(Instant.parse("2027-11-08T03:00:00Z"));
        service.adminSave(admin, m.getId(), adminRequest("winter", "2027-11-08T00:00", "2027-11-15T00:00", "America/Sao_Paulo"));
        assertThat(m.getSeason()).isEqualTo(br.com.fashionai.domain.model.enums.Season.WINTER);
        service.adminSave(admin, m.getId(), adminRequest("", "2027-11-08T00:00", "2027-11-15T00:00", "America/Sao_Paulo"));
        assertThat(m.getSeason()).isNull();
        // valor desconhecido vira 400 (antes: IllegalArgumentException → 500)
        assertThatThrownBy(() -> service.adminSave(admin, m.getId(), adminRequest("MONSOON", "2027-11-08T00:00", "2027-11-15T00:00", "America/Sao_Paulo")))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(400));
    }

    @Test
    void adminEditarSemMexerNasDatasNaoDeslocaOsHorarios() {
        // o formulário devolve a hora de parede no fuso do Momento (03:00Z = 00:00 em São Paulo) junto com o fuso
        Map<String, Object> created = service.adminSave(admin, null, adminRequest("", "2027-11-08T00:00", "2027-11-15T00:00", "America/Sao_Paulo"));
        Moment m = momentRows.stream().filter(x -> x.getId().equals(created.get("id"))).findFirst().orElseThrow();
        for (int i = 0; i < 3; i++) {
            service.adminSave(admin, m.getId(), adminRequest("", "2027-11-08T00:00", "2027-11-15T00:00", "America/Sao_Paulo"));
        }
        assertThat(m.getStartAt()).isEqualTo(Instant.parse("2027-11-08T03:00:00Z"));
        assertThat(m.getEndAt()).isEqualTo(Instant.parse("2027-11-15T03:00:00Z"));
        // trocar o fuso no mesmo save reinterpreta a hora de parede no fuso novo
        service.adminSave(admin, m.getId(), adminRequest("", "2027-11-08T00:00", "2027-11-15T00:00", "Europe/Lisbon"));
        assertThat(m.getStartAt()).isEqualTo(Instant.parse("2027-11-08T00:00:00Z"));
    }
}
