package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.event.TransactionPhase;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.ChallengeEvent;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeNote;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.ChallengeVote;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.model.enums.SchemeStatus;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.IsoFields;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF36 — Desafios & Games do Guarda-Roupa (03-desafios-e-games.md). Modos Solo, Equipe (metas proporcionais),
 * Duelo (resultado objetivo ou votação às cegas) e Comunidade. Progresso verificável, sempre a partir de dados
 * reais do sistema (CA10) — não existe "marcar como feito". Limite de 3 ativos (CA06), convites só para quem o
 * usuário segue ou para quem usou a Chave do Quarto (CA04), aceite em 48 h, sem notificações de culpa (ETI-02).
 */
@Service
public class ChallengeService implements RoomService.DecorationsProvider, MirrorService.PieceRestrictionProvider {
    private SideEffectRunner sideEffects;
    private static final Logger log = LoggerFactory.getLogger(ChallengeService.class);
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
    static final Set<String> VOTED = Set.of("RUNWAY_BATTLE", "GRWM");
    static final Set<String> SINGLE_SHOT = Set.of("RUNWAY_BATTLE", "GRWM", "DAILY_CHALLENGE");
    static final Map<String, String> DIM_NAMES = Map.of("C", Msg.k("common.catalogacao"), "D", "Diversidade", "U", Msg.k("common.utilizacao"), "V", "Versatilidade",
            "O", Msg.k("common.organizacao"), "R", "Descoberta", "I", "Identidade");
    /** Tema semanal da Batalha na Passarela (rodízio pela semana ISO). */
    static final List<String> RUNWAY_THEMES = List.of(Msg.k("challenge.monocromatico_total"), Msg.k("challenge.anos_2000_com_o_que"), Msg.k("challenge.old_money_do_dia_a"),
            Msg.k("challenge.festival_de_verao"), Msg.k("challenge.escritorio_criativo"), Msg.k("challenge.noite_de_gala_sem_comprar"), Msg.k("challenge.gorpcore_urbano"), Msg.k("challenge.quiet_luxury"), Msg.k("challenge.uma_peca_herdada"));
    /** DET-C04 — regras do Desafio do Dia (rodízio pelo dia do ano). */
    static final List<Map<String, Object>> DAILY_RULES = List.of(
            Map.of("text", Msg.k("challenge.uma_peca_vermelha_uma_esquecida"), "blocks", List.of(Map.of("type", "color_family", "value", "Vermelho"),
                    Map.of("type", "state", "value", "forgotten"))),
            Map.of("text", Msg.k("challenge.look_monocromatico"), "blocks", List.of(Map.of("type", "monochrome", "value", true))),
            Map.of("text", Msg.k("challenge.uma_peca_garimpada_herdada_ou"), "blocks", List.of(Map.of("type", "origin", "value", "GARIMPADA|HERDADA|PRESENTE"))),
            Map.of("text", Msg.k("challenge.tres_familias_de_cor_diferentes"), "blocks", List.of(Map.of("type", "distinct_colors", "value", 3))),
            Map.of("text", Msg.k("challenge.uma_peca_que_voce_nao"), "blocks", List.of(Map.of("type", "unused_days", "value", 30),
                    Map.of("type", "category", "value", "accessory_piece"))),
            Map.of("text", Msg.k("challenge.so_pecas_neutras"), "blocks", List.of(Map.of("type", "neutral_only", "value", true))),
            Map.of("text", Msg.k("challenge.uma_camada_por_cima_uma"), "blocks", List.of(Map.of("type", "slot", "value", "outer_layer"),
                    Map.of("type", "color_family", "value", "Azul"))));
    /** §7 — blocos de regra pré-definidos (sem texto livre, sempre verificáveis). */
    static final Set<String> RULE_BLOCK_TYPES = Set.of("color_family", "category", "origin", "state", "piece_count", "monochrome",
            "neutral_only", "distinct_colors", "unused_days", "slot");
    static final Set<String> ORIGINS = Set.of("COMPRADA", "GARIMPADA", "HERDADA", "PRESENTE", "FEITA_A_MAO", "TROCADA");

    public record Progress(int value, int target, double fraction, int best, String label, int pending) {
    }

    private final ChallengeTemplateRepository templates;
    private final ChallengeInstanceRepository instances;
    private final ChallengeParticipantRepository participants;
    private final ChallengeEventRepository evidence;
    private final ChallengeNoteRepository notes;
    private final ChallengeVoteRepository votes;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final DailyLookRepository dailyLooks;
    private final PieceUsageDiaryEntryRepository diary;
    private final FollowRepository follows;
    private final UserRepository users;
    private final StyleDnaRepository dnas;
    private final RoomService room;
    private final FaiPointsService points;
    private final NotificationService notifications;
    private final MediaService media;
    private final Guard guard;
    private final Audit audit;

    public ChallengeService(ChallengeTemplateRepository templates, ChallengeInstanceRepository instances,
                            ChallengeParticipantRepository participants, ChallengeEventRepository evidence, ChallengeNoteRepository notes,
                            ChallengeVoteRepository votes, WardrobeItemRepository pieces, SchemeRepository schemes,
                            SchemeItemRepository schemeItems, DailyLookRepository dailyLooks, PieceUsageDiaryEntryRepository diary,
                            FollowRepository follows, UserRepository users, StyleDnaRepository dnas, RoomService room,
                            FaiPointsService points, NotificationService notifications, MediaService media, Guard guard, Audit audit,
            SideEffectRunner sideEffects) {
        this.sideEffects = sideEffects;
        this.templates = templates;
        this.instances = instances;
        this.participants = participants;
        this.evidence = evidence;
        this.notes = notes;
        this.votes = votes;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dailyLooks = dailyLooks;
        this.diary = diary;
        this.follows = follows;
        this.users = users;
        this.dnas = dnas;
        this.room = room;
        this.points = points;
        this.notifications = notifications;
        this.media = media;
        this.guard = guard;
        this.audit = audit;
    }

    static LocalDate today() {
        return LocalDate.now(FaiPointsService.ZONE);
    }

    static LocalDate dateOf(Instant i) {
        return LocalDate.ofInstant(i, FaiPointsService.ZONE);
    }

    /** Referência determinística por dia (idempotência de evidências diárias — uq_ch_evt). */
    static UUID dayRef(UUID instanceId, LocalDate day) {
        return UUID.nameUUIDFromBytes((instanceId + ":" + day).getBytes(StandardCharsets.UTF_8));
    }

    static String dailyRuleText(LocalDate day) {
        return String.valueOf(DAILY_RULES.get(day.getDayOfYear() % DAILY_RULES.size()).get("text"));
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> dailyRuleBlocks(LocalDate day) {
        return (List<Map<String, Object>>) DAILY_RULES.get(day.getDayOfYear() % DAILY_RULES.size()).get("blocks");
    }

    static String runwayTheme(LocalDate day) {
        return RUNWAY_THEMES.get(day.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR) % RUNWAY_THEMES.size());
    }

    ChallengeTemplate template(String code) {
        return templates.findById(code).filter(ChallengeTemplate::isActive).orElseThrow(() -> ApiException.notFound("Desafio"));
    }

    ChallengeInstance instance(UUID id) {
        return instances.findById(id).orElseThrow(() -> ApiException.notFound("Desafio"));
    }

    // ================================================================== catálogo (CA01/CA02, anatomia do card §2.1)
    @Transactional(readOnly = true)
    public Map<String, Object> catalog(CurrentUser user) {
        Map<String, Long> playing = new HashMap<>();
        for (ChallengeInstance i : instances.findByStateIn(List.of(ATIVO))) {
            long n = participants.findByInstanceId(i.getId()).stream().filter(p -> P_ATIVO.equals(p.getStatus())).count();
            playing.merge(i.getTemplateCode(), n, Long::sum);
        }
        LocalDate d = today();
        List<Map<String, Object>> cards = new ArrayList<>();
        for (ChallengeTemplate t : templates.findByActiveTrueOrderByName()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", t.getCode());
            m.put("name", t.getName());
            m.put("rule", t.getRuleText());
            m.put("durationDays", t.getDurationDays());
            m.put("modes", Json.strings(t.getModesAllowedJson()));
            List<String> dims = Json.strings(t.getScoreDimensionsJson());
            m.put("improves", dims.stream().map(x -> DIM_NAMES.getOrDefault(x, x)).toList());
            m.put("dimensions", dims);
            m.put("effort", t.getEffort());
            m.put("effortDots", switch (t.getEffort()) {
                case "BAIXO" -> "●○○";
                case "ALTO" -> "●●●";
                default -> "●●○";
            });
            m.put("reward", Msg.t("challenge.ate_fai_pts", t.getRewardPoints()));
            m.put("rewardPoints", t.getRewardPoints());
            m.put("participants", Map.of("min", t.getMinParticipants(), "max", t.getMaxParticipants()));
            m.put("playingNow", playing.getOrDefault(t.getCode(), 0L));
            m.put("origin", t.getOrigin());
            m.put("author", t.getAuthorUserId() == null ? null : users.findById(t.getAuthorUserId()).map(User::getUsername).orElse(null));
            m.put("roomDecoration", t.getRoomDecoration());
            if (t.getCode().equals("DAILY_CHALLENGE")) {
                m.put("todayRule", dailyRuleText(d));
            }
            if (t.getCode().equals("RUNWAY_BATTLE")) {
                m.put("weeklyTheme", runwayTheme(d));
            }
            if (t.getCode().equals("WEAR_WHAT_YOU_HAVE") && d.getMonthValue() == 4) {
                m.put("highlight", Msg.t("challenge.fashion_revolution_week_vista_o"));
            }
            cards.add(m);
        }
        long active = activeCount(user.id());
        return Map.of("challenges", cards, "activeCount", active, "maxActive", MAX_ACTIVE, "reactions", REACTIONS, "presetNotes", PRESET_NOTES,
                "note", Msg.t("challenge.desafios_comparam_o_uso_do"));
    }

    long activeCount(UUID userId) {
        List<ChallengeParticipant> mine = participants.findByUserIdAndStatusIn(userId, List.of(P_ATIVO));
        if (mine.isEmpty()) {
            return 0;
        }
        Map<UUID, ChallengeInstance> byId = instances.findByIdIn(mine.stream().map(ChallengeParticipant::getInstanceId).toList()).stream()
                .collect(Collectors.toMap(ChallengeInstance::getId, i -> i));
        return mine.stream().map(p -> byId.get(p.getInstanceId())).filter(Objects::nonNull)
                .filter(i -> ATIVO.equals(i.getState()) || AGUARDANDO.equals(i.getState())).count();
    }

    void requireSlot(UUID userId) {
        if (activeCount(userId) >= MAX_ACTIVE) {
            List<Map<String, Object>> active = mineRaw(userId).stream().filter(m -> ATIVO.equals(m.get("state")) || AGUARDANDO.equals(m.get("state")))
                    .map(m -> Map.<String, Object>of("id", m.get("id"), "name", m.get("name"))).toList();
            throw new ApiException(409, "LIMITE_DESAFIOS", Msg.t("challenge.voce_ja_tem_desafios_ativos", MAX_ACTIVE),
                    Map.of("active", active));
        }
    }

    // ================================================================== criar / iniciar (CA03/CA04)
    public record StartRequest(String code, String mode, Map<String, Object> params, List<UUID> invitees, Map<String, String> teams,
                               Boolean draft, Boolean photoConsent) {
    }

