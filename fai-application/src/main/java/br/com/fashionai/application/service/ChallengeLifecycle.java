package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.ChallengeInstanceRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.ChallengeRules.dayRef;
import static br.com.fashionai.application.service.ChallengeRules.today;
import static br.com.fashionai.application.service.ChallengeRules.windowStart;
import static br.com.fashionai.application.service.ChallengeService.AGUARDANDO;
import static br.com.fashionai.application.service.ChallengeService.ATIVO;
import static br.com.fashionai.application.service.ChallengeService.EXPIRADO;
import static br.com.fashionai.application.service.ChallengeService.P_ATIVO;
import static br.com.fashionai.application.service.ChallengeService.P_CONVIDADO;
import static br.com.fashionai.application.service.ChallengeService.P_RECUSOU;

/**
 * Ciclo de vida da instância: ativação com as metas pessoais, início antecipado, expiração e o job que expira convites,
 * conclui os vencidos e avisa a janela do Espelho de Verdade. Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeLifecycle {
    private final ChallengeTemplateRepository templates;
    private final ChallengeInstanceRepository instances;
    private final ChallengeParticipantRepository participants;
    private final WardrobeItemRepository pieces;
    private final RoomService room;
    private final NotificationService notifications;
    private final ChallengeStore store;
    private final ChallengeConclusion conclusion;

    ChallengeLifecycle(ChallengeTemplateRepository templates, ChallengeInstanceRepository instances,
                       ChallengeParticipantRepository participants, WardrobeItemRepository pieces, RoomService room,
                       NotificationService notifications, ChallengeStore store, ChallengeConclusion conclusion) {
        this.templates = templates;
        this.instances = instances;
        this.participants = participants;
        this.pieces = pieces;
        this.room = room;
        this.notifications = notifications;
        this.store = store;
        this.conclusion = conclusion;
    }

    void activate(ChallengeInstance i, ChallengeTemplate t) {
        Instant now = Instant.now();
        i.setState(ATIVO);
        i.setStartsAt(now);
        Integer days = t.getDurationDays();
        Map<String, Object> params = Json.map(i.getParamsJson());
        if (days == null && params.get("duel_days") instanceof Number n) {
            days = n.intValue();
        }
        i.setEndsAt(days == null ? null : today().plusDays(days).atStartOfDay(FaiPointsService.ZONE).toInstant());
        instances.save(i);
        // metas pessoais calculadas no início (a do Segunda Chance usa o estado do acervo neste momento)
        for (ChallengeParticipant p : participants.findByInstanceId(i.getId())) {
            if (P_ATIVO.equals(p.getStatus())) {
                Map<String, Object> goal = Json.map(p.getPersonalGoalJson());
                Map<String, Object> fresh = personalGoal(p.getUserId(), t, i, params, Boolean.TRUE.equals(goal.get("photoConsent")));
                p.setPersonalGoalJson(Json.write(fresh));
                participants.save(p);
            }
        }
    }

    /** Meta individual proporcional ao guarda-roupa de cada membro (§1.1 regra 1). */
    Map<String, Object> personalGoal(UUID userId, ChallengeTemplate t, ChallengeInstance i, Map<String, Object> params, Boolean photoConsent) {
        Map<String, Object> goal = new LinkedHashMap<>();
        goal.put("photoConsent", Boolean.TRUE.equals(photoConsent));
        if (t.getCode().equals("SECOND_CHANCE")) {
            List<UUID> forgotten = forgottenNow(userId);
            int pct = params.get("percent") instanceof Number n ? n.intValue() : 30;
            goal.put("forgotten", forgotten.stream().map(UUID::toString).toList());
            goal.put("target", forgotten.isEmpty() ? 0 : Math.max(1, (int) Math.ceil(forgotten.size() * pct / 100.0)));
            goal.put("percent", pct);
        }
        if (t.getCode().equals("WEAR_WHAT_YOU_HAVE")) {
            goal.put("since", Instant.now().toString());
        }
        return goal;
    }

    List<UUID> forgottenNow(UUID userId) {
        LocalDate d = today();
        Map<UUID, LocalDate> last = room.lastDiaryDates(userId, d.minusYears(10));
        return pieces.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(w -> RoomService.forgotten(w, RoomService.lastUse(w, last), d)).map(WardrobeItem::getId).toList();
    }

    /** Todos responderam → começa com quem aceitou, se houver o mínimo (§3). */
    void maybeStartEarly(ChallengeInstance i, ChallengeTemplate t) {
        List<ChallengeParticipant> ps = participants.findByInstanceId(i.getId());
        boolean pending = ps.stream().anyMatch(p -> P_CONVIDADO.equals(p.getStatus()));
        long accepted = ps.stream().filter(p -> P_ATIVO.equals(p.getStatus())).count();
        if (!pending && AGUARDANDO.equals(i.getState())) {
            if (accepted >= Math.max(2, t.getMinParticipants())) {
                activate(i, t);
            } else {
                expire(i);
            }
        }
    }

    void expire(ChallengeInstance i) {
        i.setState(EXPIRADO);
        i.setResultJson(Json.write(Map.of("reason", Msg.k("challenge.minimo_de_participantes_nao_atingido"), "penalty", false)));
        instances.save(i);
    }

    /** Job — expira convites sem o mínimo, conclui desafios vencidos e avisa a janela do Espelho de Verdade. */
    Map<String, Integer> tick() {
        int expired = 0, started = 0, concluded = 0;
        Instant now = Instant.now();
        for (ChallengeInstance i : instances.findByStateIn(List.of(AGUARDANDO, ATIVO))) {
            ChallengeTemplate t = templates.findById(i.getTemplateCode()).orElse(null);
            if (t == null) {
                continue;
            }
            if (AGUARDANDO.equals(i.getState()) && i.getAcceptDeadline() != null && i.getAcceptDeadline().isBefore(now)) {
                long accepted = participants.findByInstanceId(i.getId()).stream().filter(p -> P_ATIVO.equals(p.getStatus())).count();
                if (accepted >= Math.max(2, t.getMinParticipants())) {
                    participants.findByInstanceId(i.getId()).stream().filter(p -> P_CONVIDADO.equals(p.getStatus())).forEach(p -> {
                        p.setStatus(P_RECUSOU);
                        participants.save(p);
                    });
                    activate(i, t);
                    started++;
                } else {
                    expire(i);
                    expired++;
                }
            } else if (ATIVO.equals(i.getState()) && i.getEndsAt() != null && i.getEndsAt().isBefore(now)) {
                conclusion.conclude(i, t);
                concluded++;
            } else if (ATIVO.equals(i.getState()) && t.getCode().equals("REAL_MIRROR")) {
                notifyRealMirrorWindow(i);
            }
        }
        return Map.of("expired", expired, "started", started, "concluded", concluded);
    }

    void notifyRealMirrorWindow(ChallengeInstance i) {
        ZonedDateTime start = windowStart(i.getId(), today());
        ZonedDateTime now = ZonedDateTime.now(FaiPointsService.ZONE);
        if (now.isAfter(start) && now.isBefore(start.plusMinutes(15))) {
            for (ChallengeParticipant p : participants.findByInstanceId(i.getId())) {
                if (P_ATIVO.equals(p.getStatus()) && store.record(i, p.getUserId(), "WINDOW_NOTIFIED", dayRef(i.getId(), today()))) {
                    notifications.notify(p.getUserId(), null, NotificationType.CHALLENGE_INVITE, "CHALLENGE", i.getId(), Msg.k("challenge.hora_do_espelho_de_verdade"),
                            Msg.k("challenge.a_janela_de_hoje_esta"), Map.of("challengeId", i.getId().toString()));
                }
            }
        }
    }
}
