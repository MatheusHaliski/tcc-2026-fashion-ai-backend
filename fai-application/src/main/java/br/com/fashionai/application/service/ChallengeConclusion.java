package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.ChallengeEvent;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.ChallengeVote;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.ChallengeEventRepository;
import br.com.fashionai.domain.repository.ChallengeInstanceRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.ChallengeVoteRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.application.service.ChallengeService.Progress;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.ChallengeRules.VOTED;
import static br.com.fashionai.application.service.ChallengeRules.round2;
import static br.com.fashionai.application.service.ChallengeRules.tplName;
import static br.com.fashionai.application.service.ChallengeService.ATIVO;
import static br.com.fashionai.application.service.ChallengeService.CONCLUIDO;
import static br.com.fashionai.application.service.ChallengeService.P_ATIVO;
import static br.com.fashionai.application.service.ChallengeService.P_CONCLUIU;

/**
 * CA12 — atualização do progresso, conclusão e recompensa por modo (pontuação do duelo, divisão da recompensa e aviso
 * do resultado). Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeConclusion {
    private final ChallengeInstanceRepository instances;
    private final ChallengeParticipantRepository participants;
    private final ChallengeEventRepository evidence;
    private final ChallengeVoteRepository votes;
    private final UserRepository users;
    private final FaiPointsService points;
    private final NotificationService notifications;
    private final ChallengeProgressMeter progress;

    ChallengeConclusion(ChallengeInstanceRepository instances, ChallengeParticipantRepository participants,
                        ChallengeEventRepository evidence, ChallengeVoteRepository votes, UserRepository users, FaiPointsService points,
                        NotificationService notifications, ChallengeProgressMeter progress) {
        this.instances = instances;
        this.participants = participants;
        this.evidence = evidence;
        this.votes = votes;
        this.users = users;
        this.points = points;
        this.notifications = notifications;
        this.progress = progress;
    }

    void refresh(ChallengeInstance i, ChallengeTemplate t) {
        List<ChallengeParticipant> ps = participants.findByInstanceId(i.getId());
        for (ChallengeParticipant p : ps) {
            if (!P_ATIVO.equals(p.getStatus())) {
                continue;
            }
            Progress pr = progress.progress(i, p, t);
            p.setProgressFraction(BigDecimal.valueOf(pr.fraction()).setScale(4, RoundingMode.HALF_UP));
            p.setBestRecord(Math.max(p.getBestRecord(), pr.best()));
            participants.save(p);
        }
        // meta atingida → concluído (Solo/Comunidade: a própria meta; Equipe: média das frações = 1)
        if (!ATIVO.equals(i.getState()) || "DUELO".equals(i.getMode())) {
            return;
        }
        List<ChallengeParticipant> active = ps.stream().filter(p -> P_ATIVO.equals(p.getStatus())).toList();
        if (active.isEmpty()) {
            return;
        }
        double avg = active.stream().mapToDouble(p -> p.getProgressFraction().doubleValue()).average().orElse(0);
        if ("COMUNIDADE".equals(i.getMode())) {
            for (ChallengeParticipant p : active) {
                if (p.getProgressFraction().doubleValue() >= 1 && !"DAILY_CHALLENGE".equals(t.getCode())) {
                    finishParticipant(i, t, p, 1.0);
                }
            }
            return;
        }
        if (avg >= 0.9999) {
            conclude(i, t);
        }
    }

    void conclude(ChallengeInstance i, ChallengeTemplate t) {
        if (CONCLUIDO.equals(i.getState())) {
            return;
        }
        refreshProgressOnly(i, t);
        List<ChallengeParticipant> ps = participants.findByInstanceId(i.getId());
        List<ChallengeParticipant> members = ps.stream().filter(p -> P_ATIVO.equals(p.getStatus()) || P_CONCLUIU.equals(p.getStatus())).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("code", t.getCode());
        result.put("name", tplName(t));
        result.put("mode", i.getMode());
        result.put("concludedAt", Instant.now().toString());
        ChallengeRewardSplit split = ChallengeRewardSplit.forMode(i.getMode());
        boolean duel = split == ChallengeRewardSplit.DUEL;
        Map<UUID, Double> scores = duel ? duelScores(i, t, members) : Map.of();
        if (duel) {
            result.put("scoring", VOTED.contains(t.getCode()) ? Msg.t("challenge.votos_as_cegas") : "recorde pessoal");
        }
        ChallengeRewardSplit.Outcome outcome = split.split(members.stream()
                .map(p -> new ChallengeRewardSplit.Member(p.getUserId(), p.getTeam(), p.getProgressFraction())).toList(), scores, t.getRewardPoints());
        result.putAll(outcome.summary());
        for (int k = 0; k < members.size(); k++) {
            reward(members.get(k), i, t, outcome.points().get(k));
        }
        if (duel) {
            result.put("winners", outcome.winners().stream().map(id -> users.findById(id).map(User::getUsername).orElse("—")).toList());
            result.put("ranking", scores.entrySet().stream().sorted(Map.Entry.<UUID, Double>comparingByValue().reversed())
                    .map(e -> Map.of("user", users.findById(e.getKey()).map(User::getUsername).orElse("—"), "score", round2(e.getValue()))).toList());
        }
        i.setState(CONCLUIDO);
        i.setResultJson(Json.write(result));
        instances.save(i);
        for (ChallengeParticipant p : members) {
            notifications.notify(p.getUserId(), null, NotificationType.CHALLENGE_RESULT, "CHALLENGE", i.getId(), Msg.k("challenge.concluido", (tplName(t))),
                    Msg.k("challenge.veja_o_card_de_resultado"), Map.of("challengeId", i.getId().toString()));
        }
    }

    void refreshProgressOnly(ChallengeInstance i, ChallengeTemplate t) {
        for (ChallengeParticipant p : participants.findByInstanceId(i.getId())) {
            if (P_ATIVO.equals(p.getStatus())) {
                Progress pr = progress.progress(i, p, t);
                p.setProgressFraction(BigDecimal.valueOf(pr.fraction()).setScale(4, RoundingMode.HALF_UP));
                p.setBestRecord(Math.max(p.getBestRecord(), pr.best()));
                participants.save(p);
            }
        }
    }

    void finishParticipant(ChallengeInstance i, ChallengeTemplate t, ChallengeParticipant p, double fraction) {
        reward(p, i, t, (int) Math.round(t.getRewardPoints() * Math.min(1, fraction)));
    }

    void reward(ChallengeParticipant p, ChallengeInstance i, ChallengeTemplate t, int pts) {
        p.setStatus(P_CONCLUIU);
        participants.save(p);
        if (pts > 0) {
            points.award(p.getUserId(), "CHALLENGE_COMPLETED", "CHALLENGE", i.getId().toString(), pts);
        }
    }

    Map<UUID, Double> duelScores(ChallengeInstance i, ChallengeTemplate t, List<ChallengeParticipant> members) {
        Map<UUID, Double> out = new HashMap<>();
        if (VOTED.contains(t.getCode())) {
            Map<UUID, UUID> entryOwner = new HashMap<>();
            for (ChallengeEvent e : evidence.findByInstanceId(i.getId())) {
                if ("LOOK_ENTRY".equals(e.getEvidenceType())) {
                    entryOwner.put(e.getRefId(), e.getUserId());
                }
            }
            for (ChallengeVote v : votes.findByInstanceId(i.getId())) {
                UUID owner = entryOwner.get(v.getEntrySchemeId());
                if (owner != null) {
                    out.merge(owner, 1.0, Double::sum);
                }
            }
            members.forEach(p -> out.putIfAbsent(p.getUserId(), 0.0));
        } else {
            // recordes pessoais — não dependem do tamanho do acervo (§1.1 regra 2)
            members.forEach(p -> out.put(p.getUserId(), (double) Math.max(p.getBestRecord(), progress.progress(i, p, t).best())));
        }
        return out;
    }
}
