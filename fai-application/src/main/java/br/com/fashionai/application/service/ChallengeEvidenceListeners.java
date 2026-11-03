package br.com.fashionai.application.service;

import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.ChallengeRules.dayRef;
import static br.com.fashionai.application.service.ChallengeRules.today;

/**
 * Corpo dos ouvintes de evidência (dados reais): looks salvos, Looks do Dia, ações do espelho e peças cadastradas.
 * As anotações {@code @TransactionalEventListener(AFTER_COMMIT)} continuam nos métodos do {@link ChallengeService}
 * (Observer); aqui fica o trabalho, sempre dentro do {@link SideEffectRunner} (R82).
 */
final class ChallengeEvidenceListeners {
    private final SideEffectRunner sideEffects;
    private final WardrobeItemRepository pieces;
    private final ChallengeParticipantRepository participants;
    private final ChallengeStore store;
    private final ChallengeRuleEvaluator evaluator;
    private final ChallengeConclusion conclusion;

    ChallengeEvidenceListeners(SideEffectRunner sideEffects, WardrobeItemRepository pieces, ChallengeParticipantRepository participants,
                               ChallengeStore store, ChallengeRuleEvaluator evaluator, ChallengeConclusion conclusion) {
        this.sideEffects = sideEffects;
        this.pieces = pieces;
        this.participants = participants;
        this.store = store;
        this.evaluator = evaluator;
        this.conclusion = conclusion;
    }

    /** Listeners dos desafios rodam depois do commit, em transação própria (nunca derrubam a ação principal). */
    private void safe(String what, Runnable r) {
        sideEffects.run("desafios:" + what, r);
    }

    void onSchemeSaved(DomainEvents.SchemeSaved ev) {
        safe("SchemeSaved", () -> handleLook(ev.userId(), ev.schemeId(), ev.pieceIds(), ev.created(), false));
    }

    void onDailyLook(DomainEvents.DailyLookRegistered ev) {
        safe("DailyLookRegistered", () -> handleLook(ev.userId(), ev.schemeId(), ev.pieceIds(), false, true));
    }

