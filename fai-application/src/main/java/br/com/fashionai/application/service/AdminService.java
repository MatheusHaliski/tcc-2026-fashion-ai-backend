package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCatalog;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeLiveRecalc;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.moderation.UploadQuarantine;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.ports.BackupPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BackupRecord;
import br.com.fashionai.domain.model.ModerationQueueItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ModerationQueueStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.repository.AiInferenceLogRepository;
import br.com.fashionai.domain.repository.AuditLogRepository;
import br.com.fashionai.domain.repository.BackupRecordRepository;
import br.com.fashionai.domain.repository.CommentRepository;
import br.com.fashionai.domain.repository.ModerationQueueRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Administração (perfil ADMIN): validação de Marcas e Celebridades (RF1.CA07/CA09) com selos padrão, fila de
 * moderação (RF24/RNF), gestão de contas (suspender/reativar e encerrar sessões), auditoria (RNF5), logs e catálogo
 * de IA (RF24.CA16), backups, sincronização de assets, promoção de desafios da comunidade e disparo de jobs.
 */
@Service
public class AdminService {
    private final UserRepository users;
    private final ModerationQueueRepository moderation;
    private final WardrobeItemRepository pieces;
    private final CommentRepository comments;
    private final AuditLogRepository auditLogs;
    private final AiInferenceLogRepository aiLogs;
    private final BackupRecordRepository backups;
    private final ObjectProvider<BackupPort> backupPort;
    private final AnalyticsQueryPort analytics;
    private final IdentityService identity;
    private final NotificationService notifications;
    private final UploadQuarantine quarantine;
    private final AssetCatalogService assets;
    private final ChallengeService challenges;
    /** HypeScore v2 — snapshots multidimensionais com algorithmVersion (o job "hype"; o v1 do RF6 saiu em P3-16) */
    private final br.com.fashionai.application.hype.HypeSnapshotService hypeV2;
    private final InventoryScoreService inventory;
    private final AiEngine ai;
    private final Guard guard;
    private final Audit audit;
    /** Quantos backups COMPLETED manter (os mais antigos têm o arquivo apagado do storage). */
    @Value("${fashionai.backup.retention-count:14}")
    private int backupRetention = 14;
    /** HypeScore v2 (P3-14): configuração ativa e recálculo ao vivo, só para exibir o estado em Admin › Sistema. */
    private final HypeScoreConfig hypeConfig;
    private final ObjectProvider<HypeLiveRecalc> hypeLive;
    /** Mesmas propriedades (e padrões) de HypeSnapshotService e HypeLiveRecalc: aqui só são lidas para exibição. */
    @Value("${fashionai.hype.cron:0 20 */6 * * *}")
    private String hypeCron = "0 20 */6 * * *";
    @Value("${fashionai.hype.live-recalc-enabled:true}")
    private boolean hypeLiveEnabled = true;
    @Value("${fashionai.hype.live-recalc-seconds:120}")
    private long hypeLiveSeconds = 120;

    public AdminService(UserRepository users, ModerationQueueRepository moderation,
                        WardrobeItemRepository pieces, CommentRepository comments, AuditLogRepository auditLogs, AiInferenceLogRepository aiLogs,
                        BackupRecordRepository backups, ObjectProvider<BackupPort> backupPort, AnalyticsQueryPort analytics,
                        IdentityService identity, NotificationService notifications, AssetCatalogService assets, ChallengeService challenges,
                        InventoryScoreService inventory, AiEngine ai, Guard guard, Audit audit,
                        UploadQuarantine quarantine, br.com.fashionai.application.hype.HypeSnapshotService hypeV2,
                        HypeScoreConfig hypeConfig, ObjectProvider<HypeLiveRecalc> hypeLive) {
        this.quarantine = quarantine;
        this.hypeV2 = hypeV2;
        this.hypeConfig = hypeConfig;
        this.hypeLive = hypeLive;
        this.users = users;
        this.moderation = moderation;
        this.pieces = pieces;
        this.comments = comments;
        this.auditLogs = auditLogs;
        this.aiLogs = aiLogs;
        this.backups = backups;
        this.backupPort = backupPort;
        this.analytics = analytics;
        this.identity = identity;
        this.notifications = notifications;
        this.assets = assets;
        this.challenges = challenges;
        this.inventory = inventory;
        this.ai = ai;
        this.guard = guard;
        this.audit = audit;
    }

