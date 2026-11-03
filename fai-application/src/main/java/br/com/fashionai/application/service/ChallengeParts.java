package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.repository.ChallengeEventRepository;
import br.com.fashionai.domain.repository.ChallengeInstanceRepository;
import br.com.fashionai.domain.repository.ChallengeNoteRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;
import br.com.fashionai.domain.repository.ChallengeVoteRepository;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

/**
 * Montagem dos subsistemas que o {@link ChallengeService} (Facade) coordena: cada colaborador recebe só os repositórios
 * e serviços de que precisa e os colaboradores de que depende, numa ordem sem ciclos. Nada aqui é bean do Spring; a
 * transação, os ouvintes e o agendamento continuam nos métodos do serviço (R82).
 */
final class ChallengeParts {
    final ChallengeParticipations slots;
    final ChallengeConclusion conclusion;
    final ChallengeLifecycle lifecycle;
    final ChallengeRealMirror mirror;
    final ChallengeDetailView views;
    final ChallengeStartFlow startFlow;
    final ChallengeMembership membership;
    final ChallengeEvidenceListeners listeners;
    final ChallengeSocial social;
    final ChallengeCatalogView catalog;
    final ChallengeProposals proposals;
    final ChallengeIntegrations integrations;

    ChallengeParts(ChallengeTemplateRepository templates, ChallengeInstanceRepository instances,
                   ChallengeParticipantRepository participants, ChallengeEventRepository evidence, ChallengeNoteRepository notes,
                   ChallengeVoteRepository votes, WardrobeItemRepository pieces, SchemeRepository schemes,
                   SchemeItemRepository schemeItems, DailyLookRepository dailyLooks, PieceUsageDiaryEntryRepository diary,
                   FollowRepository follows, UserRepository users, StyleDnaRepository dnas, RoomService room,
                   FaiPointsService points, NotificationService notifications, MediaService media, Guard guard, Audit audit,
                   SideEffectRunner sideEffects) {
        ChallengeStore store = new ChallengeStore(templates, instances, participants, evidence);
        slots = new ChallengeParticipations(templates, instances, participants);
        ChallengeProgressMeter progress = new ChallengeProgressMeter(evidence, schemes, schemeItems, dailyLooks);
        ChallengeRuleEvaluator evaluator = new ChallengeRuleEvaluator(dnas, diary);
        conclusion = new ChallengeConclusion(instances, participants, evidence, votes, users, points, notifications, progress);
        lifecycle = new ChallengeLifecycle(templates, instances, participants, pieces, room, notifications, store, conclusion);
        mirror = new ChallengeRealMirror(guard, users, participants, evidence, media, store, conclusion);
        views = new ChallengeDetailView(guard, templates, participants, users, notes, votes, evidence, schemes, schemeItems, store,
                progress, mirror);
        ChallengeParams parameters = new ChallengeParams(pieces, dnas);
        startFlow = new ChallengeStartFlow(instances, participants, follows, room, notifications, guard, audit, store, slots, lifecycle,
                parameters, views);
        membership = new ChallengeMembership(instances, participants, guard, store, slots, lifecycle, views);
        listeners = new ChallengeEvidenceListeners(sideEffects, pieces, participants, store, evaluator, conclusion);
        social = new ChallengeSocial(guard, points, instances, templates, participants, evidence, votes, notes, schemes, schemeItems,
                store, conclusion, views);
        catalog = new ChallengeCatalogView(templates, instances, participants, users, slots);
        proposals = new ChallengeProposals(templates, guard, audit);
        integrations = new ChallengeIntegrations(evidence, schemes, pieces, store, progress);
    }
}
