package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.event.TransactionPhase;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.WardrobeAvailabilityChange;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.WardrobeAvailabilityChangeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Efeitos colaterais dos eventos de domínio (RF32–RF36) fora dos serviços de origem: diário de uso da peça
 * (base da Utilização e das peças esquecidas), histórico de disponibilidade (RF34 §3.3) e FAI Points (RF35 §5.2).
 * Nenhum listener pode quebrar a ação principal: rodam depois do commit, em transação própria (SideEffectRunner).
 */
@Component
public class WardrobeEventListeners {
    private static final Logger log = LoggerFactory.getLogger(WardrobeEventListeners.class);

    private final PieceUsageDiaryEntryRepository diary;
    private final WardrobeAvailabilityChangeRepository availability;
    private final WardrobeItemRepository pieces;
    private final FaiPointsService points;
    private final SideEffectRunner sideEffects;

    public WardrobeEventListeners(PieceUsageDiaryEntryRepository diary, WardrobeAvailabilityChangeRepository availability,
                                  WardrobeItemRepository pieces, FaiPointsService points, SideEffectRunner sideEffects) {
        this.sideEffects = sideEffects;
        this.diary = diary;
        this.availability = availability;
        this.pieces = pieces;
        this.points = points;
    }

    /** Depois do commit, em transação própria: falha aqui não desfaz nem derruba a ação principal. */
    private void safe(String what, Runnable r) {
        sideEffects.run(what, r);
    }

    /** Última data de uso conhecida antes de registrar a nova (diário + lastWornDate). */
    LocalDate lastUseBefore(WardrobeItem w, LocalDate day) {
        LocalDate last = diary.findByWardrobeItemIdOrderByUsedOnDesc(w.getId()).stream().map(PieceUsageDiaryEntry::getUsedOn)
                .filter(d -> d.isBefore(day)).findFirst().orElse(null);
        LocalDate worn = w.getLastWornDate() != null && w.getLastWornDate().isBefore(day) ? w.getLastWornDate() : null;
        if (last == null) {
            return worn;
        }
        return worn == null || last.isAfter(worn) ? last : worn;
    }