    @Transactional
    public Map<String, Object> start(CurrentUser user, StartRequest req) {
        guard.requireCanCreate(user);
        ChallengeTemplate t = template(req.code());
        String mode = req.mode() == null ? "SOLO" : req.mode().toUpperCase(Locale.ROOT);
        if (!Json.strings(t.getModesAllowedJson()).contains(mode)) {
            throw ApiException.badRequest("MODO_INDISPONIVEL", Msg.t("challenge.o_desafio_nao_aceita_o", t.getName(), mode));
        }
        if (mode.equals("COMUNIDADE")) {
            return joinCommunity(user, t, req.photoConsent());
        }
        boolean draft = Boolean.TRUE.equals(req.draft());
        if (!draft) {
            requireSlot(user.id());
        }
        Map<String, Object> params = validateParams(user, t, mode, req.params() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(req.params()));
        ChallengeInstance i = new ChallengeInstance();
        i.setId(UUID.randomUUID());
        i.setTemplateCode(t.getCode());
        i.setMode(mode);
        i.setCreatedBy(user.id());
        i.setParamsJson(Json.write(params));
        i.setState(RASCUNHO);
        instances.save(i);
        ChallengeParticipant me = participant(i, user.id(), P_ATIVO, teamOf(req.teams(), user.id(), mode));
        me.setPersonalGoalJson(Json.write(personalGoal(user.id(), t, i, params, req.photoConsent())));
        participants.save(me);
        if (!draft) {
            launch(user, i, t, req.invitees(), req.teams());
        }
        audit.log(user, "DESAFIO_CRIADO", "challenge:" + i.getId(), Map.of("code", t.getCode(), "mode", mode, "state", i.getState()));
        return detail(user, i.getId());
    }

    /** Rascunho → aguardando (Equipe/Duelo) ou ativo (Solo). */
    @Transactional
    public Map<String, Object> launchDraft(CurrentUser user, UUID id, List<UUID> invitees, Map<String, String> teams) {
        ChallengeInstance i = instance(id);
        if (!i.getCreatedBy().equals(user.id())) {
            throw guard.deny(user, "challenge:" + id, Msg.t("challenge.so_quem_criou_o_desafio"));
        }
        if (!RASCUNHO.equals(i.getState())) {
            throw new ApiException(409, "ESTADO_INVALIDO", Msg.t("challenge.o_desafio_ja_foi_iniciado"));
        }
        requireSlot(user.id());
        launch(user, i, template(i.getTemplateCode()), invitees, teams);
        return detail(user, id);
    }

    void launch(CurrentUser user, ChallengeInstance i, ChallengeTemplate t, List<UUID> invitees, Map<String, String> teams) {
        if (i.getMode().equals("SOLO")) {
            activate(i, t);
            return;
        }
        List<UUID> list = invitees == null ? List.of() : invitees.stream().filter(u -> !u.equals(user.id())).distinct().toList();
        if (list.isEmpty()) {
            throw ApiException.badRequest("SEM_CONVIDADOS", Msg.t("challenge.convide_ao_menos_1_pessoa", i.getMode().toLowerCase(Locale.ROOT)));
        }
        if (list.size() + 1 > t.getMaxParticipants()) {
            throw ApiException.badRequest("PARTICIPANTES_DEMAIS", Msg.t("challenge.este_desafio_aceita_ate_participantes", t.getMaxParticipants()));
        }
        for (UUID invitee : list) {
            boolean follows = this.follows.findByFollowerIdAndFollowingId(user.id(), invitee).filter(f -> f.getStatus() == FollowStatus.ACEITO).isPresent();
            if (!follows && !room.hasKey(user.id(), invitee)) {
                throw guard.deny(user, "challenge-invite:" + invitee,
                        Msg.t("challenge.voce_so_pode_convidar_quem"));
            }
        }
        i.setState(AGUARDANDO);
        i.setAcceptDeadline(Instant.now().plus(ACCEPT_WINDOW));
        instances.save(i);
        ChallengeTemplate tpl = t;
        for (UUID invitee : list) {
            ChallengeParticipant p = participants.findByInstanceIdAndUserId(i.getId(), invitee)
                    .orElseGet(() -> participant(i, invitee, P_CONVIDADO, teamOf(teams, invitee, i.getMode())));
            p.setStatus(P_CONVIDADO);
            participants.save(p);
            notifications.notify(invitee, user.id(), NotificationType.CHALLENGE_INVITE, "CHALLENGE", i.getId(),
                    Msg.k("challenge.convidou_voce_para", user.username(), tpl.getName()),
                    tpl.getRuleText() + " · modo " + i.getMode().toLowerCase(Locale.ROOT) + ". O convite vale por 48 h.",
                    Map.of("challengeId", i.getId().toString(), "code", tpl.getCode()));
        }
    }

    static String teamOf(Map<String, String> teams, UUID userId, String mode) {
        if (!"DUELO".equals(mode) && !"EQUIPE".equals(mode)) {
            return null;
        }
        String t = teams == null ? null : teams.get(userId.toString());
        if ("EQUIPE".equals(mode)) {
            return "A";
        }
        return t == null ? null : t.toUpperCase(Locale.ROOT).startsWith("B") ? "B" : "A";
    }

    ChallengeParticipant participant(ChallengeInstance i, UUID userId, String status, String team) {
        ChallengeParticipant p = new ChallengeParticipant();
        p.setId(UUID.randomUUID());
        p.setInstanceId(i.getId());
        p.setUserId(userId);
        p.setStatus(status);
        p.setTeam(team);
        if (P_ATIVO.equals(status)) {
            p.setJoinedAt(Instant.now());
        }
        return p;
    }

    void activate(ChallengeInstance i, ChallengeTemplate t) {
        Instant now = Instant.now();
        i.setState(ATIVO);
        i.setStartsAt(now);
        Integer days = t.getDurationDays();
        Map<String, Object> params = Json.map(i.getParamsJson());
        if (days == null && params.get("duel_days") instanceof Number n) {
            days = n.intValue();
        }
        i.setEndsAt(days == null ? null : today().plusDays(days).atStartOfDay(FaiPointsService.ZONE).toInstant());
        instances.save(i);
        // metas pessoais calculadas no início (a do Segunda Chance usa o estado do acervo neste momento)
        for (ChallengeParticipant p : participants.findByInstanceId(i.getId())) {
            if (P_ATIVO.equals(p.getStatus())) {
                Map<String, Object> goal = Json.map(p.getPersonalGoalJson());
                Map<String, Object> fresh = personalGoal(p.getUserId(), t, i, params, Boolean.TRUE.equals(goal.get("photoConsent")));
                p.setPersonalGoalJson(Json.write(fresh));
                participants.save(p);
            }
        }
    }

    /** Parâmetros por desafio (ex.: as 10 peças do 10×10). */
    Map<String, Object> validateParams(CurrentUser user, ChallengeTemplate t, String mode, Map<String, Object> params) {
        switch (t.getCode()) {
            case "TEN_X_TEN" -> params.put("piece_ids", ownPieceSet(user, params.get("piece_ids"), 10, 10, "o 10×10 usa exatamente 10 peças"));
            case "CAPSULE_SEASON" -> {
                params.put("piece_ids", ownPieceSet(user, params.get("piece_ids"), 33, 33, "a Temporada Cápsula usa exatamente 33 peças"));
                int target = params.get("target_days") instanceof Number n ? n.intValue() : 60;
                params.put("target_days", Math.max(30, Math.min(90, target)));
            }
            case "SECOND_CHANCE" -> {
                int pct = params.get("percent") instanceof Number n ? n.intValue() : 30;
                params.put("percent", Math.max(10, Math.min(100, pct)));
            }
            case "NO_REPEAT" -> {
                int target = params.get("target_days") instanceof Number n ? n.intValue() : 7;
                params.put("target_days", Math.max(3, Math.min(60, target)));
                if (mode.equals("DUELO")) {
                    params.put("duel_days", params.get("duel_days") instanceof Number n ? Math.max(7, Math.min(30, n.intValue())) : 14);
                }
            }
            case "MY_SEASON" -> {
                var dna = dnas.findByUserId(user.id()).orElse(null);
                if (dna == null || (dna.getColorPalette() == null && dna.getColorSeason() == null)) {
                    throw new ApiException(409, "SEM_COLORACAO", Msg.t("challenge.minha_estacao_usa_a_cartela"), Map.of("href", "/style-dna"));
                }
            }
            case "RUNWAY_BATTLE" -> params.put("theme", runwayTheme(today()));
            case "REAL_MIRROR" -> params.put("window_minutes", 30);
            default -> {
                if ("COMMUNITY".equals(t.getOrigin()) || t.getRuleBlocksJson() != null) {
                    params.put("blocks", Json.list(t.getRuleBlocksJson()));
                }
            }
        }
        return params;
    }

    List<String> ownPieceSet(CurrentUser user, Object raw, int min, int max, String rule) {
        List<UUID> ids = new ArrayList<>();
        if (raw instanceof Collection<?> c) {
            for (Object o : c) {
                try {
                    ids.add(UUID.fromString(String.valueOf(o)));
                } catch (IllegalArgumentException ignored) {
                    // ignorado
                }
            }
        }
        List<UUID> distinct = ids.stream().distinct().toList();
        if (distinct.size() < min || distinct.size() > max) {
            throw ApiException.badRequest("PECAS_INVALIDAS", Msg.t("challenge.escolha_as_pecas_do_desafio", rule));
        }
        List<WardrobeItem> found = pieces.findByIdIn(distinct);
        if (found.size() != distinct.size() || found.stream().anyMatch(w -> !w.getUser().getId().equals(user.id())
                || w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED)) {
            throw ApiException.badRequest("PECAS_INVALIDAS", "Use somente peças do seu próprio acervo.");
        }
        return distinct.stream().map(UUID::toString).toList();
    }

    /** Meta individual proporcional ao guarda-roupa de cada membro (§1.1 regra 1). */
    Map<String, Object> personalGoal(UUID userId, ChallengeTemplate t, ChallengeInstance i, Map<String, Object> params, Boolean photoConsent) {
        Map<String, Object> goal = new LinkedHashMap<>();
        goal.put("photoConsent", Boolean.TRUE.equals(photoConsent));
        if (t.getCode().equals("SECOND_CHANCE")) {
            List<UUID> forgotten = forgottenNow(userId);
            int pct = params.get("percent") instanceof Number n ? n.intValue() : 30;
            goal.put("forgotten", forgotten.stream().map(UUID::toString).toList());
            goal.put("target", forgotten.isEmpty() ? 0 : Math.max(1, (int) Math.ceil(forgotten.size() * pct / 100.0)));
            goal.put("percent", pct);
        }
        if (t.getCode().equals("WEAR_WHAT_YOU_HAVE")) {
            goal.put("since", Instant.now().toString());
        }
        return goal;
    }

    List<UUID> forgottenNow(UUID userId) {
        LocalDate d = today();
        Map<UUID, LocalDate> last = room.lastDiaryDates(userId, d.minusYears(10));
        return pieces.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(w -> RoomService.forgotten(w, RoomService.lastUse(w, last), d)).map(WardrobeItem::getId).toList();
    }

