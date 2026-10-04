package br.com.fashionai.application.events;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Eventos de domínio publicados pelos serviços (Spring ApplicationEventPublisher). Consumidos pelo quarto
 * (RF32), FAI Points (RF35), Inventory Score (RF34), Desafios (RF36) e diário de uso — sem acoplar os RFs.
 */
public final class DomainEvents {
    private DomainEvents() {
    }

    public record PieceCreated(UUID userId, UUID pieceId, boolean readyForCatalog) {
    }

    /** RF4 · peça criada a partir de uma sessão de captura adaptativa (o rascunho principal precisa ser o da sessão). */
    public record PieceCapturedFromSession(UUID userId, UUID pieceId, UUID sessionId, UUID draftId) {
    }

    public record PieceUpdated(UUID userId, UUID pieceId, int completeness) {
    }

    public record PieceDeleted(UUID userId, UUID pieceId) {
    }

    public record PieceWorn(UUID userId, UUID pieceId, LocalDate date, String occasion) {
    }

    public record Model3dGenerated(UUID userId, UUID pieceId) {
    }

    public record AchievementGranted(UUID userId, String code, boolean secret) {
    }

    public record AvailabilityChanged(UUID userId, UUID pieceId, boolean available) {
    }

    public record SchemeSaved(UUID userId, UUID schemeId, List<UUID> pieceIds, String origin, boolean created) {
    }

    public record DailyLookRegistered(UUID userId, UUID schemeId, LocalDate date, String source, List<UUID> pieceIds) {
    }

    public record InteractionReceived(UUID ownerId, UUID actorId, String kind, UUID targetId) {
    }

    /**
     * HypeScore v2 — um sinal de comportamento sobre uma peça ou look (curtida, save, compartilhamento, remix, visualização).
     * Gravado no agregado diário depois do commit, já filtrado pela política de integridade (sem auto-interação, 1 por
     * pessoa/dia, conta nova pesa menos). {@code actorId} nulo = visitante (não conta).
     */
    public record HypeSignal(br.com.fashionai.domain.model.enums.HypeSignalType signal, br.com.fashionai.domain.model.enums.HypeEntityType entityType,
                             UUID entityId, UUID actorId, UUID ownerId) {
    }

    public record MirrorAction(UUID userId, String action) {
    }

    /** Card Trello RF38 — reavaliar os direitos promocionais (cupons) do usuário depois de uma conquista. */
    public record CouponRightsCheck(UUID userId) {
    }

    public record RoomOrganized(UUID userId) {
    }
}
