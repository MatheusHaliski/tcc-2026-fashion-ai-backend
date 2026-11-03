package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.ChallengeInstanceRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.service.ChallengeRules.DIM_NAMES;
import static br.com.fashionai.application.service.ChallengeRules.dailyRuleText;
import static br.com.fashionai.application.service.ChallengeRules.runwayTheme;
import static br.com.fashionai.application.service.ChallengeRules.today;
import static br.com.fashionai.application.service.ChallengeRules.tplName;
import static br.com.fashionai.application.service.ChallengeRules.tplRule;
import static br.com.fashionai.application.service.ChallengeService.ATIVO;
import static br.com.fashionai.application.service.ChallengeService.MAX_ACTIVE;
import static br.com.fashionai.application.service.ChallengeService.PRESET_NOTES;
import static br.com.fashionai.application.service.ChallengeService.P_ATIVO;
import static br.com.fashionai.application.service.ChallengeService.REACTIONS;

/**
 * Catálogo de desafios (CA01/CA02, anatomia do card §2.1). Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeCatalogView {
    private final ChallengeTemplateRepository templates;
    private final ChallengeInstanceRepository instances;
    private final ChallengeParticipantRepository participants;
    private final UserRepository users;
    private final ChallengeParticipations slots;

    ChallengeCatalogView(ChallengeTemplateRepository templates, ChallengeInstanceRepository instances,
                         ChallengeParticipantRepository participants, UserRepository users, ChallengeParticipations slots) {
        this.templates = templates;
        this.instances = instances;
        this.participants = participants;
        this.users = users;
        this.slots = slots;
    }

    Map<String, Object> catalog(CurrentUser user) {
        Map<String, Long> playing = new HashMap<>();
        for (ChallengeInstance i : instances.findByStateIn(List.of(ATIVO))) {
            long n = participants.findByInstanceId(i.getId()).stream().filter(p -> P_ATIVO.equals(p.getStatus())).count();
            playing.merge(i.getTemplateCode(), n, Long::sum);
        }
        LocalDate d = today();
        List<Map<String, Object>> cards = new ArrayList<>();
        for (ChallengeTemplate t : templates.findByActiveTrueOrderByName()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", t.getCode());
            m.put("name", tplName(t));
            m.put("rule", tplRule(t));
            m.put("durationDays", t.getDurationDays());
            m.put("modes", Json.strings(t.getModesAllowedJson()));
            List<String> dims = Json.strings(t.getScoreDimensionsJson());
            m.put("improves", dims.stream().map(x -> DIM_NAMES.getOrDefault(x, x)).toList());
            m.put("dimensions", dims);
            m.put("effort", t.getEffort());
            m.put("effortDots", switch (t.getEffort()) {
                case "BAIXO" -> "●○○";
                case "ALTO" -> "●●●";
                default -> "●●○";
            });
            m.put("reward", Msg.t("challenge.ate_fai_pts", t.getRewardPoints()));
            m.put("rewardPoints", t.getRewardPoints());
            m.put("participants", Map.of("min", t.getMinParticipants(), "max", t.getMaxParticipants()));
            m.put("playingNow", playing.getOrDefault(t.getCode(), 0L));
            m.put("origin", t.getOrigin());
            m.put("author", t.getAuthorUserId() == null ? null : users.findById(t.getAuthorUserId()).map(User::getUsername).orElse(null));
            m.put("roomDecoration", t.getRoomDecoration());
            if (t.getCode().equals("DAILY_CHALLENGE")) {
                m.put("todayRule", dailyRuleText(d));
            }
            if (t.getCode().equals("RUNWAY_BATTLE")) {
                m.put("weeklyTheme", runwayTheme(d));
            }
            if (t.getCode().equals("WEAR_WHAT_YOU_HAVE") && d.getMonthValue() == 4) {
                m.put("highlight", Msg.t("challenge.fashion_revolution_week_vista_o"));
            }
            cards.add(m);
        }
        long active = slots.activeCount(user.id());
        return Map.of("challenges", cards, "activeCount", active, "maxActive", MAX_ACTIVE, "reactions", REACTIONS, "presetNotes", PRESET_NOTES,
                "note", Msg.t("challenge.desafios_comparam_o_uso_do"));
    }
}
