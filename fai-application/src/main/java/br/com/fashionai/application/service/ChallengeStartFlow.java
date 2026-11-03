package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.ChallengeInstanceRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.application.service.ChallengeService.StartRequest;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.IsoFields;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static br.com.fashionai.application.service.ChallengeRules.dailyRuleBlocks;
import static br.com.fashionai.application.service.ChallengeRules.dailyRuleText;
import static br.com.fashionai.application.service.ChallengeRules.teamOf;
import static br.com.fashionai.application.service.ChallengeRules.today;
import static br.com.fashionai.application.service.ChallengeRules.tplName;
import static br.com.fashionai.application.service.ChallengeService.ACCEPT_WINDOW;
import static br.com.fashionai.application.service.ChallengeService.AGUARDANDO;
import static br.com.fashionai.application.service.ChallengeService.ATIVO;
import static br.com.fashionai.application.service.ChallengeService.P_ATIVO;
import static br.com.fashionai.application.service.ChallengeService.P_CONVIDADO;
import static br.com.fashionai.application.service.ChallengeService.RASCUNHO;

/**
 * CA03/CA04 — criar, lançar o rascunho, convidar (só quem a pessoa segue ou com a Chave do Quarto) e entrar no desafio
 * da comunidade. Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeStartFlow {
    private final ChallengeInstanceRepository instances;
    private final ChallengeParticipantRepository participants;
    private final FollowRepository follows;
    private final RoomService room;
    private final NotificationService notifications;
    private final Guard guard;
    private final Audit audit;
    private final ChallengeStore store;
    private final ChallengeParticipations slots;
    private final ChallengeLifecycle lifecycle;
    private final ChallengeParams parameters;
    private final ChallengeDetailView views;

    ChallengeStartFlow(ChallengeInstanceRepository instances, ChallengeParticipantRepository participants, FollowRepository follows,
                       RoomService room, NotificationService notifications, Guard guard, Audit audit, ChallengeStore store,
                       ChallengeParticipations slots, ChallengeLifecycle lifecycle, ChallengeParams parameters, ChallengeDetailView views) {
        this.instances = instances;
        this.participants = participants;
        this.follows = follows;
        this.room = room;
        this.notifications = notifications;
        this.guard = guard;
        this.audit = audit;
        this.store = store;
        this.slots = slots;
        this.lifecycle = lifecycle;
        this.parameters = parameters;
        this.views = views;
    }

    Map<String, Object> start(CurrentUser user, StartRequest req) {
        guard.requireCanCreate(user);
        ChallengeTemplate t = store.template(req.code());
        String mode = req.mode() == null ? "SOLO" : req.mode().toUpperCase(Locale.ROOT);
        if (!Json.strings(t.getModesAllowedJson()).contains(mode)) {
            throw ApiException.badRequest("MODO_INDISPONIVEL", Msg.t("challenge.o_desafio_nao_aceita_o", tplName(t), mode));
        }
        if (mode.equals("COMUNIDADE")) {
            return joinCommunity(user, t, req.photoConsent());
        }
        boolean draft = Boolean.TRUE.equals(req.draft());
        if (!draft) {
            slots.requireSlot(user.id());
        }
        Map<String, Object> params = parameters.validateParams(user, t, mode, req.params() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(req.params()));
        ChallengeInstance i = new ChallengeInstance();
        i.setId(UUID.randomUUID());
        i.setTemplateCode(t.getCode());
        i.setMode(mode);
        i.setCreatedBy(user.id());
        i.setParamsJson(Json.write(params));
        i.setState(RASCUNHO);
        instances.save(i);
        ChallengeParticipant me = store.participant(i, user.id(), P_ATIVO, teamOf(req.teams(), user.id(), mode));
        me.setPersonalGoalJson(Json.write(lifecycle.personalGoal(user.id(), t, i, params, req.photoConsent())));
        participants.save(me);
        if (!draft) {
            launch(user, i, t, req.invitees(), req.teams());
        }
        audit.log(user, "DESAFIO_CRIADO", "challenge:" + i.getId(), Map.of("code", t.getCode(), "mode", mode, "state", i.getState()));
        return views.detail(user, i.getId());
    }

    /** Rascunho → aguardando (Equipe/Duelo) ou ativo (Solo). */
    Map<String, Object> launchDraft(CurrentUser user, UUID id, List<UUID> invitees, Map<String, String> teams) {
        ChallengeInstance i = store.instance(id);
        if (!i.getCreatedBy().equals(user.id())) {
            throw guard.deny(user, "challenge:" + id, Msg.t("challenge.so_quem_criou_o_desafio"));
        }
        if (!RASCUNHO.equals(i.getState())) {
            throw new ApiException(409, "ESTADO_INVALIDO", Msg.t("challenge.o_desafio_ja_foi_iniciado"));
        }
        slots.requireSlot(user.id());
        launch(user, i, store.template(i.getTemplateCode()), invitees, teams);
        return views.detail(user, id);
    }

    void launch(CurrentUser user, ChallengeInstance i, ChallengeTemplate t, List<UUID> invitees, Map<String, String> teams) {
        if (i.getMode().equals("SOLO")) {
            lifecycle.activate(i, t);
            return;
        }
        List<UUID> list = invitees == null ? List.of() : invitees.stream().filter(u -> !u.equals(user.id())).distinct().toList();
        if (list.isEmpty()) {
            throw ApiException.badRequest("SEM_CONVIDADOS", Msg.t("challenge.convide_ao_menos_1_pessoa", i.getMode().toLowerCase(Locale.ROOT)));
        }
        if (list.size() + 1 > t.getMaxParticipants()) {
            throw ApiException.badRequest("PARTICIPANTES_DEMAIS", Msg.t("challenge.este_desafio_aceita_ate_participantes", t.getMaxParticipants()));
        }
        for (UUID invitee : list) {
            boolean follows = this.follows.findByFollowerIdAndFollowingId(user.id(), invitee).filter(f -> f.getStatus() == FollowStatus.ACEITO).isPresent();
            if (!follows && !room.hasKey(user.id(), invitee)) {
                throw guard.deny(user, "challenge-invite:" + invitee,
                        Msg.t("challenge.voce_so_pode_convidar_quem"));
            }
        }
        i.setState(AGUARDANDO);
        i.setAcceptDeadline(Instant.now().plus(ACCEPT_WINDOW));
        instances.save(i);
        ChallengeTemplate tpl = t;
        for (UUID invitee : list) {
            ChallengeParticipant p = participants.findByInstanceIdAndUserId(i.getId(), invitee)
                    .orElseGet(() -> store.participant(i, invitee, P_CONVIDADO, teamOf(teams, invitee, i.getMode())));
            p.setStatus(P_CONVIDADO);
            participants.save(p);
            notifications.notify(invitee, user.id(), NotificationType.CHALLENGE_INVITE, "CHALLENGE", i.getId(),
                    Msg.k("challenge.convidou_voce_para", user.username(), tpl.getName()),
                    tpl.getRuleText() + " · modo " + i.getMode().toLowerCase(Locale.ROOT) + ". O convite vale por 48 h.",
                    Map.of("challengeId", i.getId().toString(), "code", tpl.getCode()));
        }
    }

    /** Comunidade: a mesma regra para todo mundo — uma instância compartilhada por período (dia ou semana). */
    Map<String, Object> joinCommunity(CurrentUser user, ChallengeTemplate t, Boolean photoConsent) {
        LocalDate d = today();
        String period = t.getCode().equals("DAILY_CHALLENGE") ? d.toString() : d.getYear() + "-W" + d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        ChallengeInstance i = instances.findByStateIn(List.of(ATIVO)).stream()
                .filter(x -> x.getTemplateCode().equals(t.getCode()) && "COMUNIDADE".equals(x.getMode()))
                .filter(x -> period.equals(Json.map(x.getParamsJson()).get("period"))).findFirst().orElse(null);
        if (i == null) {
            i = new ChallengeInstance();
            i.setId(UUID.randomUUID());
            i.setTemplateCode(t.getCode());
            i.setMode("COMUNIDADE");
            i.setCreatedBy(user.id());
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("period", period);
            if (t.getCode().equals("DAILY_CHALLENGE")) {
                params.put("rule", dailyRuleText(d));
                params.put("blocks", dailyRuleBlocks(d));
                params.put("number", d.getDayOfYear());
            }
            i.setParamsJson(Json.write(params));
            i.setState(ATIVO);
            i.setStartsAt(d.atStartOfDay(FaiPointsService.ZONE).toInstant());
            i.setEndsAt((t.getCode().equals("DAILY_CHALLENGE") ? d.plusDays(1) : d.with(java.time.DayOfWeek.MONDAY).plusWeeks(1))
                    .atStartOfDay(FaiPointsService.ZONE).toInstant());
            instances.save(i);
        }
        Optional<ChallengeParticipant> existing = participants.findByInstanceIdAndUserId(i.getId(), user.id());
        if (existing.isEmpty() || !P_ATIVO.equals(existing.get().getStatus())) {
            slots.requireSlot(user.id());
            ChallengeInstance joined = i;
            ChallengeParticipant p = existing.orElseGet(() -> store.participant(joined, user.id(), P_ATIVO, null));
            p.setStatus(P_ATIVO);
            p.setJoinedAt(Instant.now());
            p.setLeftAt(null);
            p.setPersonalGoalJson(Json.write(lifecycle.personalGoal(user.id(), t, i, Json.map(i.getParamsJson()), photoConsent)));
            participants.save(p);
        }
        return views.detail(user, i.getId());
    }
}
