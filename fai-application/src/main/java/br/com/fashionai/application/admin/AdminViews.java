package br.com.fashionai.application.admin;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;

import br.com.fashionai.application.ai.AiCatalog;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.moderation.UploadQuarantine;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.*;

/**
 * Montagem das views de Admin (fila de moderação, trilha de auditoria, catálogo e chamadas de IA, backups) a partir das
 * entidades já carregadas. Puro: sem repositório, transação nem autorização — {@link AdminService} continua dono do
 * {@code guard.requireAdmin}, das consultas paginadas/limitadas e da auditoria das ações.
 *
 * <p>Minimização: a foto retida pela moderação nunca expõe a chave do arquivo em {@code restricted/}; sai só o endpoint
 * autenticado do admin. Campos opcionais viram texto ({@code String.valueOf}) como no contrato original do painel.
 */
public final class AdminViews {
    private AdminViews() {
    }

    /** Linha da lista de contas: o cartão público mais o papel e o estado (ativa, suspensa), que só o admin vê. */
    public static Map<String, Object> userRow(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        Views.UserCard card = Views.user(u);
        m.put("id", card.id());
        m.put("username", card.username());
        m.put("displayName", card.displayName());
        m.put("avatarUrl", card.avatarUrl());
        m.put("profileType", card.profileType());
        m.put("verified", card.verified());
        m.put("country", card.country());
        m.put("privateAccount", card.privateAccount());
        m.put("role", u.getRole());
        m.put("status", u.getStatus() == null ? null : u.getStatus().name());
        return m;
    }

    /**
     * Item PENDING_REVIEW da fila. {@code pieces} busca a peça (vazio quando ela não existe mais) para expor a
     * imagem; só é consultada para itens PIECE com alvo.
     */
    public static Map<String, Object> moderationItem(ModerationQueueItem q, Function<UUID, Optional<WardrobeItem>> pieces) {
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
            pieces.apply(q.getTargetId()).ifPresent(w -> m.put("imageUrl", w.getImageUrl()));
        } else if (UploadQuarantine.TARGET.equals(q.getTargetType())) {
            // foto retida pela moderação: a imagem sai só pelo endpoint autenticado do admin (restricted/)
            Map<String, Object> meta = UploadQuarantine.meta(q);
            m.put("categories", UploadQuarantine.reasons(q));
            m.put("upload", Map.of("kind", String.valueOf(meta.get("kind")), "engine", String.valueOf(meta.get("engine")),
                    "signals", meta.getOrDefault("signals", Map.of())));
            m.put("imageEndpoint", "/api/admin/moderation/" + q.getId() + "/image");
        }
        return m;
    }

    public static Map<String, Object> auditEntry(AuditLog a) {
        return Map.of("actor", a.getActor(), "action", a.getAcao(), "resource", a.getRecurso(), "result", a.getResultado(),
                "ip", String.valueOf(a.getIp()), "timestamp", a.getTimestamp(), "correlationId", a.getCorrelationId(),
                "metadata", Json.map(a.getMetadataJson()));
    }

    public static Map<String, Object> aiCapability(AiCatalog.CapabilitySpec s) {
        return Map.of("capability", s.capability().name(), "name", s.capability().officialName(),
                "hostRf", s.capability().hostRf(), "primary", s.primary() == null ? "" : s.primary().service() + " · " + s.primary().model(),
                "fallback", s.fallbackBehavior(), "dailyQuota", s.dailyQuotaPerUser(), "status", s.status());
    }

    public static Map<String, Object> aiCall(AiInferenceLog l) {
        return Map.of("capability", l.getCapability(), "provider", l.getProvider(), "model", String.valueOf(l.getModel()),
                "latencyMs", l.getLatencyMs(), "costUsd", String.valueOf(l.getEstimatedCostUsd()), "result", l.getResult().name(),
                "fallback", l.isFallbackUsed(), "at", l.getCreatedAt());
    }

    public static Map<String, Object> backup(BackupRecord b) {
        return Map.of("id", b.getId(), "kind", b.getKind(), "status", b.getStatus(), "sizeBytes", String.valueOf(b.getSizeBytes()),
                "startedAt", b.getStartedAt(), "finishedAt", String.valueOf(b.getFinishedAt()), "notes", String.valueOf(b.getNotes()));
    }
}
