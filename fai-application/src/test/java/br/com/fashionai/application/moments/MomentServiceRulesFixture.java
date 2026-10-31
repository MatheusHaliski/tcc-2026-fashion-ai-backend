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

import java.lang.reflect.Proxy;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Montagem comum de MomentServiceRulesTest e MomentServiceRulesReviewTest: repositórios simulados por proxy (sem
 * contexto Spring), Guard sem seguidores e relógio fixo. Template Method: o {@code @BeforeEach} herdado prepara o
 * cenário e as subclasses só declaram os testes.
 */
abstract class MomentServiceRulesFixture {
    final List<Moment> momentRows = new ArrayList<>();
    final List<MomentParticipation> partRows = new ArrayList<>();
    final List<MomentSubmission> subRows = new ArrayList<>();
    final List<MomentVote> voteRows = new ArrayList<>();
    final List<FlairTeamMember> memberRows = new ArrayList<>();
    final List<User> userRows = new ArrayList<>();
    final List<Scheme> schemeRows = new ArrayList<>();
    final List<MomentChallenge> challengeRows = new ArrayList<>();
    MomentService service;
    final Instant now = Instant.parse("2026-10-25T12:00:00Z");
    final UUID teamId = UUID.randomUUID();
    final CurrentUser ana = user("ana", "USER");
    final CurrentUser bia = user("bia", "USER");
    final CurrentUser admin = user("root", "ADMIN");
    final CurrentUser carla = user("carla", "USER");

    static CurrentUser user(String name, String role) {
        return new CurrentUser(UUID.randomUUID(), name, role, ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    }

    @SuppressWarnings("unchecked")
    static <T> T proxy(Class<T> type, java.util.function.BiFunction<String, Object[], Object> body) {
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

    void member(UUID userId) {
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

    Moment moment(String slug, MomentVisibility vis, UUID groupId, MomentStatus status) {
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

    User userOf(CurrentUser c) {
        return userRows.stream().filter(u -> u.getId().equals(c.id())).findFirst().orElseGet(() -> {
            User u = new User();
            u.assignId(c.id());
            u.setUsername(c.username());
            u.setProfileType(ProfileType.PESSOAL);
            userRows.add(u);
            return u;
        });
    }

    MomentSubmission submit(Moment m, CurrentUser who, String title, Visibility vis, int votes, int match) {
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
}
