package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.event.TransactionPhase;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeTemplate;
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
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * RF36 — Desafios & Games do Guarda-Roupa (03-desafios-e-games.md). Modos Solo, Equipe (metas proporcionais),
 * Duelo (resultado objetivo ou votação às cegas) e Comunidade. Progresso verificável, sempre a partir de dados
 * reais do sistema (CA10) — não existe "marcar como feito". Limite de 3 ativos (CA06), convites só para quem o
 * usuário segue ou para quem usou a Chave do Quarto (CA04), aceite em 48 h, sem notificações de culpa (ETI-02).
 *
 * <p>Facade (R82): o serviço continua o único bean, dono de {@code @Transactional}, {@code @Scheduled} e dos ouvintes
 * {@code @TransactionalEventListener(AFTER_COMMIT)}; cada caso de uso fica num colaborador montado por {@link ChallengeParts}.</p>
 */
@Service
public class ChallengeService implements RoomService.DecorationsProvider, MirrorService.PieceRestrictionProvider {
    public static final int MAX_ACTIVE = 3;
    public static final Duration ACCEPT_WINDOW = Duration.ofHours(48);
    public static final int NOTE_MAX = 80;
    public static final List<String> MODES = List.of("SOLO", "EQUIPE", "DUELO", "COMUNIDADE");
    /** §6 — 6 emojis fixos. */
    public static final List<String> REACTIONS = List.of("👏", "🔥", "✨", "💪", "😍", "🙌");
    /** §6 — lista de frases prontas (o campo livre de 80 caracteres passa pela moderação). */
    public static final List<String> PRESET_NOTES = List.of(Msg.k("challenge.arrasou_no_look"), Msg.k("challenge.bora_que_da"), Msg.k("challenge.essa_combinacao_ficou_incrivel"),
            Msg.k("challenge.amei_a_ideia"), Msg.k("challenge.vamos_juntos_ate_o_fim"), Msg.k("challenge.inspirou_meu_look_de_hoje"));
    public static final String RASCUNHO = "RASCUNHO", AGUARDANDO = "AGUARDANDO", ATIVO = "ATIVO", CONCLUIDO = "CONCLUIDO", EXPIRADO = "EXPIRADO";
    public static final String P_CONVIDADO = "CONVIDADO", P_ATIVO = "ATIVO", P_RECUSOU = "RECUSOU", P_SAIU = "SAIU", P_CONCLUIU = "CONCLUIU",
            P_CANCELADO = "CANCELADO";

    public record Progress(int value, int target, double fraction, int best, String label, int pending) {
    }

    public record StartRequest(String code, String mode, Map<String, Object> params, List<UUID> invitees, Map<String, String> teams,
                               Boolean draft, Boolean photoConsent) {
    }

    public record ProposalRequest(String name, List<Map<String, Object>> blocks, List<String> modes, Integer durationDays) {
    }

    record MirrorUpload(UUID photoId, MediaStoragePort.StoredObject stored) {
    }

    private final ChallengeParts parts;

