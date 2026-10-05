package br.com.fashionai.application.hype;

import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.domain.model.User;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/** Hype "ao vivo": eventos só marcam; a verificação recalcula no máximo uma vez por janela (rajada = um recálculo). */
class HypeLiveRecalcTest {
    private final HypeSnapshotService snapshots = mock(HypeSnapshotService.class);
    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-10-05T12:00:00Z"));
    private final Clock clock = new Clock() {
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now.get(); }
    };
    private final HypeLiveRecalc live = new HypeLiveRecalc(snapshots, true, Duration.ofSeconds(120), clock);

    @Test
    void nothingChangedNothingRecalculated() {
        live.tick();
        verify(snapshots, never()).recalculate();
    }

    @Test
    void aBurstOfEventsBecomesOneRecalculationPerWindow() {
        UUID id = UUID.randomUUID();
        live.onPieceCreated(new DomainEvents.PieceCreated(id, id, false));
        live.onSchemeSaved(new DomainEvents.SchemeSaved(id, id, java.util.List.of(), "CRIAR_LOOK", true));
        live.tick();
        verify(snapshots, times(1)).recalculate();
        assertThat(live.isDirty()).isFalse();

        live.markDirty();
        now.set(now.get().plusSeconds(60));   // ainda dentro da janela de 120 s
        live.tick();
        verify(snapshots, times(1)).recalculate();
        now.set(now.get().plusSeconds(61));
        live.tick();
        verify(snapshots, times(2)).recalculate();
    }

    @Test
    void failureKeepsItDirtyForTheNextWindow() {
        doThrow(new IllegalStateException("db")).when(snapshots).recalculate();
        live.markDirty();
        live.tick();
        assertThat(live.isDirty()).isTrue();
    }

    @Test
    void disabledNeverRuns() {
        HypeLiveRecalc off = new HypeLiveRecalc(snapshots, false, Duration.ofSeconds(120), clock);
        off.markDirty();
        off.tick();
        verify(snapshots, never()).recalculate();
    }

    @Test
    void placeAndCsvForTheRegionalRanking() {
        User u = new User();
        u.setCountry(" br ");
        assertThat(HypeSnapshotService.place(u)).containsExactly("BR", "AMERICA_DO_SUL");
        assertThat(HypeSnapshotService.place(new User())).containsExactly(null, null);
        assertThat(HypeSnapshotService.csvOf(Stream.of("shoes_piece", "upper_piece", "shoes_piece", null, ""), 255)).isEqualTo("shoes_piece,upper_piece");
        assertThat(HypeSnapshotService.csvOf(Stream.of("aaaa", "bbbb", "cccc"), 10)).isEqualTo("aaaa,bbbb");   // corta numa vírgula
        assertThat(HypeSnapshotService.csvOf(Stream.of(), 10)).isNull();
    }
}
