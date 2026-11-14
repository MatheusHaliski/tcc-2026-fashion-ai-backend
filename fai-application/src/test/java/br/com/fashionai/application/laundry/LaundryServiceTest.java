package br.com.fashionai.application.laundry;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.model.laundry.PieceWearState;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.domain.repository.laundry.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import java.time.*;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** RF-PESQ-03 — ciclo de lavanderia e disponibilidade para vestir. */
class LaundryServiceTest {
    PieceWearStateRepository states = MemoryRepository.of(PieceWearStateRepository.class);
    PieceWearStateLogRepository logs = MemoryRepository.of(PieceWearStateLogRepository.class);
    LaundryBatchRepository batches = MemoryRepository.of(LaundryBatchRepository.class);
    LaundryBatchItemRepository items = MemoryRepository.of(LaundryBatchItemRepository.class);
    WardrobeItemRepository pieces = MemoryRepository.of(WardrobeItemRepository.class);
    WeekPlanRepository plans = MemoryRepository.of(WeekPlanRepository.class);
    WeekPlanDayRepository days = MemoryRepository.of(WeekPlanDayRepository.class);
    UserRepository users = MemoryRepository.of(UserRepository.class);
    ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    Instant now = Instant.parse("2026-11-05T12:00:00Z");
    LaundryService service;
    User ana, bia;
    WardrobeItem shirt, jeans, mystery;
    CurrentUser actor(User u) { return CurrentUser.of(u, "127.0.0.1", "test"); }
    WardrobeItem piece(User owner, String name, String material, String washCode) {
        WardrobeItem w = new WardrobeItem(); w.setUser(owner); w.setName(name); w.setCategory("upper_piece"); w.setMaterial(material);
        if (washCode != null) { TipoLavagem t = new TipoLavagem(); t.setCodigo(washCode); t.setNome(washCode); w.setTipoLavagem(t); }
        return pieces.save(w);
    }

    @BeforeEach void setUp() {
        when(batches.lockById(any())).thenAnswer(inv -> batches.findById(inv.getArgument(0)));
        service = new LaundryService(states, logs, batches, items, pieces, plans, days, mock(Guard.class), events, Clock.fixed(now, ZoneOffset.UTC));
        ana = new User("ana", "Ana", "a@x.invalid", "h1", "p", ProfileType.PESSOAL); ana.setStatus(AccountStatus.ACTIVE); users.save(ana);
        bia = new User("bia", "Bia", "b@x.invalid", "h2", "p", ProfileType.PESSOAL); bia.setStatus(AccountStatus.ACTIVE); users.save(bia);
        shirt = piece(ana, "Camisa", "Algodão", "MAQUINA_FRIA"); jeans = piece(ana, "Jeans", "Denim", null); mystery = piece(ana, "Peça sem dados", null, null);
    }