    /** Comunidade: a mesma regra para todo mundo — uma instância compartilhada por período (dia ou semana). */
    Map<String, Object> joinCommunity(CurrentUser user, ChallengeTemplate t, Boolean photoConsent) {
        LocalDate d = today();
        String period = t.getCode().equals("DAILY_CHALLENGE") ? d.toString() : d.getYear() + "-W" + d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        ChallengeInstance i = instances.findByStateIn(List.of(ATIVO)).stream()
                .filter(x -> x.getTemplateCode().equals(t.getCode()) && "COMUNIDADE".equals(x.getMode()))
                .filter(x -> period.equals(Json.map(x.getParamsJson()).get("period"))).findFirst().orElse(null);
        if (i == null) {
            i = new ChallengeInstance();
            i.setId(UUID.randomUUID());
            i.setTemplateCode(t.getCode());
            i.setMode("COMUNIDADE");
            i.setCreatedBy(user.id());
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("period", period);
            if (t.getCode().equals("DAILY_CHALLENGE")) {
                params.put("rule", dailyRuleText(d));
                params.put("blocks", dailyRuleBlocks(d));
                params.put("number", d.getDayOfYear());
            }
            i.setParamsJson(Json.write(params));
            i.setState(ATIVO);
            i.setStartsAt(d.atStartOfDay(FaiPointsService.ZONE).toInstant());
            i.setEndsAt((t.getCode().equals("DAILY_CHALLENGE") ? d.plusDays(1) : d.with(java.time.DayOfWeek.MONDAY).plusWeeks(1))
                    .atStartOfDay(FaiPointsService.ZONE).toInstant());
            instances.save(i);
        }
        Optional<ChallengeParticipant> existing = participants.findByInstanceIdAndUserId(i.getId(), user.id());
        if (existing.isEmpty() || !P_ATIVO.equals(existing.get().getStatus())) {
            requireSlot(user.id());
            ChallengeInstance joined = i;
            ChallengeParticipant p = existing.orElseGet(() -> participant(joined, user.id(), P_ATIVO, null));
            p.setStatus(P_ATIVO);
            p.setJoinedAt(Instant.now());
            p.setLeftAt(null);
            p.setPersonalGoalJson(Json.write(personalGoal(user.id(), t, i, Json.map(i.getParamsJson()), photoConsent)));
            participants.save(p);
        }
        return detail(user, i.getId());
    }

    // ================================================================== convites, saída e cancelamento
    @Transactional
    public Map<String, Object> accept(CurrentUser user, UUID id, Boolean photoConsent) {
        ChallengeInstance i = instance(id);
        ChallengeParticipant p = participants.findByInstanceIdAndUserId(id, user.id())
                .filter(x -> P_CONVIDADO.equals(x.getStatus())).orElseThrow(() -> ApiException.notFound("Convite"));
        if (!AGUARDANDO.equals(i.getState()) || i.getAcceptDeadline() == null || i.getAcceptDeadline().isBefore(Instant.now())) {
            throw new ApiException(409, "CONVITE_EXPIRADO", Msg.t("challenge.o_prazo_de_aceite_48"));
        }
        requireSlot(user.id());
        ChallengeTemplate t = template(i.getTemplateCode());
        p.setStatus(P_ATIVO);
        p.setJoinedAt(Instant.now());
        p.setPersonalGoalJson(Json.write(personalGoal(user.id(), t, i, Json.map(i.getParamsJson()), photoConsent)));
        participants.save(p);
        maybeStartEarly(i, t);
        return detail(user, id);
    }

    @Transactional
    public Map<String, Object> decline(CurrentUser user, UUID id) {
        ChallengeParticipant p = participants.findByInstanceIdAndUserId(id, user.id())
                .filter(x -> P_CONVIDADO.equals(x.getStatus())).orElseThrow(() -> ApiException.notFound("Convite"));
        p.setStatus(P_RECUSOU);
        participants.save(p);
        ChallengeInstance i = instance(id);
        maybeStartEarly(i, template(i.getTemplateCode()));
        return Map.of("declined", true);
    }

    /** Todos responderam → começa com quem aceitou, se houver o mínimo (§3). */
    void maybeStartEarly(ChallengeInstance i, ChallengeTemplate t) {
        List<ChallengeParticipant> ps = participants.findByInstanceId(i.getId());
        boolean pending = ps.stream().anyMatch(p -> P_CONVIDADO.equals(p.getStatus()));
        long accepted = ps.stream().filter(p -> P_ATIVO.equals(p.getStatus())).count();
        if (!pending && AGUARDANDO.equals(i.getState())) {
            if (accepted >= Math.max(2, t.getMinParticipants())) {
                activate(i, t);
            } else {
                expire(i);
            }
        }
    }

    @Transactional
    public Map<String, Object> startNow(CurrentUser user, UUID id) {
        ChallengeInstance i = instance(id);
        if (!i.getCreatedBy().equals(user.id())) {
            throw guard.deny(user, "challenge:" + id, Msg.t("challenge.so_quem_criou_pode_iniciar"));
        }
        ChallengeTemplate t = template(i.getTemplateCode());
        long accepted = participants.findByInstanceId(id).stream().filter(p -> P_ATIVO.equals(p.getStatus())).count();
        if (!AGUARDANDO.equals(i.getState()) || accepted < Math.max(2, t.getMinParticipants())) {
            throw new ApiException(409, "MINIMO_NAO_ATINGIDO", Msg.t("challenge.ainda_nao_ha_o_minimo"));
        }
        participants.findByInstanceId(id).stream().filter(p -> P_CONVIDADO.equals(p.getStatus())).forEach(p -> {
            p.setStatus(P_RECUSOU);
            participants.save(p);
        });
        activate(i, t);
        return detail(user, id);
    }

    /** CA11 — sair a qualquer momento; a meta da equipe é recalculada; ninguém recebe notificação de culpa. */
    @Transactional
    public Map<String, Object> leave(CurrentUser user, UUID id) {
        ChallengeInstance i = instance(id);
        ChallengeParticipant p = participants.findByInstanceIdAndUserId(id, user.id())
                .filter(x -> P_ATIVO.equals(x.getStatus())).orElseThrow(() -> ApiException.notFound(Msg.t("challenge.participacao")));
        p.setStatus(P_SAIU);
        p.setLeftAt(Instant.now());
        participants.save(p);
        List<ChallengeParticipant> remaining = participants.findByInstanceId(id).stream().filter(x -> P_ATIVO.equals(x.getStatus())).toList();
        if (remaining.isEmpty() && (ATIVO.equals(i.getState()) || AGUARDANDO.equals(i.getState())) && !"COMUNIDADE".equals(i.getMode())) {
            i.setState(EXPIRADO);
            i.setResultJson(Json.write(Map.of("reason", "todos saíram", "penalty", false)));
            instances.save(i);
        }
        return Map.of("left", true, "note", Msg.t("challenge.seu_progresso_continua_registrado_no"));
    }

    /** Diagrama §3: o criador cancela e o desafio volta para rascunho (sem penalidade para ninguém). */
    @Transactional
    public Map<String, Object> cancel(CurrentUser user, UUID id) {
        ChallengeInstance i = instance(id);
        if (!i.getCreatedBy().equals(user.id()) || "COMUNIDADE".equals(i.getMode())) {
            throw guard.deny(user, "challenge:" + id, Msg.t("challenge.so_quem_criou_o_desafio_2"));
        }
        if (!AGUARDANDO.equals(i.getState()) && !ATIVO.equals(i.getState())) {
            throw new ApiException(409, "ESTADO_INVALIDO", Msg.t("challenge.este_desafio_nao_pode_ser"));
        }
        for (ChallengeParticipant p : participants.findByInstanceId(id)) {
            if (!p.getUserId().equals(user.id()) && (P_ATIVO.equals(p.getStatus()) || P_CONVIDADO.equals(p.getStatus()))) {
                p.setStatus(P_CANCELADO);
                participants.save(p);
            }
        }
        i.setState(RASCUNHO);
        i.setStartsAt(null);
        i.setEndsAt(null);
        i.setAcceptDeadline(null);
        instances.save(i);
        return detail(user, id);
    }

    void expire(ChallengeInstance i) {
        i.setState(EXPIRADO);
        i.setResultJson(Json.write(Map.of("reason", "mínimo de participantes não atingido no prazo de aceite", "penalty", false)));
        instances.save(i);
    }

    // ================================================================== progresso verificável (§4)
    @SuppressWarnings("unchecked")
    Progress progress(ChallengeInstance i, ChallengeParticipant p, ChallengeTemplate t) {
        Map<String, Object> params = Json.map(i.getParamsJson());
        Map<String, Object> goal = Json.map(p.getPersonalGoalJson());
        List<ChallengeEvent> ev = evidence.findByInstanceIdAndUserId(i.getId(), p.getUserId());
        Instant survival = Instant.now().minus(24, ChronoUnit.HOURS);
        int duration = t.getDurationDays() == null ? 7 : t.getDurationDays();
        switch (t.getCode()) {
            case "TEN_X_TEN" -> {
                int ok = 0, pending = 0;
                for (ChallengeEvent e : ev) {
                    if (!"LOOK".equals(e.getEvidenceType())) {
                        continue;
                    }
                    Optional<Scheme> s = schemes.findById(e.getRefId()).filter(x -> x.getStatus() != SchemeStatus.ARCHIVED);
                    if (s.isEmpty()) {
                        continue; // esquema apagado não conta (§5 do score)
                    }
                    if (s.get().getCreatedAt() != null && s.get().getCreatedAt().isAfter(survival)) {
                        pending++;
                    } else {
                        ok++;
                    }
                }
                return new Progress(ok, 10, Math.min(1, ok / 10.0), Math.max(p.getBestRecord(), ok), Msg.t("challenge.looks_so_com_as_10"), pending);
            }
            case "CAPSULE_SEASON" -> {
                int target = params.get("target_days") instanceof Number n ? n.intValue() : 60;
                long days = ev.stream().filter(e -> "CAPSULE_DAY".equals(e.getEvidenceType())).count();
                return new Progress((int) days, target, Math.min(1, days / (double) target), (int) days, Msg.t("challenge.dias_vestindo_so_a_capsula"), 0);
            }
            case "SECOND_CHANCE" -> {
                int target = goal.get("target") instanceof Number n ? n.intValue() : 0;
                long rescued = ev.stream().filter(e -> "RESCUE".equals(e.getEvidenceType())).map(ChallengeEvent::getRefId).distinct().count();
                double f = target == 0 ? 1 : Math.min(1, rescued / (double) target);
                return new Progress((int) rescued, target, f, (int) rescued, target == 0 ? Msg.t("challenge.nenhuma_peca_esquecida_meta_ja")
                        : Msg.t("challenge.pecas_esquecidas_resgatadas"), 0);
            }
            case "NO_REPEAT" -> {
                int[] streak = noRepeatStreak(p.getUserId(), i.getStartsAt() == null ? today() : dateOf(i.getStartsAt()));
                int target = params.get("target_days") instanceof Number n ? n.intValue() : 7;
                return new Progress(streak[0], target, Math.min(1, streak[0] / (double) target), Math.max(p.getBestRecord(), streak[1]),
                        Msg.t("challenge.dias_seguidos_sem_repetir_o"), 0);
            }
            case "WEAR_WHAT_YOU_HAVE", "CHANEL_WEEK", "MY_SEASON", "REAL_MIRROR" -> {
                String type = switch (t.getCode()) {
                    case "WEAR_WHAT_YOU_HAVE" -> "WWYH_DAY";
                    case "CHANEL_WEEK" -> "TAKE_ONE_OFF";
                    case "MY_SEASON" -> "SEASON_DAY";
                    default -> "EQUIPE".equals(i.getMode()) ? "REAL_PHOTO_CONFIRMED" : "REAL_PHOTO";
                };
                Set<LocalDate> violations = ev.stream().filter(e -> "VIOLATION".equals(e.getEvidenceType())).map(e -> dateOf(e.getCreatedAt()))
                        .collect(Collectors.toSet());
                long days = ev.stream().filter(e -> type.equals(e.getEvidenceType())).map(e -> dateOf(e.getCreatedAt()))
                        .filter(d -> !violations.contains(d)).distinct().count();
                String label = switch (t.getCode()) {
                    case "WEAR_WHAT_YOU_HAVE" -> Msg.t("challenge.dias_vestindo_so_o_que");
                    case "CHANEL_WEEK" -> Msg.t("challenge.dias_com_tira_uma_coisa");
                    case "MY_SEASON" -> Msg.t("challenge.dias_com_looks_da_sua");
                    default -> Msg.t("challenge.dias_com_o_look_real");
                };
                return new Progress((int) days, duration, Math.min(1, days / (double) duration), (int) days, label, 0);
            }
            case "RUNWAY_BATTLE", "GRWM" -> {
                boolean entry = ev.stream().anyMatch(e -> "LOOK_ENTRY".equals(e.getEvidenceType()) || "GRWM_VIDEO".equals(e.getEvidenceType()));
                return new Progress(entry ? 1 : 0, 1, entry ? 1 : 0, entry ? 1 : 0, t.getCode().equals("GRWM") ? Msg.t("challenge.video_do_vista_me_publicado")
                        : Msg.t("challenge.look_inscrito_na_batalha"), 0);
            }
            case "DAILY_CHALLENGE" -> {
                boolean ok = ev.stream().anyMatch(e -> "DAILY_RULE_OK".equals(e.getEvidenceType()));
                return new Progress(ok ? 1 : 0, 1, ok ? 1 : 0, ok ? 1 : 0, Msg.t("challenge.look_dentro_da_regra_do"), 0);
            }
            default -> {
                long days = ev.stream().filter(e -> "RULE_LOOK".equals(e.getEvidenceType())).map(e -> dateOf(e.getCreatedAt())).distinct().count();
                return new Progress((int) days, duration, Math.min(1, days / (double) duration), (int) days, Msg.t("challenge.dias_com_look_dentro_da"), 0);
            }
        }
    }

