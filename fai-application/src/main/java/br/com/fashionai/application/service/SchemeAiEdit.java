package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.Mood;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.SchemeItemRepository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** RF9 / RF24.CA10 — "melhorar com IA": diff estruturado proposto pela IA, validado campo a campo e aplicado só no aceito. */
final class SchemeAiEdit {
    private final SchemeItemRepository schemeItems;
    private final AiEngine ai;
    private final Guard guard;
    private final Audit audit;
    private final SchemeReads reads;

    SchemeAiEdit(SchemeItemRepository schemeItems, AiEngine ai, Guard guard, Audit audit, SchemeReads reads) {
        this.schemeItems = schemeItems;
        this.ai = ai;
        this.guard = guard;
        this.audit = audit;
        this.reads = reads;
    }

    /** RF9 / RF24.CA10 — "melhorar com IA": diff estruturado, aceito ou recusado item a item. */
    Map<String, Object> improve(CurrentUser user, UUID id, String instruction) {
        guard.requireCanCreate(user);
        Scheme s = reads.owned(user, id);
        Map<String, Object> current = new LinkedHashMap<>();
        current.put("title", s.getTitle());
        current.put("description", s.getDescription());
        current.put("occasion", Json.csv(s.getOccasion()));
        current.put("style", Json.csv(s.getStyle()));
        current.put("season", s.getSeason() == null ? null : s.getSeason().name());
        current.put("mood", s.getMood() == null ? null : s.getMood().name());
        current.put("visibility", s.getVisibility().name());
        String system = """
                Você é o Edit Assistant do Fashion AI. Proponha alterações ao esquema a partir da instrução do usuário.
                Campos editáveis: title, description, occasion (máx 3 códigos), style (máx 3 códigos), season
                (SPRING/SUMMER/AUTUMN/WINTER), mood (ENERGETIC/ELEGANT/COMFORTABLE/SOPHISTICATED), visibility
                (PRIVATE/FOLLOWERS/PUBLIC). Responda SOMENTE com JSON:
                {"changes":[{"field":string,"proposed":valor,"reason":"1 frase"}]}"""
                + "\nEscreva title, description e reason em " + Msg.languageName() + "; field, occasion, style, season, mood e visibility seguem os códigos acima.";
        AiOutcome<List<LocalAdvisors.FieldChange>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.EDIT_ASSISTANT,
                system, Msg.t("scheme.esquema_atual_instrucao", Json.write(current), InputSanitizer.clean(instruction, 500)),
                List.of(), 900, List.of(Msg.t("scheme.campos_atuais_do_esquema"), "instrução em linguagem natural"),
                text -> parseDiff(text, current), () -> LocalAdvisors.proposeEdit(current, instruction == null ? "" : instruction), null));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("changes", outcome.value());
        out.put("explanation", outcome.explanation());
        out.put("inferenceId", outcome.inferenceId());
        out.put("message", outcome.userMessage());
        return out;
    }

    static List<LocalAdvisors.FieldChange> parseDiff(String text, Map<String, Object> current) {
        Map<String, Object> m = WardrobeService.extractJson(text);
        if (!(m.get("changes") instanceof List<?> list)) {
            return null;
        }
        List<LocalAdvisors.FieldChange> out = new ArrayList<>();
        for (Object o : list) {
            if (o instanceof Map<?, ?> c && c.get("field") != null && current.containsKey(String.valueOf(c.get("field")))) {
                String field = String.valueOf(c.get("field"));
                Object proposed = c.get("proposed");
                if (!validChange(field, proposed)) {
                    continue;
                }
                out.add(new LocalAdvisors.FieldChange(field, current.get(field), proposed, String.valueOf(c.get("reason"))));
            }
        }
        return out;
    }

    static boolean validChange(String field, Object v) {
        return switch (field) {
            case "occasion" -> v instanceof List<?> l && l.size() <= 3 && l.stream().allMatch(x -> Taxonomy.OCCASIONS.contains(String.valueOf(x)));
            case "style" -> v instanceof List<?> l && l.size() <= 3 && l.stream().allMatch(x -> Taxonomy.STYLES.contains(String.valueOf(x)));
            case "season" -> Set.of("SPRING", "SUMMER", "AUTUMN", "WINTER").contains(String.valueOf(v));
            case "mood" -> Set.of("ENERGETIC", "ELEGANT", "COMFORTABLE", "SOPHISTICATED").contains(String.valueOf(v));
            case "visibility" -> Set.of("PRIVATE", "FOLLOWERS", "PUBLIC").contains(String.valueOf(v));
            case "title", "description" -> v instanceof String s && !s.isBlank();
            default -> false;
        };
    }

    /** Aplica só os campos do diff que o usuário aceitou. */
    @SuppressWarnings("unchecked")
    Map<String, Object> applyDiff(CurrentUser user, UUID id, Map<String, Object> accepted) {
        guard.requireCanCreate(user);
        Scheme s = reads.owned(user, id);
        for (Map.Entry<String, Object> e : accepted.entrySet()) {
            if (!validChange(e.getKey(), e.getValue())) {
                throw ApiException.badRequest("DIFF_INVALIDO", Msg.t("scheme.alteracao_invalida_para_o_campo", e.getKey()));
            }
            switch (e.getKey()) {
                case "title" -> s.setTitle(InputSanitizer.moderated("title", (String) e.getValue(), 120));
                case "description" -> s.setDescription(InputSanitizer.moderated("description", (String) e.getValue(), 1000));
                case "occasion" -> s.setOccasion(Json.csv(((List<Object>) e.getValue()).stream().map(String::valueOf).toList()));
                case "style" -> s.setStyle(Json.csv(((List<Object>) e.getValue()).stream().map(String::valueOf).toList()));
                case "season" -> s.setSeason(Season.valueOf(String.valueOf(e.getValue())));
                case "mood" -> s.setMood(Mood.valueOf(String.valueOf(e.getValue())));
                case "visibility" -> s.setVisibility(Visibility.valueOf(String.valueOf(e.getValue())));
                default -> {
                }
            }
        }
        audit.log(user, AuditActions.EDICAO_ESQUEMA, "scheme:" + id, Map.of("aiDiffFields", accepted.keySet()));
        return Map.of("scheme", reads.view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(id)));
    }
}
