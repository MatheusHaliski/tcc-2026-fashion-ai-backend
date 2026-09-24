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

    public record MirrorAction(UUID userId, String action) {
    }

    /** Card Trello RF38 — reavaliar os direitos promocionais (cupons) do usuário depois de uma conquista. */
    public record CouponRightsCheck(UUID userId) {
    }

    public record RoomOrganized(UUID userId) {
    }
}