    @SuppressWarnings("unchecked")
    void handleLook(UUID userId, UUID schemeId, List<UUID> pieceIds, boolean created, boolean dailyLook) {
        if (pieceIds == null || pieceIds.isEmpty()) {
            return;
        }
        List<WardrobeItem> look = pieces.findByIdIn(pieceIds);
        LocalDate d = today();
        for (Object[] row : store.activeParticipations(userId)) {
            ChallengeInstance i = (ChallengeInstance) row[0];
            ChallengeParticipant p = (ChallengeParticipant) row[1];
            ChallengeTemplate t = (ChallengeTemplate) row[2];
            Map<String, Object> params = Json.map(i.getParamsJson());
            Map<String, Object> goal = Json.map(p.getPersonalGoalJson());
            boolean changed = false;
            switch (t.getCode()) {
                case "TEN_X_TEN" -> {
                    Set<String> allowed = new HashSet<>(Json.strings(Json.write(params.get("piece_ids"))));
                    if (created && pieceIds.size() >= 2 && pieceIds.stream().allMatch(x -> allowed.contains(x.toString()))) {
                        changed = store.record(i, userId, "LOOK", schemeId);
                    }
                }
                case "CAPSULE_SEASON" -> {
                    Set<String> allowed = new HashSet<>(Json.strings(Json.write(params.get("piece_ids"))));
                    if (dailyLook) {
                        if (pieceIds.stream().allMatch(x -> allowed.contains(x.toString()))) {
                            changed = store.record(i, userId, "CAPSULE_DAY", dayRef(i.getId(), d));
                        } else {
                            changed = store.record(i, userId, "VIOLATION", dayRef(i.getId(), d));
                        }
                    }
                }
                case "SECOND_CHANCE" -> {
                    Set<String> forgotten = new HashSet<>(Json.strings(Json.write(goal.get("forgotten"))));
                    for (UUID id : pieceIds) {
                        if (forgotten.contains(id.toString()) && (dailyLook || pieceIds.size() >= 2)) {
                            changed |= store.record(i, userId, "RESCUE", id);
                        }
                    }
                }
                case "NO_REPEAT" -> {
                    if (dailyLook) {
                        changed = store.record(i, userId, "DAILY_LOOK", dayRef(i.getId(), d));
                    }
                }
                case "WEAR_WHAT_YOU_HAVE" -> {
                    if (dailyLook) {
                        Instant since = goal.get("since") == null ? i.getStartsAt() : Instant.parse(String.valueOf(goal.get("since")));
                        boolean onlyOld = look.stream().allMatch(w -> w.getCreatedAt() == null || since == null || w.getCreatedAt().isBefore(since));
                        if (onlyOld) {
                            changed = store.record(i, userId, "WWYH_DAY", dayRef(i.getId(), d));
                        }
                    }
                }
                case "MY_SEASON" -> {
                    Set<String> palette = evaluator.paletteFamilies(userId);
                    if (!palette.isEmpty() && look.size() >= 2 && look.stream().allMatch(w -> palette.contains(InventoryScoreService.family(w.getColor())))) {
                        changed = store.record(i, userId, "SEASON_DAY", dayRef(i.getId(), d));
                    }
                }
                case "DAILY_CHALLENGE" -> {
                    List<Map<String, Object>> blocks = (List<Map<String, Object>>) (List<?>) Json.list(Json.write(params.get("blocks")));
                    List<Boolean> grid = evaluator.evaluate(userId, look, blocks, d);
                    Map<String, Object> g = new LinkedHashMap<>(goal);
                    String gridRow = grid.stream().map(b -> b ? "🟩" : "⬜").collect(Collectors.joining());
                    String prev = String.valueOf(g.getOrDefault("grid", ""));
                    if (gridRow.codePoints().filter(c -> c == 0x1F7E9).count() >= prev.codePoints().filter(c -> c == 0x1F7E9).count()) {
                        g.put("grid", gridRow);
                        p.setPersonalGoalJson(Json.write(g));
                        participants.save(p);
                    }
                    if (grid.stream().allMatch(b -> b)) {
                        changed = store.record(i, userId, "DAILY_RULE_OK", schemeId);
                    }
                }
                default -> {
                    List<Map<String, Object>> blocks = Json.list(t.getRuleBlocksJson());
                    if (!blocks.isEmpty() && evaluator.evaluate(userId, look, blocks, d).stream().allMatch(b -> b)) {
                        changed = store.record(i, userId, "RULE_LOOK", dayRef(i.getId(), d));
                    }
                }
            }
            if (changed) {
                conclusion.refresh(i, t);
            }
        }
    }

    void onMirror(DomainEvents.MirrorAction ev) {
        safe("MirrorAction", () -> {
            for (Object[] row : store.activeParticipations(ev.userId())) {
                ChallengeInstance i = (ChallengeInstance) row[0];
                ChallengeTemplate t = (ChallengeTemplate) row[2];
                boolean changed = false;
                if ("TIRA_UMA_COISA".equals(ev.action()) && t.getCode().equals("CHANEL_WEEK")) {
                    changed = store.record(i, ev.userId(), "TAKE_ONE_OFF", dayRef(i.getId(), today()));
                } else if ("GRWM_VIDEO".equals(ev.action()) && t.getCode().equals("GRWM")) {
                    changed = store.record(i, ev.userId(), "GRWM_VIDEO", dayRef(i.getId(), today()));
                }
                if (changed) {
                    conclusion.refresh(i, t);
                }
            }
        });
    }

    /** Semana Vista o que Você Tem: cadastrar compra nova durante a semana invalida o dia (sem culpa, só não conta). */
    void onPieceCreated(DomainEvents.PieceCreated ev) {
        safe("PieceCreated", () -> {
            WardrobeItem w = pieces.findById(ev.pieceId()).orElse(null);
            if (w == null) {
                return;
            }
            boolean purchase = "COMPRADA".equalsIgnoreCase(w.getPieceOrigin())
                    || (w.getPurchaseDate() != null && !w.getPurchaseDate().isBefore(today().minusDays(7)));
            if (!purchase) {
                return;
            }
            for (Object[] row : store.activeParticipations(ev.userId())) {
                ChallengeInstance i = (ChallengeInstance) row[0];
                ChallengeTemplate t = (ChallengeTemplate) row[2];
                if (t.getCode().equals("WEAR_WHAT_YOU_HAVE") && store.record(i, ev.userId(), "VIOLATION", dayRef(i.getId(), today()))) {
                    conclusion.refresh(i, t);
                }
            }
        });
    }
}
