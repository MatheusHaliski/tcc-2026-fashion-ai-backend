package br.com.fashionai.application.laundry;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.PieceAvailability;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.laundry.LaundryBatch;
import br.com.fashionai.domain.model.laundry.LaundryBatchItem;
import br.com.fashionai.domain.model.laundry.PieceWearState;
import br.com.fashionai.domain.model.laundry.PieceWearStateLog;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.domain.repository.WeekPlanDayRepository;
import br.com.fashionai.domain.repository.WeekPlanRepository;
import br.com.fashionai.domain.repository.laundry.LaundryBatchItemRepository;
import br.com.fashionai.domain.repository.laundry.LaundryBatchRepository;
import br.com.fashionai.domain.repository.laundry.PieceWearStateLogRepository;
import br.com.fashionai.domain.repository.laundry.PieceWearStateRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * RF-PESQ-03 — ciclo de lavanderia. Estados de uso por peça (limpa → usada → lavagem → limpa), lotes com instrução
 * declarada e retirada temporária da disponibilidade: a peça em lavagem sai das sugestões de looks prontos e volta
 * só quando a pessoa confirma que ela está disponível de novo.
 */
@Service
@Transactional
public class LaundryService {
    public record BatchForm(List<UUID> pieceIds, String instructionCode, String instructions, boolean confirmed) { }
    public record FinishForm(long expectedVersion, boolean restoreAvailability) { }

    private final PieceWearStateRepository states;
    private final PieceWearStateLogRepository logs;
    private final LaundryBatchRepository batches;
    private final LaundryBatchItemRepository items;
    private final WardrobeItemRepository pieces;
    private final LaundryConflicts conflicts;
    private final Guard guard;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public LaundryService(PieceWearStateRepository states, PieceWearStateLogRepository logs, LaundryBatchRepository batches,
                          LaundryBatchItemRepository items, WardrobeItemRepository pieces, WeekPlanRepository plans,
                          WeekPlanDayRepository planDays, Guard guard, ApplicationEventPublisher events) {
        this(states, logs, batches, items, pieces, plans, planDays, guard, events, Clock.systemUTC());
    }

