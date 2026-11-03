package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;
import br.com.fashionai.application.service.ChallengeService.ProposalRequest;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.ChallengeRules.ORIGINS;
import static br.com.fashionai.application.service.ChallengeRules.RULE_BLOCK_TYPES;
import static br.com.fashionai.application.service.ChallengeRules.describe;
import static br.com.fashionai.application.service.ChallengeRules.tplName;
import static br.com.fashionai.application.service.ChallengeRules.tplRule;

/**
 * §7 — desafios propostos pela comunidade (blocos de regra verificáveis) e promoção ao catálogo oficial pelo admin.
 * Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeProposals {
    private final ChallengeTemplateRepository templates;
    private final Guard guard;
    private final Audit audit;

    ChallengeProposals(ChallengeTemplateRepository templates, Guard guard, Audit audit) {
        this.templates = templates;
        this.guard = guard;
        this.audit = audit;
    }

    Map<String, Object> propose(CurrentUser user, ProposalRequest req) {
        guard.requireCanCreate(user);
        String name = InputSanitizer.moderated("nome", req.name() == null ? "" : req.name(), 60);
        if (name.isBlank()) {
            throw ApiException.badRequest("NOME_OBRIGATORIO", Msg.t("challenge.de_um_nome_ao_desafio"));
        }
        if (req.blocks() == null || req.blocks().isEmpty() || req.blocks().size() > 4) {
            throw ApiException.badRequest("BLOCOS_INVALIDOS", Msg.t("challenge.use_de_1_a_4"));
        }
        List<Map<String, Object>> clean = new ArrayList<>();
        Set<String> families = new HashSet<>(Taxonomy.COLOR_FAMILY.values());
        for (Map<String, Object> b : req.blocks()) {
            String type = String.valueOf(b.get("type"));
            Object v = b.get("value");
            if (!RULE_BLOCK_TYPES.contains(type)) {
                throw ApiException.badRequest("BLOCO_INVALIDO", Msg.t("challenge.bloco_desconhecido_use", type, RULE_BLOCK_TYPES));
            }
            boolean ok = switch (type) {
                case "color_family" -> families.contains(String.valueOf(v));
                case "category" -> Taxonomy.isValidCategory(String.valueOf(v));
                case "origin" -> List.of(String.valueOf(v).split("\\|")).stream().allMatch(ORIGINS::contains);
                case "state" -> Set.of("forgotten", "favorite", "available").contains(String.valueOf(v));
                case "slot" -> MirrorService.SLOTS.contains(String.valueOf(v));
                case "piece_count", "distinct_colors", "unused_days" -> v instanceof Number n && n.intValue() > 0 && n.intValue() <= 365;
                default -> true;
            };
            if (!ok) {
                throw ApiException.badRequest("BLOCO_INVALIDO", Msg.t("challenge.valor_invalido_para_o_bloco", type));
            }
            Map<String, Object> cb = new LinkedHashMap<>();
            cb.put("type", type);
            cb.put("value", v);
            cb.put("quantifier", "all".equalsIgnoreCase(String.valueOf(b.get("quantifier"))) ? "all" : "any");
            clean.add(cb);
        }
        List<String> modes = req.modes() == null || req.modes().isEmpty() ? List.of("SOLO") : req.modes().stream()
                .map(m -> m.toUpperCase(Locale.ROOT)).filter(m -> m.equals("SOLO") || m.equals("EQUIPE")).distinct().toList();
        int duration = req.durationDays() == null ? 7 : Math.max(1, Math.min(30, req.durationDays()));
        ChallengeTemplate t = new ChallengeTemplate();
        t.setCode(("COM_" + UUID.randomUUID().toString().replace("-", "")).substring(0, 16).toUpperCase(Locale.ROOT));
        t.setName(name);
        t.setRuleText(describe(clean) + " por " + duration + " dia(s)");
        t.setRuleBlocksJson(Json.write(clean));
        t.setModesAllowedJson(Json.write(modes.isEmpty() ? List.of("SOLO") : modes));
        t.setDurationDays(duration);
        t.setScoreDimensionsJson(Json.write(List.of("U", "R")));
        t.setRewardPoints(Math.min(150, 20 * duration));
        t.setEffort(duration <= 3 ? "BAIXO" : duration <= 10 ? "MEDIO" : "ALTO");
        t.setMinParticipants(1);
        t.setMaxParticipants(6);
        t.setOrigin("COMMUNITY");
        t.setAuthorUserId(user.id());
        t.setActive(true);
        templates.save(t);
        audit.log(user, "DESAFIO_PROPOSTO", "challenge-template:" + t.getCode(), Map.of("blocks", clean.size()));
        return Map.of("code", t.getCode(), "name", tplName(t), "rule", tplRule(t), "note",
                Msg.t("challenge.os_desafios_da_comunidade_com"));
    }

    /** Admin (RF25) — promove um desafio da comunidade ao catálogo oficial mantendo o autor. */
    Map<String, Object> promote(CurrentUser admin, String code) {
        guard.requireAdmin(admin);
        ChallengeTemplate t = templates.findById(code).orElseThrow(() -> ApiException.notFound("Desafio"));
        t.setOrigin("OFFICIAL");
        templates.save(t);
        return Map.of("code", code, "origin", "OFFICIAL", "author", String.valueOf(t.getAuthorUserId()));
    }
}