    // aprovações de marca/celebridade (RF1.CA07–CA09): IssuerReviewService, com a política de verificação

    // ================================================================== moderação
    @Transactional(readOnly = true)
    public List<Map<String, Object>> moderationQueue(CurrentUser admin) {
        guard.requireAdmin(admin);
        return moderation.findByStatusOrderByCreatedAtAsc(ModerationQueueStatus.PENDING_REVIEW).stream().map(q -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", q.getId());
            m.put("targetType", q.getTargetType());
            m.put("targetId", q.getTargetId());
            m.put("userId", q.getUserId());
            m.put("excerpt", q.getContentExcerpt());
            m.put("categories", Json.strings(q.getCategoriesJson()));
            m.put("confidence", q.getConfidence());
            m.put("createdAt", q.getCreatedAt());
            if ("PIECE".equals(q.getTargetType()) && q.getTargetId() != null) {
                pieces.findById(q.getTargetId()).ifPresent(w -> m.put("imageUrl", w.getImageUrl()));
            } else if (UploadQuarantine.TARGET.equals(q.getTargetType())) {
                // foto retida pela moderação: a imagem sai só pelo endpoint autenticado do admin (restricted/)
                Map<String, Object> meta = UploadQuarantine.meta(q);
                m.put("categories", UploadQuarantine.reasons(q));
                m.put("upload", Map.of("kind", String.valueOf(meta.get("kind")), "engine", String.valueOf(meta.get("engine")),
                        "signals", meta.getOrDefault("signals", Map.of())));
                m.put("imageEndpoint", "/api/admin/moderation/" + q.getId() + "/image");
            }
            return m;
        }).toList();
    }

    @Transactional
    public Map<String, Object> moderate(CurrentUser admin, UUID itemId, boolean approve, String reason) {
        guard.requireAdmin(admin);
        ModerationQueueItem q = moderation.findById(itemId).orElseThrow(() -> ApiException.notFound(Msg.t("admin.item_de_moderacao")));
        q.setStatus(approve ? ModerationQueueStatus.APPROVED : ModerationQueueStatus.REJECTED);
        q.setReviewedBy(admin.id());
        q.setReviewedAt(Instant.now());
        q.setReason(reason == null ? null : InputSanitizer.clean(reason, 300));
        if ("PIECE".equals(q.getTargetType()) && q.getTargetId() != null) {
            pieces.findById(q.getTargetId()).ifPresent(w -> w.setModerationStatus(approve ? ModerationStatus.APPROVED : ModerationStatus.REJECTED_POLICY));
        } else if ("COMMENT".equals(q.getTargetType()) && q.getTargetId() != null && !approve) {
            comments.findById(q.getTargetId()).ifPresent(c -> c.setActive(false));
        } else if (UploadQuarantine.TARGET.equals(q.getTargetType())) {
            quarantine.decide(q, admin.id(), approve);
        }
        audit.log(admin, approve ? "MODERACAO_APROVADA" : "MODERACAO_REJEITADA", q.getTargetType() + ":" + q.getTargetId(), Map.of());
        return Map.of("id", itemId, "status", q.getStatus().name());
    }

    /** Foto retida pela moderação, para o admin revisar (o arquivo fica em restricted/). */
    @Transactional(readOnly = true)
    public byte[] moderationImage(CurrentUser admin, UUID itemId) {
        guard.requireAdmin(admin);
        ModerationQueueItem q = moderation.findById(itemId).orElseThrow(() -> ApiException.notFound(Msg.t("admin.item_de_moderacao")));
        if (!UploadQuarantine.TARGET.equals(q.getTargetType()) || q.getStatus() != ModerationQueueStatus.PENDING_REVIEW) {
            throw ApiException.notFound(Msg.t("admin.item_de_moderacao"));
        }
        audit.log(admin, "MODERACAO_FOTO_VISTA", "UPLOAD:" + q.getTargetId(), Map.of());
        return quarantine.image(q);
    }

    // ================================================================== contas
    @Transactional(readOnly = true)
    public List<Views.UserCard> searchUsers(CurrentUser admin, String term) {
        guard.requireAdmin(admin);
        return users.searchByUsername(term == null ? "" : term.trim(), PageRequest.of(0, 50)).stream().map(Views::user).toList();
    }

    @Transactional
    public Map<String, Object> setStatus(CurrentUser admin, UUID userId, boolean suspend, String reason) {
        guard.requireAdmin(admin);
        if (admin.id().equals(userId)) {
            throw ApiException.badRequest("AUTO_SUSPENSAO", Msg.t("admin.voce_nao_pode_suspender_a"));
        }
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("Conta"));
        u.setStatus(suspend ? AccountStatus.SUSPENDED : AccountStatus.ACTIVE);
        users.save(u);
        int revoked = suspend ? identity.revokeOtherSessions(userId, null) : 0;
        audit.log(admin, suspend ? "CONTA_SUSPENSA" : "CONTA_REATIVADA", "user:" + userId, Map.of("reason", String.valueOf(reason), "sessionsRevoked", revoked));
        return Map.of("userId", userId, "status", u.getStatus().name(), "sessionsRevoked", revoked);
    }

    @Transactional
    public Map<String, Object> setRole(CurrentUser admin, UUID userId, String role) {
        guard.requireAdmin(admin);
        if (!List.of("USER", "ADMIN").contains(role)) {
            throw ApiException.badRequest("PAPEL_INVALIDO", Msg.t("admin.papeis_user_ou_admin"));
        }
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("Conta"));
        u.setRole(role);
        users.save(u);
        audit.log(admin, "PAPEL_ALTERADO", "user:" + userId, Map.of("role", role));
        return Map.of("userId", userId, "role", role);
    }

    // ================================================================== auditoria e IA
    @Transactional(readOnly = true)
    public List<Map<String, Object>> auditLog(CurrentUser admin, String actor) {
        guard.requireAdmin(admin);
        var list = actor == null || actor.isBlank() ? auditLogs.findTop200ByOrderByTimestampDesc() : auditLogs.findTop100ByActorOrderByTimestampDesc(actor);
        return list.stream().map(a -> Map.<String, Object>of("actor", a.getActor(), "action", a.getAcao(), "resource", a.getRecurso(), "result", a.getResultado(),
                "ip", String.valueOf(a.getIp()), "timestamp", a.getTimestamp(), "correlationId", a.getCorrelationId(), "metadata", Json.map(a.getMetadataJson()))).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> aiOverview(CurrentUser admin) {
        guard.requireAdmin(admin);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("providers", ai.providerAvailability());
        out.put("remoteEnabled", ai.remoteEnabled());
        out.put("catalog", AiCatalog.all().stream().map(s -> Map.of("capability", s.capability().name(), "name", s.capability().officialName(),
                "hostRf", s.capability().hostRf(), "primary", s.primary() == null ? "" : s.primary().service() + " · " + s.primary().model(),
                "fallback", s.fallbackBehavior(), "dailyQuota", s.dailyQuotaPerUser(), "status", s.status())).toList());
        out.put("recent", aiLogs.findTop300ByOrderByCreatedAtDesc().stream().limit(100).map(l -> Map.<String, Object>of("capability", l.getCapability(),
                "provider", l.getProvider(), "model", String.valueOf(l.getModel()), "latencyMs", l.getLatencyMs(), "costUsd", String.valueOf(l.getEstimatedCostUsd()),
                "result", l.getResult().name(), "fallback", l.isFallbackUsed(), "at", l.getCreatedAt())).toList());
        // Admin › Sistema (IA & sistema) lê o estado do job v2 deste mesmo endpoint (campo aditivo, P3-14)
        out.put("hypeV2", hypeV2State());
        return out;
    }

    /**
     * HypeScore v2 em Admin › Sistema (P3-14): versão do algoritmo, último cálculo gravado (job de 6 h ou recálculo ao
     * vivo — lido de hype_scores, nada é recalculado aqui), agenda do job, recálculo ao vivo (ligado, intervalo, pendente)
     * e cobertura por tipo (AVAILABLE · INSUFFICIENT · NOT_CALCULATED). O v1 continua no mesmo job "hype" até P3-16.
     */
    Map<String, Object> hypeV2State() {
        String version = hypeConfig.algorithmVersion();
        Map<String, Object> m = new LinkedHashMap<>(DashboardService.hypeJob(analytics.hypeJobV2(version), hypeConfig, Instant.now()));
        m.put("cron", hypeCron);
        HypeLiveRecalc live = hypeLive.getIfAvailable();
        Map<String, Object> l = new LinkedHashMap<>();
        l.put("enabled", hypeLiveEnabled && live != null);
        l.put("intervalSeconds", Math.max(10, hypeLiveSeconds));
        l.put("pending", live != null && live.isDirty());
        m.put("live", l);
        m.put("coverage", DashboardService.hypeV2Block(List.of(), analytics.hypeCoverageV2(
                new AnalyticsQueryPort.Filter(Instant.EPOCH, Instant.now(), null, null), version), Map.of(), hypeConfig, Instant.now()).get("coverage"));
        return m;
    }

    // ================================================================== backups (RNF) e jobs
    /**
     * Backup manual. Sem transação envolvendo o dump (pode levar minutos): o registro RUNNING aparece na hora e o
     * resultado (COMPLETED/FAILED com o motivo) é gravado ao fim; falhas também vão para o log como ERROR.
     */
    public Map<String, Object> runBackup(CurrentUser admin) {
        guard.requireAdmin(admin);
        BackupRecord r = new BackupJob(backups, backupPort.getIfAvailable(), backupRetention).run("manual");
        audit.log(admin, "BACKUP_EXECUTADO", "backup:" + r.getId(), Map.of("ok", BackupJob.COMPLETED.equals(r.getStatus())));
        return Map.of("id", r.getId(), "status", r.getStatus(), "notes", String.valueOf(r.getNotes()));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> backups(CurrentUser admin) {
        guard.requireAdmin(admin);
        return backups.findTop50ByOrderByStartedAtDesc().stream().map(b -> Map.<String, Object>of("id", b.getId(), "kind", b.getKind(), "status", b.getStatus(),
                "sizeBytes", String.valueOf(b.getSizeBytes()), "startedAt", b.getStartedAt(), "finishedAt", String.valueOf(b.getFinishedAt()),
                "notes", String.valueOf(b.getNotes()))).toList();
    }

    /**
     * Backup diário automático às 3 h (BACKUP_CRON; "-" desliga). Falha fica registrada como FAILED e logada como
     * ERROR; com sucesso, a retenção mantém só os BACKUP_RETENTION_COUNT mais recentes.
     */
    @Scheduled(cron = "${fashionai.backup.cron:0 0 3 * * *}", zone = "America/Sao_Paulo")
    public void scheduledBackup() {
        new BackupJob(backups, backupPort.getIfAvailable(), backupRetention).run("agendado");
    }

    private br.com.fashionai.application.moments.MomentService moments;

    /** Momentos: job de status/avisos pelo painel (injeção opcional para não alterar o construtor usado nos testes). */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setMoments(br.com.fashionai.application.moments.MomentService moments) {
        this.moments = moments;
    }

    @Transactional
    public Map<String, Object> runJob(CurrentUser admin, String job) {
        guard.requireAdmin(admin);
        Object result = switch (job == null ? "" : job) {
            case "hype" -> Map.of("v2", hypeV2.recalculate());
            case "rankings" -> inventory.recomputeRankings();
            case "challenges" -> challenges.tick();
            case "moments" -> moments == null ? Map.of() : moments.tick();
            case "assets" -> assets.syncPresets();
            case "notifications" -> analytics.purgeNotifications((int) NotificationService.RETENTION.toDays());
            default -> throw ApiException.badRequest("JOB_INVALIDO", Msg.t("admin.jobs_hype_rankings_challenges_assets"));
        };
        audit.log(admin, "JOB_EXECUTADO", "job:" + job, Map.of());
        return Map.of("job", job, "result", result);
    }

    @Transactional
    public Map<String, Object> promoteChallenge(CurrentUser admin, String code) {
        return challenges.promote(admin, code);
    }
}