    LaundryService(PieceWearStateRepository states, PieceWearStateLogRepository logs, LaundryBatchRepository batches,
                   LaundryBatchItemRepository items, WardrobeItemRepository pieces, WeekPlanRepository plans,
                   WeekPlanDayRepository planDays, Guard guard, ApplicationEventPublisher events, Clock clock) {
        this.states = states; this.logs = logs; this.batches = batches; this.items = items; this.pieces = pieces;
        this.conflicts = new LaundryConflicts(plans, planDays, pieces, clock); this.guard = guard; this.events = events; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> board(CurrentUser user) {
        guard.requireCanCreate(user);
        Map<UUID, PieceWearState> byPiece = new LinkedHashMap<>();
        states.findByOwnerId(user.id()).forEach(s -> byPiece.put(s.getPieceId(), s));
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
        List<Map<String, Object>> worn = new ArrayList<>();
        List<Map<String, Object>> inWash = new ArrayList<>();
        List<WardrobeItem> wornItems = new ArrayList<>();
        List<Map<String, Object>> cleanPieces = new ArrayList<>();
        for (WardrobeItem w : all) {
            PieceWearState s = byPiece.get(w.getId());
            String state = s == null ? PieceWearState.CLEAN : s.getState();
            if (PieceWearState.WORN.equals(state)) { worn.add(LaundryViews.piece(w, s)); wornItems.add(w); }
            else if (PieceWearState.IN_WASH.equals(state)) inWash.add(LaundryViews.piece(w, s));
            else cleanPieces.add(LaundryViews.piece(w, s));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("clean", cleanPieces.size());
        out.put("cleanPieces", cleanPieces);
        out.put("worn", worn);
        out.put("inWash", inWash);
        out.put("batches", batches.findByOwnerIdAndStatusOrderByStartedAtDesc(user.id(), "WASHING").stream().map(b -> batchView(b, byPiece)).toList());
        LaundryRules.Suggestions suggestions = LaundryRules.group(wornItems);
        out.put("suggestions", suggestions.groups());
        out.put("missingData", suggestions.missingData());
        Set<UUID> washing = new LinkedHashSet<>();
        byPiece.values().stream().filter(s -> PieceWearState.IN_WASH.equals(s.getState())).forEach(s -> washing.add(s.getPieceId()));
        out.put("conflicts", conflicts.of(user.id(), washing));
        return out;
    }

    public Map<String, Object> markWorn(CurrentUser user, UUID pieceId) {
        WardrobeItem w = own(user, pieceId);
        PieceWearState s = transition(user.id(), w, PieceWearState.WORN, null);
        return LaundryViews.piece(w, s);
    }

    /**
     * Uso registrado fora da Lavanderia (Look do Dia, "usei hoje" da peça): a peça limpa passa a "usada". Peça já usada,
     * em lavagem, excluída ou de outra pessoa fica como está, sem erro.
     */
    public void noteWorn(UUID ownerId, UUID pieceId) {
        WardrobeItem w = pieces.findById(pieceId).orElse(null);
        if (w == null || !w.getUser().getId().equals(ownerId) || w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED) return;
        String state = states.findByPieceId(pieceId).map(PieceWearState::getState).orElse(PieceWearState.CLEAN);
        if (PieceWearState.CLEAN.equals(state)) transition(ownerId, w, PieceWearState.WORN, null);
    }

    /** Lavada fora de um lote (em casa): usada → limpa; a disponibilidade retida por um lote só volta pelo lote. */
    public Map<String, Object> markClean(CurrentUser user, UUID pieceId) {
        WardrobeItem w = own(user, pieceId);
        PieceWearState current = states.findByPieceId(pieceId).orElse(null);
        if (current != null && PieceWearState.IN_WASH.equals(current.getState())) {
            throw ApiException.conflict("PECA_EM_LOTE", Msg.t("laundry.peca_em_lote"));
        }
        return LaundryViews.piece(w, transition(user.id(), w, PieceWearState.CLEAN, null));
    }

    public Map<String, Object> createBatch(CurrentUser user, BatchForm form) {
        guard.requireCanCreate(user);
        if (form == null || form.pieceIds() == null || form.pieceIds().isEmpty()) throw ApiException.badRequest("LOTE_VAZIO", Msg.t("laundry.lote_vazio"));
        if (!form.confirmed()) throw ApiException.badRequest("LOTE_SEM_CONFIRMACAO", Msg.t("laundry.lote_sem_confirmacao"));
        Set<UUID> ids = new LinkedHashSet<>(form.pieceIds());
        LaundryBatch batch = new LaundryBatch();
        batch.setOwnerId(user.id());
        batch.setInstructionCode(form.instructionCode() == null || form.instructionCode().isBlank() ? null : InputSanitizer.clean(form.instructionCode(), 30));
        batch.setInstructions(form.instructions() == null || form.instructions().isBlank() ? null : InputSanitizer.clean(form.instructions(), 1000));
        batch.setStartedAt(clock.instant());
        batches.saveAndFlush(batch);
        for (UUID id : ids) {
            WardrobeItem w = own(user, id);
            PieceWearState s = transition(user.id(), w, PieceWearState.IN_WASH, batch.getId());
            withhold(user, w, s);
            LaundryBatchItem item = new LaundryBatchItem();
            item.setBatchId(batch.getId()); item.setPieceId(id); items.save(item);
        }
        return batchView(batch, null);
    }

    /** Lavagem concluída: peças voltam a limpas; a disponibilidade só é restaurada com a confirmação explícita. */
    public Map<String, Object> finishBatch(CurrentUser user, UUID batchId, FinishForm form) {
        LaundryBatch batch = ownBatch(user, batchId, form.expectedVersion());
        for (PieceWearState s : states.findByBatchId(batchId)) {
            WardrobeItem w = own(user, s.getPieceId());
            transition(user.id(), w, PieceWearState.CLEAN, null);
            if (form.restoreAvailability()) restore(user, w, s);
        }
        batch.setStatus("DONE"); batch.setFinishedAt(clock.instant());
        return batchView(batches.saveAndFlush(batch), null);
    }

    public Map<String, Object> cancelBatch(CurrentUser user, UUID batchId, long expectedVersion) {
        LaundryBatch batch = ownBatch(user, batchId, expectedVersion);
        for (PieceWearState s : states.findByBatchId(batchId)) {
            WardrobeItem w = own(user, s.getPieceId());
            s.setState(PieceWearState.WORN); s.setBatchId(null); s.setChangedAt(clock.instant()); states.save(s);
            log(user.id(), w.getId(), PieceWearState.IN_WASH, PieceWearState.WORN, "BATCH_CANCELLED");
            restore(user, w, s);
        }
        batch.setStatus("CANCELLED"); batch.setFinishedAt(clock.instant());
        return batchView(batches.saveAndFlush(batch), null);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> history(CurrentUser user, UUID pieceId) {
        own(user, pieceId);
        return logs.findTop20ByPieceIdOrderByChangedAtDesc(pieceId).stream().map(LaundryViews::log).toList();
    }

    private PieceWearState transition(UUID ownerId, WardrobeItem w, String to, UUID batchId) {
        PieceWearState s = states.findByPieceId(w.getId()).orElseGet(() -> {
            PieceWearState fresh = new PieceWearState();
            fresh.setPieceId(w.getId()); fresh.setOwnerId(ownerId); fresh.setState(PieceWearState.CLEAN); fresh.setChangedAt(clock.instant());
            return fresh;
        });
        if (!LaundryRules.canTransition(s.getState(), to)) throw ApiException.conflict("TRANSICAO_INVALIDA", Msg.t("laundry.transicao_invalida", s.getState(), to));
        String from = s.getState();
        s.setState(to); s.setBatchId(batchId); s.setChangedAt(clock.instant());
        states.saveAndFlush(s);
        log(ownerId, w.getId(), from, to, null);
        return s;
    }

    /** CA4 — retira da recomendação de looks prontos enquanto a peça está no lote. */
    private void withhold(CurrentUser user, WardrobeItem w, PieceWearState s) {
        if (!w.isDisponivel()) return;
        PieceAvailability.mark(w, false); pieces.save(w);
        s.setAvailabilityWithheld(true); states.save(s);
        events.publishEvent(new DomainEvents.AvailabilityChanged(user.id(), w.getId(), false));
    }

    private void restore(CurrentUser user, WardrobeItem w, PieceWearState s) {
        if (!s.isAvailabilityWithheld()) return;
        s.setAvailabilityWithheld(false); states.save(s);
        if (w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED) return;
        PieceAvailability.mark(w, true); pieces.save(w);
        events.publishEvent(new DomainEvents.AvailabilityChanged(user.id(), w.getId(), true));
    }

    private void log(UUID ownerId, UUID pieceId, String from, String to, String note) {
        PieceWearStateLog l = new PieceWearStateLog();
        l.setPieceId(pieceId); l.setOwnerId(ownerId); l.setFromState(from); l.setToState(to); l.setChangedAt(clock.instant()); l.setNote(note);
        logs.save(l);
    }

    private Map<String, Object> batchView(LaundryBatch b, Map<UUID, PieceWearState> known) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (LaundryBatchItem item : items.findByBatchId(b.getId())) {
            PieceWearState s = known != null ? known.get(item.getPieceId()) : states.findByPieceId(item.getPieceId()).orElse(null);
            pieces.findById(item.getPieceId()).ifPresent(w -> rows.add(LaundryViews.piece(w, s)));
        }
        return LaundryViews.batch(b, rows);
    }

    private LaundryBatch ownBatch(CurrentUser user, UUID batchId, long expectedVersion) {
        guard.requireCanCreate(user);
        LaundryBatch batch = batches.lockById(batchId).orElseThrow(() -> ApiException.notFound(Msg.t("laundry.lote")));
        if (!batch.getOwnerId().equals(user.id())) throw ApiException.forbidden(Msg.t("laundry.lote_de_outro_usuario"));
        if (!"WASHING".equals(batch.getStatus())) throw ApiException.conflict("LOTE_ENCERRADO", Msg.t("laundry.lote_encerrado"));
        if (batch.getVersion() != expectedVersion) throw ApiException.conflict("LOTE_VERSAO", Msg.t("laundry.lote_versao"));
        return batch;
    }

    /** CA3 — nunca opera em peça de outro usuário. */
    private WardrobeItem own(CurrentUser user, UUID pieceId) {
        guard.requireCanCreate(user);
        WardrobeItem w = pieces.findById(pieceId).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        if (!w.getUser().getId().equals(user.id())) throw ApiException.forbidden(Msg.t("laundry.peca_de_outro_usuario"));
        if (w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED) throw ApiException.conflict("PECA_ARQUIVADA", Msg.t("laundry.peca_arquivada"));
        return w;
    }

}