    public ChallengeService(ChallengeTemplateRepository templates, ChallengeInstanceRepository instances,
                            ChallengeParticipantRepository participants, ChallengeEventRepository evidence, ChallengeNoteRepository notes,
                            ChallengeVoteRepository votes, WardrobeItemRepository pieces, SchemeRepository schemes,
                            SchemeItemRepository schemeItems, DailyLookRepository dailyLooks, PieceUsageDiaryEntryRepository diary,
                            FollowRepository follows, UserRepository users, StyleDnaRepository dnas, RoomService room,
                            FaiPointsService points, NotificationService notifications, MediaService media, Guard guard, Audit audit,
            SideEffectRunner sideEffects) {
        this.parts = new ChallengeParts(templates, instances, participants, evidence, notes, votes, pieces, schemes, schemeItems,
                dailyLooks, diary, follows, users, dnas, room, points, notifications, media, guard, audit, sideEffects);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> catalog(CurrentUser user) {
        return parts.catalog.catalog(user);
    }

    @Transactional
    public Map<String, Object> start(CurrentUser user, StartRequest req) {
        return parts.startFlow.start(user, req);
    }

    @Transactional
    public Map<String, Object> launchDraft(CurrentUser user, UUID id, List<UUID> invitees, Map<String, String> teams) {
        return parts.startFlow.launchDraft(user, id, invitees, teams);
    }

    @Transactional
    public Map<String, Object> accept(CurrentUser user, UUID id, Boolean photoConsent) {
        return parts.membership.accept(user, id, photoConsent);
    }

    @Transactional
    public Map<String, Object> decline(CurrentUser user, UUID id) {
        return parts.membership.decline(user, id);
    }

    @Transactional
    public Map<String, Object> startNow(CurrentUser user, UUID id) {
        return parts.membership.startNow(user, id);
    }

    @Transactional
    public Map<String, Object> leave(CurrentUser user, UUID id) {
        return parts.membership.leave(user, id);
    }

    @Transactional
    public Map<String, Object> cancel(CurrentUser user, UUID id) {
        return parts.membership.cancel(user, id);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSchemeSaved(DomainEvents.SchemeSaved ev) {
        parts.listeners.onSchemeSaved(ev);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onDailyLook(DomainEvents.DailyLookRegistered ev) {
        parts.listeners.onDailyLook(ev);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onMirror(DomainEvents.MirrorAction ev) {
        parts.listeners.onMirror(ev);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPieceCreated(DomainEvents.PieceCreated ev) {
        parts.listeners.onPieceCreated(ev);
    }

    @Transactional
    public void conclude(ChallengeInstance i, ChallengeTemplate t) {
        parts.conclusion.conclude(i, t);
    }

    @Scheduled(cron = "0 */15 * * * *", zone = "America/Sao_Paulo")
    @Transactional
    public Map<String, Integer> tick() {
        return parts.lifecycle.tick();
    }

    @Transactional
    public Map<String, Object> detail(CurrentUser user, UUID id) {
        return parts.views.detail(user, id);
    }

    @Transactional
    public Map<String, Object> submitEntry(CurrentUser user, UUID id, UUID schemeId) {
        return parts.social.submitEntry(user, id, schemeId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> voteFeed(CurrentUser user) {
        return parts.social.voteFeed(user);
    }

    @Transactional
    public Map<String, Object> vote(CurrentUser user, UUID id, UUID entrySchemeId) {
        return parts.social.vote(user, id, entrySchemeId);
    }

    @Transactional
    public Map<String, Object> note(CurrentUser user, UUID id, String preset, String free) {
        return parts.social.note(user, id, preset, free);
    }

    @Transactional
    public Map<String, Object> react(CurrentUser user, UUID id, String emoji) {
        return parts.social.react(user, id, emoji);
    }

    @Transactional
    public Map<String, Object> realMirror(CurrentUser user, UUID id, byte[] bytes) {
        return parts.mirror.realMirror(user, id, bytes);
    }

    @Transactional(readOnly = true)
    public byte[] mirrorPhoto(CurrentUser user, UUID id, UUID photoId) {
        return parts.mirror.mirrorPhoto(user, id, photoId);
    }

    @Transactional
    public Map<String, Object> confirmRealMirror(CurrentUser user, UUID id, UUID memberId, LocalDate day) {
        return parts.mirror.confirmRealMirror(user, id, memberId, day);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> resultCard(CurrentUser user, UUID id) {
        return parts.views.resultCard(user, id);
    }

    @Transactional
    public Map<String, Object> propose(CurrentUser user, ProposalRequest req) {
        return parts.proposals.propose(user, req);
    }

    @Transactional
    public Map<String, Object> promote(CurrentUser admin, String code) {
        return parts.proposals.promote(admin, code);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> mine(CurrentUser user) {
        return parts.slots.mine(user);
    }

    @Override
    public List<Map<String, Object>> decorations(UUID userId) {
        return parts.integrations.decorations(userId);
    }

    @Override
    public Optional<Restriction> restriction(UUID userId) {
        return parts.integrations.restriction(userId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> activeSummary(UUID userId) {
        return parts.integrations.activeSummary(userId);
    }
}
