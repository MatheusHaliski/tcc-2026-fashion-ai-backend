package br.com.fashionai.application.hype;

import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.domain.repository.HypeSignalDailyRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class HypeSignalRecorderTest {
    private final UUID user = UUID.randomUUID();
    private final UUID piece = UUID.randomUUID();
    private HypeSignalDailyRepository signals;
    private HypeSignalRecorder recorder;

    @BeforeEach
    void setUp() {
        signals = mock(HypeSignalDailyRepository.class);
        SideEffectRunner sideEffects = mock(SideEffectRunner.class);
        doAnswer(inv -> {
            ((Runnable) inv.getArgument(1)).run();
            return null;
        }).when(sideEffects).run(anyString(), any());
        HypeIntegrityPolicy integrity = new HypeIntegrityPolicy(new HypeIntegrityPolicyTest.MapCache(), mock(UserRepository.class), HypeScoreConfig.defaults());
        recorder = new HypeSignalRecorder(signals, integrity, sideEffects);
    }

    private List<LocalDate> recordedDays(int times) {
        ArgumentCaptor<LocalDate> day = ArgumentCaptor.forClass(LocalDate.class);
        verify(signals, times(times)).increment(anyString(), anyString(), anyString(), anyString(), day.capture(), any(), any());
        return day.getAllValues();
    }

    /** Uso retroativo no diário conta no dia do uso: não vira atividade de hoje nem "tendência de alta" falsa. */
    @Test
    void backdatedWearIsRecordedOnItsActualDate() {
        LocalDate today = LocalDate.now(HypeSignalRecorder.ZONE);
        LocalDate monthsAgo = today.minusDays(90);
        LocalDate weekAgo = today.minusDays(7);
        recorder.onPieceWorn(new DomainEvents.PieceWorn(user, piece, monthsAgo, null));
        recorder.onPieceWorn(new DomainEvents.PieceWorn(user, piece, weekAgo, null));   // mesmo dia de registro, datas diferentes: ambos contam
        recorder.onPieceWorn(new DomainEvents.PieceWorn(user, piece, weekAgo, null));   // mesmo dia de uso: deduplicado
        assertThat(recordedDays(2)).containsExactly(monthsAgo, weekAgo);
    }

    @Test
    void missingOrFutureDateFallsBackToToday() {
        LocalDate today = LocalDate.now(HypeSignalRecorder.ZONE);
        recorder.onPieceWorn(new DomainEvents.PieceWorn(user, piece, null, null));
        recorder.onPieceWorn(new DomainEvents.PieceWorn(user, UUID.randomUUID(), today.plusDays(3), null));
        assertThat(recordedDays(2)).containsOnly(today);
    }

    @Test
    void backdatedDailyLookUsesTheLookDate() {
        LocalDate day = LocalDate.now(HypeSignalRecorder.ZONE).minusDays(30);
        recorder.onDailyLook(new DomainEvents.DailyLookRegistered(user, UUID.randomUUID(), day, "MANUAL", List.of(piece)));
        assertThat(recordedDays(2)).containsOnly(day);
    }
}
