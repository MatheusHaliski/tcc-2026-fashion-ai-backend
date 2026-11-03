package br.com.fashionai.application.moments;

import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.domain.repository.FlairTeamMemberRepository;
import br.com.fashionai.domain.repository.FlairTeamRepository;
import br.com.fashionai.domain.repository.MomentChallengeRepository;
import br.com.fashionai.domain.repository.MomentParticipationRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.MomentSubmissionRepository;
import br.com.fashionai.domain.repository.MomentVoteRepository;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.Clock;

/**
 * Dependências injetadas no MomentService e o relógio do servidor, entregues aos colaboradores. O relógio é o único
 * estado mutável ({@code MomentService.useClock}, só em testes) e é lido a cada chamada, como antes.
 */
final class MomentContext {
    final MomentRepository moments;
    final MomentChallengeRepository challenges;
    final MomentParticipationRepository participations;
    final MomentSubmissionRepository submissions;
    final MomentVoteRepository votes;
    final SchemeRepository schemes;
    final SchemeItemRepository schemeItems;
    final WardrobeItemRepository pieces;
    final UserRepository users;
    final FlairTeamRepository teams;
    final FlairTeamMemberRepository members;
    final UserAchievementRepository achievements;
    final PieceUsageDiaryEntryRepository diary;
    final FaiPointsService points;
    final NotificationService notifications;
    final Guard guard;
    final HypeQueryService hypeQuery;
    Clock clock = Clock.systemUTC();

    MomentContext(MomentRepository moments, MomentChallengeRepository challenges, MomentParticipationRepository participations,
                  MomentSubmissionRepository submissions, MomentVoteRepository votes, SchemeRepository schemes, SchemeItemRepository schemeItems,
                  WardrobeItemRepository pieces, UserRepository users, FlairTeamRepository teams, FlairTeamMemberRepository members,
                  UserAchievementRepository achievements, PieceUsageDiaryEntryRepository diary, FaiPointsService points,
                  NotificationService notifications, Guard guard, HypeQueryService hypeQuery) {
        this.moments = moments;
        this.challenges = challenges;
        this.participations = participations;
        this.submissions = submissions;
        this.votes = votes;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.users = users;
        this.teams = teams;
        this.members = members;
        this.achievements = achievements;
        this.diary = diary;
        this.points = points;
        this.notifications = notifications;
        this.guard = guard;
        this.hypeQuery = hypeQuery;
    }
}
