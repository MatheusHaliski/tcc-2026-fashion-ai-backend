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

    /**
     * RF53 · P1-10 — marco de Hype detectado pelo job de snapshots ({@code HypeSnapshotService}) depois de gravar o estado:
     * a peça/look SUBIU para Em alta, Tendência ou Viral, ou passou a ser emergente. Só subida (nunca queda). Consumido
     * depois do commit pelo {@code HypeMilestoneNotifier} (dedupe por entidade + marco e um resumo por dono por dia).
     * Não é sinal de Hype: nada aqui volta para {@code hype_signal_daily} nem marca o Hype como sujo.
     *
     * @param publicEligible falso = item privado/só seguidores (Hype pessoal): a notificação vai só para o dono e diz isso
     */
    public record HypeMilestone(br.com.fashionai.domain.model.enums.HypeEntityType entityType, UUID entityId, UUID ownerId,
                                br.com.fashionai.domain.model.HypeMilestone.Kind milestone,
                                br.com.fashionai.domain.model.enums.HypeLevel level, br.com.fashionai.domain.model.enums.HypeMomentum momentum,
                                Double score, boolean publicEligible) {
    }

    public record MirrorAction(UUID userId, String action) {
    }

    /** Card Trello RF38 — reavaliar os direitos promocionais (cupons) do usuário depois de uma conquista. */
    public record CouponRightsCheck(UUID userId) {
    }

    public record RoomOrganized(UUID userId) {
    }
}