    /** [atual, melhor] — sequência de Looks do Dia sem repetir composição, com o Cabide de Reserva (DET-G06). */
    int[] noRepeatStreak(UUID userId, LocalDate start) {
        Map<LocalDate, String> byDay = new TreeMap<>();
        for (DailyLook dl : dailyLooks.findTop60ByUserIdOrderByLookDateDesc(userId)) {
            if (!dl.getLookDate().isBefore(start)) {
                byDay.put(dl.getLookDate(), SchemeService.combinationKey(schemeItems.findBySchemeIdOrderBySortOrder(dl.getScheme().getId()).stream()
                        .map(si -> si.getWardrobeItem().getId()).toList()));
            }
        }
        int current = 0, best = 0;
        Set<String> seen = new HashSet<>();
        Set<Integer> reserveWeeks = new HashSet<>();
        LocalDate end = today();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            String k = byDay.get(d);
            int week = d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR) + d.getYear() * 100;
            if (k != null && seen.add(k)) {
                current++;
            } else if (k == null && (d.equals(end) || reserveWeeks.add(week))) {
                // hoje ainda não acabou; ou o cabide de reserva protege 1 dia perdido por semana
            } else {
                best = Math.max(best, current);
                current = 0;
                seen.clear();
                if (k != null) {
                    seen.add(k);
                    current = 1;
                }
            }
        }
        return new int[]{current, Math.max(best, current)};
    }

    void refresh(ChallengeInstance i, ChallengeTemplate t) {
        List<ChallengeParticipant> ps = participants.findByInstanceId(i.getId());
        for (ChallengeParticipant p : ps) {
            if (!P_ATIVO.equals(p.getStatus())) {
                continue;
            }
            Progress pr = progress(i, p, t);
            p.setProgressFraction(BigDecimal.valueOf(pr.fraction()).setScale(4, RoundingMode.HALF_UP));
            p.setBestRecord(Math.max(p.getBestRecord(), pr.best()));
            participants.save(p);
        }
        // meta atingida → concluído (Solo/Comunidade: a própria meta; Equipe: média das frações = 1)
        if (!ATIVO.equals(i.getState()) || "DUELO".equals(i.getMode())) {
            return;
        }
        List<ChallengeParticipant> active = ps.stream().filter(p -> P_ATIVO.equals(p.getStatus())).toList();
        if (active.isEmpty()) {
            return;
        }
        double avg = active.stream().mapToDouble(p -> p.getProgressFraction().doubleValue()).average().orElse(0);
        if ("COMUNIDADE".equals(i.getMode())) {
            for (ChallengeParticipant p : active) {
                if (p.getProgressFraction().doubleValue() >= 1 && !"DAILY_CHALLENGE".equals(t.getCode())) {
                    finishParticipant(i, t, p, 1.0);
                }
            }
            return;
        }
        if (avg >= 0.9999) {
            conclude(i, t);
        }
    }

    // ================================================================== ouvintes de evidência (dados reais)
    List<Object[]> activeParticipations(UUID userId) {
        List<ChallengeParticipant> mine = participants.findByUserIdAndStatusIn(userId, List.of(P_ATIVO));
        if (mine.isEmpty()) {
            return List.of();
        }
        Map<UUID, ChallengeInstance> byId = instances.findByIdIn(mine.stream().map(ChallengeParticipant::getInstanceId).toList()).stream()
                .filter(i -> ATIVO.equals(i.getState())).collect(Collectors.toMap(ChallengeInstance::getId, i -> i));
        List<Object[]> out = new ArrayList<>();
        for (ChallengeParticipant p : mine) {
            ChallengeInstance i = byId.get(p.getInstanceId());
            if (i != null) {
                templates.findById(i.getTemplateCode()).ifPresent(t -> out.add(new Object[]{i, p, t}));
            }
        }
        return out;
    }

    boolean record(ChallengeInstance i, UUID userId, String type, UUID ref) {
        if (evidence.existsByInstanceIdAndUserIdAndEvidenceTypeAndRefId(i.getId(), userId, type, ref)) {
            return false;
        }
        ChallengeEvent e = new ChallengeEvent();
        e.setId(UUID.randomUUID());
        e.setInstanceId(i.getId());
        e.setUserId(userId);
        e.setEvidenceType(type);
        e.setRefId(ref);
        evidence.save(e);
        return true;
    }

    /** Listeners dos desafios rodam depois do commit, em transação própria (nunca derrubam a ação principal). */
    private void safe(String what, Runnable r) {
        sideEffects.run("desafios:" + what, r);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSchemeSaved(DomainEvents.SchemeSaved ev) {
        safe("SchemeSaved", () -> handleLook(ev.userId(), ev.schemeId(), ev.pieceIds(), ev.created(), false));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onDailyLook(DomainEvents.DailyLookRegistered ev) {
        safe("DailyLookRegistered", () -> handleLook(ev.userId(), ev.schemeId(), ev.pieceIds(), false, true));
    }

    @SuppressWarnings("unchecked")
    void handleLook(UUID userId, UUID schemeId, List<UUID> pieceIds, boolean created, boolean dailyLook) {
        if (pieceIds == null || pieceIds.isEmpty()) {
            return;
        }
        List<WardrobeItem> look = pieces.findByIdIn(pieceIds);
        LocalDate d = today();
        for (Object[] row : activeParticipations(userId)) {
            ChallengeInstance i = (ChallengeInstance) row[0];
            ChallengeParticipant p = (ChallengeParticipant) row[1];
            ChallengeTemplate t = (ChallengeTemplate) row[2];
            Map<String, Object> params = Json.map(i.getParamsJson());
            Map<String, Object> goal = Json.map(p.getPersonalGoalJson());
            boolean changed = false;
            switch (t.getCode()) {
                case "TEN_X_TEN" -> {
                    Set<String> allowed = new HashSet<>(Json.strings(Json.write(params.get("piece_ids"))));
                    if (created && pieceIds.size() >= 2 && pieceIds.stream().allMatch(x -> allowed.contains(x.toString()))) {
                        changed = record(i, userId, "LOOK", schemeId);
                    }
                }
                case "CAPSULE_SEASON" -> {
                    Set<String> allowed = new HashSet<>(Json.strings(Json.write(params.get("piece_ids"))));
                    if (dailyLook) {
                        if (pieceIds.stream().allMatch(x -> allowed.contains(x.toString()))) {
                            changed = record(i, userId, "CAPSULE_DAY", dayRef(i.getId(), d));
                        } else {
                            changed = record(i, userId, "VIOLATION", dayRef(i.getId(), d));
                        }
                    }
                }
                case "SECOND_CHANCE" -> {
                    Set<String> forgotten = new HashSet<>(Json.strings(Json.write(goal.get("forgotten"))));
                    for (UUID id : pieceIds) {
                        if (forgotten.contains(id.toString()) && (dailyLook || pieceIds.size() >= 2)) {
                            changed |= record(i, userId, "RESCUE", id);
                        }
                    }
                }
                case "NO_REPEAT" -> {
                    if (dailyLook) {
                        changed = record(i, userId, "DAILY_LOOK", dayRef(i.getId(), d));
                    }
                }
                case "WEAR_WHAT_YOU_HAVE" -> {
                    if (dailyLook) {
                        Instant since = goal.get("since") == null ? i.getStartsAt() : Instant.parse(String.valueOf(goal.get("since")));
                        boolean onlyOld = look.stream().allMatch(w -> w.getCreatedAt() == null || since == null || w.getCreatedAt().isBefore(since));
                        if (onlyOld) {
                            changed = record(i, userId, "WWYH_DAY", dayRef(i.getId(), d));
                        }
                    }
                }
                case "MY_SEASON" -> {
                    Set<String> palette = paletteFamilies(userId);
                    if (!palette.isEmpty() && look.size() >= 2 && look.stream().allMatch(w -> palette.contains(InventoryScoreService.family(w.getColor())))) {
                        changed = record(i, userId, "SEASON_DAY", dayRef(i.getId(), d));
                    }
                }
                case "DAILY_CHALLENGE" -> {
                    List<Map<String, Object>> blocks = (List<Map<String, Object>>) (List<?>) Json.list(Json.write(params.get("blocks")));
                    List<Boolean> grid = evaluate(userId, look, blocks, d);
                    Map<String, Object> g = new LinkedHashMap<>(goal);
                    String gridRow = grid.stream().map(b -> b ? "🟩" : "⬜").collect(Collectors.joining());
                    String prev = String.valueOf(g.getOrDefault("grid", ""));
                    if (gridRow.codePoints().filter(c -> c == 0x1F7E9).count() >= prev.codePoints().filter(c -> c == 0x1F7E9).count()) {
                        g.put("grid", gridRow);
                        p.setPersonalGoalJson(Json.write(g));
                        participants.save(p);
                    }
                    if (grid.stream().allMatch(b -> b)) {
                        changed = record(i, userId, "DAILY_RULE_OK", schemeId);
                    }
                }
                default -> {
                    List<Map<String, Object>> blocks = Json.list(t.getRuleBlocksJson());
                    if (!blocks.isEmpty() && evaluate(userId, look, blocks, d).stream().allMatch(b -> b)) {
                        changed = record(i, userId, "RULE_LOOK", dayRef(i.getId(), d));
                    }
                }
            }
            if (changed) {
                refresh(i, t);
            }
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onMirror(DomainEvents.MirrorAction ev) {
        safe("MirrorAction", () -> {
            for (Object[] row : activeParticipations(ev.userId())) {
                ChallengeInstance i = (ChallengeInstance) row[0];
                ChallengeTemplate t = (ChallengeTemplate) row[2];
                boolean changed = false;
                if ("TIRA_UMA_COISA".equals(ev.action()) && t.getCode().equals("CHANEL_WEEK")) {
                    changed = record(i, ev.userId(), "TAKE_ONE_OFF", dayRef(i.getId(), today()));
                } else if ("GRWM_VIDEO".equals(ev.action()) && t.getCode().equals("GRWM")) {
                    changed = record(i, ev.userId(), "GRWM_VIDEO", dayRef(i.getId(), today()));
                }
                if (changed) {
                    refresh(i, t);
                }
            }
        });
    }

    /** Semana Vista o que Você Tem: cadastrar compra nova durante a semana invalida o dia (sem culpa, só não conta). */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPieceCreated(DomainEvents.PieceCreated ev) {
        safe("PieceCreated", () -> {
            WardrobeItem w = pieces.findById(ev.pieceId()).orElse(null);
            if (w == null) {
                return;
            }
            boolean purchase = "COMPRADA".equalsIgnoreCase(w.getPieceOrigin())
                    || (w.getPurchaseDate() != null && !w.getPurchaseDate().isBefore(today().minusDays(7)));
            if (!purchase) {
                return;
            }
            for (Object[] row : activeParticipations(ev.userId())) {
                ChallengeInstance i = (ChallengeInstance) row[0];
                ChallengeTemplate t = (ChallengeTemplate) row[2];
                if (t.getCode().equals("WEAR_WHAT_YOU_HAVE") && record(i, ev.userId(), "VIOLATION", dayRef(i.getId(), today()))) {
                    refresh(i, t);
                }
            }
        });
    }

    Set<String> paletteFamilies(UUID userId) {
        return dnas.findByUserId(userId).map(d -> {
            Set<String> out = Json.csv(d.getColorPalette()).stream().map(InventoryScoreService::family).filter(Objects::nonNull).collect(Collectors.toSet());
            if (out.isEmpty() && d.getColorSeason() != null) {
                out.addAll(switch (d.getColorSeason().toUpperCase(Locale.ROOT)) {
                    case "PRIMAVERA", "SPRING" -> Set.of("Amarelo", "Laranja", "Verde", "Rosa", "Branco");
                    case "VERAO", "VERÃO", "SUMMER" -> Set.of("Azul", "Rosa", "Roxo", "Cinza", "Branco");
                    case "OUTONO", "AUTUMN" -> Set.of("Marrom", "Laranja", "Verde", "Amarelo", "Vermelho");
                    default -> Set.of("Preto", "Branco", "Azul", "Vermelho", "Roxo");
                });
            }
            return out;
        }).orElse(Set.of());
    }

    /** Avalia blocos de regra sobre um look (Desafio do Dia e desafios da comunidade). */
    List<Boolean> evaluate(UUID userId, List<WardrobeItem> look, List<Map<String, Object>> blocks, LocalDate day) {
        List<Boolean> out = new ArrayList<>();
        for (Map<String, Object> b : blocks) {
            String type = String.valueOf(b.get("type"));
            Object v = b.get("value");
            boolean all = "all".equalsIgnoreCase(String.valueOf(b.getOrDefault("quantifier", "any")));
            java.util.function.Predicate<WardrobeItem> pred = switch (type) {
                case "color_family" -> w -> String.valueOf(v).equalsIgnoreCase(InventoryScoreService.family(w.getColor()));
                case "category" -> w -> String.valueOf(v).equals(w.getCategory());
                case "origin" -> w -> w.getPieceOrigin() != null && List.of(String.valueOf(v).split("\\|")).contains(w.getPieceOrigin().toUpperCase(Locale.ROOT));
                case "state" -> w -> switch (String.valueOf(v)) {
                    case "forgotten" -> daysUnused(w, day) >= RoomService.FORGOTTEN_DAYS;
                    case "favorite" -> w.isFavorite();
                    default -> w.isDisponivel();
                };
                case "unused_days" -> w -> daysUnused(w, day) >= (v instanceof Number n ? n.intValue() : 30);
                case "slot" -> w -> String.valueOf(v).equals(MirrorService.slotOf(w));
                default -> null;
            };
            boolean ok;
            if (pred != null) {
                ok = all ? !look.isEmpty() && look.stream().allMatch(pred) : look.stream().anyMatch(pred);
            } else {
                Set<String> fams = look.stream().map(w -> InventoryScoreService.family(w.getColor())).filter(Objects::nonNull).collect(Collectors.toSet());
                ok = switch (type) {
                    case "monochrome" -> look.size() >= 2 && fams.size() == 1;
                    case "neutral_only" -> !look.isEmpty() && look.stream().allMatch(w -> ColorMath.isNeutral(w.getColor()));
                    case "distinct_colors" -> fams.size() >= (v instanceof Number n ? n.intValue() : 3);
                    case "piece_count" -> look.size() <= (v instanceof Number n ? n.intValue() : 5);
                    default -> false;
                };
            }
            out.add(ok);
        }
        return out;
    }

    /** Dias sem uso antes do dia avaliado (ignora o uso do próprio dia, que já pode estar no diário). */
    long daysUnused(WardrobeItem w, LocalDate day) {
        LocalDate last = diary.findByWardrobeItemIdOrderByUsedOnDesc(w.getId()).stream().map(PieceUsageDiaryEntry::getUsedOn)
                .filter(d -> d.isBefore(day)).findFirst().orElse(null);
        LocalDate worn = w.getLastWornDate() != null && w.getLastWornDate().isBefore(day) ? w.getLastWornDate() : null;
        LocalDate ref = last == null ? worn : worn == null || last.isAfter(worn) ? last : worn;
        if (ref == null) {
            ref = w.getCreatedAt() == null ? day : dateOf(w.getCreatedAt());
        }
        return ChronoUnit.DAYS.between(ref, day);
    }

    // ================================================================== conclusão e recompensa (CA12)
    @Transactional
    public void conclude(ChallengeInstance i, ChallengeTemplate t) {
        if (CONCLUIDO.equals(i.getState())) {
            return;
        }
        refreshProgressOnly(i, t);
        List<ChallengeParticipant> ps = participants.findByInstanceId(i.getId());
        List<ChallengeParticipant> members = ps.stream().filter(p -> P_ATIVO.equals(p.getStatus()) || P_CONCLUIU.equals(p.getStatus())).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("code", t.getCode());
        result.put("name", t.getName());
        result.put("mode", i.getMode());
        result.put("concludedAt", Instant.now().toString());
        switch (i.getMode()) {
            case "EQUIPE" -> {
                double teamFraction = members.stream().mapToDouble(p -> p.getProgressFraction().doubleValue()).average().orElse(0);
                int pool = teamFraction < 0.25 ? 0 : (int) Math.round(t.getRewardPoints() * teamFraction);
                int each = members.isEmpty() ? 0 : pool / members.size();
                result.put("teamFraction", round2(teamFraction));
                result.put("rewardEach", each);
                for (ChallengeParticipant p : members) {
                    reward(p, i, t, each);
                }
            }
            case "DUELO" -> {
                Map<UUID, Double> scores = duelScores(i, t, members);
                result.put("scoring", VOTED.contains(t.getCode()) ? Msg.t("challenge.votos_as_cegas") : "recorde pessoal");
                double best = scores.values().stream().mapToDouble(Double::doubleValue).max().orElse(0);
                boolean teams = members.stream().anyMatch(p -> "B".equals(p.getTeam()));
                List<String> winners = new ArrayList<>();
                if (teams) {
                    Map<String, Double> byTeam = members.stream().collect(Collectors.groupingBy(p -> p.getTeam() == null ? "A" : p.getTeam(),
                            Collectors.averagingDouble(p -> scores.getOrDefault(p.getUserId(), 0.0))));
                    double top = byTeam.values().stream().mapToDouble(Double::doubleValue).max().orElse(0);
                    Set<String> win = byTeam.entrySet().stream().filter(e -> e.getValue() == top && top > 0).map(Map.Entry::getKey).collect(Collectors.toSet());
                    result.put("teams", byTeam);
                    for (ChallengeParticipant p : members) {
                        boolean w = win.contains(p.getTeam() == null ? "A" : p.getTeam());
                        if (w) {
                            winners.add(p.getUserId().toString());
                        }
                        reward(p, i, t, w ? t.getRewardPoints() : t.getRewardPoints() / 4);
                    }
                } else {
                    for (ChallengeParticipant p : members) {
                        boolean w = best > 0 && scores.getOrDefault(p.getUserId(), 0.0) == best;
                        if (w) {
                            winners.add(p.getUserId().toString());
                        }
                        reward(p, i, t, w ? t.getRewardPoints() : t.getRewardPoints() / 4);
                    }
                }
                result.put("winners", winners.stream().map(id -> users.findById(UUID.fromString(id)).map(User::getUsername).orElse("—")).toList());
                result.put("ranking", scores.entrySet().stream().sorted(Map.Entry.<UUID, Double>comparingByValue().reversed())
                        .map(e -> Map.of("user", users.findById(e.getKey()).map(User::getUsername).orElse("—"), "score", round2(e.getValue()))).toList());
            }
            default -> {
                for (ChallengeParticipant p : members) {
                    double f = p.getProgressFraction().doubleValue();
                    reward(p, i, t, f < 0.25 ? 0 : (int) Math.round(t.getRewardPoints() * Math.min(1, f)));
                }
                if (!members.isEmpty()) {
                    result.put("fraction", round2(members.get(0).getProgressFraction().doubleValue()));
                }
            }
        }
        i.setState(CONCLUIDO);
        i.setResultJson(Json.write(result));
        instances.save(i);
        for (ChallengeParticipant p : members) {
            notifications.notify(p.getUserId(), null, NotificationType.CHALLENGE_RESULT, "CHALLENGE", i.getId(), Msg.k("challenge.concluido", (t.getName())),
                    Msg.k("challenge.veja_o_card_de_resultado"), Map.of("challengeId", i.getId().toString()));
        }
    }

    void refreshProgressOnly(ChallengeInstance i, ChallengeTemplate t) {
        for (ChallengeParticipant p : participants.findByInstanceId(i.getId())) {
            if (P_ATIVO.equals(p.getStatus())) {
                Progress pr = progress(i, p, t);
                p.setProgressFraction(BigDecimal.valueOf(pr.fraction()).setScale(4, RoundingMode.HALF_UP));
                p.setBestRecord(Math.max(p.getBestRecord(), pr.best()));
                participants.save(p);
            }
        }
    }

    void finishParticipant(ChallengeInstance i, ChallengeTemplate t, ChallengeParticipant p, double fraction) {
        reward(p, i, t, (int) Math.round(t.getRewardPoints() * Math.min(1, fraction)));
    }

    void reward(ChallengeParticipant p, ChallengeInstance i, ChallengeTemplate t, int pts) {
        p.setStatus(P_CONCLUIU);
        participants.save(p);
        if (pts > 0) {
            points.award(p.getUserId(), "CHALLENGE_COMPLETED", "CHALLENGE", i.getId().toString(), pts);
        }
    }

    Map<UUID, Double> duelScores(ChallengeInstance i, ChallengeTemplate t, List<ChallengeParticipant> members) {
        Map<UUID, Double> out = new HashMap<>();
        if (VOTED.contains(t.getCode())) {
            Map<UUID, UUID> entryOwner = new HashMap<>();
            for (ChallengeEvent e : evidence.findByInstanceId(i.getId())) {
                if ("LOOK_ENTRY".equals(e.getEvidenceType())) {
                    entryOwner.put(e.getRefId(), e.getUserId());
                }
            }
            for (ChallengeVote v : votes.findByInstanceId(i.getId())) {
                UUID owner = entryOwner.get(v.getEntrySchemeId());
                if (owner != null) {
                    out.merge(owner, 1.0, Double::sum);
                }
            }
            members.forEach(p -> out.putIfAbsent(p.getUserId(), 0.0));
        } else {
            // recordes pessoais — não dependem do tamanho do acervo (§1.1 regra 2)
            members.forEach(p -> out.put(p.getUserId(), (double) Math.max(p.getBestRecord(), progress(i, p, t).best())));
        }
        return out;
    }

    static double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }

    /** Job — expira convites sem o mínimo, conclui desafios vencidos e avisa a janela do Espelho de Verdade. */
    @Scheduled(cron = "0 */15 * * * *", zone = "America/Sao_Paulo")
    @Transactional
    public Map<String, Integer> tick() {
        int expired = 0, started = 0, concluded = 0;
        Instant now = Instant.now();
        for (ChallengeInstance i : instances.findByStateIn(List.of(AGUARDANDO, ATIVO))) {
            ChallengeTemplate t = templates.findById(i.getTemplateCode()).orElse(null);
            if (t == null) {
                continue;
            }
            if (AGUARDANDO.equals(i.getState()) && i.getAcceptDeadline() != null && i.getAcceptDeadline().isBefore(now)) {
                long accepted = participants.findByInstanceId(i.getId()).stream().filter(p -> P_ATIVO.equals(p.getStatus())).count();
                if (accepted >= Math.max(2, t.getMinParticipants())) {
                    participants.findByInstanceId(i.getId()).stream().filter(p -> P_CONVIDADO.equals(p.getStatus())).forEach(p -> {
                        p.setStatus(P_RECUSOU);
                        participants.save(p);
                    });
                    activate(i, t);
                    started++;
                } else {
                    expire(i);
                    expired++;
                }
            } else if (ATIVO.equals(i.getState()) && i.getEndsAt() != null && i.getEndsAt().isBefore(now)) {
                conclude(i, t);
                concluded++;
            } else if (ATIVO.equals(i.getState()) && t.getCode().equals("REAL_MIRROR")) {
                notifyRealMirrorWindow(i);
            }
        }
        return Map.of("expired", expired, "started", started, "concluded", concluded);
    }

    /** Janela aleatória (determinística por desafio e dia) entre 9 h e 21 h, com 30 minutos. */
    static ZonedDateTime windowStart(UUID instanceId, LocalDate day) {
        int h = Math.abs((instanceId.toString() + day).hashCode());
        int minutes = 9 * 60 + h % (12 * 60);
        return day.atStartOfDay(FaiPointsService.ZONE).plusMinutes(minutes);
    }

    void notifyRealMirrorWindow(ChallengeInstance i) {
        ZonedDateTime start = windowStart(i.getId(), today());
        ZonedDateTime now = ZonedDateTime.now(FaiPointsService.ZONE);
        if (now.isAfter(start) && now.isBefore(start.plusMinutes(15))) {
            for (ChallengeParticipant p : participants.findByInstanceId(i.getId())) {
                if (P_ATIVO.equals(p.getStatus()) && record(i, p.getUserId(), "WINDOW_NOTIFIED", dayRef(i.getId(), today()))) {
                    notifications.notify(p.getUserId(), null, NotificationType.CHALLENGE_INVITE, "CHALLENGE", i.getId(), Msg.k("challenge.hora_do_espelho_de_verdade"),
                            Msg.k("challenge.a_janela_de_hoje_esta"), Map.of("challengeId", i.getId().toString()));
                }
            }
        }
    }

    // ================================================================== visão do desafio (CA07/CA08/CA09)
    @Transactional
    public Map<String, Object> detail(CurrentUser user, UUID id) {
        ChallengeInstance i = instance(id);
        ChallengeTemplate t = templates.findById(i.getTemplateCode()).orElseThrow();
        List<ChallengeParticipant> ps = participants.findByInstanceId(id);
        ChallengeParticipant me = ps.stream().filter(p -> p.getUserId().equals(user.id())).findFirst().orElse(null);
        if (me == null && !"COMUNIDADE".equals(i.getMode())) {
            throw guard.deny(user, "challenge:" + id, Msg.t("challenge.voce_nao_participa_deste_desafio"));
        }
        Map<String, Object> params = Json.map(i.getParamsJson());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", i.getId());
        out.put("code", t.getCode());
        out.put("name", t.getName());
        out.put("rule", t.getCode().equals("DAILY_CHALLENGE") ? params.getOrDefault("rule", t.getRuleText()) : t.getRuleText());
        out.put("mode", i.getMode());
        out.put("state", i.getState());
        out.put("startsAt", i.getStartsAt());
        out.put("endsAt", i.getEndsAt());
        out.put("acceptDeadline", i.getAcceptDeadline());
        out.put("daysLeft", i.getEndsAt() == null ? null : Math.max(0, ChronoUnit.DAYS.between(today(), dateOf(i.getEndsAt()))));
        out.put("improves", Json.strings(t.getScoreDimensionsJson()).stream().map(x -> DIM_NAMES.getOrDefault(x, x)).toList());
        out.put("reward", t.getRewardPoints());
        out.put("isCreator", i.getCreatedBy().equals(user.id()));
        if (params.get("theme") != null) {
            out.put("theme", params.get("theme"));
        }
        if (me != null) {
            Progress pr = progress(i, me, t);
            Map<String, Object> mine = new LinkedHashMap<>();
            mine.put("status", me.getStatus());
            mine.put("value", pr.value());
            mine.put("target", pr.target());
            mine.put("fraction", round2(pr.fraction()));
            mine.put("best", Math.max(me.getBestRecord(), pr.best()));
            mine.put("label", pr.label());
            mine.put("pendingSurvival", pr.pending());
            mine.put("team", me.getTeam());
            Map<String, Object> goal = Json.map(me.getPersonalGoalJson());
            if (goal.get("grid") != null) {
                mine.put("grid", goal.get("grid"));
            }
            if (t.getCode().equals("REAL_MIRROR")) {
                ZonedDateTime ws = windowStart(i.getId(), today());
                mine.put("window", Map.of("start", ws.toLocalTime().toString(), "end", ws.plusMinutes(30).toLocalTime().toString(),
                        "open", ZonedDateTime.now(FaiPointsService.ZONE).isAfter(ws) && ZonedDateTime.now(FaiPointsService.ZONE).isBefore(ws.plusMinutes(30))));
                mine.put("photoConsent", Boolean.TRUE.equals(goal.get("photoConsent")));
            }
            if (params.get("piece_ids") != null) {
                mine.put("pieceIds", params.get("piece_ids"));
            }
            out.put("me", mine);
        }
        // CA07 — só frações, nunca valores absolutos de peças dos colegas
        List<ChallengeParticipant> active = ps.stream().filter(p -> P_ATIVO.equals(p.getStatus()) || P_CONCLUIU.equals(p.getStatus())).toList();
        if (!"SOLO".equals(i.getMode())) {
            boolean hideAuthors = "DUELO".equals(i.getMode()) && VOTED.contains(t.getCode()) && !CONCLUIDO.equals(i.getState());
            out.put("members", ps.stream().filter(p -> !P_CANCELADO.equals(p.getStatus())).map(p -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("user", users.findById(p.getUserId()).map(u -> Map.of("id", u.getId(), "username", u.getUsername(),
                        "avatarUrl", String.valueOf(u.getAvatarUrl()))).orElse(null));
                m.put("status", p.getStatus());
                m.put("team", p.getTeam());
                m.put("fraction", round2(p.getProgressFraction().doubleValue()));
                return m;
            }).toList());
            if ("EQUIPE".equals(i.getMode())) {
                out.put("teamFraction", round2(active.stream().mapToDouble(p -> p.getProgressFraction().doubleValue()).average().orElse(0)));
            }
            if ("COMUNIDADE".equals(i.getMode())) {
                out.put("members", null);
                out.put("playing", active.size());
            }
            out.put("entries", entries(user, i, t, hideAuthors));
            out.put("notes", notes.findTop100ByInstanceIdOrderByCreatedAtDesc(id).stream().map(n -> Map.of("kind", n.getKind(), "content", n.getContent(),
                    "user", users.findById(n.getUserId()).map(User::getUsername).orElse("—"), "at", n.getCreatedAt())).toList());
            out.put("reactions", REACTIONS);
            out.put("presetNotes", PRESET_NOTES);
        }
        out.put("result", Json.map(i.getResultJson()));
        out.put("decoration", t.getRoomDecoration());
        return out;
    }

    /** CA09 — só os looks que cada membro publicou no desafio, nunca o guarda-roupa; CA08 — às cegas até o resultado. */
    List<Map<String, Object>> entries(CurrentUser viewer, ChallengeInstance i, ChallengeTemplate t, boolean blind) {
        List<Map<String, Object>> out = new ArrayList<>();
        Map<UUID, Long> voteCount = CONCLUIDO.equals(i.getState()) ? votes.findByInstanceId(i.getId()).stream()
                .collect(Collectors.groupingBy(ChallengeVote::getEntrySchemeId, Collectors.counting())) : Map.of();
        for (ChallengeEvent e : evidence.findByInstanceId(i.getId())) {
            if (!"LOOK_ENTRY".equals(e.getEvidenceType())) {
                continue;
            }
            Scheme s = schemes.findById(e.getRefId()).orElse(null);
            if (s == null) {
                continue;
            }
            List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(s.getId());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("entryId", s.getId());
            m.put("coverImageUrl", s.getCoverImageUrl());
            m.put("title", blind ? Msg.t("challenge.look", (out.size() + 1)) : s.getTitle());
            m.put("pieces", items.stream().map(si -> {
                Map<String, Object> pm = new LinkedHashMap<>();
                pm.put("imageUrl", si.getWardrobeItem().getImageUrl());
                pm.put("category", si.getWardrobeItem().getCategory());
                if (!blind) {
                    pm.put("name", si.getWardrobeItem().getName());
                    pm.put("brand", si.getWardrobeItem().getBrandName());
                }
                return pm;
            }).toList());
            m.put("author", blind ? null : users.findById(e.getUserId()).map(User::getUsername).orElse("—"));
            m.put("mine", e.getUserId().equals(viewer.id()));
            m.put("votedByMe", votes.existsByInstanceIdAndVoterUserIdAndEntrySchemeId(i.getId(), viewer.id(), s.getId()));
            if (!voteCount.isEmpty()) {
                m.put("votes", voteCount.getOrDefault(s.getId(), 0L));
            }
            out.add(m);
        }
        return out;
    }

    // ================================================================== inscrição de look, votação, bilhetes e reações
    @Transactional
    public Map<String, Object> submitEntry(CurrentUser user, UUID id, UUID schemeId) {
        ChallengeInstance i = instance(id);
        ChallengeTemplate t = template(i.getTemplateCode());
        ChallengeParticipant me = participants.findByInstanceIdAndUserId(id, user.id()).filter(p -> P_ATIVO.equals(p.getStatus()))
                .orElseThrow(() -> guard.deny(user, "challenge:" + id, Msg.t("challenge.voce_nao_participa_deste_desafio")));
        if (!ATIVO.equals(i.getState())) {
            throw new ApiException(409, "ESTADO_INVALIDO", Msg.t("challenge.o_desafio_nao_esta_ativo"));
        }
        Scheme s = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        guard.requireOwner(user, s.getUser().getId(), "scheme:" + schemeId);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(schemeId);
        if (items.size() < 2 || items.stream().anyMatch(si -> !si.getWardrobeItem().getUser().getId().equals(user.id()))) {
            throw ApiException.badRequest("LOOK_INVALIDO", Msg.t("challenge.o_look_precisa_de_ao"));
        }
        boolean hasEntry = evidence.findByInstanceIdAndUserId(id, user.id()).stream().anyMatch(e -> "LOOK_ENTRY".equals(e.getEvidenceType()));
        if (hasEntry && SINGLE_SHOT.contains(t.getCode())) {
            throw new ApiException(409, "JA_INSCRITO", Msg.t("challenge.voce_ja_inscreveu_um_look"));
        }
        record(i, user.id(), "LOOK_ENTRY", schemeId);
        refresh(i, t);
        return detail(user, id);
    }

    /** Feed de votação às cegas (The Runway — Batalha na Passarela). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> voteFeed(CurrentUser user) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (ChallengeInstance i : instances.findByStateIn(List.of(ATIVO))) {
            ChallengeTemplate t = templates.findById(i.getTemplateCode()).orElse(null);
            if (t == null || !VOTED.contains(t.getCode()) || !"DUELO".equals(i.getMode())) {
                continue;
            }
            List<Map<String, Object>> entries = entries(user, i, t, true).stream().filter(e -> !Boolean.TRUE.equals(e.get("mine"))).toList();
            if (!entries.isEmpty()) {
                out.add(Map.of("challengeId", i.getId(), "name", t.getName(), "theme", String.valueOf(Json.map(i.getParamsJson()).get("theme")),
                        "entries", entries, "endsAt", String.valueOf(i.getEndsAt())));
            }
        }
        return out;
    }

    @Transactional
    public Map<String, Object> vote(CurrentUser user, UUID id, UUID entrySchemeId) {
        ChallengeInstance i = instance(id);
        ChallengeTemplate t = template(i.getTemplateCode());
        if (!ATIVO.equals(i.getState()) || !VOTED.contains(t.getCode())) {
            throw new ApiException(409, "VOTACAO_FECHADA", Msg.t("challenge.a_votacao_deste_desafio_nao"));
        }
        ChallengeEvent entry = evidence.findByInstanceId(id).stream().filter(e -> "LOOK_ENTRY".equals(e.getEvidenceType()) && e.getRefId().equals(entrySchemeId))
                .findFirst().orElseThrow(() -> ApiException.notFound(Msg.t("challenge.look_inscrito")));
        if (entry.getUserId().equals(user.id())) {
            throw ApiException.badRequest("VOTO_PROPRIO", Msg.t("challenge.voce_nao_pode_votar_no"));
        }
        boolean already = votes.findByInstanceId(id).stream().anyMatch(v -> v.getVoterUserId().equals(user.id()));
        if (already) {
            throw new ApiException(409, "JA_VOTOU", Msg.t("challenge.voce_ja_votou_nesta_batalha"));
        }
        ChallengeVote v = new ChallengeVote();
        v.setId(UUID.randomUUID());
        v.setInstanceId(id);
        v.setVoterUserId(user.id());
        v.setEntrySchemeId(entrySchemeId);
        votes.save(v);
        return Map.of("voted", true, "note", Msg.t("challenge.marca_preco_e_autor_aparecem"));
    }

    /** CA16 — bilhete: frase pronta ou texto livre de até 80 caracteres, moderado. Não existe chat livre. */
    @Transactional
    public Map<String, Object> note(CurrentUser user, UUID id, String preset, String free) {
        ChallengeInstance i = requireSocial(user, id);
        String content;
        String kind;
        if (preset != null && !preset.isBlank()) {
            if (!PRESET_NOTES.contains(preset)) {
                throw ApiException.badRequest("FRASE_INVALIDA", Msg.t("challenge.escolha_uma_das_frases_prontas"));
            }
            content = preset;
            kind = "PRESET";
        } else {
            content = InputSanitizer.moderated("bilhete", free == null ? "" : free, NOTE_MAX);
            if (content.isBlank()) {
                throw ApiException.badRequest("BILHETE_VAZIO", Msg.t("challenge.escreva_um_bilhete_de_ate"));
            }
            kind = "FREE";
        }
        ChallengeNote n = new ChallengeNote();
        n.setId(UUID.randomUUID());
        n.setInstanceId(i.getId());
        n.setUserId(user.id());
        n.setKind(kind);
        n.setContent(content);
        notes.save(n);
        return Map.of("kind", kind, "content", content);
    }

    @Transactional
    public Map<String, Object> react(CurrentUser user, UUID id, String emoji) {
        ChallengeInstance i = requireSocial(user, id);
        if (!REACTIONS.contains(emoji)) {
            throw ApiException.badRequest("REACAO_INVALIDA", Msg.t("challenge.reacoes_disponiveis", String.join(" ", REACTIONS)));
        }
        ChallengeNote n = new ChallengeNote();
        n.setId(UUID.randomUUID());
        n.setInstanceId(i.getId());
        n.setUserId(user.id());
        n.setKind("REACTION");
        n.setContent(emoji);
        notes.save(n);
        return Map.of("reaction", emoji);
    }

    ChallengeInstance requireSocial(CurrentUser user, UUID id) {
        ChallengeInstance i = instance(id);
        if (!"EQUIPE".equals(i.getMode()) && !"DUELO".equals(i.getMode())) {
            throw ApiException.badRequest("SEM_INTERACAO", Msg.t("challenge.reacoes_e_bilhetes_existem_so"));
        }
        participants.findByInstanceIdAndUserId(id, user.id()).filter(p -> P_ATIVO.equals(p.getStatus()) || P_CONCLUIU.equals(p.getStatus()))
                .orElseThrow(() -> guard.deny(user, "challenge:" + id, Msg.t("challenge.voce_nao_participa_deste_desafio")));
        return i;
    }

    // ================================================================== Espelho de Verdade (DET-C08, ETI-05)
    @Transactional
    public Map<String, Object> realMirror(CurrentUser user, UUID id, byte[] bytes, String mime) {
        ChallengeInstance i = instance(id);
        ChallengeTemplate t = template(i.getTemplateCode());
        if (!t.getCode().equals("REAL_MIRROR") || !ATIVO.equals(i.getState())) {
            throw ApiException.badRequest("DESAFIO_INVALIDO", Msg.t("challenge.este_envio_vale_so_para"));
        }
        ChallengeParticipant me = participants.findByInstanceIdAndUserId(id, user.id()).filter(p -> P_ATIVO.equals(p.getStatus()))
                .orElseThrow(() -> guard.deny(user, "challenge:" + id, Msg.t("challenge.voce_nao_participa_deste_desafio")));
        ZonedDateTime ws = windowStart(id, today());
        ZonedDateTime now = ZonedDateTime.now(FaiPointsService.ZONE);
        if (now.isBefore(ws) || now.isAfter(ws.plusMinutes(30))) {
            throw new ApiException(409, "FORA_DA_JANELA", Msg.t("challenge.a_janela_de_hoje_e", ws.toLocalTime(), ws.plusMinutes(30).toLocalTime()));
        }
        if (bytes == null || bytes.length == 0 || bytes.length > 10 * 1024 * 1024) {
            throw ApiException.badRequest("FOTO_INVALIDA", Msg.t("challenge.envie_uma_foto_de_ate"));
        }
        String contentType = mime == null ? "image/jpeg" : mime;
        MediaStoragePort.StoredObject stored = media.put("challenges/" + id + "/" + user.id() + "/" + today() + "." + MediaService.ext(contentType),
                bytes, contentType);
        User owner = users.findById(user.id()).orElseThrow();
        var photo = media.register(owner, PhotoOrigin.LOOSE, id, stored, null, null, bytes, null, null, null, ModerationStatus.PENDING,
                Map.of("challenge", "REAL_MIRROR", "private", true));
        Map<String, Object> goal = Json.map(me.getPersonalGoalJson());
        @SuppressWarnings("unchecked") Map<String, Object> photos = goal.get("photos") instanceof Map<?, ?> m ? new LinkedHashMap<>((Map<String, Object>) m) : new LinkedHashMap<>();
        photos.put(today().toString(), Map.of("photoId", photo.getId().toString(), "url", stored.url()));
        goal.put("photos", photos);
        me.setPersonalGoalJson(Json.write(goal));
        participants.save(me);
        record(i, user.id(), "REAL_PHOTO", dayRef(id, today()));
        refresh(i, t);
        return Map.of("recorded", true, "private", !Boolean.TRUE.equals(goal.get("photoConsent")),
                "note", Msg.t("challenge.foto_privada_por_padrao_a"));
    }

    /** Em Equipe, a confirmação vem de um colega (§4) — só vê a foto quem tem o consentimento do autor. */
    @Transactional
    public Map<String, Object> confirmRealMirror(CurrentUser user, UUID id, UUID memberId, LocalDate day) {
        ChallengeInstance i = instance(id);
        ChallengeTemplate t = template(i.getTemplateCode());
        if (!"EQUIPE".equals(i.getMode())) {
            throw ApiException.badRequest("SEM_CONFIRMACAO", Msg.t("challenge.confirmacao_por_colega_existe_so"));
        }
        participants.findByInstanceIdAndUserId(id, user.id()).filter(p -> P_ATIVO.equals(p.getStatus()))
                .orElseThrow(() -> guard.deny(user, "challenge:" + id, Msg.t("challenge.voce_nao_participa_deste_desafio")));
        if (memberId.equals(user.id())) {
            throw ApiException.badRequest("AUTOCONFIRMACAO", Msg.t("challenge.a_confirmacao_precisa_vir_de"));
        }
        ChallengeParticipant member = participants.findByInstanceIdAndUserId(id, memberId).orElseThrow(() -> ApiException.notFound("Participante"));
        if (!Boolean.TRUE.equals(Json.map(member.getPersonalGoalJson()).get("photoConsent"))) {
            throw guard.deny(user, "challenge-photo:" + memberId, Msg.t("challenge.esta_pessoa_nao_autorizou_a"));
        }
        LocalDate d = day == null ? today() : day;
        if (!evidence.existsByInstanceIdAndUserIdAndEvidenceTypeAndRefId(id, memberId, "REAL_PHOTO", dayRef(id, d))) {
            throw ApiException.notFound(Msg.t("challenge.foto_do_dia"));
        }
        ChallengeEvent e = new ChallengeEvent();
        e.setId(UUID.randomUUID());
        e.setInstanceId(id);
        e.setUserId(memberId);
        e.setEvidenceType("REAL_PHOTO_CONFIRMED");
        e.setRefId(dayRef(id, d));
        if (!evidence.existsByInstanceIdAndUserIdAndEvidenceTypeAndRefId(id, memberId, "REAL_PHOTO_CONFIRMED", dayRef(id, d))) {
            evidence.save(e);
        }
        refresh(i, t);
        return Map.of("confirmed", true);
    }

    // ================================================================== card de resultado (CA12/CA17)
    @Transactional(readOnly = true)
    public Map<String, Object> resultCard(CurrentUser user, UUID id) {
        ChallengeInstance i = instance(id);
        ChallengeTemplate t = templates.findById(i.getTemplateCode()).orElseThrow();
        ChallengeParticipant me = participants.findByInstanceIdAndUserId(id, user.id())
                .orElseThrow(() -> guard.deny(user, "challenge:" + id, Msg.t("challenge.voce_nao_participa_deste_desafio")));
        Map<String, Object> card = new LinkedHashMap<>();
        card.put("title", t.getName());
        card.put("mode", i.getMode());
        card.put("format", "9:16");
        if (t.getCode().equals("DAILY_CHALLENGE")) {
            Map<String, Object> params = Json.map(i.getParamsJson());
            String grid = String.valueOf(Json.map(me.getPersonalGoalJson()).getOrDefault("grid", "⬜"));
            card.put("text", Msg.t("challenge.desafio_do_dia", params.getOrDefault("number", ""), grid));
            card.put("grid", grid);
            card.put("note", Msg.t("challenge.grade_compartilhavel_sem_expor_as"));
            return card;
        }
        Progress pr = progress(i, me, t);
        card.put("fraction", round2(Math.max(pr.fraction(), me.getProgressFraction().doubleValue())));
        card.put("best", Math.max(pr.best(), me.getBestRecord()));
        card.put("label", pr.label());
        card.put("result", Json.map(i.getResultJson()));
        card.put("excludes", List.of(Msg.t("common.preco"), Msg.t("challenge.custo_por_uso"), "marcas", "acervo completo"));
        return card;
    }

    // ================================================================== desafios da comunidade (§7)
    public record ProposalRequest(String name, List<Map<String, Object>> blocks, List<String> modes, Integer durationDays) {
    }

    @Transactional
    public Map<String, Object> propose(CurrentUser user, ProposalRequest req) {
        guard.requireCanCreate(user);
        String name = InputSanitizer.moderated("nome", req.name() == null ? "" : req.name(), 60);
        if (name.isBlank()) {
            throw ApiException.badRequest("NOME_OBRIGATORIO", Msg.t("challenge.de_um_nome_ao_desafio"));
        }
        if (req.blocks() == null || req.blocks().isEmpty() || req.blocks().size() > 4) {
            throw ApiException.badRequest("BLOCOS_INVALIDOS", Msg.t("challenge.use_de_1_a_4"));
        }
        List<Map<String, Object>> clean = new ArrayList<>();
        Set<String> families = new HashSet<>(Taxonomy.COLOR_FAMILY.values());
        for (Map<String, Object> b : req.blocks()) {
            String type = String.valueOf(b.get("type"));
            Object v = b.get("value");
            if (!RULE_BLOCK_TYPES.contains(type)) {
                throw ApiException.badRequest("BLOCO_INVALIDO", Msg.t("challenge.bloco_desconhecido_use", type, RULE_BLOCK_TYPES));
            }
            boolean ok = switch (type) {
                case "color_family" -> families.contains(String.valueOf(v));
                case "category" -> Taxonomy.isValidCategory(String.valueOf(v));
                case "origin" -> List.of(String.valueOf(v).split("\\|")).stream().allMatch(ORIGINS::contains);
                case "state" -> Set.of("forgotten", "favorite", "available").contains(String.valueOf(v));
                case "slot" -> MirrorService.SLOTS.contains(String.valueOf(v));
                case "piece_count", "distinct_colors", "unused_days" -> v instanceof Number n && n.intValue() > 0 && n.intValue() <= 365;
                default -> true;
            };
            if (!ok) {
                throw ApiException.badRequest("BLOCO_INVALIDO", Msg.t("challenge.valor_invalido_para_o_bloco", type));
            }
            Map<String, Object> cb = new LinkedHashMap<>();
            cb.put("type", type);
            cb.put("value", v);
            cb.put("quantifier", "all".equalsIgnoreCase(String.valueOf(b.get("quantifier"))) ? "all" : "any");
            clean.add(cb);
        }
        List<String> modes = req.modes() == null || req.modes().isEmpty() ? List.of("SOLO") : req.modes().stream()
                .map(m -> m.toUpperCase(Locale.ROOT)).filter(m -> m.equals("SOLO") || m.equals("EQUIPE")).distinct().toList();
        int duration = req.durationDays() == null ? 7 : Math.max(1, Math.min(30, req.durationDays()));
        ChallengeTemplate t = new ChallengeTemplate();
        t.setCode(("COM_" + UUID.randomUUID().toString().replace("-", "")).substring(0, 16).toUpperCase(Locale.ROOT));
        t.setName(name);
        t.setRuleText(describe(clean) + " por " + duration + " dia(s)");
        t.setRuleBlocksJson(Json.write(clean));
        t.setModesAllowedJson(Json.write(modes.isEmpty() ? List.of("SOLO") : modes));
        t.setDurationDays(duration);
        t.setScoreDimensionsJson(Json.write(List.of("U", "R")));
        t.setRewardPoints(Math.min(150, 20 * duration));
        t.setEffort(duration <= 3 ? "BAIXO" : duration <= 10 ? "MEDIO" : "ALTO");
        t.setMinParticipants(1);
        t.setMaxParticipants(6);
        t.setOrigin("COMMUNITY");
        t.setAuthorUserId(user.id());
        t.setActive(true);
        templates.save(t);
        audit.log(user, "DESAFIO_PROPOSTO", "challenge-template:" + t.getCode(), Map.of("blocks", clean.size()));
        return Map.of("code", t.getCode(), "name", t.getName(), "rule", t.getRuleText(), "note",
                Msg.t("challenge.os_desafios_da_comunidade_com"));
    }

    static String describe(List<Map<String, Object>> blocks) {
        return blocks.stream().map(b -> {
            String q = "all".equals(b.get("quantifier")) ? Msg.t("challenge.so_pecas") : Msg.t("challenge.uma_peca");
            Object v = b.get("value");
            return switch (String.valueOf(b.get("type"))) {
                case "color_family" -> q + "da cor " + v;
                case "category" -> q + "da categoria " + v;
                case "origin" -> q + "com origem " + String.valueOf(v).toLowerCase(Locale.ROOT).replace("|", " ou ");
                case "state" -> q + ("forgotten".equals(v) ? "esquecida" : "favorite".equals(v) ? "favorita" : Msg.t("challenge.disponivel"));
                case "unused_days" -> Msg.t("challenge.uma_peca_sem_uso_ha", v);
                case "slot" -> Msg.t("challenge.uma_peca_no_slot", v);
                case "monochrome" -> Msg.t("challenge.look_monocromatico_2");
                case "neutral_only" -> Msg.t("challenge.so_pecas_neutras_2");
                case "distinct_colors" -> Msg.t("challenge.familias_de_cor", (v));
                case "piece_count" -> Msg.t("challenge.ate_pecas", v);
                default -> String.valueOf(b.get("type"));
            };
        }).collect(Collectors.joining(" + "));
    }

    /** Admin (RF25) — promove um desafio da comunidade ao catálogo oficial mantendo o autor. */
    @Transactional
    public Map<String, Object> promote(CurrentUser admin, String code) {
        guard.requireAdmin(admin);
        ChallengeTemplate t = templates.findById(code).orElseThrow(() -> ApiException.notFound("Desafio"));
        t.setOrigin("OFFICIAL");
        templates.save(t);
        return Map.of("code", code, "origin", "OFFICIAL", "author", String.valueOf(t.getAuthorUserId()));
    }

    // ================================================================== minhas participações
    List<Map<String, Object>> mineRaw(UUID userId) {
        List<ChallengeParticipant> mine = participants.findByUserId(userId);
        if (mine.isEmpty()) {
            return List.of();
        }
        Map<UUID, ChallengeInstance> byId = instances.findByIdIn(mine.stream().map(ChallengeParticipant::getInstanceId).toList()).stream()
                .collect(Collectors.toMap(ChallengeInstance::getId, x -> x));
        List<Map<String, Object>> out = new ArrayList<>();
        for (ChallengeParticipant p : mine) {
            ChallengeInstance i = byId.get(p.getInstanceId());
            if (i == null) {
                continue;
            }
            ChallengeTemplate t = templates.findById(i.getTemplateCode()).orElse(null);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i.getId());
            m.put("code", i.getTemplateCode());
            m.put("name", t == null ? i.getTemplateCode() : t.getName());
            m.put("mode", i.getMode());
            m.put("state", i.getState());
            m.put("myStatus", p.getStatus());
            m.put("fraction", round2(p.getProgressFraction().doubleValue()));
            m.put("endsAt", i.getEndsAt());
            m.put("acceptDeadline", i.getAcceptDeadline());
            out.add(m);
        }
        out.sort(Comparator.comparing((Map<String, Object> m) -> String.valueOf(m.get("state"))));
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> mine(CurrentUser user) {
        List<Map<String, Object>> all = mineRaw(user.id());
        return Map.of(
                "active", all.stream().filter(m -> ATIVO.equals(m.get("state")) && P_ATIVO.equals(m.get("myStatus"))).toList(),
                "waiting", all.stream().filter(m -> AGUARDANDO.equals(m.get("state"))).toList(),
                "invites", all.stream().filter(m -> P_CONVIDADO.equals(m.get("myStatus")) && AGUARDANDO.equals(m.get("state"))).toList(),
                "drafts", all.stream().filter(m -> RASCUNHO.equals(m.get("state"))).toList(),
                "history", all.stream().filter(m -> CONCLUIDO.equals(m.get("state")) || EXPIRADO.equals(m.get("state"))
                        || P_SAIU.equals(m.get("myStatus")) || P_CONCLUIU.equals(m.get("myStatus"))).toList(),
                "maxActive", MAX_ACTIVE);
    }

    // ================================================================== integração com o quarto e o Vista-me
    /** RF36.CA13 — elemento visual do desafio ativo no quarto; some quando o desafio termina. */
    @Override
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> decorations(UUID userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] row : activeParticipations(userId)) {
            ChallengeInstance i = (ChallengeInstance) row[0];
            ChallengeParticipant p = (ChallengeParticipant) row[1];
            ChallengeTemplate t = (ChallengeTemplate) row[2];
            if (t.getRoomDecoration() == null) {
                continue;
            }
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("challengeId", i.getId());
            d.put("type", t.getRoomDecoration());
            d.put("name", t.getName());
            Map<String, Object> params = Json.map(i.getParamsJson());
            switch (t.getRoomDecoration()) {
                case "quadro_cortica" -> {
                    List<Map<String, Object>> polaroids = evidence.findByInstanceIdAndUserId(i.getId(), userId).stream()
                            .filter(e -> "LOOK".equals(e.getEvidenceType())).map(e -> schemes.findById(e.getRefId()).orElse(null)).filter(Objects::nonNull)
                            .map(s -> Map.<String, Object>of("schemeId", s.getId(), "coverImageUrl", String.valueOf(s.getCoverImageUrl()))).toList();
                    d.put("days", t.getDurationDays());
                    d.put("polaroids", polaroids);
                }
                case "fita_alfaiate" -> {
                    Set<String> capsule = new HashSet<>(Json.strings(Json.write(params.get("piece_ids"))));
                    d.put("tapedPieceIds", pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().map(w -> w.getId().toString())
                            .filter(x -> !capsule.contains(x)).toList());
                }
                case "etiqueta_2a_chance" -> {
                    Set<UUID> rescued = evidence.findByInstanceIdAndUserId(i.getId(), userId).stream().filter(e -> "RESCUE".equals(e.getEvidenceType()))
                            .map(ChallengeEvent::getRefId).collect(Collectors.toSet());
                    d.put("taggedPieceIds", Json.strings(Json.write(Json.map(p.getPersonalGoalJson()).get("forgotten"))).stream()
                            .filter(x -> !rescued.contains(UUID.fromString(x))).toList());
                }
                case "calendario_parede" -> d.put("days", progress(i, p, t).value());
                case "tema_espelho" -> d.put("theme", params.getOrDefault("theme", runwayTheme(today())));
                default -> {
                }
            }
            out.add(d);
        }
        return out;
    }

    /** RF36.CA14 — 10×10 e Temporada Cápsula restringem o Vista-me e o Copilot às peças do desafio. */
    @Override
    public Optional<Restriction> restriction(UUID userId) {
        for (Object[] row : activeParticipations(userId)) {
            ChallengeInstance i = (ChallengeInstance) row[0];
            ChallengeTemplate t = (ChallengeTemplate) row[2];
            if (t.getCode().equals("TEN_X_TEN") || t.getCode().equals("CAPSULE_SEASON")) {
                Set<UUID> allowed = Json.strings(Json.write(Json.map(i.getParamsJson()).get("piece_ids"))).stream().map(UUID::fromString)
                        .collect(Collectors.toCollection(LinkedHashSet::new));
                return Optional.of(new Restriction(t.getName(), allowed));
            }
        }
        return Optional.empty();
    }

    /** Resumo para o Copilot (RF10): desafios ativos e regras em vigor. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> activeSummary(UUID userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] row : activeParticipations(userId)) {
            ChallengeInstance i = (ChallengeInstance) row[0];
            ChallengeParticipant p = (ChallengeParticipant) row[1];
            ChallengeTemplate t = (ChallengeTemplate) row[2];
            out.add(Map.of("id", i.getId().toString(), "name", t.getName(), "rule", t.getRuleText(), "mode", i.getMode(),
                    "fraction", round2(p.getProgressFraction().doubleValue())));
        }
        return out;
    }
}