    /** Registra o uso (1× por peça e dia — RF34 §5) e detecta resgate de peça esquecida (+30 pts, 3/dia). */
    void recordUse(UUID userId, List<UUID> pieceIds, LocalDate day, String source, UUID schemeId, String occasion) {
        for (UUID id : pieceIds) {
            if (diary.existsByWardrobeItemIdAndUsedOn(id, day)) {
                continue;
            }
            WardrobeItem w = pieces.findById(id).orElse(null);
            if (w == null || !w.getUser().getId().equals(userId)) {
                continue;
            }
            LocalDate last = lastUseBefore(w, day);
            LocalDate ref = last != null ? last : w.getCreatedAt() == null ? day : LocalDate.ofInstant(w.getCreatedAt(), FaiPointsService.ZONE);
            boolean wasForgotten = ChronoUnit.DAYS.between(ref, day) >= RoomService.FORGOTTEN_DAYS;
            PieceUsageDiaryEntry e = new PieceUsageDiaryEntry();
            e.setWardrobeItemId(id);
            e.setUserId(userId);
            e.setUsedOn(day);
            e.setSource(source);
            e.setSchemeId(schemeId);
            e.setOccasion(occasion);
            e.setNote(wasForgotten ? Msg.t("wardrobeEventListeners.resgate_dias_sem_uso", ChronoUnit.DAYS.between(ref, day)) : null);
            diary.save(e);
            if (wasForgotten) {
                points.award(userId, "FORGOTTEN_RESCUED", "PIECE", id + ":" + day, null);
            }
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSchemeSaved(DomainEvents.SchemeSaved ev) {
        safe("SchemeSaved", () -> {
            LocalDate today = LocalDate.now(FaiPointsService.ZONE);
            recordUse(ev.userId(), ev.pieceIds(), today, "SCHEME", ev.schemeId(), null);
            if (ev.created()) {
                points.award(ev.userId(), "SCHEME_CREATED", "SCHEME", ev.schemeId().toString(), null);
            }
        });
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onDailyLook(DomainEvents.DailyLookRegistered ev) {
        safe("DailyLookRegistered", () -> {
            recordUse(ev.userId(), ev.pieceIds(), ev.date(), "DAILY_LOOK", ev.schemeId(), null);
            for (UUID id : ev.pieceIds()) {
                pieces.findById(id).ifPresent(w -> {
                    w.setWearCount(w.getWearCount() + 1);
                    pieces.save(w);
                });
            }
            if ("VISTA_ME".equals(ev.source())) {
                points.award(ev.userId(), "VISTA_ME_DAILY_LOOK", "DAILY_LOOK", ev.date().toString(), null);
            }
        });
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPieceCreated(DomainEvents.PieceCreated ev) {
        safe("PieceCreated", () -> {
            WardrobeAvailabilityChange c = new WardrobeAvailabilityChange();
            c.setWardrobeItemId(ev.pieceId());
            c.setUserId(ev.userId());
            c.setAvailable(true);
            c.setChangedAt(Instant.now());
            availability.save(c);
            if (ev.readyForCatalog()) {
                points.award(ev.userId(), "PIECE_CATALOGED", "PIECE", ev.pieceId().toString(), null);
            }
        });
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPieceUpdated(DomainEvents.PieceUpdated ev) {
        safe("PieceUpdated", () -> {
            // RF41: peça cadastrada sem foto real pontua quando fica pronta para o catálogo (1× por peça)
            pieces.findById(ev.pieceId()).filter(InventoryScoreService::catalogReady)
                    .ifPresent(w -> points.award(ev.userId(), "PIECE_CATALOGED", "PIECE", ev.pieceId().toString(), null));
            if (ev.completeness() >= 90) {
                points.award(ev.userId(), "PIECE_COMPLETED", "PIECE", ev.pieceId().toString(), null);
            }
        });
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onAvailability(DomainEvents.AvailabilityChanged ev) {
        safe("AvailabilityChanged", () -> {
            WardrobeAvailabilityChange c = new WardrobeAvailabilityChange();
            c.setWardrobeItemId(ev.pieceId());
            c.setUserId(ev.userId());
            c.setAvailable(ev.available());
            c.setChangedAt(Instant.now());
            availability.save(c);
        });
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onModel3d(DomainEvents.Model3dGenerated ev) {
        safe("Model3dGenerated", () -> points.award(ev.userId(), "PIECE_3D", "PIECE", ev.pieceId().toString(), null));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onInteraction(DomainEvents.InteractionReceived ev) {
        safe("InteractionReceived", () -> {
            if (ev.ownerId() == null || ev.ownerId().equals(ev.actorId())) {
                return; // interação consigo mesmo não pontua
            }
            String code = switch (ev.kind()) {
                case "LIKE" -> "LIKE_RECEIVED";
                case "COMMENT" -> "COMMENT_RECEIVED";
                case "REMIX" -> "REMIX_RECEIVED";
                default -> null;
            };
            if (code != null) {
                points.award(ev.ownerId(), code, ev.kind(), ev.targetId() + ":" + ev.actorId(), null);
            }
        });
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onRoomOrganized(DomainEvents.RoomOrganized ev) {
        safe("RoomOrganized", () -> points.award(ev.userId(), "ROOM_ORGANIZED", "ROOM", null, null));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPieceWorn(DomainEvents.PieceWorn ev) {
        // o diário manual já foi gravado pelo RoomService; aqui só o resgate conta pontos
        safe("PieceWorn", () -> diary.findByWardrobeItemIdOrderByUsedOnDesc(ev.pieceId()).stream().filter(e -> e.getUsedOn().equals(ev.date()))
                .findFirst().ifPresent(e -> {
                    if (e.getNote() != null && e.getNote().startsWith("resgate")) {
                        points.award(ev.userId(), "FORGOTTEN_RESCUED", "PIECE", ev.pieceId() + ":" + ev.date(), null);
                    }
                }));
    }

    public Map<String, Object> describe() {
        return Map.of("listeners", List.of("SchemeSaved", "DailyLookRegistered", "PieceCreated", "PieceUpdated", "AvailabilityChanged",
                "Model3dGenerated", "InteractionReceived", "RoomOrganized", "PieceWorn"));
    }
}
