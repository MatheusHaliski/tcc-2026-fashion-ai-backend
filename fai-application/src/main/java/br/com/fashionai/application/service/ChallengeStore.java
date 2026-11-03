package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.ChallengeEvent;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.repository.ChallengeEventRepository;
import br.com.fashionai.domain.repository.ChallengeInstanceRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.ChallengeService.ATIVO;
import static br.com.fashionai.application.service.ChallengeService.P_ATIVO;

/**
 * Acesso aos dados dos desafios usado por vários casos de uso: modelo ativo, instância, novo participante, participações
 * ativas da pessoa e gravação idempotente de evidência. Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeStore {
    private final ChallengeTemplateRepository templates;
    private final ChallengeInstanceRepository instances;
    private final ChallengeParticipantRepository participants;
    private final ChallengeEventRepository evidence;

    ChallengeStore(ChallengeTemplateRepository templates, ChallengeInstanceRepository instances,
                   ChallengeParticipantRepository participants, ChallengeEventRepository evidence) {
        this.templates = templates;
        this.instances = instances;
        this.participants = participants;
        this.evidence = evidence;
    }

    ChallengeTemplate template(String code) {
        return templates.findById(code).filter(ChallengeTemplate::isActive).orElseThrow(() -> ApiException.notFound("Desafio"));
    }

    ChallengeInstance instance(UUID id) {
        return instances.findById(id).orElseThrow(() -> ApiException.notFound("Desafio"));
    }

    ChallengeParticipant participant(ChallengeInstance i, UUID userId, String status, String team) {
        ChallengeParticipant p = new ChallengeParticipant();
        p.setId(UUID.randomUUID());
        p.setInstanceId(i.getId());
        p.setUserId(userId);
        p.setStatus(status);
        p.setTeam(team);
        if (P_ATIVO.equals(status)) {
            p.setJoinedAt(Instant.now());
        }
        return p;
    }

    List<Object[]> activeParticipations(UUID userId) {
        List<ChallengeParticipant> mine = participants.findByUserIdAndStatusIn(userId, List.of(P_ATIVO));
        if (mine.isEmpty()) {
            return List.of();
        }
        Map<UUID, ChallengeInstance> byId = instances.findByIdIn(mine.stream().map(ChallengeParticipant::getInstanceId).toList()).stream()
                .filter(i -> ATIVO.equals(i.getState())).collect(Collectors.toMap(ChallengeInstance::getId, i -> i));
        List<Object[]> out = new ArrayList<>();
        for (ChallengeParticipant p : mine) {
            ChallengeInstance i = byId.get(p.getInstanceId());
            if (i != null) {
                templates.findById(i.getTemplateCode()).ifPresent(t -> out.add(new Object[]{i, p, t}));
            }
        }
        return out;
    }

    boolean record(ChallengeInstance i, UUID userId, String type, UUID ref) {
        if (evidence.existsByInstanceIdAndUserIdAndEvidenceTypeAndRefId(i.getId(), userId, type, ref)) {
            return false;
        }
        ChallengeEvent e = new ChallengeEvent();
        e.setId(UUID.randomUUID());
        e.setInstanceId(i.getId());
        e.setUserId(userId);
        e.setEvidenceType(type);
        e.setRefId(ref);
        evidence.save(e);
        return true;
    }
}
