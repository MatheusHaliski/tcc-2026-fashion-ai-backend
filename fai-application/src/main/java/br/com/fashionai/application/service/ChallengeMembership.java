package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.repository.ChallengeInstanceRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.ChallengeService.AGUARDANDO;
import static br.com.fashionai.application.service.ChallengeService.ATIVO;
import static br.com.fashionai.application.service.ChallengeService.EXPIRADO;
import static br.com.fashionai.application.service.ChallengeService.P_ATIVO;
import static br.com.fashionai.application.service.ChallengeService.P_CANCELADO;
import static br.com.fashionai.application.service.ChallengeService.P_CONVIDADO;
import static br.com.fashionai.application.service.ChallengeService.P_RECUSOU;
import static br.com.fashionai.application.service.ChallengeService.P_SAIU;
import static br.com.fashionai.application.service.ChallengeService.RASCUNHO;

/**
 * Convites, saída e cancelamento: aceitar, recusar, iniciar com o mínimo, sair (CA11) e cancelar voltando ao rascunho.
 * Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeMembership {
    private final ChallengeInstanceRepository instances;
    private final ChallengeParticipantRepository participants;
    private final Guard guard;
    private final ChallengeStore store;
    private final ChallengeParticipations slots;
    private final ChallengeLifecycle lifecycle;
    private final ChallengeDetailView views;

    ChallengeMembership(ChallengeInstanceRepository instances, ChallengeParticipantRepository participants, Guard guard,
                        ChallengeStore store, ChallengeParticipations slots, ChallengeLifecycle lifecycle, ChallengeDetailView views) {
        this.instances = instances;
        this.participants = participants;
        this.guard = guard;
        this.store = store;
        this.slots = slots;
        this.lifecycle = lifecycle;
        this.views = views;
    }

    Map<String, Object> accept(CurrentUser user, UUID id, Boolean photoConsent) {
        ChallengeInstance i = store.instance(id);
        ChallengeParticipant p = participants.findByInstanceIdAndUserId(id, user.id())
                .filter(x -> P_CONVIDADO.equals(x.getStatus())).orElseThrow(() -> ApiException.notFound("Convite"));
        if (!AGUARDANDO.equals(i.getState()) || i.getAcceptDeadline() == null || i.getAcceptDeadline().isBefore(Instant.now())) {
            throw new ApiException(409, "CONVITE_EXPIRADO", Msg.t("challenge.o_prazo_de_aceite_48"));
        }
        slots.requireSlot(user.id());
        ChallengeTemplate t = store.template(i.getTemplateCode());
        p.setStatus(P_ATIVO);
        p.setJoinedAt(Instant.now());
        p.setPersonalGoalJson(Json.write(lifecycle.personalGoal(user.id(), t, i, Json.map(i.getParamsJson()), photoConsent)));
        participants.save(p);
        lifecycle.maybeStartEarly(i, t);
        return views.detail(user, id);
    }

    Map<String, Object> decline(CurrentUser user, UUID id) {
        ChallengeParticipant p = participants.findByInstanceIdAndUserId(id, user.id())
                .filter(x -> P_CONVIDADO.equals(x.getStatus())).orElseThrow(() -> ApiException.notFound("Convite"));
        p.setStatus(P_RECUSOU);
        participants.save(p);
        ChallengeInstance i = store.instance(id);
        lifecycle.maybeStartEarly(i, store.template(i.getTemplateCode()));
        return Map.of("declined", true);
    }

    Map<String, Object> startNow(CurrentUser user, UUID id) {
        ChallengeInstance i = store.instance(id);
        if (!i.getCreatedBy().equals(user.id())) {
            throw guard.deny(user, "challenge:" + id, Msg.t("challenge.so_quem_criou_pode_iniciar"));
        }
        ChallengeTemplate t = store.template(i.getTemplateCode());
        long accepted = participants.findByInstanceId(id).stream().filter(p -> P_ATIVO.equals(p.getStatus())).count();
        if (!AGUARDANDO.equals(i.getState()) || accepted < Math.max(2, t.getMinParticipants())) {
            throw new ApiException(409, "MINIMO_NAO_ATINGIDO", Msg.t("challenge.ainda_nao_ha_o_minimo"));
        }
        participants.findByInstanceId(id).stream().filter(p -> P_CONVIDADO.equals(p.getStatus())).forEach(p -> {
            p.setStatus(P_RECUSOU);
            participants.save(p);
        });
        lifecycle.activate(i, t);
        return views.detail(user, id);
    }

    /** CA11 — sair a qualquer momento; a meta da equipe é recalculada; ninguém recebe notificação de culpa. */
    Map<String, Object> leave(CurrentUser user, UUID id) {
        ChallengeInstance i = store.instance(id);
        ChallengeParticipant p = participants.findByInstanceIdAndUserId(id, user.id())
                .filter(x -> P_ATIVO.equals(x.getStatus())).orElseThrow(() -> ApiException.notFound(Msg.t("challenge.participacao")));
        p.setStatus(P_SAIU);
        p.setLeftAt(Instant.now());
        participants.save(p);
        List<ChallengeParticipant> remaining = participants.findByInstanceId(id).stream().filter(x -> P_ATIVO.equals(x.getStatus())).toList();
        if (remaining.isEmpty() && (ATIVO.equals(i.getState()) || AGUARDANDO.equals(i.getState())) && !"COMUNIDADE".equals(i.getMode())) {
            i.setState(EXPIRADO);
            i.setResultJson(Json.write(Map.of("reason", Msg.k("challenge.todos_sairam"), "penalty", false)));
            instances.save(i);
        }
        return Map.of("left", true, "note", Msg.t("challenge.seu_progresso_continua_registrado_no"));
    }

    /** Diagrama §3: o criador cancela e o desafio volta para rascunho (sem penalidade para ninguém). */
    Map<String, Object> cancel(CurrentUser user, UUID id) {
        ChallengeInstance i = store.instance(id);
        if (!i.getCreatedBy().equals(user.id()) || "COMUNIDADE".equals(i.getMode())) {
            throw guard.deny(user, "challenge:" + id, Msg.t("challenge.so_quem_criou_o_desafio_2"));
        }
        if (!AGUARDANDO.equals(i.getState()) && !ATIVO.equals(i.getState())) {
            throw new ApiException(409, "ESTADO_INVALIDO", Msg.t("challenge.este_desafio_nao_pode_ser"));
        }
        for (ChallengeParticipant p : participants.findByInstanceId(id)) {
            if (!p.getUserId().equals(user.id()) && (P_ATIVO.equals(p.getStatus()) || P_CONVIDADO.equals(p.getStatus()))) {
                p.setStatus(P_CANCELADO);
                participants.save(p);
            }
        }
        i.setState(RASCUNHO);
        i.setStartsAt(null);
        i.setEndsAt(null);
        i.setAcceptDeadline(null);
        instances.save(i);
        return views.detail(user, id);
    }
}
