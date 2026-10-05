package br.com.fashionai.application.hype;

import br.com.fashionai.application.events.DomainEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * HypeScore v2 "ao vivo": o job completo roda a cada 6 h, mas peça ou look recém-criado, editado ou que recebeu um sinal
 * não pode esperar 6 h para ter Hype (o verso do card e a análise completa ficariam "não calculados"). Cada um desses
 * eventos só MARCA o Hype como sujo; uma verificação curta recalcula tudo de uma vez, no máximo a cada
 * {@code fashionai.hype.live-recalc-seconds} (120 s por padrão). Rajadas de curtidas viram um recálculo só, e a leitura
 * (GET) continua nunca recalculando.
 */
@Component
public class HypeLiveRecalc {
    private static final Logger log = LoggerFactory.getLogger(HypeLiveRecalc.class);

    private final HypeSnapshotService snapshots;
    private final boolean enabled;
    private final Duration minInterval;
    private final Clock clock;
    private final AtomicBoolean dirty = new AtomicBoolean(false);
    private volatile Instant lastRun = Instant.EPOCH;

    @org.springframework.beans.factory.annotation.Autowired
    public HypeLiveRecalc(HypeSnapshotService snapshots,
                          @Value("${fashionai.hype.live-recalc-enabled:true}") boolean enabled,
                          @Value("${fashionai.hype.live-recalc-seconds:120}") long minIntervalSeconds) {
        this(snapshots, enabled, Duration.ofSeconds(Math.max(10, minIntervalSeconds)), Clock.systemUTC());
    }

    HypeLiveRecalc(HypeSnapshotService snapshots, boolean enabled, Duration minInterval, Clock clock) {
        this.snapshots = snapshots;
        this.enabled = enabled;
        this.minInterval = minInterval;
        this.clock = clock;
    }

    public void markDirty() {
        dirty.set(true);
    }

    public boolean isDirty() {
        return dirty.get();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPieceCreated(DomainEvents.PieceCreated e) {
        markDirty();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPieceUpdated(DomainEvents.PieceUpdated e) {
        markDirty();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPieceDeleted(DomainEvents.PieceDeleted e) {
        markDirty();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSchemeSaved(DomainEvents.SchemeSaved e) {
        markDirty();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSignal(DomainEvents.HypeSignal e) {
        markDirty();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onWorn(DomainEvents.PieceWorn e) {
        markDirty();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onDailyLook(DomainEvents.DailyLookRegistered e) {
        markDirty();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onAvailability(DomainEvents.AvailabilityChanged e) {
        markDirty();
    }

    /** Verificação curta: só recalcula se algo mudou e se o último recálculo já tem {@code minInterval}. */
    @Scheduled(fixedDelayString = "${fashionai.hype.live-recalc-check-ms:30000}", initialDelayString = "${fashionai.hype.live-recalc-initial-ms:60000}")
    public void tick() {
        if (!enabled || !dirty.get()) {
            return;
        }
        Instant now = clock.instant();
        if (Duration.between(lastRun, now).compareTo(minInterval) < 0) {
            return;
        }
        dirty.set(false);
        lastRun = now;
        try {
            snapshots.recalculate();
        } catch (RuntimeException ex) {
            dirty.set(true);   // tenta de novo na próxima janela
            log.warn("HypeScore ao vivo: recálculo falhou ({}); nova tentativa em {} s", ex.getMessage(), minInterval.toSeconds());
        }
    }
}