    @Test void transitionsFollowCleanWornWashCleanAndAreLoggedWithDate() {
        assertThat(service.markWorn(actor(ana), shirt.getId())).containsEntry("wearState", "WORN");
        assertThatThrownBy(() -> service.markWorn(actor(ana), shirt.getId())).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("TRANSICAO_INVALIDA"));
        assertThat(service.markClean(actor(ana), shirt.getId())).containsEntry("wearState", "CLEAN");
        assertThat(service.history(actor(ana), shirt.getId())).hasSize(2).allSatisfy(row -> assertThat(row.get("changedAt")).isEqualTo(now));
        assertThat(shirt.getAvailabilityStatus()).isEqualTo(AvailabilityStatus.AVAILABLE);
        assertThat(shirt.getCondition()).isEqualTo(ItemCondition.GOOD);
    }

    /** Reauditoria: registrar o Look do Dia deixava as peças "limpas" e não havia como montar um lote. */
    @Test void lookDoDiaEUsoDaPecaDeixamAPecaUsadaEAsLimpasVemListadas() {
        LaundryWearListener listener = new LaundryWearListener(service, new br.com.fashionai.application.events.SideEffectRunner(mock(org.springframework.transaction.PlatformTransactionManager.class)));
        listener.onDailyLook(new DomainEvents.DailyLookRegistered(ana.getId(), UUID.randomUUID(), LocalDate.of(2026, 11, 5), "MIRROR", List.of(shirt.getId(), jeans.getId())));
        var board = service.board(actor(ana));
        assertThat((List<?>) board.get("worn")).hasSize(2);
        assertThat((List<?>) board.get("cleanPieces")).hasSize(1);
        assertThat(board).containsEntry("clean", 1);
        // repetir o registro, peça de outra pessoa e peça em lavagem não dão erro nem mudam nada
        listener.onPieceWorn(new DomainEvents.PieceWorn(ana.getId(), shirt.getId(), LocalDate.of(2026, 11, 5), null));
        listener.onPieceWorn(new DomainEvents.PieceWorn(bia.getId(), mystery.getId(), LocalDate.of(2026, 11, 5), null));
        assertThat((List<?>) service.board(actor(ana)).get("worn")).hasSize(2);
        listener.onPieceWorn(new DomainEvents.PieceWorn(ana.getId(), mystery.getId(), LocalDate.of(2026, 11, 5), null));
        assertThat((List<?>) service.board(actor(ana)).get("worn")).hasSize(3);
    }

    @Test void otherUsersPiecesAreRejectedEverywhere() {
        WardrobeItem foreign = piece(bia, "Vestido", "Seda", null);
        assertThatThrownBy(() -> service.markWorn(actor(ana), foreign.getId())).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        assertThatThrownBy(() -> service.createBatch(actor(ana), new LaundryService.BatchForm(List.of(foreign.getId()), null, null, true))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        assertThatThrownBy(() -> service.history(actor(bia), shirt.getId())).isInstanceOf(ApiException.class);
    }

    @Test void suggestionsOnlyGroupKnownDataAndFlagMissingInformation() {
        service.markWorn(actor(ana), shirt.getId()); service.markWorn(actor(ana), jeans.getId()); service.markWorn(actor(ana), mystery.getId());
        var board = service.board(actor(ana));
        @SuppressWarnings("unchecked") var groups = (List<LaundryRules.Group>) board.get("suggestions");
        assertThat(groups).extracting(LaundryRules.Group::key).containsExactlyInAnyOrder("WASH:MAQUINA_FRIA", "MATERIAL:denim");
        assertThat(groups).extracting(LaundryRules.Group::source).containsExactlyInAnyOrder("DECLARED_INSTRUCTION", "DECLARED_COMPOSITION");
        assertThat((List<?>) board.get("missingData")).isEqualTo(List.of(mystery.getId()));
        assertThatThrownBy(() -> service.createBatch(actor(ana), new LaundryService.BatchForm(List.of(shirt.getId()), "MAQUINA_FRIA", null, false))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("LOTE_SEM_CONFIRMACAO"));
    }

    @Test void batchWithdrawsAvailabilityWarnsPlannedLooksAndRestoresOnlyOnConfirmation() {
        service.markWorn(actor(ana), shirt.getId());
        WeekPlan plan = new WeekPlan(); plan.setUser(ana); plan.setWeekStart(LocalDate.of(2026, 11, 2)); plan.setStatus(WeekPlanStatus.ACTIVE); plans.save(plan);
        WeekPlanDay day = new WeekPlanDay(); day.setWeekPlan(plan); day.setDayDate(LocalDate.of(2026, 11, 6)); day.setEventLabel("Reunião"); day.setPieceIdsJson("[\"" + shirt.getId() + "\"]"); days.save(day);
        var batch = service.createBatch(actor(ana), new LaundryService.BatchForm(List.of(shirt.getId(), jeans.getId()), "MAQUINA_FRIA", "sem amaciante", true));
        assertThat(batch).containsEntry("status", "WASHING").containsEntry("instructionCode", "MAQUINA_FRIA");
        assertThat(shirt.isDisponivel()).isFalse(); assertThat(shirt.getAvailabilityStatus()).isEqualTo(AvailabilityStatus.UNAVAILABLE);
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class); verify(events, times(2)).publishEvent(captor.capture());
        assertThat(captor.getAllValues()).allMatch(e -> e instanceof DomainEvents.AvailabilityChanged c && !c.available());
        var board = service.board(actor(ana));
        @SuppressWarnings("unchecked") var conflicts = (List<Map<String, Object>>) board.get("conflicts");
        assertThat(conflicts).hasSize(1); assertThat(conflicts.getFirst()).containsEntry("pieceName", "Camisa").containsEntry("eventLabel", "Reunião");
        assertThatThrownBy(() -> service.markClean(actor(ana), shirt.getId())).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("PECA_EM_LOTE"));
        UUID batchId = (UUID) batch.get("id");
        var done = service.finishBatch(actor(ana), batchId, new LaundryService.FinishForm(0, false));
        assertThat(done).containsEntry("status", "DONE");
        assertThat(states.findByPieceId(shirt.getId()).orElseThrow().getState()).isEqualTo(PieceWearState.CLEAN);
        assertThat(shirt.isDisponivel()).isFalse();
        assertThat(service.board(actor(ana)).get("conflicts")).isEqualTo(List.of());
        assertThatThrownBy(() -> service.finishBatch(actor(ana), batchId, new LaundryService.FinishForm(1, true))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("LOTE_ENCERRADO"));
    }

    @Test void confirmedFinishRestoresAvailabilityOnlyForPiecesTheBatchWithheld() {
        PieceAvailability.mark(jeans, false);
        var batch = service.createBatch(actor(ana), new LaundryService.BatchForm(List.of(shirt.getId(), jeans.getId()), null, null, true));
        service.finishBatch(actor(ana), (UUID) batch.get("id"), new LaundryService.FinishForm(0, true));
        assertThat(shirt.isDisponivel()).isTrue();
        assertThat(jeans.isDisponivel()).isFalse();
        var cancelled = service.createBatch(actor(ana), new LaundryService.BatchForm(List.of(shirt.getId()), null, null, true));
        service.cancelBatch(actor(ana), (UUID) cancelled.get("id"), 0);
        assertThat(states.findByPieceId(shirt.getId()).orElseThrow().getState()).isEqualTo(PieceWearState.WORN);
        assertThat(shirt.isDisponivel()).isTrue();
    }
}
