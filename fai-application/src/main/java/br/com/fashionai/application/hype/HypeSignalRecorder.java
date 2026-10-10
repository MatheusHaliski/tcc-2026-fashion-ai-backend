package br.com.fashionai.application.hype;

import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.repository.HypeSignalDailyRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

/**
 * HypeScore v2 — grava os sinais no agregado diário ({@code hype_signal_daily}) depois do commit da ação, em transação
 * própria (uma falha aqui nunca derruba a curtida/save/look). Nada é recalculado aqui: o score sai do job de snapshots
 * ({@link HypeSnapshotService}), que lê este agregado.
 */
@Component
public class HypeSignalRecorder {
    public static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");

    private final HypeSignalDailyRepository signals;
    private final HypeIntegrityPolicy integrity;
    private final SideEffectRunner sideEffects;

    public HypeSignalRecorder(HypeSignalDailyRepository signals, HypeIntegrityPolicy integrity, SideEffectRunner sideEffects) {
        this.signals = signals;
        this.integrity = integrity;
        this.sideEffects = sideEffects;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSignal(DomainEvents.HypeSignal s) {
        sideEffects.run("HypeSignal", () -> record(s));
    }

    /** Peça vestida (diário de uso): conta no dia do uso, não no dia do registro (entrada retroativa não vira atividade de hoje). */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPieceWorn(DomainEvents.PieceWorn ev) {
        sideEffects.run("HypeSignal:PieceWorn", () -> record(new DomainEvents.HypeSignal(HypeSignalType.PIECE_USED, HypeEntityType.PIECE,
                ev.pieceId(), ev.userId(), ev.userId()), signalDay(ev.date())));
    }

    /** Look novo: cada peça ganha uma aparição em look. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSchemeSaved(DomainEvents.SchemeSaved ev) {
        if (!ev.created() || ev.pieceIds() == null) {
            return;
        }
        sideEffects.run("HypeSignal:SchemeSaved", () -> ev.pieceIds().forEach(pid ->
                record(new DomainEvents.HypeSignal(HypeSignalType.PIECE_IN_LOOK, HypeEntityType.PIECE, pid, ev.userId(), ev.userId()))));
    }

    /** Look do dia: o look foi usado e as peças dele também. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onDailyLook(DomainEvents.DailyLookRegistered ev) {
        LocalDate day = signalDay(ev.date());
        sideEffects.run("HypeSignal:DailyLook", () -> {
            record(new DomainEvents.HypeSignal(HypeSignalType.LOOK_WORN, HypeEntityType.SCHEME, ev.schemeId(), ev.userId(), ev.userId()), day);
            if (ev.pieceIds() != null) {
                ev.pieceIds().forEach(pid -> record(new DomainEvents.HypeSignal(HypeSignalType.PIECE_USED, HypeEntityType.PIECE, pid, ev.userId(), ev.userId()), day));
            }
        });
    }

    void record(DomainEvents.HypeSignal s) {
        record(s, LocalDate.now(ZONE));
    }

    /** Grava o sinal no dia em que aconteceu (a deduplicação da política de integridade também é por esse dia). */
    void record(DomainEvents.HypeSignal s, LocalDate day) {
        double weight = integrity.weight(s, day);
        if (weight <= 0) {
            return;
        }
        signals.increment(UUID.randomUUID().toString(), s.entityType().name(), s.entityId().toString(), s.signal().name(), day,
                BigDecimal.valueOf(weight).setScale(3, RoundingMode.HALF_UP), Instant.now());
    }

    /** Dia do evento informado pela ação; sem data (ou data futura) = hoje. */
    static LocalDate signalDay(LocalDate date) {
        LocalDate today = LocalDate.now(ZONE);
        return date == null || date.isAfter(today) ? today : date;
    }
}
