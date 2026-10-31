package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.FlairTeamMember;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentChallenge;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.MomentVote;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.MomentVoteDimension;
import br.com.fashionai.domain.repository.FlairTeamMemberRepository;
import br.com.fashionai.domain.repository.FlairTeamRepository;
import br.com.fashionai.domain.repository.MomentChallengeRepository;
import br.com.fashionai.domain.repository.MomentParticipationRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.MomentSubmissionRepository;
import br.com.fashionai.domain.repository.MomentVoteRepository;
import org.junit.jupiter.api.BeforeEach;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

/** Montagem comum dos testes do MomentService: repositórios em memória (Kit/World), relógio fixo e Guard/pontos simulados. */
abstract class MomentServiceFixture {
    static final Instant NOW = Instant.parse("2026-10-25T12:00:00Z");

    Kit kit;
    World w;
    MomentService svc;
    Guard guard;
    FaiPointsService points;
    NotificationService notifications;
    HypeQueryService hype;
    MomentRepository moments;
    MomentParticipationRepository parts;
    MomentSubmissionRepository subs;
    MomentVoteRepository votes;
    MomentChallengeRepository challenges;
    CurrentUser me;
    CurrentUser rival;
    CurrentUser friend;
    final Map<UUID, HypeScoreCurrent> hypeRows = new HashMap<>();

    @BeforeEach
    void montar() {
        kit = new Kit();
        w = new World(kit);
        guard = kit.dep(Guard.class);
        points = kit.dep(FaiPointsService.class);
        notifications = kit.dep(NotificationService.class);
        hype = kit.dep(HypeQueryService.class);
        lenient().when(guard.deny(any(), anyString(), anyString())).thenAnswer(i -> ApiException.forbidden(i.getArgument(2)));
        lenient().when(guard.canView(any(), any(), any())).thenAnswer(i -> i.getArgument(2) == br.com.fashionai.domain.model.enums.Visibility.PUBLIC);
        lenient().when(points.award(any(), anyString(), anyString(), anyString(), any()))
                .thenReturn(new FaiPointsService.Award(true, 10, false, null, null, false));
        lenient().when(hype.currentOf(any(), any())).thenAnswer(i -> {
            Map<UUID, HypeScoreCurrent> out = new HashMap<>();
            for (Object id : (Collection<?>) i.getArgument(1)) {
                if (hypeRows.containsKey(id)) {
                    out.put((UUID) id, hypeRows.get(id));
                }
            }
            return out;
        });
        svc = kit.build(MomentService.class);
        svc.useClock(Clock.fixed(NOW, ZoneOffset.UTC));
        moments = kit.dep(MomentRepository.class);
        parts = kit.dep(MomentParticipationRepository.class);
        subs = kit.dep(MomentSubmissionRepository.class);
        votes = kit.dep(MomentVoteRepository.class);
        challenges = kit.dep(MomentChallengeRepository.class);
        me = Kit.as(w.me);
        rival = Kit.as(w.rival);
        friend = Kit.as(w.friend);
    }

    /** Momento público ativo (começou ontem, termina em 3 dias). */
    Moment active(String slug) {
        return moment(slug, NOW.minus(Duration.ofDays(1)), NOW.plus(Duration.ofDays(3)), MomentStatus.ACTIVE);
    }

    Moment moment(String slug, Instant start, Instant end, MomentStatus status) {
        Moment m = new Moment();
        m.setSlug(slug);
        m.setName("Momento " + slug);
        m.setStartAt(start);
        m.setEndAt(end);
        m.setStatus(status);
        m.setStyleTags("streetwear,basic");
        m.setColorTags("white,black");
        m.setOccasionTags("casual");
        m.setCreatedByUserId(UUID.randomUUID());
        return moments.save(m);
    }

    FlairTeam team(String name, User... people) {
        FlairTeam t = new FlairTeam();
        t.setName(name);
        t.setCode("T" + name.length());
        t.setColor("#123456");
        t = kit.save(FlairTeamRepository.class, t);
        for (User u : people) {
            FlairTeamMember mm = new FlairTeamMember();
            mm.setTeam(t);
            mm.setUser(u);
            mm.setRole("MEMBER");
            kit.save(FlairTeamMemberRepository.class, mm);
        }
        return t;
    }

    Moment groupMoment(String slug, FlairTeam t) {
        Moment m = active(slug);
        m.setGroupId(t.getId());
        m.setVisibility(MomentVisibility.GROUP);
        return moments.save(m);
    }

    MomentParticipation part(Moment m, User u, MomentParticipationStatus status) {
        MomentParticipation p = new MomentParticipation();
        p.setMomentId(m.getId());
        p.setUserId(u.getId());
        p.setStatus(status);
        p.setJoinedAt(status == MomentParticipationStatus.INTERESTED ? null : NOW.minus(Duration.ofHours(5)));
        return parts.save(p);
    }

    MomentSubmission submission(Moment m, User u, Scheme s, int votesCount, Integer match) {
        MomentSubmission sub = new MomentSubmission();
        sub.setMomentId(m.getId());
        sub.setUserId(u.getId());
        sub.setSchemeId(s.getId());
        sub.setVoteCount(votesCount);
        sub.setMatchScore(match);
        sub.setMatchJson("{\"interpretation\":\"dark\",\"reasons\":[\"style:streetwear\"]}");
        sub.setRediscoveredJson("[\"" + UUID.randomUUID() + "\"]");
        sub.setSubmittedAt(NOW.minus(Duration.ofHours(votesCount + 1L)));
        sub.setHypeAtSubmission(40 + votesCount);
        return subs.save(sub);
    }

    MomentVote vote(Moment m, MomentSubmission s, User voter, MomentVoteDimension d) {
        MomentVote v = new MomentVote();
        v.setMomentId(m.getId());
        v.setSubmissionId(s.getId());
        v.setVoterId(voter.getId());
        v.setDimension(d);
        return votes.save(v);
    }

    MomentChallenge challenge(Moment m, String code) {
        MomentChallenge c = new MomentChallenge();
        c.setMomentId(m.getId());
        c.setCode(code);
        c.setName("Desafio " + code);
        c.setStyleTags("streetwear");
        return challenges.save(c);
    }

    void hypeOf(UUID entity, UUID owner, double score, boolean publicEligible) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(HypeEntityType.SCHEME);
        c.setEntityId(entity);
        c.setOwnerId(owner);
        c.setScore(BigDecimal.valueOf(score));
        c.setPublicEligible(publicEligible);
        hypeRows.put(entity, c);
    }

    List<MomentParticipation> allParts() {
        return MemoryRepository.rows(parts);
    }

    /** Confere o código do erro e devolve o status HTTP (compartilhado por MomentServiceAcoesTest e MomentServiceComunidadeTest). */
    static int code(Throwable e, String expected) {
        assertThat(((ApiException) e).code()).isEqualTo(expected);
        return ((ApiException) e).status();
    }

    static Map<String, Object> map(Object o) {
        return World.map(o);
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> list(Object o) {
        return (List<Map<String, Object>>) o;
    }
}
