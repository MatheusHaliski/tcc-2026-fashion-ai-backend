package br.com.fashionai.application.service;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair.CbcStory;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairChallengeGroupRepository;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.FlairChallengeSubmissionRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * FLAIR-UT F5 · §14 — Desafios de Montagem (Card Building Challenges) dentro dos Momentos.
 *
 * <p>O desafio é um cenário com vagas; a pessoa monta com as próprias cartas FLAIR e o servidor confere requisitos,
 * sintonia e escreve a história ({@link CbcRules}, {@link CbcStory}). Entregar é atômico: valida de novo, bloqueia as
 * cartas como memória (D7), grava a entrega, lança os pontos pelo ledger idempotente e registra a participação no
 * Momento. Regras de O Império do Efêmero aplicadas aqui: E1–E2 (janela do Momento; encerrado vira Memória), S3
 * (pontos previstos antes de entregar), I1–I2 (comunidade só depois de se expressar; leituras raras), R1/P2/A1
 * (validações da administração).</p>
 *
 * <p>Facade (R82): o serviço continua o único bean e dono de {@code @Transactional}; janela, visões, montagem, leituras,
 * entrega, Momento privado e administração ficam em colaboradores package-private que compartilham o mesmo relógio.</p>
 */
@Service
public class FlairChallengeService {
    public static final int COMMUNITY_MAX = 12;
    public static final int PRIVATE_MAX_POINTS = 15;
    public static final int PRIVATE_MAX_PER_MOMENT = 3;
    public static final int REDISCOVERY_BONUS = 10;
    public static final double RARE_READING = 0.15;

    public static final String OPEN = "OPEN";
    public static final String UPCOMING = "UPCOMING";
    public static final String ENDED = "ENDED";
    static final String HIDDEN = "HIDDEN";

    private final FlairChallengeClock clock = new FlairChallengeClock();
    private final FlairChallengeWindows windows;
    private final FlairChallengeReads reads;
    private final FlairChallengeSubmissions deliveries;
    private final FlairPrivateChallenges privates;
    private final FlairChallengeAdmin administration;

    public FlairChallengeService(FlairChallengeRepository challenges, FlairChallengeGroupRepository groups,
                                 FlairChallengeSubmissionRepository submissions, FlairCardInstanceRepository cards,
                                 WardrobeItemRepository pieces, MomentRepository moments, MomentService momentService,
                                 FaiPointsService points, UserAchievementRepository achievements, UserRepository users,
                                 FlairCollectionService collection, Guard guard, AtelierRewardSystem atelier) {
        this.windows = new FlairChallengeWindows(challenges, moments, momentService);
        FlairChallengeViews views = new FlairChallengeViews(submissions, groups, achievements);
        FlairChallengeBuilds builds = new FlairChallengeBuilds(cards, pieces, windows, clock);
        this.reads = new FlairChallengeReads(challenges, groups, submissions, cards, users, moments, momentService, collection, windows,
                views, builds, clock);
        this.deliveries = new FlairChallengeSubmissions(guard, challenges, groups, submissions, cards, points, achievements, momentService,
                atelier, windows, views, builds, clock);
        this.privates = new FlairPrivateChallenges(guard, challenges, moments, momentService, windows, views, clock);
        this.administration = new FlairChallengeAdmin(guard, challenges, moments, windows, views, clock);
    }

    public void useClock(Clock clock) {
        this.clock.use(clock);
    }

    // ================================================================== janela (E1–E3)
    public record Window(String status, Map<String, Object> time) {
    }

    Window window(FlairChallenge c, Moment m, Instant now) {
        return windows.window(c, m, now);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(CurrentUser viewer, String momentSlug) {
        return reads.list(viewer, momentSlug);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> detail(CurrentUser viewer, String idOrSlug) {
        return reads.detail(viewer, idOrSlug);
    }

    // ================================================================== conferir e entregar
    public record BuildRequest(Map<String, UUID> slots, String interpretation) {
    }

    record Build(FlairChallenge challenge, Moment moment, Window window, List<CbcRules.Slot> slots, List<CbcStory.SlotText> texts,
                 Map<String, FlairCardInstance> placed, CbcRules.Evaluation evaluation, List<Map<String, Object>> story, String interpretation) {
    }

    @Transactional(readOnly = true)
    public Map<String, Object> check(CurrentUser user, String idOrSlug, BuildRequest req) {
        return deliveries.check(user, idOrSlug, req);
    }

    @Transactional
    public Map<String, Object> submit(CurrentUser user, String idOrSlug, BuildRequest req) {
        return deliveries.submit(user, idOrSlug, req);
    }

    // ================================================================== pontos (S3, C1, C3)
    public record Line(String action, int points, String ref, String label) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("action", action);
            m.put("points", points);
            m.put("ref", ref);
            m.put("label", label);
            return m;
        }
    }

    // ================================================================== Momento privado de grupo
    public record PrivateChallengeRequest(String template) {
    }

    @Transactional
    public Map<String, Object> addToPrivateMoment(CurrentUser user, UUID momentId, PrivateChallengeRequest req) {
        return privates.addToPrivateMoment(user, momentId, req);
    }

    // ================================================================== administração (sem deploy)
    public record AdminChallengeRequest(String slug, String name, Map<String, String> names, String description, Map<String, String> descriptions,
                                        String scenario, String difficulty, String status, String moment, String startAt, String endAt,
                                        List<Map<String, Object>> slots, List<Map<String, Object>> requirements, List<String> themeTags,
                                        Integer points, Integer repeatLimit, String groupCode, Boolean locksCards, Integer sortOrder) {
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> adminList(CurrentUser admin) {
        return administration.adminList(admin);
    }

    @Transactional
    public Map<String, Object> adminSave(CurrentUser admin, UUID id, AdminChallengeRequest r) {
        return administration.adminSave(admin, id, r);
    }
}
