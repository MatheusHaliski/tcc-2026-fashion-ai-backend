package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.repository.ChallengeInstanceRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.ChallengeRules.round2;
import static br.com.fashionai.application.service.ChallengeRules.tplName;
import static br.com.fashionai.application.service.ChallengeService.AGUARDANDO;
import static br.com.fashionai.application.service.ChallengeService.ATIVO;
import static br.com.fashionai.application.service.ChallengeService.CONCLUIDO;
import static br.com.fashionai.application.service.ChallengeService.EXPIRADO;
import static br.com.fashionai.application.service.ChallengeService.MAX_ACTIVE;
import static br.com.fashionai.application.service.ChallengeService.P_ATIVO;
import static br.com.fashionai.application.service.ChallengeService.P_CONCLUIU;
import static br.com.fashionai.application.service.ChallengeService.P_CONVIDADO;
import static br.com.fashionai.application.service.ChallengeService.P_SAIU;
import static br.com.fashionai.application.service.ChallengeService.RASCUNHO;

/**
 * Minhas participações: contagem de desafios ativos, limite de 3 ativos (CA06) e a lista agrupada por situação.
 * Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeParticipations {
    private final ChallengeTemplateRepository templates;
    private final ChallengeInstanceRepository instances;
    private final ChallengeParticipantRepository participants;

    ChallengeParticipations(ChallengeTemplateRepository templates, ChallengeInstanceRepository instances,
                            ChallengeParticipantRepository participants) {
        this.templates = templates;
        this.instances = instances;
        this.participants = participants;
    }

    long activeCount(UUID userId) {
        List<ChallengeParticipant> mine = participants.findByUserIdAndStatusIn(userId, List.of(P_ATIVO));
        if (mine.isEmpty()) {
            return 0;
        }
        Map<UUID, ChallengeInstance> byId = instances.findByIdIn(mine.stream().map(ChallengeParticipant::getInstanceId).toList()).stream()
                .collect(Collectors.toMap(ChallengeInstance::getId, i -> i));
        return mine.stream().map(p -> byId.get(p.getInstanceId())).filter(Objects::nonNull)
                .filter(i -> ATIVO.equals(i.getState()) || AGUARDANDO.equals(i.getState())).count();
    }

    void requireSlot(UUID userId) {
        if (activeCount(userId) >= MAX_ACTIVE) {
            List<Map<String, Object>> active = mineRaw(userId).stream().filter(m -> ATIVO.equals(m.get("state")) || AGUARDANDO.equals(m.get("state")))
                    .map(m -> Map.<String, Object>of("id", m.get("id"), "name", m.get("name"))).toList();
            throw new ApiException(409, "LIMITE_DESAFIOS", Msg.t("challenge.voce_ja_tem_desafios_ativos", MAX_ACTIVE),
                    Map.of("active", active));
        }
    }

    List<Map<String, Object>> mineRaw(UUID userId) {
        List<ChallengeParticipant> mine = participants.findByUserId(userId);
        if (mine.isEmpty()) {
            return List.of();
        }
        Map<UUID, ChallengeInstance> byId = instances.findByIdIn(mine.stream().map(ChallengeParticipant::getInstanceId).toList()).stream()
                .collect(Collectors.toMap(ChallengeInstance::getId, x -> x));
        List<Map<String, Object>> out = new ArrayList<>();
        for (ChallengeParticipant p : mine) {
            ChallengeInstance i = byId.get(p.getInstanceId());
            if (i == null) {
                continue;
            }
            ChallengeTemplate t = templates.findById(i.getTemplateCode()).orElse(null);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i.getId());
            m.put("code", i.getTemplateCode());
            m.put("name", t == null ? i.getTemplateCode() : tplName(t));
            m.put("mode", i.getMode());
            m.put("state", i.getState());
            m.put("myStatus", p.getStatus());
            m.put("fraction", round2(p.getProgressFraction().doubleValue()));
            m.put("endsAt", i.getEndsAt());
            m.put("acceptDeadline", i.getAcceptDeadline());
            out.add(m);
        }
        out.sort(Comparator.comparing((Map<String, Object> m) -> String.valueOf(m.get("state"))));
        return out;
    }

    Map<String, Object> mine(CurrentUser user) {
        List<Map<String, Object>> all = mineRaw(user.id());
        return Map.of(
                "active", all.stream().filter(m -> ATIVO.equals(m.get("state")) && P_ATIVO.equals(m.get("myStatus"))).toList(),
                "waiting", all.stream().filter(m -> AGUARDANDO.equals(m.get("state"))).toList(),
                "invites", all.stream().filter(m -> P_CONVIDADO.equals(m.get("myStatus")) && AGUARDANDO.equals(m.get("state"))).toList(),
                "drafts", all.stream().filter(m -> RASCUNHO.equals(m.get("state"))).toList(),
                "history", all.stream().filter(m -> CONCLUIDO.equals(m.get("state")) || EXPIRADO.equals(m.get("state"))
                        || P_SAIU.equals(m.get("myStatus")) || P_CONCLUIU.equals(m.get("myStatus"))).toList(),
                "maxActive", MAX_ACTIVE);
    }
}
